import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
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
  getMobileOrganizationSettingsRefetchInterval,
  getMobileOrganizationSettingsQueryKey,
  getMobileOptionalTabAccess,
  shouldHideCalendarTab,
} from "@/utils/optionalTabs";
import { getMobileBottomBarLayout } from "@/utils/mobileBottomBarLayout";

type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0] & {
  hiddenRoutes: string[];
  showNewTicketTab: boolean;
  showOrganizationSettingsError: boolean;
  organizationSettingsRetrying: boolean;
  onRetryOrganizationSettings: () => void;
};

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
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [search, setSearch] = React.useState("");
  const organizationSettings = useQuery({
    queryKey: getMobileOrganizationSettingsQueryKey(user?.organizationId),
    queryFn: () => apiGet<{ clientsEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const clientsEnabled =
    user?.organizationId != null &&
    organizationSettings.isSuccess &&
    !organizationSettings.isError &&
    organizationSettings.data?.clientsEnabled === true;
  const clientsQuery = useQuery({
    queryKey: ["mobile-clients", user?.organizationId],
    queryFn: () => apiGet<DashboardClient[]>("/clients"),
    enabled: clientsEnabled && search.trim().length >= 2,
  });
  const ticketSearch = search.trim();
  const ticketsQuery = useQuery({
    queryKey: ["mobile-dashboard-ticket-search", user?.organizationId, ticketSearch],
    queryFn: () =>
      apiGet<DashboardTicket[]>(
        `/tickets?search=${encodeURIComponent(ticketSearch)}&limit=4`,
      ),
    enabled: user?.organizationId != null && ticketSearch.length >= 2,
    staleTime: 10_000,
  });
  const matchingClients = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (query.length < 2) return [];
    return (clientsQuery.data ?? [])
      .filter((client) =>
        `${client.name} ${client.alias ?? ""} ${client.email ?? ""} ${client.phone ?? ""} ${client.address ?? ""}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .slice(0, 4);
  }, [clientsQuery.data, search]);
  const matchingTickets = ticketsQuery.data ?? [];

  const submitSearch = () => {
    const query = search.trim();
    if (!query) return;
    router.push({ pathname: "/(tabs)/tickets", params: { search: query } });
  };

  const showClientResults =
    search.trim().length >= 2 && clientsEnabled;
  const showSearchResults =
    search.trim().length >= 2 && user?.organizationId != null;

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
      {showSearchResults ? (
        <View
          style={[
            styles.dashboardClientResults,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.foreground,
            },
          ]}
          testID="dashboard-search-results"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.dashboardSearchResultsScroll}
            showsVerticalScrollIndicator={false}
          >
            <View testID="dashboard-ticket-search-results">
              <Text style={[styles.dashboardClientResultsHeading, { color: colors.mutedForeground }]}>
                {lang === "it" ? "Ticket" : "Tickets"}
              </Text>
              {ticketsQuery.isLoading || ticketsQuery.isFetching ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.dashboardClientStatus}
                  testID="dashboard-ticket-search-loading"
                />
              ) : ticketsQuery.isError ? (
                <Text style={[styles.dashboardClientStatusText, { color: colors.mutedForeground }]}>
                  {lang === "it" ? "Impossibile caricare i ticket." : "Could not load tickets."}
                </Text>
              ) : matchingTickets.length === 0 ? (
                <Text style={[styles.dashboardClientStatusText, { color: colors.mutedForeground }]}>
                  {lang === "it" ? "Nessun ticket trovato." : "No tickets found."}
                </Text>
              ) : (
                matchingTickets.map((ticket) => (
                  <Pressable
                    key={ticket.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${ticket.title}, ${lang === "it" ? "ticket" : "ticket"} ${ticket.id}`}
                    testID={`dashboard-ticket-result-${ticket.id}`}
                    onPress={() => {
                      setSearch("");
                      router.push(`/ticket/${ticket.id}` as any);
                    }}
                    style={({ pressed }) => [
                      styles.dashboardClientResult,
                      { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <View style={[styles.dashboardClientIcon, { backgroundColor: colors.muted }]}>
                      <Feather name="file-text" size={15} color={colors.primary} />
                    </View>
                    <View style={styles.dashboardClientText}>
                      <Text style={[styles.dashboardClientName, { color: colors.foreground }]} numberOfLines={1}>
                        {ticket.title}
                      </Text>
                      <Text style={[styles.dashboardClientMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        #{ticket.id}{ticket.status ? ` · ${ticket.status}` : ""}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                ))
              )}
            </View>
            {showClientResults ? (
              <View testID="dashboard-client-search-results">
                <Text style={[styles.dashboardClientResultsHeading, { color: colors.mutedForeground }]}>
                  {lang === "it" ? "Clienti" : "Clients"}
                </Text>
                {clientsQuery.isLoading || clientsQuery.isFetching ? (
                  <ActivityIndicator color={colors.primary} style={styles.dashboardClientStatus} />
                ) : clientsQuery.isError ? (
                  <Text style={[styles.dashboardClientStatusText, { color: colors.mutedForeground }]}>
                    {lang === "it" ? "Impossibile caricare i clienti." : "Could not load clients."}
                  </Text>
                ) : matchingClients.length === 0 ? (
                  <Text style={[styles.dashboardClientStatusText, { color: colors.mutedForeground }]}>
                    {lang === "it" ? "Nessun cliente trovato." : "No clients found."}
                  </Text>
                ) : (
                  matchingClients.map((client) => (
                    <Pressable
                      key={client.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${client.name}${client.alias ? `, ${client.alias}` : ""}`}
                      testID={`dashboard-client-result-${client.id}`}
                      onPress={() => {
                        setSearch("");
                        router.push(`/clients/${client.id}`);
                      }}
                      style={({ pressed }) => [
                        styles.dashboardClientResult,
                        { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 },
                      ]}
                    >
                      <View style={[styles.dashboardClientIcon, { backgroundColor: colors.muted }]}>
                        <Feather name="briefcase" size={15} color={colors.primary} />
                      </View>
                      <View style={styles.dashboardClientText}>
                        <Text style={[styles.dashboardClientName, { color: colors.foreground }]} numberOfLines={1}>
                          {client.name}
                        </Text>
                        {!!(client.alias || client.email || client.phone) ? (
                          <Text style={[styles.dashboardClientMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {client.alias || client.email || client.phone}
                          </Text>
                        ) : null}
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

type DashboardClient = {
  id: number;
  name: string;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type DashboardTicket = {
  id: number;
  title: string;
  status?: string | null;
};

function getProfileReturnRoute(
  value: unknown,
  optionalTabAccess: ReturnType<typeof getMobileOptionalTabAccess>,
  hideCalendarTab: boolean,
): ProfileReturnRoute | undefined {
  if (
    typeof value !== "string" ||
    !(PROFILE_RETURN_ROUTES as readonly string[]).includes(value)
  ) {
    return undefined;
  }

  if (value === "clients-tab" && !optionalTabAccess.clients) return undefined;
  if (value === "hours-report-tab" && !optionalTabAccess.hoursReport) return undefined;
  if (value === "calendar" && hideCalendarTab) return undefined;

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
    refetchInterval: getMobileOrganizationSettingsRefetchInterval(appState === "active"),
    refetchIntervalInBackground: false,
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
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState);
      if (nextAppState === "active") {
        void organizationSettings.refetch();
      }
    });
    return () => subscription.remove();
  }, [organizationSettings.refetch]);
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
    settingsLoaded:
      organizationSettings.isSuccess && !organizationSettings.isError,
    isOrganizationAdmin:
      user?.role === "admin" && user.organizationId != null,
  });
  const clientsEnabled = optionalTabAccess.clients;
  const hoursReportEnabled = optionalTabAccess.hoursReport;
  const hideCalendarTab = shouldHideCalendarTab({
    settings: organizationSettings.data,
    hasOrganization: user?.organizationId != null,
    settingsLoaded:
      organizationSettings.isSuccess && !organizationSettings.isError,
  });
  const showOrganizationSettingsError =
    user?.organizationId != null && organizationSettings.isError;
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
          showOrganizationSettingsError={showOrganizationSettingsError}
          organizationSettingsRetrying={organizationSettings.isFetching}
          onRetryOrganizationSettings={() => {
            void organizationSettings.refetch();
          }}
        />
      )}
      screenOptions={({ navigation, route }) => {
        const returnTo =
          route.name === "profile"
            ? getProfileReturnRoute(
                (route.params as { returnTo?: unknown } | undefined)?.returnTo,
                optionalTabAccess,
                hideCalendarTab,
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
  showOrganizationSettingsError,
  organizationSettingsRetrying,
  onRetryOrganizationSettings,
}: TabBarProps) {
  const colors = useColors();
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const bottomPadding = isWeb ? 34 : Math.max(insets.bottom, 4);
  const gridHeight = 52;
  const settingsNoticeHeight = showOrganizationSettingsError ? 72 : 0;
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
          height: gridHeight + bottomPadding + settingsNoticeHeight,
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
      {showOrganizationSettingsError ? (
        <View
          accessibilityRole="alert"
          testID="organization-settings-unavailable"
          style={[
            styles.settingsUnavailableNotice,
            { backgroundColor: colors.muted, borderBottomColor: colors.border },
          ]}
        >
          <Feather name="alert-circle" size={17} color={colors.destructive} />
          <Text
            style={[styles.settingsUnavailableText, { color: colors.foreground }]}
          >
            {lang === "it"
              ? "Impossibile caricare le impostazioni. Le sezioni opzionali restano nascoste finché l’accesso non è verificato."
              : "Organization settings couldn’t load. Optional sections stay hidden until access can be verified."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={lang === "it" ? "Riprova" : "Retry"}
            testID="retry-organization-settings"
            disabled={organizationSettingsRetrying}
            onPress={onRetryOrganizationSettings}
            style={styles.settingsRetryButton}
          >
            <Text
              style={[
                styles.settingsRetryText,
                {
                  color: organizationSettingsRetrying
                    ? colors.mutedForeground
                    : colors.primary,
                },
              ]}
            >
              {organizationSettingsRetrying
                ? lang === "it"
                  ? "Caricamento…"
                  : "Loading…"
                : lang === "it"
                  ? "Riprova"
                  : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
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
  settingsUnavailableNotice: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingsUnavailableText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter_500Medium",
  },
  settingsRetryButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  settingsRetryText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
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
    overflow: "visible",
    zIndex: 10,
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
  dashboardClientResults: {
    position: "absolute",
    top: 42,
    left: 40,
    right: 0,
    zIndex: 20,
    elevation: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  dashboardSearchResultsScroll: {
    maxHeight: 340,
  },
  dashboardClientResultsHeading: {
    paddingHorizontal: 6,
    paddingBottom: 5,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
  },
  dashboardClientStatus: {
    paddingVertical: 10,
  },
  dashboardClientStatusText: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dashboardClientResult: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
  },
  dashboardClientIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  dashboardClientText: {
    flex: 1,
    gap: 2,
  },
  dashboardClientName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  dashboardClientMeta: {
    fontSize: 11,
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
