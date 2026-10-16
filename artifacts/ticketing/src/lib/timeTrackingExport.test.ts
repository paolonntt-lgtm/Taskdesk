import { describe, expect, it } from 'vitest';
import { mapTimeTrackingExportRows, timeTrackingExportFileName, type TimeTrackingExportCopy } from './timeTrackingExport';

const copy: TimeTrackingExportCopy = {
  date: 'Date',
  client: 'Client',
  collaborator: 'Collaborator',
  ticket: 'Ticket',
  title: 'Title',
  source: 'Source',
  durationMinutes: 'Minutes',
  durationHours: 'Hours',
  billingStatus: 'Billing status',
  invoiceStatus: 'Invoice status',
  session: 'Timer session',
  manual: 'Manual entry',
  billed: 'Billed',
  unbilled: 'Unbilled',
  received: 'Received',
  pending: 'Pending',
};

const reportRow = {
  kind: 'session' as const,
  ticketId: 51,
  ticketNumber: 805,
  title: 'Annual filing',
  date: '2026-10-14T00:00:00.000Z',
  durationMinutes: 90,
  clientId: 7,
  clientName: 'Example Client',
  collaboratorId: 22,
  collaboratorName: 'Ada',
  billingStatus: 'unbilled' as const,
  collaboratorInvoiceReceived: false,
};

describe('time-tracking Excel export rows', () => {
  it('maps customer-billable rows with client and billing details', () => {
    const [row] = mapTimeTrackingExportRows([reportRow], 'customer', copy);
    expect(row).toMatchObject({
      Ticket: '#805',
      Client: 'Example Client',
      Collaborator: 'Ada',
      Minutes: 90,
      Hours: 1.5,
      'Billing status': 'Unbilled',
    });
    expect(row.Date).toBeInstanceOf(Date);
  });

  it('maps collaborator rows with invoice status in a separate export shape', () => {
    const [row] = mapTimeTrackingExportRows([reportRow], 'collaborator', copy);
    expect(row).toMatchObject({
      Collaborator: 'Ada',
      Client: 'Example Client',
      'Invoice status': 'Pending',
    });
    expect(row).not.toHaveProperty('Billing status');
  });

  it('creates a distinct dated filename for each report', () => {
    const date = new Date(2026, 9, 16);
    expect(timeTrackingExportFileName('customer', date, 'it')).toBe('ore-fatturabili-clienti_2026-10-16.xlsx');
    expect(timeTrackingExportFileName('collaborator', date, 'it')).toBe('ore-riconoscibili-collaboratori_2026-10-16.xlsx');
  });
});
