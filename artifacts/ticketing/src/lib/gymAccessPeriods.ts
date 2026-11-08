export type GymAccessPeriod = "today" | "yesterday" | "last7" | "lastMonth";

const MAX_RANGE_MS = 32 * 24 * 60 * 60 * 1000;

export function getGymAccessDateRange(
  fromDate: string,
  toDate: string,
): { from: string; to: string } | null {
  if (!fromDate || !toDate) return null;

  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const from = new Date(fromYear, fromMonth - 1, fromDay);
  const to = new Date(toYear, toMonth - 1, toDay + 1);
  const duration = to.getTime() - from.getTime();

  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    getLocalDateInputValue(from) !== fromDate ||
    getLocalDateInputValue(new Date(toYear, toMonth - 1, toDay)) !== toDate ||
    duration <= 0 ||
    duration > MAX_RANGE_MS
  ) {
    return null;
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

export function getLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getGymAccessPeriodRange(
  period: GymAccessPeriod,
  now = new Date(),
): { from: string; to: string } {
  const end = new Date(now);
  let start: Date;

  if (period === "lastMonth") {
    start = new Date(now);
    const previousMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    start.setDate(Math.min(now.getDate(), previousMonthLastDay));
    start.setMonth(now.getMonth() - 1);
  } else {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "today") {
      start = todayStart;
      end.setTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime());
    } else if (period === "yesterday") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end.setTime(todayStart.getTime());
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      end.setTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime());
    }
  }

  return { from: start.toISOString(), to: end.toISOString() };
}
