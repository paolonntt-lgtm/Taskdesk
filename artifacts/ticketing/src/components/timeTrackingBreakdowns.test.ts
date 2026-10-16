import { describe, expect, it } from 'vitest';
import { buildTimeTrackingBreakdowns } from './timeTrackingBreakdowns';

describe('buildTimeTrackingBreakdowns', () => {
  it('groups filtered report rows by client, collaborator, ticket, and exact server month totals', () => {
    const customerRows = [
      {
        kind: 'session' as const, ticketId: 1, ticketNumber: 10, title: 'Ticket A',
        date: '2026-10-02T10:00:00.000Z', durationMinutes: 120,
        clientId: 5, clientName: 'Cliente A', collaboratorId: null, collaboratorName: null,
        billingStatus: 'billed' as const, collaboratorInvoiceReceived: null,
      },
      {
        kind: 'manual' as const, ticketId: 2, ticketNumber: 11, title: 'Ticket B',
        date: '2026-10-04T10:00:00.000Z', durationMinutes: 60,
        clientId: 5, clientName: 'Cliente A', collaboratorId: null, collaboratorName: null,
        billingStatus: 'unbilled' as const, collaboratorInvoiceReceived: null,
      },
    ];
    const collaboratorRows = [
      {
        kind: 'session' as const, ticketId: 1, ticketNumber: 10, title: 'Ticket A',
        date: '2026-10-02T10:00:00.000Z', durationMinutes: 90,
        clientId: 5, clientName: 'Cliente A', collaboratorId: 7, collaboratorName: 'Ada',
        billingStatus: 'billed' as const, collaboratorInvoiceReceived: true,
      },
    ];
    const monthlyTotals = [
      {
        month: '2026-10', clientBillableMinutes: 180, clientBilledMinutes: 120,
        clientUnbilledMinutes: 60, collaboratorRecognizableMinutes: 90,
      },
    ];

    const result = buildTimeTrackingBreakdowns(customerRows, collaboratorRows, monthlyTotals);

    expect(result.client).toHaveLength(1);
    expect(result.client[0]).toMatchObject({
      label: 'Cliente A',
      clientBillableMinutes: 180,
      clientBilledMinutes: 120,
      clientUnbilledMinutes: 60,
      collaboratorRecognizableMinutes: 90,
    });
    expect(result.collaborator).toEqual([expect.objectContaining({
      label: 'Ada',
      collaboratorRecognizableMinutes: 90,
    })]);
    expect(result.ticket.find((row) => row.key === '1')).toMatchObject({
      clientBillableMinutes: 120,
      collaboratorRecognizableMinutes: 90,
    });
    expect(result.month[0]).toMatchObject({
      key: '2026-10',
      clientBillableMinutes: 180,
      collaboratorRecognizableMinutes: 90,
    });
  });
});
