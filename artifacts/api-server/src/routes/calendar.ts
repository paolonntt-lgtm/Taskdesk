import { Router, type IRouter } from "express";
import { eq, and, gte, lt, isNotNull, inArray } from "drizzle-orm";
import { db, ticketsTable, usersTable, appointmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

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

  // Fetch tickets due in this month (org-scoped, role-filtered)
  const ticketConditions: any[] = [
    isNotNull(ticketsTable.dueAt),
    gte(ticketsTable.dueAt, start),
    lt(ticketsTable.dueAt, end),
  ];
  if (orgId != null) ticketConditions.push(eq(ticketsTable.organizationId, orgId));
  if (!isAdmin) {
    ticketConditions.push(
      eq(ticketsTable.visibility, "organization"),
      // Regular users only see tickets they created or are assigned to
      eq(ticketsTable.createdBy, currentUser.id),
    );
  }

  const tickets = await db
    .select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      dueAt: ticketsTable.dueAt,
      assignedTo: ticketsTable.assignedTo,
      createdBy: ticketsTable.createdBy,
      ticketNumber: ticketsTable.ticketNumber,
    })
    .from(ticketsTable)
    .where(and(...ticketConditions));

  // For non-admins, also include tickets assigned to them (in addition to created by them)
  let assignedTickets: typeof tickets = [];
  if (!isAdmin && orgId != null) {
    const assignedConditions: any[] = [
      isNotNull(ticketsTable.dueAt),
      gte(ticketsTable.dueAt, start),
      lt(ticketsTable.dueAt, end),
      eq(ticketsTable.organizationId, orgId),
      eq(ticketsTable.visibility, "organization"),
      eq(ticketsTable.assignedTo, currentUser.id),
    ];
    assignedTickets = await db
      .select({
        id: ticketsTable.id,
        title: ticketsTable.title,
        status: ticketsTable.status,
        priority: ticketsTable.priority,
        dueAt: ticketsTable.dueAt,
        assignedTo: ticketsTable.assignedTo,
        createdBy: ticketsTable.createdBy,
        ticketNumber: ticketsTable.ticketNumber,
      })
      .from(ticketsTable)
      .where(and(...assignedConditions));
  }

  // Merge and deduplicate tickets
  const allTicketIds = new Set<number>();
  const allTickets = [...tickets, ...assignedTickets].filter((t) => {
    if (allTicketIds.has(t.id)) return false;
    allTicketIds.add(t.id);
    return true;
  });

  // Fetch assignee info for tickets
  const assigneeIds = [...new Set(allTickets.map((t) => t.assignedTo).filter(Boolean))] as number[];
  const ticketAssignees = assigneeIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.id, assigneeIds))
    : [];
  const ticketAssigneeMap = new Map(ticketAssignees.map((u) => [u.id, u]));

  // Fetch appointments for this month
  const apptConditions: any[] = [
    gte(appointmentsTable.startsAt, start),
    lt(appointmentsTable.startsAt, end),
  ];
  if (orgId != null) apptConditions.push(eq(appointmentsTable.organizationId, orgId));

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(and(...apptConditions));

  // Build unified CalendarItem array
  const items: any[] = [];

  for (const t of allTickets) {
    const due = t.dueAt!;
    const date = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    items.push({
      type: 'ticket',
      date,
      id: t.id,
      title: t.title,
      startsAt: due.toISOString(),
      endsAt: null,
      status: t.status,
      priority: t.priority,
      assignee: t.assignedTo ? (ticketAssigneeMap.get(t.assignedTo) ?? null) : null,
      description: null,
      createdBy: t.createdBy,
      ticketNumber: t.ticketNumber,
    });
  }

  for (const a of appts) {
    const s = a.startsAt;
    const date = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    items.push({
      type: 'appointment',
      date,
      id: a.id,
      title: a.title,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt ? a.endsAt.toISOString() : null,
      status: null,
      priority: null,
      assignee: null,
      description: a.description,
      createdBy: a.createdBy,
    });
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
