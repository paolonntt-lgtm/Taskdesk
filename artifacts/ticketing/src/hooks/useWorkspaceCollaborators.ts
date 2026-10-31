import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';

export function useWorkspaceCollaborators(
  workspaceId: number | null | undefined,
  enabled = true,
) {
  return useListUsers({
    query: {
      queryKey: [...getListUsersQueryKey(), workspaceId],
      enabled: enabled && workspaceId != null,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: 'always',
    } as any,
    request: { cache: 'no-store' },
  });
}
