import { describe, expect, it } from "vitest";
import {
  getMobileOrganizationSettingsQueryKey,
  getMobileOptionalTabAccess,
  shouldHideCalendarTab,
} from "./optionalTabs";

describe("optional mobile navigation tabs", () => {
  it("uses a shared organization-settings cache key", () => {
    expect(getMobileOrganizationSettingsQueryKey(7)).toEqual([
      "mobile-organization-settings",
      7,
    ]);
  });

  it("shows Clients only when the organization has the Clients module", () => {
    const enabled = getMobileOptionalTabAccess({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const disabled = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const noOrganization = getMobileOptionalTabAccess({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      hasOrganization: false,
      isOrganizationAdmin: false,
    });

    expect(enabled.clients).toBe(true);
    expect(disabled.clients).toBe(false);
    expect(noOrganization.clients).toBe(false);
  });

  it("shows Hours only to organization admins when TaskTrack is enabled", () => {
    const adminWithTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      isOrganizationAdmin: true,
    });
    const adminWithoutTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      hasOrganization: true,
      isOrganizationAdmin: true,
    });
    const memberWithTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const adminWithoutOrganization = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hasOrganization: false,
      isOrganizationAdmin: true,
    });

    expect(adminWithTaskTrack.hoursReport).toBe(true);
    expect(adminWithoutTaskTrack.hoursReport).toBe(false);
    expect(memberWithTaskTrack.hoursReport).toBe(false);
    expect(adminWithoutOrganization.hoursReport).toBe(false);
  });

  it("allows organization members to see Clients when its module is enabled", () => {
    expect(
      getMobileOptionalTabAccess({
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
        hasOrganization: true,
        isOrganizationAdmin: false,
      }),
    ).toEqual({ clients: true, hoursReport: false });
  });

  it("hides Calendar only when both organization products are enabled", () => {
    expect(shouldHideCalendarTab({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(true);
    expect(shouldHideCalendarTab({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(false);
    expect(shouldHideCalendarTab({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(false);
    expect(shouldHideCalendarTab({
      settings: undefined,
      hasOrganization: true,
      settingsLoaded: false,
    })).toBe(false);
    expect(shouldHideCalendarTab({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
      hasOrganization: false,
      settingsLoaded: true,
    })).toBe(false);
  });
});
