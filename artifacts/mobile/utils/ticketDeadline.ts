export interface TicketDeadlineParts {
  expired: boolean;
  date: string;
  time: string;
}

export function formatTicketDeadlineParts(
  dueAt: string | null | undefined,
  lang: string,
  now: Date = new Date(),
): TicketDeadlineParts | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return null;

  const locale = lang === "en" ? "en-US" : "it-IT";
  const dateLabel = date.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const timeLabel = lang === "it"
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", ".")
    : date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  return { expired: date.getTime() <= now.getTime(), date: dateLabel, time: timeLabel };
}
