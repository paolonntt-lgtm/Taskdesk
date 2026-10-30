export function dashboardPreferenceStorageKey(
  key: string,
  userId: number | string | null | undefined,
): string {
  return userId == null ? `${key}:anonymous` : `${key}:user:${userId}`;
}

export function dashboardWidgetInstancePreferenceKey(key: string, widgetInstanceId: string): string {
  return `${key}:widget:${encodeURIComponent(widgetInstanceId)}`;
}

type DashboardPreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readDashboardWidgetInstancePreference(
  storage: DashboardPreferenceStorage,
  key: string,
  widgetInstanceId: string,
  legacyWidgetInstanceId?: string,
): string | null {
  const value = storage.getItem(dashboardWidgetInstancePreferenceKey(key, widgetInstanceId));
  if (value !== null) return value;
  return widgetInstanceId === legacyWidgetInstanceId ? storage.getItem(key) : null;
}

export function writeDashboardWidgetInstancePreference(
  storage: DashboardPreferenceStorage,
  key: string,
  widgetInstanceId: string,
  value: string | null,
  legacyWidgetInstanceId?: string,
): void {
  const instanceKey = dashboardWidgetInstancePreferenceKey(key, widgetInstanceId);
  if (value === null) storage.removeItem(instanceKey);
  else storage.setItem(instanceKey, value);

  if (widgetInstanceId === legacyWidgetInstanceId) storage.removeItem(key);
}

export function getPersonWidgetTicketsQuery(selectedId: number | null) {
  return {
    queryKey: ["tickets-for-person", selectedId] as const,
    enabled: selectedId !== null,
    queryFn: () => selectedId
      ? fetch(`/api/tickets?assignedTo=${selectedId}&status=open`, { credentials: "include" }).then((response) => response.json())
      : Promise.resolve([]),
  };
}

export function dashboardWidgetSettingsId(widgetId: string, widgetInstanceId: string): string {
  return widgetInstanceId === widgetId || widgetInstanceId.startsWith(`${widgetId}__`)
    ? widgetInstanceId
    : widgetId;
}
