import { Router, type IRouter } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  ticketAttachmentOneDriveCopiesTable,
  ticketAttachmentsTable,
  ticketsTable,
} from "@workspace/db";
import {
  DeleteTicketOneDriveCopyResponse,
  ListTicketOneDriveCopiesResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  OneDriveCopyRemovalError,
  removeStaleOneDriveAttachmentCopy,
} from "../lib/onedriveGraph";

const router: IRouter = Router();

function parseId(value: string | string[]): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

router.get("/tickets/:id/onedrive-copies", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticketId = parseId(req.params.id);
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  if (!ticketId) { res.status(400).json({ error: "Invalid ticket ID" }); return; }
  if (organizationId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const [ticket] = await db.select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.id, ticketId),
      eq(ticketsTable.organizationId, organizationId),
      isNull(ticketsTable.deletedAt),
    ))
    .limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const copies = await db.select({
    id: ticketAttachmentOneDriveCopiesTable.id,
    attachmentId: ticketAttachmentsTable.id,
    fileName: ticketAttachmentsTable.fileName,
    ownerName: ticketAttachmentOneDriveCopiesTable.ownerName,
    ownerEmail: ticketAttachmentOneDriveCopiesTable.ownerEmail,
    createdAt: ticketAttachmentOneDriveCopiesTable.createdAt,
  }).from(ticketAttachmentOneDriveCopiesTable)
    .innerJoin(ticketAttachmentsTable, eq(ticketAttachmentsTable.id, ticketAttachmentOneDriveCopiesTable.attachmentId))
    .where(and(
      eq(ticketAttachmentsTable.ticketId, ticketId),
      eq(ticketAttachmentOneDriveCopiesTable.isCurrent, false),
    ))
    .orderBy(asc(ticketAttachmentOneDriveCopiesTable.createdAt));

  res.json(ListTicketOneDriveCopiesResponse.parse(copies));
});

router.delete("/tickets/:id/onedrive-copies/:copyId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticketId = parseId(req.params.id);
  const copyId = parseId(req.params.copyId);
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  if (!ticketId || !copyId) { res.status(400).json({ error: "Invalid ticket or copy ID" }); return; }
  if (organizationId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  try {
    await removeStaleOneDriveAttachmentCopy(copyId, ticketId, organizationId);
    res.json(DeleteTicketOneDriveCopyResponse.parse({ deleted: true }));
  } catch (error) {
    if (error instanceof OneDriveCopyRemovalError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.warn({ err: error, ticketId, copyId }, "Failed to remove stale OneDrive attachment copy");
    res.status(502).json({ error: "OneDrive could not remove the selected copy." });
  }
});

export default router;
