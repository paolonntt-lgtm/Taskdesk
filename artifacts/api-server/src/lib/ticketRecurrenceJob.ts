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
import { computeNextWeeklyRecurrence } from "./weeklyRecurrence";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  endDate?: string | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addMonthsOnDay(from: Date, months: number, dayOfMonth?: number | null): Date {
  const targetDay = Math.min(31, Math.max(1, Math.round(dayOfMonth ?? from.getDate())));
  const next = new Date(from);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
  return next;
}

function computeNextAt(current: Date, rule: RecurrenceRule): Date {
  const n = Math.max(1, Math.round(rule.interval ?? 1));
  const next = new Date(current);
  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      return computeNextWeeklyRecurrence(current, n, rule.dayOfWeek);
    case "monthly":
      return addMonthsOnDay(current, n, rule.dayOfMonth);
    case "yearly":
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}

function parseEndDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999`)
    : new Date(value);
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
        visibility: ticketsTable.visibility,
        status: ticketsTable.status,
        createdBy: ticketsTable.createdBy,
        assignedTo: ticketsTable.assignedTo,
        assignedToGroup: ticketsTable.assignedToGroup,
        clientId: ticketsTable.clientId,
        timeTrackingEnabled: ticketsTable.timeTrackingEnabled,
        timeTrackingBillable: ticketsTable.timeTrackingBillable,
        timeTrackingCompensationOverride: ticketsTable.timeTrackingCompensationOverride,
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

      const occurrenceAt = ticket.recurrenceNextAt!;
      const endDate = rule.endDate ? parseEndDate(rule.endDate) : null;
      if (endDate && occurrenceAt > endDate) {
        await db
          .update(ticketsTable)
          .set({ recurrenceNextAt: null })
          .where(eq(ticketsTable.id, ticket.id));
        continue;
      }
      const nextAt = computeNextAt(occurrenceAt, rule);
      const shouldContinue = !endDate || nextAt <= endDate;

      const violatesTimeTrackingRequirements =
        ticket.timeTrackingEnabled &&
        ((ticket.timeTrackingBillable && ticket.clientId == null) ||
          (ticket.timeTrackingCompensationOverride === true && ticket.assignedTo == null));
      if (violatesTimeTrackingRequirements) {
        await db
          .update(ticketsTable)
          .set({ recurrenceNextAt: shouldContinue ? nextAt : null })
          .where(eq(ticketsTable.id, ticket.id));
        logger.warn(
          { ticketId: ticket.id },
          "ticketRecurrenceJob: skipped invalid time-tracked recurrence"
        );
        continue;
      }

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
          visibility: ticket.visibility,
          createdBy: ticket.createdBy,
          assignedTo: ticket.assignedTo,
          assignedToGroup: ticket.assignedToGroup,
          clientId: ticket.clientId,
          timeTrackingEnabled: ticket.timeTrackingEnabled,
          timeTrackingBillable: ticket.timeTrackingBillable,
          timeTrackingCompensationOverride: ticket.timeTrackingCompensationOverride,
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

export async function runTicketRecurrenceJob(): Promise<void> {
  await checkTicketRecurrences();
}

export function startTicketRecurrenceJob(): void {
  void checkTicketRecurrences();
  const interval = setInterval(() => {
    void checkTicketRecurrences();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "ticketRecurrenceJob: started");
}
