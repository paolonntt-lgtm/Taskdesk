export type MobileOrganizationSettings = {
  clientsEnabled?: boolean;
  timeTrackingModuleEnabled?: boolean;
};

export type ProfileMenuLanguage = "it" | "en";

export type OptionalProfileMenuItem = {
  label: string;
  icon: "briefcase" | "clock";
  path: string;
};

export function getOptionalProfileMenuItems({
  settings,
  settingsLoaded,
  isOrganizationAdmin,
  lang,
}: {
  settings: MobileOrganizationSettings | undefined;
  settingsLoaded: boolean;
  isOrganizationAdmin: boolean;
  lang: ProfileMenuLanguage;
}): OptionalProfileMenuItem[] {
  if (!settingsLoaded) return [];

  const items: OptionalProfileMenuItem[] = [];

  if (settings?.clientsEnabled === true) {
    items.push({
      label: lang === "it" ? "Clienti" : "Clients",
      icon: "briefcase",
      path: "/(tabs)/clients-tab",
    });
  }

  if (isOrganizationAdmin && settings?.timeTrackingModuleEnabled === true) {
    items.push({
      label: lang === "it" ? "Rendiconto ore" : "Hours report",
      icon: "clock",
      path: "/(tabs)/hours-report-tab",
    });
  }

  return items;
}
