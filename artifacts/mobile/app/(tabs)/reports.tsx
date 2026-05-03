import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";

interface StatRow { name: string; count: number }
interface DashboardStats {
  totalTickets: number; openTickets: number; inProgressTickets: number;
  waitingTickets: number; resolvedTickets: number; closedTickets: number;
  urgentTickets: number; last7Days: number; last30Days: number;
  avgResolutionHours: number | null;
}
interface LeaderEntry { id: number; name: string; count: number }
interface Leaderboard {
  openers: LeaderEntry[]; commenters: LeaderEntry[]; resolvers: LeaderEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];
const PRIORITY_COLORS: Record<string, string> = {
  Bassa: "#24a148", Media: "#f1c21b", Alta: "#ff832b", Urgente: "#da1e28",
};
const STATUS_COLORS: Record<string, string> = {
  Aperto: "#0f62fe", "In lavorazione": "#8a3ffc", "In attesa": "#f1c21b",
  Risolto: "#24a148", Chiuso: "#525252",
};

function SectionTitle({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 12 }}>{label}</Text>;
}

function BarList({ data, colorMap, defaultColor }: {
  data: StatRow[]; colorMap?: Record<string, string>; defaultColor: string
}) {
  const colors = useColors();
  const s = styles(colors);
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <View style={s.barCard}>
      {data.map((row, i) => {
        const pct = (row.count / max) * 100;
        const barColor = colorMap?.[row.name] ?? defaultColor;
        return (
          <View key={row.name} style={[s.barRow, i < data.length - 1 && s.barRowBorder]}>
            <Text style={s.barLabel} numberOfLines={1}>{row.name}</Text>
            <View style={s.barRight}>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
              </View>
              <Text style={[s.barCount, { color: barColor }]}>{row.count}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function KpiGrid({ stats }: { stats: DashboardStats }) {
  const colors = useColors();
  const s = styles(colors);
  const items = [
    { label: "Totale ticket", value: stats.totalTickets, color: colors.primary, icon: "layers" as const },
    { label: "Aperti", value: stats.openTickets, color: "#0f62fe", icon: "inbox" as const },
    { label: "Urgenti", value: stats.urgentTickets, color: colors.destructive, icon: "alert-triangle" as const },
    { label: "Risolti", value: stats.resolvedTickets, color: colors.success, icon: "check-circle" as const },
    { label: "Ultimi 7 giorni", value: stats.last7Days, color: "#8a3ffc", icon: "calendar" as const },
    { label: "Ultimi 30 giorni", value: stats.last30Days, color: "#f1c21b", icon: "trending-up" as const },
  ];
  return (
    <View style={s.kpiGrid}>
      {items.map((item) => (
        <View key={item.label} style={[s.kpiCard, { borderLeftColor: item.color }]}>
          <Feather name={item.icon} size={18} color={item.color} />
          <Text style={s.kpiValue}>{item.value}</Text>
          <Text style={s.kpiLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function LeaderBoard({ title, entries, unit, color }: {
  title: string; entries: LeaderEntry[]; unit: string; color: string;
}) {
  const colors = useColors();
  const s = styles(colors);
  const max = entries[0]?.count ?? 1;
  return (
    <View style={s.barCard}>
      <View style={[s.lbHeader]}>
        <Text style={s.lbTitle}>{title}</Text>
      </View>
      {entries.length === 0 ? (
        <View style={s.emptyRow}>
          <Text style={s.emptyText}>Nessun dato disponibile</Text>
        </View>
      ) : (
        entries.map((entry, i) => {
          const pct = (entry.count / max) * 100;
          return (
            <View key={entry.id} style={[s.barRow, i < entries.length - 1 && s.barRowBorder]}>
              <Text style={[s.medal, i === 0 && { fontSize: 20 }]}>{MEDALS[i]}</Text>
              <View style={[s.barRight, { flex: 1 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                  <Text style={[s.barLabel, i === 0 && { fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={[s.barCount, { color }]}>{entry.count} {unit}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: color + (i === 0 ? "ff" : "66") }]} />
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function ReportsScreen() {
  const colors = useColors();
  const s = styles(colors);

  const opts = { staleTime: 60_000 };

  const { data: dashboard, isLoading: l1, refetch: r1 } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-full"], queryFn: () => apiGet("/stats/dashboard"), ...opts,
  });
  const { data: byStatus = [], isLoading: l2, refetch: r2 } = useQuery<StatRow[]>({
    queryKey: ["stats-by-status"], queryFn: () => apiGet("/stats/by-status"), ...opts,
  });
  const { data: byCategory = [], isLoading: l3, refetch: r3 } = useQuery<StatRow[]>({
    queryKey: ["stats-by-category"], queryFn: () => apiGet("/stats/by-category"), ...opts,
  });
  const { data: byPriority = [], isLoading: l4, refetch: r4 } = useQuery<StatRow[]>({
    queryKey: ["stats-by-priority"], queryFn: () => apiGet("/stats/by-priority"), ...opts,
  });
  const { data: byLocation = [], isLoading: l5, refetch: r5 } = useQuery<StatRow[]>({
    queryKey: ["stats-by-location"], queryFn: () => apiGet("/stats/by-location"), ...opts,
  });
  const { data: leaderboard, isLoading: l6, refetch: r6 } = useQuery<Leaderboard>({
    queryKey: ["leaderboard"], queryFn: () => apiGet("/stats/leaderboard"), ...opts,
  });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;
  const onRefresh = () => { r1(); r2(); r3(); r4(); r5(); r6(); };

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 34 : 24 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* KPI overview */}
      <SectionTitle label="Panoramica" />
      {dashboard && <KpiGrid stats={dashboard} />}

      {dashboard?.avgResolutionHours != null && (
        <View style={s.avgCard}>
          <Feather name="clock" size={16} color={colors.success} />
          <Text style={s.avgText}>
            Tempo medio di risoluzione:{" "}
            <Text style={{ color: colors.success, fontFamily: "Inter_700Bold" }}>
              {dashboard.avgResolutionHours < 24
                ? `${Math.round(dashboard.avgResolutionHours)}h`
                : `${(dashboard.avgResolutionHours / 24).toFixed(1)}gg`}
            </Text>
          </Text>
        </View>
      )}

      {/* By status */}
      {byStatus.length > 0 && (
        <View>
          <SectionTitle label="Per stato" />
          <BarList data={byStatus} colorMap={STATUS_COLORS} defaultColor={colors.primary} />
        </View>
      )}

      {/* By priority */}
      {byPriority.length > 0 && (
        <View>
          <SectionTitle label="Per priorità" />
          <BarList data={byPriority} colorMap={PRIORITY_COLORS} defaultColor={colors.warning} />
        </View>
      )}

      {/* By category */}
      {byCategory.length > 0 && (
        <View>
          <SectionTitle label="Per categoria" />
          <BarList data={byCategory} defaultColor="#8a3ffc" />
        </View>
      )}

      {/* By location */}
      {byLocation.length > 0 && (
        <View>
          <SectionTitle label="Per sede" />
          <BarList data={byLocation} defaultColor="#0288d1" />
        </View>
      )}

      {/* Leaderboards */}
      <SectionTitle label="Classifiche" />
      <LeaderBoard
        title="🎫 Chi apre più ticket"
        entries={leaderboard?.openers ?? []}
        unit="ticket"
        color={colors.primary}
      />
      <LeaderBoard
        title="💬 Chi commenta di più"
        entries={leaderboard?.commenters ?? []}
        unit="commenti"
        color="#8a3ffc"
      />
      <LeaderBoard
        title="✅ Chi risolve di più"
        entries={leaderboard?.resolvers ?? []}
        unit="soluzioni"
        color={colors.success}
      />
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
    kpiCard: {
      flex: 1, minWidth: "45%",
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, gap: 6,
    },
    kpiValue: { fontSize: 26, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    kpiLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },

    avgCard: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.success + "12", borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.success + "40",
    },
    avgText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" },

    barCard: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    barRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    barRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    barLabel: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_500Medium", width: 110 },
    barRight: { flex: 1, flexDirection: "column", gap: 5 },
    barTrack: { height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3 },
    barCount: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "right", minWidth: 28 },

    lbHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    lbTitle: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    medal: { fontSize: 16, width: 26, textAlign: "center" },
    emptyRow: { padding: 20, alignItems: "center" },
    emptyText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });
