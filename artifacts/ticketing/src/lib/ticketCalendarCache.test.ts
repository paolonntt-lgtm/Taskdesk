import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invalidateTicketCalendarCache } from './ticketCalendarCache';

describe('ticket calendar cache', () => {
  let queryClient: QueryClient | undefined;

  afterEach(() => {
    queryClient?.clear();
    queryClient = undefined;
  });

  it('refreshes cached events after a ticket status change', async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const queryKey = ['/api/calendar', 2026, 10] as const;
    const updatedEvents = [
      {
        type: 'ticket',
        id: 42,
        status: 'resolved',
        priority: 'high',
        assignee: { id: 7, name: 'New assignee' },
      },
    ];
    queryClient.setQueryData(queryKey, [
      {
        type: 'ticket',
        id: 42,
        status: 'open',
        priority: 'low',
        assignee: { id: 3, name: 'Old assignee' },
      },
    ]);
    await invalidateTicketCalendarCache(queryClient);
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);

    const queryFn = vi.fn().mockResolvedValue(updatedEvents);
    const observer = new QueryObserver(queryClient, { queryKey, queryFn });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(queryKey)).toEqual(updatedEvents);
    });

    expect(queryFn).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
