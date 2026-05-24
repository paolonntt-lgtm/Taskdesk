import { Router, type IRouter } from "express";
import { eq, sql, and, gte, isNotNull, inArray, lt, notInArray } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketCommentsTable, organizationsTable } from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

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

router.get("/stats/by-status", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

  const rows = await db.select({
    name: ticketsTable.status,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(orgFilter).groupBy(ticketsTable.status);

  const labels: Record<string, string> = {
    open: "Aperto", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
  };

  res.json(rows.map((r) => ({ name: labels[r.name] ?? r.name, count: Number(r.count) })));
});

router.get("/stats/by-category", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

  const rows = await db.select({
    name: ticketsTable.category,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(orgFilter).groupBy(ticketsTable.category);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-location", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

  const rows = await db.select({
    name: ticketsTable.location,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(orgFilter).groupBy(ticketsTable.location);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-priority", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

  const rows = await db.select({
    name: ticketsTable.priority,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).where(orgFilter).groupBy(ticketsTable.priority);

  const labels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };

  res.json(rows.map((r) => ({ name: labels[r.name] ?? r.name, count: Number(r.count) })));
});

router.get("/stats/by-assignee", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    count: sql<number>`count(${ticketsTable.id})`,
  })
    .from(usersTable)
    .leftJoin(
      ticketsTable,
      orgId != null
        ? and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId))
        : eq(ticketsTable.assignedTo, usersTable.id)
    )
    .where(orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    .groupBy(usersTable.id, usersTable.name)
    .having(sql`count(${ticketsTable.id}) > 0`);

  res.json(rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })));
});

router.get("/stats/trend", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

  const rows = await db.select({
    date: sql<string>`date_trunc('day', created_at)::date::text`,
    count: sql<number>`count(*)`,
  })
    .from(ticketsTable)
    .where(
      orgFilter
        ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '30 days'`))
        : gte(ticketsTable.createdAt, sql`now() - interval '30 days'`)
    )
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  res.json(rows.map((r) => ({ date: r.date, count: Number(r.count) })));
});

router.get("/stats/recent-tickets", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;

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
        orgId != null
          ? and(inArray(usersTable.id, userIds as number[]), eq(usersTable.organizationId, orgId))
          : inArray(usersTable.id, userIds as number[])
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(tickets.map((t) => ({
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

  const orgAndUser = orgId != null
    ? and(
        eq(ticketsTable.organizationId, orgId),
        sql`(created_by = ${currentUser.id} OR assigned_to = ${currentUser.id})`
      )
    : sql`(created_by = ${currentUser.id} OR assigned_to = ${currentUser.id})`;

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
        orgId != null
          ? and(inArray(usersTable.id, userIds as number[]), eq(usersTable.organizationId, orgId))
          : inArray(usersTable.id, userIds as number[])
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(tickets.map((t) => ({
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

  const filter = orgId != null
    ? and(eq(ticketsTable.organizationId, orgId), eq(ticketsTable.assignedTo, currentUser.id))
    : eq(ticketsTable.assignedTo, currentUser.id);

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
  const orgFilter = orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined;
  const userOrgFilter = orgId != null ? eq(usersTable.organizationId, orgId) : undefined;

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
    }).from(ticketsTable).where(
      orgFilter ? and(orgFilter, isNotNull(ticketsTable.closedAt)) : isNotNull(ticketsTable.closedAt)
    ),

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
        orgId != null
          ? and(eq(ticketsTable.assignedTo, usersTable.id), eq(ticketsTable.organizationId, orgId))
          : eq(ticketsTable.assignedTo, usersTable.id)
      )
      .where(userOrgFilter)
      .groupBy(usersTable.id, usersTable.name)
      .having(sql`count(${ticketsTable.id}) > 0`),

    db.select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      count: sql<number>`count(*)`,
    }).from(ticketsTable)
      .where(
        orgFilter
          ? and(orgFilter, gte(ticketsTable.createdAt, sql`now() - interval '30 days'`))
          : gte(ticketsTable.createdAt, sql`now() - interval '30 days'`)
      )
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`),

    db.select({ id: usersTable.id, name: usersTable.name, count: sql<number>`count(${ticketsTable.id})` })
      .from(usersTable)
      .innerJoin(
        ticketsTable,
        orgId != null
          ? and(eq(ticketsTable.createdBy, usersTable.id), eq(ticketsTable.organizationId, orgId))
          : eq(ticketsTable.createdBy, usersTable.id)
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
      .where(orgId != null ? and(userOrgFilter, eq(ticketsTable.organizationId, orgId)) : undefined)
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

  const conditions: any[] = [
    isNotNull(ticketsTable.dueAt),
    lt(ticketsTable.dueAt, sql`now() + interval '7 days'`),
    notInArray(ticketsTable.status, ["resolved", "closed"]),
  ];
  if (orgId != null) conditions.push(eq(ticketsTable.organizationId, orgId));

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
        orgId != null ? and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, orgId)) : inArray(usersTable.id, userIds)
      )
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(tickets.map((t) => ({
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
  const userOrgFilter = orgId != null ? eq(usersTable.organizationId, orgId) : undefined;

  const [openers, commenters, resolvers] = await Promise.all([
    db.select({
      id: usersTable.id,
      name: usersTable.name,
      count: sql<number>`count(${ticketsTable.id})`,
    })
      .from(usersTable)
      .innerJoin(
        ticketsTable,
        orgId != null
          ? and(eq(ticketsTable.createdBy, usersTable.id), eq(ticketsTable.organizationId, orgId))
          : eq(ticketsTable.createdBy, usersTable.id)
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
      .where(orgId != null ? and(userOrgFilter, eq(ticketsTable.organizationId, orgId)) : undefined)
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
