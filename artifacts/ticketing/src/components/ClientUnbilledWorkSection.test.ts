import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  reportRows: [] as any[],
  mutationError: false,
  mutationArgs: null as any,
  invalidateQueries: vi.fn(() => Promise.resolve()),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useMemo: (factory: () => unknown) => factory() };
});

vi.mock('@workspace/api-client-react', () => ({
  getGetClientQueryKey: (clientId: number) => ['/api/clients', clientId],
  getGetTimeTrackingReportQueryKey: () => ['/api/time-tracking/report'],
  getListClientsQueryKey: () => ['/api/clients'],
  useGetTimeTrackingReport: () => ({
    data: { customerRows: store.reportRows },
    isLoading: false,
    isError: false,
  }),
  useUpdateTimeTrackingClientBillingStatus: () => ({
    mutate: (args: unknown, options: unknown) => {
      store.mutationArgs = { args, options };
    },
    isPending: false,
    isError: store.mutationError,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { timeTrackingModuleEnabled: true, workedTimeEnabled: true },
    isLoading: false,
    isError: false,
  }),
  useQueryClient: () => ({ invalidateQueries: store.invalidateQueries }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ lang: 'it' }),
}));

import React from 'react';
import ClientUnbilledWorkSection from './ClientUnbilledWorkSection';

const unbilledRow = {
  ticketId: 314,
  ticketNumber: 28,
  title: 'Verifica fatturazione',
  date: '2026-10-14T10:00:00.000Z',
  durationMinutes: 75,
  billingStatus: 'unbilled',
};

function findElementByTestId(node: unknown, testId: string): any | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByTestId(child, testId);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null) return undefined;

  const element = node as { props?: { children?: unknown; 'data-testid'?: string } };
  if (element.props?.['data-testid'] === testId) return element;
  return findElementByTestId(element.props?.children, testId);
}

function getText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (typeof node !== 'object' || node === null) return '';
  return getText((node as { props?: { children?: unknown } }).props?.children);
}

function renderSection() {
  return ClientUnbilledWorkSection({ clientId: 7, tickets: [], isAdmin: true });
}

describe('ClientUnbilledWorkSection billing updates', () => {
  beforeEach(() => {
    store.reportRows = [unbilledRow];
    store.mutationError = false;
    store.mutationArgs = null;
    store.invalidateQueries.mockClear();
  });

  afterEach(() => {
    store.reportRows = [];
  });

  it('refreshes the report, client detail, and filtered client lists after billing succeeds', async () => {
    const button = findElementByTestId(renderSection(), 'button-mark-client-ticket-billed-314');
    expect(button).toBeDefined();
    button.props.onClick();

    expect(store.mutationArgs.args).toEqual({ data: { ticketId: 314, status: 'billed' } });
    const options = store.mutationArgs.options as { onSuccess: () => Promise<unknown> };
    store.reportRows = [];
    await options.onSuccess();

    expect(store.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/time-tracking/report'] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients', 7] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients'] });

    const refreshed = renderSection();
    expect(findElementByTestId(refreshed, 'client-unbilled-work-ticket-314')).toBeUndefined();
    expect(getText(refreshed)).toContain('Nessuna ora da fatturare per questo cliente.');
  });

  it('keeps the ticket visible and explains the failure when billing does not save', () => {
    const beforeFailure = renderSection();
    findElementByTestId(beforeFailure, 'button-mark-client-ticket-billed-314').props.onClick();
    store.mutationError = true;

    const afterFailure = renderSection();
    expect(findElementByTestId(afterFailure, 'client-unbilled-work-ticket-314')).toBeDefined();
    expect(getText(afterFailure)).toContain('Impossibile aggiornare lo stato di fatturazione.');
    expect(store.invalidateQueries).not.toHaveBeenCalled();
  });
});
