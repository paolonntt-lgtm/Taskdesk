import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
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
  const { t } = useLanguage();
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.dashboard.goodMorning;
    if (h < 18) return t.dashboard.goodAfternoon;
    return t.dashboard.goodEvening;
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
      <View style={s.header}>
        <View style={s.greetingRow} testID="dashboard-greeting-line">
          <Text style={s.greeting} numberOfLines={1}>{greeting()}, </Text>
          <Text style={s.name} numberOfLines={1}>
            {user?.name?.split(" ")[0] ?? t.profile.user}
          </Text>
        </View>
      </View>

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
    header: { marginBottom: 24 },
    greetingRow: { flexDirection: "row", alignItems: "center", minWidth: 0 },
    greeting: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    name: { flexShrink: 1, fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
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
