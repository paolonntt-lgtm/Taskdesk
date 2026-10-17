// @vitest-environment jsdom
import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReferralApplicationStatus from './ReferralApplicationStatus';

const messages = {
  appliedTitle: 'Referral invitation applied',
  appliedMessage: 'The invitation is linked to your organization.',
  notAppliedTitle: 'Referral invitation not linked',
  notAppliedMessage: 'No invitation is linked to your organization.',
};

describe('ReferralApplicationStatus', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const renderStatus = async () => {
    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(ReferralApplicationStatus, {
            enabled: true,
            organizationId: 22,
            messages,
          }),
        ),
      );
    });
  };

  const waitForRequest = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
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
    vi.useRealTimers();
    host.remove();
  });

  it('renders the persisted server state again after a dashboard reload without exposing referrer details', async () => {
    const serverStates = [
      { applied: true, attempted: true },
      { applied: false, attempted: true },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...serverStates.shift(),
        referrerEmail: 'referrer.private@example.test',
        referrerName: 'Private Referrer',
        referrerOrganization: 'Private Referrer Organization',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await renderStatus();
    await waitForRequest();
    expect(host.querySelector('[data-testid="title-referral-application"]')?.textContent)
      .toBe(messages.appliedTitle);
    expect(host.querySelector('[data-testid="message-referral-application"]')?.textContent)
      .toBe(messages.appliedMessage);
    expect(host.textContent).not.toContain('referrer.private@example.test');
    expect(host.textContent).not.toContain('Private Referrer');

    await act(async () => root.unmount());
    root = createRoot(host);
    await renderStatus();
    await waitForRequest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/stripe/referrals/status',
      { credentials: 'include', cache: 'no-store' },
    );
    expect(host.querySelector('[data-testid="title-referral-application"]')?.textContent)
      .toBe(messages.notAppliedTitle);
    expect(host.querySelector('[data-testid="message-referral-application"]')?.textContent)
      .toBe(messages.notAppliedMessage);
    expect(host.textContent).not.toContain('referrer.private@example.test');
    expect(host.textContent).not.toContain('Private Referrer');
  });

  it('does not show a referral message when the server says no code was attempted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ applied: false, attempted: false }),
    })));

    await renderStatus();
    await waitForRequest();

    expect(host.querySelector('[data-testid="status-referral-application"]')).toBeNull();
  });

  it('refreshes the dashboard when a pending referral retry is applied', async () => {
    vi.useFakeTimers();
    const serverStates = [
      { applied: false, attempted: true, retryPending: true },
      { applied: true, attempted: true, retryPending: false },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => serverStates.shift(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await renderStatus();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(host.querySelector('[data-testid="title-referral-application"]')?.textContent)
      .toBe(messages.notAppliedTitle);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="title-referral-application"]')?.textContent)
        .toBe(messages.appliedTitle);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="message-referral-application"]')?.textContent)
      .toBe(messages.appliedMessage);
  });
});
