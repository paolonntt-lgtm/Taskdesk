import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  announcementDateTimeInputProps,
  buildAnnouncementSchedule,
  localDateTimeValue,
  runWithValidAnnouncementSchedule,
} from './announcementSchedule';
import {
  buildMobileAnnouncementSchedule,
  localDateTimeInputValue,
  mergeAnnouncementPickerValue,
  runWithValidMobileAnnouncementSchedule,
} from '../../../mobile/utils/announcementSchedule';

const originalTimeZone = process.env.TZ;

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('announcement scheduling and local datetime controls', () => {
  it.each([
    ['America/Los_Angeles', '2026-01-15T17:30:00.000Z'],
    ['Asia/Tokyo', '2026-01-15T00:30:00.000Z'],
  ])('converts local web and mobile times to ISO in %s', (timeZone, expectedStart) => {
    process.env.TZ = timeZone;
    const localStart = '2026-01-15T09:30';
    const localEnd = '2026-01-15T10:45';

    expect(buildAnnouncementSchedule(localStart, localEnd)).toEqual({
      startsAt: expectedStart,
      endsAt: new Date(`${localEnd}:00`).toISOString(),
    });
    expect(buildMobileAnnouncementSchedule(localStart, localEnd)).toEqual({
      startsAt: expectedStart,
      endsAt: new Date(`${localEnd}:00`).toISOString(),
    });

    const startIso = new Date(`${localStart}:00`).toISOString();
    expect(localDateTimeValue(startIso)).toBe(localStart);
    expect(localDateTimeInputValue(startIso)).toBe(localStart);
  });

  it('wires the web datetime-local inputs to their local values and interval bounds', () => {
    const startsAt = '2026-10-13T09:30';
    const endsAt = '2026-10-13T10:30';

    expect(announcementDateTimeInputProps('startsAt', startsAt, endsAt)).toEqual({
      type: 'datetime-local',
      value: startsAt,
      inputProps: {
        'data-testid': 'input-announcement-starts-at',
        max: endsAt,
        step: 60,
      },
    });
    expect(announcementDateTimeInputProps('endsAt', startsAt, endsAt)).toEqual({
      type: 'datetime-local',
      value: endsAt,
      inputProps: {
        'data-testid': 'input-announcement-ends-at',
        min: startsAt,
        step: 60,
      },
    });
  });

  it('keeps the untouched date or time portion when mobile picker values change', () => {
    process.env.TZ = 'America/Los_Angeles';
    const original = '2026-10-20T09:30';

    expect(mergeAnnouncementPickerValue(
      original,
      new Date(2026, 9, 22, 16, 45),
      'date',
    )).toBe('2026-10-22T09:30');
    expect(mergeAnnouncementPickerValue(
      original,
      new Date(2026, 9, 22, 16, 45),
      'time',
    )).toBe('2026-10-20T16:45');
  });

  it.each([
    ['equal', '2026-10-13T09:30', '2026-10-13T09:30'],
    ['earlier', '2026-10-13T10:00', '2026-10-13T09:30'],
  ])('does not call web create or edit when the interval is %s', async (_label, start, end) => {
    const create = vi.fn();
    const edit = vi.fn();

    const created = await runWithValidAnnouncementSchedule(start, end, create);
    const edited = await runWithValidAnnouncementSchedule(start, end, edit);

    expect(created).toBe(false);
    expect(edited).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });

  it.each([
    ['equal', '2026-10-13T09:30', '2026-10-13T09:30'],
    ['earlier', '2026-10-13T10:00', '2026-10-13T09:30'],
  ])('does not call mobile create or edit when the interval is %s', async (_label, start, end) => {
    const create = vi.fn();
    const edit = vi.fn();

    const created = await runWithValidMobileAnnouncementSchedule(start, end, create);
    const edited = await runWithValidMobileAnnouncementSchedule(start, end, edit);

    expect(created).toBe(false);
    expect(edited).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });
});
