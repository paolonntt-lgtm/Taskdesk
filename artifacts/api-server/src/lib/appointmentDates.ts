/**
 * All-day appointment inputs represent calendar dates, not instants. Normalize
 * their written YYYY-MM-DD date to UTC midnight so timezone offsets cannot move
 * the event to the previous or next calendar day.
 */
export function parseAppointmentDate(value: string, isAllDay: boolean): Date {
  if (!isAllDay) return new Date(value);

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return new Date(value);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return new Date(Number.NaN);
  }
  return date;
}
