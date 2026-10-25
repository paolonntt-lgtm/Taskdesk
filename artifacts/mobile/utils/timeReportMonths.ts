export type MonthOption = { value: string; label: string; dateFrom: string; dateTo: string };

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthRange(value: string): { dateFrom: string; dateTo: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    dateFrom: formatDate(new Date(year, month - 1, 1)),
    dateTo: formatDate(new Date(year, month, 0)),
  };
}

export function getRecentMonthOptions(
  count: number,
  now: Date,
  locale: string,
): MonthOption[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const range = getMonthRange(value)!;
    return {
      value,
      label: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date),
      ...range,
    };
  });
}
