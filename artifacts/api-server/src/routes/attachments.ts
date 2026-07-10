import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ticketAttachmentsTable, ticketsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { SaveTicketAttachmentBody } from "@workspace/api-zod";
import { consumePendingUpload } from "../lib/pendingUploads";
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "../lib/allowedMimeTypes";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/tickets/:id/attachments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket id" }); return; }

  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const attachments = await db
    .select()
    .from(ticketAttachmentsTable)
    .where(eq(ticketAttachmentsTable.ticketId, id))
    .orderBy(ticketAttachmentsTable.createdAt);

  res.json(attachments);
});

router.post("/tickets/:id/attachments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket id" }); return; }

  const parsed = SaveTicketAttachmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const orgId: number | null = currentUser.organizationId ?? null;

  const { objectPath, fileName, fileSize, mimeType, commentId } = parsed.data;

  // Reject active content types that browsers can render or execute.
  // The upload-URL endpoint already enforces this allowlist, but we check
  // again here because a caller could request a URL for an allowed type
  // and then pass a different mimeType when saving the attachment record.
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    res.status(400).json({ error: "File type not allowed" });
    return;
  }

  // Verify that the objectPath was legitimately issued by this server to
  // the calling user/org. This prevents a caller from rebinding an
  // arbitrary (or stolen) path — including files owned by another tenant.
  const isOwned = consumePendingUpload(objectPath, currentUser.id, orgId);
  if (!isOwned) {
    res.status(403).json({ error: "objectPath was not issued by this server for your account, or the upload token has expired" });
    return;
  }

  // Verify what was ACTUALLY stored in GCS — the authoritative source of truth.
  // A caller can request a signed URL for an allowed type, then PUT an entirely
  // different payload (different Content-Type or larger file) to the returned URL.
  // Checking GCS metadata after upload closes that gap.
  let actualMimeType: string;
  let actualSize: number;
  try {
    ({ contentType: actualMimeType, size: actualSize } = await objectStorageService.getObjectEntityActualMetadata(objectPath));
  } catch {
    res.status(500).json({ error: "Failed to verify uploaded file" });
    return;
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(actualMimeType)) {
    res.status(400).json({ error: "Uploaded file type is not allowed" });
    return;
  }

  if (actualSize > MAX_UPLOAD_SIZE_BYTES) {
    res.status(400).json({ error: `Uploaded file exceeds the maximum allowed size of ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB` });
    return;
  }

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [attachment] = await db.insert(ticketAttachmentsTable).values({
    ticketId: id,
    commentId: commentId ?? null,
    uploadedBy: currentUser.id,
    objectPath,
    fileName,
    fileSize: actualSize,
    mimeType: actualMimeType,
  }).returning();

  res.status(201).json(attachment);
});

export default router;
