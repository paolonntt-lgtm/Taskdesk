import React, { useEffect, useState } from "react";
import {
  Alert, AppState, Linking, View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from "react-native";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, PRIORITY_COLORS } from "@/utils/api";

interface DashboardStats {
  openTickets: number;
  inProgressTickets: number;
  urgentTickets: number;
  closedTickets: number;
}

interface Ticket {
  id: number;
  title: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  creator?: { name: string };
}

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const singleRowStats = width >= 360;
  const s = styles(colors);
  const [now, setNow] = useState<Date>(() => new Date());
  const [gpsLocation, setGpsLocation] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();

  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const interval = setInterval(refreshClock, 60_000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshClock();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiGet<DashboardStats>("/stats/dashboard"),
    enabled: !!user,
  });

  const { data: recentTickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: () => apiGet<Ticket[]>("/stats/recent-tickets"),
    enabled: !!user,
  });

  const onRefresh = () => { refetchStats(); refetchTickets(); };

  const greetingHour = now.getHours();
  const greeting =
    greetingHour < 12
      ? t.dashboard.goodMorning
      : greetingHour < 18
        ? t.dashboard.goodAfternoon
        : t.dashboard.goodEvening;
  const greetingIcon =
    greetingHour < 12 ? "sunrise" : greetingHour < 18 ? "sun" : "moon";
  const firstName = user?.name?.split(" ")[0] ?? t.profile.user;
  const locale = lang === "it" ? "it-IT" : "en-US";
  const heroDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now).replace(/\.$/, "");
  const heroTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const mainLocation = user?.mainLocation?.trim();
  const displayLocation = mainLocation || gpsLocation;

  const captureGpsLocation = async () => {
    setIsGettingLocation(true);
    try {
      const permission = await requestLocationPermission();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationPermissionDenied, [
            { text: lang === "it" ? "Annulla" : "Cancel", style: "cancel" },
            {
              text: lang === "it" ? "Impostazioni" : "Settings",
              onPress: () => { void Linking.openSettings().catch(() => {}); },
            },
          ]);
        } else {
          Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationPermissionDenied);
        }
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationUnavailable);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      const area = address?.city ?? address?.subregion ?? address?.region;
      if (!area) {
        Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationUnavailable);
        return;
      }
      setGpsLocation([area, address?.country].filter(Boolean).join(", "));
    } catch {
      Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationUnavailable);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const askForGpsLocation = () => {
    Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationDisclosureMessage, [
      { text: lang === "it" ? "Annulla" : "Cancel", style: "cancel" },
      { text: t.dashboard.locationContinue, onPress: () => { void captureGpsLocation(); } },
    ]);
  };

  const statCards = [
    { label: t.dashboard.open, value: stats?.openTickets ?? 0, color: colors.primary, icon: "inbox" as const, filter: "status=open" },
    { label: t.dashboard.inProgress, value: stats?.inProgressTickets ?? 0, color: "#f1c21b", icon: "clock" as const, filter: "status=in_progress" },
    { label: t.dashboard.urgent, value: stats?.urgentTickets ?? 0, color: colors.destructive, icon: "alert-triangle" as const, filter: "priority=urgent" },
    { label: t.dashboard.closed, value: stats?.closedTickets ?? 0, color: colors.success, icon: "check-circle" as const, filter: "status=closed" },
  ];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 0 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.headerOrbitLarge} pointerEvents="none" />
        <View style={s.headerOrbitSmall} pointerEvents="none" />
        <View style={s.greetingCopy}>
          <View style={s.greetingEyebrow}>
            <View style={s.greetingDot} />
            <Text style={s.greetingSubtitle} numberOfLines={1}>
              {lang === "it" ? "La tua giornata" : "Your day"}
            </Text>
          </View>
          <View style={s.greetingLine} testID="dashboard-greeting-line">
            <Text style={s.greeting}>{greeting}</Text>
            <Text
              style={s.greetingName}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="dashboard-greeting-name"
            >
              {firstName}
            </Text>
          </View>
          <View style={s.heroDetails}>
            <View style={s.heroDateTime}>
              <View style={s.heroMetaItem}>
                <Feather name="calendar" size={12} color={colors.primaryForeground} />
                <Text style={s.heroMetaText} testID="dashboard-hero-date">{heroDate}</Text>
              </View>
              <View style={s.heroMetaDivider} />
              <View style={s.heroMetaItem}>
                <Feather name="clock" size={12} color={colors.primaryForeground} />
                <Text style={s.heroMetaText} testID="dashboard-hero-time">{heroTime}</Text>
              </View>
            </View>
            {displayLocation ? (
              <View style={s.heroMetaItem}>
                <Feather name="map-pin" size={12} color={colors.primaryForeground} />
                <Text style={s.heroMetaText} numberOfLines={1} testID="dashboard-hero-location">
                  {displayLocation}
                </Text>
              </View>
            ) : Platform.OS !== "web" ? (
              <TouchableOpacity
                style={s.heroMetaItem}
                onPress={askForGpsLocation}
                disabled={isGettingLocation || !locationPermission}
                activeOpacity={0.7}
                accessibilityRole="button"
                testID="dashboard-hero-gps-button"
              >
                {isGettingLocation
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Feather name="map-pin" size={12} color={colors.primaryForeground} />}
                <Text style={s.heroMetaText}>
                  {isGettingLocation
                    ? (lang === "it" ? "Ricerca posizione…" : "Finding location…")
                    : t.dashboard.useGpsLocation}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={s.greetingArtwork} pointerEvents="none">
          <View style={s.greetingDisc} />
          <Feather
            name={greetingIcon as "sunrise" | "sun" | "moon"}
            size={32}
            color={colors.primaryForeground}
            style={s.greetingArtworkIcon}
          />
          <View style={s.greetingSparkOne} />
          <View style={s.greetingSparkTwo} />
        </View>
      </LinearGradient>

      {statsLoading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={[s.statsGrid, singleRowStats && s.statsGridSingleRow]}>
          {statCards.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[s.statCard, singleRowStats && s.statCardSingleRow, { borderLeftColor: c.color }]}
              onPress={() => router.push(`/(tabs)/tickets?${c.filter}` as any)}
              activeOpacity={0.75}
            >
              <Feather name={c.icon} size={singleRowStats ? 14 : 16} color={c.color} />
              <Text style={[s.statValue, singleRowStats && s.statValueSingleRow]}>{c.value}</Text>
              <Text
                style={[s.statLabel, singleRowStats && s.statLabelSingleRow]}
                numberOfLines={singleRowStats ? 1 : undefined}
                adjustsFontSizeToFit={singleRowStats}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t.dashboard.recentActivity}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/tickets")}>
            <Text style={s.seeAll}>{t.dashboard.seeAll}</Text>
          </TouchableOpacity>
        </View>

        {ticketsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : recentTickets.length === 0 ? (
          <View style={s.empty}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>{t.dashboard.noRecentTickets}</Text>
          </View>
        ) : (
          recentTickets.slice(0, 5).map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={s.ticketRow}
              onPress={() => router.push(`/ticket/${ticket.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLORS[ticket.priority] ?? colors.muted }]} />
              <View style={s.ticketInfo}>
                <Text style={s.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                <Text style={s.ticketMeta}>#{ticket.id} · {t.status[ticket.status] ?? ticket.status}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 18, paddingTop: 16, gap: 2 },
    header: {
      minHeight: 168,
      marginBottom: 20,
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderRadius: colors.radius * 2.4,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 5,
    },
    headerGlow: {
      position: "absolute",
      right: -56,
      bottom: -106,
      width: 214,
      height: 214,
      borderRadius: 107,
      backgroundColor: colors.primaryForeground,
      opacity: 0.12,
    },
    headerOrbitLarge: {
      position: "absolute",
      right: -30,
      top: -104,
      width: 224,
      height: 224,
      borderRadius: 112,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.17,
    },
    headerOrbitSmall: {
      position: "absolute",
      right: -5,
      top: -78,
      width: 172,
      height: 172,
      borderRadius: 86,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.13,
    },
    greetingCopy: { flex: 1, gap: 14, zIndex: 1, minWidth: 0 },
    greetingEyebrow: { flexDirection: "row", alignItems: "center", gap: 9 },
    greetingDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accentForeground,
      opacity: 0.95,
    },
    greetingLine: { minWidth: 0, gap: 0 },
    greeting: {
      fontSize: 15,
      fontWeight: "500" as const,
      color: colors.primaryForeground,
      opacity: 0.84,
      fontFamily: "Inter_500Medium",
    },
    greetingName: {
      fontSize: 31,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.7,
    },
    heroDetails: { gap: 5, marginTop: 2 },
    heroDateTime: { flexDirection: "row", alignItems: "center", gap: 8 },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    heroMetaText: {
      flexShrink: 1,
      fontSize: 10,
      lineHeight: 14,
      color: colors.primaryForeground,
      opacity: 0.84,
      fontFamily: "Inter_500Medium",
    },
    heroMetaDivider: { height: 12, width: 1, backgroundColor: colors.primaryForeground, opacity: 0.45 },
    greetingSubtitle: {
      fontSize: 10,
      color: colors.primaryForeground,
      opacity: 0.86,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontFamily: "Inter_600SemiBold",
    },
    greetingArtwork: {
      width: 98,
      height: 98,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
      zIndex: 1,
    },
    greetingDisc: {
      position: "absolute",
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: colors.primaryForeground,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.17,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 14,
    },
    greetingSparkOne: {
      position: "absolute",
      right: 6,
      top: 14,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primaryForeground,
      opacity: 0.9,
    },
    greetingSparkTwo: {
      position: "absolute",
      left: 10,
      bottom: 11,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accentForeground,
      opacity: 0.9,
    },
    greetingArtworkIcon: { opacity: 1, textShadowColor: "rgba(5, 35, 89, 0.28)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    loadingRow: { height: 120, alignItems: "center", justifyContent: "center" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    statsGridSingleRow: { flexWrap: "nowrap", gap: 6 },
    statCard: {
      flex: 1, minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: colors.radius + 3, padding: 10,
      borderLeftWidth: 3,
      gap: 5,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.055, shadowRadius: 8, elevation: 1,
    },
    statCardSingleRow: { minWidth: 0, paddingHorizontal: 5, paddingVertical: 8, gap: 3, alignItems: "center" },
    statValue: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    statValueSingleRow: { fontSize: 19 },
    statLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    statLabelSingleRow: { fontSize: 11, lineHeight: 13, textAlign: "center" },
    section: {},
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    seeAll: { fontSize: 14, color: colors.primary, fontFamily: "Inter_500Medium" },
    empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
    emptyText: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
    ticketRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius + 2, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, gap: 12,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.045, shadowRadius: 6, elevation: 1,
    },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    ticketInfo: { flex: 1 },
    ticketTitle: { fontSize: 14, fontWeight: "500" as const, color: colors.foreground, fontFamily: "Inter_500Medium" },
    ticketMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
  });
