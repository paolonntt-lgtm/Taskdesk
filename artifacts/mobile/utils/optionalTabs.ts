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
