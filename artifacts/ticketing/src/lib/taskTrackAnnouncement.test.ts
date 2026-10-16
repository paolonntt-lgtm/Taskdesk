import { describe, expect, it } from 'vitest';
import {
  getTaskTrackAnnouncementStorageKey,
  shouldShowTaskTrackAnnouncement,
} from './taskTrackAnnouncement';
import { translations } from '../i18n/translations';

const eligibleAdmin = {
  userId: 'admin-1',
  role: 'admin',
  location: '/',
  allowed: true,
  botOpen: false,
  alreadySeen: false,
};

describe('TaskTrack announcement visibility', () => {
  it('shows only to an eligible admin on the dashboard when not already seen', () => {
    expect(shouldShowTaskTrackAnnouncement(eligibleAdmin)).toBe(true);
    expect(shouldShowTaskTrackAnnouncement({ ...eligibleAdmin, role: 'user' })).toBe(false);
    expect(shouldShowTaskTrackAnnouncement({ ...eligibleAdmin, location: '/tickets' })).toBe(false);
    expect(shouldShowTaskTrackAnnouncement({ ...eligibleAdmin, allowed: false })).toBe(false);
    expect(shouldShowTaskTrackAnnouncement({ ...eligibleAdmin, botOpen: true })).toBe(false);
    expect(shouldShowTaskTrackAnnouncement({ ...eligibleAdmin, alreadySeen: true })).toBe(false);
  });

  it('uses a separate dismissal key for each account', () => {
    expect(getTaskTrackAnnouncementStorageKey('admin-1')).not.toBe(
      getTaskTrackAnnouncementStorageKey('admin-2'),
    );
  });

  it('describes ticket time tracking and reporting in both languages', () => {
    expect(translations.it.taskTrackAnnouncement.title).toContain('TaskTrack');
    expect(translations.it.taskTrackAnnouncement.body).toContain('ticket');
    expect(translations.it.taskTrackAnnouncement.help).toBe('Aiuto');
    expect(translations.it.taskTrackAnnouncement.body).toContain('rendiconto');
    expect(translations.en.taskTrackAnnouncement.title).toContain('TaskTrack');
    expect(translations.en.taskTrackAnnouncement.body).toContain('ticket');
    expect(translations.en.taskTrackAnnouncement.help).toBe('Help');
    expect(translations.en.taskTrackAnnouncement.body).toContain('report');
    expect(translations.it.taskTrackHelp.trackingBody).toContain('In lavorazione');
    expect(translations.en.taskTrackHelp.trackingBody).toContain('In progress');
    expect(translations.it.settings.timeTrackingModuleLabel).toContain('TaskTrack');
    expect(translations.en.settings.timeTrackingModuleLabel).toContain('TaskTrack');
  });
});
