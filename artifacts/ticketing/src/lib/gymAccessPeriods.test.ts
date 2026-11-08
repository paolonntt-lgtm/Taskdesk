import { describe, expect, it } from "vitest";
import {
  getGymAccessDateRange,
  getGymAccessPeriodRange,
  getLocalDateInputValue,
} from "./gymAccessPeriods";

describe("getGymAccessDateRange", () => {
  it("converts a chosen local date range to an exclusive end boundary", () => {
    const range = getGymAccessDateRange("2026-10-01", "2026-10-31");

    expect(range).not.toBeNull();
    expect(new Date(range!.from).getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(new Date(range!.to).getTime()).toBe(new Date(2026, 10, 1).getTime());
  });

  it("rejects reversed, invalid, and overlong ranges", () => {
    expect(getGymAccessDateRange("2026-11-02", "2026-11-01")).toBeNull();
    expect(getGymAccessDateRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(getGymAccessDateRange("2026-01-01", "2026-02-02")).toBeNull();
    expect(getGymAccessDateRange("", "2026-02-02")).toBeNull();
  });

  it("uses local midnight boundaries across both Europe/Rome clock changes", () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "Europe/Rome";
    try {
      const spring = getGymAccessDateRange("2026-03-29", "2026-03-29");
      expect(spring).toEqual({
        from: "2026-03-28T23:00:00.000Z",
        to: "2026-03-29T22:00:00.000Z",
      });
      expect(new Date(spring!.to).getTime() - new Date(spring!.from).getTime())
        .toBe(23 * 60 * 60 * 1000);

      const autumn = getGymAccessDateRange("2026-10-25", "2026-10-25");
      expect(autumn).toEqual({
        from: "2026-10-24T22:00:00.000Z",
        to: "2026-10-25T23:00:00.000Z",
      });
      expect(new Date(autumn!.to).getTime() - new Date(autumn!.from).getTime())
        .toBe(25 * 60 * 60 * 1000);

      expect(getGymAccessDateRange("2026-02-28", "2026-03-31")).not.toBeNull();
      expect(getGymAccessDateRange("2026-09-25", "2026-10-25")).not.toBeNull();
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });
});

describe("getLocalDateInputValue", () => {
  it("formats dates using local calendar values", () => {
    expect(getLocalDateInputValue(new Date(2026, 10, 8))).toBe("2026-11-08");
  });
});

describe("getGymAccessPeriodRange", () => {
  it("uses local calendar-day boundaries for today and yesterday", () => {
    const now = new Date(2026, 10, 8, 14, 30);
    const today = getGymAccessPeriodRange("today", now);
    const yesterday = getGymAccessPeriodRange("yesterday", now);

    expect(new Date(today.from).getTime()).toBe(new Date(2026, 10, 8).getTime());
    expect(new Date(today.to).getTime()).toBe(new Date(2026, 10, 9).getTime());
    expect(new Date(yesterday.from).getTime()).toBe(new Date(2026, 10, 7).getTime());
    expect(new Date(yesterday.to).getTime()).toBe(new Date(2026, 10, 8).getTime());
  });

  it("includes today in the seven-day range and uses a rolling month", () => {
    const now = new Date(2026, 10, 8, 14, 30);
    const last7 = getGymAccessPeriodRange("last7", now);
    const lastMonth = getGymAccessPeriodRange("lastMonth", now);

    expect(new Date(last7.from).getTime()).toBe(new Date(2026, 10, 2).getTime());
    expect(new Date(last7.to).getTime()).toBe(new Date(2026, 10, 9).getTime());
    expect(new Date(lastMonth.from).getTime()).toBe(new Date(2026, 9, 8, 14, 30).getTime());
    expect(new Date(lastMonth.to).getTime()).toBe(now.getTime());
  });
});
