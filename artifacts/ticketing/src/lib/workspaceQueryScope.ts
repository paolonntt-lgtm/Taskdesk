import { hashKey, type QueryKey } from '@tanstack/react-query';

export function scopeWorkspaceQueryKey(
  queryKey: QueryKey,
  workspaceId: number | null | undefined,
): QueryKey {
  const normalizedWorkspaceId = workspaceId ?? null;
  const alreadyScoped = queryKey.length >= 2
    && queryKey[queryKey.length - 2] === 'workspace'
    && queryKey[queryKey.length - 1] === normalizedWorkspaceId;
  return alreadyScoped ? queryKey : [...queryKey, 'workspace', normalizedWorkspaceId];
}

export function hashWorkspaceQueryKey(
  queryKey: QueryKey,
  workspaceId: number | null,
): string {
  return hashKey(scopeWorkspaceQueryKey(queryKey, workspaceId));
}
