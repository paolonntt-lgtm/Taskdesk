import { describe, expect, it } from 'vitest';
import {
  canAccessPersonalTimeReport,
  scopePersonalTimeReportQueryKey,
  shouldShowPersonalTimeReport,
} from './personalTimeReportAccess';

describe('personal time-report access', () => {
  it('shows the report only to collaborators who have recognized sessions', () => {
    expect(shouldShowPersonalTimeReport('user', [{ ticketId: 12 }])).toBe(true);
    expect(shouldShowPersonalTimeReport('user', [])).toBe(false);
    expect(shouldShowPersonalTimeReport('user', undefined)).toBe(false);
  });

  it('does not grant report access to admins or unauthenticated users', () => {
    expect(canAccessPersonalTimeReport('admin')).toBe(false);
    expect(shouldShowPersonalTimeReport('admin', [{ ticketId: 12 }])).toBe(false);
    expect(canAccessPersonalTimeReport(null)).toBe(false);
    expect(shouldShowPersonalTimeReport(undefined, [{ ticketId: 12 }])).toBe(false);
  });

  it('keeps cached report data separate for each collaborator', () => {
    const requestKey = ['/api/time-tracking/my-report', { dateFrom: '2026-10-01' }];
    expect(scopePersonalTimeReportQueryKey(requestKey, 101))
      .not.toEqual(scopePersonalTimeReportQueryKey(requestKey, 202));
  });
});
