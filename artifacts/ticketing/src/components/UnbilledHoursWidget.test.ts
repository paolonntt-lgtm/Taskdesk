import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  report: {
    data: {
      customerRows: [
        { ticketId: 10, billingStatus: 'unbilled', durationMinutes: 105 },
        { ticketId: 11, billingStatus: 'billed', durationMinutes: 240 },
      ],
    } as any,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  queryOptions: null as any,
}));

vi.mock('@workspace/api-client-react', () => ({
  getGetTimeTrackingReportQueryKey: () => ['/api/time-tracking/report'],
  useGetTimeTrackingReport: (_params: unknown, options: unknown) => {
    store.queryOptions = options;
    return store.report;
  },
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'it',
    t: {
      dashboard: {
        widgetUnbilled: 'Da fatturare',
        widgetUnbilledLoading: 'Caricamento ore da fatturare…',
        widgetUnbilledError: 'Impossibile caricare le ore da fatturare.',
        widgetUnbilledRetry: 'Riprova',
        widgetUnbilledEmpty: 'Non ci sono ore da fatturare.',
        widgetUnbilledMinutes: 'Ore non segnate come fatturate',
        widgetUnbilledTicketCount: (count: number) => `${count} ${count === 1 ? 'ticket' : 'ticket distinti'}`,
        widgetUnbilledLink: 'Apri Rendiconto ore',
      },
    },
  }),
}));

import UnbilledHoursWidget from './UnbilledHoursWidget';

function findByTestId(node: unknown, testId: string): any | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, testId);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object' || node === null) return undefined;
  const element = node as { props?: { 'data-testid'?: string; children?: unknown } };
  if (element.props?.['data-testid'] === testId) return element;
  return findByTestId(element.props?.children, testId);
}

describe('UnbilledHoursWidget', () => {
  beforeEach(() => {
    store.report = {
      data: {
        customerRows: [
          { ticketId: 10, billingStatus: 'unbilled', durationMinutes: 105 },
          { ticketId: 11, billingStatus: 'billed', durationMinutes: 240 },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    store.queryOptions = null;
  });

  it('shows unbilled time, distinct tickets, and links to the time report', () => {
    const widget = UnbilledHoursWidget();
    expect(findByTestId(widget, 'unbilled-total')).toBeDefined();
    expect(findByTestId(widget, 'unbilled-total').props.children).toBe('1 ora e 45 min');
    expect(findByTestId(widget, 'unbilled-ticket-count').props.children).toBe('1 ticket');
    expect(findByTestId(widget, 'unbilled-report-link').props.href).toBe('/time-report');
    expect(store.queryOptions.query.refetchInterval).toBe(60_000);
  });

  it('shows loading, error, and empty states', () => {
    store.report.isLoading = true;
    expect(findByTestId(UnbilledHoursWidget(), 'unbilled-loading')).toBeDefined();

    store.report.isLoading = false;
    store.report.isError = true;
    expect(findByTestId(UnbilledHoursWidget(), 'unbilled-error')).toBeDefined();

    store.report.isError = false;
    store.report.data.customerRows = [];
    expect(findByTestId(UnbilledHoursWidget(), 'unbilled-empty').props.children).toBe('Non ci sono ore da fatturare.');
  });
});
