import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPost } from "@/utils/api";

type DailyReport = { id: number; authorName: string; date: string; createdAt: string; location?: string | null; content: unknown };
export default function DailyReportScreen() {
  const c = useColors(); const { lang } = useLanguage(); const it = lang === "it"; const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({ queryKey: ["mobile-daily-report", id], queryFn: () => apiGet<DailyReport>(`/daily-reports/${id}`), enabled: !!id });
  useEffect(() => {
    if (id) apiPost(`/daily-reports/${id}/read`, {}).catch(() => {});
  }, [id]);
  const content = typeof data?.content === "string" ? data.content : JSON.stringify(data?.content ?? "", null, 2);
  const s = styles(c);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error && <Text style={s.muted}>{it ? "Report non disponibile." : "Report unavailable."}</Text>}
    {data && <>
      <Text style={s.title}>{it ? `Report di ${data.authorName}` : `Report by ${data.authorName}`}</Text>
      <Text style={s.muted}>{new Date(data.date).toLocaleDateString(it ? "it-IT" : "en-US")}{data.location ? ` · ${data.location}` : ""}</Text>
      <View style={s.card}><Text selectable style={s.body}>{content}</Text></View>
    </>}
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  title: { color: c.foreground, fontSize: 22, fontFamily: "Inter_700Bold" }, muted: { color: c.mutedForeground },
  card: { backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 16 },
  body: { color: c.foreground, fontSize: 15, lineHeight: 23 },
});
