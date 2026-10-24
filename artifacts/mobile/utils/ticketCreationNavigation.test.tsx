// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardScreen from "../app/(tabs)";
import TabLayout from "../app/(tabs)/_layout";

const mocks = vi.hoisted(() => ({
  user: { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7 },
  organizationSettings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
  push: vi.fn(),
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
      style: _style,
      ...rest
    } = props;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
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
    useColorScheme: () => "light",
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
});

vi.mock("expo-router", async () => {
  const ReactModule = await import("react");
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    ReactModule.createElement("div", { "data-testid": "registered-tabs" }, children);
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
    t: {
      tabs: {
        dashboard: "Dashboard",
        tickets: "Tickets",
        new: "New",
        newTicket: "New ticket",
        calendar: "Calendar",
        hoursReport: "Hours report",
        clients: "Clients",
        profile: "Profile",
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
      : undefined,
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
    mocks.push.mockReset();
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
});
