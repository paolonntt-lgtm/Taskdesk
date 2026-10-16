import { describe, expect, it } from 'vitest';
import { getAppHelpSectionId } from './appHelpSection';

const adminAccess = { isAdmin: true, clientsEnabled: true };
const userAccess = { isAdmin: false, clientsEnabled: true };

describe('contextual app help links', () => {
  it('matches supported pages to their guide sections', () => {
    expect(getAppHelpSectionId('/', adminAccess)).toBe('dashboard');
    expect(getAppHelpSectionId('/tickets/new', adminAccess)).toBe('tickets');
    expect(getAppHelpSectionId('/tickets/42', adminAccess)).toBe('tickets');
    expect(getAppHelpSectionId('/tickets/trash', adminAccess)).toBe('trash');
    expect(getAppHelpSectionId('/clients/18', adminAccess)).toBe('clients');
    expect(getAppHelpSectionId('/daily-reports/5', adminAccess)).toBe('notifications');
    expect(getAppHelpSectionId('/time-report', adminAccess)).toBe('task-track');
    expect(getAppHelpSectionId('/announcements', adminAccess)).toBe('team-announcements');
  });

  it('hides links when the page has no accessible guide section', () => {
    expect(getAppHelpSectionId('/help', adminAccess)).toBeNull();
    expect(getAppHelpSectionId('/superadmin', adminAccess)).toBeNull();
    expect(getAppHelpSectionId('/billing', userAccess)).toBeNull();
    expect(getAppHelpSectionId('/settings', userAccess)).toBeNull();
    expect(getAppHelpSectionId('/tickets/trash', userAccess)).toBeNull();
    expect(getAppHelpSectionId('/clients', { ...adminAccess, clientsEnabled: false })).toBeNull();
  });
});
