import { describe, expect, it } from "vitest";
import {
  oneDriveBackfillRetryDelay,
  summarizeOneDriveClientArchiveBackfill,
} from "./oneDriveClientArchiveBackfill";

describe("OneDrive client archive backfill", () => {
  it("summarizes pending, completed, and failed items for the UI", () => {
    expect(summarizeOneDriveClientArchiveBackfill([
      { status: "queued", count: "2" },
      { status: "processing", count: 1 },
      { status: "complete", count: 4 },
      { status: "failed", count: 1 },
    ])).toEqual({
      total: 8,
      pending: 2,
      processing: 1,
      completed: 4,
      failed: 1,
      status: "processing",
    });
  });

  it("reports an empty queue as idle", () => {
    expect(summarizeOneDriveClientArchiveBackfill([])).toMatchObject({
      total: 0,
      status: "idle",
    });
  });

  it("uses bounded exponential retry delays", () => {
    expect(oneDriveBackfillRetryDelay(1)).toBe(30_000);
    expect(oneDriveBackfillRetryDelay(3)).toBe(120_000);
    expect(oneDriveBackfillRetryDelay(10)).toBe(60 * 60_000);
  });
});
