import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiDelete, apiGet } from "@/utils/api";

export default function ClientDetailScreen() {
  const c = useColors(); const { lang } = useLanguage(); const it = lang === "it"; const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth(); const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["mobile-client", id], queryFn: () => apiGet<any>(`/clients/${id}`), enabled: !!id });
  const client = data?.client ?? data;
  const remove = () => Alert.alert(it ? "Elimina cliente" : "Delete client", it ? "L'eliminazione non può essere annullata." : "This cannot be undone.", [
    { text: it ? "Annulla" : "Cancel", style: "cancel" },
    { text: it ? "Elimina" : "Delete", style: "destructive", onPress: async () => {
      try { await apiDelete(`/clients/${id}`); await qc.invalidateQueries({ queryKey: ["mobile-clients"] }); router.replace("/clients"); }
      catch { Alert.alert(it ? "Errore" : "Error", it ? "Impossibile eliminare il cliente." : "Could not delete client."); }
    } },
  ]);
  const s = styles(c);
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error || !client ? (!isLoading && <Text style={s.muted}>{it ? "Cliente non disponibile." : "Client unavailable."}</Text>) : <>
      <Text style={s.title}>{client.name}</Text>
      {!!client.alias && <Text style={s.muted}>{client.alias}</Text>}
      <View style={s.card}>
        {([[it ? "Email" : "Email", client.email], [it ? "Telefono" : "Phone", client.phone], [it ? "Indirizzo" : "Address", client.address], ["P. IVA", client.vatNumber], [it ? "Referente" : "Contact", client.contactPerson], [it ? "Note" : "Notes", client.notes]] as Array<[string, string | null | undefined]>).filter(([, value]) => value).map(([label, value]) => <View key={label} style={s.field}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
      </View>
      {user?.role === "admin" && <Pressable style={s.delete} onPress={remove}><Text style={s.deleteText}>{it ? "Elimina cliente" : "Delete client"}</Text></Pressable>}
    </>}
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" }, muted: { color: c.mutedForeground },
  card: { borderRadius: 14, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, padding: 16, gap: 14 },
  field: { gap: 4 }, label: { color: c.mutedForeground, fontSize: 12 }, value: { color: c.foreground, fontSize: 15 },
  delete: { alignSelf: "flex-start", padding: 12 }, deleteText: { color: "#da1e28", fontFamily: "Inter_600SemiBold" },
});
