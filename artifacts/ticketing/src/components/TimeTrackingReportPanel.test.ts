import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  invalidateQueries: vi.fn(() => Promise.resolve()),
  billingArgs: null as any,
  billingOptions: null as any,
  invoiceArgs: null as any,
  invoiceOptions: null as any,
  trackEvent: vi.fn(),
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
  collaboratorRow: {
    kind: 'session',
    ticketId: 315,
    ticketNumber: 29,
    title: 'Rendiconto collaboratore',
    date: '2026-10-14T11:00:00.000Z',
    durationMinutes: 45,
    clientId: 7,
    clientName: 'Cliente prova',
    collaboratorId: 22,
    collaboratorInvoiceReceived: false,
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
      collaboratorRows: [store.collaboratorRow],
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
    mutate: (args: unknown, options: unknown) => {
      store.invoiceArgs = args;
      store.invoiceOptions = options;
    },
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

vi.mock('../lib/analytics', () => ({
  trackEvent: store.trackEvent,
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

function findAllElementsByType(node: unknown, typeName: string): any[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAllElementsByType(child, typeName));
  if (typeof node !== 'object' || node === null) return [];
  const element = node as { type?: { name?: string }; props?: { children?: unknown } };
  const match = element.type?.name === typeName ? [element] : [];
  return [...match, ...findAllElementsByType(element.props?.children, typeName)];
}

function findElementByInputTestId(node: unknown, testId: string): any | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByInputTestId(child, testId);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null) return undefined;
  const element = node as { props?: { inputProps?: { 'data-testid'?: string }; children?: unknown } };
  if (element.props?.inputProps?.['data-testid'] === testId) return node;
  return findElementByInputTestId(element.props?.children, testId);
}

describe('TimeTrackingReportPanel billing updates', () => {
  beforeEach(() => {
    store.invalidateQueries.mockClear();
    store.billingArgs = null;
    store.billingOptions = null;
    store.invoiceArgs = null;
    store.invoiceOptions = null;
    store.trackEvent.mockClear();
  });

  it('refreshes report, customer detail, and customer lists after billing changes', async () => {
    const reportRows = findElementByType(TimeTrackingReportPanel(), 'ReportRows');
    expect(reportRows).toBeDefined();

    reportRows.props.onToggleBilling(store.row);

    expect(store.billingArgs).toEqual({
      data: { ticketId: 314, status: 'billed' },
    });
    await store.billingOptions.onSuccess();

    expect(store.trackEvent).toHaveBeenCalledWith('time_billing_status_changed', {
      status: 'billed',
      source: 'time_tracking_report',
    });
    expect(store.invalidateQueries).toHaveBeenCalledTimes(3);
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/time-tracking/report'] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients'] });
    expect(store.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/clients/7'] });
  });

  it('tracks collaborator invoice status changes only after the update succeeds', async () => {
    const reportRows = findAllElementsByType(TimeTrackingReportPanel(), 'ReportRows');
    reportRows[1].props.onToggleInvoice(store.collaboratorRow);

    expect(store.invoiceArgs).toEqual({
      data: { ticketId: 315, collaboratorId: 22, invoiceReceived: true },
    });
    expect(store.trackEvent).not.toHaveBeenCalled();
    await store.invoiceOptions.onSuccess();
    expect(store.trackEvent).toHaveBeenCalledWith('collaborator_invoice_status_changed', {
      received: true,
      source: 'time_tracking_report',
    });
  });

  it('tracks date filter interaction without sending the selected dates', () => {
    const panel = TimeTrackingReportPanel();
    const dateFrom = findElementByInputTestId(panel, 'input-report-date-from');
    const dateTo = findElementByInputTestId(panel, 'input-report-date-to');
    dateFrom.props.onChange({ target: { value: '2026-10-14' } });
    dateTo.props.onChange({ target: { value: '2026-10-15' } });

    expect(store.trackEvent).toHaveBeenCalledWith('time_report_filter_changed', {
      scope: 'admin',
      field: 'date_from',
    });
    expect(store.trackEvent).toHaveBeenCalledWith('time_report_filter_changed', {
      scope: 'admin',
      field: 'date_to',
    });
  });
});
