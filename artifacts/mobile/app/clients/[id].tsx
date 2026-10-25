import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListClientNotesQueryKey,
  useCreateClientNote,
  useDeleteClientNote,
  useListClientNotes,
  useUpdateClientNote,
  type ClientNote,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiDelete, apiGet } from "@/utils/api";
import { getMobileOrganizationSettingsQueryKey } from "@/utils/optionalTabs";

type ClientNoteChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  checkedByName?: string | null;
  checkedAt?: string | null;
};

export default function ClientDetailScreen() {
  const c = useColors(); const { lang } = useLanguage(); const it = lang === "it"; const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth(); const qc = useQueryClient();
  const clientId = Number(id);
  const validClientId = Number.isInteger(clientId) && clientId > 0;
  const [noteDraft, setNoteDraft] = React.useState("");
  const [editingNoteId, setEditingNoteId] = React.useState<number | null>(null);
  const [editingBody, setEditingBody] = React.useState("");
  const [noteError, setNoteError] = React.useState("");
  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();
  const organizationSettings = useQuery({
    queryKey: getMobileOrganizationSettingsQueryKey(user?.organizationId),
    queryFn: () => apiGet<{ clientsEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const clientsEnabled = organizationSettings.isSuccess && organizationSettings.data?.clientsEnabled === true;
  const { data, isLoading, error } = useQuery({
    queryKey: ["mobile-client", id],
    queryFn: () => apiGet<any>(`/clients/${id}`),
    enabled: validClientId && clientsEnabled,
  });
  const notesQuery = useListClientNotes(clientId, {
    query: {
      queryKey: getListClientNotesQueryKey(clientId),
      enabled: validClientId && clientsEnabled,
      refetchInterval: 120_000,
      refetchIntervalInBackground: false,
    },
  });
  const client = data?.client ?? data;
  const canEditNote = (note: ClientNote) =>
    user?.role === "admin" ||
    user?.groupPermissions?.includes("edit_client_notes") === true ||
    note.authorId === user?.id;
  const canDeleteNote = (note: ClientNote) =>
    user?.role === "admin" ||
    user?.groupPermissions?.includes("delete_client_notes") === true ||
    note.authorId === user?.id;
  const refreshNotes = () =>
    qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body || !validClientId) return;
    setNoteError("");
    try {
      await createNote.mutateAsync({ id: clientId, data: { body, checklist: null } });
      setNoteDraft("");
      await refreshNotes();
    } catch {
      setNoteError(it ? "Impossibile salvare la nota." : "Could not save the note.");
    }
  };

  const saveEdit = async (note: ClientNote) => {
    const body = editingBody.trim();
    if (!body || !validClientId) return;
    setNoteError("");
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId: note.id,
        data: { body },
      });
      setEditingNoteId(null);
      setEditingBody("");
      await refreshNotes();
    } catch {
      setNoteError(it ? "Impossibile aggiornare la nota." : "Could not update the note.");
    }
  };

  const toggleChecklistItem = async (
    note: ClientNote,
    changedItem: ClientNoteChecklistItem,
  ) => {
    if (!validClientId) return;
    setNoteError("");
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId: note.id,
        data: {
          checklist: (note.checklist ?? []).map((item) => ({
            id: item.id,
            text: item.text,
            checked: item.id === changedItem.id ? !item.checked : item.checked,
          })),
        },
      });
      await refreshNotes();
    } catch {
      setNoteError(it ? "Impossibile aggiornare la lista." : "Could not update the checklist.");
    }
  };

  const confirmDeleteNote = (note: ClientNote) => {
    Alert.alert(
      it ? "Eliminare la nota?" : "Delete this note?",
      it ? "L’eliminazione non può essere annullata." : "This action cannot be undone.",
      [
        { text: it ? "Annulla" : "Cancel", style: "cancel" },
        {
          text: it ? "Elimina" : "Delete",
          style: "destructive",
          onPress: () => {
            void deleteNote.mutateAsync({ id: clientId, noteId: note.id })
              .then(refreshNotes)
              .catch(() => setNoteError(it ? "Impossibile eliminare la nota." : "Could not delete the note."));
          },
        },
      ],
    );
  };

  const remove = () => Alert.alert(it ? "Elimina cliente" : "Delete client", it ? "L'eliminazione non può essere annullata." : "This cannot be undone.", [
    { text: it ? "Annulla" : "Cancel", style: "cancel" },
    { text: it ? "Elimina" : "Delete", style: "destructive", onPress: async () => {
      try { await apiDelete(`/clients/${id}`); await qc.invalidateQueries({ queryKey: ["mobile-clients"] }); router.replace("/clients"); }
      catch { Alert.alert(it ? "Errore" : "Error", it ? "Impossibile eliminare il cliente." : "Could not delete client."); }
    } },
  ]);
  const s = styles(c);
  if (organizationSettings.isLoading) return <View style={[s.root, s.center]}><ActivityIndicator color={c.primary} /></View>;
  if (!clientsEnabled) return <View style={[s.root, s.center]}><Text style={s.muted}>{it ? "La gestione clienti non è attiva per questa organizzazione." : "Client management is not enabled for this organization."}</Text></View>;
  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <Stack.Screen options={{ title: client?.name ?? (it ? "Cliente" : "Client") }} />
    {isLoading && <ActivityIndicator color={c.primary} />}
    {error || !client ? (!isLoading && <Text style={s.muted}>{it ? "Cliente non disponibile." : "Client unavailable."}</Text>) : <>
      <Text style={s.title}>{client.name}</Text>
      {!!client.alias && <Text style={s.muted}>{client.alias}</Text>}
      <View style={s.card}>
        {([[it ? "Email" : "Email", client.email], [it ? "Telefono" : "Phone", client.phone], [it ? "Indirizzo" : "Address", client.address], ["P. IVA", client.vatNumber], [it ? "Referente" : "Contact", client.contactPerson], [it ? "Note" : "Notes", client.notes]] as Array<[string, string | null | undefined]>).filter(([, value]) => value).map(([label, value]) => <View key={label} style={s.field}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}
      </View>
      <View style={s.notesSection}>
        <View style={s.notesHeading}>
          <Text style={s.sectionTitle}>{it ? "Storico note" : "Notes history"}</Text>
          <Text style={s.noteCount}>{notesQuery.data?.length ?? 0}</Text>
        </View>
        <View style={s.composer}>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={it ? "Scrivi una nota sul cliente…" : "Write a client note…"}
            placeholderTextColor={c.mutedForeground}
            multiline
            textAlignVertical="top"
            style={s.noteInput}
            accessibilityLabel={it ? "Nuova nota cliente" : "New client note"}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={it ? "Aggiungi nota" : "Add note"}
            onPress={() => void addNote()}
            disabled={!noteDraft.trim() || createNote.isPending}
            style={[s.addNoteButton, (!noteDraft.trim() || createNote.isPending) && s.disabledButton]}
          >
            {createNote.isPending
              ? <ActivityIndicator size="small" color={c.primaryForeground} />
              : <><Feather name="plus" size={16} color={c.primaryForeground} /><Text style={s.addNoteText}>{it ? "Aggiungi" : "Add"}</Text></>}
          </Pressable>
        </View>
        {!!noteError && <Text style={s.error}>{noteError}</Text>}
        {notesQuery.isLoading && <ActivityIndicator color={c.primary} />}
        {notesQuery.isError && (
          <View style={s.inlineError}>
            <Text style={s.error}>{it ? "Impossibile caricare le note." : "Could not load notes."}</Text>
            <Pressable onPress={() => void notesQuery.refetch()}><Text style={s.retryText}>{it ? "Riprova" : "Retry"}</Text></Pressable>
          </View>
        )}
        {!notesQuery.isLoading && !notesQuery.isError && (notesQuery.data ?? []).length === 0 && (
          <Text style={s.emptyNotes}>{it ? "Non ci sono ancora note per questo cliente." : "There are no notes for this client yet."}</Text>
        )}
        {(notesQuery.data ?? []).map((note) => (
          <View key={note.id} style={s.noteCard}>
            <View style={s.noteHeader}>
              <View style={s.author}>
                <Feather name="user" size={14} color={c.mutedForeground} />
                <Text numberOfLines={1} style={s.authorName}>{note.authorName || (it ? "Utente" : "User")}</Text>
                <Text style={s.date}>{new Date(note.createdAt).toLocaleString(it ? "it-IT" : "en-US", { dateStyle: "short", timeStyle: "short" })}</Text>
              </View>
              <View style={s.noteActions}>
                {canEditNote(note) && (!!note.body || !(note.checklist?.length)) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={it ? "Modifica nota" : "Edit note"}
                    onPress={() => {
                      setEditingNoteId(note.id);
                        setEditingBody(note.body ?? "");
                      setNoteError("");
                    }}
                    style={s.iconButton}
                  >
                    <Feather name="edit-2" size={16} color={c.primary} />
                  </Pressable>
                )}
                {canDeleteNote(note) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={it ? "Elimina nota" : "Delete note"}
                    onPress={() => confirmDeleteNote(note)}
                    style={s.iconButton}
                  >
                    <Feather name="trash-2" size={16} color={c.destructive} />
                  </Pressable>
                )}
              </View>
            </View>
            {editingNoteId === note.id ? (
              <View style={s.editBox}>
                <TextInput
                  value={editingBody}
                  onChangeText={setEditingBody}
                  multiline
                  textAlignVertical="top"
                  style={s.noteInput}
                  accessibilityLabel={it ? "Modifica testo nota" : "Edit note text"}
                />
                <View style={s.editActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { setEditingNoteId(null); setEditingBody(""); }}
                    disabled={updateNote.isPending}
                    style={s.cancelButton}
                  >
                    <Text style={s.cancelText}>{it ? "Annulla" : "Cancel"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void saveEdit(note)}
                    disabled={!editingBody.trim() || updateNote.isPending}
                    style={[s.saveButton, (!editingBody.trim() || updateNote.isPending) && s.disabledButton]}
                  >
                    <Text style={s.addNoteText}>{updateNote.isPending ? "…" : (it ? "Salva" : "Save")}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {!!note.body && <Text style={s.noteBody}>{note.body}</Text>}
                {(note.checklist ?? []).map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    onPress={() => void toggleChecklistItem(note, item)}
                    style={s.checklistRow}
                  >
                    <Feather name={item.checked ? "check-square" : "square"} size={18} color={item.checked ? c.primary : c.mutedForeground} />
                    <Text style={[s.checklistText, item.checked && s.checkedText]}>{item.text}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        ))}
      </View>
      {user?.role === "admin" && <Pressable style={s.delete} onPress={remove}><Text style={s.deleteText}>{it ? "Elimina cliente" : "Delete client"}</Text></Pressable>}
    </>}
  </ScrollView>;
}
const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, content: { padding: 18, gap: 12, paddingBottom: 100 },
  title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" }, muted: { color: c.mutedForeground },
  card: { borderRadius: 14, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, padding: 16, gap: 14 },
  field: { gap: 4 }, label: { color: c.mutedForeground, fontSize: 12 }, value: { color: c.foreground, fontSize: 15 },
  notesSection: { gap: 10 },
  notesHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: c.foreground, fontSize: 18, fontFamily: "Inter_600SemiBold" },
  noteCount: { color: c.mutedForeground, fontSize: 12 },
  composer: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  noteInput: { minHeight: 72, color: c.foreground, fontSize: 14, lineHeight: 20, padding: 0 },
  addNoteButton: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 9, backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 8 },
  addNoteText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  disabledButton: { opacity: 0.5 },
  error: { color: c.destructive, fontSize: 13 },
  inlineError: { gap: 6, alignItems: "flex-start" },
  retryText: { color: c.primary, fontFamily: "Inter_600SemiBold" },
  emptyNotes: { color: c.mutedForeground, fontSize: 13, paddingVertical: 8 },
  noteCard: { gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  noteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  author: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { flexShrink: 1, color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  date: { color: c.mutedForeground, fontSize: 10 },
  noteActions: { flexDirection: "row", alignItems: "center" },
  iconButton: { minWidth: 36, height: 36, alignItems: "center", justifyContent: "center" },
  noteBody: { color: c.foreground, fontSize: 14, lineHeight: 20 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 },
  checklistText: { flex: 1, color: c.foreground, fontSize: 14, lineHeight: 19 },
  checkedText: { color: c.mutedForeground, textDecorationLine: "line-through" },
  editBox: { gap: 10 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelText: { color: c.foreground, fontFamily: "Inter_500Medium" },
  saveButton: { borderRadius: 9, backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 8 },
  delete: { alignSelf: "flex-start", padding: 12 }, deleteText: { color: "#da1e28", fontFamily: "Inter_600SemiBold" },
});
