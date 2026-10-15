export interface DashboardWidgetAccess {
  requireAdmin?: boolean;
  requireClients?: boolean;
  requireTimeTracking?: boolean;
}

export function isDashboardWidgetAvailable(
  widget: DashboardWidgetAccess,
  access: { isAdmin: boolean; clientsEnabled: boolean; timeTrackingEnabled: boolean },
): boolean {
  return (!widget.requireAdmin || access.isAdmin)
    && (!widget.requireClients || access.clientsEnabled)
    && (!widget.requireTimeTracking || access.timeTrackingEnabled);
}

export interface UnbilledCustomerRow {
  ticketId: number;
  billingStatus: 'unbilled' | 'billed';
  durationMinutes: number;
}

export function summarizeUnbilledCustomerTime(rows: readonly UnbilledCustomerRow[]) {
  const unbilledRows = rows.filter((row) => row.billingStatus === 'unbilled');
  return {
    totalMinutes: unbilledRows.reduce((total, row) => total + row.durationMinutes, 0),
    ticketCount: new Set(unbilledRows.map((row) => row.ticketId)).size,
  };
}
