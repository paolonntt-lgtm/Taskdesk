import { describe, expect, it } from "vitest";
import { getMobileOptionalTabAccess, shouldShowNewTicketTab } from "./optionalTabs";

describe("optional mobile navigation tabs", () => {
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

  it("shows New when at least one optional product is disabled, but not while settings load", () => {
    expect(shouldShowNewTicketTab({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(true);
    expect(shouldShowNewTicketTab({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(true);
    expect(shouldShowNewTicketTab({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
      hasOrganization: true,
      settingsLoaded: true,
    })).toBe(false);
    expect(shouldShowNewTicketTab({
      settings: undefined,
      hasOrganization: true,
      settingsLoaded: false,
    })).toBe(false);
    expect(shouldShowNewTicketTab({
      settings: undefined,
      hasOrganization: false,
      settingsLoaded: false,
    })).toBe(true);
  });
});
