import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "@/utils/api";

type Client = { id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null; address?: string | null };
export default function ClientsScreen() {
  const c = useColors(); const { lang } = useLanguage(); const it = lang === "it"; const [search, setSearch] = useState("");
  const { user } = useAuth(); const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [saving, setSaving] = useState(false);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["mobile-clients"], queryFn: () => apiGet<Client[]>("/clients") });
  const clients = useMemo(() => data.filter(x => `${x.name} ${x.alias ?? ""} ${x.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const openForm = (client?: Client) => { setEditing(client ?? null); setName(client?.name ?? ""); setEmail(client?.email ?? ""); setPhone(client?.phone ?? ""); setFormOpen(true); };
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null };
      if (editing) await apiPatch(`/clients/${editing.id}`, body);
      else await apiPost("/clients", body);
      await qc.invalidateQueries({ queryKey: ["mobile-clients"] });
      await qc.invalidateQueries({ queryKey: ["mobile-client", editing?.id] });
      setFormOpen(false);
    } catch { Alert.alert(it ? "Errore" : "Error", it ? "Impossibile salvare il cliente." : "Could not save client."); }
    finally { setSaving(false); }
  };
  const s = styles(c);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <View style={s.heading}><Text style={s.title}>{it ? "Clienti" : "Clients"}</Text><Pressable style={s.add} onPress={() => openForm()}><Feather name="plus" size={18} color={c.primaryForeground} /><Text style={s.addText}>{it ? "Nuovo" : "Add"}</Text></Pressable></View>
    <View style={s.search}><Feather name="search" size={17} color={c.mutedForeground} /><TextInput value={search} onChangeText={setSearch} placeholder={it ? "Cerca cliente" : "Search clients"} placeholderTextColor={c.mutedForeground} style={s.searchInput} /></View>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error && <Text style={s.muted}>{it ? "Impossibile caricare i clienti." : "Could not load clients."}</Text>}
    {!isLoading && clients.length === 0 && <Text style={s.muted}>{it ? "Nessun cliente trovato." : "No clients found."}</Text>}
    {clients.map(client => <Pressable key={client.id} style={s.card} onPress={() => router.push(`/clients/${client.id}`)} onLongPress={() => openForm(client)}>
      <View style={s.avatar}><Feather name="briefcase" size={18} color={c.primary} /></View>
      <View style={s.main}><Text style={s.name}>{client.name}</Text>{!!client.alias && <Text style={s.muted}>{client.alias}</Text>}<Text style={s.muted}>{client.email || client.phone || client.address || ""}</Text></View>
      {user?.role === "admin" && <Pressable onPress={(e) => { e.stopPropagation(); openForm(client); }} style={{ padding: 8 }}><Feather name="edit-2" size={16} color={c.primary} /></Pressable>}
      <Feather name="chevron-right" size={18} color={c.mutedForeground} />
    </Pressable>)}
    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
      <View style={s.overlay}><View style={s.modal}><Text style={s.modalTitle}>{editing ? (it ? "Modifica cliente" : "Edit client") : (it ? "Nuovo cliente" : "New client")}</Text>
        <TextInput value={name} onChangeText={setName} placeholder={it ? "Nome cliente *" : "Client name *"} placeholderTextColor={c.mutedForeground} style={s.input} />
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={c.mutedForeground} style={s.input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder={it ? "Telefono" : "Phone"} keyboardType="phone-pad" placeholderTextColor={c.mutedForeground} style={s.input} />
        <View style={s.actions}><Pressable onPress={() => setFormOpen(false)} style={s.cancel}><Text style={s.cancelText}>{it ? "Annulla" : "Cancel"}</Text></Pressable><Pressable onPress={() => void save()} disabled={!name.trim() || saving} style={s.save}><Text style={s.saveText}>{saving ? "…" : (it ? "Salva" : "Save")}</Text></Pressable></View>
      </View></View>
    </Modal>
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" },
  add: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 9 }, addText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  searchInput: { flex: 1, color: c.foreground, paddingVertical: 12 }, card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.primary + "18", alignItems: "center", justifyContent: "center" }, main: { flex: 1, gap: 3 },
  name: { color: c.foreground, fontFamily: "Inter_600SemiBold" }, muted: { color: c.mutedForeground, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, modal: { backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 12 },
  modalTitle: { color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }, input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 10, color: c.foreground, paddingHorizontal: 12, paddingVertical: 11 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 }, cancel: { padding: 12 }, cancelText: { color: c.foreground }, save: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" }, saveText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
});
