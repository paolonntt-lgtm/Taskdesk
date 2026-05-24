import { useQuery } from '@tanstack/react-query';

export interface TicketStatus {
  id: number;
  organizationId: number;
  key: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  isClosed: boolean;
  createdAt: string;
}

async function fetchTicketStatuses(): Promise<TicketStatus[]> {
  const res = await fetch('/api/settings/ticket-statuses', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export function useTicketStatuses() {
  const { data: statuses = [], isLoading } = useQuery<TicketStatus[]>({
    queryKey: ['ticket-statuses'],
    queryFn: fetchTicketStatuses,
    staleTime: 5 * 60_000,
  });

  function getLabelForKey(key: string): string {
    const found = statuses.find((s) => s.key === key);
    return found?.label ?? key;
  }

  function getColorForKey(key: string): string | null {
    const found = statuses.find((s) => s.key === key);
    return found?.color ?? null;
  }

  function isClosedKey(key: string): boolean {
    const found = statuses.find((s) => s.key === key);
    return found?.isClosed ?? (key === 'closed' || key === 'resolved');
  }

  return { statuses, isLoading, getLabelForKey, getColorForKey, isClosedKey };
}
