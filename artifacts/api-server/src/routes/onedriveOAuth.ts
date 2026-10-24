import express, { Router } from "express";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, oneDriveConnectionsTable, usersTable } from "@workspace/db";
import { getCurrentUserId, getSessionId } from "../lib/session";
import { appBaseUrlForRequest } from "../lib/appUrl";
import { logger } from "../lib/logger";
import {
  ListSharedOneDriveFolderItemsParams,
  ListSharedOneDriveFolderItemsQueryParams,
  ListSharedOneDriveFolderItemsResponse,
  PreviewSharedOneDriveItemParams,
  PreviewSharedOneDriveItemQueryParams,
  PreviewSharedOneDriveItemResponse,
  DownloadSharedOneDriveItemParams,
  DownloadSharedOneDriveItemQueryParams,
  UploadSharedOneDriveFileHeader,
  UploadSharedOneDriveFileParams,
  UploadSharedOneDriveFileQueryParams,
  UploadSharedOneDriveFileResponse,
} from "@workspace/api-zod";
import {
  createDefaultFolders,
  canConnectMicrosoftTenant,
  encryptRefreshToken,
  exchangeMicrosoftCode,
  getMicrosoftUser,
  inviteCollaboratorsToTaskdeskFolders,
  listSharedOneDriveFolderItems,
  OneDriveBrowseError,
  OneDriveGraphError,
  previewSharedOneDriveItem,
  downloadSharedOneDriveItem,
  syncPendingOneDriveAttachments,
  uploadSharedOneDriveFile,
} from "../lib/onedriveGraph";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const STATE_COOKIE = "taskdesk_onedrive_state";
const STATE_TTL = 10 * 60_000;
type Pending = { userId: number; sessionId: string; verifier: string; returnTo: string; createdAt: number };
const pending = new Map<string, Pending>();

function getCallbackUri(req: import("express").Request): string {
  return `${appBaseUrlForRequest(req.headers.origin, req.headers.host)}/api/onedrive/callback`;
}

function stateCookie(state: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STATE_COOKIE}=${state}; Path=/api/onedrive; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

function clearStateCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STATE_COOKIE}=; Path=/api/onedrive; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function cookieValue(req: import("express").Request, name: string): string | undefined {
  const raw = req.headers.cookie ?? "";
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function finish(res: import("express").Response, result: string, returnTo = "/app/"): void {
  res.setHeader("Set-Cookie", clearStateCookie());
  const targetUrl = new URL(returnTo, "https://taskdesk.invalid");
  targetUrl.searchParams.set("onedrive", result);
  const target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  res.status(200).send(`<!doctype html><meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)})</script>`);
}

router.get("/onedrive/connect", requireAuth, (req, res): void => {
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(400).json({ error: "An organization account is required." });
    return;
  }
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Microsoft OneDrive OAuth is not configured." });
    return;
  }
  for (const [key, value] of pending) if (Date.now() - value.createdAt > STATE_TTL) pending.delete(key);
  const sessionId = getSessionId(req);
  if (!sessionId) {
    res.status(401).json({ error: "Sign in to TaskDesk before connecting OneDrive." });
    return;
  }
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const rawReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  const returnTo = rawReturnTo.startsWith("/app/") && !rawReturnTo.startsWith("//") && !rawReturnTo.includes("\\")
    ? rawReturnTo
    : "/app/";
  pending.set(state, { userId: user.id, sessionId, verifier, returnTo, createdAt: Date.now() });
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    response_mode: "query",
    redirect_uri: getCallbackUri(req),
    scope: "openid profile email offline_access User.Read Files.ReadWrite",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  const target = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  res.setHeader("Set-Cookie", stateCookie(state));
  res.status(200).send(`<!doctype html><meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)})</script>`);
});

router.get("/onedrive/callback", async (req, res): Promise<void> => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const current = state ? pending.get(state) : undefined;
  if (!current || cookieValue(req, STATE_COOKIE) !== state || Date.now() - current.createdAt > STATE_TTL) {
    if (state) pending.delete(state);
    finish(res, "invalid_state", current?.returnTo);
    return;
  }
  pending.delete(state);
  const sessionId = getSessionId(req);
  const currentUserId = await getCurrentUserId(req);
  if (!sessionId || sessionId !== current.sessionId || currentUserId !== current.userId) {
    finish(res, "invalid_session", current.returnTo);
    return;
  }
  if (req.query.error || typeof req.query.code !== "string") {
    finish(res, "cancelled", current.returnTo);
    return;
  }
  try {
    const tokens = await exchangeMicrosoftCode(req.query.code, getCallbackUri(req), current.verifier);
    const [user] = await db.select({
      id: usersTable.id, name: usersTable.name, role: usersTable.role, organizationId: usersTable.organizationId,
    }).from(usersTable).where(eq(usersTable.id, current.userId)).limit(1);
    if (!user?.organizationId) throw new Error("TaskDesk account has no organization.");

    // Business accounts must share one directory. Personal Microsoft accounts
    // use Microsoft's shared consumer tenant ID and are invited individually.
    const tenantConnections = await db.select({ tenantId: oneDriveConnectionsTable.tenantId })
      .from(oneDriveConnectionsTable)
      .where(eq(oneDriveConnectionsTable.organizationId, user.organizationId))
    if (!tenantConnections.every(({ tenantId }) => canConnectMicrosoftTenant(tenantId, tokens.tenantId))) {
      throw new Error("This Microsoft account belongs to a different organization tenant.");
    }
    const microsoftUser = await getMicrosoftUser(tokens.accessToken);
    const folders = await createDefaultFolders(tokens.accessToken, user.name || microsoftUser.displayName);
    const shareUrl = folders.shareUrl;
    await db.insert(oneDriveConnectionsTable).values({
      userId: user.id,
      organizationId: user.organizationId,
      tenantId: tokens.tenantId,
      microsoftEmail: microsoftUser.mail || microsoftUser.userPrincipalName || tokens.email,
      encryptedRefreshToken: encryptRefreshToken(tokens.refreshToken, user.id, user.organizationId),
      rootFolderId: folders.rootFolderId,
      operatorFolderId: folders.operatorFolderId,
      organizationShareUrl: shareUrl,
    }).onConflictDoUpdate({
      target: oneDriveConnectionsTable.userId,
      set: {
        organizationId: user.organizationId,
        tenantId: tokens.tenantId,
        microsoftEmail: microsoftUser.mail || microsoftUser.userPrincipalName || tokens.email,
        encryptedRefreshToken: encryptRefreshToken(tokens.refreshToken, user.id, user.organizationId),
        rootFolderId: folders.rootFolderId,
        operatorFolderId: folders.operatorFolderId,
        organizationShareUrl: shareUrl,
        updatedAt: new Date(),
      },
    });
    const inviteFailures = await inviteCollaboratorsToTaskdeskFolders(user.organizationId);
    void syncPendingOneDriveAttachments(user.id, user.organizationId, user.role === "admin").catch((error) => {
      logger.warn({ err: error, userId: user.id }, "Could not retry pending OneDrive attachments");
    });
    finish(res, inviteFailures ? "sharing_partial" : "connected", current.returnTo);
  } catch (error) {
    logger.warn({ err: error, userId: current.userId }, "OneDrive connection failed");
    finish(res, "connect_error", current.returnTo);
  }
});

router.get("/onedrive/connection", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.json({ connected: false });
    return;
  }
  const [connection] = await db.select({
    microsoftEmail: oneDriveConnectionsTable.microsoftEmail,
    organizationShareUrl: oneDriveConnectionsTable.organizationShareUrl,
  }).from(oneDriveConnectionsTable).where(and(
    eq(oneDriveConnectionsTable.userId, user.id),
    eq(oneDriveConnectionsTable.organizationId, user.organizationId),
  )).limit(1);
  res.json({ connected: Boolean(connection), ...connection });
});

router.get("/onedrive/organization-shares", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.json([]);
    return;
  }
  const shares = await db.select({
    ownerUserId: oneDriveConnectionsTable.userId,
    operatorName: usersTable.name,
    url: oneDriveConnectionsTable.organizationShareUrl,
  }).from(oneDriveConnectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, oneDriveConnectionsTable.userId))
    .where(and(eq(oneDriveConnectionsTable.organizationId, user.organizationId), eq(usersTable.isActive, true)));
  res.json(shares
    .filter((item) => item.url?.startsWith("https://"))
    .map((item) => ({ ...item, canUpload: item.ownerUserId === user.id })));
});

router.get("/onedrive/folders/:ownerUserId/items", requireAuth, async (req, res): Promise<void> => {
  const params = ListSharedOneDriveFolderItemsParams.safeParse(req.params);
  const rawPath = req.query.path;
  const query = ListSharedOneDriveFolderItemsQueryParams.safeParse({
    // Express returns a single repeated query parameter as a string, but returns
    // an array when there are multiple path segments.
    path: typeof rawPath === "string" ? [rawPath] : rawPath,
  });
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid OneDrive folder path." });
    return;
  }
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(403).json({ error: "An organization account is required." });
    return;
  }
  try {
    const result = await listSharedOneDriveFolderItems(
      user.id,
      user.organizationId,
      params.data.ownerUserId,
      query.data.path,
    );
    res.json(ListSharedOneDriveFolderItemsResponse.parse(result));
  } catch (error) {
    if (error instanceof OneDriveBrowseError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof OneDriveGraphError) {
      req.log.warn({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive shared folder listing failed");
      const status = [401, 403, 404].includes(error.statusCode) ? error.statusCode : 502;
      res.status(status).json({
        error: status === 403
          ? "Your Microsoft account does not have access to this shared folder."
          : status === 404
            ? "The shared OneDrive folder could not be found."
            : status === 401
              ? "Reconnect your OneDrive account to continue."
              : "Microsoft could not load this folder. Please try again.",
      });
      return;
    }
    req.log.error({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive shared folder listing failed");
    res.status(502).json({ error: "Microsoft could not load this folder. Please try again." });
  }
});

router.post(
  "/onedrive/folders/:ownerUserId/items/upload",
  requireAuth,
  express.raw({ type: "*/*", limit: "25mb" }),
  async (req, res): Promise<void> => {
    const params = UploadSharedOneDriveFileParams.safeParse(req.params);
    const rawPath = req.query.path;
    const query = UploadSharedOneDriveFileQueryParams.safeParse({
      path: typeof rawPath === "string" ? [rawPath] : rawPath,
    });
    const headers = UploadSharedOneDriveFileHeader.safeParse({
      "X-File-Name": req.get("X-File-Name"),
      "X-File-Content-Type": req.get("X-File-Content-Type"),
    });
    if (!params.success || !query.success || !headers.success || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "Invalid OneDrive upload." });
      return;
    }
    if (req.body.length > 25 * 1024 * 1024) {
      res.status(413).json({ error: "The file exceeds the 25 MB upload limit." });
      return;
    }
    let fileName: string;
    try {
      fileName = decodeURIComponent(headers.data["X-File-Name"]);
    } catch {
      res.status(400).json({ error: "Invalid OneDrive file name." });
      return;
    }
    const user = (req as any).currentUser as { id: number; organizationId: number | null };
    if (!user.organizationId) {
      res.status(403).json({ error: "An organization account is required." });
      return;
    }
    try {
      const contentType = headers.data["X-File-Content-Type"];
      const result = await uploadSharedOneDriveFile(
        user.id,
        user.organizationId,
        params.data.ownerUserId,
        query.data.path ?? [],
        fileName,
        contentType && /^[\w.+-]+\/[\w.+-]+$/.test(contentType) ? contentType : "application/octet-stream",
        req.body,
      );
      res.status(201).json(UploadSharedOneDriveFileResponse.parse(result));
    } catch (error) {
      if (error instanceof OneDriveBrowseError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (error instanceof OneDriveGraphError) {
        req.log.warn({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file upload failed");
        const status = [401, 403, 404].includes(error.statusCode) ? error.statusCode : 502;
        res.status(status).json({ error: status === 401
          ? "Reconnect your OneDrive account to continue."
          : status === 403
            ? "Microsoft does not allow uploads to this folder."
            : status === 404
              ? "The destination folder could not be found."
              : "Microsoft could not upload this file." });
        return;
      }
      req.log.error({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file upload failed");
      res.status(502).json({ error: "Microsoft could not upload this file." });
    }
  },
);

router.post("/onedrive/folders/:ownerUserId/items/:itemId/preview", requireAuth, async (req, res): Promise<void> => {
  const params = PreviewSharedOneDriveItemParams.safeParse(req.params);
  const rawPath = req.query.path;
  const query = PreviewSharedOneDriveItemQueryParams.safeParse({
    path: typeof rawPath === "string" ? [rawPath] : rawPath,
  });
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid OneDrive file path." });
    return;
  }
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(403).json({ error: "An organization account is required." });
    return;
  }
  try {
    const result = await previewSharedOneDriveItem(
      user.id,
      user.organizationId,
      params.data.ownerUserId,
      params.data.itemId,
      query.data.path,
    );
    res.json(PreviewSharedOneDriveItemResponse.parse(result));
  } catch (error) {
    if (error instanceof OneDriveBrowseError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof OneDriveGraphError) {
      req.log.warn({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file preview failed");
      const status = [401, 403, 404].includes(error.statusCode) ? error.statusCode : 502;
      res.status(status).json({
        error: status === 403
          ? "Your Microsoft account cannot preview this file."
          : status === 404
            ? "The file could not be found."
            : status === 401
              ? "Reconnect your OneDrive account to continue."
              : "Microsoft could not preview this file.",
      });
      return;
    }
    req.log.error({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file preview failed");
    res.status(502).json({ error: "Microsoft could not preview this file." });
  }
});

router.get("/onedrive/folders/:ownerUserId/items/:itemId/content", requireAuth, async (req, res): Promise<void> => {
  const params = DownloadSharedOneDriveItemParams.safeParse(req.params);
  const rawPath = req.query.path;
  const query = DownloadSharedOneDriveItemQueryParams.safeParse({
    path: typeof rawPath === "string" ? [rawPath] : rawPath,
  });
  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid OneDrive file path." });
    return;
  }
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(403).json({ error: "An organization account is required." });
    return;
  }
  try {
    const result = await downloadSharedOneDriveItem(
      user.id,
      user.organizationId,
      params.data.ownerUserId,
      params.data.itemId,
      query.data.path,
    );
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
    res.setHeader("X-File-Name", encodeURIComponent(result.fileName));
    res.setHeader("X-File-Content-Type", result.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(result.bytes);
  } catch (error) {
    if (error instanceof OneDriveBrowseError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof OneDriveGraphError) {
      req.log.warn({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file download failed");
      res.status(error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404 ? error.statusCode : 502)
        .json({ error: "Microsoft could not download this file." });
      return;
    }
    req.log.error({ err: error, userId: user.id, ownerUserId: params.data.ownerUserId }, "OneDrive file download failed");
    res.status(502).json({ error: "Microsoft could not download this file." });
  }
});

router.delete("/onedrive/connection", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(400).json({ error: "An organization account is required." });
    return;
  }
  await db.delete(oneDriveConnectionsTable).where(and(
    eq(oneDriveConnectionsTable.userId, user.id),
    eq(oneDriveConnectionsTable.organizationId, user.organizationId),
  ));
  res.json({ connected: false });
});

export default router;
