import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/utils/api";

type DeletedTicket = { id: number; title: string; deletedAt?: string; ticketNumber?: number };
export default function TicketTrashScreen() {
  const c = useColors(); const { lang } = useLanguage(); const { user } = useAuth(); const qc = useQueryClient(); const it = lang === "it";
  const { data = [], isLoading, error } = useQuery({ queryKey: ["ticket-trash"], queryFn: () => apiGet<DeletedTicket[]>("/tickets/trash"), enabled: user?.role === "admin" });
  const act = async (ticket: DeletedTicket, permanent: boolean) => {
    const label = permanent ? (it ? "eliminare definitivamente" : "permanently delete") : (it ? "ripristinare" : "restore");
    Alert.alert(it ? "Conferma" : "Confirm", `${it ? "Vuoi" : "Do you want to"} ${label} “${ticket.title}”?`, [
      { text: it ? "Annulla" : "Cancel", style: "cancel" },
      { text: permanent ? (it ? "Elimina" : "Delete") : (it ? "Ripristina" : "Restore"), style: permanent ? "destructive" : "default", onPress: async () => {
        try {
          const res = await fetch(`${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : ""}/api/tickets/${ticket.id}/${permanent ? "permanent" : "restore"}`, { method: permanent ? "DELETE" : "POST", credentials: "include" });
          if (!res.ok) throw new Error();
          await qc.invalidateQueries({ queryKey: ["ticket-trash"] });
        } catch { Alert.alert(it ? "Errore" : "Error", it ? "Operazione non riuscita." : "Action failed."); }
      } },
    ]);
  };
  const s = styles(c);
  if (user?.role !== "admin") return <View style={s.center}><Text style={s.muted}>{it ? "Accesso riservato agli amministratori." : "Admins only."}</Text></View>;
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Text style={s.title}>{it ? "Cestino ticket" : "Ticket trash"}</Text>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error && <Text style={s.muted}>{it ? "Impossibile caricare il cestino." : "Could not load trash."}</Text>}
    {!isLoading && data.length === 0 && <Text style={s.muted}>{it ? "Il cestino è vuoto." : "Trash is empty."}</Text>}
    {data.map((ticket) => <View key={ticket.id} style={s.card}>
      <Pressable style={s.main} onPress={() => router.push(`/ticket/${ticket.id}`)}>
        <Text style={s.itemTitle}>{ticket.ticketNumber ? `#${ticket.ticketNumber} · ` : ""}{ticket.title}</Text>
        {!!ticket.deletedAt && <Text style={s.muted}>{new Date(ticket.deletedAt).toLocaleDateString()}</Text>}
      </Pressable>
      <Pressable accessibilityLabel={it ? "Ripristina" : "Restore"} onPress={() => act(ticket, false)} style={s.action}><Feather name="rotate-ccw" size={18} color={c.primary} /></Pressable>
      <Pressable accessibilityLabel={it ? "Elimina definitivamente" : "Delete permanently"} onPress={() => act(ticket, true)} style={s.action}><Feather name="trash-2" size={18} color="#da1e28" /></Pressable>
    </View>)}
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background },
  title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" },
  card: { flexDirection: "row", alignItems: "center", gap: 8, padding: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  main: { flex: 1, gap: 4 }, itemTitle: { color: c.foreground, fontFamily: "Inter_600SemiBold" }, muted: { color: c.mutedForeground },
  action: { padding: 10 },
});
