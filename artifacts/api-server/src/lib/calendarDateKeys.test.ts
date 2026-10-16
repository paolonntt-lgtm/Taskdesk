import { describe, expect, it } from 'vitest';
import { getCalendarDateKeysForEvent } from './calendarDateKeys';

describe('getCalendarDateKeysForEvent', () => {
  it('includes every day of an all-day event, including its end date', () => {
    expect(getCalendarDateKeysForEvent(
      new Date('2026-10-30T00:00:00.000Z'),
      new Date('2026-11-02T00:00:00.000Z'),
      true,
      2026,
      11,
    )).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('shows a timed event on each day it spans within the displayed month', () => {
    expect(getCalendarDateKeysForEvent(
      new Date(2026, 9, 30, 18, 0),
      new Date(2026, 10, 2, 9, 0),
      false,
      2026,
      11,
    )).toEqual(['2026-11-01', '2026-11-02']);
  });
});
