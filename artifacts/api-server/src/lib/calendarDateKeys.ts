function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCalendarDateKeysForEvent(
  startsAt: Date,
  endsAt: Date | null,
  isAllDay: boolean,
  year: number,
  month: number,
): string[] {
  const endAt = endsAt ?? startsAt;
  const keys: string[] = [];

  if (isAllDay) {
    const start = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()));
    const end = new Date(Date.UTC(endAt.getUTCFullYear(), endAt.getUTCMonth(), endAt.getUTCDate()));
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));
    if (end < firstDay || start > lastDay) return keys;
    const cursor = new Date(Math.max(start.getTime(), firstDay.getTime()));
    const finalDay = new Date(Math.min(end.getTime(), lastDay.getTime()));
    for (; cursor <= finalDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) keys.push(formatUtcDate(cursor));
    return keys;
  }

  const start = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const end = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate());
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  if (end < firstDay || start > lastDay) return keys;
  const cursor = new Date(Math.max(start.getTime(), firstDay.getTime()));
  const finalDay = new Date(Math.min(end.getTime(), lastDay.getTime()));
  for (; cursor <= finalDay; cursor.setDate(cursor.getDate() + 1)) keys.push(formatLocalDate(cursor));
  return keys;
}
