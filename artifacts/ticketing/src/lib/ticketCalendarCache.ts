import type { QueryClient } from '@tanstack/react-query';

export function invalidateTicketCalendarCache(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
) {
  return queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
}
