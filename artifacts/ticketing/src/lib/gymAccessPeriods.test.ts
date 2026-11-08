import { describe, expect, it } from "vitest";
import { getGymAccessPeriodRange } from "./gymAccessPeriods";

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
