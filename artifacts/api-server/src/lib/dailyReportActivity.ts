import { and, eq, gte, lt } from "drizzle-orm";
import { db, dailyReportsTable } from "@workspace/db";

export const DAILY_REPORT_ACTIVITY_WINDOW_MS = 12 * 60 * 60 * 1000;

export function getDailyReportActivityWindow(now = new Date()): { since: Date; until: Date } {
  return {
    since: new Date(now.getTime() - DAILY_REPORT_ACTIVITY_WINDOW_MS),
    until: now,
  };
}

export function extractReportTicketIds(content: string, snapshot?: unknown): number[] {
  const ticketIds = new Set<number>();
  const addId = (value: unknown) => {
    const id = typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
    if (Number.isSafeInteger(id) && id > 0) ticketIds.add(id);
  };

  for (const match of content.matchAll(/\/tickets\/(\d+)(?=[/?#)\s]|$)/g)) {
    addId(match[1]);
  }

  const visitSnapshot = (value: unknown, depth = 0): void => {
    if (depth > 3 || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) visitSnapshot(item, depth + 1);
      return;
    }
    if (typeof value !== "object") {
      addId(value);
      return;
    }

    const record = value as Record<string, unknown>;
    addId(record.id ?? record.ticketId);
    visitSnapshot(record.ticketIds, depth + 1);
    visitSnapshot(record.tickets, depth + 1);
  };
  visitSnapshot(snapshot);

  return [...ticketIds];
}

export function isActivityNewSinceLastReport(
  ticketId: number,
  activityAt: Date,
  lastReportedAtByTicket: Map<number, Date>,
): boolean {
  const lastReportedAt = lastReportedAtByTicket.get(ticketId);
  return !lastReportedAt || activityAt.getTime() > lastReportedAt.getTime();
}

export async function getRecentReportedTicketTimestamps(
  userId: number,
  organizationId: number,
  since: Date,
  until: Date,
): Promise<Map<number, Date>> {
  const reports = await db
    .select({
      content: dailyReportsTable.content,
      ticketsSnapshot: dailyReportsTable.ticketsSnapshot,
      createdAt: dailyReportsTable.createdAt,
    })
    .from(dailyReportsTable)
    .where(and(
      eq(dailyReportsTable.organizationId, organizationId),
      eq(dailyReportsTable.authorUserId, userId),
      gte(dailyReportsTable.createdAt, since),
      lt(dailyReportsTable.createdAt, until),
    ));

  const latestReportAtByTicket = new Map<number, Date>();
  for (const report of reports) {
    for (const ticketId of extractReportTicketIds(report.content, report.ticketsSnapshot)) {
      const current = latestReportAtByTicket.get(ticketId);
      if (!current || report.createdAt.getTime() > current.getTime()) {
        latestReportAtByTicket.set(ticketId, report.createdAt);
      }
    }
  }

  return latestReportAtByTicket;
}
