import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useWorkspaceCollaborators(
  workspaceId: number | null | undefined,
  enabled = true,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (workspaceId == null || typeof window === 'undefined') return;
    const onWorkspaceMembersChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: number }>).detail;
      if (detail?.workspaceId !== workspaceId) return;
      void queryClient.invalidateQueries({
        queryKey: [...getListUsersQueryKey(), workspaceId],
      });
    };
    window.addEventListener('workspace-members-changed', onWorkspaceMembersChanged);
    return () => window.removeEventListener('workspace-members-changed', onWorkspaceMembersChanged);
  }, [queryClient, workspaceId]);

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
