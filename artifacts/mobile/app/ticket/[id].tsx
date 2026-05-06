import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform, Modal, KeyboardAvoidingView,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPatch, apiPost, PRIORITY_COLORS } from "@/utils/api";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

interface Ticket {
  id: number; title: string; description: string;
  category: string; location: string; resource?: string;
  priority: string; status: string;
  createdAt: string; closedAt?: string;
  resolutionNote?: string | null;
  creator: { name: string }; assignee?: { name: string } | null;
  assignedToGroup?: string | null;
  commentCount: number;
}
interface Comment {
  id: number; commentText: string; isInternal: boolean;
  author: { name: string }; createdAt: string;
}

const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"];

export default function TicketDetailScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const s = styles(colors);

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [resolutionModal, setResolutionModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const { data: ticket, isLoading, refetch: refetchTicket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiGet<Ticket>(`/tickets/${id}`),
    enabled: !!id,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["ticket-comments", id],
    queryFn: () => apiGet<Comment[]>(`/tickets/${id}/comments`),
    enabled: !!id,
  });

  const handleStatusChange = async (status: string) => {
    if (!ticket || ticket.status === status) return;
    if (status === "resolved") {
      setResolutionNote("");
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
      Alert.alert(t.ticketDetail.error, e.message);
    }
  };

  const confirmResolved = async (note: string) => {
    setResolving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiPatch(`/tickets/${id}`, {
        status: "resolved",
        resolutionNote: note || null,
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
      Alert.alert(t.ticketDetail.error, e.message);
    } finally {
      setSubmitting(false);
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

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t.ticketDetail.description}</Text>
          <View style={s.descBox}>
            <Text style={s.desc}>{ticket.description}</Text>
          </View>
        </View>

        {ticket.resolutionNote ? (
          <View style={s.resolutionCard}>
            <View style={s.resolutionHeader}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={s.resolutionTitle}>{t.ticketDetail.resolvedHow}</Text>
            </View>
            <Text style={s.resolutionText}>{ticket.resolutionNote}</Text>
          </View>
        ) : null}

        {isAdmin && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t.ticketDetail.updateStatus}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.statusRow}>
                {STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[s.statusBtn, ticket.status === st && s.statusBtnActive]}
                    onPress={() => handleStatusChange(st)}
                  >
                    <Text style={[s.statusBtnText, ticket.status === st && s.statusBtnTextActive]}>
                      {t.status[st] ?? st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

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
    section: {},
    sectionTitle: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
    descBox: { backgroundColor: colors.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border },
    desc: { fontSize: 13, color: colors.foreground, lineHeight: 19, fontFamily: "Inter_400Regular" },
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
  });
