import { describe, expect, it } from 'vitest';
import { translations } from '../i18n/translations';
import { formatTicketDeadlineLabel, formatTicketDeadlineParts } from './ticketDeadline';

const now = new Date('2026-11-14T12:00:00.000Z');

describe('ticket deadline display', () => {
  it('formats past deadlines as expired in Italian and English', () => {
    const dueAt = '2026-11-13T15:26:00.000Z';
    const italian = formatTicketDeadlineParts(dueAt, 'it', now);
    const english = formatTicketDeadlineParts(dueAt, 'en', now);

    expect(italian?.expired).toBe(true);
    expect(italian?.time).toMatch(/^\d{2}\.\d{2}$/);
    expect(translations.it.ticketDetail.dueAtExpired(italian!.date, italian!.time))
      .toMatch(/^Scaduto il 13 novembre alle \d{2}\.\d{2}$/);
    expect(english?.expired).toBe(true);
    expect(translations.en.ticketDetail.dueAtExpired(english!.date, english!.time))
      .toMatch(/^Expired on November 13 at .+$/);
  });

  it('keeps future deadlines distinct from expired deadlines', () => {
    const dueAt = '2026-11-15T15:26:00.000Z';
    const deadline = formatTicketDeadlineParts(dueAt, 'it', now);
    expect(deadline?.expired).toBe(false);
    expect(formatTicketDeadlineLabel(dueAt, 'it', translations.it.ticketDetail.dueAtExpired, now))
      .toMatch(/^Scade /);
    expect(formatTicketDeadlineLabel(dueAt, 'en', translations.en.ticketDetail.dueAtExpired, now))
      .toMatch(/^Due /);
  });

  it('returns no deadline for absent or invalid dates', () => {
    expect(formatTicketDeadlineParts(null, 'it', now)).toBeNull();
    expect(formatTicketDeadlineParts('', 'en', now)).toBeNull();
    expect(formatTicketDeadlineParts('not-a-date', 'it', now)).toBeNull();
    expect(formatTicketDeadlineLabel(null, 'it', translations.it.ticketDetail.dueAtExpired, now)).toBeNull();
  });
});
