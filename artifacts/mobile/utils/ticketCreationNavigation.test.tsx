// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardScreen from "../app/(tabs)";
import TabLayout from "../app/(tabs)/_layout";

const mocks = vi.hoisted(() => ({
  user: { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7, mainLocation: null as string | null },
  organizationSettings: { clientsEnabled: false, timeTrackingModuleEnabled: false },
  organizationSettingsError: false,
  organizationSettingsRefetchError: false,
  organizationSettingsLoading: false,
  settingsRefetch: vi.fn(),
  appStateChange: null as null | ((nextAppState: string) => void),
  weatherConsentValue: "declined" as string | null,
  weatherStorageSet: vi.fn(),
  clients: [] as { id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null }[],
  clientResultsByOrganization: null as null | Record<
    number,
    { id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null }[]
  >,
  clientSearchLoading: false,
  clientSearchError: false,
  clientSearchRefetch: vi.fn(),
  queryCacheKeys: [] as unknown[][],
  removeQueries: vi.fn(),
  clientSearchQuery: null as null | {
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    enabled?: boolean;
  },
  searchResultsByQuery: {} as Record<string, { search: string; results: unknown[] }>,
  apiGet: vi.fn(),
  recentTickets: [] as {
    id: number;
    title: string;
    status: string;
    priority: string;
    category: string;
    createdAt: string;
    latestActivity?: { actionType: string; actorName: string | null; createdAt: string } | null;
  }[],
  ticketSearchResults: [] as { id: number; title: string; status?: string | null }[],
  ticketSearchResultsByOrganization: null as null | Record<
    number,
    { id: number; title: string; status?: string | null }[]
  >,
  ticketSearchLoading: false,
  ticketSearchError: false,
  ticketSearchRefetch: vi.fn(),
  ticketSearchQuery: null as null | {
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
  },
  platformOS: "ios" as "ios" | "android" | "web",
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
  alert: vi.fn(),
  locationPermission: { granted: false, canAskAgain: true, status: "undetermined" },
  requestLocationPermission: vi.fn(async () => ({ granted: false, canAskAgain: true, status: "undetermined" })),
  hasLocationServices: vi.fn(async () => true),
  getLastKnownPosition: vi.fn(async () => null),
  getCurrentPosition: vi.fn(async () => ({ coords: { latitude: 45.4642, longitude: 9.19 } })),
  reverseGeocode: vi.fn(async () => [{ city: "Milano", country: "Italia" }]),
}));

vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  useForegroundPermissions: () => [mocks.locationPermission, mocks.requestLocationPermission],
  hasServicesEnabledAsync: mocks.hasLocationServices,
  getLastKnownPositionAsync: mocks.getLastKnownPosition,
  getCurrentPositionAsync: mocks.getCurrentPosition,
  reverseGeocodeAsync: mocks.reverseGeocode,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => mocks.weatherConsentValue),
    setItem: mocks.weatherStorageSet,
  },
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
    Alert: { alert: mocks.alert },
    Linking: { openSettings: vi.fn(async () => {}) },
    AppState: {
      currentState: "active",
      addEventListener: vi.fn(
        (_event: string, listener: (nextAppState: string) => void) => {
          mocks.appStateChange = listener;
          return { remove: vi.fn() };
        },
      ),
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
vi.mock("expo-linear-gradient", async () => {
  const ReactModule = await import("react");
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement("div", { "data-testid": "dashboard-greeting-card" }, children),
  };
});
vi.mock("expo-symbols", () => ({ SymbolView: () => null }));
vi.mock("@expo/vector-icons", () => ({ Feather: () => null, MaterialCommunityIcons: () => null }));
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
        weatherConsentTitle: "Enable weather?",
        weatherConsentMessage: "Send approximate location for weather.",
        weatherContinue: "Enable weather",
        weatherNotNow: "Not now",
        weatherTapToEnable: "Tap to enable",
        weatherLoading: "Weather…",
        weatherRetry: "Tap to retry",
        weatherUnavailable: "Weather unavailable",
        useGpsLocation: "Use GPS location",
        refreshGpsLocation: "Refresh GPS location",
        searchPlaceholder: "Search Taskdesk",
        open: "Open",
        inProgress: "In progress",
        urgent: "Urgent",
        closed: "Closed",
        recentActivity: "Recent activity",
        seeAll: "See all",
        noRecentTickets: "No recent tickets",
        activityNotRecorded: "Activity not recorded",
      },
      profile: { user: "User" },
      tickets: { search: "Search tickets" },
      status: {},
    },
  }),
}));
vi.mock("@/utils/api", () => ({
  PRIORITY_COLORS: {},
  apiGet: mocks.apiGet,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ removeQueries: mocks.removeQueries }),
  useQuery: ({
    queryKey,
    queryFn,
    enabled,
  }: {
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    enabled?: boolean;
  }) => {
    const isWeather = queryKey[0] === "/api/weather/current";
    const isOrganizationSettings = queryKey[0] === "mobile-organization-settings";
    const isTicketSearch = queryKey[0] === "mobile-dashboard-ticket-search";
    if (queryKey[0] === "mobile-dashboard-client-search") {
      mocks.clientSearchQuery = { queryKey, queryFn, enabled };
    }
    if (isTicketSearch) {
      mocks.ticketSearchQuery = { queryKey, queryFn };
    }
    return {
      data: isOrganizationSettings
        ? mocks.organizationSettings
        : isWeather
          ? undefined
          : queryKey[0] === "mobile-dashboard-client-search"
            ? mocks.searchResultsByQuery[JSON.stringify(queryKey)] ?? {
                search: String(queryKey[2] ?? ""),
                results:
                  typeof queryKey[1] === "number" && mocks.clientResultsByOrganization
                    ? mocks.clientResultsByOrganization[queryKey[1]] ?? []
                    : mocks.clients,
              }
            : isTicketSearch
              ? mocks.searchResultsByQuery[JSON.stringify(queryKey)] ?? {
                  search: String(queryKey[2] ?? ""),
                  results:
                    typeof queryKey[1] === "number" && mocks.ticketSearchResultsByOrganization
                      ? mocks.ticketSearchResultsByOrganization[queryKey[1]] ?? []
                      : mocks.ticketSearchResults,
                }
              : queryKey[0] === "recent-tickets"
                ? mocks.recentTickets
                : mocks.notifications,
      isLoading: !isWeather && (
        (queryKey[0] === "mobile-dashboard-client-search" && mocks.clientSearchLoading) ||
        isTicketSearch && mocks.ticketSearchLoading ||
        isOrganizationSettings && mocks.organizationSettingsLoading
      ),
      isFetching: !isWeather && (
        (queryKey[0] === "mobile-dashboard-client-search" && mocks.clientSearchLoading) ||
        isOrganizationSettings && mocks.organizationSettingsLoading
      ),
      isSuccess:
        isOrganizationSettings &&
        !mocks.organizationSettingsError &&
        !mocks.organizationSettingsLoading,
      isError:
        isWeather
          ? false
          : isOrganizationSettings
            ? mocks.organizationSettingsError
            : isTicketSearch
              ? mocks.ticketSearchError
              : queryKey[0] === "mobile-dashboard-client-search" && mocks.clientSearchError,
      isRefetchError:
        isOrganizationSettings && mocks.organizationSettingsRefetchError,
      refetch: isOrganizationSettings
        ? mocks.settingsRefetch
        : isTicketSearch
          ? mocks.ticketSearchRefetch
          : queryKey[0] === "mobile-dashboard-client-search"
            ? mocks.clientSearchRefetch
          : vi.fn(),
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
    mocks.user = { id: 5, name: "Ada Lovelace", role: "member", organizationId: 7, mainLocation: null };
    mocks.organizationSettings = { clientsEnabled: false, timeTrackingModuleEnabled: false };
    mocks.organizationSettingsError = false;
    mocks.organizationSettingsRefetchError = false;
    mocks.organizationSettingsLoading = false;
    mocks.settingsRefetch.mockReset();
    mocks.appStateChange = null;
    mocks.weatherConsentValue = "declined";
    mocks.weatherStorageSet.mockReset();
    mocks.clients = [];
    mocks.clientResultsByOrganization = null;
    mocks.clientSearchQuery = null;
    mocks.clientSearchLoading = false;
    mocks.clientSearchError = false;
    mocks.clientSearchRefetch.mockReset();
    mocks.queryCacheKeys = [];
    mocks.removeQueries.mockReset();
    mocks.removeQueries.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      mocks.queryCacheKeys = mocks.queryCacheKeys.filter(
        (cachedKey) => !queryKey.every((part, index) => cachedKey[index] === part),
      );
    });
    mocks.searchResultsByQuery = {};
    mocks.apiGet.mockReset();
    mocks.recentTickets = [];
    mocks.ticketSearchResults = [];
    mocks.ticketSearchResultsByOrganization = null;
    mocks.ticketSearchLoading = false;
    mocks.ticketSearchError = false;
    mocks.ticketSearchRefetch.mockReset();
    mocks.ticketSearchQuery = null;
    mocks.platformOS = "ios";
    mocks.screenWidth = 390;
    mocks.language = "en";
    mocks.notifications = [{ id: 1, isRead: false }, { id: 2, isRead: false }];
    mocks.profileReturnTo = undefined;
    mocks.push.mockReset();
    mocks.navigate.mockReset();
    mocks.announce.mockReset();
    mocks.alert.mockReset();
    mocks.locationPermission = { granted: false, canAskAgain: true, status: "undetermined" };
    mocks.requestLocationPermission.mockReset();
    mocks.requestLocationPermission.mockResolvedValue({ granted: false, canAskAgain: true, status: "undetermined" });
    mocks.hasLocationServices.mockReset();
    mocks.hasLocationServices.mockResolvedValue(true);
    mocks.getLastKnownPosition.mockReset();
    mocks.getLastKnownPosition.mockResolvedValue(null);
    mocks.getCurrentPosition.mockReset();
    mocks.getCurrentPosition.mockResolvedValue({ coords: { latitude: 45.4642, longitude: 9.19 } });
    mocks.reverseGeocode.mockReset();
    mocks.reverseGeocode.mockResolvedValue([{ city: "Milano", country: "Italia" }]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("keeps the Dashboard greeting concise and makes the first name visible", async () => {
    mocks.user.mainLocation = "Milano";
    await render(DashboardScreen);

    const greeting = host.querySelector('[data-testid="dashboard-greeting-line"]');
    expect(greeting?.textContent).toMatch(/^Good (morning|afternoon|evening)Ada$/);
    expect(host.querySelector('[data-testid="dashboard-greeting-name"]')?.textContent).toBe("Ada");
    expect(greeting?.textContent).not.toContain("Lovelace");
    expect(host.textContent).toContain("Your day");
    expect(host.querySelector('[data-testid="dashboard-hero-date"]')?.textContent).toBeTruthy();
    expect(host.querySelector('[data-testid="dashboard-hero-time"]')).toBeNull();
    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Milano");
    expect(host.textContent).not.toContain("at a glance");
    expect(host.querySelector('[data-testid="dashboard-greeting-card"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="dashboard-create-ticket"]')).toBeNull();
  });

  it("names the latest ticket activity and its actor in Recent Activity", async () => {
    mocks.recentTickets = [{
      id: 72,
      title: "VPN access request",
      status: "in_progress",
      priority: "normal",
      category: "support",
      createdAt: "2026-11-11T10:00:00.000Z",
      latestActivity: {
        actionType: "status_changed",
        actorName: "Luca",
        createdAt: "2026-11-11T11:00:00.000Z",
      },
    }];
    await render(DashboardScreen);

    expect(host.querySelector('[data-testid="dashboard-recent-ticket-activity-72"]')?.textContent)
      .toBe("Status changed · Luca");
  });

  it("asks for GPS on opening and keeps the GPS action available", async () => {
    await render(DashboardScreen);
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-testid="dashboard-hero-gps-button"]')).not.toBeNull();
    expect(mocks.requestLocationPermission).not.toHaveBeenCalled();

    const firstPromptButtons = mocks.alert.mock.calls[0]?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => firstPromptButtons?.[0]?.onPress?.());
    await act(async () => mocks.appStateChange?.("background"));
    await act(async () => mocks.appStateChange?.("active"));
    expect(mocks.alert).toHaveBeenCalledTimes(2);

    mocks.user.mainLocation = "Roma";
    await act(async () => root.render(React.createElement(DashboardScreen)));
    expect(host.querySelector('[data-testid="dashboard-hero-gps-button"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Roma");
    expect(mocks.requestLocationPermission).not.toHaveBeenCalled();
  });

  it("shows the GPS locality in place of the profile location after consent", async () => {
    mocks.user.mainLocation = "Roma";
    mocks.requestLocationPermission.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: "granted",
    });
    await render(DashboardScreen);

    const alertButtons = mocks.alert.mock.calls[0]?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => {
      alertButtons?.[1]?.onPress?.();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Milano, Italia");
    });

    expect(mocks.requestLocationPermission).toHaveBeenCalledOnce();
    expect(mocks.getCurrentPosition).toHaveBeenCalledOnce();
    expect(mocks.reverseGeocode).toHaveBeenCalledOnce();
  });

  it("uses GPS on opening without prompting again when permission is granted", async () => {
    mocks.user.mainLocation = "Roma";
    mocks.locationPermission = { granted: true, canAskAgain: false, status: "granted" };
    await render(DashboardScreen);

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Milano, Italia");
    });
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.requestLocationPermission).not.toHaveBeenCalled();
  });

  it("stops the GPS spinner and keeps the profile location if GPS never responds", async () => {
    mocks.user.mainLocation = "Roma";
    mocks.locationPermission = { granted: true, canAskAgain: false, status: "granted" };
    mocks.getCurrentPosition.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    await render(DashboardScreen);

    const locationButton = host.querySelector('[data-testid="dashboard-hero-gps-button"]');
    expect(locationButton?.textContent).toContain("Finding location");
    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Roma");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(locationButton?.textContent).not.toContain("Finding location");
    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Roma");
    expect(mocks.alert).toHaveBeenCalledOnce();
  });

  it("stops the GPS spinner when reverse geocoding does not respond", async () => {
    mocks.user.mainLocation = "Roma";
    mocks.locationPermission = { granted: true, canAskAgain: false, status: "granted" };
    mocks.reverseGeocode.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    await render(DashboardScreen);

    const locationButton = host.querySelector('[data-testid="dashboard-hero-gps-button"]');
    expect(locationButton?.textContent).toContain("Finding location");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(locationButton?.textContent).not.toContain("Finding location");
    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("Roma");
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("stops the GPS spinner if the device services check hangs", async () => {
    mocks.locationPermission = { granted: true, canAskAgain: false, status: "granted" };
    mocks.hasLocationServices.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    await render(DashboardScreen);

    const locationButton = host.querySelector('[data-testid="dashboard-hero-gps-button"]');
    expect(locationButton?.textContent).toContain("Finding location");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(locationButton?.textContent).not.toContain("Finding location");
    expect(mocks.getCurrentPosition).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });

  it("uses browser geolocation and shows approximate coordinates without external geocoding", async () => {
    mocks.platformOS = "web";
    mocks.locationPermission = { granted: false, canAskAgain: true, status: "undetermined" };
    await render(DashboardScreen);

    const locationButton = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-hero-gps-button"]');
    expect(locationButton).not.toBeNull();
    await act(async () => locationButton?.click());
    const disclosureButtons = mocks.alert.mock.calls[0]?.[2] as Array<{ onPress?: () => void }> | undefined;
    await act(async () => disclosureButtons?.[1]?.onPress?.());

    expect(host.querySelector('[data-testid="dashboard-hero-location"]')?.textContent).toBe("45.46, 9.19");
    expect(mocks.reverseGeocode).not.toHaveBeenCalled();
    expect(mocks.requestLocationPermission).not.toHaveBeenCalled();
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
    ];
    vi.useFakeTimers();
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const result = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-31"]');
    expect(result?.textContent).toContain("Studio Aurora");
    expect(host.querySelector('[data-testid="dashboard-client-result-32"]')).toBeNull();

    await act(async () => result?.click());
    expect(mocks.push).toHaveBeenCalledWith("/clients/31");
  });

  it("hides and restores client suggestions when access is toggled in place", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    mocks.clients = [
      { id: 31, name: "Studio Aurora", alias: "Aurora" },
    ];
    mocks.ticketSearchResults = [
      { id: 41, title: "Aurora installation", status: "open" },
    ];
    vi.useFakeTimers();
    await render(TabLayout);

    const dashboardHeader = host.querySelector('[data-header-route="index"]');
    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const staleSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-31"]');
    expect(staleSuggestion?.textContent).toContain("Studio Aurora");
    expect(mocks.clientSearchQuery?.enabled).toBe(true);

    mocks.queryCacheKeys = [
      ["mobile-dashboard-client-search", 7, "aurora", 4],
      ["mobile-dashboard-client-search", 7, "studio", 4],
      ["mobile-dashboard-client-search", 8, "aurora", 4],
      ["mobile-dashboard-ticket-search", 7, "aurora"],
      ["mobile-organization-settings", 7],
    ];
    mocks.organizationSettings = { clientsEnabled: false, timeTrackingModuleEnabled: false };
    await render(TabLayout);

    expect(host.querySelector('[data-header-route="index"]')).toBe(dashboardHeader);
    expect(host.querySelector('[data-testid="dashboard-header-search"]')).toBe(input);
    expect(host.querySelector('[data-testid="dashboard-client-search-results"]')).toBeNull();
    expect(host.querySelector('[data-testid="dashboard-client-result-31"]')).toBeNull();
    expect(host.querySelector('[data-testid="dashboard-ticket-result-41"]')).not.toBeNull();
    expect(mocks.clientSearchQuery?.enabled).toBe(false);

    await act(async () => staleSuggestion?.click());
    expect(mocks.push).not.toHaveBeenCalledWith("/clients/31");
    expect(mocks.removeQueries).toHaveBeenCalledWith({
      queryKey: ["mobile-dashboard-client-search", 7],
    });
    expect(mocks.queryCacheKeys).toEqual([
      ["mobile-dashboard-client-search", 8, "aurora", 4],
      ["mobile-dashboard-ticket-search", 7, "aurora"],
      ["mobile-organization-settings", 7],
    ]);

    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    await render(TabLayout);

    const restoredSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-31"]');
    expect(host.querySelector('[data-header-route="index"]')).toBe(dashboardHeader);
    expect(host.querySelector('[data-testid="dashboard-header-search"]')).toBe(input);
    expect(input?.value).toBe("aurora");
    expect(mocks.clientSearchQuery?.queryKey[2]).toBe("aurora");
    expect(mocks.clientSearchQuery?.enabled).toBe(true);
    expect(restoredSuggestion?.textContent).toContain("Studio Aurora");

    await act(async () => restoredSuggestion?.click());
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

  it("keeps the newest ticket suggestions when searches resolve out of order", async () => {
    type TicketResult = { id: number; title: string; status?: string | null };
    const pendingRequests = new Map<string, (results: TicketResult[]) => void>();
    mocks.apiGet.mockImplementation((path: string) => {
      const search = new URLSearchParams(path.split("?")[1]).get("search") ?? "";
      return new Promise<TicketResult[]>((resolve) => pendingRequests.set(search, resolve));
    });
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    const changeSearch = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input!.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await changeSearch("older");
    const olderQuery = mocks.ticketSearchQuery!;
    const olderRequest = olderQuery.queryFn();
    await changeSearch("newer");
    const newerQuery = mocks.ticketSearchQuery!;
    const newerRequest = newerQuery.queryFn();

    let newerData: unknown;
    await act(async () => {
      pendingRequests.get("newer")?.([{ id: 52, title: "Newer result" }]);
      newerData = await newerRequest;
    });
    mocks.searchResultsByQuery[JSON.stringify(newerQuery.queryKey)] =
      newerData as { search: string; results: unknown[] };
    await render(TabLayout);
    expect(host.querySelector('[data-testid="dashboard-ticket-result-52"]')).not.toBeNull();

    let olderData: unknown;
    await act(async () => {
      pendingRequests.get("older")?.([{ id: 51, title: "Older result" }]);
      olderData = await olderRequest;
    });
    mocks.searchResultsByQuery[JSON.stringify(olderQuery.queryKey)] =
      olderData as { search: string; results: unknown[] };
    await render(TabLayout);

    expect(host.querySelector('[data-testid="dashboard-ticket-result-52"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="dashboard-ticket-result-51"]')).toBeNull();
  });

  it("does not restore ticket suggestions when a pending search resolves after clearing", async () => {
    type TicketResult = { id: number; title: string; status?: string | null };
    let resolveRequest: ((results: TicketResult[]) => void) | undefined;
    mocks.apiGet.mockImplementation(() => new Promise<TicketResult[]>((resolve) => {
      resolveRequest = resolve;
    }));
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "pending");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const pendingQuery = mocks.ticketSearchQuery!;
    const pendingRequest = pendingQuery.queryFn();

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    let pendingData: unknown;
    await act(async () => {
      resolveRequest?.([{ id: 53, title: "Late result" }]);
      pendingData = await pendingRequest;
    });
    mocks.searchResultsByQuery[JSON.stringify(pendingQuery.queryKey)] =
      pendingData as { search: string; results: unknown[] };
    await render(TabLayout);

    expect(host.querySelector('[data-testid="dashboard-search-results"]')).toBeNull();
    expect(host.querySelector('[data-testid="dashboard-ticket-result-53"]')).toBeNull();
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

  it.each([
    { language: "en" as const, retryLabel: "Retry ticket search", retryText: "Retry" },
    { language: "it" as const, retryLabel: "Riprova ricerca ticket", retryText: "Riprova" },
  ])(
    "offers an accessible ticket search retry in $language and keeps the search text",
    async ({ language, retryLabel, retryText }) => {
      mocks.language = language;
      mocks.ticketSearchError = true;
      await render(TabLayout);

      const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "billing issue");
        input!.dispatchEvent(new Event("input", { bubbles: true }));
      });

      const retry = host.querySelector<HTMLButtonElement>('[data-testid="retry-ticket-search"]');
      expect(retry?.getAttribute("aria-label")).toBe(retryLabel);
      expect(retry?.textContent).toBe(retryText);
      expect(mocks.ticketSearchQuery?.queryKey[2]).toBe("billing issue");

      await act(async () => retry?.click());
      expect(mocks.ticketSearchRefetch).toHaveBeenCalledTimes(1);

      mocks.ticketSearchError = false;
      mocks.ticketSearchLoading = true;
      await render(TabLayout);
      expect(input?.value).toBe("billing issue");
      expect(mocks.ticketSearchQuery?.queryKey[2]).toBe("billing issue");
      expect(host.querySelector('[data-testid="dashboard-ticket-search-loading"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="retry-ticket-search"]')).toBeNull();
    },
  );

  it.each([
    { language: "en" as const, retryLabel: "Retry client search", retryText: "Retry" },
    { language: "it" as const, retryLabel: "Riprova ricerca clienti", retryText: "Riprova" },
  ])(
    "offers an accessible client search retry in $language and preserves the query through a failed retry",
    async ({ language, retryLabel, retryText }) => {
      mocks.language = language;
      mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
      mocks.clientSearchError = true;
      vi.useFakeTimers();
      await render(TabLayout);

      const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "client outage");
        input!.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      const retry = host.querySelector<HTMLButtonElement>('[data-testid="retry-client-search"]');
      expect(retry?.getAttribute("aria-label")).toBe(retryLabel);
      expect(retry?.textContent).toBe(retryText);
      expect(mocks.clientSearchQuery?.queryKey[2]).toBe("client outage");

      await act(async () => retry?.click());
      expect(mocks.clientSearchRefetch).toHaveBeenCalledTimes(1);

      mocks.clientSearchError = false;
      mocks.clientSearchLoading = true;
      await render(TabLayout);
      expect(input?.value).toBe("client outage");
      expect(mocks.clientSearchQuery?.queryKey[2]).toBe("client outage");
      expect(host.querySelector('[data-testid="dashboard-client-search-loading"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="retry-client-search"]')).toBeNull();

      mocks.clientSearchLoading = false;
      mocks.clientSearchError = true;
      await render(TabLayout);
      expect(host.querySelector('[data-testid="retry-client-search"]')).not.toBeNull();
      expect(input?.value).toBe("client outage");
    },
  );

  it("shows client results after a successful search retry", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    mocks.clientSearchError = true;
    vi.useFakeTimers();
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="retry-client-search"]')?.click());

    mocks.clientSearchError = false;
    mocks.clientSearchLoading = true;
    await render(TabLayout);
    expect(host.querySelector('[data-testid="dashboard-client-search-loading"]')).not.toBeNull();

    mocks.clientSearchLoading = false;
    mocks.clients = [{ id: 52, name: "Studio Aurora" }];
    await render(TabLayout);
    expect(host.querySelector('[data-testid="dashboard-client-result-52"]')?.textContent)
      .toContain("Studio Aurora");
    expect(input?.value).toBe("aurora");
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

  it("requests dashboard client suggestions using the current server-side search", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    mocks.clients = [{ id: 31, name: "Studio Aurora", alias: "Aurora Studio" }];
    vi.useFakeTimers();
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Studio Aur");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(mocks.clientSearchQuery?.queryKey).toEqual([
      "mobile-dashboard-client-search",
      7,
      "Studio Aur",
      4,
    ]);
    expect(host.querySelector('[data-testid="dashboard-client-result-31"]')).not.toBeNull();

    await act(async () => {
      await mocks.clientSearchQuery?.queryFn();
    });
    expect(mocks.apiGet).toHaveBeenCalledWith(
      "/clients?search=Studio%20Aur&limit=4",
    );
  });

  it("debounces client lookups only and clears suggestions immediately", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    vi.useFakeTimers();
    await render(TabLayout);

    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    const changeSearch = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
        input!.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await changeSearch("ac");
    expect(mocks.ticketSearchQuery?.queryKey[2]).toBe("ac");
    expect(mocks.clientSearchQuery?.enabled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await changeSearch("acme");
    expect(mocks.ticketSearchQuery?.queryKey[2]).toBe("acme");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(mocks.clientSearchQuery?.queryKey[2]).toBe("");
    expect(mocks.clientSearchQuery?.enabled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.clientSearchQuery?.queryKey[2]).toBe("acme");
    expect(mocks.clientSearchQuery?.enabled).toBe(true);

    await changeSearch("");
    expect(mocks.ticketSearchQuery?.queryKey[2]).toBe("");
    expect(mocks.clientSearchQuery?.enabled).toBe(false);
    expect(host.querySelector('[data-testid="dashboard-search-results"]')).toBeNull();
  });

  it("drops previous-organization client suggestions while the dashboard header stays mounted", async () => {
    mocks.organizationSettings = { clientsEnabled: true, timeTrackingModuleEnabled: false };
    vi.useFakeTimers();
    mocks.clientResultsByOrganization = {
      7: [{ id: 31, name: "Studio Aurora — previous organization" }],
      8: [{ id: 81, name: "Studio Aurora — current organization" }],
    };
    await render(TabLayout);

    const dashboardHeader = host.querySelector('[data-header-route="index"]');
    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    const staleSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-31"]');
    expect(staleSuggestion?.textContent).toContain("previous organization");
    expect(mocks.clientSearchQuery?.queryKey).toEqual([
      "mobile-dashboard-client-search",
      7,
      "aurora",
      4,
    ]);

    mocks.user = { ...mocks.user, organizationId: 8 };
    await render(TabLayout);

    expect(host.querySelector('[data-header-route="index"]')).toBe(dashboardHeader);
    expect(host.querySelector('[data-testid="dashboard-header-search"]')).toBe(input);
    expect(input?.value).toBe("aurora");
    expect(host.querySelector('[data-testid="dashboard-client-result-31"]')).toBeNull();
    const currentSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-client-result-81"]');
    expect(currentSuggestion?.textContent).toContain("current organization");
    expect(mocks.clientSearchQuery?.queryKey).toEqual([
      "mobile-dashboard-client-search",
      8,
      "aurora",
      4,
    ]);

    await act(async () => staleSuggestion?.click());
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => currentSuggestion?.click());
    expect(mocks.push).toHaveBeenCalledWith("/clients/81");
    expect(mocks.push).not.toHaveBeenCalledWith("/clients/31");
  });

  it("drops previous-organization ticket suggestions while the dashboard header stays mounted", async () => {
    mocks.ticketSearchResultsByOrganization = {
      7: [{ id: 41, title: "Aurora — previous organization", status: "open" }],
      8: [{ id: 81, title: "Aurora — current organization", status: "open" }],
    };
    await render(TabLayout);

    const dashboardHeader = host.querySelector('[data-header-route="index"]');
    const input = host.querySelector<HTMLInputElement>('[data-testid="dashboard-header-search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "aurora");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const staleSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-ticket-result-41"]');
    expect(staleSuggestion?.textContent).toContain("previous organization");
    expect(mocks.ticketSearchQuery?.queryKey).toEqual([
      "mobile-dashboard-ticket-search",
      7,
      "aurora",
    ]);

    mocks.user = { ...mocks.user, organizationId: 8 };
    await render(TabLayout);

    expect(host.querySelector('[data-header-route="index"]')).toBe(dashboardHeader);
    expect(host.querySelector('[data-testid="dashboard-header-search"]')).toBe(input);
    expect(input?.value).toBe("aurora");
    expect(host.querySelector('[data-testid="dashboard-ticket-result-41"]')).toBeNull();
    const currentSuggestion = host.querySelector<HTMLButtonElement>('[data-testid="dashboard-ticket-result-81"]');
    expect(currentSuggestion?.textContent).toContain("current organization");
    expect(mocks.ticketSearchQuery?.queryKey).toEqual([
      "mobile-dashboard-ticket-search",
      8,
      "aurora",
    ]);

    await act(async () => staleSuggestion?.click());
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => currentSuggestion?.click());
    expect(mocks.push).toHaveBeenCalledWith("/ticket/81");
    expect(mocks.push).not.toHaveBeenCalledWith("/ticket/41");
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
    expect(host.querySelector('[data-testid="organization-settings-unavailable"]')).toBeNull();
  });

  it.each([
    {
      language: "en" as const,
      expectedMessage: "Organization settings couldn’t load.",
      retryLabel: "Retry",
    },
    {
      language: "it" as const,
      expectedMessage: "Impossibile caricare le impostazioni.",
      retryLabel: "Riprova",
    },
  ])(
    "explains unavailable organization settings in $language and offers a safe retry",
    async ({ language, expectedMessage, retryLabel }) => {
      mocks.language = language;
      mocks.user = { ...mocks.user, role: "admin" };
      // Even cached enabled flags must not expose sections after a settings-fetch error.
      mocks.organizationSettings = {
        clientsEnabled: true,
        timeTrackingModuleEnabled: true,
      };
      mocks.organizationSettingsError = true;
      mocks.profileReturnTo = "clients-tab";

      await render(TabLayout);

      const notice = host.querySelector('[data-testid="organization-settings-unavailable"]');
      expect(notice?.textContent).toContain(expectedMessage);
      const retry = host.querySelector<HTMLButtonElement>(
        '[data-testid="retry-organization-settings"]',
      );
      expect(retry?.getAttribute("aria-label")).toBe(retryLabel);
      expect(host.querySelector('[data-route="clients-tab"]')?.getAttribute("data-href"))
        .toBe("hidden");
      expect(host.querySelector('[data-route="hours-report-tab"]')?.getAttribute("data-href"))
        .toBe("hidden");
      expect(host.querySelector('[aria-label="Clients"]')).toBeNull();
      expect(
        host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
      ).toBeNull();

      await act(async () => retry?.click());
      expect(mocks.settingsRefetch).toHaveBeenCalledTimes(1);

      mocks.organizationSettingsError = false;
      await render(TabLayout);
      expect(
        host.querySelector('[data-testid="organization-settings-unavailable"]'),
      ).toBeNull();
      expect(host.querySelector('[data-route="clients-tab"]')?.getAttribute("data-href"))
        .toBe("visible");
      expect(
        host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
      ).not.toBeNull();
    },
  );

  it("keeps optional routes hidden when a background settings refresh fails with cached enabled flags", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.organizationSettings = {
      clientsEnabled: true,
      timeTrackingModuleEnabled: true,
    };
    mocks.organizationSettingsRefetchError = true;
    mocks.profileReturnTo = "clients-tab";

    await render(TabLayout);

    expect(host.querySelector('[data-testid="organization-settings-unavailable"]')).not.toBeNull();
    expect(host.querySelector('[data-route="clients-tab"]')?.getAttribute("data-href")).toBe("hidden");
    expect(host.querySelector('[data-route="hours-report-tab"]')?.getAttribute("data-href")).toBe("hidden");
    expect(host.querySelector('[aria-label="Clients"]')).toBeNull();
    expect(host.querySelector('[aria-label="Hours report"]')).toBeNull();
    expect(
      host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
    ).toBeNull();
  });

  it("restores only refreshed modules and valid Profile returns after settings recover on resume", async () => {
    mocks.user = { ...mocks.user, role: "admin" };
    mocks.organizationSettings = {
      clientsEnabled: true,
      timeTrackingModuleEnabled: true,
    };
    mocks.organizationSettingsRefetchError = true;
    mocks.profileReturnTo = "clients-tab";

    await render(TabLayout);

    expect(host.querySelector('[data-testid="organization-settings-unavailable"]')).not.toBeNull();
    expect(host.querySelector('[data-route="clients-tab"]')?.getAttribute("data-href")).toBe("hidden");
    expect(host.querySelector('[data-route="hours-report-tab"]')?.getAttribute("data-href")).toBe("hidden");
    expect(
      host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
    ).toBeNull();

    await act(async () => mocks.appStateChange?.("background"));
    mocks.organizationSettings = {
      clientsEnabled: false,
      timeTrackingModuleEnabled: true,
    };
    mocks.organizationSettingsRefetchError = false;
    await act(async () => mocks.appStateChange?.("active"));
    expect(mocks.settingsRefetch).toHaveBeenCalledTimes(1);

    await render(TabLayout);

    expect(host.querySelector('[data-testid="organization-settings-unavailable"]')).toBeNull();
    expect(host.querySelector('[data-route="clients-tab"]')?.getAttribute("data-href")).toBe("hidden");
    expect(host.querySelector('[data-route="hours-report-tab"]')?.getAttribute("data-href")).toBe("visible");
    expect(host.querySelector('[data-route="calendar"]')?.getAttribute("data-href")).toBe("visible");
    expect(
      host.querySelector('[data-header-route="profile"] [data-testid="profile-back-button"]'),
    ).toBeNull();

    mocks.profileReturnTo = "hours-report-tab";
    await render(TabLayout);
    const profileBackButton = host.querySelector<HTMLButtonElement>(
      '[data-header-route="profile"] [data-testid="profile-back-button"]',
    );
    expect(profileBackButton?.getAttribute("aria-label")).toBe("Back to Hours report");
    await act(async () => profileBackButton?.click());
    expect(mocks.navigate).toHaveBeenLastCalledWith("hours-report-tab");
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
