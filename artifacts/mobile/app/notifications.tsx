import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPatch } from "@/utils/api";

type NotificationItem = {
  id: number; notificationText: string;
  createdAt: string; isRead: boolean; ticketId?: number | null; dailyReportId?: number | null;
  ticketNumber?: number | null;
};

export default function NotificationsScreen() {
  const colors = useColors();
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const t = lang === "it";
  const [filter, setFilter] = React.useState<"all" | "unread" | "read">("all");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["mobile-notifications"],
    queryFn: () => apiGet<NotificationItem[]>("/notifications"),
    refetchInterval: 30_000,
  });
  const visible = data.filter(item => filter === "all" || (filter === "unread" ? !item.isRead : item.isRead));
  const markAllRead = async () => {
    try { await apiPatch("/notifications/read-all", {}); await qc.invalidateQueries({ queryKey: ["mobile-notifications"] }); }
    catch {}
  };
  const open = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await apiPatch(`/notifications/${item.id}/read`, {});
        await qc.invalidateQueries({ queryKey: ["mobile-notifications"] });
      } catch {}
    }
    if (item.dailyReportId) router.push(`/daily-report/${item.dailyReportId}`);
    else if (item.ticketId) router.push(`/ticket/${item.ticketId}`);
  };
  const s = styles(colors);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <View style={s.heading}><Text style={s.title}>{t ? "Notifiche" : "Notifications"}</Text><Pressable onPress={() => void markAllRead()}><Text style={s.link}>{t ? "Segna tutte lette" : "Mark all read"}</Text></Pressable></View>
    <View style={s.filters}>{(["all", "unread", "read"] as const).map(value => <Pressable key={value} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && s.filterTextActive]}>{value === "all" ? (t ? "Tutte" : "All") : value === "unread" ? (t ? "Da leggere" : "Unread") : (t ? "Lette" : "Read")}</Text></Pressable>)}</View>
    {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <Text style={s.error}>{t ? "Impossibile caricare le notifiche." : "Could not load notifications."}</Text> : null}
    {!isLoading && visible.length === 0 ? <Text style={s.muted}>{t ? "Nessuna notifica." : "No notifications."}</Text> : null}
    {visible.map((item) => <Pressable key={item.id} onPress={() => void open(item)} style={s.card}>
      <View style={[s.dot, item.isRead && s.readDot]} />
      <View style={s.main}>
        {!!item.ticketId && <Text style={s.itemTitle}>{t ? "Ticket" : "Ticket"}{item.ticketNumber ? ` #${item.ticketNumber}` : ""}</Text>}
        <Text style={s.message}>{item.notificationText}</Text>
        <Text style={s.date}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>)}
  </ScrollView>;
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 6 },
  link: { color: c.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }, filters: { flexDirection: "row", gap: 7 }, filter: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  filterActive: { backgroundColor: c.primary + "20", borderColor: c.primary }, filterText: { color: c.mutedForeground, fontSize: 12 }, filterTextActive: { color: c.primary },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary }, readDot: { backgroundColor: c.border },
  main: { flex: 1, gap: 4 }, itemTitle: { color: c.foreground, fontFamily: "Inter_600SemiBold" },
  message: { color: c.foreground, fontSize: 14 }, date: { color: c.mutedForeground, fontSize: 12 },
  muted: { color: c.mutedForeground }, error: { color: c.destructive ?? "#da1e28" },
});
