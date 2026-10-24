import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import {
  db,
  oneDriveConnectionsTable,
  ticketAttachmentOneDriveCopiesTable,
  ticketAttachmentsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";
import { appBaseUrl } from "./appUrl";
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_TICKET_ATTACHMENT_SIZE_BYTES } from "./allowedMimeTypes";

const GRAPH = "https://graph.microsoft.com/v1.0";
const storage = new ObjectStorageService();
export const CONSUMER_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66e";

export function canConnectMicrosoftTenant(existingTenantId: string | null, incomingTenantId: string): boolean {
  return existingTenantId == null ||
    existingTenantId === incomingTenantId ||
    existingTenantId === CONSUMER_TENANT_ID ||
    incomingTenantId === CONSUMER_TENANT_ID;
}

export function getOneDriveAttachmentCopyName(ticketId: number, attachmentId: number, fileName: string): string {
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
  return `ticket-${ticketId}-attachment-${attachmentId}-${safeName}`;
}

export function isExpectedOneDriveAttachmentCopy(
  item: { id?: string; name?: string; file?: object },
  itemId: string,
  ticketId: number,
  attachmentId: number,
  fileName: string,
): boolean {
  return item.id === itemId &&
    item.name === getOneDriveAttachmentCopyName(ticketId, attachmentId, fileName) &&
    !!item.file;
}

export function isOneDriveCopyAccountMatch(
  copy: { ownerEmail: string; ownerTenantId: string },
  connection: { microsoftEmail: string; tenantId: string },
): boolean {
  return connection.microsoftEmail.toLocaleLowerCase() === copy.ownerEmail.toLocaleLowerCase() &&
    connection.tenantId === copy.ownerTenantId;
}

export function isUploadedOneDriveCopyCurrent(input: {
  currentAssigneeId: number | null;
  uploaderId: number;
  currentAccount: { microsoftEmail: string; tenantId: string } | null;
  uploadAccount: { microsoftEmail: string; tenantId: string };
  currentItemId: string | null;
  uploadedItemId: string;
}): boolean {
  return input.currentAssigneeId === input.uploaderId &&
    input.currentAccount != null &&
    isOneDriveCopyAccountMatch(
      { ownerEmail: input.uploadAccount.microsoftEmail, ownerTenantId: input.uploadAccount.tenantId },
      input.currentAccount,
    ) &&
    (input.currentItemId == null || input.currentItemId === input.uploadedItemId);
}

export class OneDriveCopyRemovalError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "OneDriveCopyRemovalError";
  }
}

export function validateOneDriveAttachmentMetadata(mimeType: string | null | undefined, size: number | null | undefined): string {
  const normalizedMimeType = (mimeType || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(normalizedMimeType)) {
    throw new OneDriveBrowseError(
      "This file type is not supported as a ticket attachment. Choose a supported image, document, text file, or archive.",
      415,
    );
  }
  if (size != null && size > MAX_TICKET_ATTACHMENT_SIZE_BYTES) {
    throw new OneDriveBrowseError("The file exceeds the 20 MB ticket attachment limit.", 413);
  }
  return normalizedMimeType;
}

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for OneDrive token encryption.");
  return createHash("sha256").update(`taskdesk-onedrive:${secret}`).digest();
}

export function encryptRefreshToken(token: string, userId: number, organizationId: number): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${organizationId}:${userId}`));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptRefreshToken(value: string, userId: number, organizationId: number): string {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Stored OneDrive authorization is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAAD(Buffer.from(`${organizationId}:${userId}`));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function graph<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("https://") ? path : `${GRAPH}${path}`;
  if (new URL(url).origin !== new URL(GRAPH).origin) throw new Error("Unexpected Microsoft Graph URL.");
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok || response.status === 207) {
    throw new OneDriveGraphError(
      payload.error?.message || `Microsoft Graph request failed (${response.status}).`,
      response.status,
    );
  }
  return payload as T;
}

export class OneDriveGraphError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "OneDriveGraphError";
  }
}

export async function exchangeMicrosoftCode(code: string, redirectUri: string, codeVerifier: string) {
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("Microsoft OneDrive OAuth is not configured.");
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Microsoft marks this app registration as an SPA, so token redemption
      // must carry the origin of its registered redirect URI.
      Origin: new URL(redirectUri).origin,
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
      scope: "offline_access User.Read Files.ReadWrite",
    }),
  });
  const result = await response.json() as {
    access_token?: string; refresh_token?: string; id_token?: string;
    error_description?: string;
  };
  if (!response.ok || !result.access_token || !result.refresh_token || !result.id_token) {
    throw new Error(result.error_description || "Microsoft did not return a renewable authorization.");
  }
  const claims = JSON.parse(Buffer.from(result.id_token.split(".")[1], "base64url").toString("utf8")) as {
    tid?: string; preferred_username?: string; email?: string;
  };
  if (!claims.tid || !claims.preferred_username && !claims.email) {
    throw new Error("Microsoft account identity is incomplete.");
  }
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    tenantId: claims.tid,
    email: claims.preferred_username ?? claims.email!,
  };
}

export async function createDefaultFolders(accessToken: string, operatorName: string) {
  const rootChildren = await graph<{ value: { id: string; name: string; folder?: object; webUrl?: string }[] }>(
    accessToken,
    "/me/drive/root/children?$select=id,name,folder,webUrl&$top=200",
  );
  let root: { id: string; name: string; folder?: object; webUrl?: string } | undefined =
    rootChildren.value?.find((item) => item.folder && item.name.toLocaleLowerCase() === "taskdesk");
  if (!root) {
    root = await graph<{ id: string; name: string; folder?: object; webUrl?: string }>(accessToken, "/me/drive/root/children", {
      method: "POST",
      body: JSON.stringify({ name: "Taskdesk", folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
    });
  }
  if (!root?.id) throw new Error("Could not create the Taskdesk OneDrive folder.");
  const children = await graph<{ value: { id: string; name: string; folder?: object }[] }>(
    accessToken,
    `/me/drive/items/${encodeURIComponent(root.id)}/children?$select=id,name,folder&$top=200`,
  );
  let operator: { id: string; name: string; folder?: object } | undefined =
    children.value?.find((item) => item.folder && item.name === operatorName);
  if (!operator) {
    operator = await graph<{ id: string; name: string; folder?: object }>(accessToken, `/me/drive/items/${encodeURIComponent(root.id)}/children`, {
      method: "POST",
      body: JSON.stringify({ name: operatorName, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
    });
  }
  if (!operator?.id) throw new Error("Could not create the operator OneDrive folder.");
  const rootDetails = await graph<{ webUrl?: string }>(
    accessToken,
    `/me/drive/items/${encodeURIComponent(root.id)}?$select=webUrl`,
  );
  if (!rootDetails.webUrl) throw new Error("Microsoft did not return a Taskdesk folder URL.");
  return { rootFolderId: root.id, operatorFolderId: operator.id, shareUrl: rootDetails.webUrl };
}

export async function getMicrosoftUser(accessToken: string) {
  return graph<{ id: string; displayName: string; mail: string | null; userPrincipalName: string }>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
  );
}

async function refreshConnection(connection: typeof oneDriveConnectionsTable.$inferSelect) {
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("Microsoft OneDrive OAuth is not configured.");
  const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: appBaseUrl(),
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: decryptRefreshToken(connection.encryptedRefreshToken, connection.userId, connection.organizationId),
      scope: "offline_access User.Read Files.ReadWrite",
    }),
  });
  const result = await response.json() as { access_token?: string; refresh_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "OneDrive authorization expired.");
  if (result.refresh_token) {
    await db.update(oneDriveConnectionsTable)
      .set({ encryptedRefreshToken: encryptRefreshToken(result.refresh_token, connection.userId, connection.organizationId) })
      .where(eq(oneDriveConnectionsTable.id, connection.id));
  }
  return result.access_token;
}

export class OneDriveBrowseError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "OneDriveBrowseError";
  }
}

type BrowseDriveItem = {
  id: string;
  name: string;
  folder?: object;
  file?: { mimeType?: string };
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  parentReference?: { driveId?: string };
  remoteItem?: { parentReference?: { driveId?: string } };
};

type BrowseContext = {
  accessToken: string;
  rootItem: BrowseDriveItem;
  driveId: string;
};

function encodeSharingUrl(url: string): string {
  const encoded = Buffer.from(url, "utf8").toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `u!${encoded}`;
}

async function getSharedFolderContext(
  currentUserId: number,
  organizationId: number,
  ownerUserId: number,
): Promise<BrowseContext> {
  const [currentConnection] = await db.select().from(oneDriveConnectionsTable).where(and(
    eq(oneDriveConnectionsTable.userId, currentUserId),
    eq(oneDriveConnectionsTable.organizationId, organizationId),
  )).limit(1);
  if (!currentConnection) {
    throw new OneDriveBrowseError("Connect your OneDrive account to browse shared folders.", 401);
  }

  const [owner] = await db.select({
    connection: oneDriveConnectionsTable,
  }).from(oneDriveConnectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, oneDriveConnectionsTable.userId))
    .where(and(
      eq(oneDriveConnectionsTable.userId, ownerUserId),
      eq(oneDriveConnectionsTable.organizationId, organizationId),
      eq(usersTable.isActive, true),
    )).limit(1);
  if (!owner?.connection.organizationShareUrl?.startsWith("https://")) {
    throw new OneDriveBrowseError("Shared OneDrive folder not found.", 404);
  }

  const accessToken = await refreshConnection(currentConnection);
  let rootItem: BrowseDriveItem;
  if (currentUserId === ownerUserId) {
    // The current user's own folder is already identified by its drive item ID.
    // Resolving its webUrl through /shares can fail for personal OneDrive items.
    rootItem = await graph<BrowseDriveItem>(
      accessToken,
      `/me/drive/items/${encodeURIComponent(currentConnection.rootFolderId)}?$select=id,name,folder,parentReference`,
    );
  } else {
    const shared = await graph<BrowseDriveItem & {
      remoteItem?: {
        id?: string;
        name?: string;
        folder?: object;
        parentReference?: { driveId?: string };
      };
    }>(
      accessToken,
      `/shares/${encodeURIComponent(encodeSharingUrl(owner.connection.organizationShareUrl))}/driveItem?$select=id,name,folder,parentReference,remoteItem`,
    );
    rootItem = shared.remoteItem
      ? {
          ...shared,
          id: shared.remoteItem.id ?? shared.id,
          name: shared.remoteItem.name ?? shared.name,
          folder: shared.remoteItem.folder ?? shared.folder,
          parentReference: shared.remoteItem.parentReference ?? shared.parentReference,
        }
      : shared;
  }
  const driveId = rootItem.parentReference?.driveId;
  if (!rootItem.id || !rootItem.folder || !driveId) {
    throw new OneDriveBrowseError("Microsoft did not return a browsable shared folder.", 502);
  }
  return { accessToken, rootItem, driveId };
}

async function listDriveChildren(
  accessToken: string,
  driveId: string,
  parentId: string,
): Promise<BrowseDriveItem[]> {
  const items: BrowseDriveItem[] = [];
  let next: string | null =
    `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children?$select=id,name,folder,file,size,lastModifiedDateTime,webUrl,parentReference&$top=200`;
  while (next) {
    const page: { value?: BrowseDriveItem[]; "@odata.nextLink"?: string } =
      await graph(accessToken, next);
    items.push(...(page.value ?? []));
    next = page["@odata.nextLink"] ?? null;
  }
  return items;
}

async function resolveSharedFolder(
  context: BrowseContext,
  path: string[],
): Promise<BrowseDriveItem> {
  let folder = context.rootItem;
  for (const id of path) {
    if (!folder.folder) throw new OneDriveBrowseError("The selected path is not a folder.", 404);
    const child = (await listDriveChildren(context.accessToken, context.driveId, folder.id))
      .find((item) => item.id === id && !!item.folder);
    if (!child) throw new OneDriveBrowseError("The selected folder is outside this shared directory.", 404);
    folder = child;
  }
  return folder;
}

function toBrowseItem(item: BrowseDriveItem) {
  return {
    id: item.id,
    name: item.name,
    kind: item.folder ? "folder" as const : "file" as const,
    size: typeof item.size === "number" ? item.size : null,
    lastModifiedDateTime: item.lastModifiedDateTime ?? null,
    mimeType: item.file?.mimeType ?? null,
    webUrl: item.webUrl ?? null,
  };
}

export async function listSharedOneDriveFolderItems(
  currentUserId: number,
  organizationId: number,
  ownerUserId: number,
  path: string[] = [],
) {
  const context = await getSharedFolderContext(currentUserId, organizationId, ownerUserId);
  const folder = await resolveSharedFolder(context, path);
  const children = await listDriveChildren(context.accessToken, context.driveId, folder.id);
  children.sort((a, b) =>
    Number(!!b.folder) - Number(!!a.folder) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return { folderName: folder.name, items: children.map(toBrowseItem) };
}

export async function uploadSharedOneDriveFile(
  currentUserId: number,
  organizationId: number,
  ownerUserId: number,
  path: string[],
  fileName: string,
  contentType: string,
  bytes: Buffer,
) {
  if (ownerUserId !== currentUserId) {
    throw new OneDriveBrowseError("You can upload only to your own OneDrive folder.", 403);
  }
  const safeName = fileName.trim();
  if (
    !safeName ||
    safeName.length > 255 ||
    safeName === "." ||
    safeName === ".." ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(safeName)
  ) {
    throw new OneDriveBrowseError("The file name is not valid for OneDrive.", 400);
  }
  const context = await getSharedFolderContext(currentUserId, organizationId, ownerUserId);
  const folder = await resolveSharedFolder(context, path);
  const uploaded = await graph<BrowseDriveItem>(
    context.accessToken,
    `/drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(folder.id)}:/${encodeURIComponent(safeName)}:/content?@microsoft.graph.conflictBehavior=rename`,
    {
      method: "PUT",
      headers: { "Content-Type": contentType || "application/octet-stream" },
      body: bytes,
    },
  );
  return toBrowseItem(uploaded);
}

export async function previewSharedOneDriveItem(
  currentUserId: number,
  organizationId: number,
  ownerUserId: number,
  itemId: string,
  path: string[] = [],
) {
  const context = await getSharedFolderContext(currentUserId, organizationId, ownerUserId);
  const folder = await resolveSharedFolder(context, path);
  const item = (await listDriveChildren(context.accessToken, context.driveId, folder.id))
    .find((child) => child.id === itemId && !!child.file);
  if (!item) throw new OneDriveBrowseError("The selected file is outside this shared directory.", 404);
  return graph<{ getUrl: string; postUrl?: string; postParameters?: string }>(
    context.accessToken,
    `/drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(item.id)}/preview`,
    { method: "POST", body: JSON.stringify({ viewer: "office" }) },
  );
}

export async function downloadSharedOneDriveItem(
  currentUserId: number,
  organizationId: number,
  ownerUserId: number,
  itemId: string,
  path: string[] = [],
) {
  const context = await getSharedFolderContext(currentUserId, organizationId, ownerUserId);
  const folder = await resolveSharedFolder(context, path);
  const item = (await listDriveChildren(context.accessToken, context.driveId, folder.id))
    .find((child) => child.id === itemId && !!child.file);
  if (!item) throw new OneDriveBrowseError("The selected file is outside this shared directory.", 404);
  const mimeType = validateOneDriveAttachmentMetadata(item.file?.mimeType, item.size);

  const response = await fetch(
    `${GRAPH}/drives/${encodeURIComponent(context.driveId)}/items/${encodeURIComponent(item.id)}/content`,
    { headers: { Authorization: `Bearer ${context.accessToken}` } },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new OneDriveGraphError(
      payload.error?.message || `Microsoft Graph download failed (${response.status}).`,
      response.status,
    );
  }
  const reportedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(reportedLength) && reportedLength > MAX_TICKET_ATTACHMENT_SIZE_BYTES) {
    throw new OneDriveBrowseError("The file exceeds the 20 MB ticket attachment limit.", 413);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_TICKET_ATTACHMENT_SIZE_BYTES) {
    throw new OneDriveBrowseError("The file exceeds the 20 MB ticket attachment limit.", 413);
  }
  validateOneDriveAttachmentMetadata(mimeType, bytes.length);
  return {
    fileName: item.name,
    mimeType,
    bytes,
  };
}

/**
 * Grant each connected collaborator read access to every connected owner's
 * Taskdesk folder. Invitation permissions are protected by Microsoft sign-in,
 * unlike anonymous sharing links, and also work for consumer OneDrive accounts.
 */
export async function inviteCollaboratorsToTaskdeskFolders(organizationId: number): Promise<number> {
  const connections = await db.select({
    connection: oneDriveConnectionsTable,
  }).from(oneDriveConnectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, oneDriveConnectionsTable.userId))
    .where(and(
      eq(oneDriveConnectionsTable.organizationId, organizationId),
      eq(usersTable.isActive, true),
    ));
  let failures = 0;
  for (const owner of connections) {
    let accessToken: string;
    try {
      accessToken = await refreshConnection(owner.connection);
    } catch (error) {
      failures += Math.max(0, connections.length - 1);
      logger.warn({ err: error, userId: owner.connection.userId }, "Could not refresh OneDrive token for folder invitations");
      continue;
    }
    for (const recipient of connections) {
      if (
        recipient.connection.userId === owner.connection.userId ||
        recipient.connection.microsoftEmail.toLowerCase() === owner.connection.microsoftEmail.toLowerCase()
      ) continue;
      try {
        await graph(accessToken, `/me/drive/items/${encodeURIComponent(owner.connection.rootFolderId)}/invite`, {
          method: "POST",
          body: JSON.stringify({
            recipients: [{ email: recipient.connection.microsoftEmail }],
            requireSignIn: true,
            sendInvitation: false,
            roles: ["read"],
          }),
        });
      } catch (error) {
        failures += 1;
        logger.warn({
          err: error,
          ownerUserId: owner.connection.userId,
          recipientUserId: recipient.connection.userId,
        }, "Could not share OneDrive Taskdesk folder with collaborator");
      }
    }
  }
  return failures;
}

export type DrivePermission = {
  id?: string;
  roles?: string[];
  invitation?: { email?: string };
  grantedToV2?: { user?: { email?: string } };
  grantedTo?: { user?: { email?: string } };
  link?: object;
};

export function shouldRevokeOneDrivePermission(
  permission: DrivePermission,
  targetEmails: ReadonlySet<string>,
  ownerEmail: string,
): boolean {
  const email = (
    permission.invitation?.email ??
    permission.grantedToV2?.user?.email ??
    permission.grantedTo?.user?.email ??
    ""
  ).toLocaleLowerCase();
  return Boolean(
    permission.id &&
    !permission.link &&
    permission.roles?.includes("read") &&
    email !== ownerEmail.toLocaleLowerCase() &&
    targetEmails.has(email)
  );
}

async function revokeFolderInvitations(
  accessToken: string,
  owner: typeof oneDriveConnectionsTable.$inferSelect,
  recipientEmails: string[],
): Promise<void> {
  const targets = new Set(
    recipientEmails
      .map((email) => email.trim().toLocaleLowerCase())
      .filter((email) => email && email !== owner.microsoftEmail.toLocaleLowerCase()),
  );
  if (targets.size === 0) return;

  let next: string | null =
    `${GRAPH}/me/drive/items/${encodeURIComponent(owner.rootFolderId)}/permissions?$select=id,roles,invitation,grantedToV2,grantedTo,link&$top=200`;
  while (next) {
    const page: { value?: DrivePermission[]; "@odata.nextLink"?: string } = await graph(accessToken, next);
    for (const permission of page.value ?? []) {
      if (permission.id && shouldRevokeOneDrivePermission(permission, targets, owner.microsoftEmail)) {
        await graph(accessToken, `/me/drive/items/${encodeURIComponent(owner.rootFolderId)}/permissions/${encodeURIComponent(permission.id)}`, {
          method: "DELETE",
        });
      }
    }
    next = page["@odata.nextLink"] ?? null;
  }
}

export class OneDriveAccessRevocationError extends Error {
  constructor() {
    super("Microsoft access to shared Taskdesk folders could not be fully revoked.");
    this.name = "OneDriveAccessRevocationError";
  }
}

/**
 * Revoke direct collaborator access in both directions before an account
 * is disconnected or deactivated. Keep the connection row if any Microsoft
 * permission could not be removed so the operation can be retried safely.
 */
export async function disconnectOneDriveUser(userId: number, organizationId: number): Promise<void> {
  const [target] = await db.select().from(oneDriveConnectionsTable).where(and(
    eq(oneDriveConnectionsTable.userId, userId),
    eq(oneDriveConnectionsTable.organizationId, organizationId),
  )).limit(1);
  if (!target) return;

  const orgConnections = await db.select().from(oneDriveConnectionsTable)
    .where(eq(oneDriveConnectionsTable.organizationId, organizationId));
  let failed = false;

  for (const owner of orgConnections) {
    if (owner.userId === userId) continue;
    try {
      const accessToken = await refreshConnection(owner);
      await revokeFolderInvitations(accessToken, owner, [target.microsoftEmail]);
    } catch (error) {
      failed = true;
      logger.warn({ err: error, ownerUserId: owner.userId, recipientUserId: userId }, "Could not revoke OneDrive folder access");
    }
  }

  try {
    const accessToken = await refreshConnection(target);
    const otherEmails = orgConnections
      .filter((connection) => connection.userId !== userId)
      .map((connection) => connection.microsoftEmail);
    await revokeFolderInvitations(accessToken, target, otherEmails);
  } catch (error) {
    failed = true;
    logger.warn({ err: error, userId }, "Could not revoke collaborator access to OneDrive folder");
  }

  if (failed) throw new OneDriveAccessRevocationError();
  await db.delete(oneDriveConnectionsTable).where(eq(oneDriveConnectionsTable.id, target.id));
}

/**
 * Copies an attachment to its assignee's OneDrive. For unassigned email tickets,
 * use the oldest connected organization admin; unassigned standard tickets use
 * the creator's root folder.
 */
export async function syncOneDriveAttachment(
  attachmentId: number,
  emailFallback = false,
  retryExisting = false,
): Promise<void> {
  const [attachment] = await db.select().from(ticketAttachmentsTable)
    .where(eq(ticketAttachmentsTable.id, attachmentId)).limit(1);
  if (!attachment || (attachment.oneDriveItemId && !retryExisting)) return;
  const [ticket] = await db.select({
    id: ticketsTable.id,
    organizationId: ticketsTable.organizationId,
    assignedTo: ticketsTable.assignedTo,
    createdBy: ticketsTable.createdBy,
    inboundChannelId: ticketsTable.inboundChannelId,
    deletedAt: ticketsTable.deletedAt,
  }).from(ticketsTable).where(eq(ticketsTable.id, attachment.ticketId)).limit(1);
  if (!ticket || ticket.deletedAt || !ticket.organizationId) return;

  const useEmailFallback = emailFallback || (retryExisting && ticket.inboundChannelId != null);
  const targetUserId = ticket.assignedTo ?? (useEmailFallback
    ? (await db.select({ id: usersTable.id }).from(usersTable)
      .innerJoin(oneDriveConnectionsTable, eq(oneDriveConnectionsTable.userId, usersTable.id))
      .where(and(eq(usersTable.organizationId, ticket.organizationId), eq(usersTable.role, "admin")))
      .orderBy(usersTable.createdAt).limit(1))[0]?.id
    : ticket.createdBy);
  if (!targetUserId) {
    await db.update(ticketAttachmentsTable).set({ oneDriveSyncError: "No connected organization administrator is available." })
      .where(eq(ticketAttachmentsTable.id, attachment.id));
    return;
  }
  const [connection] = await db.select().from(oneDriveConnectionsTable)
    .where(and(eq(oneDriveConnectionsTable.userId, targetUserId), eq(oneDriveConnectionsTable.organizationId, ticket.organizationId)))
    .limit(1);
  if (!connection) {
    await db.update(ticketAttachmentsTable).set({ oneDriveSyncError: "Connect OneDrive for the ticket assignee to sync this file." })
      .where(eq(ticketAttachmentsTable.id, attachment.id));
    return;
  }

  try {
    const accessToken = await refreshConnection(connection);
    const parentId = ticket.assignedTo ? connection.operatorFolderId : connection.rootFolderId;
    const object = await storage.getObjectEntityFile(attachment.objectPath);
    const [bytes] = await object.download();
    const name = getOneDriveAttachmentCopyName(ticket.id, attachment.id, attachment.fileName);
    const uploaded = await graph<{ id?: string }>(
      accessToken,
      `/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=replace`,
      {
        method: "PUT",
        headers: { "Content-Type": attachment.mimeType },
        body: bytes,
      },
    );
    if (!uploaded.id) throw new Error("Microsoft Graph did not return the OneDrive copy ID.");

    const [owner] = await db.select({ name: usersTable.name }).from(usersTable)
      .where(eq(usersTable.id, targetUserId)).limit(1);
    await db.transaction(async (tx) => {
      // The ticket may have been reassigned while Microsoft Graph was
      // receiving the upload. Recheck the intended assignee under a row lock
      // so an in-flight copy cannot become the ticket's current OneDrive item.
      const [currentTicket] = await tx.select({
        organizationId: ticketsTable.organizationId,
        assignedTo: ticketsTable.assignedTo,
        createdBy: ticketsTable.createdBy,
        inboundChannelId: ticketsTable.inboundChannelId,
        deletedAt: ticketsTable.deletedAt,
      }).from(ticketsTable)
        .where(eq(ticketsTable.id, ticket.id))
        .for("update")
        .limit(1);
      if (!currentTicket || currentTicket.deletedAt || currentTicket.organizationId == null) return;

      let currentTargetUserId = currentTicket.assignedTo ?? currentTicket.createdBy;
      if (currentTicket.assignedTo == null && useEmailFallback && currentTicket.inboundChannelId != null) {
        const [inboundOwner] = await tx.select({ id: usersTable.id })
          .from(usersTable)
          .innerJoin(oneDriveConnectionsTable, eq(oneDriveConnectionsTable.userId, usersTable.id))
          .where(and(
            eq(usersTable.organizationId, currentTicket.organizationId),
            eq(usersTable.role, "admin"),
            eq(oneDriveConnectionsTable.organizationId, currentTicket.organizationId),
          ))
          .orderBy(asc(usersTable.createdAt))
          .limit(1);
        currentTargetUserId = inboundOwner?.id ?? null;
      }

      const [currentConnection] = currentTargetUserId == null ? [] : await tx.select({
        microsoftEmail: oneDriveConnectionsTable.microsoftEmail,
        tenantId: oneDriveConnectionsTable.tenantId,
      }).from(oneDriveConnectionsTable)
        .where(and(
          eq(oneDriveConnectionsTable.userId, currentTargetUserId),
          eq(oneDriveConnectionsTable.organizationId, currentTicket.organizationId),
        ))
        .limit(1);
      const [currentAttachment] = await tx.select({
        oneDriveItemId: ticketAttachmentsTable.oneDriveItemId,
      }).from(ticketAttachmentsTable)
        .where(eq(ticketAttachmentsTable.id, attachment.id))
        .for("update")
        .limit(1);
      if (!currentAttachment) return;

      const isCurrent = isUploadedOneDriveCopyCurrent({
        currentAssigneeId: currentTargetUserId,
        uploaderId: targetUserId,
        currentAccount: currentConnection ?? null,
        uploadAccount: connection,
        currentItemId: currentAttachment.oneDriveItemId,
        uploadedItemId: uploaded.id!,
      });
      if (isCurrent) {
        await tx.update(ticketAttachmentsTable)
          .set({ oneDriveItemId: uploaded.id!, oneDriveSyncError: null })
          .where(eq(ticketAttachmentsTable.id, attachment.id));
      }
      await tx.insert(ticketAttachmentOneDriveCopiesTable).values({
        attachmentId: attachment.id,
        ownerUserId: targetUserId,
        ownerName: owner?.name || connection.microsoftEmail,
        ownerEmail: connection.microsoftEmail,
        ownerTenantId: connection.tenantId,
        itemId: uploaded.id!,
        isCurrent,
      }).onConflictDoUpdate({
        target: [
          ticketAttachmentOneDriveCopiesTable.attachmentId,
          ticketAttachmentOneDriveCopiesTable.ownerTenantId,
          ticketAttachmentOneDriveCopiesTable.ownerEmail,
          ticketAttachmentOneDriveCopiesTable.itemId,
        ],
        set: {
          ownerUserId: targetUserId,
          ownerName: owner?.name || connection.microsoftEmail,
          isCurrent,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "OneDrive copy failed.";
    logger.warn({ attachmentId, userId: targetUserId, message }, "OneDrive attachment sync failed");
    await db.update(ticketAttachmentsTable)
      .set({ oneDriveSyncError: message.slice(0, 500) })
      .where(eq(ticketAttachmentsTable.id, attachment.id));
  }
}

export async function retryOneDriveAttachment(attachmentId: number, emailFallback = false): Promise<void> {
  await syncOneDriveAttachment(attachmentId, emailFallback, true);
}

export async function removeStaleOneDriveAttachmentCopy(
  copyId: number,
  ticketId: number,
  organizationId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [lockedCopy] = await tx.select({ id: ticketAttachmentOneDriveCopiesTable.id })
      .from(ticketAttachmentOneDriveCopiesTable)
      .where(eq(ticketAttachmentOneDriveCopiesTable.id, copyId))
      .for("update")
      .limit(1);
    if (!lockedCopy) throw new OneDriveCopyRemovalError("Stale OneDrive copy not found.", 404);

    const [copy] = await tx.select({
      id: ticketAttachmentOneDriveCopiesTable.id,
      attachmentId: ticketAttachmentOneDriveCopiesTable.attachmentId,
      ownerUserId: ticketAttachmentOneDriveCopiesTable.ownerUserId,
      ownerEmail: ticketAttachmentOneDriveCopiesTable.ownerEmail,
      ownerTenantId: ticketAttachmentOneDriveCopiesTable.ownerTenantId,
      itemId: ticketAttachmentOneDriveCopiesTable.itemId,
      isCurrent: ticketAttachmentOneDriveCopiesTable.isCurrent,
      ticketId: ticketsTable.id,
      assignedTo: ticketsTable.assignedTo,
      currentItemId: ticketAttachmentsTable.oneDriveItemId,
      fileName: ticketAttachmentsTable.fileName,
    }).from(ticketAttachmentOneDriveCopiesTable)
      .innerJoin(ticketAttachmentsTable, eq(ticketAttachmentsTable.id, ticketAttachmentOneDriveCopiesTable.attachmentId))
      .innerJoin(ticketsTable, eq(ticketsTable.id, ticketAttachmentsTable.ticketId))
      .where(and(
        eq(ticketAttachmentOneDriveCopiesTable.id, copyId),
        eq(ticketsTable.id, ticketId),
        eq(ticketsTable.organizationId, organizationId),
        isNull(ticketsTable.deletedAt),
      ))
      .limit(1);

    if (!copy || copy.isCurrent) {
      throw new OneDriveCopyRemovalError("Stale OneDrive copy not found.", 404);
    }
    if (copy.itemId === copy.currentItemId) {
      throw new OneDriveCopyRemovalError(
        "This copy is current for the ticket assignment. Nothing was deleted.",
        409,
      );
    }
    if (!copy.ownerUserId) {
      throw new OneDriveCopyRemovalError("The original OneDrive account owner is no longer available.", 409);
    }

    const [connection] = await tx.select().from(oneDriveConnectionsTable)
      .where(and(
        eq(oneDriveConnectionsTable.userId, copy.ownerUserId),
        eq(oneDriveConnectionsTable.organizationId, organizationId),
      ))
      .limit(1);
    if (!connection || !isOneDriveCopyAccountMatch(copy, connection)) {
      throw new OneDriveCopyRemovalError(
        "Reconnect the original Microsoft account before removing this copy.",
        409,
      );
    }

    const accessToken = await refreshConnection(connection);
    const itemPath = `/me/drive/items/${encodeURIComponent(copy.itemId)}`;
    const item = await graph<{ id?: string; name?: string; file?: object }>(
      accessToken,
      `${itemPath}?$select=id,name,file`,
    );
    if (!isExpectedOneDriveAttachmentCopy(item, copy.itemId, copy.ticketId, copy.attachmentId, copy.fileName)) {
      throw new OneDriveCopyRemovalError(
        "The selected OneDrive item does not match this TaskDesk attachment. Nothing was deleted.",
        409,
      );
    }

    await graph(accessToken, itemPath, { method: "DELETE" });
    await tx.delete(ticketAttachmentOneDriveCopiesTable)
      .where(and(
        eq(ticketAttachmentOneDriveCopiesTable.id, copy.id),
        eq(ticketAttachmentOneDriveCopiesTable.isCurrent, false),
      ));
  });
}

export async function syncTicketOneDriveAttachments(ticketId: number): Promise<void> {
  const attachments = await db.select({ id: ticketAttachmentsTable.id })
    .from(ticketAttachmentsTable)
    .where(eq(ticketAttachmentsTable.ticketId, ticketId));

  for (const attachment of attachments) {
    await syncOneDriveAttachment(attachment.id);
  }
}

export async function syncPendingOneDriveAttachments(userId: number, organizationId: number, isAdmin: boolean): Promise<void> {
  const candidates = await db.select({
    attachmentId: ticketAttachmentsTable.id,
    assignedTo: ticketsTable.assignedTo,
    createdBy: ticketsTable.createdBy,
    inboundChannelId: ticketsTable.inboundChannelId,
  }).from(ticketAttachmentsTable)
    .innerJoin(ticketsTable, eq(ticketsTable.id, ticketAttachmentsTable.ticketId))
    .where(and(
      eq(ticketsTable.organizationId, organizationId),
      isNull(ticketsTable.deletedAt),
      isNull(ticketAttachmentsTable.oneDriveItemId),
      or(
        eq(ticketsTable.assignedTo, userId),
        and(isNull(ticketsTable.assignedTo), eq(ticketsTable.createdBy, userId)),
        ...(isAdmin ? [and(isNull(ticketsTable.assignedTo), isNotNull(ticketsTable.inboundChannelId))] : []),
      ),
    ));
  for (const item of candidates) {
    await syncOneDriveAttachment(item.attachmentId, item.assignedTo == null && item.inboundChannelId != null);
  }
}
