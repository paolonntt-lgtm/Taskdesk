export interface TicketDeadlineParts {
  expired: boolean;
  date: string;
  time: string;
}

export function formatTicketDeadlineParts(
  dueAt: string | Date | null | undefined,
  lang: string,
  now: Date = new Date(),
): TicketDeadlineParts | null {
  if (!dueAt) return null;
  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return null;

  const locale = lang === 'en' ? 'en-US' : 'it-IT';
  const dateLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const timeLabel = lang === 'it'
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(':', '.')
    : date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  return { expired: date.getTime() <= now.getTime(), date: dateLabel, time: timeLabel };
}

export function formatTicketDeadlineLabel(
  dueAt: string | Date | null | undefined,
  lang: string,
  expiredLabel: (date: string, time: string) => string,
  now: Date = new Date(),
): string | null {
  const parts = formatTicketDeadlineParts(dueAt, lang, now);
  if (!parts || !dueAt) return null;
  if (parts.expired) return expiredLabel(parts.date, parts.time);

  const date = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const locale = lang === 'en' ? 'en-US' : 'it-IT';
  const futureDate = date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${lang === 'it' ? 'Scade' : 'Due'} ${futureDate}`;
}
