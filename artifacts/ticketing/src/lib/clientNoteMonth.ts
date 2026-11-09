export function clientNoteMonthKeyFromDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not determine client note month");
  return `${year}-${month}`;
}

export function getClientNoteMonthKey(
  monthOverride: string | null | undefined,
  createdAt: string | Date,
): string {
  return monthOverride ?? clientNoteMonthKeyFromDate(createdAt);
}
