import { Router, type IRouter, type Request } from "express";
import { and, eq, isNull, like } from "drizzle-orm";
import {
  db,
  ticketDriveFoldersTable,
  ticketsTable,
} from "@workspace/db";
import {
  AddTicketOneDriveFolderBody,
  AddTicketOneDriveFolderParams,
  RemoveTicketOneDriveFolderParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const ONE_DRIVE_PREFIX = "onedrive:";

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

router.get("/tickets/:id/onedrive-folders", requireAuth, async (req, res): Promise<void> => {
  const params = AddTicketOneDriveFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    res.status(404).json({ error: "TICKET_NOT_FOUND" });
    return;
  }
  const rows = await db
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
      like(ticketDriveFoldersTable.driveFolderId, `${ONE_DRIVE_PREFIX}%`),
    ))
    .orderBy(ticketDriveFoldersTable.createdAt);
  res.json(rows.map((row) => ({
    ...row,
    driveFolderId: row.driveFolderId.slice(ONE_DRIVE_PREFIX.length),
  })));
});

router.post("/tickets/:id/onedrive-folders", requireAuth, async (req, res): Promise<void> => {
  const params = AddTicketOneDriveFolderParams.safeParse(req.params);
  const body = AddTicketOneDriveFolderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    res.status(404).json({ error: "TICKET_NOT_FOUND" });
    return;
  }
  const storedId = `${ONE_DRIVE_PREFIX}${body.data.folderId}`;
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
      eq(ticketDriveFoldersTable.driveFolderId, storedId),
    ));
  if (existing) {
    res.json({ ...existing, driveFolderId: body.data.folderId });
    return;
  }
  const user = (req as any).currentUser as { id: number };
  const [folder] = await db.insert(ticketDriveFoldersTable).values({
    ticketId: ticket.id,
    organizationId: ticket.organizationId!,
    driveFolderId: storedId,
    folderName: body.data.folderName,
    addedBy: user.id,
  }).returning({
    id: ticketDriveFoldersTable.id,
    driveFolderId: ticketDriveFoldersTable.driveFolderId,
    folderName: ticketDriveFoldersTable.folderName,
    createdAt: ticketDriveFoldersTable.createdAt,
  });
  res.status(201).json({ ...folder, driveFolderId: body.data.folderId });
});

router.delete("/tickets/:id/onedrive-folders/:referenceId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveTicketOneDriveFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "INVALID_REQUEST" });
    return;
  }
  const ticket = await getVisibleTicket(req, params.data.id);
  if (!ticket) {
    res.status(404).json({ error: "TICKET_NOT_FOUND" });
    return;
  }
  const [removed] = await db
    .delete(ticketDriveFoldersTable)
    .where(and(
      eq(ticketDriveFoldersTable.id, params.data.referenceId),
      eq(ticketDriveFoldersTable.ticketId, ticket.id),
      eq(ticketDriveFoldersTable.organizationId, ticket.organizationId!),
      like(ticketDriveFoldersTable.driveFolderId, `${ONE_DRIVE_PREFIX}%`),
    ))
    .returning({ id: ticketDriveFoldersTable.id });
  if (!removed) {
    res.status(404).json({ error: "ONEDRIVE_FOLDER_REFERENCE_NOT_FOUND" });
    return;
  }
  res.json({ success: true });
});

export default router;
