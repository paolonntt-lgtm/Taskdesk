import { describe, expect, it } from "vitest";
import { getOptionalProfileMenuItems } from "./profileMenu";

describe("optional mobile profile menu items", () => {
  it.each([
    ["it", "Clienti", "Rendiconto ore"],
    ["en", "Clients", "Hours report"],
  ] as const)("uses the expected %s labels for enabled modules", (lang, clientsLabel, hoursLabel) => {
    const items = getOptionalProfileMenuItems({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
      isOrganizationAdmin: true,
      lang,
    });

    expect(items.map((item) => item.label)).toEqual([clientsLabel, hoursLabel]);
  });

  it.each(["it", "en"] as const)("shows Clients only when its module is enabled (%s)", (lang) => {
    const enabled = getOptionalProfileMenuItems({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      isOrganizationAdmin: false,
      lang,
    });
    const disabled = getOptionalProfileMenuItems({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      isOrganizationAdmin: false,
      lang,
    });

    expect(enabled.map((item) => item.label)).toEqual([lang === "it" ? "Clienti" : "Clients"]);
    expect(disabled).toEqual([]);
  });

  it.each(["it", "en"] as const)("shows the hours report only to admins with TaskTrack enabled (%s)", (lang) => {
    const adminWithTaskTrack = getOptionalProfileMenuItems({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
      isOrganizationAdmin: true,
      lang,
    });
    const adminWithoutTaskTrack = getOptionalProfileMenuItems({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      isOrganizationAdmin: true,
      lang,
    });
    const nonAdminWithTaskTrack = getOptionalProfileMenuItems({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
      isOrganizationAdmin: false,
      lang,
    });

    expect(adminWithTaskTrack.map((item) => item.label)).toEqual([
      lang === "it" ? "Rendiconto ore" : "Hours report",
    ]);
    expect(adminWithoutTaskTrack).toEqual([]);
    expect(nonAdminWithTaskTrack).toEqual([]);
  });

  it.each(["it", "en"] as const)("hides optional items until settings load (%s)", (lang) => {
    expect(getOptionalProfileMenuItems({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
      settingsLoaded: false,
      isOrganizationAdmin: true,
      lang,
    })).toEqual([]);
  });
});
