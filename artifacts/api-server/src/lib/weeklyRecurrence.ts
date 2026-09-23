export function computeNextWeeklyRecurrence(
  from: Date,
  interval: number = 1,
  dayOfWeek?: number | null,
): Date {
  const weeks = Math.max(1, Math.round(interval));

  // Rules created before dayOfWeek was introduced repeat the weekday of
  // the occurrence that just ran. Keep that behavior for old tickets.
  if (dayOfWeek == null) {
    const next = new Date(from);
    next.setDate(next.getDate() + 7 * weeks);
    return next;
  }

  const targetDay = Math.min(6, Math.max(0, Math.round(dayOfWeek)));
  const next = new Date(from);

  // A selected weekday must always be strictly after the current occurrence.
  // In particular, selecting today's weekday schedules the first occurrence
  // in the following week rather than immediately.
  const daysUntilTarget = (targetDay - next.getDay() + 7) % 7 || 7;
  next.setDate(next.getDate() + daysUntilTarget + 7 * (weeks - 1));
  return next;
}