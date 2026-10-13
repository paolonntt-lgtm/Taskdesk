export type MobileAnnouncementSchedule = {
  startsAt: string;
  endsAt: string;
};

export function localDateTimeInputValue(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function mergeAnnouncementPickerValue(
  value: string,
  selected: Date,
  mode: 'date' | 'time',
): string {
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return localDateTimeInputValue(selected);
  if (mode === 'date') {
    current.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  } else {
    current.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  }
  return localDateTimeInputValue(current);
}

export function buildMobileAnnouncementSchedule(
  startsAtLocal: string,
  endsAtLocal: string,
): MobileAnnouncementSchedule | null {
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

export async function runWithValidMobileAnnouncementSchedule<T>(
  startsAtLocal: string,
  endsAtLocal: string,
  save: (schedule: MobileAnnouncementSchedule) => T | Promise<T>,
): Promise<boolean> {
  const schedule = buildMobileAnnouncementSchedule(startsAtLocal, endsAtLocal);
  if (!schedule) return false;
  await save(schedule);
  return true;
}
