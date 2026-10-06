import { describe, expect, it } from "vitest";
import {
  DAILY_REPORT_ACTIVITY_WINDOW_MS,
  extractReportTicketIds,
  getDailyReportActivityWindow,
  isActivityNewSinceLastReport,
} from "./dailyReportActivity";

describe("daily report activity window and deduplication", () => {
  it("uses a rolling 12-hour window", () => {
    const until = new Date("2026-10-06T12:00:00.000Z");
    const { since, until: windowEnd } = getDailyReportActivityWindow(until);

    expect(windowEnd).toBe(until);
    expect(windowEnd.getTime() - since.getTime()).toBe(DAILY_REPORT_ACTIVITY_WINDOW_MS);
    expect(since.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  it("collects ticket IDs from existing report links and stored snapshots without duplicates", () => {
    const ids = extractReportTicketIds(
      'Worked on [ticket](/tickets/41) and [another](/tickets/52).',
      { ticketIds: [52, 63] },
    );

    expect(ids).toEqual([41, 52, 63]);
  });

  it("allows a ticket again only for activity after that user's last report", () => {
    const lastReportedAtByTicket = new Map([
      [41, new Date("2026-10-06T10:00:00.000Z")],
    ]);

    expect(isActivityNewSinceLastReport(
      41,
      new Date("2026-10-06T09:59:59.000Z"),
      lastReportedAtByTicket,
    )).toBe(false);
    expect(isActivityNewSinceLastReport(
      41,
      new Date("2026-10-06T10:00:00.000Z"),
      lastReportedAtByTicket,
    )).toBe(false);
    expect(isActivityNewSinceLastReport(
      41,
      new Date("2026-10-06T10:00:01.000Z"),
      lastReportedAtByTicket,
    )).toBe(true);
    expect(isActivityNewSinceLastReport(
      52,
      new Date("2026-10-06T09:00:00.000Z"),
      lastReportedAtByTicket,
    )).toBe(true);
  });
});
