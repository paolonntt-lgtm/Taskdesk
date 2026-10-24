import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/utils/api";
import { getMobileOptionalTabAccess } from "@/utils/optionalTabs";

type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0] & { hiddenRoutes: string[] };

type TabPosition = { left: `${number}%`; top: number };

function TabContent() {
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const organizationSettings = useQuery({
    queryKey: ["mobile-profile-organization-settings", user?.organizationId],
    queryFn: () => apiGet<{ clientsEnabled?: boolean; timeTrackingModuleEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const optionalTabAccess = getMobileOptionalTabAccess({
    settings: organizationSettings.data,
    hasOrganization: user?.organizationId != null,
    isOrganizationAdmin:
      user?.role === "admin" && user.organizationId != null,
  });
  const clientsEnabled = optionalTabAccess.clients;
  const hoursReportEnabled = optionalTabAccess.hoursReport;
  const hiddenRoutes = [
    "reports",
    ...(!clientsEnabled ? ["clients-tab"] : []),
    ...(!hoursReportEnabled ? ["hours-report-tab"] : []),
  ];

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} hiddenRoutes={hiddenRoutes} />}
      screenOptions={({ navigation, route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
        headerShadowVisible: false,
        headerRight:
          route.name === "profile"
            ? undefined
            : () => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t.tabs.profile}
                  testID="profile-header-button"
                  hitSlop={10}
                  onPress={() => navigation.navigate("profile")}
                  style={styles.profileHeaderButton}
                >
                  <Feather name="user" size={20} color={colors.foreground} />
                </TouchableOpacity>
              ),
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.dashboard,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={18} />
            ) : (
              <Feather name="bar-chart-2" size={18} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: t.tabs.tickets,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="ticket" tintColor={color} size={18} />
            ) : (
              <Feather name="list" size={18} color={color} />
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
              <SymbolView name="plus.circle" tintColor={color} size={18} />
            ) : (
              <Feather name="plus-circle" size={18} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t.tabs.calendar,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={18} />
            ) : (
              <Feather name="calendar" size={18} color={color} />
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
              <SymbolView name="clock" tintColor={color} size={18} />
            ) : (
              <Feather name="clock" size={18} color={color} />
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
              <SymbolView name="person.2" tintColor={color} size={18} />
            ) : (
              <Feather name="briefcase" size={18} color={color} />
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

function ScrollableTabBar({
  state,
  descriptors,
  navigation,
  hiddenRoutes,
}: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const bottomPadding = isWeb ? 34 : Math.max(insets.bottom, 4);
  const visibleBottomTabs = ["clients-tab", "hours-report-tab"].filter(
    (name) =>
      !hiddenRoutes.includes(name) &&
      state.routes.some((route) => route.name === name),
  );
  const gridHeight = visibleBottomTabs.length > 0 ? 104 : 52;
  const tabPositions: Record<string, TabPosition> = {
    index: { left: "3%", top: 0 },
    tickets: { left: "22%", top: 0 },
    calendar: { left: "79%", top: 0 },
    "clients-tab": {
      left: visibleBottomTabs.length === 1 ? "41%" : "22%",
      top: 52,
    },
    "hours-report-tab": {
      left: visibleBottomTabs.length === 1 ? "41%" : "60%",
      top: 52,
    },
  };

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
          tint={colorScheme === "dark" ? "dark" : "light"}
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
          const focused = state.index === index;
          const color = focused ? colors.primary : colors.mutedForeground;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = options.tabBarIcon?.({ focused, color, size: 18 });

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
                  top: position.top,
                  width: "18%",
                  height: 52,
                },
              ]}
            >
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
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeaderButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  tabBar: {
    borderTopWidth: 1,
    elevation: 0,
    overflow: "hidden",
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
