import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  ticketsTable,
  ticketActivityLogsTable,
  ticketChecklistsTable,
  ticketChecklistItemsTable,
  usersTable,
} from "@workspace/db";
import { createNotificationForUser } from "./notifications";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  endDate?: string | null;
}

function computeNextAt(current: Date, rule: RecurrenceRule): Date {
  const n = Math.max(1, Math.round(rule.interval ?? 1));
  const next = new Date(current);
  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * n);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + n);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}

async function checkTicketRecurrences(): Promise<void> {
  try {
    const now = new Date();

    const due = await db
      .select({
        id: ticketsTable.id,
        organizationId: ticketsTable.organizationId,
        ticketNumber: ticketsTable.ticketNumber,
        title: ticketsTable.title,
        description: ticketsTable.description,
        category: ticketsTable.category,
        location: ticketsTable.location,
        resource: ticketsTable.resource,
        priority: ticketsTable.priority,
        status: ticketsTable.status,
        createdBy: ticketsTable.createdBy,
        assignedTo: ticketsTable.assignedTo,
        assignedToGroup: ticketsTable.assignedToGroup,
        clientId: ticketsTable.clientId,
        recurrenceRule: ticketsTable.recurrenceRule,
        recurrenceNextAt: ticketsTable.recurrenceNextAt,
        recurrenceParentId: ticketsTable.recurrenceParentId,
      })
      .from(ticketsTable)
      .where(
        and(
          isNotNull(ticketsTable.recurrenceRule),
          isNotNull(ticketsTable.recurrenceNextAt),
          lte(ticketsTable.recurrenceNextAt, now)
        )
      );

    if (due.length === 0) return;

    for (const ticket of due) {
      const rule = ticket.recurrenceRule as RecurrenceRule;
      if (!rule?.frequency) continue;

      const nextAt = computeNextAt(ticket.recurrenceNextAt!, rule);
      const endDate = rule.endDate ? new Date(rule.endDate) : null;
      const shouldContinue = !endDate || nextAt <= endDate;

      const [orgMax] = await db
        .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
        .from(ticketsTable)
        .where(
          ticket.organizationId != null
            ? eq(ticketsTable.organizationId, ticket.organizationId)
            : sql`organization_id IS NULL`
        );
      const nextTicketNumber = (Number(orgMax.maxNum) || 0) + 1;

      const [newTicket] = await db
        .insert(ticketsTable)
        .values({
          organizationId: ticket.organizationId,
          ticketNumber: nextTicketNumber,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          location: ticket.location,
          resource: ticket.resource,
          priority: ticket.priority,
          status: "open",
          createdBy: ticket.createdBy,
          assignedTo: ticket.assignedTo,
          assignedToGroup: ticket.assignedToGroup,
          clientId: ticket.clientId,
          recurrenceParentId: ticket.id,
        })
        .returning();

      await db.insert(ticketActivityLogsTable).values({
        ticketId: newTicket.id,
        userId: ticket.createdBy,
        actionType: "recurrence_created",
        actionDescription: `Pratica creata da ricorrenza della pratica #${ticket.ticketNumber ?? ticket.id}`,
      });

      const checklists = await db
        .select()
        .from(ticketChecklistsTable)
        .where(eq(ticketChecklistsTable.ticketId, ticket.id));

      for (const cl of checklists) {
        const [newCl] = await db
          .insert(ticketChecklistsTable)
          .values({
            ticketId: newTicket.id,
            orgId: cl.orgId,
            title: cl.title,
            position: cl.position,
          })
          .returning();

        const items = await db
          .select()
          .from(ticketChecklistItemsTable)
          .where(eq(ticketChecklistItemsTable.checklistId, cl.id));

        if (items.length > 0) {
          await db.insert(ticketChecklistItemsTable).values(
            items.map((item) => ({
              checklistId: newCl.id,
              orgId: item.orgId,
              text: item.text,
              checked: false,
              position: item.position,
            }))
          );
        }
      }

      if (ticket.assignedTo) {
        const [assignee] = await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, ticket.assignedTo));
        if (assignee) {
          await createNotificationForUser(
            ticket.assignedTo,
            newTicket.id,
            `Nuova pratica ricorrente #${newTicket.ticketNumber ?? newTicket.id}: "${newTicket.title}"`,
            "ticket_assigned",
            ticket.organizationId
          );
        }
      }

      const newRecurrenceNextAt = shouldContinue ? nextAt : null;
      await db
        .update(ticketsTable)
        .set({ recurrenceNextAt: newRecurrenceNextAt })
        .where(eq(ticketsTable.id, ticket.id));

      logger.info(
        { ticketId: ticket.id, newTicketId: newTicket.id, nextAt: newRecurrenceNextAt },
        "ticketRecurrenceJob: created recurrence child ticket"
      );
    }
  } catch (err) {
    logger.warn({ err }, "ticketRecurrenceJob: check failed");
  }
}

export function startTicketRecurrenceJob(): void {
  void checkTicketRecurrences();
  const interval = setInterval(() => {
    void checkTicketRecurrences();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "ticketRecurrenceJob: started");
}
