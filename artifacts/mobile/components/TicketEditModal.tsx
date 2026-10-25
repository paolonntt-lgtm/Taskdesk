import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { apiPatch } from "@/utils/api";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

export type EditableTicket = {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  resource?: string | null;
  priority: string;
  clientId?: number | null;
  assignedTo?: number | null;
  timeTrackingEnabled?: boolean;
  timeTrackingBillable?: boolean;
  timeTrackingCompensationOverride?: boolean | null;
};

export function TicketEditModal({
  visible,
  ticket,
  canEditTracking,
  onClose,
}: {
  visible: boolean;
  ticket: EditableTicket;
  canEditTracking: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [category, setCategory] = useState(ticket.category);
  const [location, setLocation] = useState(ticket.location);
  const [resource, setResource] = useState(ticket.resource ?? "");
  const [priority, setPriority] = useState(ticket.priority);
  const [billable, setBillable] = useState(ticket.timeTrackingBillable === true);
  const [recognizable, setRecognizable] = useState(ticket.timeTrackingCompensationOverride === true);
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
    setBillableTouched(false);
    setRecognizableTouched(false);
  }, [ticket, visible]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(lang === "it" ? "Titolo mancante" : "Missing title");
      return;
    }
    if (billableTouched && billable && !ticket.clientId) {
      Alert.alert(t.ticketDetail.clientRequiredForBillableTime);
      return;
    }
    if (recognizableTouched && recognizable && !ticket.assignedTo) {
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
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.card }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={saving}><Text style={{ color: colors.primary }}>{t.ticketDetail.cancel}</Text></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t.ticketDetail.editTicket}</Text>
          <TouchableOpacity onPress={() => void save()} disabled={saving || !title.trim()}>
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
          {canEditTracking && (
            <View style={[styles.trackingCard, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeTitle}</Text>
              {!ticket.timeTrackingEnabled && (
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>{t.ticketDetail.trackingClassificationHint}</Text>
              )}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeBillable}</Text>
                <Switch value={billable} onValueChange={(value) => { setBillable(value); setBillableTouched(true); }} disabled={!ticket.clientId} />
              </View>
              {!ticket.clientId && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.ticketDetail.clientRequiredForBillableTime}</Text>}
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t.ticketDetail.trackedTimeRecognizable}</Text>
                <Switch value={recognizable} onValueChange={(value) => { setRecognizable(value); setRecognizableTouched(true); }} disabled={!ticket.assignedTo} />
              </View>
              {!ticket.assignedTo && <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t.ticketDetail.trackedTimeAssigneeRequired}</Text>}
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
  trackingCard: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 14 },
  switchRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13 },
  hint: { fontSize: 12, marginBottom: 5 },
});
