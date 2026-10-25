import type { QueryClient } from "@tanstack/react-query";

export const MOBILE_ORGANIZATION_SETTINGS_REFETCH_INTERVAL_MS = 30_000;

export type MobileOptionalTabSettings = {
  clientsEnabled?: boolean;
  timeTrackingModuleEnabled?: boolean;
};

export type MobileOptionalTabAccess = {
  clients: boolean;
  hoursReport: boolean;
};

export function getMobileOrganizationSettingsRefetchInterval(
  isAppActive: boolean,
): number | false {
  return isAppActive
    ? MOBILE_ORGANIZATION_SETTINGS_REFETCH_INTERVAL_MS
    : false;
}

export function getMobileOrganizationSettingsQueryKey(
  organizationId: number | null | undefined,
) {
  return ["mobile-organization-settings", organizationId] as const;
}

export function cacheMobileOrganizationSettings(
  queryClient: Pick<QueryClient, "setQueryData">,
  organizationId: number | null | undefined,
  settings: MobileOptionalTabSettings,
): void {
  queryClient.setQueryData(
    getMobileOrganizationSettingsQueryKey(organizationId),
    settings,
  );
}

export function getMobileOptionalTabAccess({
  settings,
  settingsLoaded,
  hasOrganization,
  isOrganizationAdmin,
}: {
  settings: MobileOptionalTabSettings | undefined;
  settingsLoaded: boolean;
  hasOrganization: boolean;
  isOrganizationAdmin: boolean;
}): MobileOptionalTabAccess {
  return {
    clients:
      hasOrganization &&
      settingsLoaded &&
      settings?.clientsEnabled === true,
    hoursReport:
      hasOrganization &&
      settingsLoaded &&
      isOrganizationAdmin &&
      settings?.timeTrackingModuleEnabled === true,
  };
}

export function shouldHideCalendarTab({
  settings,
  hasOrganization,
  settingsLoaded,
}: {
  settings: MobileOptionalTabSettings | undefined;
  hasOrganization: boolean;
  settingsLoaded: boolean;
}): boolean {
  return (
    hasOrganization &&
    settingsLoaded &&
    settings?.clientsEnabled === true &&
    settings.timeTrackingModuleEnabled === true
  );
}
