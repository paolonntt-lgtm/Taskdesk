export function dashboardPreferenceStorageKey(
  key: string,
  userId: number | string | null | undefined,
): string {
  return userId == null ? `${key}:anonymous` : `${key}:user:${userId}`;
}
