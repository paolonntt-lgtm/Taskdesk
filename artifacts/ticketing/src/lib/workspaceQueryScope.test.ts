import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { hashWorkspaceQueryKey, scopeWorkspaceQueryKey } from './workspaceQueryScope';

describe('hashWorkspaceQueryKey', () => {
  it('uses a separate cache key for each active workspace', () => {
    const requestKey = ['/api/users'] as const;

    expect(hashWorkspaceQueryKey(requestKey, 101))
      .not.toBe(hashWorkspaceQueryKey(requestKey, 202));
  });

  it('keeps the same cache key for the same workspace and request', () => {
    const requestKey = ['/api/users', { active: true }] as const;

    expect(hashWorkspaceQueryKey(requestKey, 101))
      .toBe(hashWorkspaceQueryKey(requestKey, 101));
  });

  it('does not duplicate an explicit workspace scope', () => {
    const requestKey = ['/api/users'] as const;
    const explicitlyScopedKey = scopeWorkspaceQueryKey(requestKey, 101);

    expect(hashWorkspaceQueryKey(explicitlyScopedKey, 101))
      .toBe(hashWorkspaceQueryKey(requestKey, 101));
  });

  it('keeps a late response in its original workspace cache', async () => {
    let activeWorkspaceId = 101;
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          queryKeyHashFn: (queryKey) => hashWorkspaceQueryKey(queryKey, activeWorkspaceId),
        },
      },
    });
    const requestKey = ['/api/users'] as const;
    let resolveOldResponse!: (users: string[]) => void;
    const oldResponse = client.fetchQuery({
      queryKey: requestKey,
      queryFn: () => new Promise<string[]>((resolve) => { resolveOldResponse = resolve; }),
    });

    activeWorkspaceId = 202;
    await client.fetchQuery({
      queryKey: requestKey,
      queryFn: async () => ['Workspace 202'],
    });
    resolveOldResponse(['Workspace 101']);
    await oldResponse;

    expect(client.getQueryData(requestKey)).toEqual(['Workspace 202']);
    activeWorkspaceId = 101;
    expect(client.getQueryData(requestKey)).toEqual(['Workspace 101']);
    client.clear();
  });
});
