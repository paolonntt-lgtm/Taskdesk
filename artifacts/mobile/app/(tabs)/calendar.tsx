import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiDelete, apiGet, apiPost, apiPut } from "@/utils/api";

type CalendarItem = { type: "ticket" | "appointment"; id: number; title: string; date: string; startsAt?: string | null; endsAt?: string | null; description?: string | null; status?: string | null; priority?: string | null };
export default function CalendarScreen() {
  const c = useColors(); const { lang } = useLanguage(); const it = lang === "it";
  const [month, setMonth] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const year = month.getFullYear(); const m = month.getMonth() + 1;
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["mobile-calendar", year, m], queryFn: () => apiGet<CalendarItem[]>(`/calendar?year=${year}&month=${m}`) });
  const sorted = useMemo(() => [...data].sort((a, b) => new Date(a.startsAt || a.date).getTime() - new Date(b.startsAt || b.date).getTime()), [data]);
  const openForm = (item?: CalendarItem) => {
    setEditing(item ?? null);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    const date = item?.startsAt ? new Date(item.startsAt) : new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setStartsAt(local);
    setFormOpen(true);
  };
  const save = async () => {
    if (!title.trim() || !startsAt) return;
    setSaving(true);
    try {
      const body = { title: title.trim(), description: description.trim() || null, startsAt: new Date(startsAt).toISOString(), endsAt: null, assignedTo: null };
      if (editing) await apiPut(`/appointments/${editing.id}`, body);
      else await apiPost("/appointments", body);
      await qc.invalidateQueries({ queryKey: ["mobile-calendar"] });
      setFormOpen(false);
    } catch { Alert.alert(it ? "Errore" : "Error", it ? "Non è stato possibile salvare l'appuntamento." : "Could not save appointment."); }
    finally { setSaving(false); }
  };
  const remove = (item: CalendarItem) => Alert.alert(it ? "Elimina appuntamento" : "Delete appointment", item.title, [
    { text: it ? "Annulla" : "Cancel", style: "cancel" },
    { text: it ? "Elimina" : "Delete", style: "destructive", onPress: async () => {
      try { await apiDelete(`/appointments/${item.id}`); await qc.invalidateQueries({ queryKey: ["mobile-calendar"] }); }
      catch { Alert.alert(it ? "Errore" : "Error", it ? "Eliminazione non riuscita." : "Could not delete appointment."); }
    } },
  ]);
  const s = styles(c);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <View style={s.heading}><Text style={s.title}>{it ? "Calendario" : "Calendar"}</Text><Pressable style={s.add} onPress={() => openForm()}><Feather name="plus" size={18} color={c.primaryForeground} /><Text style={s.addText}>{it ? "Appuntamento" : "Appointment"}</Text></Pressable></View>
    <View style={s.monthRow}>
      <Pressable onPress={() => setMonth(new Date(year, m - 2, 1))} style={s.icon}><Feather name="chevron-left" size={22} color={c.primary} /></Pressable>
      <Text style={s.month}>{month.toLocaleDateString(it ? "it-IT" : "en-US", { month: "long", year: "numeric" })}</Text>
      <Pressable onPress={() => setMonth(new Date(year, m, 1))} style={s.icon}><Feather name="chevron-right" size={22} color={c.primary} /></Pressable>
    </View>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error && <Text style={s.muted}>{it ? "Impossibile caricare il calendario." : "Could not load calendar."}</Text>}
    {!isLoading && sorted.length === 0 && <Text style={s.muted}>{it ? "Nessun elemento questo mese." : "Nothing scheduled this month."}</Text>}
    {sorted.map(item => <Pressable key={`${item.type}-${item.id}`} style={s.card} onPress={() => item.type === "ticket" ? router.push(`/ticket/${item.id}`) : openForm(item)} onLongPress={() => item.type === "appointment" && remove(item)}>
      <View style={s.dateBox}><Text style={s.day}>{new Date(item.startsAt || item.date).getDate()}</Text><Text style={s.weekday}>{new Date(item.startsAt || item.date).toLocaleDateString(it ? "it-IT" : "en-US", { weekday: "short" })}</Text></View>
      <View style={s.main}><Text style={s.itemTitle}>{item.title}</Text><Text style={s.muted}>{item.type === "ticket" ? (it ? "Ticket" : "Ticket") : (it ? "Appuntamento" : "Appointment")}{item.startsAt ? ` · ${new Date(item.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</Text></View>
      <Feather name={item.type === "ticket" ? "tool" : "calendar"} size={17} color={c.primary} />
    </Pressable>)}
    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
      <View style={s.overlay}><View style={s.modal}>
        <Text style={s.modalTitle}>{editing ? (it ? "Modifica appuntamento" : "Edit appointment") : (it ? "Nuovo appuntamento" : "New appointment")}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder={it ? "Titolo" : "Title"} placeholderTextColor={c.mutedForeground} style={s.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder={it ? "Descrizione (facoltativa)" : "Description (optional)"} placeholderTextColor={c.mutedForeground} style={[s.input, s.multiline]} multiline />
        <TextInput value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DDTHH:mm" placeholderTextColor={c.mutedForeground} style={s.input} />
        <View style={s.modalActions}><Pressable onPress={() => setFormOpen(false)} style={s.secondary}><Text style={s.modalActionText}>{it ? "Annulla" : "Cancel"}</Text></Pressable><Pressable onPress={() => void save()} disabled={saving || !title.trim() || !startsAt} style={s.primary}><Text style={s.primaryText}>{saving ? "…" : (it ? "Salva" : "Save")}</Text></Pressable></View>
        {editing && <Pressable onPress={() => { setFormOpen(false); remove(editing); }} style={s.delete}><Text style={s.deleteText}>{it ? "Elimina appuntamento" : "Delete appointment"}</Text></Pressable>}
      </View></View>
    </Modal>
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" },
  add: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, backgroundColor: c.primary, paddingHorizontal: 11, paddingVertical: 9 }, addText: { color: c.primaryForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 5 },
  month: { color: c.foreground, fontSize: 17, fontFamily: "Inter_600SemiBold" }, icon: { padding: 8 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14 },
  dateBox: { width: 44, alignItems: "center", padding: 6, borderRadius: 10, backgroundColor: c.muted }, day: { color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }, weekday: { color: c.mutedForeground, fontSize: 11 },
  main: { flex: 1, gap: 4 }, itemTitle: { color: c.foreground, fontFamily: "Inter_600SemiBold" }, muted: { color: c.mutedForeground },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, modal: { backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 12 },
  modalTitle: { color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }, input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 10, color: c.foreground, paddingHorizontal: 12, paddingVertical: 11 },
  multiline: { minHeight: 78, textAlignVertical: "top" }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  primary: { backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 }, primaryText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  secondary: { paddingHorizontal: 15, paddingVertical: 11 }, modalActionText: { color: c.foreground }, delete: { alignSelf: "flex-start", paddingVertical: 5 }, deleteText: { color: "#da1e28", fontSize: 13 },
});
