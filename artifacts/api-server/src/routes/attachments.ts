import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ticketAttachmentsTable, ticketsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { SaveTicketAttachmentBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tickets/:id/attachments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket id" }); return; }

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

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const currentUser = (req as any).currentUser;
  const { objectPath, fileName, fileSize, mimeType, commentId } = parsed.data;

  const [attachment] = await db.insert(ticketAttachmentsTable).values({
    ticketId: id,
    commentId: commentId ?? null,
    uploadedBy: currentUser.id,
    objectPath,
    fileName,
    fileSize,
    mimeType,
  }).returning();

  res.status(201).json(attachment);
});

export default router;
