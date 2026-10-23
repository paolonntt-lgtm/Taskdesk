import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import {
  db,
  oneDriveConnectionsTable,
  ticketAttachmentsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const GRAPH = "https://graph.microsoft.com/v1.0";
const storage = new ObjectStorageService();

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
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Microsoft Graph request failed (${response.status}).`);
  return payload as T;
}

export async function exchangeMicrosoftCode(code: string, redirectUri: string, codeVerifier: string) {
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Microsoft OneDrive OAuth is not configured.");
  const response = await fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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
  const rootChildren = await graph<{ value: { id: string; name: string; folder?: object }[] }>(
    accessToken,
    "/me/drive/root/children?$select=id,name,folder&$top=200",
  );
  let root: { id: string; name: string; folder?: object } | undefined =
    rootChildren.value?.find((item) => item.folder && item.name.toLocaleLowerCase() === "taskdesk");
  if (!root) {
    root = await graph<{ id: string; name: string; folder?: object }>(accessToken, "/me/drive/root/children", {
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
  const share = await graph<{ link?: { webUrl?: string } }>(
    accessToken,
    `/me/drive/items/${encodeURIComponent(root.id)}/createLink`,
    { method: "POST", body: JSON.stringify({ type: "edit", scope: "organization" }) },
  );
  return { rootFolderId: root.id, operatorFolderId: operator.id, shareUrl: share.link?.webUrl ?? null };
}

export async function getMicrosoftUser(accessToken: string) {
  return graph<{ id: string; displayName: string; mail: string | null; userPrincipalName: string }>(
    accessToken,
    "/me?$select=id,displayName,mail,userPrincipalName",
  );
}

async function refreshConnection(connection: typeof oneDriveConnectionsTable.$inferSelect) {
  const clientId = process.env.VITE_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Microsoft OneDrive OAuth is not configured.");
  const response = await fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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

/**
 * Copies an attachment to its assignee's OneDrive. For unassigned email tickets,
 * use the oldest connected organization admin; unassigned standard tickets use
 * the creator's root folder.
 */
export async function syncOneDriveAttachment(attachmentId: number, emailFallback = false): Promise<void> {
  const [attachment] = await db.select().from(ticketAttachmentsTable)
    .where(eq(ticketAttachmentsTable.id, attachmentId)).limit(1);
  if (!attachment || attachment.oneDriveItemId) return;
  const [ticket] = await db.select({
    id: ticketsTable.id,
    organizationId: ticketsTable.organizationId,
    assignedTo: ticketsTable.assignedTo,
    createdBy: ticketsTable.createdBy,
    deletedAt: ticketsTable.deletedAt,
  }).from(ticketsTable).where(eq(ticketsTable.id, attachment.ticketId)).limit(1);
  if (!ticket || ticket.deletedAt || !ticket.organizationId) return;

  const targetUserId = ticket.assignedTo ?? (emailFallback
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
    const safeName = attachment.fileName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
    const name = `ticket-${ticket.id}-attachment-${attachment.id}-${safeName}`;
    const uploaded = await graph<{ id?: string }>(
      accessToken,
      `/me/drive/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=replace`,
      {
        method: "PUT",
        headers: { "Content-Type": attachment.mimeType },
        body: bytes,
      },
    );
    await db.update(ticketAttachmentsTable)
      .set({ oneDriveItemId: uploaded.id ?? name, oneDriveSyncError: null })
      .where(eq(ticketAttachmentsTable.id, attachment.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OneDrive copy failed.";
    logger.warn({ attachmentId, userId: targetUserId, message }, "OneDrive attachment sync failed");
    await db.update(ticketAttachmentsTable)
      .set({ oneDriveSyncError: message.slice(0, 500) })
      .where(eq(ticketAttachmentsTable.id, attachment.id));
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
