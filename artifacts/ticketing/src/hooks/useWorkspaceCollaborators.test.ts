// @vitest-environment jsdom
import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceCollaborators } from './useWorkspaceCollaborators';

vi.mock('@workspace/api-client-react', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  return {
    getListUsersQueryKey: () => ['/api/users'],
    useListUsers: (options: any) => useQuery({
      ...options.query,
      queryFn: async () => {
        const response = await fetch('/api/users', options.request);
        return response.json();
      },
    }),
  };
});

function CollaboratorOptions({ workspaceId }: { workspaceId: number }) {
  const { data } = useWorkspaceCollaborators(workspaceId);
  return React.createElement('div', null, JSON.stringify(data ?? []));
}

describe('useWorkspaceCollaborators', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const waitForText = async (text: string) => {
    await vi.waitFor(async () => {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(host.textContent).toContain(text);
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    vi.unstubAllGlobals();
    host.remove();
  });

  it('refreshes an open collaborator list when workspace data is reset', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Admin' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 1, name: 'Admin' },
        { id: 2, name: 'New collaborator' },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(CollaboratorOptions, { workspaceId: 81 }),
        ),
      );
    });
    await waitForText('Admin');
    expect(host.textContent).toContain('Admin');
    expect(host.textContent).not.toContain('New collaborator');

    await act(async () => {
      await queryClient.resetQueries();
    });
    await waitForText('New collaborator');
    expect(host.textContent).toContain('New collaborator');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('keeps collaborator results separate when switching back to a previous workspace', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Space 81 collaborator' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2, name: 'Space 82 collaborator' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, name: 'Updated space 81 collaborator' }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const renderWorkspace = async (workspaceId: number) => {
      await act(async () => {
        root.render(
          React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(CollaboratorOptions, { workspaceId }),
          ),
        );
      });
    };

    await renderWorkspace(81);
    await waitForText('Space 81 collaborator');
    await renderWorkspace(82);
    await waitForText('Space 82 collaborator');
    expect(host.textContent).not.toContain('Space 81 collaborator');

    await renderWorkspace(81);
    await waitForText('Updated space 81 collaborator');
    expect(host.textContent).not.toContain('Space 82 collaborator');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
