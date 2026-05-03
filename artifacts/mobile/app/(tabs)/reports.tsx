import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface StatRow { name: string; count: number }
interface TrendRow { date: string; count: number }
interface DashboardStats {
  totalTickets: number; openTickets: number; inProgressTickets: number;
  waitingTickets: number; resolvedTickets: number; closedTickets: number;
  urgentTickets: number; last7Days: number; last30Days: number;
  avgResolutionHours: number | null;
}
interface LeaderEntry { id: number; name: string; count: number }
interface AssigneeEntry { id: number; name: string; count: number }
interface ReportsAll {
  dashboard: DashboardStats;
  byStatus: StatRow[];
  byCategory: StatRow[];
  byLocation: StatRow[];
  byPriority: StatRow[];
  byAssignee: AssigneeEntry[];
  trend: TrendRow[];
  leaderboard: { openers: LeaderEntry[]; commenters: LeaderEntry[]; resolvers: LeaderEntry[] };
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
  return (
    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 10 }}>
      {label}
    </Text>
  );
}

function BarList({ data, colorMap, defaultColor, horizontal }: {
  data: (StatRow | AssigneeEntry)[]; colorMap?: Record<string, string>; defaultColor: string; horizontal?: boolean;
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

function TrendChart({ data }: { data: TrendRow[] }) {
  const colors = useColors();
  const s = styles(colors);
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}`;
  };
  const showEveryN = Math.ceil(data.length / 8);

  return (
    <View style={s.barCard}>
      <View style={s.trendContainer}>
        <View style={s.trendBars}>
          {data.map((row, i) => {
            const heightPct = (row.count / max) * 100;
            return (
              <View key={row.date} style={s.trendBarCol}>
                <Text style={s.trendCount}>{row.count > 0 ? row.count : ""}</Text>
                <View style={s.trendBarTrack}>
                  <View
                    style={[
                      s.trendBarFill,
                      { height: `${Math.max(heightPct, row.count > 0 ? 4 : 0)}%` as any, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                {i % showEveryN === 0 && (
                  <Text style={s.trendDate} numberOfLines={1}>{formatDate(row.date)}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
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
      <View style={s.lbHeader}>
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
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[s.barLabel, { width: undefined, flex: 1 }, i === 0 && { fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
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
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery<ReportsAll>({
    queryKey: ["reports-all"],
    queryFn: () => apiGet("/stats/reports-all"),
    staleTime: 5 * 60_000,
    enabled: !!user && user.role === "admin",
  });

  if (!user || user.role !== "admin") {
    return (
      <View style={s.center}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={s.accessDeniedTitle}>Accesso riservato</Text>
        <Text style={s.accessDeniedText}>I report sono disponibili solo per gli amministratori.</Text>
      </View>
    );
  }

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
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Panoramica KPI */}
      <SectionTitle label="Panoramica" />
      {data?.dashboard && <KpiGrid stats={data.dashboard} />}

      {data?.dashboard?.avgResolutionHours != null && (
        <View style={s.avgCard}>
          <Feather name="clock" size={16} color={colors.success} />
          <Text style={s.avgText}>
            Tempo medio di risoluzione:{" "}
            <Text style={{ color: colors.success, fontFamily: "Inter_700Bold" }}>
              {data.dashboard.avgResolutionHours < 24
                ? `${Math.round(data.dashboard.avgResolutionHours)}h`
                : `${(data.dashboard.avgResolutionHours / 24).toFixed(1)}gg`}
            </Text>
          </Text>
        </View>
      )}

      {/* Andamento ultimi 30 giorni */}
      {(data?.trend?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Andamento (ultimi 30 giorni)" />
          <TrendChart data={data!.trend} />
        </View>
      )}

      {/* Per stato */}
      {(data?.byStatus?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Per stato" />
          <BarList data={data!.byStatus} colorMap={STATUS_COLORS} defaultColor={colors.primary} />
        </View>
      )}

      {/* Per priorità */}
      {(data?.byPriority?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Per priorità" />
          <BarList data={data!.byPriority} colorMap={PRIORITY_COLORS} defaultColor="#f1c21b" />
        </View>
      )}

      {/* Per categoria */}
      {(data?.byCategory?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Per categoria" />
          <BarList data={data!.byCategory} defaultColor="#8a3ffc" />
        </View>
      )}

      {/* Per sede */}
      {(data?.byLocation?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Per sede" />
          <BarList data={data!.byLocation} defaultColor="#0288d1" />
        </View>
      )}

      {/* Per assegnatario */}
      {(data?.byAssignee?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label="Per assegnatario" />
          <BarList
            data={data!.byAssignee.map((a) => ({ name: a.name, count: a.count }))}
            defaultColor={colors.success}
          />
        </View>
      )}

      {/* Classifiche */}
      <SectionTitle label="Classifiche" />
      <LeaderBoard title="🎫 Chi apre più ticket" entries={data?.leaderboard?.openers ?? []} unit="ticket" color={colors.primary} />
      <LeaderBoard title="💬 Chi commenta di più" entries={data?.leaderboard?.commenters ?? []} unit="commenti" color="#8a3ffc" />
      <LeaderBoard title="✅ Chi risolve di più" entries={data?.leaderboard?.resolvers ?? []} unit="soluzioni" color={colors.success} />
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    accessDeniedTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold", marginTop: 8 },
    accessDeniedText: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
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
    barRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    barTrack: { flex: 1, height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3 },
    barCount: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 24, textAlign: "right" },
    lbHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    lbTitle: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    medal: { fontSize: 16, width: 26, textAlign: "center" },
    emptyRow: { padding: 20, alignItems: "center" },
    emptyText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    trendContainer: { padding: 14 },
    trendBars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 140 },
    trendBarCol: { flex: 1, alignItems: "center", gap: 2 },
    trendCount: { fontSize: 8, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
    trendBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end", backgroundColor: colors.muted, borderRadius: 2, overflow: "hidden" },
    trendBarFill: { width: "100%", backgroundColor: colors.primary, borderRadius: 2 },
    trendDate: { fontSize: 9, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 2 },
  });
