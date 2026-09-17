import { and, eq, isNotNull, lt } from "drizzle-orm";
import {
  db,
  ticketsTable,
  notificationsTable,
  ticketActivityLogsTable,
  ticketInternalNotesTable,
  ticketAttachmentsTable,
  ticketCommentsTable,
  ticketSubscriptionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

export const TICKET_TRASH_RETENTION_DAYS = 30;
const TICKET_TRASH_RETENTION_MS = TICKET_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const objectStorageService = new ObjectStorageService();

export async function permanentlyDeleteTicket(ticketId: number): Promise<boolean> {
  const [ticket] = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(eq(ticketsTable.id, ticketId));

  if (!ticket) return false;

  const attachments = await db
    .select({ objectPath: ticketAttachmentsTable.objectPath })
    .from(ticketAttachmentsTable)
    .where(eq(ticketAttachmentsTable.ticketId, ticketId));

  for (const attachment of attachments) {
    try {
      await objectStorageService.deleteObjectEntityByPath(attachment.objectPath);
    } catch (err) {
      logger.warn({ err, objectPath: attachment.objectPath, ticketId }, "Impossibile eliminare l'allegato dal cestino");
    }
  }

  await db.delete(notificationsTable).where(eq(notificationsTable.ticketId, ticketId));
  await db.delete(ticketActivityLogsTable).where(eq(ticketActivityLogsTable.ticketId, ticketId));
  await db.delete(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, ticketId));
  await db.delete(ticketAttachmentsTable).where(eq(ticketAttachmentsTable.ticketId, ticketId));
  await db.delete(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, ticketId));
  await db.delete(ticketSubscriptionsTable).where(eq(ticketSubscriptionsTable.ticketId, ticketId));
  await db.delete(ticketsTable).where(eq(ticketsTable.id, ticketId));

  return true;
}

export async function purgeExpiredDeletedTickets(): Promise<number> {
  const cutoff = new Date(Date.now() - TICKET_TRASH_RETENTION_MS);
  const expired = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(and(isNotNull(ticketsTable.deletedAt), lt(ticketsTable.deletedAt, cutoff)));

  let purged = 0;
  for (const ticket of expired) {
    if (await permanentlyDeleteTicket(ticket.id)) purged += 1;
  }
  return purged;
}

export function startTicketTrashCleanupJob(): void {
  const run = async () => {
    try {
      const purged = await purgeExpiredDeletedTickets();
      if (purged > 0) logger.info({ purged }, "Ticket scaduti nel cestino eliminati definitivamente");
    } catch (err) {
      logger.error({ err }, "Pulizia del cestino ticket fallita");
    }
  };

  void run();
  const interval = setInterval(run, 6 * 60 * 60 * 1000);
  interval.unref();
}