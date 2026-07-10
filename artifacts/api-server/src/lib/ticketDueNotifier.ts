import { and, eq, inArray, isNotNull, lt, notInArray } from "drizzle-orm";
import { db, notificationsTable, ticketsTable } from "@workspace/db";
import { createNotificationForUser } from "./notifications";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

async function checkDueTickets(): Promise<void> {
  try {
    const now = new Date();

    const overdueTickets = await db
      .select({
        id: ticketsTable.id,
        title: ticketsTable.title,
        assignedTo: ticketsTable.assignedTo,
        organizationId: ticketsTable.organizationId,
      })
      .from(ticketsTable)
      .where(
        and(
          lt(ticketsTable.dueAt, now),
          isNotNull(ticketsTable.assignedTo),
          notInArray(ticketsTable.status, ["resolved", "closed"])
        )
      );

    if (overdueTickets.length === 0) return;

    const ticketIds = overdueTickets.map((t) => t.id);

    const alreadySent = await db
      .select({ ticketId: notificationsTable.ticketId, userId: notificationsTable.userId })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.type, "ticket_due"),
          inArray(notificationsTable.ticketId, ticketIds)
        )
      );

    const alreadySentSet = new Set(alreadySent.map((r) => `${r.ticketId}:${r.userId}`));

    for (const ticket of overdueTickets) {
      if (!ticket.assignedTo) continue;
      const key = `${ticket.id}:${ticket.assignedTo}`;
      if (alreadySentSet.has(key)) continue;

      const text = `Il ticket #${ticket.id} "${ticket.title}" è scaduto e non è ancora stato risolto.`;
      await createNotificationForUser(
        ticket.assignedTo,
        ticket.id,
        text,
        "ticket_due",
        ticket.organizationId
      );
      logger.info({ ticketId: ticket.id, assignedTo: ticket.assignedTo }, "ticket_due notification sent");
    }
  } catch (err) {
    logger.warn({ err }, "ticketDueNotifier: check failed");
  }
}

export function startTicketDueNotifier(): void {
  const interval = setInterval(() => {
    void checkDueTickets();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  void checkDueTickets();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "ticketDueNotifier: started");
}
