import type { AppStateStatus } from "react-native";
import { apiGet } from "@/utils/api";
import type { CalendarItem } from "./calendar";

export const MOBILE_CALENDAR_REFETCH_INTERVAL = 60_000;

export const getMobileCalendarQueryOptions = (
  year: number,
  month: number,
  appState: AppStateStatus,
) => ({
  queryKey: ["mobile-calendar", year, month],
  queryFn: () => apiGet<CalendarItem[]>(`/calendar?year=${year}&month=${month}`),
  refetchInterval: appState === "active" ? MOBILE_CALENDAR_REFETCH_INTERVAL : false as const,
  refetchIntervalInBackground: false as const,
});
