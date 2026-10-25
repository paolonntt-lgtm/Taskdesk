// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardScreen from "../app/(tabs)";
import TabLayout from "../app/(tabs)/_layout";

const mocks = vi.hoisted(() => ({
  user: { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7 },
  organizationSettings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
  clients: [] as { id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null }[],
  ticketSearchResults: [] as { id: number; title: string; status?: string | null }[],
  ticketSearchLoading: false,
  ticketSearchError: false,
  platformOS: "ios" as "ios" | "android",
  screenWidth: 390,
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
      onChangeText,
      onSubmitEditing,
      onRefresh,
      style,
      hitSlop,
      ...rest
    } = props;
    const flattenedStyle = Array.isArray(style)
      ? Object.assign({}, ...style.filter((item) => item && typeof item === "object"))
      : style;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(flattenedStyle && typeof flattenedStyle === "object"
        ? {
            "data-touch-width": flattenedStyle.width,
            "data-touch-height": flattenedStyle.height,
            "data-touch-left": flattenedStyle.left,
          }
        : {}),
      ...(hitSlop ? { "data-hit-slop": hitSlop } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState ? { "aria-selected": accessibilityState.selected } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onChangeText
        ? { onChange: (event: Event) => onChangeText((event.target as HTMLInputElement).value) }
        : {}),
      ...(onSubmitEditing
        ? { onKeyDown: (event: KeyboardEvent) => event.key === "Enter" && onSubmitEditing() }
        : {}),
      ...(onRefresh ? { onRefresh } : {}),
    }, props.children);
  };
  return {
    ActivityIndicator: component("div"),
    Platform: { get OS() { return mocks.platformOS; } },
    RefreshControl: () => null,
    Image: component("img"),
    TextInput: component("input"),
    Pressable: component("button"),
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
    useWindowDimensions: () => ({ width: mocks.screenWidth, height: 844 }),
  };
});

vi.mock("expo-router", async () => {
  const ReactModule = await import("react");
  const Tabs = ({
    children,
    screenOptions,
    backBehavior,
    tabBar,
  }: {
    children: React.ReactNode;
    backBehavior?: string;
    tabBar?: (props: any) => React.ReactNode;
    screenOptions?: (args: {
      navigation: { navigate: typeof mocks.navigate };
      route: { name: string; params?: { returnTo?: string } };
    }) => {
      headerLeft?: () => React.ReactNode;
      headerRight?: () => React.ReactNode;
      headerTitle?: () => React.ReactNode;
    };
  }) =>
    (() => {
      const screenElements = ReactModule.Children.toArray(children).filter(
        (child): child is React.ReactElement<{ name: string; options: Record<string, any> }> =>
          ReactModule.isValidElement(child) &&
          child.props != null &&
          typeof child.props === "object" &&
          "name" in child.props,
      );
      const routes = screenElements.map(({ props }) => ({
        name: props.name,
        key: props.name,
        params: undefined,
      }));
      const navigation = {
        navigate: mocks.navigate,
        emit: vi.fn(() => ({ defaultPrevented: false })),
      };
      const descriptors = Object.fromEntries(
        screenElements.map(({ props }) => [
          props.name,
          {
            options: {
              ...screenOptions?.({
                navigation: { navigate: mocks.navigate },
                route: { name: props.name },
              }),
              ...props.options,
            },
          },
        ]),
      );

      return ReactModule.createElement(
      "div",
      { "data-testid": "registered-tabs", "data-back-behavior": backBehavior },
      ...["index", "tickets", "calendar", "clients-tab", "hours-report-tab", "reports", "profile"].map(
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
            options?.headerTitle?.(),
            options?.headerRight?.(),
          );
        },
      ),
      children,
      tabBar?.({
        state: { routes, index: -1 },
        descriptors,
        navigation,
      }),
      );
    })();
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
        reports: mocks.language === "it" ? "Report" : "Reports",
        profile: mocks.language === "it" ? "Profilo" : "Profile",
      },
      dashboard: {
        goodMorning: "Good morning",
        goodAfternoon: "Good afternoon",
        goodEvening: "Good evening",
        searchPlaceholder: "Search Taskdesk",
        open: "Open",
        inProgress: "In progress",
        urgent: "Urgent",
        closed: "Closed",
        recentActivity: "Recent activity",
        seeAll: "See all",
        noRecentTickets: "No recent tickets",
      },
      profile: { user: "User" },
      tickets: { search: "Search tickets" },
      status: {},
    },
  }),
}));
vi.mock("@/utils/api", () => ({
  PRIORITY_COLORS: {},
  apiGet: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const isTicketSearch = queryKey[0] === "mobile-dashboard-ticket-search";
    return {
      data: queryKey[0] === "mobile-organization-settings"
        ? mocks.organizationSettings
        : queryKey[0] === "mobile-clients"
          ? mocks.clients
          : isTicketSearch
            ? mocks.ticketSearchResults
            : mocks.notifications,
      isLoading: isTicketSearch && mocks.ticketSearchLoading,
      isFetching: false,
      isSuccess: queryKey[0] === "mobile-organization-settings",
      isError: isTicketSearch && mocks.ticketSearchError,
      refetch: vi.fn(),
    };
  },
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
    mocks.clients = [];
    mocks.ticketSearchResults = [];
    mocks.ticketSearchLoading = false;
    mocks.ticketSearchError = false;
    mocks.platformOS = "ios";
    mocks.screenWidth = 390;
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

  it("keeps the Dashboard greeting on one line without a duplicate create action", async () => {
    await render(DashboardScreen);

    const greeting = host.querySelector('[data-testid="dashboard-greeting-line"]');
    expect(greeting?.textContent).toBe("Good morning, Ada");
    expect(greeting?.querySelectorAll("span")).toHaveLength(2);
    expect(host.querySelector('[data-testid="dashboard-create-ticket"]')).toBeNull();
  });

  it("shows the TaskDesk logo and search field in the Dashboard header", async () => {
    await render(TabLayout);

    const dashboardHeader = host.querySelector('[data-header-route="index"]');
    expect(dashboardHeader?.querySelector('[data-testid="dashboard-taskdesk-logo"]')).not.toBeNull();
    expect(dashboardHeader?.querySelector('[data-testid="dashboard-header-search"]')).not.toBeNull();
    expect(dashboardHeader?.textContent).not.toContain("Dashboard");
  });

  it("shows organization client matches and opens the selected client", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    mocks.clients = [
      { id: 31, name: "Studio Aurora", alias: "Aurora", email: "hello@aurora.test" },
      { id: 32, name: "Studio Boreale", alias: "Boreale" },
    ];
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const result = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-31"]');
    expect(result?.textContent).toContain("Studio Aurora");
    expect(host.querySelector('[data-testid="dashboard-client-result-32"]')).toBeNull();

    await act(async () => result?.click());
    expect(mocks.push).toHaveBeenCalledWith("/clients/31");
  });

  it("shows matching ticket suggestions and opens the selected ticket", async () => {
    mocks.ticketSearchResults = [
      { id: 41, title: "Aurora installation", status: "open" },
      { id: 42, title: "Aurora follow-up", status: "in_progress" },
    ];
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const result = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-ticket-result-41"]');
    expect(result?.textContent).toContain("Aurora installation");
    expect(result?.textContent).toContain("#41");
    expect(host.querySelector('[data-testid="dashboard-ticket-result-42"]')).not.toBeNull();

    await act(async () => result?.click());
    expect(mocks.push).toHaveBeenCalledWith("/ticket/41");
  });

  it("shows loading and empty states for ticket suggestions", async () => {
    mocks.ticketSearchLoading = true;
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "missing");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="dashboard-ticket-search-results"]')?.textContent)
      .not.toContain("No tickets found.");
    expect(host.querySelector('[data-testid="dashboard-ticket-search-loading"]')).not.toBeNull();

    mocks.ticketSearchLoading = false;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "unknown");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="dashboard-ticket-search-results"]')?.textContent)
      .toContain("No tickets found.");
  });

  it("keeps Enter navigation to the complete filtered ticket list", async () => {
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "invoice");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/tickets",
      params: { search: "invoice" },
    });
  });

  it("does not show client suggestions when client management is disabled", async () => {
    mocks.clients = [{ id: 31, name: "Studio Aurora" }];
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="dashboard-client-search-results"]')).toBeNull();
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

  it.each([
    {
      platform: "ios" as const,
      width: 320,
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
      hiddenRoutes: ["clients-tab", "hours-report-tab"],
    },
    {
      platform: "android" as const,
      width: 360,
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: false },
      hiddenRoutes: ["hours-report-tab"],
    },
    {
      platform: "android" as const,
      width: 412,
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
      hiddenRoutes: ["clients-tab"],
    },
  ])("renders a centered, usable New action and remaining tabs on $platform at $width pt", async (scenario) => {
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.platformOS = scenario.platform;
    mocks.screenWidth = scenario.width;
    mocks.organizationSettings = scenario.settings;
    await render(TabLayout);

    for (const route of scenario.hiddenRoutes) {
      expect(host.querySelector(`[data-route="${route}"]`)?.getAttribute("data-href")).toBe("hidden");
      expect(host.querySelector(`[aria-label="${route === "clients-tab" ? "Clients" : "Hours report"}"]`))
        .toBeNull();
    }

    const newButton = host.querySelector<HTMLButtonElement>('button[aria-label="New"]');
    expect(newButton).not.toBeNull();
    expect(newButton?.textContent).toContain("New");
    expect(newButton?.querySelector('[data-testid="new-ticket-tab-circle"]')).not.toBeNull();
    expect(newButton?.getAttribute("data-touch-left")).toBe("40%");
    expect(newButton?.getAttribute("data-touch-width")).toBe("20%");

    await act(async () => newButton!.click());
    expect(mocks.navigate).toHaveBeenCalledWith("new", undefined);

    for (const [label, route] of [["Dashboard", "index"], ["Tickets", "tickets"], ["Calendar", "calendar"]]) {
      const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button).not.toBeNull();
      await act(async () => button!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith(route, undefined);
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
      section: "calendar",
      role: "member",
      settings: { clientsEnabled: true, timeTrackingModuleEnabled: true },
    },
    {
      section: "clients-tab",
      role: "member",
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
    },
    {
      section: "hours-report-tab",
      role: "admin",
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
    },
    {
      section: "hours-report-tab",
      role: "member",
      settings: { clientsEnabled: false, timeTrackingModuleEnabled: true },
    },
  ] as const)(
    "omits Profile back action for stale $section destinations",
    async ({ section, role, settings }) => {
      mocks.user = { ...mocks.user, role };
      mocks.organizationSettings = settings;
      mocks.profileReturnTo = section;

      await render(TabLayout);

      if (section === "calendar") {
        expect(host.querySelector('button[aria-label="Calendar"]')).toBeNull();
      } else {
        expect(
          registeredRoutes().find((route) => route.dataset.route === section)?.dataset.href,
        ).toBe("hidden");
      }
      expect(
        host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
      ).toBeNull();
      expect(mocks.navigate).not.toHaveBeenCalled();
    },
  );

  it.each([
    { language: "en", returnLabel: "Back to Reports" },
    { language: "it", returnLabel: "Torna a Report" },
  ] as const)(
    "returns to Reports from Profile and labels the back action in $language",
    async ({ language, returnLabel }) => {
      mocks.language = language;
      await render(TabLayout);

      const reportsRoute = registeredRoutes().find((route) => route.dataset.route === "reports");
      expect(reportsRoute?.dataset.href).toBe("hidden");
      const profileButton = host.querySelector<HTMLButtonElement>(
        '[data-header-route="reports"] [data-testid="profile-header-button"]',
      );
      expect(profileButton).not.toBeNull();
      await act(async () => profileButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith("profile", { returnTo: "reports" });

      mocks.profileReturnTo = "reports";
      await render(TabLayout);
      const backButton = host.querySelector<HTMLButtonElement>(
        '[data-header-route="profile"] [data-testid="profile-back-button"]',
      );
      expect(backButton?.getAttribute("aria-label")).toBe(returnLabel);
      await act(async () => backButton!.click());
      expect(mocks.navigate).toHaveBeenLastCalledWith("reports");
    },
  );

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
