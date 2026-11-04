export function normalizeClientNoteCategory(value: unknown, now = new Date()): string | null {
  if (typeof value !== "string") return null;
  const match = /^(770|CU)(\d{2}|\d{4})?$/i.exec(value.trim());
  if (!match) return null;

  const year = match[2]
    ? match[2].slice(-2)
    : new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "2-digit" }).format(now);
  return `${match[1].toUpperCase()}${year}`;
}
