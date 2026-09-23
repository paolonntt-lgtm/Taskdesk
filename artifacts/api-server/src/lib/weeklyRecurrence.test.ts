import { describe, expect, it } from "vitest";
import { computeNextWeeklyRecurrence } from "./weeklyRecurrence";

const occurrence = (value: string): Date => new Date(`${value}T10:15:00.000Z`);

describe("computeNextWeeklyRecurrence", () => {
  const from = occurrence("2026-09-23"); // Wednesday

  it.each([
    [0, "2026-09-27"], // Sunday
    [1, "2026-09-28"], // Monday
    [2, "2026-09-29"], // Tuesday
    [3, "2026-09-30"], // Wednesday
    [4, "2026-09-24"], // Thursday
    [5, "2026-09-25"], // Friday
    [6, "2026-09-26"], // Saturday
  ])("schedules every selected weekday strictly after the current occurrence (%i)", (dayOfWeek, expected) => {
    expect(computeNextWeeklyRecurrence(from, 1, dayOfWeek).toISOString()).toBe(
      `${expected}T10:15:00.000Z`,
    );
  });

  it.each([
    [0, "2026-10-04"], // Sunday
    [3, "2026-10-07"], // Wednesday
    [6, "2026-10-03"], // Saturday
  ])("honors a multi-week interval for day %i", (dayOfWeek, expected) => {
    expect(computeNextWeeklyRecurrence(from, 2, dayOfWeek).toISOString()).toBe(
      `${expected}T10:15:00.000Z`,
    );
  });

  it("moves a selected weekday matching today to the following week", () => {
    expect(computeNextWeeklyRecurrence(from, 1, from.getDay()).toISOString()).toBe(
      "2026-09-30T10:15:00.000Z",
    );
  });

  it("keeps the previous weekday-based behavior when no day is stored", () => {
    expect(computeNextWeeklyRecurrence(from, 1).toISOString()).toBe(
      "2026-09-30T10:15:00.000Z",
    );
    expect(computeNextWeeklyRecurrence(from, 2, null).toISOString()).toBe(
      "2026-10-07T10:15:00.000Z",
    );
  });
});