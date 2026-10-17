import type { QueryClient } from '@tanstack/react-query';

export function isTicketDataQuery(queryKey: readonly unknown[]): boolean {
  const path = queryKey[0];
  return path === '/api/tickets' ||
    (typeof path === 'string' && /^\/api\/tickets\/\d+$/.test(path));
}

export function invalidateTicketDataAfterClientRename(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isTicketDataQuery(query.queryKey),
  });
}
