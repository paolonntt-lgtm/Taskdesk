import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/utils/api";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { canEditTicketTracking } from "@/utils/ticketDetailRules";

type ClientOption = { id: number; name: string; alias?: string | null };
type CollaboratorOption = { id: number; name: string; isActive?: boolean };

export type EditableTicket = {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  resource?: string | null;
  priority: string;
  clientId?: number | null;
  client?: { id: number; name: string; alias?: string | null } | null;
  assignedTo?: number | null;
  assignedToGroup?: string | null;
  assignee?: { name: string } | null;
  timeTrackingEnabled?: boolean;
  timeTrackingBillable?: boolean;
  timeTrackingCompensationOverride?: boolean | null;
};

export function TicketEditModal({
  visible,
  ticket,
  trackingModuleEnabled,
  onClose,
}: {
  visible: boolean;
  ticket: EditableTicket;
  trackingModuleEnabled: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const canEditTracking = canEditTicketTracking({
    isAdmin,
    trackingModuleEnabled,
  });
  const clientsEnabled = user?.clientsEnabled === true;
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<ClientOption[]>("/clients"),
    enabled: visible && isAdmin && clientsEnabled,
  });
  const collaboratorsQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<CollaboratorOption[]>("/users"),
    enabled: visible && isAdmin,
  });
  const groupsQuery = useQuery({
    queryKey: ["ticket-assignment-groups"],
    queryFn: () => apiGet<{ value: string[] }>("/settings/groups"),
    enabled: visible && isAdmin,
  });
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [category, setCategory] = useState(ticket.category);
  const [location, setLocation] = useState(ticket.location);
  const [resource, setResource] = useState(ticket.resource ?? "");
  const [priority, setPriority] = useState(ticket.priority);
  const [billable, setBillable] = useState(ticket.timeTrackingBillable === true);
  const [recognizable, setRecognizable] = useState(ticket.timeTrackingCompensationOverride === true);
  const [clientId, setClientId] = useState<number | null>(ticket.clientId ?? null);
  const [assignedTo, setAssignedTo] = useState<number | null>(ticket.assignedTo ?? null);
  const [assignedGroup, setAssignedGroup] = useState<string | null>(ticket.assignedToGroup ?? null);
  const [assignmentMode, setAssignmentMode] = useState<"user" | "group">(
    ticket.assignedToGroup ? "group" : "user",
  );
  const [clientTouched, setClientTouched] = useState(false);
  const [assigneeTouched, setAssigneeTouched] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [showClientOptions, setShowClientOptions] = useState(false);
  const [showCollaboratorOptions, setShowCollaboratorOptions] = useState(false);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [billableTouched, setBillableTouched] = useState(false);
  const [recognizableTouched, setRecognizableTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(ticket.title);
    setDescription(ticket.description);
    setCategory(ticket.category);
    setLocation(ticket.location);
    setResource(ticket.resource ?? "");
    setPriority(ticket.priority);
    setBillable(ticket.timeTrackingBillable === true);
    setRecognizable(ticket.timeTrackingCompensationOverride === true);
    setClientId(ticket.clientId ?? null);
    setAssignedTo(ticket.assignedTo ?? null);
    setAssignedGroup(ticket.assignedToGroup ?? null);
    setAssignmentMode(ticket.assignedToGroup ? "group" : "user");
    setClientTouched(false);
    setAssigneeTouched(false);
    setClientSearch("");
    setCollaboratorSearch("");
    setGroupSearch("");
    setShowClientOptions(false);
    setShowCollaboratorOptions(false);
    setShowGroupOptions(false);
    setBillableTouched(false);
    setRecognizableTouched(false);
  }, [ticket, visible]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(lang === "it" ? "Titolo mancante" : "Missing title");
      return;
    }
    const effectiveClientId = clientTouched ? clientId : ticket.clientId ?? null;
    const effectiveAssignedTo = assigneeTouched ? assignedTo : ticket.assignedTo ?? null;
    if (canEditTracking && billableTouched && billable && effectiveClientId == null) {
      Alert.alert(t.ticketDetail.clientRequiredForBillableTime);
      return;
    }
    if (canEditTracking && recognizableTouched && recognizable && effectiveAssignedTo == null) {
      Alert.alert(t.ticketDetail.trackedTimeAssigneeRequired);
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/tickets/${ticket.id}`, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        resource: resource.trim() || null,
        priority,
        ...(isAdmin && clientTouched ? { clientId } : {}),
        ...(isAdmin && assigneeTouched ? { assignedTo, assignedToGroup: assignedGroup } : {}),
        ...(canEditTracking && billableTouched ? { timeTrackingBillable: billable } : {}),
        ...(canEditTracking && recognizableTouched
          ? { timeTrackingCompensationOverride: recognizable }
          : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onClose();
    } catch (error: any) {
      Alert.alert(
        lang === "it" ? "Errore" : "Error",
        error?.message ?? (lang === "it" ? "Impossibile salvare il ticket." : "Could not save the ticket."),
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = [styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }];
  const clients = clientsQuery.data ?? [];
  const collaborators = (collaboratorsQuery.data ?? []).filter(
    (collaborator) => collaborator.isActive !== false || collaborator.id === ticket.assignedTo,
  );
  const filteredClients = clients.filter((client) =>
    `${client.name} ${client.alias ?? ""}`.toLocaleLowerCase().includes(clientSearch.trim().toLocaleLowerCase()),
  );
  const filteredCollaborators = collaborators.filter((collaborator) =>
    collaborator.name.toLocaleLowerCase().includes(collaboratorSearch.trim().toLocaleLowerCase()),
  );
  const groups = groupsQuery.data?.value ?? [];
  const filteredGroups = groups.filter((group) =>
    group.toLocaleLowerCase().includes(groupSearch.trim().toLocaleLowerCase()),
  );
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedCollaborator = collaborators.find((collaborator) => collaborator.id === assignedTo);
  const noClientLabel = t.newTicket.noClient;
  const unassignedLabel = t.newTicket.unassigned;
  const clientSelectionLabel = selectedClient?.name
    ?? (clientId != null ? ticket.client?.name ?? noClientLabel : noClientLabel);
  const assignmentSelectionLabel = assignmentMode === "group"
    ? assignedGroup ?? (!assigneeTouched ? ticket.assignedToGroup : null) ?? unassignedLabel
    : selectedCollaborator?.name ?? (assignedTo != null ? ticket.assignee?.name ?? unassignedLabel : unassignedLabel);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.card }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={saving}><Text style={{ color: colors.primary }}>{t.ticketDetail.cancel}</Text></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t.ticketDetail.editTicket}</Text>
          <TouchableOpacity onPress={() => void save()} disabled={saving || !title.trim()} testID="edit-ticket-save">
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>{t.ticketDetail.save}</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.foreground }]}>{t.newTicket.titleField}</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={120} style={fieldStyle} />
          <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.description}</Text>
          <TextInput value={description} onChangeText={setDescription} multiline textAlignVertical="top" style={[fieldStyle, styles.multiline]} />
          <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.category}</Text>
          <TextInput value={category} onChangeText={setCategory} style={fieldStyle} />
          <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.location}</Text>
          <TextInput value={location} onChangeText={setLocation} style={fieldStyle} />
          <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.resource}</Text>
          <TextInput value={resource} onChangeText={setResource} style={fieldStyle} />
          <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.priority}</Text>
          <View style={styles.priorityRow}>
            {(["low", "medium", "high", "urgent"] as const).map((value) => (
              <TouchableOpacity key={value} onPress={() => setPriority(value)} style={[styles.priority, { borderColor: priority === value ? colors.primary : colors.border, backgroundColor: priority === value ? colors.primary : colors.background }]}>
                <Text style={{ color: priority === value ? colors.primaryForeground : colors.foreground }}>{t.priority[value] ?? value}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {isAdmin && clientsEnabled && (
            <View style={styles.selectionSection}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t.newTicket.client}</Text>
              <TouchableOpacity
                style={[styles.selectionButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => {
                  setShowClientOptions((value) => !value);
                  setShowCollaboratorOptions(false);
                }}
                accessibilityRole="button"
                testID="edit-ticket-client-picker"
              >
                <Text style={[styles.selectionText, { color: colors.foreground }]}>{clientSelectionLabel}</Text>
                <Text style={{ color: colors.mutedForeground }}>{showClientOptions ? "−" : "+"}</Text>
              </TouchableOpacity>
              {showClientOptions && (
                <View style={[styles.optionList, { borderColor: colors.border }]}>
                  <TextInput
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    placeholder={t.newTicket.searchClient}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border }]}
                    testID="edit-ticket-client-search"
                  />
                  <ScrollView style={styles.optionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      style={[styles.optionRow, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setClientId(null);
                        setClientTouched(true);
                        if (billable) {
                          setBillable(false);
                          setBillableTouched(true);
                        }
                        setShowClientOptions(false);
                      }}
                      testID="edit-ticket-client-option-none"
                    >
                      <Text style={[styles.optionText, { color: colors.foreground }]}>{noClientLabel}</Text>
                    </TouchableOpacity>
                    {filteredClients.map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        style={[styles.optionRow, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setClientId(client.id);
                          setClientTouched(true);
                          setShowClientOptions(false);
                        }}
                        testID={`edit-ticket-client-option-${client.id}`}
                      >
                        <Text style={[styles.optionText, { color: colors.foreground }]}>{client.alias || client.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {clientsQuery.isLoading && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{lang === "it" ? "Caricamento clienti…" : "Loading clients…"}</Text>}
                    {clientsQuery.isError && (
                      <TouchableOpacity onPress={() => void clientsQuery.refetch()}>
                        <Text style={[styles.hint, { color: colors.destructive }]}>{t.newTicket.loadOptionsError} · {lang === "it" ? "Riprova" : "Retry"}</Text>
                      </TouchableOpacity>
                    )}
                    {!clientsQuery.isLoading && !clientsQuery.isError && filteredClients.length === 0 && (
                      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.newTicket.noClientFound}</Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
          {isAdmin && (
            <View style={styles.selectionSection}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t.newTicket.assignment}</Text>
              <View style={styles.assignmentModeRow}>
                {(["user", "group"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.assignmentMode,
                      {
                        borderColor: assignmentMode === mode ? colors.primary : colors.border,
                        backgroundColor: assignmentMode === mode ? colors.primary : colors.background,
                      },
                    ]}
                    onPress={() => {
                      setAssignmentMode(mode);
                      setShowCollaboratorOptions(false);
                      setShowGroupOptions(false);
                    }}
                    accessibilityRole="button"
                    testID={`edit-ticket-assignment-mode-${mode}`}
                  >
                    <Text style={{ color: assignmentMode === mode ? colors.primaryForeground : colors.foreground }}>
                      {mode === "user" ? t.newTicket.assignUser : t.newTicket.assignGroup}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {assignmentMode === "user" ? (
                <>
                  <TouchableOpacity
                    style={[styles.selectionButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => {
                      setShowCollaboratorOptions((value) => !value);
                      setShowGroupOptions(false);
                      setShowClientOptions(false);
                    }}
                    accessibilityRole="button"
                    testID="edit-ticket-collaborator-picker"
                  >
                    <Text style={[styles.selectionText, { color: colors.foreground }]}>{assignmentSelectionLabel}</Text>
                    <Text style={{ color: colors.mutedForeground }}>{showCollaboratorOptions ? "−" : "+"}</Text>
                  </TouchableOpacity>
                  {showCollaboratorOptions && (
                    <View style={[styles.optionList, { borderColor: colors.border }]}>
                      <TextInput
                        value={collaboratorSearch}
                        onChangeText={setCollaboratorSearch}
                        placeholder={lang === "it" ? "Cerca collaboratore…" : "Search collaborators…"}
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border }]}
                        testID="edit-ticket-collaborator-search"
                      />
                      <ScrollView style={styles.optionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        <TouchableOpacity
                          style={[styles.optionRow, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setAssignedTo(null);
                          setAssignedGroup(null);
                            setAssigneeTouched(true);
                            if (recognizable) {
                              setRecognizable(false);
                              setRecognizableTouched(true);
                            }
                            setShowCollaboratorOptions(false);
                          }}
                          testID="edit-ticket-collaborator-option-none"
                        >
                          <Text style={[styles.optionText, { color: colors.foreground }]}>{unassignedLabel}</Text>
                        </TouchableOpacity>
                        {filteredCollaborators.map((collaborator) => (
                          <TouchableOpacity
                            key={collaborator.id}
                            style={[styles.optionRow, { borderBottomColor: colors.border }]}
                            onPress={() => {
                              setAssignedTo(collaborator.id);
                              setAssignedGroup(null);
                              setAssigneeTouched(true);
                              setShowCollaboratorOptions(false);
                            }}
                            testID={`edit-ticket-collaborator-option-${collaborator.id}`}
                          >
                            <Text style={[styles.optionText, { color: colors.foreground }]}>{collaborator.name}</Text>
                          </TouchableOpacity>
                        ))}
                        {collaboratorsQuery.isLoading && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{lang === "it" ? "Caricamento collaboratori…" : "Loading collaborators…"}</Text>}
                        {collaboratorsQuery.isError && (
                          <TouchableOpacity onPress={() => void collaboratorsQuery.refetch()}>
                            <Text style={[styles.hint, { color: colors.destructive }]}>{t.newTicket.loadOptionsError} · {lang === "it" ? "Riprova" : "Retry"}</Text>
                          </TouchableOpacity>
                        )}
                        {!collaboratorsQuery.isLoading && !collaboratorsQuery.isError && filteredCollaborators.length === 0 && (
                          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{lang === "it" ? "Nessun collaboratore trovato." : "No collaborators found."}</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.selectionButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => {
                      setShowGroupOptions((value) => !value);
                      setShowCollaboratorOptions(false);
                      setShowClientOptions(false);
                    }}
                    accessibilityRole="button"
                    testID="edit-ticket-group-picker"
                  >
                    <Text style={[styles.selectionText, { color: colors.foreground }]}>{assignmentSelectionLabel}</Text>
                    <Text style={{ color: colors.mutedForeground }}>{showGroupOptions ? "−" : "+"}</Text>
                  </TouchableOpacity>
                  {showGroupOptions && (
                    <View style={[styles.optionList, { borderColor: colors.border }]}>
                      <TextInput
                        value={groupSearch}
                        onChangeText={setGroupSearch}
                        placeholder={lang === "it" ? "Cerca gruppo…" : "Search groups…"}
                        placeholderTextColor={colors.mutedForeground}
                        style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border }]}
                        testID="edit-ticket-group-search"
                      />
                      <ScrollView style={styles.optionsScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        <TouchableOpacity
                          style={[styles.optionRow, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setAssignedTo(null);
                            setAssignedGroup(null);
                            setAssigneeTouched(true);
                            if (recognizable) {
                              setRecognizable(false);
                              setRecognizableTouched(true);
                            }
                            setShowGroupOptions(false);
                          }}
                          testID="edit-ticket-group-option-none"
                        >
                          <Text style={[styles.optionText, { color: colors.foreground }]}>{unassignedLabel}</Text>
                        </TouchableOpacity>
                        {filteredGroups.map((group) => (
                          <TouchableOpacity
                            key={group}
                            style={[styles.optionRow, { borderBottomColor: colors.border }]}
                            onPress={() => {
                              setAssignedTo(null);
                              setAssignedGroup(group);
                              setAssigneeTouched(true);
                              if (recognizable) {
                                setRecognizable(false);
                                setRecognizableTouched(true);
                              }
                              setShowGroupOptions(false);
                            }}
                            testID={`edit-ticket-group-option-${group}`}
                          >
                            <Text style={[styles.optionText, { color: colors.foreground }]}>{group}</Text>
                          </TouchableOpacity>
                        ))}
                        {groupsQuery.isLoading && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{lang === "it" ? "Caricamento gruppi…" : "Loading groups…"}</Text>}
                        {groupsQuery.isError && (
                          <TouchableOpacity onPress={() => void groupsQuery.refetch()}>
                            <Text style={[styles.hint, { color: colors.destructive }]}>{t.newTicket.loadOptionsError} · {lang === "it" ? "Riprova" : "Retry"}</Text>
                          </TouchableOpacity>
                        )}
                        {!groupsQuery.isLoading && !groupsQuery.isError && filteredGroups.length === 0 && (
                          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{lang === "it" ? "Nessun gruppo trovato." : "No groups found."}</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          {canEditTracking && (
            <View style={[styles.trackingCard, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeTitle}</Text>
              {!ticket.timeTrackingEnabled && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>{t.ticketDetail.trackingClassificationHint}</Text>
              )}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeBillable}</Text>
                <Switch value={billable} onValueChange={(value) => { setBillable(value); setBillableTouched(true); }} disabled={clientId == null} testID="edit-ticket-billable-switch" />
              </View>
              {clientId == null && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.ticketDetail.clientRequiredForBillableTime}</Text>}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeRecognizable}</Text>
                <Switch value={recognizable} onValueChange={(value) => { setRecognizable(value); setRecognizableTouched(true); }} disabled={assignedTo == null} testID="edit-ticket-recognizable-switch" />
              </View>
              {assignedTo == null && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.ticketDetail.trackedTimeAssigneeRequired}</Text>}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  content: { padding: 18, paddingBottom: 32, gap: 8 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14 },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priority: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  selectionSection: { gap: 5 },
  assignmentModeRow: { flexDirection: "row", gap: 8 },
  assignmentMode: { minHeight: 38, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  selectionButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectionText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  optionList: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  searchInput: { minHeight: 42, paddingHorizontal: 12, borderBottomWidth: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  optionsScroll: { maxHeight: 200 },
  optionRow: { minHeight: 42, paddingHorizontal: 12, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  trackingCard: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 14 },
  switchRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  hint: { fontSize: 12, marginBottom: 5 },
});
