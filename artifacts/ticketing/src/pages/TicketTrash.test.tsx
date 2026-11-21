// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ lang: 'it' }),
}));

import TicketTrash from './TicketTrash';

describe('ticket trash calendar refresh', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let invalidateQueries: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(['ticket-trash'], [{
      id: 42,
      ticketNumber: 42,
      title: 'Restorable ticket',
      category: 'Support',
      status: 'open',
      priority: 'medium',
      createdAt: '2026-01-01T10:00:00.000Z',
      deletedAt: '2026-01-02T10:00:00.000Z',
    }]);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/tickets/trash') {
        return {
          ok: true,
          json: async () => [{
            id: 42,
            ticketNumber: 42,
            title: 'Restorable ticket',
            category: 'Support',
            status: 'open',
            priority: 'medium',
            createdAt: '2026-01-01T10:00:00.000Z',
            deletedAt: '2026-01-02T10:00:00.000Z',
          }],
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      buttonLabel: 'Ripristina',
      endpoint: '/api/tickets/42/restore',
      method: 'POST',
    },
    {
      buttonLabel: 'Elimina definitivamente',
      endpoint: '/api/tickets/42/permanent',
      method: 'DELETE',
    },
  ])('refreshes the calendar after $buttonLabel', async ({ buttonLabel, endpoint, method }) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TicketTrash />
        </QueryClientProvider>,
      );
    });

    const actionButton = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${buttonLabel}"]`,
    );
    expect(actionButton).toBeDefined();

    await act(async () => {
      actionButton!.click();
    });

    const confirmButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === buttonLabel);
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ method }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['/api/calendar'] }),
    );
  });
});
