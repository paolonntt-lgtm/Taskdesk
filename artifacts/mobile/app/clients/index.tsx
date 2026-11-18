import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "@/utils/api";
import { getMobileOrganizationSettingsQueryKey } from "@/utils/optionalTabs";

type Client = { id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null; address?: string | null };
export default function ClientsScreen() {
  const c = useColors(); const { lang, t } = useLanguage(); const it = lang === "it"; const [search, setSearch] = useState("");
  const { user } = useAuth(); const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState(""); const [saving, setSaving] = useState(false);
  const organizationSettings = useQuery({
    queryKey: getMobileOrganizationSettingsQueryKey(user?.organizationId),
    queryFn: () => apiGet<{ clientsEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const settingsUnavailable = organizationSettings.isError || organizationSettings.isRefetchError;
  const clientsEnabled =
    organizationSettings.isSuccess &&
    !settingsUnavailable &&
    organizationSettings.data?.clientsEnabled === true;
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["mobile-clients", user?.organizationId],
    queryFn: () => apiGet<Client[]>("/clients"),
    enabled: clientsEnabled,
  });
  const clients = useMemo(() => data.filter(x => `${x.name} ${x.alias ?? ""} ${x.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const secondaryFor = (client: Client) => client.alias || client.email || client.phone || client.address || null;
  const openForm = (client?: Client) => { setEditing(client ?? null); setName(client?.name ?? ""); setEmail(client?.email ?? ""); setPhone(client?.phone ?? ""); setFormOpen(true); };
  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null };
      if (editing) await apiPatch(`/clients/${editing.id}`, body);
      else await apiPost("/clients", body);
      await qc.invalidateQueries({ queryKey: ["mobile-clients", user?.organizationId] });
      await qc.invalidateQueries({ queryKey: ["mobile-client", editing?.id] });
      setFormOpen(false);
    } catch { Alert.alert(it ? "Errore" : "Error", it ? "Impossibile salvare il cliente." : "Could not save client."); }
    finally { setSaving(false); }
  };
  const s = styles(c);
  if (organizationSettings.isLoading) return <View style={[s.root, s.center]}><ActivityIndicator color={c.primary} /></View>;
  if (settingsUnavailable) return <View style={[s.root, s.center]}>
    <Text style={s.muted}>{it ? "Impossibile verificare se la gestione clienti è attiva." : "Could not verify whether client management is enabled."}</Text>
    <Pressable style={s.retry} onPress={() => void organizationSettings.refetch()}>
      <Text style={s.retryText}>{it ? "Riprova" : "Try again"}</Text>
    </Pressable>
  </View>;
  if (!clientsEnabled) return <View style={[s.root, s.center]}><Text style={s.muted}>{it ? "La gestione clienti non è attiva per questa organizzazione." : "Client management is not enabled for this organization."}</Text></View>;
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <View style={s.heading}>
      <Text style={s.title}>{t.clientList.title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.clientList.addClient}
        testID="clients-add"
        style={s.add}
        onPress={() => openForm()}
      >
        <Feather name="plus" size={18} color={c.primaryForeground} />
        <Text style={s.addText}>{it ? "Nuovo" : "Add"}</Text>
      </Pressable>
    </View>
    <View style={s.search}>
      <Feather name="search" size={17} color={c.mutedForeground} />
      <TextInput
        accessibilityLabel={t.clientList.search}
        testID="clients-search"
        value={search}
        onChangeText={setSearch}
        placeholder={t.clientList.search}
        placeholderTextColor={c.mutedForeground}
        style={s.searchInput}
      />
    </View>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error && (
      <View style={s.state}>
        <Feather name="alert-circle" size={18} color={c.mutedForeground} />
        <Text style={s.muted}>{it ? "Impossibile caricare i clienti." : "Could not load clients."}</Text>
      </View>
    )}
    {!isLoading && !error && clients.length === 0 && (
      <View style={s.state}>
        <Feather name="search" size={18} color={c.mutedForeground} />
        <Text style={s.muted}>{it ? "Nessun cliente trovato." : "No clients found."}</Text>
      </View>
    )}
    {clients.map(client => {
      const secondary = secondaryFor(client);
      return <Pressable
        key={client.id}
        accessibilityRole="button"
        accessibilityLabel={`${client.name}. ${t.clientList.openDetails}`}
        testID={`client-row-${client.id}`}
        style={s.card}
        onPress={() => router.push(`/clients/${client.id}`)}
      >
        <View style={s.main}>
          <Text style={s.name} numberOfLines={2}>{client.name}</Text>
          {secondary ? <Text testID={`client-secondary-${client.id}`} style={s.secondary} numberOfLines={1}>{secondary}</Text> : null}
        </View>
        {user?.role === "admin" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.clientList.editClient} ${client.name}`}
            testID={`client-edit-${client.id}`}
            hitSlop={8}
            onPress={(e) => { e.stopPropagation(); openForm(client); }}
            style={s.edit}
          >
            <Feather name="edit-2" size={16} color={c.mutedForeground} />
          </Pressable>
        )}
        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </Pressable>;
    })}
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
  root: { flex: 1, backgroundColor: c.background }, center: { alignItems: "center", justifyContent: "center", padding: 24 }, content: { padding: 16, gap: 10, paddingBottom: 100 },
  retry: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 }, retryText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 }, title: { color: c.foreground, fontSize: 22, fontFamily: "Inter_700Bold" },
  add: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, backgroundColor: c.primary, paddingHorizontal: 12, minHeight: 40 }, addText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  state: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: c.foreground, paddingVertical: 8 }, card: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 12 },
  main: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: c.foreground, fontSize: 15, lineHeight: 20, fontFamily: "Inter_600SemiBold" }, secondary: { color: c.mutedForeground, fontSize: 12, lineHeight: 16 },
  edit: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, muted: { color: c.mutedForeground, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, modal: { backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 12 },
  modalTitle: { color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }, input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 10, color: c.foreground, paddingHorizontal: 12, paddingVertical: 11 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 }, cancel: { padding: 12 }, cancelText: { color: c.foreground }, save: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" }, saveText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
});
