import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
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
import { computeNextRecurrenceOccurrence, parseRecurrenceEndDate, type RecurrenceRule } from "./recurrenceSchedule";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

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
          isNull(ticketsTable.deletedAt),
          lte(ticketsTable.recurrenceNextAt, now)
        )
      );

    if (due.length === 0) return;

    for (const ticket of due) {
      const result = await db.transaction(async (tx) => {
        // Re-read and lock the source so a concurrent stop cannot race the
        // occurrence creation. The initial query above only finds candidates.
        const [lockedTicket] = await tx
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
              eq(ticketsTable.id, ticket.id),
              isNotNull(ticketsTable.recurrenceRule),
              isNotNull(ticketsTable.recurrenceNextAt),
              isNull(ticketsTable.deletedAt),
              lte(ticketsTable.recurrenceNextAt, now),
            ),
          )
          .for("update");

        if (!lockedTicket?.recurrenceRule || !lockedTicket.recurrenceNextAt) return null;
        const rule = lockedTicket.recurrenceRule as RecurrenceRule;
        if (!rule.frequency) return null;

        const occurrenceAt = lockedTicket.recurrenceNextAt;
        const endDate = rule.endDate ? parseRecurrenceEndDate(rule.endDate) : null;
        if (endDate && occurrenceAt > endDate) {
          await tx.update(ticketsTable)
            .set({ recurrenceNextAt: null })
            .where(eq(ticketsTable.id, lockedTicket.id));
          return null;
        }

        const nextAt = computeNextRecurrenceOccurrence(occurrenceAt, rule);
        const shouldContinue = !endDate || nextAt <= endDate;
        const violatesTimeTrackingRequirements =
          lockedTicket.timeTrackingEnabled &&
          ((lockedTicket.timeTrackingBillable && lockedTicket.clientId == null) ||
            (lockedTicket.timeTrackingCompensationOverride === true && lockedTicket.assignedTo == null));
        if (violatesTimeTrackingRequirements) {
          await tx.update(ticketsTable)
            .set({ recurrenceNextAt: shouldContinue ? nextAt : null })
            .where(eq(ticketsTable.id, lockedTicket.id));
          return { skipped: true as const };
        }

        const [orgMax] = await tx
          .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
          .from(ticketsTable)
          .where(
            lockedTicket.organizationId != null
              ? eq(ticketsTable.organizationId, lockedTicket.organizationId)
              : sql`organization_id IS NULL`,
          );
        const nextTicketNumber = (Number(orgMax.maxNum) || 0) + 1;
        const [newTicket] = await tx
          .insert(ticketsTable)
          .values({
            organizationId: lockedTicket.organizationId,
            ticketNumber: nextTicketNumber,
            title: lockedTicket.title,
            description: lockedTicket.description,
            category: lockedTicket.category,
            location: lockedTicket.location,
            resource: lockedTicket.resource,
            priority: lockedTicket.priority,
            status: "open",
            visibility: lockedTicket.visibility,
            createdBy: lockedTicket.createdBy,
            assignedTo: lockedTicket.assignedTo,
            assignedToGroup: lockedTicket.assignedToGroup,
            clientId: lockedTicket.clientId,
            timeTrackingEnabled: lockedTicket.timeTrackingEnabled,
            timeTrackingBillable: lockedTicket.timeTrackingBillable,
            timeTrackingCompensationOverride: lockedTicket.timeTrackingCompensationOverride,
            recurrenceParentId: lockedTicket.id,
          })
          .returning();

        await tx.insert(ticketActivityLogsTable).values({
          ticketId: newTicket.id,
          userId: lockedTicket.createdBy,
          actionType: "recurrence_created",
          actionDescription: `Pratica creata da ricorrenza della pratica #${lockedTicket.ticketNumber ?? lockedTicket.id}`,
        });

        const checklists = await tx.select()
          .from(ticketChecklistsTable)
          .where(eq(ticketChecklistsTable.ticketId, lockedTicket.id));
        for (const cl of checklists) {
          const [newCl] = await tx.insert(ticketChecklistsTable)
            .values({
              ticketId: newTicket.id,
              orgId: cl.orgId,
              title: cl.title,
              position: cl.position,
            })
            .returning();
          const items = await tx.select()
            .from(ticketChecklistItemsTable)
            .where(eq(ticketChecklistItemsTable.checklistId, cl.id));
          if (items.length > 0) {
            await tx.insert(ticketChecklistItemsTable).values(
              items.map((item) => ({
                checklistId: newCl.id,
                orgId: item.orgId,
                text: item.text,
                checked: false,
                position: item.position,
              })),
            );
          }
        }

        await tx.update(ticketsTable)
          .set({ recurrenceNextAt: shouldContinue ? nextAt : null })
          .where(eq(ticketsTable.id, lockedTicket.id));

        return { ticket: lockedTicket, newTicket, skipped: false as const };
      });

      if (!result) continue;
      if (result.skipped) {
        logger.warn(
          { ticketId: ticket.id },
          "ticketRecurrenceJob: skipped invalid time-tracked recurrence",
        );
        continue;
      }

      if (result.ticket.assignedTo) {
        const [assignee] = await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, result.ticket.assignedTo));
        if (assignee) {
          await createNotificationForUser(
            result.ticket.assignedTo,
            result.newTicket.id,
            {
              key: "recurring_ticket_assigned",
              ticketNumber: result.newTicket.ticketNumber ?? result.newTicket.id,
              ticketTitle: result.newTicket.title,
            },
            "ticket_assigned",
            result.ticket.organizationId,
          );
        }
      }

      logger.info(
        { ticketId: result.ticket.id, newTicketId: result.newTicket.id },
        "ticketRecurrenceJob: created recurrence child ticket",
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
