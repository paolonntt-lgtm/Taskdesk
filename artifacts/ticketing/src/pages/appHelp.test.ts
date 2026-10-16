import { describe, expect, it } from 'vitest';
import { translations } from '../i18n/translations';

const helpItemGroups = [
  'dashboardItems',
  'ticketsItems',
  'clientsItems',
  'calendarItems',
  'reportsItems',
  'notificationsItems',
  'albertItems',
  'notesItems',
  'usersItems',
  'settingsItems',
  'billingItems',
  'trashItems',
  'announcementsItems',
  'taskTrackItems',
] as const;

describe('general help translations', () => {
  it('provides concise help content in Italian and English for every section', () => {
    for (const lang of ['it', 'en'] as const) {
      const help = translations[lang].appHelp;

      expect(help.title.length).toBeGreaterThan(0);
      for (const group of helpItemGroups) {
        expect(help[group].length, `${lang}.${group}`).toBeGreaterThan(0);
        expect(help[group].every((item) => item.trim().length > 0)).toBe(true);
      }
    }
  });
});
