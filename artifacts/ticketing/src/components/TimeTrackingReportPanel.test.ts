import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  invalidateQueries: vi.fn(() => Promise.resolve()),
  billingArgs: null as any,
  billingOptions: null as any,
  row: {
    kind: 'session',
    ticketId: 314,
    ticketNumber: 28,
    title: 'Verifica fatturazione',
    date: '2026-10-14T10:00:00.000Z',
    durationMinutes: 75,
    clientId: 7,
    clientName: 'Cliente prova',
    billingStatus: 'unbilled',
    collaboratorInvoiceReceived: null,
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
    useState: (initial: unknown) => [initial, vi.fn()],
  };
});

vi.mock('@workspace/api-client-react', () => ({
  getGetClientQueryKey: (clientId: number) => [`/api/clients/${clientId}`],
  getGetTimeTrackingReportQueryKey: () => ['/api/time-tracking/report'],
  getListClientsQueryKey: () => ['/api/clients'],
  useGetTimeTrackingReport: () => ({
    data: {
      customerRows: [store.row],
      collaboratorRows: [],
      totals: {
        clientBillableMinutes: 75,
        clientUnbilledMinutes: 75,
        clientBilledMinutes: 0,
        collaboratorRecognizableMinutes: 0,
      },
    },
    isLoading: false,
    isError: false,
  }),
  useUpdateTimeTrackingClientBillingStatus: () => ({
    mutate: (args: unknown, options: unknown) => {
      store.billingArgs = args;
      store.billingOptions = options;
    },
    isPending: false,
    isError: false,
  }),
  useUpdateCollaboratorInvoiceStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: store.invalidateQueries }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ lang: 'it' }),
}));

import TimeTrackingReportPanel from './TimeTrackingReportPanel';

function findElementByType(node: unknown, typeName: string): any | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByType(child, typeName);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null) return undefined;

  const element = node as { type?: { name?: string }; props?: { children?: unknown } };
  if (element.type?.name === typeName) return element;
  return findElementByType(element.props?.children, typeName);
}

describe('TimeTrackingReportPanel billing updates', () => {
  beforeEach(() => {
    store.invalidateQueries.mockClear();
    store.billingArgs = null;
    store.billingOptions = null;
  });

  it('refreshes report, customer detail, and customer lists after billing changes', async () => {
    const reportRows = findElementByType(TimeTrackingReportPanel(), 'ReportRows');
    expect(reportRows).toBeDefined();

    reportRows.props.onToggleBilling(store.row);

    expect(store.billingArgs).toEqual({
      data: { ticketId: 314, status: 'billed' },
    });
    await store.billingOptions.onSuccess();

    expect(store.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/time-tracking/report'] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients'] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients/7'] });
  });
});
