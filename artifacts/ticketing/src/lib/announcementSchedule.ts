export type AnnouncementSchedule = {
  startsAt: string;
  endsAt: string;
};

export type AnnouncementScheduleField = keyof AnnouncementSchedule;

export function localDateTimeValue(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function buildAnnouncementSchedule(
  startsAtLocal: string,
  endsAtLocal: string,
): AnnouncementSchedule | null {
  const startsAt = new Date(startsAtLocal);
  const endsAt = new Date(endsAtLocal);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return null;
  }
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export async function runWithValidAnnouncementSchedule<T>(
  startsAtLocal: string,
  endsAtLocal: string,
  save: (schedule: AnnouncementSchedule) => T | Promise<T>,
): Promise<boolean> {
  const schedule = buildAnnouncementSchedule(startsAtLocal, endsAtLocal);
  if (!schedule) return false;
  await save(schedule);
  return true;
}

export function announcementDateTimeInputProps(
  field: AnnouncementScheduleField,
  startsAt: string,
  endsAt: string,
) {
  return {
    type: 'datetime-local' as const,
    value: field === 'startsAt' ? startsAt : endsAt,
    inputProps: {
      'data-testid': field === 'startsAt' ? 'input-announcement-starts-at' : 'input-announcement-ends-at',
      ...(field === 'startsAt' ? { max: endsAt } : { min: startsAt }),
      step: 60,
    },
  };
}
