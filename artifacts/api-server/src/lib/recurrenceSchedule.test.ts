import { describe, expect, it } from "vitest";
import { getRecurrenceOccurrencesInRange } from "./recurrenceSchedule";

describe("getRecurrenceOccurrencesInRange", () => {
  it("returns future daily occurrences in the selected month without creating tickets", () => {
    const start = new Date(2026, 11, 1, 9);
    const nextMonth = new Date(2027, 0, 1);
    const occurrences = getRecurrenceOccurrencesInRange(
      new Date(2026, 10, 29, 9),
      { frequency: "daily", interval: 1, endDate: "2026-12-03" },
      start,
      nextMonth,
    );

    expect(occurrences.map((date) => date.getDate())).toEqual([1, 2, 3]);
  });

  it("respects the selected month and monthly day clamping", () => {
    const occurrences = getRecurrenceOccurrencesInRange(
      new Date(2026, 0, 31, 9),
      { frequency: "monthly", interval: 1, dayOfMonth: 31 },
      new Date(2026, 1, 1),
      new Date(2026, 2, 1),
    );

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].getDate()).toBe(28);
  });
});
