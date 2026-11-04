import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export interface ClientNoteDeclarative {
  id: string;
  name: string;
  alias: string;
}

export const clientNoteDeclarativesQueryKey = (organizationId: number | null | undefined) =>
  ['client-note-declaratives', organizationId ?? null] as const;

async function fetchClientNoteDeclaratives(): Promise<ClientNoteDeclarative[]> {
  const response = await fetch('/api/client-note-declaratives', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load client note declaratives');
  const data = await response.json();
  return Array.isArray(data.declaratives) ? data.declaratives : [];
}

export function useClientNoteDeclaratives() {
  const { user } = useAuth();
  const organizationId = (user as any)?.organizationId as number | undefined;
  const queryKey = clientNoteDeclarativesQueryKey(organizationId);
  const query = useQuery({
    queryKey,
    queryFn: fetchClientNoteDeclaratives,
    staleTime: 60_000,
    enabled: organizationId != null,
  });
  return {
    declaratives: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    queryKey,
  };
}
