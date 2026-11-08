export type GymAccessPeriod = "today" | "yesterday" | "last7" | "lastMonth";

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
