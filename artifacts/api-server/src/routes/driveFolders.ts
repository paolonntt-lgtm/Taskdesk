import { Router, type IRouter, type Request, type Response as ExpressResponse } from "express";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  ticketDriveFoldersTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import {
  AddTicketDriveFolderBody,
  AddTicketDriveFolderParams,
  ListDrivePickerFoldersQueryParams,
  ListTicketDriveFolderItemsParams,
  ListTicketDriveFolderItemsQueryParams,
  RemoveTicketDriveFolderParams,
  StartDriveOAuthQueryParams,
  StartDriveSessionOAuthQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getCurrentUserId, getSessionId } from "../lib/session";
import { appBaseUrl } from "../lib/appUrl";

const router: IRouter = Router();
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const MAX_ANCESTORS = 200;
const DRIVE_STATE_PATTERN = /^drive_(?:(\d+)|(library|new-ticket))_([a-f0-9]{64})$/;
const OAUTH_MESSAGE_TYPE = "taskdesk-drive-oauth";

type PendingDriveState = {
  createdAt: number;
  userId: number;
  sessionId: string;
  ticketId: number | null;
  context: "ticket" | "library" | "new-ticket";
};
type TemporaryDriveToken = {
  accessToken: string;
  expiresAt: number;
  userId: number;
};
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
};
type DriveApiFailure = {
  status: number;
  code: string;
  message: string;
  googleReason?: string;
  googleProjectNumber?: string;
};

const pendingStates = new Map<string, PendingDriveState>();
const temporaryTokens = new Map<string, TemporaryDriveToken>();

function pruneTemporaryCredentials(): void {
  const now = Date.now();
  for (const [state, pending] of pendingStates) {
    if (now - pending.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
  for (const [key, token] of temporaryTokens) {
    if (token.expiresAt <= now) temporaryTokens.delete(key);
  }
  if (pendingStates.size > 2_000) {
    for (const [state, pending] of pendingStates) {
      if (now - pending.createdAt > STATE_TTL_MS / 2) pendingStates.delete(state);
    }
  }
  if (temporaryTokens.size > 2_000) {
    for (const [key, token] of temporaryTokens) {
      if (token.expiresAt <= now + TOKEN_MAX_AGE_MS / 2) temporaryTokens.delete(key);
    }
  }
}

function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

function getDriveCallbackUrl(): string {
  return `${appBaseUrl()}/api/auth/google/callback`;
}

function tokenKey(sessionId: string, userId: number): string {
  return `${sessionId}:${userId}`;
}

function escapeHtmlJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function oauthResultPage(
  ticketId: number | null,
  status: string,
  context: PendingDriveState["context"] = "ticket",
): string {
  const message = {
    type: OAUTH_MESSAGE_TYPE,
    ticketId,
    context,
    status,
  };
  const fallbackPath = ticketId
    ? `/app/tickets/${ticketId}`
    : context === "library"
      ? "/app/drive"
      : context === "new-ticket"
        ? "/app/tickets/new"
        : "/app/";
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
    `<script>if(window.opener){window.opener.postMessage(${escapeHtmlJson(message)},location.origin);window.close()}else{location.replace(${escapeHtmlJson(fallbackPath)})}</script>` +
    `</body></html>`;
}

function sendOAuthResult(
  res: ExpressResponse,
  ticketId: number | null,
  status: string,
  httpStatus = 200,
  context: PendingDriveState["context"] = "ticket",
): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(httpStatus).send(oauthResultPage(ticketId, status, context));
}

function sendError(res: ExpressResponse, status: number, code: string, message: string): void {
  res.status(status).json({ error: code, message });
}

function getTemporaryToken(req: Request): string | null {
  pruneTemporaryCredentials();
  const user = (req as any).currentUser as { id?: number } | undefined;
  const sessionId = getSessionId(req);
  if (!user?.id || !sessionId) return null;
  const key = tokenKey(sessionId, user.id);
  const token = temporaryTokens.get(key);
  if (!token || token.userId !== user.id || token.expiresAt <= Date.now()) {
    temporaryTokens.delete(key);
    return null;
  }
  return token.accessToken;
}

function clearTemporaryToken(req: Request): void {
  const user = (req as any).currentUser as { id?: number } | undefined;
  const sessionId = getSessionId(req);
  if (user?.id && sessionId) temporaryTokens.delete(tokenKey(sessionId, user.id));
}

async function getVisibleTicket(req: Request, ticketId: number) {
  const user = (req as any).currentUser as { organizationId?: number | null; role?: string };
  if (!user?.organizationId) return null;
  const [ticket] = await db
    .select({
      id: ticketsTable.id,
      organizationId: ticketsTable.organizationId,
      visibility: ticketsTable.visibility,
    })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.id, ticketId),
      eq(ticketsTable.organizationId, user.organizationId),
      isNull(ticketsTable.deletedAt),
    ));
  if (!ticket || (user.role !== "admin" && ticket.visibility === "admins")) return null;
  return ticket;
}

async function readGoogleError(response: globalThis.Response): Promise<DriveApiFailure> {
  const payload = await response.clone().json().catch(() => null) as
    | { error?: { message?: string; errors?: Array<{ reason?: string }> } }
    | null;
  const googleMessage = payload?.error?.message ?? "";
  const googleReason = payload?.error?.errors?.[0]?.reason;
  if (response.status === 401) {
    return { status: 401, code: "DRIVE_TOKEN_EXPIRED", message: "Google Drive authorization expired." };
  }
  if (response.status === 403) {
    const apiDisabled =
      googleReason === "accessNotConfigured" ||
      /drive api.*(not been used|disabled)|enable.*drive api/i.test(googleMessage);
    if (apiDisabled) {
      const googleProjectNumber = googleMessage.match(/\bproject\s+(\d+)\b/i)?.[1];
      return {
        status: 503,
        code: "DRIVE_API_NOT_ENABLED",
        message: googleProjectNumber
          ? `Google Drive API is not enabled for Google Cloud project ${googleProjectNumber}. Enable it in that exact project, then reconnect.`
          : "Google Drive API is not enabled for this Google Cloud project. Enable the Google Drive API, then reconnect.",
        googleReason,
        googleProjectNumber,
      };
    }
    const scopeDenied = ["insufficientPermissions", "insufficientFilePermissions", "appNotAuthorizedToFile"]
      .includes(googleReason ?? "");
    return {
      status: 403,
      code: "DRIVE_ACCESS_DENIED",
      message: scopeDenied
        ? "The connected Google account or its Drive permissions do not allow this request. Reconnect with the account that can access these files."
        : "Google Drive denied access. Check that the Drive API is enabled and the connected account has access, then reconnect.",
      googleReason,
    };
  }
  if (response.status === 404) {
    return { status: 403, code: "DRIVE_ACCESS_REVOKED", message: "The folder is unavailable or access was revoked." };
  }
  if (response.status === 429) {
    return { status: 503, code: "DRIVE_TEMPORARILY_UNAVAILABLE", message: "Google Drive is temporarily unavailable." };
  }
  return { status: 502, code: "DRIVE_API_ERROR", message: "Could not read Google Drive metadata." };
}

async function getDriveFile(accessToken: string, id: string): Promise<DriveFile> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "id,name,mimeType,parents,webViewLink");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await readGoogleError(response);
  return await response.json() as DriveFile;
}

async function listDriveChildren(
  accessToken: string,
  parentId: string,
  foldersOnly: boolean,
): Promise<DriveFile[]> {
  const escapedParentId = parentId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const locationPredicate = parentId === "root"
    ? "('root' in parents or sharedWithMe = true)"
    : `'${escapedParentId}' in parents`;
  const predicates = [locationPredicate, "trashed = false"];
  if (foldersOnly) predicates.push(`mimeType = '${DRIVE_FOLDER_MIME}'`);
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", predicates.join(" and "));
  url.searchParams.set("pageSize", "1000");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,sharedWithMe)");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await readGoogleError(response);
  const payload = await response.json() as { files?: DriveFile[] };
  return (payload.files ?? []).filter((file) => file.id && file.name && file.mimeType);
}

async function isWithinLinkedFolder(
  accessToken: string,
  candidateId: string,
  rootId: string,
): Promise<boolean> {
  const queue: Array<{ id: string; depth: number }> = [{ id: candidateId, depth: 0 }];
  const visited = new Set<string>();
  let inspected = 0;
  while (queue.length > 0 && inspected < MAX_ANCESTORS) {
    const next = queue.shift()!;
    if (next.id === rootId) return true;
    if (visited.has(next.id) || next.depth >= MAX_ANCESTORS) continue;
    visited.add(next.id);
    inspected += 1;
    const file = await getDriveFile(accessToken, next.id);
    if (file.mimeType !== DRIVE_FOLDER_MIME) return false;
    for (const parentId of file.parents ?? []) {
      if (!visited.has(parentId)) queue.push({ id: parentId, depth: next.depth + 1 });
    }
  }
  return false;
}

function handleDriveFailure(req: Request, res: ExpressResponse, error: unknown): void {
  if (error && typeof error === "object" && "status" in error && "code" in error) {
    const failure = error as DriveApiFailure;
    if (failure.status === 401) clearTemporaryToken(req);
    if (failure.status === 403 || failure.code === "DRIVE_API_NOT_ENABLED") {
      req.log?.warn?.(
        {
          googleReason: failure.googleReason,
          googleProjectNumber: failure.googleProjectNumber,
          driveErrorCode: failure.code,
        },
        "Google Drive rejected a request",
      );
    }
    sendError(res, failure.status, failure.code, failure.message);
    return;
  }
  req.log.error({ err: error }, "Google Drive operation failed");
  sendError(res, 502, "DRIVE_API_ERROR", "Could not read Google Drive metadata.");
}

router.get("/drive/oauth/start", requireAuth, async (req, res): Promise<void> => {
  const parsed = StartDriveOAuthQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "INVALID_REQUEST", "A valid ticket id is required.");
    return;
  }
  const ticket = await getVisibleTicket(req, parsed.data.ticketId);
  if (!ticket) {
    sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    return;
  }
  startDriveOAuth(req, res, parsed.data.ticketId, "ticket");
});

function startDriveOAuth(
  req: Request,
  res: ExpressResponse,
  ticketId: number | null,
  context: PendingDriveState["context"],
): void {
  if (!getGoogleClientId() || !getGoogleClientSecret()) {
    sendOAuthResult(res, ticketId, "not_configured", 503, context);
    return;
  }

  const user = (req as any).currentUser as { id: number };
  const sessionId = getSessionId(req);
  if (!sessionId) {
    sendError(res, 401, "NOT_AUTHENTICATED", "Sign in again before connecting Google Drive.");
    return;
  }
  pruneTemporaryCredentials();
  const stateKey = ticketId ?? (context === "library" ? "library" : "new-ticket");
  const state = `drive_${stateKey}_${randomBytes(32).toString("hex")}`;
  pendingStates.set(state, {
    createdAt: Date.now(),
    userId: user.id,
    sessionId,
    ticketId,
    context,
  });
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getDriveCallbackUrl(),
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "online",
    prompt: "select_account",
    state,
  });
  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(
    `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
    `<script>window.location.replace(${escapeHtmlJson(authorizationUrl)})</script></body></html>`,
  );
}

router.get("/drive/session/oauth/start", requireAuth, (req, res): void => {
  const parsed = StartDriveSessionOAuthQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "INVALID_REQUEST", "A valid Drive connection context is required.");
    return;
  }
  startDriveOAuth(req, res, null, parsed.data.context);
});

export function isDriveOAuthState(state: string): boolean {
  pruneTemporaryCredentials();
  return DRIVE_STATE_PATTERN.test(state);
}

async function completeDriveOAuthCallback(req: Request, res: ExpressResponse): Promise<void> {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const pending = pendingStates.get(state);
  const stateMatch = state.match(DRIVE_STATE_PATTERN);
  const stateTicketId = stateMatch?.[1];
  const stateContext = (stateMatch?.[2] as "library" | "new-ticket" | undefined) ?? "ticket";
  pendingStates.delete(state);
  const sessionId = getSessionId(req);
  const userId = await getCurrentUserId(req);
  const [user] = pending
    ? await db.select({ id: usersTable.id, isActive: usersTable.isActive })
        .from(usersTable)
        .where(eq(usersTable.id, pending.userId))
    : [];
  if (!pending || Date.now() - pending.createdAt > STATE_TTL_MS ||
      !userId || pending.userId !== userId || !user?.isActive || pending.sessionId !== sessionId) {
    sendOAuthResult(
      res,
      pending?.ticketId ?? (stateTicketId ? Number(stateTicketId) : null),
      "invalid_state",
      200,
      pending?.context ?? stateContext,
    );
    return;
  }
  if (req.query.error || typeof req.query.code !== "string") {
    sendOAuthResult(res, pending.ticketId, req.query.error === "access_denied" ? "cancelled" : "oauth_error", 200, pending.context);
    return;
  }
  if (!getGoogleClientId() || !getGoogleClientSecret()) {
    sendOAuthResult(res, pending.ticketId, "not_configured", 200, pending.context);
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        redirect_uri: getDriveCallbackUrl(),
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload = await tokenResponse.json() as {
      access_token?: string;
      expires_in?: number;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      sendOAuthResult(res, pending.ticketId, "oauth_error", 200, pending.context);
      return;
    }
    const expiresInMs = Math.min(
      Math.max(0, Number(tokenPayload.expires_in ?? 0) * 1000),
      TOKEN_MAX_AGE_MS,
    );
    if (expiresInMs <= 0) {
      sendOAuthResult(res, pending.ticketId, "expired", 200, pending.context);
      return;
    }
    temporaryTokens.set(tokenKey(pending.sessionId, pending.userId), {
      accessToken: tokenPayload.access_token,
      expiresAt: Date.now() + expiresInMs,
      userId: pending.userId,
    });
    sendOAuthResult(res, pending.ticketId, "ok", 200, pending.context);
  } catch (error) {
    req.log.warn({ err: error }, "Google Drive OAuth token exchange failed");
    sendOAuthResult(res, pending.ticketId, "oauth_error", 200, pending.context);
  }
}

router.get("/auth/google/callback", async (req, res, next): Promise<void> => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!isDriveOAuthState(state)) {
    next();
    return;
  }
  try {
    await completeDriveOAuthCallback(req, res);
  } catch (error) {
    req.log.error({ err: error }, "Google Drive OAuth callback failed");
    const stateValue = typeof req.query.state === "string" ? req.query.state : "";
    const pending = pendingStates.get(stateValue);
    pendingStates.delete(stateValue);
    const stateMatch = stateValue.match(DRIVE_STATE_PATTERN);
    const context = pending?.context ?? (stateMatch?.[2] as "library" | "new-ticket" | undefined) ?? "ticket";
    sendOAuthResult(res, pending?.ticketId ?? null, "oauth_error", 200, context);
  }
});

router.get("/drive/items", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListDrivePickerFoldersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid folder location.");
    return;
  }
  const accessToken = getTemporaryToken(req);
  if (!accessToken) {
    sendError(res, 401, "DRIVE_AUTH_REQUIRED", "Connect Google Drive to choose a folder.");
    return;
  }
  const parentId = parsed.data.parentId ?? "root";
  if (parentId !== "root" && !/^[A-Za-z0-9_-]{1,256}$/.test(parentId)) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid folder location.");
    return;
  }
  try {
    if (parentId !== "root") {
      const parent = await getDriveFile(accessToken, parentId);
      if (parent.mimeType !== DRIVE_FOLDER_MIME) {
        sendError(res, 400, "NOT_A_FOLDER", "The selected location is not a folder.");
        return;
      }
    }
    const items = await listDriveChildren(accessToken, parentId, false);
    res.json(items.map((item) => ({
      driveItemId: item.id,
      name: item.name,
      mimeType: item.mimeType,
      isFolder: item.mimeType === DRIVE_FOLDER_MIME,
      webViewLink: item.webViewLink ?? null,
    })));
  } catch (error) {
    handleDriveFailure(req, res, error);
  }
});

router.get("/drive/picker", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListDrivePickerFoldersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid folder location.");
    return;
  }
  const accessToken = getTemporaryToken(req);
  if (!accessToken) {
    sendError(res, 401, "DRIVE_AUTH_REQUIRED", "Connect Google Drive to choose a folder.");
    return;
  }
  const parentId = parsed.data.parentId ?? "root";
  if (parentId !== "root" && !/^[A-Za-z0-9_-]{1,256}$/.test(parentId)) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid folder location.");
    return;
  }
  try {
    if (parentId !== "root") {
      const parent = await getDriveFile(accessToken, parentId);
      if (parent.mimeType !== DRIVE_FOLDER_MIME) {
        sendError(res, 400, "NOT_A_FOLDER", "The selected location is not a folder.");
        return;
      }
    }
    const folders = await listDriveChildren(accessToken, parentId, true);
    res.json(folders.map((folder) => ({
      driveFolderId: folder.id,
      folderName: folder.name,
    })));
  } catch (error) {
    handleDriveFailure(req, res, error);
  }
});

router.get("/tickets/:id/drive-folders", requireAuth, async (req, res): Promise<void> => {
  const params = AddTicketDriveFolderParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid ticket id.");
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    return;
  }
  const folders = await db
    .select({
      id: ticketDriveFoldersTable.id,
      driveFolderId: ticketDriveFoldersTable.driveFolderId,
      folderName: ticketDriveFoldersTable.folderName,
      createdAt: ticketDriveFoldersTable.createdAt,
    })
    .from(ticketDriveFoldersTable)
    .where(and(
      eq(ticketDriveFoldersTable.ticketId, ticket.id),
      eq(ticketDriveFoldersTable.organizationId, ticket.organizationId!),
    ))
    .orderBy(ticketDriveFoldersTable.createdAt);
  res.json(folders);
});

router.post("/tickets/:id/drive-folders", requireAuth, async (req, res): Promise<void> => {
  const params = AddTicketDriveFolderParams.safeParse(req.params);
  const body = AddTicketDriveFolderBody.safeParse(req.body);
  if (!params.success || !body.success ||
      !/^[A-Za-z0-9_-]{1,256}$/.test(body.data.folderId)) {
    sendError(res, 400, "INVALID_REQUEST", "Select a valid Google Drive folder.");
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    return;
  }
  const accessToken = getTemporaryToken(req);
  if (!accessToken) {
    sendError(res, 401, "DRIVE_AUTH_REQUIRED", "Connect Google Drive to add a folder.");
    return;
  }
  try {
    const driveFolder = await getDriveFile(accessToken, body.data.folderId);
    if (driveFolder.mimeType !== DRIVE_FOLDER_MIME) {
      sendError(res, 400, "NOT_A_FOLDER", "Only Google Drive folders can be linked.");
      return;
    }
    const [existing] = await db
      .select({
        id: ticketDriveFoldersTable.id,
        driveFolderId: ticketDriveFoldersTable.driveFolderId,
        folderName: ticketDriveFoldersTable.folderName,
        createdAt: ticketDriveFoldersTable.createdAt,
      })
      .from(ticketDriveFoldersTable)
      .where(and(
        eq(ticketDriveFoldersTable.ticketId, ticket.id),
        eq(ticketDriveFoldersTable.organizationId, ticket.organizationId!),
        eq(ticketDriveFoldersTable.driveFolderId, driveFolder.id),
      ));
    if (existing) {
      res.json(existing);
      return;
    }
    const user = (req as any).currentUser as { id: number };
    const [folder] = await db.insert(ticketDriveFoldersTable).values({
      ticketId: ticket.id,
      organizationId: ticket.organizationId!,
      driveFolderId: driveFolder.id,
      folderName: driveFolder.name,
      addedBy: user.id,
    }).returning({
      id: ticketDriveFoldersTable.id,
      driveFolderId: ticketDriveFoldersTable.driveFolderId,
      folderName: ticketDriveFoldersTable.folderName,
      createdAt: ticketDriveFoldersTable.createdAt,
    });
    res.status(201).json(folder);
  } catch (error) {
    handleDriveFailure(req, res, error);
  }
});

router.delete("/tickets/:id/drive-folders/:referenceId", requireAuth, async (req, res): Promise<void> => {
  const params = ListTicketDriveFolderItemsParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid ticket or folder reference.");
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    return;
  }
  const [removed] = await db
    .delete(ticketDriveFoldersTable)
    .where(and(
      eq(ticketDriveFoldersTable.id, params.data.referenceId),
      eq(ticketDriveFoldersTable.ticketId, ticket.id),
      eq(ticketDriveFoldersTable.organizationId, ticket.organizationId!),
    ))
    .returning({ id: ticketDriveFoldersTable.id });
  if (!removed) {
    sendError(res, 404, "DRIVE_FOLDER_REFERENCE_NOT_FOUND", "Folder reference not found.");
    return;
  }
  res.json({ success: true });
});

router.get("/tickets/:id/drive-folders/:referenceId/items", requireAuth, async (req, res): Promise<void> => {
  const params = ListTicketDriveFolderItemsParams.safeParse(req.params);
  const query = ListTicketDriveFolderItemsQueryParams.safeParse(req.query);
  if (!params.success || !query.success ||
      !/^[A-Za-z0-9_-]{1,256}$/.test(query.data.folderId)) {
    sendError(res, 400, "INVALID_REQUEST", "Invalid folder location.");
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
    return;
  }
  const [reference] = await db
    .select({
      id: ticketDriveFoldersTable.id,
      driveFolderId: ticketDriveFoldersTable.driveFolderId,
      folderName: ticketDriveFoldersTable.folderName,
    })
    .from(ticketDriveFoldersTable)
    .where(and(
      eq(ticketDriveFoldersTable.id, params.data.referenceId),
      eq(ticketDriveFoldersTable.ticketId, ticket.id),
      eq(ticketDriveFoldersTable.organizationId, ticket.organizationId!),
    ));
  if (!reference) {
    sendError(res, 404, "DRIVE_FOLDER_REFERENCE_NOT_FOUND", "Folder reference not found.");
    return;
  }
  const accessToken = getTemporaryToken(req);
  if (!accessToken) {
    sendError(res, 401, "DRIVE_AUTH_REQUIRED", "Reconnect Google Drive to browse this folder.");
    return;
  }
  try {
    const currentFolder = await getDriveFile(accessToken, query.data.folderId);
    if (currentFolder.mimeType !== DRIVE_FOLDER_MIME) {
      sendError(res, 400, "NOT_A_FOLDER", "The selected location is not a folder.");
      return;
    }
    const isAllowed = await isWithinLinkedFolder(
      accessToken,
      currentFolder.id,
      reference.driveFolderId,
    );
    if (!isAllowed) {
      sendError(res, 403, "DRIVE_FOLDER_OUTSIDE_LINK", "This folder is outside the folder linked to this ticket.");
      return;
    }
    const files = await listDriveChildren(accessToken, currentFolder.id, false);
    res.json({
      currentFolder: {
        driveFolderId: currentFolder.id,
        folderName: currentFolder.name,
      },
      items: files
        .map((file) => ({
          driveItemId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          isFolder: file.mimeType === DRIVE_FOLDER_MIME,
          webViewLink: file.webViewLink ?? null,
        }))
        .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name)),
    });
  } catch (error) {
    handleDriveFailure(req, res, error);
  }
});

export default router;
