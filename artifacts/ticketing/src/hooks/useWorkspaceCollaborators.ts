import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

type WorkspaceCollaborator = { id: number; isActive?: boolean | null };

export function isActiveWorkspaceCollaborator(
  collaborators: readonly WorkspaceCollaborator[] | undefined,
  collaboratorId: number,
) {
  return collaborators?.some(
    (collaborator) => collaborator.id === collaboratorId && collaborator.isActive !== false,
  ) ?? false;
}

export function resolveWorkspaceAssigneeId(
  collaborators: readonly WorkspaceCollaborator[] | undefined,
  selectedId: number | '',
): number | null | undefined {
  if (selectedId === '') return null;
  return isActiveWorkspaceCollaborator(collaborators, selectedId) ? selectedId : undefined;
}

export function useWorkspaceAssigneeSelection(
  workspaceId: number | null | undefined,
  enabled: boolean,
  collaboratorsLoaded: boolean,
  collaborators: readonly WorkspaceCollaborator[] | undefined,
  selectedId: number | '',
  setSelectedId: (id: number | '') => void,
) {
  const previousWorkspaceId = useRef(workspaceId);

  useEffect(() => {
    if (previousWorkspaceId.current === workspaceId) return;
    previousWorkspaceId.current = workspaceId;
    setSelectedId('');
  }, [workspaceId, setSelectedId]);

  useEffect(() => {
    if (!enabled || !collaboratorsLoaded || selectedId === '') return;
    if (!isActiveWorkspaceCollaborator(collaborators, selectedId)) setSelectedId('');
  }, [enabled, collaboratorsLoaded, collaborators, selectedId, setSelectedId]);
}

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
