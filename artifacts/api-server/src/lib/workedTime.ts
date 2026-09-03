export type WorkedTimeFieldError = "hours" | "minutes";

export function parseWorkedTimeFields(
  hoursText: string,
  minutesText: string,
): { total: number | null; error?: WorkedTimeFieldError } {
  if (!hoursText.trim() && !minutesText.trim()) return { total: null };

  const hours = hoursText.trim() ? Number(hoursText) : 0;
  const minutes = minutesText.trim() ? Number(minutesText) : 0;
  if (!Number.isInteger(hours) || hours < 0) return { total: null, error: "hours" };
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return { total: null, error: "minutes" };
  }
  return { total: hours * 60 + minutes };
}

export function isValidWorkedMinutes(value: unknown): value is number | null | undefined {
  return value == null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
}