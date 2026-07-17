import { Router, type IRouter } from "express";
import { eq, sql, and, gte, isNotNull, inArray, lt, notInArray, asc } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketCommentsTable, organizationsTable, ticketStatusesTable, ticketChecklistsTable, ticketChecklistItemsTable } from "@workspace/db";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middlewares/auth";

async function addChecklistProgress<T extends { id: number }>(tickets: T[]): Promise<(T & { checklistCount: number; checklistTotal: number; checklistChecked: number })[]> {
  if (tickets.length === 0) return tickets.map((t) => ({ ...t, checklistCount: 0, checklistTotal: 0, checklistChecked: 0 }));
  const ticketIds = tickets.map((t) => t.id);
  const stats = await db
    .select({
      ticketId: ticketChecklistsTable.ticketId,
      checklistCount: sql<number>`count(distinct ${ticketChecklistsTable.id})`,
      total: sql<number>`count(${ticketChecklistItemsTable.id})`,
      checked: sql<number>`count(${ticketChecklistItemsTable.id}) filter (where ${ticketChecklistItemsTable.checked} = true)`,
    })
    .from(ticketChecklistsTable)
    .leftJoin(ticketChecklistItemsTable, eq(ticketChecklistItemsTable.checklistId, ticketChecklistsTable.id))
    .where(inArray(ticketChecklistsTable.ticketId, ticketIds))
    .groupBy(ticketChecklistsTable.ticketId);
  const map = new Map(stats.map((s) => [s.ticketId, { checklistCount: Number(s.checklistCount), total: Number(s.total), checked: Number(s.checked) }]));
  return tickets.map((t) => ({
    ...t,
    checklistCount: map.get(t.id)?.checklistCount ?? 0,
    checklistTotal: map.get(t.id)?.total ?? 0,
    checklistChecked: map.get(t.id)?.checked ?? 0,
  }));
}

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const [counts] = await db.select({
    total: sql<number>`count(*)`,
    open: sql<number>`count(*) filter (where status = 'open')`,
    waiting: sql<number>`count(*) filter (where status = 'waiting')`,
    resolved: sql<number>`count(*) filter (where status = 'resolved')`,
    closed: sql<number>`count(*) filter (where status = 'closed')`,
    urgent: sql<number>`count(*) filter (where priority = 'urgent' and status not in ('resolved','closed'))`,
    overdue: sql<number>`count(*) filter (where due_at is not null and due_at < now() and status not in ('resolved','closed'))`,
    last7: sql<number>`count(*) filter (where created_at >= now() - interval '7 days')`,
    last30: sql<number>`count(*) filter (where created_at >= now() - interval '30 days')`,
  }).from(ticketsTable).where(orgFilter);

  const [avgResult] = await db.select({
    avg: sql<number>`avg(extract(epoch from (closed_at - created_at)) / 3600)`,
  }).from(ticketsTable).where(orgFilter ? and(orgFilter, isNotNull(ticketsTable.closedAt)) : isNotNull(ticketsTable.closedAt));

  res.json({
    totalTickets: Number(counts.total),
    openTickets: Number(counts.open),
    waitingTickets: Number(counts.waiting),
    resolvedTickets: Number(counts.resolved),
    closedTickets: Number(counts.closed),
    urgentTickets: Number(counts.urgent),
    overdueTickets: Number(counts.overdue),
    last7Days: Number(counts.last7),
    last30Days: Number(counts.last30),
    avgResolutionHours: avgResult.avg ? Number(avgResult.avg) : null,
  });
});

function parseValidDays(raw: unknown): 7 | 30 | 90 | null {
  const n = parseInt(String(raw));
  if (n === 7 || n === 30 || n === 90) return n;
  return null;
}

router.get("/stats/by-status", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const validDays = parseValidDays(req.query.days);
  const conditions = validDays
    ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`))
    : orgFilter;

  const [rows, statuses] = await Promise.all([
    db.select({
      name: ticketsTable.status,
      count: sql<number>`count(*)`,
    }).from(ticketsTable).where(conditions).groupBy(ticketsTable.status),
    db.select().from(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, orgId)).orderBy(asc(ticketStatusesTable.sortOrder)),
  ]);

  const statusMap = new Map(statuses.map((s) => [s.key, s]));

  const fallbackLabels: Record<string, string> = {
    open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
  };

  res.json(rows.map((r) => {
    const custom = statusMap.get(r.name);
    return {
      name: custom?.label ?? fallbackLabels[r.name] ?? r.name,
      count: Number(r.count),
      color: custom?.color ?? null,
      key: r.name,
    };
  }));
});

router.get("/stats/by-category", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const validDays = parseValidDays(req.query.days);
  const conditions = validDays
    ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`))
    : orgFilter;

  const rows = await db.select({
    name: ticketsTable.category,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(conditions).groupBy(ticketsTable.category);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-location", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const validDays = parseValidDays(req.query.days);
  const conditions = validDays
    ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`))
    : orgFilter;

  const rows = await db.select({
    name: ticketsTable.location,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(conditions).groupBy(ticketsTable.location);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-priority", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const validDays = parseValidDays(req.query.days);
  const conditions = validDays
    ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`))
    : orgFilter;

  const rows = await db.select({
    name: ticketsTable.priority,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(conditions).groupBy(ticketsTable.priority);

  const labels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };

  res.json(rows.map((r) => ({ name: labels[r.name] ?? r.name, count: Number(r.count) })));
});

router.get("/stats/by-assignee", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const validDays = parseValidDays(req.query.days);
  const joinCondition = validDays
    ? and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId), gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`))
    : and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId));

  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    count: sql<number>`count(${ticketsTable.id})`,
  })
    .from(usersTable)
    .leftJoin(ticketsTable, joinCondition)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isSystem, false)))
    .groupBy(usersTable.id, usersTable.name)
    .having(sql`count(${ticketsTable.id}) > 0`);

  res.json(rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })));
});

router.get("/stats/trend", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const validDays = parseValidDays(req.query.days) ?? 30;

  const rows = await db.select({
    date: sql<string>`date_trunc('day', created_at)::date::text`,
    count: sql<number>`count(*)`,
  })
    .from(ticketsTable)
    .where(and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '1 day' * ${validDays}`)))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  res.json(rows.map((r) => ({ date: r.date, count: Number(r.count) })));
});

router.get("/stats/recent-tickets", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);

  const tickets = await db.select().from(ticketsTable)
    .where(orgFilter)
    .orderBy(sql`updated_at DESC`).limit(10);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])];
  const users = (userIds as number[]).length > 0
    ? await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        mainLocation: usersTable.mainLocation,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(
        and(inArray(usersTable.id, userIds as number[]), eq(usersTable.organizationId, orgId))
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const withChecklist = await addChecklistProgress(tickets);
  res.json(withChecklist.map((t) => ({
    ...t,
    creator: userMap.get(t.createdBy)!,
    assignee: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    commentCount: 0,
    noteCount: 0,
  })));
});

router.get("/stats/my-tickets", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const orgAndUser = and(
    eq(ticketsTable.organizationId, orgId),
    sql`(created_by = ${currentUser.id} OR assigned_to = ${currentUser.id})`
  );

  const tickets = await db.select().from(ticketsTable)
    .where(orgAndUser)
    .orderBy(sql`updated_at DESC`);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])];
  const users = (userIds as number[]).length > 0
    ? await db.select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        mainLocation: usersTable.mainLocation,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(
        and(inArray(usersTable.id, userIds as number[]), eq(usersTable.organizationId, orgId))
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const withChecklist = await addChecklistProgress(tickets);
  res.json(withChecklist.map((t) => ({
    ...t,
    creator: userMap.get(t.createdBy)!,
    assignee: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    commentCount: 0,
    noteCount: 0,
  })));
});

router.get("/stats/assignee-workload", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    open: sql<number>`count(${ticketsTable.id}) filter (where ${ticketsTable.status} not in ('resolved','closed'))`,
    total: sql<number>`count(${ticketsTable.id})`,
  })
    .from(usersTable)
    .leftJoin(
      ticketsTable,
      and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId))
    )
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isActive, true), eq(usersTable.isSystem, false)))
    .groupBy(usersTable.id, usersTable.name, usersTable.email)
    .orderBy(sql`count(${ticketsTable.id}) filter (where ${ticketsTable.status} not in ('resolved','closed')) desc`);

  res.json(rows.map((r) => ({ id: r.id, name: r.name, email: r.email, open: Number(r.open), total: Number(r.total) })));
});

router.get("/stats/overdue-tickets", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const conditions: any[] = [
    isNotNull(ticketsTable.dueAt),
    lt(ticketsTable.dueAt, sql`now()`),
    notInArray(ticketsTable.status, ["resolved", "closed"]),
    eq(ticketsTable.organizationId, orgId),
  ];

  const tickets = await db.select().from(ticketsTable)
    .where(and(...conditions))
    .orderBy(ticketsTable.dueAt)
    .limit(20);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])] as number[];
  const users = userIds.length > 0
    ? await db.select({
        id: usersTable.id, name: usersTable.name, email: usersTable.email,
        role: usersTable.role, mainLocation: usersTable.mainLocation,
        avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt,
      }).from(usersTable).where(
        and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, orgId))
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const withChecklist = await addChecklistProgress(tickets);
  res.json(withChecklist.map((t) => ({
    ...t,
    creator: userMap.get(t.createdBy)!,
    assignee: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    commentCount: 0,
    noteCount: 0,
  })));
});

router.get("/stats/assigned-to-me", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const filter = and(eq(ticketsTable.organizationId, orgId), eq(ticketsTable.assignedTo, currentUser.id));

  const tickets = await db.select().from(ticketsTable)
    .where(filter)
    .orderBy(sql`updated_at DESC`);

  res.json(tickets.map((t) => ({
    ...t,
    creator: null,
    assignee: null,
    commentCount: 0,
    noteCount: 0,
  })));
});

router.get("/stats/reports-all", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const orgFilter = eq(ticketsTable.organizationId, orgId);
  const userOrgFilter = eq(usersTable.organizationId, orgId);

  const [
    dashRow,
    avgResult,
    byStatus,
    byCategory,
    byLocation,
    byPriority,
    byAssignee,
    trend,
    openers,
    commenters,
    resolvers,
  ] = await Promise.all([
    db.select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where status = 'open')`,
      waiting: sql<number>`count(*) filter (where status = 'waiting')`,
      resolved: sql<number>`count(*) filter (where status = 'resolved')`,
      closed: sql<number>`count(*) filter (where status = 'closed')`,
      urgent: sql<number>`count(*) filter (where priority = 'urgent')`,
      last7: sql<number>`count(*) filter (where created_at >= now() - interval '7 days')`,
      last30: sql<number>`count(*) filter (where created_at >= now() - interval '30 days')`,
    }).from(ticketsTable).where(orgFilter),

    db.select({
      avg: sql<number>`avg(extract(epoch from (closed_at - created_at)) / 3600)`,
    }).from(ticketsTable).where(and(orgFilter, isNotNull(ticketsTable.closedAt))),

    db.select({ name: ticketsTable.status, count: sql<number>`count(*)` })
      .from(ticketsTable).where(orgFilter).groupBy(ticketsTable.status),

    db.select({ name: ticketsTable.category, count: sql<number>`count(*)` })
      .from(ticketsTable).where(orgFilter).groupBy(ticketsTable.category),

    db.select({ name: ticketsTable.location, count: sql<number>`count(*)` })
      .from(ticketsTable).where(orgFilter).groupBy(ticketsTable.location),

    db.select({ name: ticketsTable.priority, count: sql<number>`count(*)` })
      .from(ticketsTable).where(orgFilter).groupBy(ticketsTable.priority),

    db.select({ id: usersTable.id, name: usersTable.name, count: sql<number>`count(${ticketsTable.id})` })
      .from(usersTable)
      .leftJoin(
        ticketsTable,
        and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId))
      )
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .having(sql`count(${ticketsTable.id}) > 0`),

    db.select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      count: sql<number>`count(*)`,
    }).from(ticketsTable)
      .where(and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '30 days'`)))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`),

    db.select({ id: usersTable.id, name: usersTable.name, count: sql<number>`count(${ticketsTable.id})` })
      .from(usersTable)
      .innerJoin(
        ticketsTable,
        and(eq(ticketsTable.createdBy, usersTable.id), eq(ticketsTable.organizationId, orgId))
      )
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketsTable.id}) desc`).limit(5),

    db.select({ id: usersTable.id, name: usersTable.name, count: sql<number>`count(${ticketCommentsTable.id})` })
      .from(usersTable)
      .innerJoin(ticketCommentsTable, eq(ticketCommentsTable.authorId, usersTable.id))
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketCommentsTable.id}) desc`).limit(5),

    db.select({ id: usersTable.id, name: usersTable.name, count: sql<number>`count(${ticketCommentsTable.id})` })
      .from(usersTable)
      .innerJoin(
        ticketCommentsTable,
        and(eq(ticketCommentsTable.authorId, usersTable.id), eq(ticketCommentsTable.isSolution, true))
      )
      .innerJoin(ticketsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
      .where(and(userOrgFilter, eq(ticketsTable.organizationId, orgId)))
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketCommentsTable.id}) desc`).limit(5),
  ]);

  const statusLabels: Record<string, string> = {
    open: "Aperto", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
  };
  const priorityLabels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };

  res.setHeader("Cache-Control", "no-store");
  res.json({
    dashboard: {
      totalTickets: Number(dashRow[0].total),
      openTickets: Number(dashRow[0].open),
      waitingTickets: Number(dashRow[0].waiting),
      resolvedTickets: Number(dashRow[0].resolved),
      closedTickets: Number(dashRow[0].closed),
      urgentTickets: Number(dashRow[0].urgent),
      last7Days: Number(dashRow[0].last7),
      last30Days: Number(dashRow[0].last30),
      avgResolutionHours: avgResult[0].avg ? Number(avgResult[0].avg) : null,
    },
    byStatus: byStatus.map((r) => ({ name: statusLabels[r.name] ?? r.name, count: Number(r.count) })),
    byCategory: byCategory.map((r) => ({ name: r.name, count: Number(r.count) })),
    byLocation: byLocation.map((r) => ({ name: r.name, count: Number(r.count) })),
    byPriority: byPriority.map((r) => ({ name: priorityLabels[r.name] ?? r.name, count: Number(r.count) })),
    byAssignee: byAssignee.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
    trend: trend.map((r) => ({ date: r.date, count: Number(r.count) })),
    leaderboard: {
      openers: openers.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
      commenters: commenters.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
      resolvers: resolvers.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
    },
  });
});

router.get("/stats/due-soon", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const conditions: any[] = [
    isNotNull(ticketsTable.dueAt),
    lt(ticketsTable.dueAt, sql`now() + interval '7 days'`),
    notInArray(ticketsTable.status, ["resolved", "closed"]),
    eq(ticketsTable.organizationId, orgId),
  ];

  const tickets = await db.select().from(ticketsTable)
    .where(and(...conditions))
    .orderBy(ticketsTable.dueAt)
    .limit(10);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])] as number[];
  const users = userIds.length > 0
    ? await db.select({
        id: usersTable.id, name: usersTable.name, email: usersTable.email,
        role: usersTable.role, mainLocation: usersTable.mainLocation,
        avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt,
      }).from(usersTable).where(
        and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, orgId))
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const withChecklist = await addChecklistProgress(tickets);
  res.json(withChecklist.map((t) => ({
    ...t,
    creator: userMap.get(t.createdBy)!,
    assignee: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    commentCount: 0,
    noteCount: 0,
  })));
});

router.get("/stats/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const userOrgFilter = eq(usersTable.organizationId, orgId);

  const [openers, commenters, resolvers] = await Promise.all([
    db.select({
      id: usersTable.id,
      name: usersTable.name,
      count: sql<number>`count(${ticketsTable.id})`,
    })
      .from(usersTable)
      .innerJoin(
        ticketsTable,
        and(eq(ticketsTable.createdBy, usersTable.id), eq(ticketsTable.organizationId, orgId))
      )
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketsTable.id}) desc`)
      .limit(5),

    db.select({
      id: usersTable.id,
      name: usersTable.name,
      count: sql<number>`count(${ticketCommentsTable.id})`,
    })
      .from(usersTable)
      .innerJoin(ticketCommentsTable, eq(ticketCommentsTable.authorId, usersTable.id))
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketCommentsTable.id}) desc`)
      .limit(5),

    db.select({
      id: usersTable.id,
      name: usersTable.name,
      count: sql<number>`count(${ticketCommentsTable.id})`,
    })
      .from(usersTable)
      .innerJoin(
        ticketCommentsTable,
        and(eq(ticketCommentsTable.authorId, usersTable.id), eq(ticketCommentsTable.isSolution, true))
      )
      .innerJoin(ticketsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
      .where(and(userOrgFilter, eq(ticketsTable.organizationId, orgId)))
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`count(${ticketCommentsTable.id}) desc`)
      .limit(5),
  ]);

  res.json({
    openers: openers.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
    commenters: commenters.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
    resolvers: resolvers.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })),
  });
});

router.get("/stats/resolution-by-assignee", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const [byAssignee, overallRows, bucketRows] = await Promise.all([
    db.select({
      id: usersTable.id,
      name: usersTable.name,
      avgHours: sql<number>`round(avg(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
      count: sql<number>`count(${ticketsTable.id})`,
      minHours: sql<number>`round(min(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
      maxHours: sql<number>`round(max(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
    })
      .from(usersTable)
      .innerJoin(
        ticketsTable,
        and(
          eq(ticketsTable.assignedTo, usersTable.id),
          eq(ticketsTable.organizationId, orgId),
          isNotNull(ticketsTable.closedAt),
        )
      )
      .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isSystem, false)))
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(sql`avg(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)`),

    db.select({
      avgHours: sql<number>`round(avg(extract(epoch from (closed_at - created_at)) / 3600)::numeric, 1)`,
      count: sql<number>`count(*)`,
    }).from(ticketsTable).where(and(eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.closedAt))),

    db.select({
      bucket: sql<string>`
        case
          when extract(epoch from (closed_at - created_at)) / 3600 < 4 then '0'
          when extract(epoch from (closed_at - created_at)) / 3600 < 24 then '1'
          when extract(epoch from (closed_at - created_at)) / 3600 < 72 then '2'
          when extract(epoch from (closed_at - created_at)) / 3600 < 168 then '3'
          else '4'
        end
      `,
      count: sql<number>`count(*)`,
    }).from(ticketsTable)
      .where(and(eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.closedAt)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const bucketMap = new Map(bucketRows.map((r) => [r.bucket, Number(r.count)]));

  res.json({
    byAssignee: byAssignee.map((r) => ({
      id: r.id,
      name: r.name,
      avgHours: Number(r.avgHours),
      count: Number(r.count),
      minHours: Number(r.minHours),
      maxHours: Number(r.maxHours),
    })),
    overall: {
      avgHours: overallRows[0]?.avgHours ? Number(overallRows[0].avgHours) : null,
      count: Number(overallRows[0]?.count ?? 0),
    },
    buckets: [0, 1, 2, 3, 4].map((i) => ({ bucket: String(i), count: bucketMap.get(String(i)) ?? 0 })),
  });
});

router.get("/stats/resolution-by-category", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const rows = await db.select({
    name: ticketsTable.category,
    avgHours: sql<number>`round(avg(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
    count: sql<number>`count(${ticketsTable.id})`,
    minHours: sql<number>`round(min(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
    maxHours: sql<number>`round(max(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
  })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.closedAt)))
    .groupBy(ticketsTable.category)
    .orderBy(sql`avg(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)`);

  res.json(rows.map((r) => ({
    name: r.name,
    avgHours: Number(r.avgHours),
    count: Number(r.count),
    minHours: Number(r.minHours),
    maxHours: Number(r.maxHours),
  })));
});

router.get("/stats/resolution-by-priority", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }

  const PRIORITY_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

  const rows = await db.select({
    name: ticketsTable.priority,
    avgHours: sql<number>`round(avg(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
    count: sql<number>`count(${ticketsTable.id})`,
    minHours: sql<number>`round(min(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
    maxHours: sql<number>`round(max(extract(epoch from (${ticketsTable.closedAt} - ${ticketsTable.createdAt})) / 3600)::numeric, 1)`,
  })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.closedAt)))
    .groupBy(ticketsTable.priority);

  const sorted = rows.sort((a, b) => (PRIORITY_ORDER[a.name] ?? 99) - (PRIORITY_ORDER[b.name] ?? 99));

  res.json(sorted.map((r) => ({
    name: r.name,
    avgHours: Number(r.avgHours),
    count: Number(r.count),
    minHours: Number(r.minHours),
    maxHours: Number(r.maxHours),
  })));
});

router.get("/stats/acquisition", requireAuth, requireSuperAdmin, async (_req, res): Promise<void> => {
  const signupsByDay = await db
    .select({
      date: sql<string>`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(organizationsTable)
    .where(gte(organizationsTable.createdAt, sql`now() - interval '14 days'`))
    .groupBy(sql`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  const bySource = await db
    .select({
      source: organizationsTable.utmSource,
      count: sql<number>`count(*)`,
    })
    .from(organizationsTable)
    .groupBy(organizationsTable.utmSource)
    .orderBy(sql`count(*) desc`);

  res.json({
    signupsByDay: signupsByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) })),
  });
});

export default router;
