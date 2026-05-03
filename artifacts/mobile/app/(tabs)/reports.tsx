import React from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";

interface LeaderEntry { id: number; name: string; count: number }
interface Leaderboard {
  openers: LeaderEntry[];
  commenters: LeaderEntry[];
  resolvers: LeaderEntry[];
}

const MEDALS = ["🥇", "🥈", "🥉", "4.", "5."];

const BOARDS = [
  { key: "openers" as const, icon: "file-text" as const, label: "Chi apre più ticket", unit: "ticket", color: "#0f62fe" },
  { key: "commenters" as const, icon: "message-circle" as const, label: "Chi commenta di più", unit: "commenti", color: "#8a3ffc" },
  { key: "resolvers" as const, icon: "check-circle" as const, label: "Chi risolve di più", unit: "soluzioni", color: "#24a148" },
];

export default function ReportsScreen() {
  const colors = useColors();
  const s = styles(colors);

  const { data, isLoading } = useQuery<Leaderboard>({
    queryKey: ["leaderboard"],
    queryFn: () => apiGet("/stats/leaderboard"),
    staleTime: 60_000,
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
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>Classifiche</Text>
      <Text style={s.pageSubtitle}>Chi contribuisce di più al sistema</Text>

      {BOARDS.map((board) => {
        const entries: LeaderEntry[] = data?.[board.key] ?? [];
        return (
          <View key={board.key} style={s.card}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: board.color + "18" }]}>
                <Feather name={board.icon} size={18} color={board.color} />
              </View>
              <Text style={s.cardTitle}>{board.label}</Text>
            </View>

            {entries.length === 0 ? (
              <View style={s.emptyRow}>
                <Text style={s.emptyText}>Nessun dato disponibile</Text>
              </View>
            ) : (
              entries.map((entry, i) => {
                const isFirst = i === 0;
                const barWidth = entries[0].count > 0 ? (entry.count / entries[0].count) * 100 : 0;
                return (
                  <View key={entry.id} style={[s.row, i < entries.length - 1 && s.rowBorder]}>
                    <Text style={[s.medal, isFirst && { fontSize: 20 }]}>{MEDALS[i]}</Text>
                    <View style={s.rowInfo}>
                      <View style={s.rowTop}>
                        <Text style={[s.rowName, isFirst && s.rowNameFirst]} numberOfLines={1}>
                          {entry.name}
                        </Text>
                        <Text style={[s.rowCount, { color: board.color }]}>
                          {entry.count} {board.unit}
                        </Text>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${barWidth}%` as any, backgroundColor: board.color + (isFirst ? "ff" : "66") }]} />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    pageTitle: { fontSize: 26, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    pageSubtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 4 },
    card: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    cardTitle: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1 },
    emptyRow: { padding: 20, alignItems: "center" },
    emptyText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    medal: { fontSize: 16, width: 26, textAlign: "center" },
    rowInfo: { flex: 1, gap: 6 },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowName: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1, marginRight: 8 },
    rowNameFirst: { fontFamily: "Inter_700Bold", fontSize: 15 },
    rowCount: { fontSize: 13, fontFamily: "Inter_700Bold" },
    barTrack: { height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: "hidden" },
    barFill: { height: 4, borderRadius: 2 },
  });
