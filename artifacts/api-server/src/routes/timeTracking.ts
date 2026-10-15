import { Router, type IRouter } from "express";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  clientsTable,
  organizationsTable,
  ticketsTable,
  ticketTimeSessionsTable,
  ticketTimeSessionEditsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";
import { createNotificationForUser } from "../lib/notifications";

const router: IRouter = Router();

const UpdateTimeSessionInput = z.object({
  durationMinutes: z.number().int().min(0).max(5256000),
  clientBillable: z.boolean(),
  collaboratorRecognizable: z.boolean(),
});

router.patch("/tickets/:id/time-sessions/:sessionId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const ticketId = Number(req.params.id);
  const sessionId = Number(req.params.sessionId);
  const parsed = UpdateTimeSessionInput.safeParse(req.body);
  if (!Number.isInteger(ticketId) || ticketId < 1 || !Number.isInteger(sessionId) || sessionId < 1 || !parsed.success) {
    res.status(400).json({ error: "Invalid time session update" });
    return;
  }

  const orgId = currentUser.organizationId;
  const result = await db.transaction(async (tx) => {
    const [ticket] = await tx.select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title,
      timeTrackingEnabled: ticketsTable.timeTrackingEnabled,
      closedAt: ticketsTable.closedAt,
    }).from(ticketsTable).where(and(
      eq(ticketsTable.id, ticketId),
      eq(ticketsTable.organizationId, orgId),
      isNull(ticketsTable.deletedAt),
    )).for("update");
    if (!ticket?.timeTrackingEnabled || !ticket.closedAt) return null;

    const [session] = await tx.select().from(ticketTimeSessionsTable).where(and(
      eq(ticketTimeSessionsTable.id, sessionId),
      eq(ticketTimeSessionsTable.ticketId, ticketId),
      eq(ticketTimeSessionsTable.organizationId, orgId),
    )).for("update");
    if (!session?.endedAt) return null;

    const previousDurationMinutes = Math.max(0, Math.floor(
      (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000,
    ));
    const endedAt = new Date(session.startedAt.getTime() + parsed.data.durationMinutes * 60_000);
    await tx.insert(ticketTimeSessionEditsTable).values({
      organizationId: orgId,
      ticketId,
      sessionId,
      collaboratorId: session.userId,
      editedBy: currentUser.id,
      previousDurationMinutes,
      updatedDurationMinutes: parsed.data.durationMinutes,
      previousClientBillable: session.clientBillable,
      updatedClientBillable: parsed.data.clientBillable,
      previousCollaboratorRecognizable: session.collaboratorRecognizable,
      updatedCollaboratorRecognizable: parsed.data.collaboratorRecognizable,
    });
    const [updated] = await tx.update(ticketTimeSessionsTable).set({
      endedAt,
      clientBillable: parsed.data.clientBillable,
      collaboratorRecognizable: parsed.data.collaboratorRecognizable,
    }).where(eq(ticketTimeSessionsTable.id, sessionId)).returning();
    return { ticket, session: updated, collaboratorId: session.userId };
  });
  if (!result) {
    res.status(404).json({ error: "Closed tracked session not found" });
    return;
  }

  await createNotificationForUser(
    result.collaboratorId,
    ticketId,
    `L'amministratore ha aggiornato le tue ore registrate sul ticket #${result.ticket.ticketNumber ?? ticketId}: "${result.ticket.title}".`,
    "system",
    orgId,
  );
  res.status(204).end();
});

type ReportRow = {
  kind: "session" | "manual";
  ticketId: number;
  ticketNumber: number | null;
  title: string;
  date: Date;
  durationMinutes: number;
  clientId: number | null;
  clientName: string | null;
  collaboratorId: number | null;
  collaboratorName: string | null;
  billingStatus: "unbilled" | "billed";
};

function parseDateBoundary(raw: unknown, endOfDay: boolean): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get("/time-tracking/report", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const [organization] = await db.select({
    enabled: organizationsTable.timeTrackingModuleEnabled,
    workedTimeEnabled: organizationsTable.workedTimeEnabled,
  })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!organization?.enabled) {
    res.status(403).json({ error: "Time tracking is disabled for this organization" });
    return;
  }

  const dateFrom = req.query.dateFrom ? parseDateBoundary(req.query.dateFrom, false) : null;
  const dateTo = req.query.dateTo ? parseDateBoundary(req.query.dateTo, true) : null;
  const clientId = req.query.clientId == null ? null : Number(req.query.clientId);
  const collaboratorId = req.query.collaboratorId == null ? null : Number(req.query.collaboratorId);
  if ((req.query.dateFrom && !dateFrom) || (req.query.dateTo && !dateTo)
    || (clientId != null && (!Number.isInteger(clientId) || clientId < 1))
    || (collaboratorId != null && (!Number.isInteger(collaboratorId) || collaboratorId < 1))) {
    res.status(400).json({ error: "Invalid time-report filters" });
    return;
  }

  const ticketConditions = [
    eq(ticketsTable.organizationId, orgId),
    isNull(ticketsTable.deletedAt),
  ];
  if (clientId != null) ticketConditions.push(eq(ticketsTable.clientId, clientId));

  const tickets = await db.select({
    id: ticketsTable.id,
    ticketNumber: ticketsTable.ticketNumber,
    title: ticketsTable.title,
    clientId: ticketsTable.clientId,
    clientName: clientsTable.name,
    workedMinutes: ticketsTable.workedMinutes,
    workedBillingStatus: ticketsTable.workedBillingStatus,
    closedAt: ticketsTable.closedAt,
  })
    .from(ticketsTable)
    .leftJoin(clientsTable, eq(ticketsTable.clientId, clientsTable.id))
    .where(and(...ticketConditions));
  const ticketMap = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const ticketIds = tickets.map((ticket) => ticket.id);

  const sessionConditions = [
    eq(ticketTimeSessionsTable.organizationId, orgId),
    inArray(ticketTimeSessionsTable.ticketId, ticketIds.length > 0 ? ticketIds : [-1]),
  ];
  if (dateFrom) sessionConditions.push(gte(ticketTimeSessionsTable.startedAt, dateFrom));
  if (dateTo) sessionConditions.push(lte(ticketTimeSessionsTable.startedAt, dateTo));
  if (collaboratorId != null) sessionConditions.push(eq(ticketTimeSessionsTable.userId, collaboratorId));

  const sessions = ticketIds.length > 0
    ? await db.select({
        id: ticketTimeSessionsTable.id,
        ticketId: ticketTimeSessionsTable.ticketId,
        userId: ticketTimeSessionsTable.userId,
        userName: usersTable.name,
        startedAt: ticketTimeSessionsTable.startedAt,
        endedAt: ticketTimeSessionsTable.endedAt,
        clientBillable: ticketTimeSessionsTable.clientBillable,
        collaboratorRecognizable: ticketTimeSessionsTable.collaboratorRecognizable,
      })
        .from(ticketTimeSessionsTable)
        .innerJoin(usersTable, eq(ticketTimeSessionsTable.userId, usersTable.id))
        .where(and(...sessionConditions))
    : [];

  const now = Date.now();
  const customerSessionGroups = new Map<number, { minutes: number; date: Date }>();
  const collaboratorGroups = new Map<string, ReportRow>();
  let clientBillableMinutes = 0;
  let clientUnbilledMinutes = 0;
  let clientBilledMinutes = 0;
  let collaboratorRecognizableMinutes = 0;

  for (const session of sessions) {
    const ticket = ticketMap.get(session.ticketId);
    if (!ticket) continue;
    const minutes = Math.max(0, Math.floor((new Date(session.endedAt ?? now).getTime() - new Date(session.startedAt).getTime()) / 60_000));
    if (session.clientBillable) {
      const existing = customerSessionGroups.get(ticket.id);
      if (existing) {
        existing.minutes += minutes;
        if (new Date(session.startedAt) < existing.date) existing.date = new Date(session.startedAt);
      } else {
        customerSessionGroups.set(ticket.id, { minutes, date: new Date(session.startedAt) });
      }
      clientBillableMinutes += minutes;
      if (ticket.workedBillingStatus === "billed") clientBilledMinutes += minutes;
      else clientUnbilledMinutes += minutes;
    }
    if (session.collaboratorRecognizable) {
      const key = `${ticket.id}:${session.userId}`;
      const current = collaboratorGroups.get(key);
      if (current) current.durationMinutes += minutes;
      else {
        collaboratorGroups.set(key, {
          kind: "session",
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          date: new Date(session.startedAt),
          durationMinutes: minutes,
          clientId: ticket.clientId,
          clientName: ticket.clientName,
          collaboratorId: session.userId,
          collaboratorName: session.userName,
          billingStatus: ticket.workedBillingStatus === "billed" ? "billed" : "unbilled",
        });
      }
      collaboratorRecognizableMinutes += minutes;
    }
  }

  const customerRows: ReportRow[] = [];
  for (const [ticketId, group] of customerSessionGroups) {
    const ticket = ticketMap.get(ticketId)!;
    customerRows.push({
      kind: "session",
      ticketId,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      date: group.date,
      durationMinutes: group.minutes,
      clientId: ticket.clientId,
      clientName: ticket.clientName,
      collaboratorId: null,
      collaboratorName: null,
      billingStatus: ticket.workedBillingStatus === "billed" ? "billed" : "unbilled",
    });
  }

  // Preserve the existing manual-hours report as a separate source of customer-billable time.
  for (const ticket of organization.workedTimeEnabled ? tickets : []) {
    if (!Number.isInteger(ticket.workedMinutes) || ticket.workedMinutes == null || ticket.closedAt == null) continue;
    const closedAt = new Date(ticket.closedAt);
    if (dateFrom && closedAt < dateFrom) continue;
    if (dateTo && closedAt > dateTo) continue;
    const minutes = ticket.workedMinutes;
    customerRows.push({
      kind: "manual",
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      date: closedAt,
      durationMinutes: minutes,
      clientId: ticket.clientId,
      clientName: ticket.clientName,
      collaboratorId: null,
      collaboratorName: null,
      billingStatus: ticket.workedBillingStatus === "billed" ? "billed" : "unbilled",
    });
    clientBillableMinutes += minutes;
    if (ticket.workedBillingStatus === "billed") clientBilledMinutes += minutes;
    else clientUnbilledMinutes += minutes;
  }

  customerRows.sort((a, b) => b.date.getTime() - a.date.getTime());
  const collaboratorRows = [...collaboratorGroups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

  res.setHeader("Cache-Control", "no-store");
  res.json({
    customerRows,
    collaboratorRows,
    totals: {
      clientBillableMinutes,
      clientUnbilledMinutes,
      clientBilledMinutes,
      collaboratorRecognizableMinutes,
    },
  });
});

export default router;
