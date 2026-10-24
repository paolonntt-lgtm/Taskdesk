export type CalendarItem = {
  type: "ticket" | "appointment";
  id: number;
  title: string;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isAllDay?: boolean;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
};

export const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Returns a Monday-first month grid padded to complete weeks with null blank cells. */
export const getMonthGridDays = (year: number, monthNumber: number): (number | null)[] => {
  const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day < 1 || day > daysInMonth ? null : day;
  });
};

export const groupCalendarItemsByDate = (items: CalendarItem[]) => {
  const result = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = result.get(item.date) ?? [];
    list.push(item);
    result.set(item.date, list);
  }
  return result;
};

export const getCalendarDayMarkers = (items: CalendarItem[]) => ({
  hasTickets: items.some((item) => item.type === "ticket"),
  hasAppointments: items.some((item) => item.type === "appointment"),
});

const itemTime = (item: CalendarItem) =>
  new Date(item.startsAt || `${item.date}T00:00:00`).getTime();

export const getItemsForDate = (
  itemsByDate: Map<string, CalendarItem[]>,
  selectedDate: string,
) => [...(itemsByDate.get(selectedDate) ?? [])].sort((a, b) => itemTime(a) - itemTime(b));

export const getMonthSelection = (currentMonth: Date, offset: number) => {
  const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
  return { month, selectedDate: dateKey(month) };
};
