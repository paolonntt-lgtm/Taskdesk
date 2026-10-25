import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/utils/api";
import {
  getMobileOrganizationSettingsQueryKey,
  getMobileOptionalTabAccess,
  shouldHideCalendarTab,
} from "@/utils/optionalTabs";
import { getMobileBottomBarLayout } from "@/utils/mobileBottomBarLayout";

type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0] & { hiddenRoutes: string[]; showNewTicketTab: boolean };

type TabPosition = { left: `${number}%`; width: `${number}%` };
type NotificationBadgeItem = { id: number; isRead: boolean };
const PROFILE_RETURN_ROUTES = [
  "index",
  "tickets",
  "new",
  "calendar",
  "clients-tab",
  "hours-report-tab",
  "reports",
] as const;
type ProfileReturnRoute = (typeof PROFILE_RETURN_ROUTES)[number];

function DashboardSearchHeader() {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [search, setSearch] = React.useState("");

  const submitSearch = () => {
    const query = search.trim();
    if (!query) return;
    router.push({ pathname: "/(tabs)/tickets", params: { search: query } });
  };

  return (
    <View style={[styles.dashboardHeaderTitle, { width: Math.max(width - 170, 132) }]}>
      <Image
        source={require("../../assets/images/taskdesk-app-icon.png")}
        style={styles.dashboardLogo}
        accessibilityLabel="TaskDesk"
        testID="dashboard-taskdesk-logo"
      />
      <View
        style={[
          styles.dashboardSearch,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel={t.dashboard.searchPlaceholder}
          testID="dashboard-header-search"
          style={[styles.dashboardSearchInput, { color: colors.foreground }]}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder={t.dashboard.searchPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={lang === "it" ? "Cancella ricerca" : "Clear search"}
            onPress={() => setSearch("")}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function getProfileReturnRoute(
  value: unknown,
  optionalTabAccess: ReturnType<typeof getMobileOptionalTabAccess>,
): ProfileReturnRoute | undefined {
  if (
    typeof value !== "string" ||
    !(PROFILE_RETURN_ROUTES as readonly string[]).includes(value)
  ) {
    return undefined;
  }

  if (value === "clients-tab" && !optionalTabAccess.clients) return undefined;
  if (value === "hours-report-tab" && !optionalTabAccess.hoursReport) return undefined;

  return value as ProfileReturnRoute;
}

function TabContent() {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const [appState, setAppState] = React.useState(AppState.currentState);
  const seenNotificationIds = React.useRef<Set<number> | null>(null);
  const organizationSettings = useQuery({
    queryKey: getMobileOrganizationSettingsQueryKey(user?.organizationId),
    queryFn: () => apiGet<{ clientsEnabled?: boolean; timeTrackingModuleEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const notificationsQuery = useQuery({
    queryKey: ["mobile-notifications"],
    queryFn: () => apiGet<NotificationBadgeItem[]>("/notifications"),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const unreadCount =
    notificationsQuery.data?.filter((notification) => !notification.isRead).length ?? 0;
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);
  React.useEffect(() => {
    const notifications = notificationsQuery.data;
    if (!notifications) return;

    const currentIds = new Set(notifications.map((notification) => notification.id));
    const previousIds = seenNotificationIds.current;
    if (!previousIds) {
      seenNotificationIds.current = currentIds;
      return;
    }

    if (appState !== "active") return;

    const newUnreadCount = notifications.filter(
      (notification) => !notification.isRead && !previousIds.has(notification.id),
    ).length;
    seenNotificationIds.current = currentIds;

    if (newUnreadCount === 0 || Platform.OS === "web") return;
    const announcement =
      lang === "it"
        ? newUnreadCount === 1
          ? "Hai una nuova notifica."
          : `Hai ${newUnreadCount} nuove notifiche.`
        : newUnreadCount === 1
          ? "You have a new notification."
          : `You have ${newUnreadCount} new notifications.`;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [appState, lang, notificationsQuery.data]);
  const notificationLabel =
    lang === "it" ? "Notifiche" : "Notifications";
  const optionalTabAccess = getMobileOptionalTabAccess({
    settings: organizationSettings.data,
    hasOrganization: user?.organizationId != null,
    isOrganizationAdmin:
      user?.role === "admin" && user.organizationId != null,
  });
  const clientsEnabled = optionalTabAccess.clients;
  const hoursReportEnabled = optionalTabAccess.hoursReport;
  const hideCalendarTab = shouldHideCalendarTab({
    settings: organizationSettings.data,
    hasOrganization: user?.organizationId != null,
    settingsLoaded: organizationSettings.isSuccess,
  });
  const showNewTicketTab = true;
  const hiddenRoutes = [
    "reports",
    ...(hideCalendarTab ? ["calendar"] : []),
    ...(!clientsEnabled ? ["clients-tab"] : []),
    ...(!hoursReportEnabled ? ["hours-report-tab"] : []),
  ];

  return (
    <Tabs
      backBehavior="history"
      detachInactiveScreens={false}
      tabBar={(props) => (
        <BottomTabBar
          {...props}
          hiddenRoutes={hiddenRoutes}
          showNewTicketTab={showNewTicketTab}
        />
      )}
      screenOptions={({ navigation, route }) => {
        const returnTo =
          route.name === "profile"
            ? getProfileReturnRoute(
                (route.params as { returnTo?: unknown } | undefined)?.returnTo,
                optionalTabAccess,
              )
            : undefined;
        const returnLabel = returnTo
          ? {
              index: t.tabs.dashboard,
              tickets: t.tabs.tickets,
              new: t.tabs.newTicket,
              calendar: t.tabs.calendar,
              "clients-tab": t.tabs.clients,
              "hours-report-tab": t.tabs.hoursReport,
              reports: t.tabs.reports,
            }[returnTo]
          : undefined;

        return {
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
          headerTitle:
            route.name === "index" ? () => <DashboardSearchHeader /> : undefined,
          headerTitleAlign: route.name === "index" ? "left" : undefined,
          headerShadowVisible: false,
          headerLeft: returnTo
            ? () => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    lang === "it" ? `Torna a ${returnLabel}` : `Back to ${returnLabel}`
                  }
                  testID="profile-back-button"
                  hitSlop={10}
                  onPress={() => navigation.navigate(returnTo)}
                  style={styles.headerActionButton}
                >
                  <Feather name="arrow-left" size={20} color={colors.foreground} />
                </TouchableOpacity>
              )
            : undefined,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0
                    ? `${notificationLabel}, ${unreadCount} ${lang === "it" ? "da leggere" : "unread"}`
                    : notificationLabel
                }
                testID="notifications-header-button"
                hitSlop={10}
                onPress={() => router.push("/notifications")}
                style={styles.headerActionButton}
              >
                <Feather name="bell" size={20} color={colors.foreground} />
                {unreadCount > 0 ? (
                  <View
                    style={[
                      styles.notificationBadge,
                      { backgroundColor: colors.destructive, borderColor: colors.card },
                    ]}
                  >
                    <Text style={[styles.notificationBadgeText, { color: colors.primaryForeground }]}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              {route.name !== "profile" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t.tabs.profile}
                  testID="profile-header-button"
                  hitSlop={10}
                  onPress={() => navigation.navigate("profile", { returnTo: route.name })}
                  style={styles.headerActionButton}
                >
                  <Feather name="user" size={20} color={colors.foreground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ),
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.dashboard,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={24} />
            ) : (
              <Feather name="bar-chart-2" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: t.tabs.tickets,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="ticket" tintColor={color} size={24} />
            ) : (
              <Feather name="list" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t.tabs.newTicket,
          tabBarLabel: t.tabs.new,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="plus" tintColor={color} size={28} />
            ) : (
              <Feather name="plus" size={28} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t.tabs.calendar,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={24} />
            ) : (
              <Feather name="calendar" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="hours-report-tab"
        options={{
          title: t.tabs.hoursReport,
          href: hoursReportEnabled ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={24} />
            ) : (
              <Feather name="clock" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="clients-tab"
        options={{
          title: t.tabs.clients,
          href: clientsEnabled ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Feather name="briefcase" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle" tintColor={color} size={18} />
            ) : (
              <Feather name="user" size={18} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

function BottomTabBar({
  state,
  descriptors,
  navigation,
  hiddenRoutes,
  showNewTicketTab,
}: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const bottomPadding = isWeb ? 34 : Math.max(insets.bottom, 4);
  const gridHeight = 52;
  const menuRouteNames = [
    "index",
    "tickets",
    "calendar",
    "hours-report-tab",
    "clients-tab",
  ];
  const visibleMenuRoutes = menuRouteNames.filter(
    (name) =>
      !hiddenRoutes.includes(name) &&
      state.routes.some((route) => route.name === name),
  );
  const menuLayout = getMobileBottomBarLayout(visibleMenuRoutes, showNewTicketTab);
  const tabPositions: Record<string, TabPosition> = Object.fromEntries(
    menuLayout.map(({ routeName, left, width }) => [
      routeName,
      {
        left: `${left}%` as `${number}%`,
        width: `${width}%` as `${number}%`,
      },
    ]),
  );

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopColor: colors.border,
          height: gridHeight + bottomPadding,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {isIOS ? (
        <BlurView
          intensity={100}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      ) : isWeb ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
      ) : null}
      <View style={[styles.tabBarGrid, { height: gridHeight }]}>
        {state.routes.map((route, index) => {
          if (hiddenRoutes.includes(route.name)) return null;
          const position = tabPositions[route.name];
          if (!position) return null;
          const options = descriptors[route.key].options;
          const isNewAction = route.name === "new";
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.mutedForeground;
          const iconColor = isNewAction ? colors.primaryForeground : color;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = options.tabBarIcon?.({ focused, color: iconColor, size: isNewAction ? 28 : 24 });

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              activeOpacity={0.75}
              style={[
                styles.tabBarItem,
                {
                  left: position.left,
                  width: position.width,
                  height: 52,
                },
                isNewAction && styles.newActionTabItem,
              ]}
            >
              {isNewAction ? (
                <>
                  <View
                    testID="new-ticket-tab-circle"
                    style={[
                      styles.newActionCircle,
                      { backgroundColor: colors.primary, borderColor: colors.card },
                    ]}
                  >
                    {icon}
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.tabBarLabel,
                      styles.newActionLabel,
                      { color, fontFamily: focused ? "Inter_600SemiBold" : "Inter_500Medium" },
                    ]}
                  >
                    {label}
                  </Text>
                </>
              ) : (
                <>
                  {icon}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.tabBarLabel,
                      { color, fontFamily: focused ? "Inter_600SemiBold" : "Inter_500Medium" },
                    ]}
                  >
                    {label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 4,
  },
  headerActionButton: {
    position: "relative",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 8,
    lineHeight: 10,
    fontFamily: "Inter_600SemiBold",
  },
  dashboardHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  dashboardLogo: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  dashboardSearch: {
    flex: 1,
    minWidth: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
  },
  dashboardSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  tabBar: {
    borderTopWidth: 1,
    elevation: 0,
    overflow: "visible",
  },
  tabBarGrid: {
    position: "relative",
    width: "100%",
  },
  tabBarItem: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  newActionTabItem: {
    top: -14,
    height: 66,
    justifyContent: "flex-start",
    overflow: "visible",
  },
  newActionCircle: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  newActionLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarLabel: {
    maxWidth: "100%",
    fontSize: 9,
    lineHeight: 11,
    textAlign: "center",
  },
});

export default function TabLayout() {
  return <TabContent />;
}
