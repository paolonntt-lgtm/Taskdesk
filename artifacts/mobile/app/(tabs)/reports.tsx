import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface StatRow { name: string; count: number }
type AssigneeEntry = StatRow;
interface TrendRow { date: string; count: number }
interface LeaderEntry { id: number; name: string; count: number }
interface ReportsAll {
  byCategory: StatRow[];
  byLocation: StatRow[];
  byPriority: StatRow[];
  trend: TrendRow[];
  leaderboard: { openers: LeaderEntry[]; commenters: LeaderEntry[]; resolvers: LeaderEntry[] };
}

const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];

const PRIORITY_COLORS_MAP: Record<string, string> = {
  Bassa: "#24a148", Media: "#f1c21b", Alta: "#ff832b", Urgente: "#da1e28",
  Low: "#24a148", Medium: "#f1c21b", High: "#ff832b", Urgent: "#da1e28",
};

function SectionTitle({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 10 }}>
      {label}
    </Text>
  );
}

function BarList({ data, colorMap, defaultColor }: {
  data: (StatRow | AssigneeEntry)[]; colorMap?: Record<string, string>; defaultColor: string;
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

function LeaderBoard({ title, entries, unit, color }: {
  title: string; entries: LeaderEntry[]; unit: string; color: string;
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const s = styles(colors);
  const max = entries[0]?.count ?? 1;
  return (
    <View style={s.barCard}>
      <View style={s.lbHeader}>
        <Text style={s.lbTitle}>{title}</Text>
      </View>
      {entries.length === 0 ? (
        <View style={s.emptyRow}>
          <Text style={s.emptyText}>{t.reports.noData}</Text>
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
  const { t } = useLanguage();

  const { data, isLoading, refetch } = useQuery<ReportsAll>({
    queryKey: ["reports-all"],
    queryFn: () => apiGet("/stats/reports-all"),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

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
      <SectionTitle label={t.reports.leaderboards} />
      <LeaderBoard title={t.reports.openers} entries={data?.leaderboard?.openers ?? []} unit={t.reports.tickets} color={colors.primary} />
      <LeaderBoard title={t.reports.commenters} entries={data?.leaderboard?.commenters ?? []} unit={t.reports.comments} color="#8a3ffc" />
      <LeaderBoard title={t.reports.resolvers} entries={data?.leaderboard?.resolvers ?? []} unit={t.reports.solutions} color={colors.success} />

      {(data?.trend?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label={t.reports.trend} />
          <TrendChart data={data!.trend} />
        </View>
      )}

      {(data?.byPriority?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label={t.reports.byPriority} />
          <BarList data={data!.byPriority} colorMap={PRIORITY_COLORS_MAP} defaultColor="#f1c21b" />
        </View>
      )}

      {(data?.byCategory?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label={t.reports.byCategory} />
          <BarList data={data!.byCategory} defaultColor="#8a3ffc" />
        </View>
      )}

      {(data?.byLocation?.length ?? 0) > 0 && (
        <View>
          <SectionTitle label={t.reports.byLocation} />
          <BarList data={data!.byLocation} defaultColor="#0288d1" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
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
