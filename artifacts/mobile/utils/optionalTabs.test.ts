import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
  cacheMobileOrganizationSettings,
  getMobileOrganizationSettingsRefetchInterval,
  getMobileOrganizationSettingsQueryKey,
  getMobileOptionalTabAccess,
} from "./optionalTabs";
import { getMobileBottomBarLayout } from "./mobileBottomBarLayout";

describe("optional mobile navigation tabs", () => {
  const queryClients: QueryClient[] = [];

  afterEach(() => {
    queryClients.splice(0).forEach((client) => client.clear());
  });

  it("uses a shared organization-settings cache key", () => {
    expect(getMobileOrganizationSettingsQueryKey(7)).toEqual([
      "mobile-organization-settings",
      7,
    ]);
  });

  it("polls organization settings only while the app is active", () => {
    expect(getMobileOrganizationSettingsRefetchInterval(true)).toBe(30_000);
    expect(getMobileOrganizationSettingsRefetchInterval(false)).toBe(false);
  });

  it("shows Clients only when the organization has the Clients module", () => {
    const enabled = getMobileOptionalTabAccess({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const disabled = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const noOrganization = getMobileOptionalTabAccess({
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      hasOrganization: false,
      isOrganizationAdmin: false,
    });

    expect(enabled.clients).toBe(true);
    expect(disabled.clients).toBe(false);
    expect(noOrganization.clients).toBe(false);
    expect(enabled.statistics).toBe(false);
    expect(disabled.statistics).toBe(true);
    expect(noOrganization.statistics).toBe(false);
  });

  it("shows Hours only to organization admins when TaskTrack is enabled", () => {
    const adminWithTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
      hasOrganization: true,
      isOrganizationAdmin: true,
    });
    const adminWithoutTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      settingsLoaded: true,
      hasOrganization: true,
      isOrganizationAdmin: true,
    });
    const memberWithTaskTrack = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
      hasOrganization: true,
      isOrganizationAdmin: false,
    });
    const adminWithoutOrganization = getMobileOptionalTabAccess({
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      settingsLoaded: true,
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
        settingsLoaded: true,
        hasOrganization: true,
        isOrganizationAdmin: false,
      }),
    ).toEqual({ clients: true, hoursReport: false, statistics: false });
  });

  it("hides optional navigation whenever organization settings are unavailable", () => {
    expect(
      getMobileOptionalTabAccess({
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
        settingsLoaded: false,
        hasOrganization: true,
        isOrganizationAdmin: true,
      }),
    ).toEqual({ clients: false, hoursReport: false, statistics: false });
  });

  it("fills the bottom bar with Statistics only when Clients and TaskTrack are disabled", () => {
    const scenarios = [
      {
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
        expectedRoutes: ["index", "tickets", "new", "calendar", "reports"],
      },
      {
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
        expectedRoutes: ["index", "tickets", "new", "calendar", "clients-tab"],
      },
      {
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
        expectedRoutes: ["index", "tickets", "new", "calendar"],
      },
      {
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
        expectedRoutes: ["index", "tickets", "new", "calendar", "clients-tab"],
      },
    ] as const;

    for (const { settings, expectedRoutes } of scenarios) {
      const access = getMobileOptionalTabAccess({
        settings,
        settingsLoaded: true,
        hasOrganization: true,
        isOrganizationAdmin: true,
      });
      const routes = [
        "index",
        "tickets",
        "calendar",
        ...(access.clients ? ["clients-tab"] : []),
        ...(access.statistics ? ["reports"] : []),
      ];
      const layout = getMobileBottomBarLayout(routes, true);

      expect(layout.map(({ routeName }) => routeName)).toEqual(expectedRoutes);
      expect(layout.find(({ routeName }) => routeName === "new")?.left).toBe(40);
      expect(layout.some(({ routeName }) => routeName === "hours-report-tab")).toBe(false);
      expect(layout.every(({ width }) => (width * 320) / 100 >= 56)).toBe(true);
    }
  });

  it("updates the subscribed menu as products change without changing the current screen", () => {
    const organizationId = 7;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(queryClient);
    const queryKey = getMobileOrganizationSettingsQueryKey(organizationId);
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => ({ clientsEnabled: false, timeTrackingModuleEnabled: false }),
      enabled: false,
    });
    const getMenu = () => {
      const settings = observer.getCurrentResult().data;
      const access = getMobileOptionalTabAccess({
        settings,
        settingsLoaded: settings !== undefined,
        hasOrganization: true,
        isOrganizationAdmin: true,
      });
      const routes = [
        "index",
        "tickets",
        "calendar",
        ...(access.clients ? ["clients-tab"] : []),
        ...(access.statistics ? ["reports"] : []),
      ];

      return {
        routes,
        layout: getMobileBottomBarLayout(routes, true),
      };
    };
    const menuSnapshots: string[][] = [];
    const unsubscribe = observer.subscribe((result) => {
      if (result.data) menuSnapshots.push(getMenu().routes);
    });
    const currentRoute = "tickets";

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: false,
      timeTrackingModuleEnabled: false,
    });
    expect(getMenu().routes).toContain("calendar");
    expect(getMenu().routes).toContain("reports");

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: true,
      timeTrackingModuleEnabled: false,
    });
    expect(getMenu().routes).toContain("clients-tab");
    expect(getMenu().routes).toContain("calendar");
    expect(getMenu().routes).not.toContain("reports");

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: false,
      timeTrackingModuleEnabled: false,
    });
    expect(getMenu().routes).not.toContain("clients-tab");
    expect(getMenu().routes).toContain("reports");

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: false,
      timeTrackingModuleEnabled: true,
    });
    expect(getMenu().routes).not.toContain("hours-report-tab");
    expect(getMenu().routes).not.toContain("reports");
    expect(getMenu().routes).toContain("calendar");

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: false,
      timeTrackingModuleEnabled: false,
    });
    expect(getMenu().routes).not.toContain("hours-report-tab");
    expect(getMenu().routes).toContain("reports");

    cacheMobileOrganizationSettings(queryClient, organizationId, {
      clientsEnabled: true,
      timeTrackingModuleEnabled: true,
    });
    const enabledMenu = getMenu();
    expect(enabledMenu.routes).toContain("clients-tab");
    expect(enabledMenu.routes).toContain("calendar");
    expect(enabledMenu.routes).not.toContain("reports");
    expect(enabledMenu.routes).not.toContain("hours-report-tab");
    expect(enabledMenu.layout.find((item) => item.routeName === "new")?.left).toBe(40);
    expect(currentRoute).toBe("tickets");
    expect(menuSnapshots).toHaveLength(6);
    expect(menuSnapshots[1]).toContain("clients-tab");
    expect(menuSnapshots[1]).not.toContain("reports");
    expect(menuSnapshots[2]).not.toContain("clients-tab");
    expect(menuSnapshots[2]).toContain("reports");
    expect(menuSnapshots[3]).not.toContain("hours-report-tab");
    expect(menuSnapshots[3]).not.toContain("reports");
    expect(menuSnapshots[4]).not.toContain("hours-report-tab");
    expect(menuSnapshots[4]).toContain("reports");
    expect(menuSnapshots[5]).toContain("calendar");
    expect(menuSnapshots[5]).not.toContain("reports");

    unsubscribe();
    expect(currentRoute).toBe("tickets");
  });
});
