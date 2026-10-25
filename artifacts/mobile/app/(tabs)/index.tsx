import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from "react-native";
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

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? t.dashboard.goodMorning
      : greetingHour < 18
        ? t.dashboard.goodAfternoon
        : t.dashboard.goodEvening;
  const greetingIcon =
    greetingHour < 12 ? "sunrise" : greetingHour < 18 ? "sun" : "moon";
  const firstName = user?.name?.split(" ")[0] ?? t.profile.user;

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
        <View style={s.greetingCopy}>
          <View style={s.greetingLine} testID="dashboard-greeting-line">
            <Text style={s.greeting} numberOfLines={1} adjustsFontSizeToFit>
              {greeting}, {firstName}
            </Text>
          </View>
          <View style={s.greetingSubtitleRow}>
            <Feather name="activity" size={14} color={colors.primaryForeground} />
            <Text style={s.greetingSubtitle}>
              {lang === "it" ? "Il riepilogo della giornata" : "Your day at a glance"}
            </Text>
          </View>
        </View>
        <View style={s.greetingArtwork} pointerEvents="none">
          <View style={s.greetingOrbLarge} />
          <View style={s.greetingOrbSmall} />
          <Feather
            name={greetingIcon as "sunrise" | "sun" | "moon"}
            size={38}
            color={colors.primaryForeground}
            style={s.greetingArtworkIcon}
          />
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
    content: { padding: 20 },
    header: {
      minHeight: 122,
      marginBottom: 20,
      paddingHorizontal: 18,
      paddingVertical: 18,
      borderRadius: colors.radius * 2,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    greetingCopy: { flex: 1, gap: 10, zIndex: 1 },
    greetingLine: { minWidth: 0 },
    greeting: {
      fontSize: 20,
      fontWeight: "600" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
    },
    greetingSubtitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    greetingSubtitle: {
      fontSize: 13,
      color: colors.primaryForeground,
      opacity: 0.9,
      fontFamily: "Inter_500Medium",
    },
    greetingArtwork: {
      width: 74,
      height: 74,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    greetingOrbLarge: {
      position: "absolute",
      right: -28,
      top: -30,
      width: 124,
      height: 124,
      borderRadius: 62,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.2,
    },
    greetingOrbSmall: {
      position: "absolute",
      right: 2,
      bottom: -34,
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: colors.primaryForeground,
      opacity: 0.1,
    },
    greetingArtworkIcon: { opacity: 0.95 },
    loadingRow: { height: 120, alignItems: "center", justifyContent: "center" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    statsGridSingleRow: { flexWrap: "nowrap", gap: 6 },
    statCard: {
      flex: 1, minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: 10, padding: 10,
      borderLeftWidth: 3,
      gap: 5,
      borderWidth: 1, borderColor: colors.border,
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
      borderRadius: 10, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    ticketInfo: { flex: 1 },
    ticketTitle: { fontSize: 14, fontWeight: "500" as const, color: colors.foreground, fontFamily: "Inter_500Medium" },
    ticketMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
  });
