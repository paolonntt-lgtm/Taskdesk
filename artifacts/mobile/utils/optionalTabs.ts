export type MobileOptionalTabSettings = {
  clientsEnabled?: boolean;
  timeTrackingModuleEnabled?: boolean;
};

export type MobileOptionalTabAccess = {
  clients: boolean;
  hoursReport: boolean;
};

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

export function shouldShowNewTicketTab({
  settings,
  hasOrganization,
  settingsLoaded,
}: {
  settings: MobileOptionalTabSettings | undefined;
  hasOrganization: boolean;
  settingsLoaded: boolean;
}): boolean {
  if (hasOrganization && !settingsLoaded) return false;
  return settings?.clientsEnabled !== true || settings.timeTrackingModuleEnabled !== true;
}
