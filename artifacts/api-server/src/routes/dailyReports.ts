import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, ticketsTable, ticketActivityLogsTable, usersTable, dailyReportsTable, dailyReportReadsTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lt, inArray, ne } from "drizzle-orm";
import { createInAppNotificationsForOrg } from "../lib/notifications";
import { extractReportTicketIds, getDailyReportActivityWindow, getRecentReportedTicketTimestamps, isActivityNewSinceLastReport } from "../lib/dailyReportActivity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Report uniqueness is keyed by UTC date; activity selection uses a rolling 12-hour window.
function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" in UTC
}

// Legacy path retained; the endpoint now returns unreported activity from the rolling 12-hour window.
// Admin-only tickets and internal notes are excluded because reports are shared with the organization.
router.get("/daily-reports/my-activity-today", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const { since, until } = getDailyReportActivityWindow();
  const lastReportedAtByTicket = await getRecentReportedTicketTimestamps(currentUser.id, orgId, since, until);

  const activityRows = await db
    .select({
      ticketId: ticketActivityLogsTable.ticketId,
      actionType: ticketActivityLogsTable.actionType,
      createdAt: ticketActivityLogsTable.createdAt,
    })
    .from(ticketActivityLogsTable)
    .innerJoin(ticketsTable, eq(ticketActivityLogsTable.ticketId, ticketsTable.id))
    .where(and(
      eq(ticketActivityLogsTable.userId, currentUser.id),
      gte(ticketActivityLogsTable.createdAt, since),
      lt(ticketActivityLogsTable.createdAt, until),
      eq(ticketsTable.organizationId, orgId),
      eq(ticketsTable.visibility, "organization"),
    ))
    .orderBy(ticketActivityLogsTable.createdAt);

  const ticketActionMap = new Map<number, Set<string>>();
  for (const row of activityRows) {
    if (row.actionType === "note_added") continue;
    if (!isActivityNewSinceLastReport(row.ticketId, row.createdAt, lastReportedAtByTicket)) continue;
    if (!ticketActionMap.has(row.ticketId)) ticketActionMap.set(row.ticketId, new Set());
    ticketActionMap.get(row.ticketId)!.add(row.actionType);
  }

  if (ticketActionMap.size === 0) {
    res.json({ tickets: [] });
    return;
  }

  const ticketIds = Array.from(ticketActionMap.keys());
  const tickets = await db
    .select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      category: ticketsTable.category,
    })
    .from(ticketsTable)
    .where(and(
      inArray(ticketsTable.id, ticketIds),
      eq(ticketsTable.organizationId, orgId),
      eq(ticketsTable.visibility, "organization"),
    ));

  const result = tickets.map((t) => ({
    ...t,
    actions: Array.from(ticketActionMap.get(t.id) ?? []),
  }));

  res.json({ tickets: result });
});

// GET /daily-reports/today-mine
// Returns whether the current user has already submitted a report today.
router.get("/daily-reports/today-mine", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const today = todayDateStr();

  const rows = await db
    .select({ id: dailyReportsTable.id })
    .from(dailyReportsTable)
    .where(and(
      eq(dailyReportsTable.organizationId, currentUser.organizationId),
      eq(dailyReportsTable.authorUserId, currentUser.id),
      eq(dailyReportsTable.date, today),
    ))
    .limit(1);

  res.json({ submitted: rows.length > 0, reportId: rows[0]?.id ?? null });
});

// POST /daily-reports
// Save a new daily report from the current user.
router.post("/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { content, ticketsSnapshot, location } = req.body as {
    content: string;
    ticketsSnapshot?: unknown;
    location?: string;
  };

  if (!content || typeof content !== "string" || content.trim().length < 5) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const today = todayDateStr();
  const sanitizedLocation = typeof location === "string" && location.trim().length > 0
    ? location.trim().slice(0, 100)
    : null;
  const reportTicketIds = extractReportTicketIds(content.trim(), ticketsSnapshot);
  const ticketsSnapshotToStore = reportTicketIds.length > 0 ? reportTicketIds : null;

  const [report] = await db
    .insert(dailyReportsTable)
    .values({
      organizationId: currentUser.organizationId,
      authorUserId: currentUser.id,
      date: today,
      content: content.trim(),
      location: sanitizedLocation,
      ticketsSnapshot: ticketsSnapshotToStore,
    })
    .returning();

  let notificationCount = 0;
  let notificationError = false;
  try {
    notificationCount = await createInAppNotificationsForOrg(
      currentUser.organizationId,
      currentUser.id,
      `${currentUser.name} ha pubblicato il report di oggi`,
      "daily_report_submitted",
      null,
    );
  } catch (notificationErr) {
    notificationError = true;
    logger.error(
      { err: notificationErr, reportId: report.id },
      "Daily report saved but in-app notifications could not be created",
    );
  }

  res.json({ ok: true, report, notificationCount, notificationError });
});

// GET /daily-reports/unread
// Returns reports published by colleagues that the current user hasn't read yet.
router.get("/daily-reports/unread", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  const rows = await db.execute(sql`
    SELECT
      dr.id,
      dr.date,
      dr.content,
      dr.tickets_snapshot AS "ticketsSnapshot",
      dr.created_at AS "createdAt",
      u.id AS "authorId",
      u.name AS "authorName"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.organization_id = ${currentUser.organizationId}
      AND dr.author_user_id <> ${currentUser.id}
      AND NOT EXISTS (
        SELECT 1 FROM daily_report_reads drr
        WHERE drr.daily_report_id = dr.id
          AND drr.user_id = ${currentUser.id}
      )
    ORDER BY dr.date DESC, dr.created_at DESC
    LIMIT 20
  `);

  res.json({ reports: rows.rows });
});

// POST /daily-reports/:id/read
// Mark a specific report as read by the current user.
router.post("/daily-reports/:id/read", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const reportId = parseInt(String(req.params.id));
  if (isNaN(reportId)) { res.status(400).json({ error: "invalid id" }); return; }

  await db
    .insert(dailyReportReadsTable)
    .values({ userId: currentUser.id, dailyReportId: reportId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// GET /daily-reports/recent
// Returns recent organization reports, including the current user's, for the bot dialog.
router.get("/daily-reports/recent", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const rows = await db.execute(sql`
    SELECT
      dr.id,
      dr.date::text AS date,
      dr.created_at AS "createdAt",
      dr.location,
      u.id AS "authorId",
      u.name AS "authorName",
      (dr.author_user_id = ${currentUser.id}) AS "isOwn",
      (
        dr.author_user_id = ${currentUser.id}
        OR EXISTS (
          SELECT 1 FROM daily_report_reads drr
          WHERE drr.daily_report_id = dr.id AND drr.user_id = ${currentUser.id}
        )
      ) AS "isRead"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.organization_id = ${currentUser.organizationId}
      AND dr.created_at >= ${sevenDaysAgo}
    ORDER BY (dr.author_user_id = ${currentUser.id}) DESC, dr.date DESC, dr.created_at DESC
    LIMIT 30
  `);

  res.json({ reports: rows.rows });
});

// GET /daily-reports
// List reports for the org (used by bot for historical queries).
// Query params: ?userId=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=
router.get("/daily-reports", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const limitQ = typeof req.query.limit === 'string' ? req.query.limit : undefined;
  const limit = Math.min(parseInt(limitQ ?? "20") || 20, 50);

  const rows = await db.execute(sql`
    SELECT
      dr.id,
      dr.date,
      dr.content,
      dr.tickets_snapshot AS "ticketsSnapshot",
      dr.created_at AS "createdAt",
      u.id AS "authorId",
      u.name AS "authorName"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.organization_id = ${currentUser.organizationId}
      ${userId ? sql`AND dr.author_user_id = ${parseInt(userId)}` : sql``}
      ${from ? sql`AND dr.date >= ${from}` : sql``}
      ${to ? sql`AND dr.date <= ${to}` : sql``}
    ORDER BY dr.date DESC, dr.created_at DESC
    LIMIT ${limit}
  `);

  res.json({ reports: rows.rows });
});

export default router;
