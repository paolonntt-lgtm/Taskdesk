import { computeNextWeeklyRecurrence } from "./weeklyRecurrence";

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  endDate?: string | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addMonthsOnDay(from: Date, months: number, dayOfMonth?: number | null): Date {
  const targetDay = Math.min(31, Math.max(1, Math.round(dayOfMonth ?? from.getDate())));
  const next = new Date(from);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
  return next;
}

export function computeNextRecurrenceOccurrence(current: Date, rule: RecurrenceRule): Date {
  const interval = Math.max(1, Math.round(rule.interval ?? 1));
  const next = new Date(current);
  switch (rule.frequency) {
    case "daily":
      next.setDate(next.getDate() + interval);
      return next;
    case "weekly":
      return computeNextWeeklyRecurrence(current, interval, rule.dayOfWeek);
    case "monthly":
      return addMonthsOnDay(current, interval, rule.dayOfMonth);
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      return next;
  }
}

export function parseRecurrenceEndDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999`)
    : new Date(value);
}

export function getRecurrenceOccurrencesInRange(
  firstOccurrence: Date,
  rule: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const result: Date[] = [];
  const endDate = rule.endDate ? parseRecurrenceEndDate(rule.endDate) : null;
  let occurrence = new Date(firstOccurrence);

  // Active recurrence cursors normally sit near the present. The cap also
  // protects the calendar endpoint from malformed or unexpectedly stale data.
  for (let count = 0; occurrence < rangeEnd && count < 10_000; count += 1) {
    if (endDate && occurrence > endDate) break;
    if (occurrence >= rangeStart) result.push(new Date(occurrence));

    const next = computeNextRecurrenceOccurrence(occurrence, rule);
    if (next <= occurrence) break;
    occurrence = next;
  }

  return result;
}
