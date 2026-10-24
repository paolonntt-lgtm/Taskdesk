import { describe, expect, it } from "vitest";
import {
  getCalendarDayMarkers,
  getItemsForDate,
  getMonthGridDays,
  getMonthSelection,
  groupCalendarItemsByDate,
  type CalendarItem,
} from "./calendar";

const item = (
  type: CalendarItem["type"],
  id: number,
  date: string,
  startsAt?: string,
): CalendarItem => ({
  type,
  id,
  title: `${type} ${id}`,
  date,
  startsAt,
});

describe("calendar month grid", () => {
  it("uses Monday-first weeks and pads both ends with blank cells", () => {
    // May 2021 starts on Saturday and has 31 days: five leading and six trailing blanks.
    const days = getMonthGridDays(2021, 5);

    expect(days).toHaveLength(42);
    expect(days.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(days.slice(5, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(days.slice(-6)).toEqual([null, null, null, null, null, null]);
    expect(days.filter((day) => day !== null)).toEqual(
      Array.from({ length: 31 }, (_, index) => index + 1),
    );
  });

  it("allows a month with no trailing blanks when its weeks are complete", () => {
    // February 2021 starts on Monday and has exactly four complete weeks.
    expect(getMonthGridDays(2021, 2)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1),
    );
  });
});

describe("calendar day markers", () => {
  const ticket = item("ticket", 1, "2026-10-24");
  const appointment = item("appointment", 2, "2026-10-24");

  it("marks a ticket-only day", () => {
    expect(getCalendarDayMarkers([ticket])).toEqual({
      hasTickets: true,
      hasAppointments: false,
    });
  });

  it("marks an appointment-only day", () => {
    expect(getCalendarDayMarkers([appointment])).toEqual({
      hasTickets: false,
      hasAppointments: true,
    });
  });

  it("shows both marker types when both item types fall on a day", () => {
    expect(getCalendarDayMarkers([ticket, appointment])).toEqual({
      hasTickets: true,
      hasAppointments: true,
    });
  });
});

describe("selected-day agenda", () => {
  it("returns only the selected date's items, sorted chronologically without mutating the source", () => {
    const late = item("ticket", 1, "2026-10-24", "2026-10-24T16:30:00.000Z");
    const appointment = item("appointment", 2, "2026-10-24", "2026-10-24T09:15:00.000Z");
    const early = item("ticket", 3, "2026-10-24", "2026-10-24T08:00:00.000Z");
    const otherDay = item("appointment", 4, "2026-10-25", "2026-10-25T07:00:00.000Z");
    const grouped = groupCalendarItemsByDate([late, otherDay, appointment, early]);

    expect(getItemsForDate(grouped, "2026-10-24")).toEqual([early, appointment, late]);
    expect(grouped.get("2026-10-24")).toEqual([late, appointment, early]);
    expect(getItemsForDate(grouped, "2026-10-25")).toEqual([otherDay]);
  });
});

describe("month navigation", () => {
  it("selects the first day of the newly navigated month across year boundaries", () => {
    const next = getMonthSelection(new Date(2026, 11, 1), 1);
    expect(next.month.getFullYear()).toBe(2027);
    expect(next.month.getMonth()).toBe(0);
    expect(next.selectedDate).toBe("2027-01-01");
  });

  it("selects the first day when navigating to the previous month", () => {
    const previous = getMonthSelection(new Date(2026, 0, 1), -1);
    expect(previous.month.getFullYear()).toBe(2025);
    expect(previous.month.getMonth()).toBe(11);
    expect(previous.selectedDate).toBe("2025-12-01");
  });
});
