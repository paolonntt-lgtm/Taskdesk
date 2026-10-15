import { describe, expect, it } from 'vitest';
import { isDashboardWidgetAvailable, summarizeUnbilledCustomerTime } from './dashboardWidgetUtils';

describe('dashboard widget access', () => {
  const requirement = { requireAdmin: true, requireTimeTracking: true };

  it('only makes the unbilled widget available to admins while time tracking is enabled', () => {
    expect(isDashboardWidgetAvailable(requirement, {
      isAdmin: true,
      clientsEnabled: true,
      timeTrackingEnabled: true,
    })).toBe(true);
    expect(isDashboardWidgetAvailable(requirement, {
      isAdmin: false,
      clientsEnabled: true,
      timeTrackingEnabled: true,
    })).toBe(false);
    expect(isDashboardWidgetAvailable(requirement, {
      isAdmin: true,
      clientsEnabled: true,
      timeTrackingEnabled: false,
    })).toBe(false);
  });

  it('preserves normal widgets that do not require admin access or time tracking', () => {
    expect(isDashboardWidgetAvailable({}, {
      isAdmin: false,
      clientsEnabled: true,
      timeTrackingEnabled: false,
    })).toBe(true);
  });
});

describe('unbilled customer time summary', () => {
  it('sums applicable rows but counts each ticket only once', () => {
    expect(summarizeUnbilledCustomerTime([
      { ticketId: 10, billingStatus: 'unbilled', durationMinutes: 45 },
      { ticketId: 10, billingStatus: 'unbilled', durationMinutes: 30 },
      { ticketId: 11, billingStatus: 'unbilled', durationMinutes: 15 },
      { ticketId: 11, billingStatus: 'billed', durationMinutes: 120 },
    ])).toEqual({ totalMinutes: 90, ticketCount: 2 });
  });

  it('returns zero totals when all customer time is already billed', () => {
    expect(summarizeUnbilledCustomerTime([
      { ticketId: 10, billingStatus: 'billed', durationMinutes: 45 },
    ])).toEqual({ totalMinutes: 0, ticketCount: 0 });
  });
});
