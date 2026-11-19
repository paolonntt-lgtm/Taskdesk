import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { listClients } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { radii } from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPatch, apiPost } from "@/utils/api";
import { getMobileOrganizationSettingsQueryKey } from "@/utils/optionalTabs";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

type Client = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  membershipNumber?: string | null;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  taxCode?: string | null;
  address?: string | null;
  pec?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
};
type ClientDraft = Omit<Client, "id">;
const emptyDraft = (): ClientDraft => ({
  name: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  membershipNumber: "",
  alias: "",
  email: "",
  phone: "",
  vatNumber: "",
  taxCode: "",
  address: "",
  pec: "",
  contactPerson: "",
  notes: "",
});
const splitClientName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts.shift() ?? "", lastName: parts.join(" ") };
};
const CLIENT_PAGE_SIZE = 100;
const CLIENT_SEARCH_DEBOUNCE_MS = 250;
export default function ClientsScreen() {
  const c = useColors(); const { lang, t } = useLanguage(); const it = lang === "it"; const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { user } = useAuth(); const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft); const [saving, setSaving] = useState(false);
  const organizationSettings = useQuery({
    queryKey: getMobileOrganizationSettingsQueryKey(user?.organizationId),
    queryFn: () => apiGet<{ clientsEnabled?: boolean; profession?: string | null }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const isGym = organizationSettings.data?.profession === "palestre";
  const settingsUnavailable = organizationSettings.isError || organizationSettings.isRefetchError;
  const clientsEnabled =
    organizationSettings.isSuccess &&
    !settingsUnavailable &&
    organizationSettings.data?.clientsEnabled === true;
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(search.trim()),
      CLIENT_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [search]);
  const {
    data: clientPages,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  } = useInfiniteQuery({
    queryKey: ["mobile-clients", user?.organizationId, debouncedSearch],
    queryFn: ({ pageParam, signal }) => listClients({
      limit: CLIENT_PAGE_SIZE,
      offset: pageParam,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === CLIENT_PAGE_SIZE ? pages.length * CLIENT_PAGE_SIZE : undefined,
    enabled: clientsEnabled,
  });
  const clients = useMemo(() => clientPages?.pages.flat() ?? [], [clientPages]);
  const secondaryFor = (client: Client) => client.alias || client.email || client.phone || client.address || null;
  const openForm = (client?: Client) => {
    const legacyName = client && isGym ? splitClientName(client.name) : null;
    setEditing(client ?? null);
    setDraft({
      ...emptyDraft(),
      ...client,
      firstName: client?.firstName ?? legacyName?.firstName ?? "",
      lastName: client?.lastName ?? legacyName?.lastName ?? "",
    });
    setFormOpen(true);
  };
  const setField = (field: keyof ClientDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const save = async () => {
    const firstName = draft.firstName?.trim() ?? "";
    const lastName = draft.lastName?.trim() ?? "";
    if (isGym ? (!firstName || !lastName) : !draft.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: isGym ? `${firstName} ${lastName}` : draft.name.trim(),
        firstName: isGym ? firstName : (draft.firstName?.trim() || null),
        lastName: isGym ? lastName : (draft.lastName?.trim() || null),
        dateOfBirth: draft.dateOfBirth || null,
        membershipNumber: draft.membershipNumber?.trim() || null,
        alias: isGym ? null : (draft.alias?.trim() || null),
        email: draft.email?.split(/[;,\n]/).map((address) => address.trim()).filter(Boolean).join("; ") || null,
        phone: draft.phone?.trim() || null,
        vatNumber: isGym ? null : (draft.vatNumber?.trim() || null),
        taxCode: draft.taxCode?.trim() || null,
        address: draft.address?.trim() || null,
        pec: isGym ? null : (draft.pec?.trim() || null),
        contactPerson: isGym ? null : (draft.contactPerson?.trim() || null),
        notes: draft.notes?.trim() || null,
      };
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
  return <View style={s.root}>
    <FlatList
      testID="clients-list"
      data={clients}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      refreshing={isRefetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.primary} /> : null}
      keyExtractor={(client) => String(client.id)}
      renderItem={({ item: client }) => {
        const secondary = secondaryFor(client);
        return <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${client.name}. ${t.clientList.openDetails}`}
          testID={`client-row-${client.id}`}
          style={s.card}
          onPress={() => router.push(`/clients/${client.id}`)}
        >
          <View style={s.main}>
            <Text style={s.name} allowFontScaling>{client.name}</Text>
            {secondary ? <Text testID={`client-secondary-${client.id}`} style={s.secondary} allowFontScaling>{secondary}</Text> : null}
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
      }}
      ListHeaderComponent={
        <View style={s.content}>
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
          {isLoading ? <ActivityIndicator color={c.primary} /> : null}
          {error ? (
            <View style={s.state}>
              <Feather name="alert-circle" size={18} color={c.mutedForeground} />
              <Text style={s.muted}>{it ? "Impossibile caricare i clienti." : "Could not load clients."}</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={!isLoading && !error ? (
        <View style={s.state}>
          <Feather name="search" size={18} color={c.mutedForeground} />
          <Text style={s.muted}>{it ? "Nessun cliente trovato." : "No clients found."}</Text>
        </View>
      ) : null}
      contentContainerStyle={s.list}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={Platform.OS === "android"}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
      <View style={s.overlay}>
        <View style={s.modal}>
          <Text style={s.modalTitle}>{editing ? (it ? "Modifica cliente" : "Edit client") : (it ? "Nuovo cliente" : "New client")}</Text>
          <KeyboardAwareScrollViewCompat style={s.formScroll} contentContainerStyle={s.formFields} bottomOffset={70}>
            {isGym ? (
              <>
                <TextInput testID="client-first-name" accessibilityLabel={it ? "Nome" : "First name"} value={draft.firstName ?? ""} onChangeText={(value) => setField("firstName", value)} placeholder={it ? "Nome *" : "First name *"} placeholderTextColor={c.mutedForeground} style={s.input} />
                <TextInput testID="client-last-name" accessibilityLabel={it ? "Cognome" : "Last name"} value={draft.lastName ?? ""} onChangeText={(value) => setField("lastName", value)} placeholder={it ? "Cognome *" : "Last name *"} placeholderTextColor={c.mutedForeground} style={s.input} />
                <TextInput testID="client-date-of-birth" accessibilityLabel={it ? "Data di nascita" : "Date of birth"} value={draft.dateOfBirth ?? ""} onChangeText={(value) => setField("dateOfBirth", value)} placeholder={it ? "Data di nascita (AAAA-MM-GG)" : "Date of birth (YYYY-MM-DD)"} placeholderTextColor={c.mutedForeground} style={s.input} />
                <TextInput testID="client-membership-number" accessibilityLabel={it ? "Numero tessera" : "Membership number"} value={draft.membershipNumber ?? ""} onChangeText={(value) => setField("membershipNumber", value)} placeholder={it ? "Numero tessera" : "Membership number"} placeholderTextColor={c.mutedForeground} style={s.input} />
              </>
            ) : (
              <>
                <TextInput testID="client-name" accessibilityLabel={it ? "Nome cliente" : "Client name"} value={draft.name} onChangeText={(value) => setField("name", value)} placeholder={it ? "Nome cliente *" : "Client name *"} placeholderTextColor={c.mutedForeground} style={s.input} />
                <TextInput testID="client-alias" accessibilityLabel={it ? "Alias" : "Alias"} value={draft.alias ?? ""} onChangeText={(value) => setField("alias", value)} placeholder="Alias" placeholderTextColor={c.mutedForeground} style={s.input} />
                <TextInput testID="client-vat-number" accessibilityLabel={it ? "Partita IVA" : "VAT number"} value={draft.vatNumber ?? ""} onChangeText={(value) => setField("vatNumber", value)} placeholder={it ? "Partita IVA" : "VAT number"} placeholderTextColor={c.mutedForeground} style={s.input} />
              </>
            )}
            <TextInput testID="client-tax-code" accessibilityLabel={it ? "Codice fiscale" : "Tax code"} value={draft.taxCode ?? ""} onChangeText={(value) => setField("taxCode", value)} placeholder={it ? "Codice fiscale" : "Tax code"} placeholderTextColor={c.mutedForeground} style={s.input} />
            <TextInput testID="client-address" accessibilityLabel={it ? "Indirizzo" : "Address"} value={draft.address ?? ""} onChangeText={(value) => setField("address", value)} placeholder={it ? "Indirizzo" : "Address"} placeholderTextColor={c.mutedForeground} style={s.input} />
            {!isGym && <TextInput testID="client-pec" accessibilityLabel="PEC" value={draft.pec ?? ""} onChangeText={(value) => setField("pec", value)} placeholder="PEC" autoCapitalize="none" placeholderTextColor={c.mutedForeground} style={s.input} />}
            {!isGym && <TextInput testID="client-contact-person" accessibilityLabel={it ? "Referente" : "Contact person"} value={draft.contactPerson ?? ""} onChangeText={(value) => setField("contactPerson", value)} placeholder={it ? "Referente" : "Contact person"} placeholderTextColor={c.mutedForeground} style={s.input} />}
            <TextInput testID="client-email" accessibilityLabel="Email" value={draft.email ?? ""} onChangeText={(value) => setField("email", value)} placeholder="Email" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={c.mutedForeground} style={s.input} />
            <TextInput testID="client-phone" accessibilityLabel={it ? "Telefono" : "Phone"} value={draft.phone ?? ""} onChangeText={(value) => setField("phone", value)} placeholder={it ? (isGym ? "Cellulare" : "Telefono") : (isGym ? "Mobile phone" : "Phone")} keyboardType="phone-pad" placeholderTextColor={c.mutedForeground} style={s.input} />
            {!isGym && <TextInput testID="client-notes" accessibilityLabel={it ? "Note cliente" : "Client notes"} value={draft.notes ?? ""} onChangeText={(value) => setField("notes", value)} placeholder={it ? "Note cliente" : "Client notes"} multiline numberOfLines={4} textAlignVertical="top" placeholderTextColor={c.mutedForeground} style={[s.input, s.notesInput]} />}
          </KeyboardAwareScrollViewCompat>
          <View style={s.actions}>
            <Pressable testID="client-edit-cancel" onPress={() => setFormOpen(false)} style={s.cancel}><Text style={s.cancelText}>{it ? "Annulla" : "Cancel"}</Text></Pressable>
            <Pressable testID="client-edit-save" onPress={() => void save()} disabled={saving || (isGym ? (!draft.firstName?.trim() || !draft.lastName?.trim()) : !draft.name.trim())} style={s.save}><Text style={s.saveText}>{saving ? "…" : (it ? "Salva" : "Save")}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, center: { alignItems: "center", justifyContent: "center", padding: 24 }, content: { padding: 16, gap: 10 },
  list: { paddingBottom: 100 },
  retry: { backgroundColor: c.primary, borderRadius: radii.control, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 }, retryText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 }, title: { color: c.foreground, fontSize: 22, fontFamily: "Inter_700Bold" },
  add: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.control, backgroundColor: c.primary, paddingHorizontal: 12, minHeight: 44 }, addText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 48, borderRadius: radii.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  state: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: c.foreground, paddingVertical: 8 }, card: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderLeftWidth: 2, borderLeftColor: c.accent, borderRadius: radii.card, shadowColor: c.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.045, shadowRadius: 6, elevation: 1 },
  main: { flex: 1, gap: 2, minWidth: 0 },
  name: { color: c.foreground, fontSize: 15, lineHeight: 20, fontFamily: "Inter_600SemiBold", flexShrink: 1 }, secondary: { color: c.mutedForeground, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  edit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, muted: { color: c.mutedForeground, fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, modal: { backgroundColor: c.card, borderRadius: radii.prominent, padding: 18, gap: 12, maxHeight: "92%" },
  modalTitle: { color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" }, formScroll: { flexGrow: 1, flexShrink: 1 }, formFields: { gap: 12, paddingBottom: 4 }, input: { minHeight: 48, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: radii.control, color: c.foreground, paddingHorizontal: 12, paddingVertical: 11 },
  notesInput: { minHeight: 96 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 }, cancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }, cancelText: { color: c.foreground }, save: { minHeight: 44, backgroundColor: c.primary, borderRadius: radii.control, paddingHorizontal: 18, justifyContent: "center" }, saveText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
});
