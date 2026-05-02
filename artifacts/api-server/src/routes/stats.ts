import { Router, type IRouter } from "express";
import { eq, sql, and, gte, isNotNull, inArray } from "drizzle-orm";
import { db, ticketsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const [counts] = await db.select({
    total: sql<number>`count(*)`,
    open: sql<number>`count(*) filter (where status = 'open')`,
    inProgress: sql<number>`count(*) filter (where status = 'in_progress')`,
    waiting: sql<number>`count(*) filter (where status = 'waiting')`,
    resolved: sql<number>`count(*) filter (where status = 'resolved')`,
    closed: sql<number>`count(*) filter (where status = 'closed')`,
    urgent: sql<number>`count(*) filter (where priority = 'urgent')`,
    last7: sql<number>`count(*) filter (where created_at >= now() - interval '7 days')`,
    last30: sql<number>`count(*) filter (where created_at >= now() - interval '30 days')`,
  }).from(ticketsTable);

  const [avgResult] = await db.select({
    avg: sql<number>`avg(extract(epoch from (closed_at - created_at)) / 3600)`,
  }).from(ticketsTable).where(isNotNull(ticketsTable.closedAt));

  res.json({
    totalTickets: Number(counts.total),
    openTickets: Number(counts.open),
    inProgressTickets: Number(counts.inProgress),
    waitingTickets: Number(counts.waiting),
    resolvedTickets: Number(counts.resolved),
    closedTickets: Number(counts.closed),
    urgentTickets: Number(counts.urgent),
    last7Days: Number(counts.last7),
    last30Days: Number(counts.last30),
    avgResolutionHours: avgResult.avg ? Number(avgResult.avg) : null,
  });
});

router.get("/stats/by-status", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    name: ticketsTable.status,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).groupBy(ticketsTable.status);

  const labels: Record<string, string> = {
    open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
  };

  res.json(rows.map((r) => ({ name: labels[r.name] ?? r.name, count: Number(r.count) })));
});

router.get("/stats/by-category", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    name: ticketsTable.category,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).groupBy(ticketsTable.category);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-location", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    name: ticketsTable.location,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).groupBy(ticketsTable.location);

  res.json(rows.map((r) => ({ name: r.name, count: Number(r.count) })));
});

router.get("/stats/by-priority", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    name: ticketsTable.priority,
    count: sql<number>`count(*)`,
  }).from(ticketsTable).groupBy(ticketsTable.priority);

  const labels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };

  res.json(rows.map((r) => ({ name: labels[r.name] ?? r.name, count: Number(r.count) })));
});

router.get("/stats/by-assignee", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    count: sql<number>`count(${ticketsTable.id})`,
  })
    .from(usersTable)
    .leftJoin(ticketsTable, eq(ticketsTable.assignedTo, usersTable.id))
    .groupBy(usersTable.id, usersTable.name)
    .having(sql`count(${ticketsTable.id}) > 0`);

  res.json(rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })));
});

router.get("/stats/trend", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select({
    date: sql<string>`date_trunc('day', created_at)::date::text`,
    count: sql<number>`count(*)`,
  })
    .from(ticketsTable)
    .where(gte(ticketsTable.createdAt, sql`now() - interval '30 days'`))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  res.json(rows.map((r) => ({ date: r.date, count: Number(r.count) })));
});

router.get("/stats/recent-tickets", requireAuth, async (_req, res): Promise<void> => {
  const tickets = await db.select().from(ticketsTable).orderBy(sql`updated_at DESC`).limit(10);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])];
  const users = (userIds as number[]).length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds as number[]))
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

  const tickets = await db.select().from(ticketsTable)
    .where(sql`created_by = ${currentUser.id} OR assigned_to = ${currentUser.id}`)
    .orderBy(sql`updated_at DESC`);

  const userIds = [...new Set([...tickets.map((t) => t.createdBy), ...tickets.map((t) => t.assignedTo).filter(Boolean)])];
  const users = (userIds as number[]).length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds as number[]))
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

export default router;
