export function canAccessPersonalTimeReport(role: string | null | undefined): boolean {
  return role != null && role !== 'admin';
}

export function shouldShowPersonalTimeReport(
  role: string | null | undefined,
  rows: readonly unknown[] | null | undefined,
): boolean {
  return canAccessPersonalTimeReport(role) && (rows?.length ?? 0) > 0;
}

export function scopePersonalTimeReportQueryKey(
  queryKey: readonly unknown[],
  userId: number | string | null | undefined,
): readonly unknown[] {
  return [...queryKey, 'viewer', userId];
}
