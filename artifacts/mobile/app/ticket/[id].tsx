import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform, Modal, KeyboardAvoidingView, Pressable,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPatch, apiPost, apiDelete, PRIORITY_COLORS } from "@/utils/api";
import * as DocumentPicker from "expo-document-picker";
import {
  getPendingTicketAttachments,
  getTicketAttachmentMimeType,
  isAllowedTicketAttachmentMimeType,
  MAX_TICKET_ATTACHMENT_SIZE,
  processPendingTicketAttachments,
  replacePendingTicketAttachment,
  savePendingTicketAttachments,
  type PendingTicketAttachment,
} from "@/utils/pendingTicketAttachments";
import { useTicketStatuses } from "@/hooks/useTicketStatuses";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

interface Ticket {
  id: number; title: string; description: string;
  category: string; location: string; resource?: string;
  priority: string; status: string;
  assignedTo?: number | null;
  createdAt: string; closedAt?: string;
  resolutionNote?: string | null;
  workedMinutes?: number | null;
  timeTrackingEnabled?: boolean;
  timeTrackingBillable?: boolean;
  timeTrackingCompensationOverride?: boolean | null;
  canViewTimeTrackingSummary?: boolean;
  timeSessions?: Array<{ id: number; userName: string; durationMinutes: number; endedAt: string | null; clientBillable: boolean; collaboratorRecognizable: boolean }>;
  timeTrackingSummary?: { totalMinutes: number; clientBillableMinutes: number; collaboratorRecognizableMinutes: number; activeForCurrentUser: boolean };
  canChangeStatus?: boolean;
  creator: { name: string }; assignee?: { name: string } | null;
  assignedToGroup?: string | null;
  commentCount: number;
  recurrenceRule?: { frequency: RecurrenceFreq; interval: number; dayOfWeek?: number | null; endDate?: string } | null;
  recurrenceNextAt?: string | null;
  scheduledAt?: string | null;
}
interface Comment {
  id: number; commentText: string; isInternal: boolean;
  author: { name: string }; createdAt: string;
}
interface TicketAttachment {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface TimeSessionEdit {
  id: number;
  sessionId: number;
  collaboratorName: string;
  editedByName: string;
  editedAt: string;
  previousDurationMinutes: number;
  updatedDurationMinutes: number;
  previousClientBillable: boolean;
  updatedClientBillable: boolean;
  previousCollaboratorRecognizable: boolean;
  updatedCollaboratorRecognizable: boolean;
}

type UploadUrlResponse = { uploadURL: string; objectPath: string };

function formatWorkedDuration(total: number, lang: string): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (lang === "it") {
    if (hours === 0) return `${minutes} minuti`;
    if (minutes === 0) return `${hours} ${hours === 1 ? "ora" : "ore"}`;
    return `${hours} ${hours === 1 ? "ora" : "ore"} e ${minutes} minuti`;
  }
  if (hours === 0) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  if (minutes === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} and ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export default function TicketDetailScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { statuses: orgStatuses, isClosedKey, getLabelForKey } = useTicketStatuses();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const s = styles(colors);
  const organizationSettingsQuery = useQuery({
    queryKey: ["mobile-organization-settings", user?.organizationId],
    queryFn: () => apiGet<{ workedTimeEnabled?: boolean; timeTrackingModuleEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const workedTimeEnabled = organizationSettingsQuery.isSuccess &&
    organizationSettingsQuery.data?.workedTimeEnabled !== false;
  const timeTrackingModuleEnabled = organizationSettingsQuery.data?.timeTrackingModuleEnabled === true;

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingTicketAttachment[]>([]);
  const [retryingAttachments, setRetryingAttachments] = useState(false);
  const [replacingAttachmentIndex, setReplacingAttachmentIndex] = useState<number | null>(null);

  const [resolutionModal, setResolutionModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [workedHours, setWorkedHours] = useState("");
  const [workedMinutes, setWorkedMinutes] = useState("");
  const [workedTimeError, setWorkedTimeError] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Recurrence modal state
  const [recurrenceModal, setRecurrenceModal] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(new Date().getDay());
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceSaving, setRecurrenceSaving] = useState(false);

  // Clone modal state
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneScheduledAt, setCloneScheduledAt] = useState("");
  const [cloneSaving, setCloneSaving] = useState(false);

  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [newItemTexts, setNewItemTexts] = useState<Record<number, string>>({});
  const [addingItemFor, setAddingItemFor] = useState<number | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [togglingItem, setTogglingItem] = useState<number | null>(null);
  const [checklistsExpanded, setChecklistsExpanded] = useState<Record<number, boolean>>({});
  const [editingItem, setEditingItem] = useState<{ clId: number; itemId: number; text: string } | null>(null);
  const [savingEditItem, setSavingEditItem] = useState(false);
  const [reorderingItem, setReorderingItem] = useState<number | null>(null);

  const { data: ticket, isLoading, refetch: refetchTicket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiGet<Ticket>(`/tickets/${id}`),
    enabled: !!id,
  });

  const timeSessionEditsQuery = useQuery({
    queryKey: ["ticket-time-session-edits", id],
    queryFn: () => apiGet<TimeSessionEdit[]>(`/tickets/${id}/time-session-edits`),
    enabled: user?.role === "admin" &&
      !!id &&
      timeTrackingModuleEnabled &&
      ticket?.timeTrackingEnabled === true,
  });

  useEffect(() => {
    let isCurrent = true;
    setPendingAttachments([]);
    getPendingTicketAttachments(id)
      .then((attachments) => {
        if (isCurrent) setPendingAttachments(attachments);
      })
      .catch(() => {
        if (isCurrent) {
          Alert.alert(t.ticketDetail.error, t.ticketDetail.pendingAttachmentsLoadError);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [id, t.ticketDetail.error, t.ticketDetail.pendingAttachmentsLoadError]);

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: () => apiGet<Comment[]>(`/tickets/${id}/comments`),
    enabled: !!id,
  });

  interface ChecklistItemType { id: number; text: string; checked: boolean; position: number; }
  interface ChecklistType { id: number; title: string; items: ChecklistItemType[]; position: number; }

  const { data: checklists = [], refetch: refetchChecklists } = useQuery({
    queryKey: ["ticket-checklists", id],
    queryFn: () => apiGet<ChecklistType[]>(`/tickets/${id}/checklists`),
    enabled: !!id,
  });

  const handleCreateChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    setSavingChecklist(true);
    try {
      await apiPost(`/tickets/${id}/checklists`, { title: newChecklistTitle.trim() });
      setNewChecklistTitle("");
      setAddingChecklist(false);
      refetchChecklists();
    } catch (e: any) {
      Alert.alert(t.checklist.deleteChecklist, e.message ?? t.checklist.itemError);
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (clId: number) => {
    Alert.alert(
      t.checklist.deleteChecklist,
      t.checklist.deleteChecklistConfirm,
      [
        { text: t.checklist.cancel, style: "cancel" },
        {
          text: t.checklist.deleteChecklistAction,
          style: "destructive",
          onPress: async () => {
            try {
              await apiDelete(`/tickets/${id}/checklists/${clId}`);
              refetchChecklists();
            } catch {
              Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
            }
          },
        },
      ]
    );
  };

  const handleToggleItem = async (clId: number, itemId: number, checked: boolean) => {
    setTogglingItem(itemId);
    try {
      await apiPatch(`/tickets/${id}/checklists/${clId}/items/${itemId}`, { checked: !checked });
      refetchChecklists();
    } catch {
      Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
    } finally {
      setTogglingItem(null);
    }
  };

  const handleAddItem = async (clId: number) => {
    const text = newItemTexts[clId]?.trim();
    if (!text) return;
    setSavingItem(true);
    try {
      await apiPost(`/tickets/${id}/checklists/${clId}/items`, { text });
      setNewItemTexts((prev) => ({ ...prev, [clId]: "" }));
      setAddingItemFor(null);
      refetchChecklists();
    } catch {
      Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (clId: number, itemId: number) => {
    try {
      await apiDelete(`/tickets/${id}/checklists/${clId}/items/${itemId}`);
      refetchChecklists();
    } catch {
      Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
    }
  };

  const handleSaveEditItem = async () => {
    if (!editingItem || !editingItem.text.trim()) return;
    setSavingEditItem(true);
    try {
      await apiPatch(`/tickets/${id}/checklists/${editingItem.clId}/items/${editingItem.itemId}`, { text: editingItem.text.trim() });
      setEditingItem(null);
      refetchChecklists();
    } catch {
      Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
    } finally {
      setSavingEditItem(false);
    }
  };

  const handleReorderItem = async (clId: number, itemId: number, direction: 'up' | 'down', items: Array<{ id: number; position: number }>) => {
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((i) => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const neighbor = sorted[swapIdx];
    setReorderingItem(itemId);
    try {
      await Promise.all([
        apiPatch(`/tickets/${id}/checklists/${clId}/items/${current.id}`, { position: neighbor.position }),
        apiPatch(`/tickets/${id}/checklists/${clId}/items/${neighbor.id}`, { position: current.position }),
      ]);
      refetchChecklists();
    } catch {
      Alert.alert(t.checklist.deleteChecklist, t.checklist.itemError);
    } finally {
      setReorderingItem(null);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!ticket || ticket.status === status) return;
    if (isClosedKey(status) && !isClosedKey(ticket.status)) {
      setResolutionNote("");
      setWorkedHours(ticket.workedMinutes == null ? "" : String(Math.floor(ticket.workedMinutes / 60)));
      setWorkedMinutes(ticket.workedMinutes == null ? "" : String(ticket.workedMinutes % 60));
      setWorkedTimeError(false);
      setResolutionModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPatch(`/tickets/${id}`, { status });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e: any) {
      const activeTicket = e?.data?.activeTicket;
      const message = e?.data?.error === "TIMER_ALREADY_ACTIVE"
        ? `${t.ticketDetail.timerAlreadyActive}${activeTicket ? ` #${activeTicket.ticketNumber ?? activeTicket.id}: ${activeTicket.title}` : ""}`
        : e.message;
      Alert.alert(t.ticketDetail.error, message);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!ticket || ticket.priority === priority) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPatch(`/tickets/${id}`, { priority });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e: any) {
      Alert.alert(t.ticketDetail.error, e.message);
    }
  };

  const confirmResolved = async (note: string) => {
    const hours = workedHours.trim() ? Number(workedHours) : 0;
    const minutes = workedMinutes.trim() ? Number(workedMinutes) : 0;
    if (workedTimeEnabled && canEditWorkedMinutes && (
      (workedHours.trim() || workedMinutes.trim()) &&
      (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59)
    )) {
      setWorkedTimeError(true);
      return;
    }
    const totalWorkedMinutes = workedHours.trim() || workedMinutes.trim() ? hours * 60 + minutes : null;
    setResolving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const closedStatusKey = orgStatuses.find((s) => s.isClosed)?.key ?? "resolved";
    try {
      await apiPatch(`/tickets/${id}`, {
        status: closedStatusKey,
        resolutionNote: note || null,
        ...(workedTimeEnabled && canEditWorkedMinutes ? { workedMinutes: totalWorkedMinutes } : {}),
      });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setResolutionModal(false);
    } catch (e: any) {
      Alert.alert(t.ticketDetail.error, e.message);
    } finally {
      setResolving(false);
    }
  };

  const openRecurrenceModal = () => {
    if (ticket?.recurrenceRule) {
      setRecurrenceFreq(ticket.recurrenceRule.frequency ?? "weekly");
      setRecurrenceInterval(ticket.recurrenceRule.interval ?? 1);
      setRecurrenceDayOfWeek(ticket.recurrenceRule.dayOfWeek ?? new Date(ticket.createdAt).getDay());
      setRecurrenceEndDate(ticket.recurrenceRule.endDate ? ticket.recurrenceRule.endDate.slice(0, 10) : "");
    } else {
      setRecurrenceFreq("weekly");
      setRecurrenceInterval(1);
      setRecurrenceDayOfWeek(new Date(ticket?.createdAt ?? new Date()).getDay());
      setRecurrenceEndDate("");
    }
    setRecurrenceModal(true);
  };

  const handleRecurrenceSave = async () => {
    if (!ticket) return;
    setRecurrenceSaving(true);
    try {
      await apiPatch(`/tickets/${id}/recurrence`, {
        frequency: recurrenceFreq,
        interval: recurrenceInterval,
        ...(recurrenceFreq === "weekly" ? { dayOfWeek: recurrenceDayOfWeek } : {}),
        ...(recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
      });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setRecurrenceModal(false);
    } catch (e: any) {
      Alert.alert(t.ticketDetail.error, e.message || t.ticketDetail.recurrenceSetError);
    } finally {
      setRecurrenceSaving(false);
    }
  };

  const handleRecurrenceRemove = async () => {
    setRecurrenceSaving(true);
    try {
      await apiDelete(`/tickets/${id}/recurrence`);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setRecurrenceModal(false);
    } catch (e: any) {
      Alert.alert(t.ticketDetail.error, e.message || t.ticketDetail.recurrenceRemoveError);
    } finally {
      setRecurrenceSaving(false);
    }
  };

  const handleClone = async () => {
    if (!ticket) return;
    setCloneSaving(true);
    try {
      const cloned = await apiPost<{ id: number }>(`/tickets/${id}/clone`, {
        ...(cloneScheduledAt ? { scheduledAt: new Date(cloneScheduledAt).toISOString() } : {}),
      });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setCloneModal(false);
      Alert.alert(
        t.ticketDetail.duplicateDialogTitle,
        lang === "en" ? `Ticket #${cloned.id} created.` : `Pratica #${cloned.id} creata.`,
        [
          { text: t.ticketDetail.cancel, style: "cancel" },
          { text: lang === "en" ? "Open" : "Apri", onPress: () => router.replace(`/ticket/${cloned.id}` as any) },
        ]
      );
    } catch (e: any) {
      Alert.alert(t.ticketDetail.error, e.message || t.ticketDetail.duplicateError);
    } finally {
      setCloneSaving(false);
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPost(`/tickets/${id}/comments`, { commentText: comment.trim() });
      setComment("");
      refetchComments();
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    } catch (e: any) {
      const msg = e?.error || e?.message || "Errore durante l'invio del commento";
      Alert.alert(t.ticketDetail.error, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryAttachments = async () => {
    if (!id || pendingAttachments.length === 0 || retryingAttachments || replacingAttachmentIndex !== null) return;
    setRetryingAttachments(true);
    try {
      const savedAttachments = await apiGet<TicketAttachment[]>(`/tickets/${id}/attachments`);
      await processPendingTicketAttachments({
        attachments: pendingAttachments,
        registeredAttachments: savedAttachments,
        persistRemaining: (remaining) => savePendingTicketAttachments(id, remaining),
        onRemainingChange: setPendingAttachments,
        upload: async (pending) => {
          const mimeType = pending.mimeType || "application/octet-stream";
          const upload = await apiPost<UploadUrlResponse>("/storage/uploads/request-url", {
            name: pending.name,
            size: pending.size ?? 0,
            contentType: mimeType,
          });
          const localFileResponse = await fetch(pending.uri);
          if (!localFileResponse.ok) throw new Error(t.ticketDetail.pendingAttachmentFileUnavailable);
          const uploadResponse = await fetch(upload.uploadURL, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: await localFileResponse.blob(),
          });
          if (!uploadResponse.ok) throw new Error(t.newTicket.uploadFileError);
          await apiPost(`/tickets/${id}/attachments`, {
            objectPath: upload.objectPath,
            fileName: pending.name,
            fileSize: pending.size ?? 0,
            mimeType,
            commentId: null,
          });
        },
      });
      qc.invalidateQueries({ queryKey: ["ticket-attachments", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert(
        t.ticketDetail.error,
        error?.message || t.ticketDetail.pendingAttachmentsRetryError,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setRetryingAttachments(false);
    }
  };

  const handleReplacePendingAttachment = async (index: number) => {
    if (!id || retryingAttachments || replacingAttachmentIndex !== null) return;
    setReplacingAttachmentIndex(index);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      if (asset.size != null && asset.size > MAX_TICKET_ATTACHMENT_SIZE) {
        Alert.alert(t.newTicket.attachmentTooLarge, asset.name);
        return;
      }

      const mimeType = getTicketAttachmentMimeType(asset.name, asset.mimeType);
      if (!isAllowedTicketAttachmentMimeType(mimeType)) {
        Alert.alert(t.newTicket.attachmentTypeNotAllowed, asset.name);
        return;
      }

      const updated = await replacePendingTicketAttachment(id, index, {
        name: asset.name,
        uri: asset.uri,
        size: asset.size ?? null,
        mimeType,
      });
      setPendingAttachments(updated);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(t.ticketDetail.error, t.newTicket.attachmentPickError);
    } finally {
      setReplacingAttachmentIndex(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "it-IT", {
      day: "2-digit", month: "short", year: "numeric",
    });

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!ticket) {
    return (
      <View style={s.center}>
        <Feather name="alert-circle" size={32} color={colors.destructive} />
        <Text style={s.errorText}>{t.ticketDetail.notFound}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>{t.ticketDetail.goBack}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAdmin = user?.role === "admin";
  const canEditWorkedMinutes =
    isAdmin ||
    ticket.assignedTo === user?.id ||
    user?.groupPermissions?.includes("change_status") === true;
  const firstWaitingStatusKey = orgStatuses.find((status) =>
    /waiting|attesa/i.test(`${status.key} ${status.label}`),
  )?.key;
  const visibleStatuses = timeTrackingModuleEnabled && ticket.timeTrackingEnabled
    ? orgStatuses.filter((status) =>
        status.key === "in_progress" ||
        status.key === firstWaitingStatusKey ||
        isClosedKey(status.key),
      )
    : orgStatuses;
  const priorityColor = PRIORITY_COLORS[ticket.priority] ?? colors.muted;

  const metaRows = [
    { label: t.ticketDetail.status, value: t.status[ticket.status] ?? ticket.status },
    { label: t.ticketDetail.priority, value: t.priority[ticket.priority] ?? ticket.priority },
    { label: t.ticketDetail.category, value: ticket.category },
    ...(ticket.location ? [{ label: t.ticketDetail.location, value: ticket.location }] : []),
    { label: t.ticketDetail.createdBy, value: ticket.creator?.name ?? "–" },
    {
      label: t.ticketDetail.assignedTo,
      value: ticket.assignedToGroup
        ? `${t.ticketDetail.group}: ${ticket.assignedToGroup}`
        : ticket.assignee?.name ?? t.ticketDetail.unassigned,
    },
    { label: t.ticketDetail.date, value: formatDate(ticket.createdAt) },
    ...(ticket.resource ? [{ label: t.ticketDetail.resource, value: ticket.resource }] : []),
    ...(workedTimeEnabled && ticket.workedMinutes != null ? [{ label: t.ticketDetail.workedTime, value: formatWorkedDuration(ticket.workedMinutes, lang) }] : []),
  ];

  return (
    <>
      <KeyboardAwareScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <View style={s.titleRow}>
          <View style={[s.priorityBar, { backgroundColor: priorityColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.ticketId}>Ticket #{ticket.id}</Text>
            <Text style={s.title}>{ticket.title}</Text>
          </View>
        </View>

        <View style={s.metaCard}>
          {metaRows.map((item, i, arr) => (
            <View key={item.label} style={[s.metaRow, i < arr.length - 1 && s.metaRowBorder]}>
              <Text style={s.metaLabel}>{item.label}</Text>
              <Text style={s.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {timeTrackingModuleEnabled && (ticket.timeTrackingEnabled || isAdmin) && (
          <View style={[s.metaCard, { marginTop: 12, padding: 14 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 8 }]}>{t.ticketDetail.trackedTimeTitle}</Text>
            {ticket.timeTrackingSummary && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>{t.ticketDetail.trackedTimeTotal}</Text>
                <Text style={s.metaValue}>{formatWorkedDuration(ticket.timeTrackingSummary.totalMinutes, lang)}</Text>
              </View>
            )}
            {isAdmin && ticket.timeTrackingSummary && (
              <>
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>{t.ticketDetail.trackedTimeBillable}</Text>
                  <Text style={s.metaValue}>{formatWorkedDuration(ticket.timeTrackingSummary.clientBillableMinutes ?? 0, lang)}</Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>{t.ticketDetail.trackedTimeRecognizable}</Text>
                  <Text style={s.metaValue}>{formatWorkedDuration(ticket.timeTrackingSummary.collaboratorRecognizableMinutes ?? 0, lang)}</Text>
                </View>
              </>
            )}
            {ticket.timeSessions?.map((session) => (
              <View key={session.id} style={[s.metaRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={s.metaLabel}>{session.userName}</Text>
                <Text style={s.metaValue}>
                  {formatWorkedDuration(session.durationMinutes, lang)}{session.endedAt ? "" : ` · ${t.ticketDetail.trackedTimeActive}`}
                </Text>
              </View>
            ))}
            {isAdmin && (
              <View style={s.timeEditsSection} testID="time-session-edit-history">
                <Text style={s.sectionTitle}>{t.ticketDetail.trackedTimeEditHistory}</Text>
                {timeSessionEditsQuery.isLoading ? (
                  <View style={s.timeEditsStatus}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={s.timeEditsMuted}>{t.ticketDetail.trackedTimeEditHistoryLoading}</Text>
                  </View>
                ) : timeSessionEditsQuery.isError ? (
                  <View style={s.timeEditsStatus}>
                    <Text style={s.timeEditsError}>{t.ticketDetail.trackedTimeEditHistoryLoadError}</Text>
                    <TouchableOpacity
                      onPress={() => timeSessionEditsQuery.refetch()}
                      accessibilityRole="button"
                      testID="retry-time-session-edit-history"
                    >
                      <Text style={s.timeEditsRetry}>{t.ticketDetail.trackedTimeEditHistoryRetry}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (timeSessionEditsQuery.data?.length ?? 0) === 0 ? (
                  <Text style={s.timeEditsMuted}>{t.ticketDetail.trackedTimeEditHistoryEmpty}</Text>
                ) : (
                  timeSessionEditsQuery.data?.map((edit) => (
                    <View key={edit.id} style={s.timeEditCard} testID={`time-session-edit-${edit.id}`}>
                      <Text style={s.timeEditMeta}>
                        {new Date(edit.editedAt).toLocaleString(lang === "en" ? "en-GB" : "it-IT")} · {edit.editedByName} · {t.ticketDetail.trackedTimeEditAttribution} {edit.collaboratorName}
                      </Text>
                      <Text style={s.timeEditValue}>
                        {t.ticketDetail.trackedTimeEditDuration}: {formatWorkedDuration(edit.previousDurationMinutes, lang)} → {formatWorkedDuration(edit.updatedDurationMinutes, lang)}
                      </Text>
                      <Text style={s.timeEditValue}>
                        {t.ticketDetail.trackedTimeEditBillable}: {edit.previousClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff} → {edit.updatedClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff}
                      </Text>
                      <Text style={s.timeEditValue}>
                        {t.ticketDetail.trackedTimeEditRecognizable}: {edit.previousCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff} → {edit.updatedCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
            {isAdmin && (
              <>
                <TouchableOpacity
                  style={[s.metaRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
                  onPress={async () => {
                    try {
                      await apiPatch(`/tickets/${id}`, { timeTrackingBillable: !ticket.timeTrackingBillable });
                      qc.invalidateQueries({ queryKey: ["ticket", id] });
                    } catch (error: any) {
                      Alert.alert(t.ticketDetail.error, error.message || t.ticketDetail.error);
                    }
                  }}
                  accessibilityRole="button"
                  testID="toggle-ticket-client-billable"
                >
                  <Text style={s.metaLabel}>{t.ticketDetail.trackedTimeBillable}</Text>
                  <Text style={[s.metaValue, { color: colors.primary }]}>{ticket.timeTrackingBillable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.metaRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
                  onPress={async () => {
                    const current = ticket.timeTrackingCompensationOverride;
                    const next = current == null ? true : current ? false : null;
                    try {
                      await apiPatch(`/tickets/${id}`, { timeTrackingCompensationOverride: next });
                      qc.invalidateQueries({ queryKey: ["ticket", id] });
                    } catch (error: any) {
                      Alert.alert(t.ticketDetail.error, error.message || t.ticketDetail.error);
                    }
                  }}
                  accessibilityRole="button"
                  testID="cycle-ticket-compensation-override"
                >
                  <Text style={s.metaLabel}>{t.ticketDetail.trackedTimeOverride}</Text>
                  <Text style={[s.metaValue, { color: colors.primary }]}>
                    {ticket.timeTrackingCompensationOverride == null
                      ? t.ticketDetail.trackedTimeInherit
                      : ticket.timeTrackingCompensationOverride ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.ticketDetail.description}</Text>
          <View style={s.descBox}>
            <Text style={s.desc}>{ticket.description}</Text>
          </View>
        </View>

        {pendingAttachments.length > 0 && (
          <View style={s.pendingAttachmentsCard}>
            <View style={s.pendingAttachmentsHeader}>
              <Feather name="alert-circle" size={17} color={colors.destructive} />
              <Text style={s.pendingAttachmentsTitle}>{t.ticketDetail.pendingAttachmentsTitle}</Text>
            </View>
            <Text style={s.pendingAttachmentsHint}>{t.ticketDetail.pendingAttachmentsHint}</Text>
            {pendingAttachments.map((attachment, index) => (
              <View key={`${attachment.name}-${attachment.size ?? index}`} style={s.pendingAttachmentRow}>
                <Feather name="file" size={15} color={colors.mutedForeground} />
                <Text style={s.pendingAttachmentName} numberOfLines={1}>{attachment.name}</Text>
                <TouchableOpacity
                  style={s.pendingAttachmentReplaceButton}
                  onPress={() => handleReplacePendingAttachment(index)}
                  disabled={retryingAttachments || replacingAttachmentIndex !== null}
                  accessibilityRole="button"
                  testID={`replace-pending-attachment-${index}`}
                >
                  {replacingAttachmentIndex === index ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Feather name="refresh-cw" size={13} color={colors.primary} />
                  )}
                  <Text style={s.pendingAttachmentReplaceText}>{t.ticketDetail.replacePendingAttachment}</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[s.retryAttachmentsButton, retryingAttachments && s.sendBtnDisabled]}
              onPress={handleRetryAttachments}
              disabled={retryingAttachments}
              testID="retry-ticket-attachments"
            >
              {retryingAttachments ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
              )}
              <Text style={s.retryAttachmentsButtonText}>
                {retryingAttachments
                  ? t.ticketDetail.retryingAttachments
                  : t.ticketDetail.retryAttachments}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {ticket.resolutionNote ? (
          <View style={s.resolutionCard}>
            <View style={s.resolutionHeader}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={s.resolutionTitle}>{t.ticketDetail.resolvedHow}</Text>
            </View>
            <Text style={s.resolutionText}>{ticket.resolutionNote}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.ticketDetail.updateStatus}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.statusRow}>
              {visibleStatuses.map((st) => (
                <TouchableOpacity
                  key={st.key}
                  style={[s.statusBtn, ticket.status === st.key && s.statusBtnActive]}
                  onPress={() => handleStatusChange(st.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ticket.status === st.key }}
                >
                  <Text style={[s.statusBtnText, ticket.status === st.key && s.statusBtnTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={[s.sectionTitle, { marginTop: 16 }]}>{t.ticketDetail.priority}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.statusRow}>
              {(["low", "medium", "high", "urgent"] as const).map((priority) => {
                const isActive = ticket.priority === priority;
                return (
                  <TouchableOpacity
                    key={priority}
                    style={[s.statusBtn, isActive && s.statusBtnActive]}
                    onPress={() => handlePriorityChange(priority)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[s.statusBtnText, isActive && s.statusBtnTextActive]}>
                      {t.priority[priority] ?? priority}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Admin: recurrence + clone actions */}
        {isAdmin && (
          <View style={[s.section, { flexDirection: "row", gap: 10 }]}>
            <TouchableOpacity
              style={[s.actionBtn, ticket.recurrenceRule && s.actionBtnActive]}
              onPress={openRecurrenceModal}
            >
              <Feather name="repeat" size={14} color={ticket.recurrenceRule ? "#fff" : colors.primary} />
              <Text style={[s.actionBtnText, ticket.recurrenceRule && s.actionBtnTextActive]}>
                {t.ticketDetail.recurrenceRow}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => { setCloneScheduledAt(""); setCloneModal(true); }}
            >
              <Feather name="copy" size={14} color={colors.primary} />
              <Text style={s.actionBtnText}>{t.ticketDetail.duplicateAction}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Checklists ── */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={s.sectionTitle}>{t.checklist.sectionTitle}</Text>
            {isAdmin && !addingChecklist && (
              <TouchableOpacity onPress={() => setAddingChecklist(true)}>
                <Feather name="plus-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {addingChecklist && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TextInput
                style={[s.commentInput, { flex: 1, minHeight: 40 }]}
                value={newChecklistTitle}
                onChangeText={setNewChecklistTitle}
                placeholder={t.checklist.checklistTitlePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
              <TouchableOpacity
                style={[s.sendBtn, (!newChecklistTitle.trim() || savingChecklist) && s.sendBtnDisabled]}
                onPress={handleCreateChecklist}
                disabled={!newChecklistTitle.trim() || savingChecklist}
              >
                {savingChecklist ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Feather name="check" size={18} color={colors.primaryForeground} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: colors.muted }]}
                onPress={() => { setAddingChecklist(false); setNewChecklistTitle(""); }}
              >
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {(checklists as ChecklistType[]).length === 0 && !addingChecklist && (
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
              {t.checklist.noChecklists}
            </Text>
          )}

          {(checklists as ChecklistType[]).map((cl) => {
            const items = cl.items ?? [];
            const total = items.length;
            const done = items.filter((i) => i.checked).length;
            const expanded = checklistsExpanded[cl.id] !== false;
            const progressPct = total === 0 ? 0 : done / total;

            return (
              <View key={cl.id} style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: "hidden" }}>
                {/* Checklist header */}
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}
                  onPress={() => setChecklistsExpanded((prev) => ({ ...prev, [cl.id]: !expanded }))}
                >
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                    {cl.title}
                  </Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => handleDeleteChecklist(cl.id)} hitSlop={8}>
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  )}
                </Pressable>

                {/* Progress bar */}
                {total > 0 && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ width: `${progressPct * 100}%`, height: "100%", backgroundColor: done === total ? colors.success : colors.primary, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                      {t.checklist.progress(done, total)}
                    </Text>
                  </View>
                )}

                {/* Items */}
                {expanded && (
                  <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
                    {[...items].sort((a, b) => a.position - b.position).map((item, itemIdx, sortedItems) => {
                      const isEditingThis = editingItem?.itemId === item.id && editingItem?.clId === cl.id;
                      return (
                        <View key={item.id} style={{ paddingVertical: 4 }}>
                          {isEditingThis ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <TextInput
                                style={[s.commentInput, { flex: 1, minHeight: 36, maxHeight: 80 }]}
                                value={editingItem!.text}
                                onChangeText={(v) => setEditingItem((prev) => prev ? { ...prev, text: v } : null)}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleSaveEditItem}
                              />
                              <TouchableOpacity
                                style={[s.sendBtn, { width: 36, height: 36 }, (!editingItem?.text.trim() || savingEditItem) && s.sendBtnDisabled]}
                                onPress={handleSaveEditItem}
                                disabled={!editingItem?.text.trim() || savingEditItem}
                              >
                                {savingEditItem ? (
                                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                                ) : (
                                  <Feather name="check" size={14} color={colors.primaryForeground} />
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.sendBtn, { width: 36, height: 36, backgroundColor: colors.muted }]}
                                onPress={() => setEditingItem(null)}
                              >
                                <Feather name="x" size={14} color={colors.mutedForeground} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                              <TouchableOpacity
                                onPress={() => handleToggleItem(cl.id, item.id, item.checked)}
                                disabled={togglingItem === item.id}
                                hitSlop={8}
                                style={{ marginRight: 8 }}
                              >
                                {togglingItem === item.id ? (
                                  <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                  <Feather
                                    name={item.checked ? "check-square" : "square"}
                                    size={18}
                                    color={item.checked ? colors.success : colors.mutedForeground}
                                  />
                                )}
                              </TouchableOpacity>
                              <Text style={{
                                flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
                                color: item.checked ? colors.mutedForeground : colors.foreground,
                                textDecorationLine: item.checked ? "line-through" : "none",
                              }}>
                                {item.text}
                              </Text>
                              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                                {isAdmin && (
                                  <>
                                    <TouchableOpacity
                                      onPress={() => handleReorderItem(cl.id, item.id, 'up', items)}
                                      hitSlop={8}
                                      disabled={itemIdx === 0 || reorderingItem === item.id}
                                    >
                                      <Feather name="chevron-up" size={14} color={itemIdx === 0 ? colors.muted : colors.mutedForeground} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleReorderItem(cl.id, item.id, 'down', items)}
                                      hitSlop={8}
                                      disabled={itemIdx === sortedItems.length - 1 || reorderingItem === item.id}
                                    >
                                      <Feather name="chevron-down" size={14} color={itemIdx === sortedItems.length - 1 ? colors.muted : colors.mutedForeground} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => setEditingItem({ clId: cl.id, itemId: item.id, text: item.text })}
                                      hitSlop={8}
                                    >
                                      <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                                    </TouchableOpacity>
                                  </>
                                )}
                                <TouchableOpacity onPress={() => handleDeleteItem(cl.id, item.id)} hitSlop={8}>
                                  <Feather name="x" size={14} color={colors.destructive} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Add item */}
                    {addingItemFor === cl.id ? (
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                        <TextInput
                          style={[s.commentInput, { flex: 1, minHeight: 38, maxHeight: 80 }]}
                          value={newItemTexts[cl.id] ?? ""}
                          onChangeText={(v) => setNewItemTexts((prev) => ({ ...prev, [cl.id]: v }))}
                          placeholder={t.checklist.addItemPlaceholder}
                          placeholderTextColor={colors.mutedForeground}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={[s.sendBtn, { width: 38, height: 38 }, (!newItemTexts[cl.id]?.trim() || savingItem) && s.sendBtnDisabled]}
                          onPress={() => handleAddItem(cl.id)}
                          disabled={!newItemTexts[cl.id]?.trim() || savingItem}
                        >
                          {savingItem ? (
                            <ActivityIndicator color={colors.primaryForeground} size="small" />
                          ) : (
                            <Feather name="check" size={16} color={colors.primaryForeground} />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.sendBtn, { width: 38, height: 38, backgroundColor: colors.muted }]}
                          onPress={() => setAddingItemFor(null)}
                        >
                          <Feather name="x" size={16} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingVertical: 4 }}
                        onPress={() => setAddingItemFor(cl.id)}
                      >
                        <Feather name="plus" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.primary, fontFamily: "Inter_500Medium" }}>
                          {t.checklist.addItem}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.ticketDetail.comments} ({comments.length})</Text>
          {comments.map((c) => (
            <View key={c.id} style={s.commentCard}>
              <View style={s.commentHeader}>
                <View style={s.commentAvatar}>
                  <Text style={s.commentInitial}>{c.author?.name?.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.commentAuthor}>{c.author?.name}</Text>
                  <Text style={s.commentDate}>{formatDate(c.createdAt)}</Text>
                </View>
              </View>
              <Text style={s.commentText}>{c.commentText}</Text>
            </View>
          ))}

          <View style={s.commentInputWrap}>
            <TextInput
              style={s.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t.ticketDetail.addComment}
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.sendBtn, (!comment.trim() || submitting) && s.sendBtnDisabled]}
              onPress={handleComment}
              disabled={!comment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Feather name="send" size={18} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* ── Recurrence Modal ── */}
      <Modal
        visible={recurrenceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecurrenceModal(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setRecurrenceModal(false)} style={s.modalCancel}>
              <Text style={s.modalCancelText}>{t.ticketDetail.recurrenceCancel}</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{t.ticketDetail.recurrenceDialogTitle}</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={s.modalContent}>
            <Text style={[s.metaLabel, { marginBottom: 6 }]}>{t.ticketDetail.recurrenceFrequency}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {(["daily", "weekly", "monthly", "yearly"] as RecurrenceFreq[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setRecurrenceFreq(f)}
                  style={[s.statusBtn, recurrenceFreq === f && s.statusBtnActive]}
                >
                  <Text style={[s.statusBtnText, recurrenceFreq === f && s.statusBtnTextActive]}>
                    {t.ticketDetail[`recurrenceFreq${f.charAt(0).toUpperCase() + f.slice(1)}` as keyof typeof t.ticketDetail] as string}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.metaLabel, { marginBottom: 6 }]}>{lang === "en" ? "Every" : "Ogni"}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRecurrenceInterval(n)}
                  style={[s.statusBtn, recurrenceInterval === n && s.statusBtnActive]}
                >
                  <Text style={[s.statusBtnText, recurrenceInterval === n && s.statusBtnTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recurrenceFreq === "weekly" && (
              <>
                <Text style={[s.metaLabel, { marginBottom: 6 }]}>{t.ticketDetail.recurrenceDayOfWeek}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {[
                    { value: 1, label: t.ticketDetail.recurrenceDayMonday },
                    { value: 2, label: t.ticketDetail.recurrenceDayTuesday },
                    { value: 3, label: t.ticketDetail.recurrenceDayWednesday },
                    { value: 4, label: t.ticketDetail.recurrenceDayThursday },
                    { value: 5, label: t.ticketDetail.recurrenceDayFriday },
                    { value: 6, label: t.ticketDetail.recurrenceDaySaturday },
                    { value: 0, label: t.ticketDetail.recurrenceDaySunday },
                  ].map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      onPress={() => setRecurrenceDayOfWeek(day.value)}
                      style={[s.statusBtn, recurrenceDayOfWeek === day.value && s.statusBtnActive]}
                    >
                      <Text style={[s.statusBtnText, recurrenceDayOfWeek === day.value && s.statusBtnTextActive]}>{day.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={[s.metaLabel, { marginBottom: 6 }]}>{t.ticketDetail.recurrenceEndDate}</Text>
            <TextInput
              style={[s.commentInput, { marginBottom: 8, minHeight: 40 }]}
              value={recurrenceEndDate}
              onChangeText={setRecurrenceEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={s.modalFooter}>
            {ticket?.recurrenceRule && (
              <TouchableOpacity
                style={[s.skipBtn, { backgroundColor: colors.destructive + "22" }]}
                onPress={handleRecurrenceRemove}
                disabled={recurrenceSaving}
              >
                <Text style={[s.skipBtnText, { color: colors.destructive }]}>{t.ticketDetail.recurrenceRemove}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.confirmBtn, recurrenceSaving && { opacity: 0.6 }]}
              onPress={handleRecurrenceSave}
              disabled={recurrenceSaving}
            >
              {recurrenceSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.confirmBtnText}>{t.ticketDetail.recurrenceSave}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Clone Modal ── */}
      <Modal
        visible={cloneModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCloneModal(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setCloneModal(false)} style={s.modalCancel}>
              <Text style={s.modalCancelText}>{t.ticketDetail.duplicateCancel}</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{t.ticketDetail.duplicateDialogTitle}</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={s.modalContent}>
            <Feather name="copy" size={40} color={colors.primary} style={{ alignSelf: "center", marginBottom: 12 }} />
            <Text style={[s.metaLabel, { marginBottom: 6 }]}>{t.ticketDetail.duplicateScheduledDate}</Text>
            <TextInput
              style={[s.commentInput, { minHeight: 40 }]}
              value={cloneScheduledAt}
              onChangeText={setCloneScheduledAt}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 }}>
              {lang === "en" ? "Leave empty to clone immediately" : "Lascia vuoto per duplicare subito"}
            </Text>
          </View>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.skipBtn} onPress={() => setCloneModal(false)}>
              <Text style={s.skipBtnText}>{t.ticketDetail.duplicateCancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, cloneSaving && { opacity: 0.6 }]}
              onPress={handleClone}
              disabled={cloneSaving}
            >
              {cloneSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.confirmBtnText}>{t.ticketDetail.duplicateConfirm}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={resolutionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResolutionModal(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setResolutionModal(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>{t.ticketDetail.cancel}</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{t.ticketDetail.resolutionModalTitle}</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={s.modalContent}>
              <View style={s.modalIconRow}>
                <Feather name="check-circle" size={40} color={colors.success} />
              </View>
              <Text style={s.modalSubtitle}>{t.ticketDetail.resolutionSubtitle}</Text>
              <TextInput
                style={s.modalInput}
                value={resolutionNote}
                onChangeText={setResolutionNote}
                placeholder={t.ticketDetail.resolutionPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                autoFocus
              />
              {workedTimeEnabled && canEditWorkedMinutes && <><Text style={s.workedTimeHint}>{t.ticketDetail.workedTimeOptional}</Text>
              <View style={s.durationRow}>
                <TextInput
                  style={[s.durationInput, workedTimeError && s.durationInputError]}
                  value={workedHours}
                  onChangeText={(value) => { setWorkedHours(value); setWorkedTimeError(false); }}
                  placeholder={t.ticketDetail.workedHours}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[s.durationInput, workedTimeError && s.durationInputError]}
                  value={workedMinutes}
                  onChangeText={(value) => { setWorkedMinutes(value); setWorkedTimeError(false); }}
                  placeholder={t.ticketDetail.workedMinutes}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>
              {workedTimeError && <Text style={s.durationError}>{t.ticketDetail.workedTimeError}</Text>}</>}
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.skipBtn}
                onPress={() => confirmResolved("")}
                disabled={resolving}
              >
                <Text style={s.skipBtnText}>{t.ticketDetail.skip}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, resolving && { opacity: 0.6 }]}
                onPress={() => confirmResolved(resolutionNote)}
                disabled={resolving}
              >
                {resolving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={s.confirmBtnText}>{t.ticketDetail.markResolved}</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 14, gap: 12 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    errorText: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    backBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
    titleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    priorityBar: { width: 4, borderRadius: 2, alignSelf: "stretch", minHeight: 32 },
    ticketId: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    title: { fontSize: 17, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold", lineHeight: 22 },
    metaCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    metaRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 9 },
    metaRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    metaLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    metaValue: { fontSize: 12, color: colors.foreground, fontWeight: "500" as const, fontFamily: "Inter_500Medium", maxWidth: "55%", textAlign: "right" },
    timeEditsSection: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, padding: 14 },
    timeEditsStatus: { gap: 8, alignItems: "flex-start" },
    timeEditsMuted: { fontSize: 12, lineHeight: 17, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    timeEditsError: { fontSize: 12, lineHeight: 17, color: colors.destructive, fontFamily: "Inter_400Regular" },
    timeEditsRetry: { fontSize: 13, color: colors.primary, fontFamily: "Inter_600SemiBold", paddingVertical: 3 },
    timeEditCard: { gap: 5, padding: 10, borderRadius: 8, backgroundColor: colors.muted },
    timeEditMeta: { fontSize: 11, lineHeight: 16, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    timeEditValue: { fontSize: 12, lineHeight: 17, color: colors.foreground, fontFamily: "Inter_400Regular" },
    section: {},
    sectionTitle: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
    descBox: { backgroundColor: colors.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border },
    desc: { fontSize: 13, color: colors.foreground, lineHeight: 19, fontFamily: "Inter_400Regular" },
    pendingAttachmentsCard: {
      gap: 8, padding: 12, borderRadius: 12, borderWidth: 1,
      borderColor: colors.destructive + "55", backgroundColor: colors.card,
    },
    pendingAttachmentsHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
    pendingAttachmentsTitle: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    pendingAttachmentsHint: { fontSize: 12, lineHeight: 17, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    pendingAttachmentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    pendingAttachmentName: { flex: 1, fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular" },
    pendingAttachmentReplaceButton: {
      flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6,
      paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    },
    pendingAttachmentReplaceText: { fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" },
    retryAttachmentsButton: {
      minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary,
    },
    retryAttachmentsButtonText: { fontSize: 14, color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
    resolutionCard: {
      backgroundColor: colors.success + "18",
      borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.success + "40",
    },
    resolutionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    resolutionTitle: { fontSize: 14, fontWeight: "600" as const, color: colors.success, fontFamily: "Inter_600SemiBold" },
    resolutionText: { fontSize: 14, color: colors.foreground, lineHeight: 20, fontFamily: "Inter_400Regular" },
    statusRow: { flexDirection: "row", gap: 8 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    statusBtnText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    statusBtnTextActive: { color: colors.primaryForeground },
    commentCard: { backgroundColor: colors.card, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
    commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
    commentAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    commentInitial: { color: colors.primaryForeground, fontWeight: "700" as const, fontSize: 12, fontFamily: "Inter_700Bold" },
    commentAuthor: { fontSize: 12, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    commentDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    commentText: { fontSize: 13, color: colors.foreground, lineHeight: 18, fontFamily: "Inter_400Regular" },
    commentInputWrap: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
    commentInput: {
      flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14, color: colors.foreground, minHeight: 48, maxHeight: 120, fontFamily: "Inter_400Regular",
    },
    sendBtn: { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    sendBtnDisabled: { opacity: 0.5 },
    modalRoot: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    modalCancel: { paddingVertical: 4 },
    modalCancelText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    modalContent: { flex: 1, padding: 24, gap: 16 },
    modalIconRow: { alignItems: "center", paddingVertical: 8 },
    modalSubtitle: { fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", lineHeight: 20, textAlign: "center" },
    workedTimeHint: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    durationRow: { flexDirection: "row", gap: 12 },
    durationInput: {
      flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    durationInputError: { borderColor: colors.destructive },
    durationError: { fontSize: 12, color: colors.destructive, fontFamily: "Inter_400Regular" },
    modalInput: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, minHeight: 120, fontFamily: "Inter_400Regular",
    },
    modalFooter: {
      flexDirection: "row", gap: 12, padding: 20,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    skipBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 12,
      backgroundColor: colors.muted, alignItems: "center",
    },
    skipBtnText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
    confirmBtn: {
      flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.success,
    },
    confirmBtnText: { fontSize: 15, color: "#fff", fontFamily: "Inter_600SemiBold" },
    actionBtn: {
      flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
      gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    },
    actionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionBtnText: { fontSize: 13, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    actionBtnTextActive: { color: colors.primaryForeground },
  });
