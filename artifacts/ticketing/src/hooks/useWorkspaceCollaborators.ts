import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';

export function useWorkspaceCollaborators(workspaceId: number | null | undefined) {
  return useListUsers({
    query: { queryKey: [...getListUsersQueryKey(), workspaceId] } as any,
    request: { cache: 'no-store' },
  });
}
