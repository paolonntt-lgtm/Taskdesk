import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  states: [] as unknown[],
  hookIndex: 0,
  rows: [
    { ticketId: 501, ticketNumber: 81, title: 'Ticket A', date: '2026-10-14T09:00:00.000Z', durationMinutes: 30 },
    { ticketId: 501, ticketNumber: 81, title: 'Ticket A', date: '2026-10-15T09:00:00.000Z', durationMinutes: 60 },
    { ticketId: 502, ticketNumber: 82, title: 'Ticket B', date: '2026-10-15T10:00:00.000Z', durationMinutes: 15 },
  ],
  params: [] as any[],
  mode: 'success' as 'success' | 'loading' | 'error',
  location: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = store.hookIndex++;
      if (!(index in store.states)) store.states[index] = initial;
      return [
        store.states[index],
        (next: unknown) => {
          store.states[index] = typeof next === 'function'
            ? (next as (value: unknown) => unknown)(store.states[index])
            : next;
        },
      ];
    },
    useMemo: (factory: () => unknown) => factory(),
    useEffect: () => undefined,
  };
});

vi.mock('@workspace/api-client-react', () => ({
  getGetPersonalTimeTrackingReportQueryKey: (params: unknown) => ['/api/time-tracking/my-report', params],
  useGetPersonalTimeTrackingReport: (params: unknown) => {
    store.params.push(params);
    if (store.mode === 'loading') return { isLoading: true, isError: false, data: undefined, error: null };
    if (store.mode === 'error') return { isLoading: false, isError: true, data: undefined, error: new Error('network error') };

    const filters = params as { dateFrom?: string; dateTo?: string };
    const rows = store.rows.filter((row) => {
      const date = row.date.slice(0, 10);
      return (!filters.dateFrom || date >= filters.dateFrom)
        && (!filters.dateTo || date <= filters.dateTo);
    });
    return {
      isLoading: false,
      isError: false,
      error: null,
      data: {
        rows,
        totals: {
          totalMinutes: rows.reduce((total, row) => total + row.durationMinutes, 0),
          ticketCount: new Set(rows.map((row) => row.ticketId)).size,
        },
      },
    };
  },
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/my-time-report', store.location],
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 42, role: 'user' } }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ lang: 'it' }),
}));

import PersonalTimeTrackingReportPage from './PersonalTimeTrackingReport';

function renderPage() {
  store.hookIndex = 0;
  return PersonalTimeTrackingReportPage();
}

function findAllByTestId(node: unknown, testId: string): any[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAllByTestId(child, testId));
  if (typeof node !== 'object' || node === null) return [];
  const element = node as { props?: { 'data-testid'?: string; children?: unknown } };
  const match = element.props?.['data-testid'] === testId ? [element] : [];
  return [...match, ...findAllByTestId(element.props?.children, testId)];
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node !== 'object' || node === null) return '';
  return textContent((node as { props?: { children?: unknown } }).props?.children);
}

describe('PersonalTimeTrackingReportPage', () => {
  beforeEach(() => {
    store.states = [];
    store.hookIndex = 0;
    store.params = [];
    store.rows = [
      { ticketId: 501, ticketNumber: 81, title: 'Ticket A', date: '2026-10-14T09:00:00.000Z', durationMinutes: 30 },
      { ticketId: 501, ticketNumber: 81, title: 'Ticket A', date: '2026-10-15T09:00:00.000Z', durationMinutes: 60 },
      { ticketId: 502, ticketNumber: 82, title: 'Ticket B', date: '2026-10-15T10:00:00.000Z', durationMinutes: 15 },
    ];
    store.mode = 'success';
    store.location.mockClear();
  });

  it('groups rows by ticket, shows ticket subtotals, and keeps report totals consistent', () => {
    const page = renderPage();

    expect(textContent(findAllByTestId(page, 'personal-time-total')[0])).toBe('1 h 45 min');
    expect(textContent(findAllByTestId(page, 'personal-time-ticket-count')[0])).toBe('2');
    expect(findAllByTestId(page, 'personal-time-ticket-501')).toHaveLength(1);
    expect(findAllByTestId(page, 'personal-time-session-501-0')).toHaveLength(1);
    expect(findAllByTestId(page, 'personal-time-session-501-1')).toHaveLength(1);
    expect(textContent(findAllByTestId(page, 'personal-time-ticket-total-501')[0])).toBe('1 h 30 min');
    expect(textContent(findAllByTestId(page, 'personal-time-ticket-total-502')[0])).toBe('15 min');
  });

  it('passes the selected date range to the report and updates rows and totals', () => {
    const initialPage = renderPage();
    const dateFrom = findAllByTestId(initialPage, 'personal-time-date-from')[0];
    const dateTo = findAllByTestId(initialPage, 'personal-time-date-to')[0];
    dateFrom.props.onChange({ target: { value: '2026-10-15' } });
    dateTo.props.onChange({ target: { value: '2026-10-15' } });

    const filteredPage = renderPage();

    expect(store.params.at(-1)).toEqual({ dateFrom: '2026-10-15', dateTo: '2026-10-15' });
    expect(textContent(findAllByTestId(filteredPage, 'personal-time-total')[0])).toBe('1 h 15 min');
    expect(textContent(findAllByTestId(filteredPage, 'personal-time-ticket-count')[0])).toBe('2');
    expect(textContent(findAllByTestId(filteredPage, 'personal-time-ticket-total-501')[0])).toBe('1 h');
    expect(findAllByTestId(filteredPage, 'personal-time-session-501-1')).toHaveLength(0);
  });

  it('shows loading, empty-period, and error states', () => {
    store.mode = 'loading';
    expect(findAllByTestId(renderPage(), 'personal-time-loading')).toHaveLength(1);

    store.mode = 'success';
    store.rows = [];
    const emptyPage = renderPage();
    expect(textContent(findAllByTestId(emptyPage, 'personal-time-empty')[0]))
      .toBe('Nessuna sessione riconosciuta in questo periodo.');
    expect(textContent(findAllByTestId(emptyPage, 'personal-time-total')[0])).toBe('0 min');
    expect(textContent(findAllByTestId(emptyPage, 'personal-time-ticket-count')[0])).toBe('0');

    store.mode = 'error';
    expect(findAllByTestId(renderPage(), 'personal-time-error')).toHaveLength(1);
  });
});
