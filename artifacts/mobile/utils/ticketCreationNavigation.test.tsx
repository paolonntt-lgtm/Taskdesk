// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardScreen from "../app/(tabs)";
import TabLayout from "../app/(tabs)/_layout";

const mocks = vi.hoisted(() => ({
  user: { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7 },
  organizationSettings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
  language: "en" as "en" | "it",
  notifications: [{ id: 1, isRead: false }, { id: 2, isRead: false }] as {
    id: number;
    isRead: boolean;
  }[],
  profileReturnTo: undefined as string | undefined,
  push: vi.fn(),
  navigate: vi.fn(),
  announce: vi.fn(),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const component = (tag: string) => (props: Record<string, any>) => {
    const {
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
      onRefresh,
      style,
      hitSlop,
      ...rest
    } = props;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(style && typeof style === "object" && !Array.isArray(style)
        ? {
            "data-touch-width": style.width,
            "data-touch-height": style.height,
          }
        : {}),
      ...(hitSlop ? { "data-hit-slop": hitSlop } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState ? { "aria-selected": accessibilityState.selected } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onRefresh ? { onRefresh } : {}),
    }, props.children);
  };
  return {
    ActivityIndicator: () => null,
    Platform: { OS: "ios" },
    RefreshControl: () => null,
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span"),
    TouchableOpacity: component("button"),
    View: component("div"),
    AccessibilityInfo: { announceForAccessibility: mocks.announce },
    AppState: {
      currentState: "active",
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    useColorScheme: () => "light",
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("expo-router", async () => {
  const ReactModule = await import("react");
  const Tabs = ({
    children,
    screenOptions,
    backBehavior,
  }: {
    children: React.ReactNode;
    backBehavior?: string;
    screenOptions?: (args: {
      navigation: { navigate: typeof mocks.navigate };
      route: { name: string; params?: { returnTo?: string } };
    }) => {
      headerLeft?: () => React.ReactNode;
      headerRight?: () => React.ReactNode;
    };
  }) =>
    ReactModule.createElement(
      "div",
      { "data-testid": "registered-tabs", "data-back-behavior": backBehavior },
      ...["index", "tickets", "calendar", "clients-tab", "hours-report-tab", "profile"].map(
        (name) => {
          const options = screenOptions?.({
            navigation: { navigate: mocks.navigate },
            route: {
              name,
              params:
                name === "profile" && mocks.profileReturnTo
                  ? { returnTo: mocks.profileReturnTo }
                  : undefined,
            },
          });
          return ReactModule.createElement(
            "div",
            { key: name, "data-header-route": name },
            options?.headerLeft?.(),
            options?.headerRight?.(),
          );
        },
      ),
      children,
    );
  Tabs.Screen = ({
    name,
    options,
  }: {
    name: string;
    options?: { href?: string | null };
  }) => ReactModule.createElement("div", {
    "data-route": name,
    "data-href": options?.href === null ? "hidden" : "visible",
  });
  return {
    Tabs,
    router: { push: mocks.push },
    useRouter: () => ({ push: mocks.push }),
  };
});

vi.mock("expo-blur", () => ({ BlurView: () => null }));
vi.mock("expo-symbols", () => ({ SymbolView: () => null }));
vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: mocks.language,
    t: {
      tabs: {
        dashboard: "Dashboard",
        tickets: "Tickets",
        new: "New",
        newTicket: "New ticket",
        calendar: "Calendar",
        hoursReport: "Hours report",
        clients: "Clients",
        profile: mocks.language === "it" ? "Profilo" : "Profile",
      },
      dashboard: {
        goodMorning: "Good morning",
        goodAfternoon: "Good afternoon",
        goodEvening: "Good evening",
        open: "Open",
        inProgress: "In progress",
        urgent: "Urgent",
        closed: "Closed",
        recentActivity: "Recent activity",
        seeAll: "See all",
        noRecentTickets: "No recent tickets",
      },
      profile: { user: "User" },
      status: {},
    },
  }),
}));
vi.mock("@/utils/api", () => ({
  PRIORITY_COLORS: {},
  apiGet: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "mobile-profile-organization-settings"
      ? mocks.organizationSettings
      : mocks.notifications,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

describe("mobile ticket creation navigation", () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = async (screen: React.ComponentType) => {
    await act(async () => root.render(React.createElement(screen)));
  };

  const registeredRoutes = () =>
    Array.from(host.querySelectorAll<HTMLElement>("[data-route]"));

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.user = { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7 };
    mocks.organizationSettings = { clientsEnabled: false, timeTrackingModuleEnabled: false };
    mocks.language = "en";
    mocks.notifications = [{ id: 1, isRead: false }, { id: 2, isRead: false }];
    mocks.profileReturnTo = undefined;
    mocks.push.mockReset();
    mocks.navigate.mockReset();
    mocks.announce.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("opens the New Ticket route from the Dashboard action", async () => {
    await render(DashboardScreen);

    const createButton = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-create-ticket"]');
    expect(createButton).not.toBeNull();
    await act(async () => createButton!.click());

    expect(mocks.push).toHaveBeenCalledWith("/(tabs)/new");
  });

  it("keeps New Ticket registered when optional tabs are hidden by module or role", async () => {
    const scenarios = [
      {
        role: "member",
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
        hiddenOptionalTabs: ["hours-report-tab", "clients-tab"],
      },
      {
        role: "admin",
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
        hiddenOptionalTabs: ["hours-report-tab"],
      },
      {
        role: "admin",
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
        hiddenOptionalTabs: ["hours-report-tab", "clients-tab"],
      },
    ] as const;

    for (const scenario of scenarios) {
      mocks.user = { ...mocks.user, role: scenario.role };
      mocks.organizationSettings = scenario.settings;
      await render(TabLayout);

      const routes = registeredRoutes();
      const newTicketRoute = routes.find((route) => route.dataset.route === "new");
      expect(newTicketRoute?.dataset.href).toBe("visible");
      for (const optionalRoute of scenario.hiddenOptionalTabs) {
        expect(routes.find((route) => route.dataset.route === optionalRoute)?.dataset.href)
          .toBe("hidden");
      }
    }
  });

  it("opens Profile from core and enabled optional section headers", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: true };
    await render(TabLayout);
    const routes = registeredRoutes();
    expect(routes.some((route) => route.dataset.route === "profile")).toBe(true);

    for (const section of ["index", "tickets", "calendar", "clients-tab", "hours-report-tab"]) {
      expect(routes.find((route) => route.dataset.route === section)?.dataset.href).toBe("visible");
      const profileButton = host.querySelector<HTMLButtonElement>(
        `[data-header-route="${section}"] [data-testid="profile-header-button"]`,
      );
      expect(profileButton).not.toBeNull();
      await act(async () => profileButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith("profile", { returnTo: section });
    }

    expect(
      host.querySelector('[data-header-route="profile"] [data-testid="profile-header-button"]'),
    ).toBeNull();
  });

  it("keeps Profile reachable from core sections when optional sections are hidden", async () => {
    mocks.organizationSettings = { clientsEnabled: false, timeTrackingModuleEnabled: false };
    await render(TabLayout);

    const routes = registeredRoutes();
    for (const section of ["clients-tab", "hours-report-tab"]) {
      expect(routes.find((route) => route.dataset.route === section)?.dataset.href).toBe("hidden");
    }

    for (const section of ["index", "tickets", "calendar"]) {
      const profileButton = host.querySelector<HTMLButtonElement>(
        `[data-header-route="${section}"] [data-testid="profile-header-button"]`,
      );
      expect(profileButton).not.toBeNull();
      await act(async () => profileButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith("profile", { returnTo: section });
    }

    expect(
      host.querySelector('[data-header-route="profile"] [data-testid="profile-header-button"]'),
    ).toBeNull();
  });

  it("returns to the originating tab from Profile for core and enabled optional sections", async () => {
    const scenarios = [
      {
        section: "tickets",
        role: "member",
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      },
      {
        section: "calendar",
        role: "member",
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      },
      {
        section: "clients-tab",
        role: "member",
        settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      },
      {
        section: "hours-report-tab",
        role: "admin",
        settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      },
    ] as const;

    for (const { section, role, settings } of scenarios) {
      mocks.user = { ...mocks.user, role };
      mocks.organizationSettings = settings;
      await render(TabLayout);
      expect(host.querySelector('[data-testid="registered-tabs"]')?.getAttribute("data-back-behavior"))
        .toBe("history");

      const sectionRoute = registeredRoutes().find((route) => route.dataset.route === section);
      expect(sectionRoute?.dataset.href).toBe("visible");
      const profileButton = host.querySelector<HTMLButtonElement>(
        `[data-header-route="${section}"] [data-testid="profile-header-button"]`,
      );
      expect(profileButton).not.toBeNull();
      await act(async () => profileButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith("profile", { returnTo: section });

      mocks.profileReturnTo = section;
      await render(TabLayout);
      const backButton = host.querySelector<HTMLButtonElement>(
        '[data-header-route="profile"] [data-testid="profile-back-button"]',
      );
      expect(backButton).not.toBeNull();
      await act(async () => backButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith(section);
      mocks.profileReturnTo = undefined;
    }
  });

  it.each([
    {
      language: "en",
      notificationsLabel: "Notifications, 2 unread",
      profileLabel: "Profile",
    },
    {
      language: "it",
      notificationsLabel: "Notifiche, 2 da leggere",
      profileLabel: "Profilo",
    },
  ] as const)(
    "keeps header actions accessible in $language",
    async ({ language, notificationsLabel, profileLabel }) => {
      mocks.language = language;
      await render(TabLayout);

      const notificationsButton = host.querySelector<HTMLButtonElement>(
        '[data-header-route="index"] [data-testid="notifications-header-button"]',
      );
      const profileButton = host.querySelector<HTMLButtonElement>(
        '[data-header-route="index"] [data-testid="profile-header-button"]',
      );

      expect(notificationsButton?.getAttribute("aria-label")).toBe(notificationsLabel);
      expect(profileButton?.getAttribute("aria-label")).toBe(profileLabel);
      for (const button of [notificationsButton, profileButton]) {
        expect(Number(button?.dataset.touchWidth)).toBeGreaterThanOrEqual(44);
        expect(Number(button?.dataset.touchHeight)).toBeGreaterThanOrEqual(44);
        expect(button?.dataset.hitSlop).toBe("10");
      }
    },
  );

  it.each([
    { language: "en", announcement: "You have 2 new notifications." },
    { language: "it", announcement: "Hai 2 nuove notifiche." },
  ] as const)(
    "announces only newly arriving unread notifications in $language",
    async ({ language, announcement }) => {
      mocks.language = language;
      await render(TabLayout);
      expect(mocks.announce).not.toHaveBeenCalled();

      await render(TabLayout);
      expect(mocks.announce).not.toHaveBeenCalled();

      mocks.notifications = [
        ...mocks.notifications,
        { id: 3, isRead: false },
        { id: 4, isRead: false },
        { id: 5, isRead: true },
      ];
      await render(TabLayout);
      expect(mocks.announce).toHaveBeenCalledTimes(1);
      expect(mocks.announce).toHaveBeenCalledWith(announcement);

      await render(TabLayout);
      expect(mocks.announce).toHaveBeenCalledTimes(1);
    },
  );
});
