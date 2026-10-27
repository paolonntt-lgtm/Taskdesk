import { describe, expect, it } from 'vitest';
import { getAnnouncementIconInfo } from './announcementIcons';

describe('getAnnouncementIconInfo', () => {
  it('chooses a warning icon from announcement text', () => {
    expect(getAnnouncementIconInfo('auto', 'Attenzione: scadenza domani').color).toBe('#b45309');
  });

  it('chooses an event icon from announcement text', () => {
    expect(getAnnouncementIconInfo('auto', 'Riunione del team').color).toBe('#be185d');
  });

  it('uses a selected standard icon instead of text detection', () => {
    expect(getAnnouncementIconInfo('success', 'Attenzione: scadenza domani').color).toBe('#15803d');
  });

  it('uses a general announcement icon when no keywords match', () => {
    expect(getAnnouncementIconInfo('auto', 'Ciao a tutti', 'Buon lavoro!').color).toBe('#2563eb');
  });
});
