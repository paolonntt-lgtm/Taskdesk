import React, { useState, useEffect, createElement } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Platform, Alert, Modal,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiPost, apiGet, apiFetch, PRIORITIES } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type UserOption = { id: number; name: string; isActive?: boolean };
type ClientOption = { id: number; name: string; alias?: string | null };
type ChecklistTemplate = { id: number; title: string; category: string | null; items: { id: number; text: string; position: number }[] };
type UploadUrlResponse = { uploadURL: string; objectPath: string };

const PRIORITY_ICONS: Record<string, string> = {
  low: "arrow-down", medium: "minus", high: "arrow-up", urgent: "alert-triangle",
};

const FILE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", gz: "application/gzip",
  tar: "application/x-tar", "7z": "application/x-7z-compressed", rar: "application/x-rar-compressed",
};
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation", "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed", "application/gzip", "application/x-tar",
  "application/x-7z-compressed", "application/x-rar-compressed", "application/octet-stream",
]);
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

function localDateTimeInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateInput(date: Date | null): string {
  return date ? localDateTimeInput(date).slice(0, 10) : "";
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(date.getTime()) ? null : date;
}

function attachmentMimeType(asset: DocumentPicker.DocumentPickerAsset): string {
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  return asset.mimeType || FILE_MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

export default function NewTicketScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const s = styles(colors);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [location, setLocation] = useState(user?.mainLocation ?? "");
  const [priority, setPriority] = useState("medium");
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [assignedGroup, setAssignedGroup] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"user" | "group">("user");
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<"due-date" | "due-time" | "recurrence-date" | null>(null);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(new Date().getDay());
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(new Date().getDate());
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [privateTicket, setPrivateTicket] = useState(false);
  const [attachments, setAttachments] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistMode, setChecklistMode] = useState<"manual" | "template" | null>(null);
  const [checklistTemplateId, setChecklistTemplateId] = useState<number | null>(null);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientEmail, setQuickClientEmail] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  const [quickClientSaving, setQuickClientSaving] = useState(false);

  const isAdmin = user?.role === "admin";
  const clientsEnabled = user?.clientsEnabled === true;

  useEffect(() => {
    const requests: Promise<unknown>[] = [
      apiGet<{ value: string[] }>("/settings/categories"),
      apiGet<{ value: string | null }>("/settings/default-category"),
      apiGet<{ value: string[] }>("/settings/locations"),
    ];
    if (isAdmin) requests.push(
      apiGet<UserOption[]>("/users"),
      apiGet<{ value: string[] }>("/settings/groups"),
    );
    if (clientsEnabled) requests.push(apiGet<ClientOption[]>("/clients"));
    requests.push(apiGet<ChecklistTemplate[]>("/checklist-templates").catch(() => []));

    Promise.all(requests)
      .then((results) => {
        const [catsData, defData, locationsData] = results as [
          { value: string[] }, { value: string | null }, { value: string[] },
        ];
        const cats = catsData.value ?? [];
        const sorted = [...cats].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        setCategories(sorted);
        const defaultCat = defData.value;
        const preselect = (defaultCat && sorted.includes(defaultCat)) ? defaultCat : sorted[0] ?? "";
        setCategory(preselect);
        const availableLocations = locationsData.value ?? [];
        setLocations(availableLocations);
        setLocation((current) => availableLocations.includes(current)
          ? current
          : user?.mainLocation && availableLocations.includes(user.mainLocation)
            ? user.mainLocation
            : availableLocations.length === 1 ? availableLocations[0] : "");
        let index = 3;
        if (isAdmin) {
          setUsers((results[index++] as UserOption[]).filter((u) => u.isActive !== false));
          setGroups((results[index++] as { value: string[] }).value ?? []);
        }
        if (clientsEnabled) setClientList(results[index++] as ClientOption[]);
        setChecklistTemplates(results[index] as ChecklistTemplate[]);
      })
      .catch(() => {
        Alert.alert(t.newTicket.errorCreate, t.newTicket.loadOptionsError);
      });
  }, [isAdmin, clientsEnabled, user?.mainLocation]);

  useEffect(() => {
    setSuggestedTitle(null);
    setSuggestingTitle(false);
    const plainDescription = description.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
    if (title.trim() || plainDescription.length < 25) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      setSuggestingTitle(true);
      apiPost<{ title?: string }>("/ai/suggest-title", {
        description: plainDescription,
        category,
      })
        .then((result) => {
          if (!cancelled) setSuggestedTitle(result.title || null);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSuggestingTitle(false);
        });
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [description, title, category]);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t.newTicket.errorTitle, t.newTicket.errorTitleMsg);
      return;
    }
    if (!description.trim()) {
      Alert.alert(t.newTicket.errorDesc, t.newTicket.errorDescMsg);
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let createdTicketId: number | null = null;
    try {
      const selectedClient = clientList.find((client) => String(client.id) === selectedClientId);
      const finalTitle = selectedClient
        ? `${selectedClient.alias || selectedClient.name}: ${title.trim()}`
        : title.trim();
      const ticket = await apiPost<{ id: number }>("/tickets", {
        title: finalTitle,
        description: description.trim(),
        category,
        location: location || undefined,
        priority,
        resource: resource.trim() || undefined,
        assignedTo: isAdmin
          ? assignmentMode === "user" && assignedUserId ? Number(assignedUserId) : null
          : assignedUserId === String(user?.id) ? user?.id : null,
        assignedToGroup: isAdmin && assignmentMode === "group" && assignedGroup ? assignedGroup : null,
        dueAt: dueAt?.toISOString() ?? null,
        clientId: selectedClientId ? Number(selectedClientId) : null,
        visibility: isAdmin && privateTicket ? "admins" : "organization",
        ...(isAdmin && recurrenceEnabled ? {
          recurrenceRule: {
            frequency: recurrenceFrequency,
            interval: Math.max(1, Math.min(365, Number.parseInt(recurrenceInterval, 10) || 1)),
            ...(recurrenceFrequency === "weekly" ? { dayOfWeek: recurrenceDayOfWeek } : {}),
            ...(recurrenceFrequency === "monthly" ? { dayOfMonth: recurrenceDayOfMonth } : {}),
            ...(recurrenceEndDate ? { endDate: localDateInput(recurrenceEndDate) } : {}),
          },
        } : {}),
      });
      createdTicketId = ticket.id;
      setUploading(attachments.length > 0);
      for (const attachment of attachments) {
        const mimeType = attachmentMimeType(attachment);
        const upload = await apiPost<UploadUrlResponse>("/storage/uploads/request-url", {
          name: attachment.name,
          size: attachment.size ?? 0,
          contentType: mimeType,
        });
        const payload = Platform.OS === "web" && attachment.file
          ? attachment.file
          : await (await fetch(attachment.uri)).blob();
        const uploadResponse = await fetch(upload.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: payload,
        });
        if (!uploadResponse.ok) throw new Error(t.newTicket.uploadFileError);
        await apiPost(`/tickets/${ticket.id}/attachments`, {
          objectPath: upload.objectPath,
          fileName: attachment.name,
          fileSize: attachment.size ?? 0,
          mimeType,
          commentId: null,
        });
      }
      if (checklistMode === "template" && checklistTemplateId != null) {
        const response = await apiFetch(`/tickets/${ticket.id}/checklists/from-template/${checklistTemplateId}`, { method: "POST" });
        if (!response.ok) throw new Error(t.newTicket.checklistError);
      } else if (checklistMode === "manual" && (checklistTitle.trim() || checklistItems.some((item) => item.trim()))) {
        const checklist = await apiPost<{ id: number }>(`/tickets/${ticket.id}/checklists`, {
          title: checklistTitle.trim() || t.newTicket.checklistDefaultTitle,
        });
        for (const item of checklistItems.map((value) => value.trim()).filter(Boolean)) {
          await apiPost(`/tickets/${ticket.id}/checklists/${checklist.id}/items`, { text: item });
        }
      }
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-tickets"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["clients"] });
      setLoading(false);
      setUploading(false);
      router.push(`/ticket/${ticket.id}`);
    } catch (e: any) {
      if (createdTicketId != null) {
        qc.invalidateQueries({ queryKey: ["tickets"] });
        setLoading(false);
        setUploading(false);
        Alert.alert(t.newTicket.createdButIncomplete, e.message || t.newTicket.uploadFileError);
        router.push(`/ticket/${createdTicketId}`);
      } else {
        Alert.alert(t.newTicket.errorCreate, e.message || t.newTicket.errorCreateMsg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const chooseAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const valid = result.assets.filter((asset) => {
        if (asset.size != null && asset.size > MAX_ATTACHMENT_SIZE) {
          Alert.alert(t.newTicket.attachmentTooLarge, asset.name);
          return false;
        }
        if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachmentMimeType(asset))) {
          Alert.alert(t.newTicket.attachmentTypeNotAllowed, asset.name);
          return false;
        }
        return true;
      });
      setAttachments((current) => {
        const seen = new Set(current.map((asset) => `${asset.name}:${asset.size ?? 0}`));
        return [...current, ...valid.filter((asset) => !seen.has(`${asset.name}:${asset.size ?? 0}`))];
      });
    } catch {
      Alert.alert(t.newTicket.errorCreate, t.newTicket.attachmentPickError);
    }
  };

  const handleQuickAddClient = async () => {
    if (!quickClientName.trim()) return;
    setQuickClientSaving(true);
    try {
      const client = await apiPost<ClientOption>("/clients", {
        name: quickClientName.trim(),
        email: quickClientEmail.trim() || null,
        phone: quickClientPhone.trim() || null,
      });
      setClientList((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClientId(String(client.id));
      setQuickAddClientOpen(false);
    } catch (error: any) {
      Alert.alert(t.newTicket.errorCreate, error.message || t.newTicket.quickAddClientError);
    } finally {
      setQuickClientSaving(false);
    }
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      setActivePicker(null);
      return;
    }
    if (!selected || !activePicker) return;
    if (activePicker === "recurrence-date") {
      setRecurrenceEndDate(selected);
    } else if (activePicker === "due-date") {
      setDueAt((current) => {
        const next = new Date(current ?? new Date());
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        return next;
      });
    } else {
      setDueAt((current) => {
        const next = new Date(current ?? new Date());
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        return next;
      });
    }
    if (Platform.OS !== "ios") setActivePicker(null);
  };

  const formatDate = (date: Date | null) => date
    ? date.toLocaleDateString(lang === "it" ? "it-IT" : "en-US", { dateStyle: "medium" })
    : t.newTicket.chooseDate;
  const formatTime = (date: Date | null) => date
    ? date.toLocaleTimeString(lang === "it" ? "it-IT" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : t.newTicket.chooseTime;
  const visibleClients = clientList.filter((client) => client.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const canCreateRecurring = isAdmin && recurrenceEnabled;
  const isCreating = loading || uploading;
  const currentPickerDate = activePicker === "recurrence-date"
    ? recurrenceEndDate ?? new Date()
    : dueAt ?? new Date();
  const dateTimePicker = activePicker && Platform.OS !== "web"
    ? (
      <View style={s.pickerContainer}>
        <DateTimePicker
          value={currentPickerDate}
          mode={activePicker === "due-time" ? "time" : "date"}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={activePicker === "recurrence-date" || activePicker === "due-date" ? new Date() : undefined}
          onChange={handlePickerChange}
        />
        {Platform.OS === "ios" && (
          <TouchableOpacity style={s.pickerDone} onPress={() => setActivePicker(null)}>
            <Feather name="check" size={16} color={colors.primary} />
            <Text style={s.pickerDoneText}>{t.newTicket.done}</Text>
          </TouchableOpacity>
        )}
      </View>
    )
    : null;

  const handleWebDateChange = (kind: "dueAt" | "recurrenceEndDate", value: string) => {
    if (kind === "dueAt") setDueAt(parseLocalDateTime(value));
    else {
      const parsed = value ? new Date(`${value}T00:00:00`) : null;
      setRecurrenceEndDate(parsed && !Number.isNaN(parsed.getTime()) ? parsed : null);
    }
  };

  const renderWebDateInput = (type: "datetime-local" | "date", value: string, onChange: (value: string) => void, min?: string) =>
    createElement("input", {
      type,
      value,
      min,
      "aria-label": type === "date" ? t.newTicket.recurrenceEndDate : t.newTicket.dueAt,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      style: {
        boxSizing: "border-box",
        width: "100%",
        minHeight: 46,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: colors.card,
        color: colors.foreground,
        fontFamily: "Inter, sans-serif",
        fontSize: 15,
      },
    });

  return (
    <KeyboardAwareScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 0 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={16}
    >
      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.titleField}</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t.newTicket.titlePlaceholder}
          placeholderTextColor={colors.mutedForeground}
          maxLength={120}
        />
        {!title.trim() && (suggestingTitle || suggestedTitle) && (
          <View style={s.suggestionRow}>
            <Feather name="zap" size={14} color={colors.primary} />
            {suggestingTitle ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.suggestionText}>{t.newTicket.titleSuggestLoading}</Text>
              </>
            ) : suggestedTitle ? (
              <>
                <Text style={s.suggestionText}>{t.newTicket.titleSuggestLabel}</Text>
                <TouchableOpacity
                  style={s.suggestionChip}
                  onPress={() => {
                    setTitle(suggestedTitle);
                    setSuggestedTitle(null);
                  }}
                >
                  <Text style={s.suggestionChipText} numberOfLines={2}>{suggestedTitle}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.descriptionField}</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t.newTicket.descriptionPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.category}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
          <View style={s.chips}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c}
                style={[s.chip, category === c && s.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.priority}</Text>
        <View style={s.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[s.priorityBtn, priority === p && s.priorityBtnActive]}
              onPress={() => setPriority(p)}
            >
              <Feather name={PRIORITY_ICONS[p] as any} size={14} color={priority === p ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[s.priorityText, priority === p && s.priorityTextActive]}>
                {t.priority[p] ?? p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.location}</Text>
        <View style={s.chips}>
          <TouchableOpacity
            style={[s.chip, !location && s.chipActive]}
            onPress={() => setLocation("")}
          >
            <Text style={[s.chipText, !location && s.chipTextActive]}>{t.newTicket.noLocation}</Text>
          </TouchableOpacity>
          {locations.map((l) => (
            <TouchableOpacity
              key={l}
              style={[s.chip, location === l && s.chipActive]}
              onPress={() => setLocation(l)}
            >
              <Text style={[s.chipText, location === l && s.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.resource}</Text>
        <TextInput
          style={s.input}
          value={resource}
          onChangeText={setResource}
          placeholder={t.newTicket.resourcePlaceholder}
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      {isAdmin ? (
        <View style={s.field}>
          <Text style={s.label}>{t.newTicket.assignment}</Text>
          <View style={s.chips}>
            {(["user", "group"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[s.chip, assignmentMode === mode && s.chipActive]}
                onPress={() => setAssignmentMode(mode)}
              >
                <Text style={[s.chipText, assignmentMode === mode && s.chipTextActive]}>
                  {mode === "user" ? t.newTicket.assignUser : t.newTicket.assignGroup}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {assignmentMode === "user" ? (
            <View style={[s.optionList, { maxHeight: 190 }]}>
              <TouchableOpacity
                style={s.optionRow}
                onPress={() => setAssignedUserId("")}
              >
                <Text style={[s.optionText, !assignedUserId && s.optionTextActive]}>{t.newTicket.unassigned}</Text>
                {!assignedUserId && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
              {users.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.optionRow}
                  onPress={() => setAssignedUserId(String(item.id))}
                >
                  <Text style={[s.optionText, assignedUserId === String(item.id) && s.optionTextActive]}>{item.name}</Text>
                  {assignedUserId === String(item.id) && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.chips}>
              <TouchableOpacity
                style={[s.chip, !assignedGroup && s.chipActive]}
                onPress={() => setAssignedGroup("")}
              >
                <Text style={[s.chipText, !assignedGroup && s.chipTextActive]}>{t.newTicket.unassigned}</Text>
              </TouchableOpacity>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[s.chip, assignedGroup === group && s.chipActive]}
                  onPress={() => setAssignedGroup(group)}
                >
                  <Text style={[s.chipText, assignedGroup === group && s.chipTextActive]}>{group}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={s.field}>
          <Text style={s.label}>{t.newTicket.assignment}</Text>
          <TouchableOpacity
            style={s.optionRow}
            onPress={() => setAssignedUserId((current) => current === String(user?.id) ? "" : String(user?.id ?? ""))}
          >
            <Text style={[s.optionText, assignedUserId === String(user?.id) && s.optionTextActive]}>
              {t.newTicket.assignToMe}{user?.name ? ` · ${user.name}` : ""}
            </Text>
            {assignedUserId === String(user?.id) && <Feather name="check-circle" size={18} color={colors.primary} />}
          </TouchableOpacity>
        </View>
      )}

      {clientsEnabled && (
        <View style={s.field}>
          <View style={s.labelRow}>
            <Text style={[s.label, { marginBottom: 0 }]}>{t.newTicket.client}</Text>
            {isAdmin && (
              <TouchableOpacity
                style={s.inlineAction}
                onPress={() => {
                  setQuickClientName("");
                  setQuickClientEmail("");
                  setQuickClientPhone("");
                  setQuickAddClientOpen(true);
                }}
              >
                <Feather name="plus" size={15} color={colors.primary} />
                <Text style={s.inlineActionText}>{t.newTicket.quickAddClient}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={s.input}
            value={clientSearch}
            onChangeText={setClientSearch}
            placeholder={t.newTicket.searchClient}
            placeholderTextColor={colors.mutedForeground}
          />
          <View style={[s.optionList, { maxHeight: 170 }]}>
            <TouchableOpacity style={s.optionRow} onPress={() => setSelectedClientId("")}>
              <Text style={[s.optionText, !selectedClientId && s.optionTextActive]}>{t.newTicket.noClient}</Text>
              {!selectedClientId && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
            {visibleClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={s.optionRow}
                onPress={() => setSelectedClientId(String(client.id))}
              >
                <Text style={[s.optionText, selectedClientId === String(client.id) && s.optionTextActive]}>
                  {client.name}
                </Text>
                {selectedClientId === String(client.id) && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            {visibleClients.length === 0 && clientList.length > 0 && (
              <Text style={s.helperText}>{t.newTicket.noClientFound}</Text>
            )}
            {clientList.length === 0 && !isAdmin && (
              <Text style={s.helperText}>{t.newTicket.noClientsAvailable}</Text>
            )}
          </View>
        </View>
      )}

      <View style={s.field}>
        <Text style={s.label}>{t.newTicket.dueAt}</Text>
        {Platform.OS === "web" ? (
          renderWebDateInput(
            "datetime-local",
            localDateTimeInput(dueAt),
            (value) => handleWebDateChange("dueAt", value),
            localDateTimeInput(new Date()),
          )
        ) : (
          <>
            <View style={s.dateRow}>
              <TouchableOpacity
                style={[s.dateButton, { flex: 1 }]}
                onPress={() => setActivePicker((current) => current === "due-date" ? null : "due-date")}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={s.dateButtonText}>{formatDate(dueAt)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dateButton, { flex: 1 }]}
                onPress={() => setActivePicker((current) => current === "due-time" ? null : "due-time")}
              >
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={s.dateButtonText}>{formatTime(dueAt)}</Text>
              </TouchableOpacity>
              {dueAt && (
                <TouchableOpacity style={s.iconAction} onPress={() => setDueAt(null)} accessibilityLabel={t.newTicket.clearDate}>
                  <Feather name="x" size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            {activePicker?.startsWith("due-") && dateTimePicker}
          </>
        )}
        {Platform.OS === "web" && dueAt && (
          <TouchableOpacity style={s.clearDate} onPress={() => setDueAt(null)}>
            <Text style={s.inlineActionText}>{t.newTicket.clearDate}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isAdmin && (
        <View style={s.field}>
          <TouchableOpacity style={s.toggleRow} onPress={() => setPrivateTicket((current) => !current)}>
            <View style={[s.toggleBox, privateTicket && s.toggleBoxActive]}>
              {privateTicket && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionText}>{t.newTicket.privateVisibility}</Text>
              <Text style={s.helperText}>{t.newTicket.privateVisibilityHelp}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {isAdmin && (
        <View style={s.field}>
          <TouchableOpacity style={s.toggleRow} onPress={() => setRecurrenceEnabled((current) => !current)}>
            <Feather name="repeat" size={17} color={recurrenceEnabled ? colors.primary : colors.mutedForeground} />
            <Text style={[s.optionText, { flex: 1 }]}>{t.newTicket.recurrence}</Text>
            <View style={[s.toggleBox, recurrenceEnabled && s.toggleBoxActive]}>
              {recurrenceEnabled && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </View>
          </TouchableOpacity>
          {canCreateRecurring && (
            <View style={s.recurrencePanel}>
              <Text style={s.helperText}>{t.newTicket.recurrenceHint}</Text>
              <View style={s.chips}>
                {(["daily", "weekly", "monthly", "yearly"] as const).map((frequency) => (
                  <TouchableOpacity
                    key={frequency}
                    style={[s.chip, recurrenceFrequency === frequency && s.chipActive]}
                    onPress={() => setRecurrenceFrequency(frequency)}
                  >
                    <Text style={[s.chipText, recurrenceFrequency === frequency && s.chipTextActive]}>
                      {t.newTicket[`frequency_${frequency}`]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.field}>
                <Text style={s.label}>{t.newTicket.recurrenceEvery}</Text>
                <TextInput
                  style={s.input}
                  value={recurrenceInterval}
                  onChangeText={(value) => setRecurrenceInterval(value.replace(/[^0-9]/g, "").slice(0, 3))}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              {recurrenceFrequency === "weekly" && (
                <View style={s.chips}>
                  {t.newTicket.weekdays.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[s.chip, recurrenceDayOfWeek === (index === 6 ? 0 : index + 1) && s.chipActive]}
                      onPress={() => setRecurrenceDayOfWeek(index === 6 ? 0 : index + 1)}
                    >
                      <Text style={[s.chipText, recurrenceDayOfWeek === (index === 6 ? 0 : index + 1) && s.chipTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {recurrenceFrequency === "monthly" && (
                <View style={s.field}>
                  <Text style={s.label}>{t.newTicket.dayOfMonth}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.chips}>
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[s.chip, recurrenceDayOfMonth === day && s.chipActive]}
                          onPress={() => setRecurrenceDayOfMonth(day)}
                        >
                          <Text style={[s.chipText, recurrenceDayOfMonth === day && s.chipTextActive]}>{day}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <Text style={s.helperText}>{t.newTicket.monthEndHint}</Text>
                </View>
              )}
              <Text style={s.label}>{t.newTicket.recurrenceEndDate}</Text>
              {Platform.OS === "web" ? (
                renderWebDateInput("date", localDateInput(recurrenceEndDate), (value) => handleWebDateChange("recurrenceEndDate", value), localDateInput(new Date()))
              ) : (
                <>
                  <TouchableOpacity
                    style={s.dateButton}
                    onPress={() => setActivePicker((current) => current === "recurrence-date" ? null : "recurrence-date")}
                  >
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={s.dateButtonText}>{recurrenceEndDate ? formatDate(recurrenceEndDate) : t.newTicket.noEndDate}</Text>
                  </TouchableOpacity>
                  {activePicker === "recurrence-date" && dateTimePicker}
                </>
              )}
            </View>
          )}
        </View>
      )}

      <View style={s.field}>
        <View style={s.labelRow}>
          <Text style={[s.label, { marginBottom: 0 }]}>{t.newTicket.attachments}</Text>
          <TouchableOpacity style={s.inlineAction} onPress={chooseAttachment}>
            <Feather name="paperclip" size={15} color={colors.primary} />
            <Text style={s.inlineActionText}>{t.newTicket.addAttachment}</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.helperText}>{t.newTicket.attachmentHelp}</Text>
        {attachments.map((attachment, index) => (
          <View key={`${attachment.name}-${attachment.size ?? index}`} style={s.attachmentRow}>
            <Feather name="file" size={16} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={s.optionText} numberOfLines={1}>{attachment.name}</Text>
              {attachment.size != null && <Text style={s.helperText}>{(attachment.size / 1024 / 1024).toFixed(1)} MB</Text>}
            </View>
            <TouchableOpacity onPress={() => setAttachments((current) => current.filter((_, i) => i !== index))} accessibilityLabel={t.newTicket.removeAttachment}>
              <Feather name="x" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={s.field}>
        <View style={s.labelRow}>
          <Text style={[s.label, { marginBottom: 0 }]}>{t.newTicket.checklist}</Text>
          {checklistMode && (
            <TouchableOpacity style={s.inlineAction} onPress={() => {
              setChecklistMode(null);
              setChecklistTemplateId(null);
              setChecklistItems([]);
              setChecklistTitle("");
            }}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
              <Text style={s.inlineActionText}>{t.newTicket.removeChecklist}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, checklistMode === "manual" && s.chipActive]} onPress={() => setChecklistMode("manual")}>
            <Text style={[s.chipText, checklistMode === "manual" && s.chipTextActive]}>{t.newTicket.manualChecklist}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, checklistMode === "template" && s.chipActive]} onPress={() => setChecklistMode("template")}>
            <Text style={[s.chipText, checklistMode === "template" && s.chipTextActive]}>{t.newTicket.templateChecklist}</Text>
          </TouchableOpacity>
        </View>
        {checklistMode === "template" && (
          <View style={s.optionList}>
            {checklistTemplates.length === 0 ? (
              <Text style={s.helperText}>{t.newTicket.noChecklistTemplates}</Text>
            ) : checklistTemplates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={s.optionRow}
                onPress={() => {
                  setChecklistTemplateId(template.id);
                  setChecklistItems([...template.items].sort((a, b) => a.position - b.position).map((item) => item.text));
                  setChecklistTitle(template.title);
                }}
              >
                <Text style={[s.optionText, checklistTemplateId === template.id && s.optionTextActive]}>{template.title}</Text>
                {checklistTemplateId === template.id && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        {checklistMode === "manual" && (
          <View style={s.checklistPanel}>
            <TextInput
              style={s.input}
              value={checklistTitle}
              onChangeText={setChecklistTitle}
              placeholder={t.newTicket.checklistTitle}
              placeholderTextColor={colors.mutedForeground}
            />
            {checklistItems.map((item, index) => (
              <View key={`${index}-${item}`} style={s.attachmentRow}>
                <Text style={[s.optionText, { flex: 1 }]}>{item}</Text>
                <TouchableOpacity onPress={() => setChecklistItems((current) => current.filter((_, i) => i !== index))}>
                  <Feather name="x" size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={s.checklistAddRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={newChecklistItem}
                onChangeText={setNewChecklistItem}
                placeholder={t.newTicket.checklistItemPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={() => {
                  if (newChecklistItem.trim()) setChecklistItems((current) => [...current, newChecklistItem.trim()]);
                  setNewChecklistItem("");
                }}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={s.iconAction}
                onPress={() => {
                  if (newChecklistItem.trim()) setChecklistItems((current) => [...current, newChecklistItem.trim()]);
                  setNewChecklistItem("");
                }}
                accessibilityLabel={t.newTicket.addChecklistItem}
              >
                <Feather name="plus" size={19} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.btn, isCreating && s.btnDisabled]}
        onPress={handleCreate}
        disabled={isCreating}
        activeOpacity={0.85}
      >
        {isCreating ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.btnText}>{t.newTicket.create}</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal visible={quickAddClientOpen} transparent animationType="fade" onRequestClose={() => setQuickAddClientOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.labelRow}>
              <Text style={s.modalTitle}>{t.newTicket.quickAddClient}</Text>
              <TouchableOpacity onPress={() => setQuickAddClientOpen(false)} accessibilityLabel={t.newTicket.cancel}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} value={quickClientName} onChangeText={setQuickClientName} placeholder={t.newTicket.clientName} placeholderTextColor={colors.mutedForeground} />
            <TextInput style={s.input} value={quickClientEmail} onChangeText={setQuickClientEmail} placeholder={t.newTicket.clientEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.mutedForeground} />
            <TextInput style={s.input} value={quickClientPhone} onChangeText={setQuickClientPhone} placeholder={t.newTicket.clientPhone} keyboardType="phone-pad" placeholderTextColor={colors.mutedForeground} />
            <TouchableOpacity
              style={[s.btn, (!quickClientName.trim() || quickClientSaving) && s.btnDisabled]}
              onPress={handleQuickAddClient}
              disabled={!quickClientName.trim() || quickClientSaving}
            >
              {quickClientSaving
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={s.btnText}>{t.newTicket.saveClient}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 4 },
    field: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    textarea: { minHeight: 100, paddingTop: 12 },
    suggestionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 8 },
    suggestionText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    suggestionChip: {
      maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
      borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card,
    },
    suggestionChipText: { fontSize: 12, color: colors.primary, fontFamily: "Inter_500Medium" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    chipTextActive: { color: colors.primaryForeground },
    priorityRow: { flexDirection: "row", gap: 8 },
    priorityBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 10, borderRadius: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    priorityBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    priorityText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    priorityTextActive: { color: colors.primaryForeground },
    labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
    inlineAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
    inlineActionText: { color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    optionList: {
      marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, overflow: "hidden",
    },
    optionRow: {
      minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row",
      alignItems: "center", justifyContent: "space-between", gap: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    optionText: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular" },
    optionTextActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    helperText: { marginTop: 5, fontSize: 12, lineHeight: 17, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    dateButton: {
      minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    dateButtonText: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    clearDate: { alignSelf: "flex-start", marginTop: 6, paddingVertical: 4 },
    iconAction: {
      width: 42, height: 42, alignItems: "center", justifyContent: "center",
      borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    pickerContainer: {
      marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, overflow: "hidden",
    },
    pickerDone: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
    pickerDoneText: { color: colors.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    toggleRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    toggleBox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", backgroundColor: colors.card,
    },
    toggleBoxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    recurrencePanel: { marginTop: 10, padding: 12, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card },
    attachmentRow: {
      flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, padding: 11,
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card,
    },
    checklistPanel: { marginTop: 8, gap: 8 },
    checklistAddRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    modalBackdrop: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.45)" },
    modalCard: { gap: 12, padding: 18, borderRadius: 16, backgroundColor: colors.background },
    modalTitle: { flex: 1, fontSize: 18, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    btn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 16, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
    },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
