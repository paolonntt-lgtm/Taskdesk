import type {
  TimeTrackingReportMonthTotal,
  TimeTrackingReportRow,
} from '@workspace/api-client-react';

export type TimeTrackingBreakdownKey = 'client' | 'collaborator' | 'ticket' | 'month';

export interface TimeTrackingBreakdownRow {
  key: string;
  label: string;
  clientBillableMinutes: number;
  clientBilledMinutes: number;
  clientUnbilledMinutes: number;
  collaboratorRecognizableMinutes: number;
}

export type TimeTrackingBreakdowns = Record<TimeTrackingBreakdownKey, TimeTrackingBreakdownRow[]>;

function addRow(
  rows: Map<string, TimeTrackingBreakdownRow>,
  key: string,
  label: string,
): TimeTrackingBreakdownRow {
  let row = rows.get(key);
  if (!row) {
    row = {
      key,
      label,
      clientBillableMinutes: 0,
      clientBilledMinutes: 0,
      clientUnbilledMinutes: 0,
      collaboratorRecognizableMinutes: 0,
    };
    rows.set(key, row);
  }
  return row;
}

function sortByTotal(rows: TimeTrackingBreakdownRow[]): TimeTrackingBreakdownRow[] {
  return rows.sort((a, b) =>
    (b.clientBillableMinutes + b.collaboratorRecognizableMinutes)
      - (a.clientBillableMinutes + a.collaboratorRecognizableMinutes)
      || a.label.localeCompare(b.label));
}

export function buildTimeTrackingBreakdowns(
  customerRows: TimeTrackingReportRow[],
  collaboratorRows: TimeTrackingReportRow[],
  monthlyTotals: TimeTrackingReportMonthTotal[],
): TimeTrackingBreakdowns {
  const byClient = new Map<string, TimeTrackingBreakdownRow>();
  const byTicket = new Map<string, TimeTrackingBreakdownRow>();
  const byCollaborator = new Map<string, TimeTrackingBreakdownRow>();

  const addTicket = (row: TimeTrackingReportRow) => addRow(
    byTicket,
    String(row.ticketId),
    `#${row.ticketNumber ?? row.ticketId} · ${row.title}`,
  );
  const addClient = (row: TimeTrackingReportRow) => addRow(
    byClient,
    row.clientId == null ? 'unassigned' : String(row.clientId),
    row.clientName || 'Cliente non associato',
  );

  for (const row of customerRows) {
    const groups = [addClient(row), addTicket(row)];
    for (const group of groups) {
      group.clientBillableMinutes += row.durationMinutes;
      if (row.billingStatus === 'billed') group.clientBilledMinutes += row.durationMinutes;
      else group.clientUnbilledMinutes += row.durationMinutes;
    }
  }

  for (const row of collaboratorRows) {
    const collaboratorKey = row.collaboratorId == null ? 'unassigned' : String(row.collaboratorId);
    const collaborator = addRow(
      byCollaborator,
      collaboratorKey,
      row.collaboratorName || 'Collaboratore non associato',
    );
    collaborator.collaboratorRecognizableMinutes += row.durationMinutes;

    const client = addClient(row);
    client.collaboratorRecognizableMinutes += row.durationMinutes;
    const ticket = addTicket(row);
    ticket.collaboratorRecognizableMinutes += row.durationMinutes;
  }

  const byMonth = monthlyTotals.map((total) => ({
    key: total.month,
    label: total.month,
    clientBillableMinutes: total.clientBillableMinutes,
    clientBilledMinutes: total.clientBilledMinutes,
    clientUnbilledMinutes: total.clientUnbilledMinutes,
    collaboratorRecognizableMinutes: total.collaboratorRecognizableMinutes,
  })).sort((a, b) => b.key.localeCompare(a.key));

  return {
    client: sortByTotal([...byClient.values()]),
    collaborator: sortByTotal([...byCollaborator.values()]),
    ticket: sortByTotal([...byTicket.values()]),
    month: byMonth,
  };
}
