// @vitest-environment jsdom
import { focusManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarItem } from "./calendar";
import {
  getMobileCalendarQueryOptions,
  MOBILE_CALENDAR_REFETCH_INTERVAL,
} from "./calendarRefresh";

const mocks = vi.hoisted(() => ({
  calendarData: [] as CalendarItem[],
  apiGet: vi.fn(),
}));

vi.mock("@/utils/api", () => ({ apiGet: mocks.apiGet }));

describe("mobile calendar refresh", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    mocks.calendarData = [{
      type: "ticket",
      id: 1,
      title: "Ticket before another session edit",
      date: "2026-11-21",
    }];
    mocks.apiGet.mockReset().mockImplementation(async () => mocks.calendarData);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it("polls remote ticket changes while active and pauses in background", async () => {
    const queryOptions = getMobileCalendarQueryOptions(2026, 11, "active");
    const observer = new QueryObserver(queryClient, queryOptions);
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await observer.refetch();
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual([
        expect.objectContaining({ title: "Ticket before another session edit" }),
      ]);
      expect(mocks.apiGet).toHaveBeenCalledTimes(1);
      expect(queryOptions.refetchInterval).toBe(MOBILE_CALENDAR_REFETCH_INTERVAL);
      expect(queryOptions.refetchIntervalInBackground).toBe(false);
      mocks.calendarData = [{
        type: "ticket",
        id: 1,
        title: "Ticket changed in another session",
        date: "2026-11-21",
      }];
      await vi.advanceTimersByTimeAsync(MOBILE_CALENDAR_REFETCH_INTERVAL);
      expect(mocks.apiGet).toHaveBeenCalledTimes(2);
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual([
        expect.objectContaining({ title: "Ticket changed in another session" }),
      ]);

      const backgroundOptions = getMobileCalendarQueryOptions(2026, 11, "background");
      observer.setOptions(backgroundOptions);
      expect(backgroundOptions.refetchInterval).toBe(false);
      mocks.calendarData = [{
        type: "ticket",
        id: 1,
        title: "Ticket changed while app was asleep",
        date: "2026-11-21",
      }];
      await vi.advanceTimersByTimeAsync(MOBILE_CALENDAR_REFETCH_INTERVAL * 2);
      expect(mocks.apiGet).toHaveBeenCalledTimes(2);
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual([
        expect.objectContaining({ title: "Ticket changed in another session" }),
      ]);

      observer.setOptions(getMobileCalendarQueryOptions(2026, 11, "active"));
      await observer.refetch();
      expect(mocks.apiGet).toHaveBeenCalledTimes(3);
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual([
        expect.objectContaining({ title: "Ticket changed while app was asleep" }),
      ]);
    } finally {
      unsubscribe();
    }
  });
});
