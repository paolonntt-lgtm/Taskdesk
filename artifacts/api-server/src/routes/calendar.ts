import { Router, type IRouter } from "express";
import { eq, and, gte, lt, isNotNull, inArray, isNull, or } from "drizzle-orm";
import { db, ticketsTable, usersTable, appointmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getCalendarDateKeysForEvent } from "../lib/calendarDateKeys";

const router: IRouter = Router();

router.get("/calendar", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const isAdmin = currentUser.role === "admin";

  const { year, month } = req.query as Record<string, string>;
  const y = parseInt(year ?? "", 10);
  const m = parseInt(month ?? "", 10);

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    res.status(400).json({ error: "year and month are required" });
    return;
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  // Fetch due and future-scheduled tickets in this month (org-scoped, role-filtered)
  const ticketConditions: any[] = [
    or(
      and(isNotNull(ticketsTable.dueAt), gte(ticketsTable.dueAt, start), lt(ticketsTable.dueAt, end)),
      and(isNotNull(ticketsTable.scheduledAt), gte(ticketsTable.scheduledAt, start), lt(ticketsTable.scheduledAt, end)),
    ),
  ];
  if (orgId != null) ticketConditions.push(eq(ticketsTable.organizationId, orgId));
  if (!isAdmin) {
    ticketConditions.push(
      eq(ticketsTable.visibility, "organization"),
      or(
        eq(ticketsTable.createdBy, currentUser.id),
        eq(ticketsTable.assignedTo, currentUser.id),
      ),
    );
  }

  const tickets = await db
    .select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      dueAt: ticketsTable.dueAt,
      scheduledAt: ticketsTable.scheduledAt,
      assignedTo: ticketsTable.assignedTo,
      createdBy: ticketsTable.createdBy,
      ticketNumber: ticketsTable.ticketNumber,
    })
    .from(ticketsTable)
    .where(and(...ticketConditions));

  // Fetch assignee info for tickets
  const assigneeIds = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))] as number[];
  const ticketAssignees = assigneeIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.id, assigneeIds))
    : [];
  const ticketAssigneeMap = new Map(ticketAssignees.map((u) => [u.id, u]));

  // Fetch appointments for this month
  const apptConditions: any[] = [
    lt(appointmentsTable.startsAt, end),
    or(
      gte(appointmentsTable.endsAt, start),
      and(isNull(appointmentsTable.endsAt), gte(appointmentsTable.startsAt, start)),
    ),
  ];
  if (orgId != null) apptConditions.push(eq(appointmentsTable.organizationId, orgId));

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(and(...apptConditions));

  // Build unified CalendarItem array
  const items: any[] = [];

  for (const t of tickets) {
    const baseItem = {
      type: 'ticket',
      id: t.id,
      title: t.title,
      endsAt: null,
      status: t.status,
      priority: t.priority,
      assignee: t.assignedTo ? (ticketAssigneeMap.get(t.assignedTo) ?? null) : null,
      description: null,
      createdBy: t.createdBy,
      ticketNumber: t.ticketNumber,
    };
    for (const [ticketEvent, dateValue] of [
      ['due', t.dueAt],
      ['scheduled', t.scheduledAt],
    ] as const) {
      if (!dateValue || dateValue < start || dateValue >= end) continue;
      const date = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
      items.push({
        ...baseItem,
        ticketEvent,
        date,
        startsAt: dateValue.toISOString(),
      });
    }
  }

  for (const a of appts) {
    for (const date of getCalendarDateKeysForEvent(a.startsAt, a.endsAt, a.isAllDay, y, m)) {
      items.push({
        type: 'appointment',
        date,
        id: a.id,
        title: a.title,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt ? a.endsAt.toISOString() : null,
        isAllDay: a.isAllDay,
        status: null,
        priority: null,
        assignee: null,
        description: a.description,
        createdBy: a.createdBy,
      });
    }
  }

  // Sort by startsAt within the response
  items.sort((a, b) => {
    const da = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const db2 = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    return da - db2;
  });

  res.json(items);
});

export default router;
