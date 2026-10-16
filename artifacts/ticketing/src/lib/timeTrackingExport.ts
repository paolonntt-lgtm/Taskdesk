import type { TimeTrackingReportRow } from '@workspace/api-client-react';

export type TimeTrackingExportKind = 'customer' | 'collaborator';
export type TimeTrackingExportLanguage = 'it' | 'en';

export interface TimeTrackingExportCopy {
  date: string;
  client: string;
  collaborator: string;
  ticket: string;
  title: string;
  source: string;
  durationMinutes: string;
  durationHours: string;
  billingStatus: string;
  invoiceStatus: string;
  session: string;
  manual: string;
  billed: string;
  unbilled: string;
  received: string;
  pending: string;
}

export function mapTimeTrackingExportRows(
  rows: TimeTrackingReportRow[],
  kind: TimeTrackingExportKind,
  copy: TimeTrackingExportCopy,
) {
  return rows.map((row) => {
    const dateParts = row.date.slice(0, 10).split('-').map(Number);
    const date = dateParts.length === 3 && dateParts.every(Number.isFinite)
      ? new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
      : row.date;
    const common = {
      [copy.date]: date,
      [copy.ticket]: row.ticketNumber != null ? `#${row.ticketNumber}` : `#${row.ticketId}`,
      [copy.title]: row.title,
      [copy.source]: row.kind === 'manual' ? copy.manual : copy.session,
      [copy.durationMinutes]: row.durationMinutes,
      [copy.durationHours]: Number((row.durationMinutes / 60).toFixed(2)),
    };

    if (kind === 'customer') {
      return {
        ...common,
        [copy.client]: row.clientName ?? '',
        [copy.collaborator]: row.collaboratorName ?? '',
        [copy.billingStatus]: row.billingStatus === 'billed' ? copy.billed : copy.unbilled,
      };
    }

    return {
      ...common,
      [copy.collaborator]: row.collaboratorName ?? '',
      [copy.client]: row.clientName ?? '',
      [copy.invoiceStatus]: row.collaboratorInvoiceReceived == null
        ? ''
        : row.collaboratorInvoiceReceived ? copy.received : copy.pending,
    };
  });
}

export function timeTrackingExportFileName(kind: TimeTrackingExportKind, date: Date, lang: TimeTrackingExportLanguage) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const name = kind === 'customer'
    ? (lang === 'it' ? 'ore-fatturabili-clienti' : 'customer-billable-time')
    : (lang === 'it' ? 'ore-riconoscibili-collaboratori' : 'collaborator-recognizable-time');
  return `${name}_${day}.xlsx`;
}
