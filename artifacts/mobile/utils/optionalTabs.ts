export type MobileOptionalTabSettings = {
  clientsEnabled?: boolean;
  timeTrackingModuleEnabled?: boolean;
};

export type MobileOptionalTabAccess = {
  clients: boolean;
  hoursReport: boolean;
};

export function getMobileOrganizationSettingsQueryKey(
  organizationId: number | null | undefined,
) {
  return ["mobile-organization-settings", organizationId] as const;
}

export function getMobileOptionalTabAccess({
  settings,
  hasOrganization,
  isOrganizationAdmin,
}: {
  settings: MobileOptionalTabSettings | undefined;
  hasOrganization: boolean;
  isOrganizationAdmin: boolean;
}): MobileOptionalTabAccess {
  return {
    clients: hasOrganization && settings?.clientsEnabled === true,
    hoursReport:
      hasOrganization &&
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
