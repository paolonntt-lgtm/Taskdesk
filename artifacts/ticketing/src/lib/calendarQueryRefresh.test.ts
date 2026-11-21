// @vitest-environment jsdom
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_QUERY_REFRESH_OPTIONS } from './calendarQueryRefresh';

describe('calendar query refresh', () => {
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    queryClient?.clear();
    queryClient = undefined;
    vi.useRealTimers();
  });

  it('shows changes from another session in an open calendar on the next poll', async () => {
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const queryKey = ['/api/calendar', 2026, 10] as const;
    const oldEvents = [
      { type: 'ticket', id: 42, priority: 'low', assignee: { id: 3, name: 'Old assignee' } },
    ];
    const updatedEvents = [
      { type: 'ticket', id: 42, priority: 'urgent', assignee: { id: 7, name: 'New assignee' } },
    ];
    let serverEvents = oldEvents;
    queryClient.setQueryData(queryKey, oldEvents);
    const queryFn = vi.fn(async () => serverEvents);
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn,
      staleTime: Infinity,
      ...CALENDAR_QUERY_REFRESH_OPTIONS,
    });
    const unsubscribe = observer.subscribe(() => {});

    // A different session changes the shared server state while this calendar stays open.
    serverEvents = updatedEvents;
    await vi.advanceTimersByTimeAsync(CALENDAR_QUERY_REFRESH_OPTIONS.refetchInterval);

    expect(queryFn).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(queryKey)).toEqual(updatedEvents);
    unsubscribe();
  });

  it('does not poll while the browser is in the background', () => {
    expect(CALENDAR_QUERY_REFRESH_OPTIONS.refetchIntervalInBackground).toBe(false);
  });
});
