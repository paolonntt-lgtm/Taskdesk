import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  reportRows: [] as any[],
  collaboratorRows: [] as any[],
  reportCalls: [] as any[],
  settings: { timeTrackingModuleEnabled: true, workedTimeEnabled: true } as Record<string, boolean>,
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
  useGetTimeTrackingReport: (params: unknown, options: unknown) => {
    store.reportCalls.push({ params, options });
    return {
      data: { customerRows: store.reportRows, collaboratorRows: store.collaboratorRows },
      isLoading: false,
      isError: false,
    };
  },
  useUpdateTimeTrackingClientBillingStatus: () => ({
    mutate: (args: unknown, options: unknown) => {
      store.mutationArgs = { args, options };
    },
    isPending: false,
    isError: store.mutationError,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (_options: unknown) => ({
    data: store.settings,
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
  clientId: 7,
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

function renderSection({
  clientId = 7,
  tickets = [],
  isAdmin = true,
}: {
  clientId?: number;
  tickets?: any[];
  isAdmin?: boolean;
} = {}) {
  return ClientUnbilledWorkSection({ clientId, tickets, isAdmin });
}

describe('ClientUnbilledWorkSection billing updates', () => {
  beforeEach(() => {
    store.reportRows = [unbilledRow];
    store.collaboratorRows = [];
    store.reportCalls = [];
    store.settings = { timeTrackingModuleEnabled: true, workedTimeEnabled: true };
    store.mutationError = false;
    store.mutationArgs = null;
    store.invalidateQueries.mockClear();
  });

  afterEach(() => {
    store.reportRows = [];
    store.collaboratorRows = [];
  });

  it('aggregates timer and manual customer-billable rows by ticket, excluding billed, foreign-client, and collaborator-only rows', () => {
    store.reportRows = [
      { ...unbilledRow, durationMinutes: 75 },
      { ...unbilledRow, kind: 'manual', durationMinutes: 30, date: '2026-10-13T10:00:00.000Z' },
      { ...unbilledRow, ticketId: 315, billingStatus: 'billed', durationMinutes: 60 },
      { ...unbilledRow, ticketId: 316, clientId: 8, durationMinutes: 90 },
    ];
    store.collaboratorRows = [
      { ...unbilledRow, ticketId: 317, durationMinutes: 120, clientId: 7 },
    ];

    const section = renderSection();

    expect(findElementByTestId(section, 'client-unbilled-work-ticket-314')).toBeDefined();
    expect(findElementByTestId(section, 'client-unbilled-work-ticket-315')).toBeUndefined();
    expect(findElementByTestId(section, 'client-unbilled-work-ticket-316')).toBeUndefined();
    expect(findElementByTestId(section, 'client-unbilled-work-ticket-317')).toBeUndefined();
    expect(getText(findElementByTestId(section, 'client-unbilled-work-ticket-314'))).toContain('1 h 45 min');
    expect(findElementByTestId(section, 'client-unbilled-work-total').props.label).toBe('1 h 45 min');
    expect(store.reportCalls[0].params).toEqual({ clientId: 7 });
  });

  it('falls back to unbilled manual ticket hours when timer tracking is disabled', () => {
    store.settings = { timeTrackingModuleEnabled: false, workedTimeEnabled: true };
    const section = renderSection({
      tickets: [
        { id: 401, ticketNumber: 41, title: 'Ore manuali', closedAt: '2026-10-14T10:00:00.000Z', workedMinutes: 95, workedBillingStatus: 'unbilled' },
        { id: 402, ticketNumber: 42, title: 'Già fatturato', closedAt: '2026-10-14T10:00:00.000Z', workedMinutes: 40, workedBillingStatus: 'billed' },
        { id: 403, ticketNumber: 43, title: 'Non chiuso', workedMinutes: 25, workedBillingStatus: 'unbilled' },
      ],
    });

    expect(findElementByTestId(section, 'client-unbilled-work-ticket-401')).toBeDefined();
    expect(findElementByTestId(section, 'client-unbilled-work-ticket-402')).toBeUndefined();
    expect(findElementByTestId(section, 'client-unbilled-work-ticket-403')).toBeUndefined();
    expect(findElementByTestId(section, 'client-unbilled-work-total').props.label).toBe('1 h 35 min');
    expect(store.reportCalls[0].options).toMatchObject({ query: { enabled: false } });
  });

  it('renders nothing and disables billing-data queries for non-admin users', () => {
    const section = renderSection({ isAdmin: false });

    expect(section).toBeNull();
    expect(store.reportCalls[0].options).toMatchObject({ query: { enabled: false } });
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
