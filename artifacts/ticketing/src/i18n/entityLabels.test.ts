import { describe, expect, it } from 'vitest';
import { translations } from './translations';

describe('Italian dashboard labels for assigned practices', () => {
  it('uses feminine agreement and sentence case for practices', () => {
    expect(translations.it.dashboard.myTickets('Pratiche', 'feminine')).toBe('Le mie pratiche');
    expect(translations.it.dashboard.widgetFeedMy('Pratiche', 'feminine')).toBe('Le mie pratiche');
  });

  it('keeps masculine agreement for tickets', () => {
    expect(translations.it.dashboard.myTickets('Ticket', 'masculine')).toBe('I miei ticket');
    expect(translations.it.dashboard.widgetFeedMy('Ticket', 'masculine')).toBe('I miei ticket');
  });

  it('does not change English widget labels', () => {
    expect(translations.en.dashboard.myTickets('Cases', 'feminine')).toBe('My Cases');
    expect(translations.en.dashboard.widgetFeedMy('Cases', 'feminine')).toBe('My Cases');
  });
});
