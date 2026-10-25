// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientsScreen from "../app/(tabs)/clients-tab";
import TabLayout from "../app/(tabs)/_layout";
import TicketsScreen from "../app/(tabs)/tickets";

const mocks = vi.hoisted(() => ({
  initialRoute: "tickets",
  clientsEnabled: true,
  routeSearch: undefined as string | undefined,
  ticketQueryFn: undefined as (() => Promise<unknown>) | undefined,
  dashboardTickets: [] as Array<{
    id: number;
    title: string;
    status?: string;
    client?: { name: string };
    assignee?: { name: string };
  }>,
  apiGet: vi.fn(() => Promise.resolve([])),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const nativeComponent = (tag: string) => (props: Record<string, any>) => {
    const {
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
      onLongPress: _onLongPress,
      onChangeText,
      hitSlop: _hitSlop,
      style: _style,
      contentContainerStyle: _contentContainerStyle,
      refreshControl: _refreshControl,
      ...rest
    } = props;
    return element(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState ? { "aria-selected": accessibilityState.selected } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onChangeText
        ? { onChange: (event: { currentTarget: { value: string } }) => onChangeText(event.currentTarget.value) }
        : {}),
    }, props.children);
  };

  return {
    AccessibilityInfo: { announceForAccessibility: vi.fn() },
    AppState: {
      currentState: "active",
      addEventListener: () => ({ remove: vi.fn() }),
    },
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    Image: () => null,
    FlatList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (args: { item: unknown }) => React.ReactNode;
    }) => element(
      "div",
      { "data-testid": "tickets-list", style: { maxHeight: 120, overflowY: "auto" } },
      ...data.map((item, index) =>
        element(ReactModule.Fragment, { key: index }, renderItem({ item })),
      ),
    ),
    Modal: nativeComponent("div"),
    Platform: { OS: "ios" },
    Pressable: nativeComponent("button"),
    RefreshControl: () => null,
    ScrollView: (props: Record<string, any>) => element(
      "div",
      { "data-testid": "clients-list", style: { maxHeight: 120, overflowY: "auto" } },
      props.children,
    ),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: nativeComponent("span"),
    TextInput: nativeComponent("input"),
    TouchableOpacity: nativeComponent("button"),
    View: nativeComponent("div"),
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 1, fontScale: 1 }),
    useColorScheme: () => "light",
  };
});

vi.mock("expo-router", async () => {
  const ReactModule = await import("react");
  const Tabs = ({
    children: _children,
    screenOptions,
    detachInactiveScreens = true,
  }: {
    children: React.ReactNode;
    detachInactiveScreens?: boolean;
    screenOptions?: (args: {
      navigation: { navigate: (route: string, params?: { returnTo?: string }) => void };
      route: { name: string; params?: { returnTo?: string } };
    }) => {
      headerLeft?: () => React.ReactNode;
      headerRight?: () => React.ReactNode;
      headerTitle?: () => React.ReactNode;
    };
  }) => {
    const [activeRoute, setActiveRoute] = ReactModule.useState(mocks.initialRoute);
    const [returnTo, setReturnTo] = ReactModule.useState<string | undefined>();
    const navigation = {
      navigate: (route: string, params?: { returnTo?: string }) => {
        if (route === "profile") setReturnTo(params?.returnTo);
        setActiveRoute(route);
      },
    };
    const routeOptions = screenOptions?.({
      navigation,
      route: {
        name: activeRoute,
        ...(activeRoute === "profile" && returnTo ? { params: { returnTo } } : {}),
      },
    });
    const routeScreens = [
      { name: "tickets", component: TicketsScreen },
      { name: "clients-tab", component: ClientsScreen },
    ];

    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "div",
        { "data-testid": "active-route" },
        activeRoute,
        routeOptions?.headerTitle?.(),
        routeOptions?.headerLeft?.(),
        routeOptions?.headerRight?.(),
      ),
      ...routeScreens
        .filter(({ name }) => !detachInactiveScreens || name === activeRoute)
        .map(({ name, component: Screen }) =>
          ReactModule.createElement(
            "div",
            {
              key: name,
              "data-tab-screen": name,
              style: { display: name === activeRoute ? "block" : "none" },
            },
            ReactModule.createElement(Screen),
          ),
        ),
    );
  };
  Tabs.Screen = () => null;

  return {
    Tabs,
    useLocalSearchParams: () => ({ search: mocks.routeSearch }),
    useRouter: () => ({ push: vi.fn() }),
    router: { push: vi.fn() },
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
  useAuth: () => ({ user: { id: 1, role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "en",
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
        reports: "Reports",
      },
      dashboard: { searchPlaceholder: "Search" },
      tickets: {
        search: "Search tickets",
        all: "All",
        recurring: "Recurring",
        noTickets: "No tickets",
        resolvedNote: "Resolved",
        unassigned: "Unassigned",
      },
      priority: { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" },
      status: {},
    },
  }),
}));
vi.mock("@/hooks/useTicketStatuses", () => ({
  useTicketStatuses: () => ({ statuses: [], getLabelForKey: () => undefined }),
}));
vi.mock("@/utils/api", () => ({
  PRIORITY_COLORS: { urgent: "#f00", high: "#f80", normal: "#08f", low: "#888" },
  apiGet: mocks.apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({
    queryKey,
    queryFn,
  }: {
    queryKey: (string | number | boolean)[];
    queryFn?: () => Promise<unknown>;
  }) => {
    if (queryKey[0] === "mobile-organization-settings") {
      return {
        data: { clientsEnabled: mocks.clientsEnabled, timeTrackingModuleEnabled: false },
        isSuccess: true,
        isLoading: false,
      };
    }
    if (queryKey[0] === "mobile-notifications") {
      return { data: [] };
    }
    if (queryKey[0] === "mobile-dashboard-ticket-search") {
      return {
        data: mocks.dashboardTickets,
        isLoading: false,
        isFetching: false,
        isError: false,
      };
    }
    if (queryKey[0] === "mobile-clients") {
      return {
        data: Array.from({ length: 30 }, (_, index) => ({
          id: index + 1,
          name: `Client ${index + 1}`,
        })),
        isLoading: false,
        error: null,
      };
    }
    if (queryKey[0] === "tickets") {
      mocks.ticketQueryFn = queryFn;
      return {
        data: Array.from({ length: 30 }, (_, index) => ({
          id: index + 1,
          title: `Ticket ${index + 1}`,
          description: "",
          status: "open",
          priority: "normal",
          category: "General",
          location: "",
          createdAt: "2026-10-25T00:00:00Z",
        })),
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe("mobile list position after returning from Profile", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.initialRoute = "tickets";
    mocks.clientsEnabled = true;
    mocks.routeSearch = undefined;
    mocks.ticketQueryFn = undefined;
    mocks.dashboardTickets = [];
    mocks.apiGet.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("uses the complete server-side search when opening a filtered ticket list", async () => {
    mocks.routeSearch = "invoice & renewal";
    await act(async () => root.render(React.createElement(TicketsScreen)));

    expect(mocks.ticketQueryFn).toBeTypeOf("function");
    await mocks.ticketQueryFn?.();

    expect(mocks.apiGet).toHaveBeenCalledWith(
      "/tickets?search=invoice%20%26%20renewal",
    );
  });

  it("shows client and assignee on dashboard ticket suggestions at a narrow mobile width", async () => {
    mocks.initialRoute = "index";
    mocks.dashboardTickets = [{
      id: 41,
      title: "Printer outage",
      status: "open",
      client: { name: "Northwind" },
      assignee: { name: "Avery Chen" },
    }];

    await act(async () => root.render(React.createElement(TabLayout)));

    const searchInput = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    expect(searchInput).not.toBeNull();
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(searchInput, "printer");
      searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const result = host.querySelector<HTMLButtonElement>(
      '[data-testid="dashboard-ticket-result-41"]',
    );
    expect(result?.textContent).toContain("Client: Northwind");
    expect(result?.textContent).toContain("Assigned to: Avery Chen");
    expect(result?.getAttribute("aria-label")).toContain("Client: Northwind");
    expect(result?.getAttribute("aria-label")).toContain("Assigned to: Avery Chen");
  });

  it.each([
    { route: "tickets", listTestId: "tickets-list" },
    { route: "clients-tab", listTestId: "clients-list" },
  ])("retains the $route scroll position when Profile is opened and closed", async ({
    route,
    listTestId,
  }) => {
    mocks.initialRoute = route;
    await act(async () => root.render(React.createElement(TabLayout)));

    const listBefore = host.querySelector<HTMLDivElement>(`[data-testid="${listTestId}"]`);
    expect(listBefore).not.toBeNull();
    listBefore!.scrollTop = 640;

    const profileButton = host.querySelector<HTMLButtonElement>(
      '[data-testid="profile-header-button"]',
    );
    expect(profileButton).not.toBeNull();
    await act(async () => profileButton!.click());
    expect(host.querySelector('[data-testid="active-route"]')?.textContent).toContain("profile");

    const backButton = host.querySelector<HTMLButtonElement>(
      '[data-testid="profile-back-button"]',
    );
    expect(backButton).not.toBeNull();
    await act(async () => backButton!.click());

    const listAfter = host.querySelector<HTMLDivElement>(`[data-testid="${listTestId}"]`);
    expect(host.querySelector('[data-testid="active-route"]')?.textContent).toContain(route);
    expect(listAfter).toBe(listBefore);
    expect(listAfter?.scrollTop).toBe(640);
  });
});
