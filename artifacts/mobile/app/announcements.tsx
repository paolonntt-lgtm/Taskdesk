import React, { createElement, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiDelete, apiGet, apiPost, apiPut } from "@/utils/api";
import {
  localDateTimeInputValue,
  mergeAnnouncementPickerValue,
  runWithValidMobileAnnouncementSchedule,
} from "@/utils/announcementSchedule";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

type Audience = "all" | "location" | "group";
type Announcement = {
  id: number; title: string; body: string; targetType: Audience; targetLocation: string | null;
  targetGroupId: number | null; startsAt: string; endsAt: string; createdAt: string;
};
type Group = { id: number; name: string };
type Form = { title: string; body: string; targetType: Audience; targetLocation: string; targetGroupId: string; startsAt: string; endsAt: string };
type ScheduleField = "startsAt" | "endsAt";
type ActivePicker = { field: ScheduleField; mode: "date" | "time" } | null;

function emptyForm(): Form {
  const now = new Date();
  return { title: "", body: "", targetType: "all", targetLocation: "", targetGroupId: "", startsAt: localDateTimeInputValue(now), endsAt: localDateTimeInputValue(new Date(now.getTime() + 7 * 86_400_000)) };
}

export default function AnnouncementsScreen() {
  const colors = useColors();
  const st = makeStyles(colors);
  const { user } = useAuth();
  const { lang } = useLanguage();
  const it = lang === "it";
  const isAdmin = user?.role === "admin" && user.organizationId != null;
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(emptyForm());
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const listQuery = useQuery({ queryKey: ["mobile-announcements", user?.organizationId], queryFn: () => apiGet<Announcement[]>("/announcements"), enabled: isAdmin });
  const groupsQuery = useQuery({ queryKey: ["mobile-announcement-groups", user?.organizationId], queryFn: () => apiGet<Group[]>("/groups"), enabled: isAdmin });
  const locationsQuery = useQuery({ queryKey: ["mobile-announcement-locations", user?.organizationId], queryFn: () => apiGet<{ value: string[] }>("/settings/locations"), enabled: isAdmin });
  useEffect(() => { if (modalOpen && form.targetType === "location" && locationsQuery.data?.value.length === 1 && !form.targetLocation) setForm((f) => ({ ...f, targetLocation: locationsQuery.data!.value[0] })); }, [modalOpen, form.targetType, form.targetLocation, locationsQuery.data]);

  const reload = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["mobile-announcements", user?.organizationId] });
    await qc.invalidateQueries({ queryKey: ["mobile-active-announcements"] });
  }, [qc, user?.organizationId]);
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setActivePicker(null); setError(""); setModalOpen(true); };
  const openEdit = (item: Announcement) => {
    setEditing(item);
    setForm({ title: item.title, body: item.body, targetType: item.targetType, targetLocation: item.targetLocation ?? "", targetGroupId: item.targetGroupId == null ? "" : String(item.targetGroupId), startsAt: localDateTimeInputValue(item.startsAt), endsAt: localDateTimeInputValue(item.endsAt) });
    setActivePicker(null); setError(""); setModalOpen(true);
  };
  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      if (Platform.OS !== "ios") setActivePicker(null);
      return;
    }
    if (selected && activePicker) {
      const { field: key, mode } = activePicker;
      setForm((current) => ({ ...current, [key]: mergeAnnouncementPickerValue(current[key], selected, mode) }));
    }
    if (Platform.OS !== "ios") setActivePicker(null);
  };
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return setError(it ? "Inserisci titolo e testo dell’avviso." : "Enter an announcement title and message.");
    if (form.targetType === "location" && !form.targetLocation) return setError(it ? "Seleziona una sede." : "Select a location.");
    if (form.targetType === "group" && !form.targetGroupId) return setError(it ? "Seleziona un gruppo." : "Select a group.");
    setSaving(true); setError("");
    try {
      const saved = await runWithValidMobileAnnouncementSchedule(form.startsAt, form.endsAt, async (schedule) => {
        const payload = {
          title: form.title.trim(), body: form.body.trim(), targetType: form.targetType,
          targetLocation: form.targetType === "location" ? form.targetLocation : null,
          targetGroupId: form.targetType === "group" ? Number(form.targetGroupId) : null,
          ...schedule,
        };
        if (editing) await apiPut(`/announcements/${editing.id}`, payload);
        else await apiPost("/announcements", payload);
      });
      if (!saved) return setError(it ? "La data di fine deve essere successiva a quella di inizio." : "The end date must be after the start date.");
      setModalOpen(false); setActivePicker(null); await reload();
      Alert.alert(it ? "Salvato" : "Saved", it ? "Avviso salvato." : "Announcement saved.");
    } catch (e: any) { setError(e.message ?? (it ? "Impossibile salvare l’avviso." : "Could not save announcement.")); }
    finally { setSaving(false); }
  };
  const remove = (item: Announcement) => Alert.alert(
    it ? "Eliminare l’avviso?" : "Delete announcement?",
    it ? "Non sarà più mostrato ai destinatari." : "It will no longer be shown to recipients.",
    [{ text: it ? "Annulla" : "Cancel", style: "cancel" }, { text: it ? "Elimina" : "Delete", style: "destructive", onPress: async () => {
      try { await apiDelete(`/announcements/${item.id}`); await reload(); }
      catch (e: any) { Alert.alert(it ? "Errore" : "Error", e.message ?? (it ? "Impossibile eliminare." : "Could not delete.")); }
    } }],
  );
  const status = (item: Announcement) => {
    const now = Date.now();
    if (new Date(item.startsAt).getTime() > now) return it ? "Programmato" : "Scheduled";
    if (new Date(item.endsAt).getTime() > now) return it ? "Attivo" : "Active";
    return it ? "Terminato" : "Ended";
  };
  const audience = (item: Announcement) => item.targetType === "all" ? it ? "Tutti i collaboratori" : "All collaborators"
    : item.targetType === "location" ? item.targetLocation ?? (it ? "Sede non disponibile" : "Location unavailable")
    : groupsQuery.data?.find((g) => g.id === item.targetGroupId)?.name ?? (it ? "Gruppo non disponibile" : "Group unavailable");
  const field = (key: keyof Form, label: string, multiline = false) => <View style={st.field} key={key}>
    <Text style={st.label}>{label}</Text>
    <TextInput value={form[key]} onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))} style={[st.input, multiline && st.multiline]} multiline={multiline} maxLength={key === "title" ? 180 : key === "body" ? 5000 : undefined} placeholder={label} placeholderTextColor={colors.mutedForeground} autoCapitalize={key === "title" ? "sentences" : "none"} />
  </View>;
  const scheduleField = (key: ScheduleField, label: string) => {
    const value = new Date(form[key]);
    const validValue = Number.isNaN(value.getTime()) ? new Date() : value;
    const dateLabel = validValue.toLocaleDateString(it ? "it-IT" : "en-GB", { dateStyle: "medium" });
    const timeLabel = validValue.toLocaleTimeString(it ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    const accessibleDateLabel = `${label} — ${it ? "Data" : "Date"}`;
    const accessibleTimeLabel = `${label} — ${it ? "Ora" : "Time"}`;
    return <View style={st.field} key={key}>
      <Text style={st.label}>{label}</Text>
      {Platform.OS === "web" ? createElement("input", {
        type: "datetime-local",
        value: form[key],
        min: key === "endsAt" ? form.startsAt : undefined,
        max: key === "startsAt" ? form.endsAt : undefined,
        "aria-label": label,
        "data-testid": `input-announcement-${key === "startsAt" ? "starts-at" : "ends-at"}`,
        disabled: saving,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value })),
        style: {
          boxSizing: "border-box",
          width: "100%",
          minHeight: 46,
          padding: "10px 12px",
          borderRadius: 9,
          border: `1px solid ${colors.border}`,
          background: colors.card,
          color: colors.foreground,
          font: "inherit",
        },
      }) : <>
        <View style={st.scheduleControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accessibleDateLabel}: ${dateLabel}`}
            testID={`button-announcement-${key}-date`}
            style={st.scheduleControl}
            disabled={saving}
            onPress={() => setActivePicker({ field: key, mode: "date" })}
          >
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text style={st.scheduleControlText}>{dateLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accessibleTimeLabel}: ${timeLabel}`}
            testID={`button-announcement-${key}-time`}
            style={st.scheduleControl}
            disabled={saving}
            onPress={() => setActivePicker({ field: key, mode: "time" })}
          >
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={st.scheduleControlText}>{timeLabel}</Text>
          </Pressable>
        </View>
        {activePicker?.field === key && (
          <View style={st.pickerContainer}>
            <DateTimePicker
              value={validValue}
              mode={activePicker.mode}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              locale={it ? "it-IT" : "en-GB"}
              onChange={handlePickerChange}
            />
            {Platform.OS === "ios" && (
              <Pressable style={st.pickerDone} onPress={() => setActivePicker(null)}>
                <Text style={st.pickerDoneText}>{it ? "Fatto" : "Done"}</Text>
              </Pressable>
            )}
          </View>
        )}
      </>}
    </View>;
  };
  if (!isAdmin) return <View style={st.center}><Text style={st.muted}>{user?.role === "admin" ? it ? "Serve un’organizzazione per gestire gli avvisi." : "An organization is required to manage announcements." : it ? "Accesso riservato agli amministratori." : "Admin access only."}</Text></View>;
  const announcements = listQuery.data ?? [];
  return <View style={st.root}>
    <ScrollView contentContainerStyle={st.content}>
      <View style={st.heading}><View><Text style={st.title}>{it ? "Avvisi" : "Announcements"}</Text><Text style={st.muted}>{it ? "Pubblica messaggi per tutti o per gruppi specifici." : "Publish messages to everyone or selected groups."}</Text></View>
        <Pressable accessibilityLabel={it ? "Crea avviso" : "Create announcement"} style={st.addButton} onPress={openCreate}><Feather name="plus" size={17} color={colors.primaryForeground} /><Text style={st.addText}>{it ? "Nuovo" : "New"}</Text></Pressable>
      </View>
      {listQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {listQuery.error ? <Text style={st.error}>{it ? "Impossibile caricare gli avvisi. Riprova." : "Could not load announcements. Try again."}</Text> : null}
      {!listQuery.isLoading && announcements.length === 0 ? <View style={st.empty}><Feather name="bell" size={24} color={colors.mutedForeground} /><Text style={st.muted}>{it ? "Non ci sono avvisi." : "No announcements yet."}</Text></View> : null}
      {announcements.map((item) => <View key={item.id} style={st.card}>
        <View style={st.row}><Text style={st.cardTitle}>{item.title}</Text><Text style={st.badge}>{status(item)}</Text></View>
        <Text style={st.body} numberOfLines={5}>{item.body}</Text>
        <View style={st.meta}><Feather name={item.targetType === "all" ? "users" : item.targetType === "group" ? "briefcase" : "map-pin"} size={14} color={colors.mutedForeground} /><Text style={st.muted}>{audience(item)}</Text></View>
        <Text style={st.muted}>{it ? "Dal" : "From"} {new Date(item.startsAt).toLocaleString(it ? "it-IT" : "en-GB")} · {it ? "al" : "to"} {new Date(item.endsAt).toLocaleString(it ? "it-IT" : "en-GB")}</Text>
        <View style={st.actions}><Pressable onPress={() => openEdit(item)} style={st.action}><Feather name="edit-2" size={15} color={colors.primary} /><Text style={[st.actionText, { color: colors.primary }]}>{it ? "Modifica" : "Edit"}</Text></Pressable><Pressable onPress={() => remove(item)} style={st.action}><Feather name="trash-2" size={15} color={colors.destructive} /><Text style={[st.actionText, { color: colors.destructive }]}>{it ? "Elimina" : "Delete"}</Text></Pressable></View>
      </View>)}
    </ScrollView>
    <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
      if (!saving) {
        setActivePicker(null);
        setModalOpen(false);
      }
    }}>
      <View style={st.modal}>
        <View style={st.modalHeader}><Pressable disabled={saving} onPress={() => { setActivePicker(null); setModalOpen(false); }}><Text style={st.cancel}>{it ? "Annulla" : "Cancel"}</Text></Pressable><Text style={st.modalTitle}>{editing ? it ? "Modifica avviso" : "Edit announcement" : it ? "Nuovo avviso" : "New announcement"}</Text><Pressable disabled={saving} onPress={() => void save()}><Text style={st.save}>{saving ? "…" : it ? "Salva" : "Save"}</Text></Pressable></View>
        <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={st.form} keyboardShouldPersistTaps="handled">
          {field("title", it ? "Titolo" : "Title")}
          {field("body", it ? "Testo dell’avviso" : "Announcement message", true)}
          <View style={st.field}><Text style={st.label}>{it ? "Destinatari" : "Audience"}</Text><View style={st.options}>{(["all", "location", "group"] as Audience[]).map((value) => <Pressable key={value} onPress={() => setForm((f) => ({ ...f, targetType: value }))} style={[st.option, form.targetType === value && st.optionActive]}><Text style={[st.optionText, form.targetType === value && st.optionTextActive]}>{value === "all" ? it ? "Tutti" : "Everyone" : value === "location" ? it ? "Sede" : "Location" : it ? "Gruppo" : "Group"}</Text></Pressable>)}</View></View>
          {form.targetType === "location" && <View style={st.field}><Text style={st.label}>{it ? "Sede" : "Location"}</Text><View style={st.options}>{(locationsQuery.data?.value ?? []).map((location) => <Pressable key={location} style={[st.option, form.targetLocation === location && st.optionActive]} onPress={() => setForm((f) => ({ ...f, targetLocation: location }))}><Text style={[st.optionText, form.targetLocation === location && st.optionTextActive]}>{location}</Text></Pressable>)}</View>{(locationsQuery.data?.value ?? []).length === 0 && <Text style={st.muted}>{it ? "Nessuna sede configurata." : "No locations configured."}</Text>}</View>}
          {form.targetType === "group" && <View style={st.field}><Text style={st.label}>{it ? "Gruppo" : "Group"}</Text><View style={st.options}>{(groupsQuery.data ?? []).map((group) => <Pressable key={group.id} style={[st.option, form.targetGroupId === String(group.id) && st.optionActive]} onPress={() => setForm((f) => ({ ...f, targetGroupId: String(group.id) }))}><Text style={[st.optionText, form.targetGroupId === String(group.id) && st.optionTextActive]}>{group.name}</Text></Pressable>)}</View>{(groupsQuery.data ?? []).length === 0 && <Text style={st.muted}>{it ? "Nessun gruppo disponibile." : "No groups available."}</Text>}</View>}
          {scheduleField("startsAt", it ? "Inizio pubblicazione" : "Starts at")}
          {scheduleField("endsAt", it ? "Fine pubblicazione" : "Ends at")}
          <Text style={st.muted}>{it ? "L’avviso viene mostrato solo nell’intervallo selezionato." : "The announcement is shown only during this interval."}</Text>
          {!!error && <Text style={st.error}>{error}</Text>}
          <Pressable style={[st.addButton, saving && { opacity: 0.6 }]} disabled={saving} onPress={() => void save()}>{saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={st.addText}>{it ? "Salva avviso" : "Save announcement"}</Text>}</Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  </View>;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: Platform.OS === "web" ? 100 : 32, gap: 13 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, title: { color: colors.foreground, fontSize: 24, fontFamily: "Inter_700Bold" }, muted: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" }, addButton: { backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 12, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, addText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, gap: 9 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, cardTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16, flex: 1 }, badge: { color: colors.primary, backgroundColor: colors.primary + "18", borderRadius: 15, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 4, fontFamily: "Inter_500Medium", fontSize: 11 }, body: { color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 }, meta: { flexDirection: "row", alignItems: "center", gap: 7 }, actions: { flexDirection: "row", borderTopWidth: 1, borderColor: colors.border, paddingTop: 9, gap: 18 }, action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }, actionText: { fontFamily: "Inter_500Medium", fontSize: 13 }, empty: { padding: 28, alignItems: "center", gap: 8 }, error: { color: colors.destructive, fontSize: 13 },
  modal: { flex: 1, backgroundColor: colors.background }, modalHeader: { minHeight: 54, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, modalTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }, cancel: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }, save: { color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }, form: { padding: 16, gap: 16 }, field: { gap: 7 }, label: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 9, backgroundColor: colors.card, color: colors.foreground, paddingHorizontal: 12, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14 }, scheduleControls: { flexDirection: "row", gap: 8 }, scheduleControl: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderColor: colors.border, borderWidth: 1, borderRadius: 9, backgroundColor: colors.card, paddingHorizontal: 12 }, scheduleControlText: { flexShrink: 1, color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 13 }, pickerContainer: { alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.card, paddingVertical: 8 }, pickerDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 }, pickerDoneText: { color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }, multiline: { minHeight: 100, textAlignVertical: "top" }, options: { flexDirection: "row", gap: 7, flexWrap: "wrap" }, option: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, optionActive: { backgroundColor: colors.primary + "18", borderColor: colors.primary }, optionText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }, optionTextActive: { color: colors.primary },
});
}
