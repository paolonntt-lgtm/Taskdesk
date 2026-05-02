import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPatch, apiPost, STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/utils/api";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

interface Ticket {
  id: number; title: string; description: string;
  category: string; location: string; resource?: string;
  priority: string; status: string;
  createdAt: string; closedAt?: string;
  creator: { name: string }; assignee?: { name: string } | null;
  commentCount: number;
}
interface Comment {
  id: number; content: string; isInternal: boolean;
  author: { name: string }; createdAt: string;
}

const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"];

export default function TicketDetailScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const s = styles(colors);

  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: ticket, isLoading } = useQuery({
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPatch(`/tickets/${id}`, { status });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e: any) {
      Alert.alert("Errore", e.message);
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPost(`/tickets/${id}/comments`, { content: comment.trim() });
      setComment("");
      refetchComments();
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    } catch (e: any) {
      Alert.alert("Errore", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

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
        <Text style={s.errorText}>Ticket non trovato</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAdmin = user?.role === "admin";
  const priorityColor = PRIORITY_COLORS[ticket.priority] ?? colors.muted;

  return (
    <KeyboardAwareScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 34 : 24 }]}
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
        {[
          { label: "Stato", value: STATUS_LABELS[ticket.status] ?? ticket.status },
          { label: "Priorità", value: PRIORITY_LABELS[ticket.priority] ?? ticket.priority },
          { label: "Categoria", value: ticket.category },
          { label: "Sede", value: ticket.location },
          { label: "Creato da", value: ticket.creator?.name ?? "–" },
          { label: "Assegnato a", value: ticket.assignee?.name ?? "Non assegnato" },
          { label: "Data", value: formatDate(ticket.createdAt) },
          ...(ticket.resource ? [{ label: "Risorsa", value: ticket.resource }] : []),
        ].map((item, i, arr) => (
          <View key={item.label} style={[s.metaRow, i < arr.length - 1 && s.metaRowBorder]}>
            <Text style={s.metaLabel}>{item.label}</Text>
            <Text style={s.metaValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Descrizione</Text>
        <View style={s.descBox}>
          <Text style={s.desc}>{ticket.description}</Text>
        </View>
      </View>

      {isAdmin && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Aggiorna stato</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.statusRow}>
              {STATUSES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.statusBtn, ticket.status === st && s.statusBtnActive]}
                  onPress={() => handleStatusChange(st)}
                >
                  <Text style={[s.statusBtnText, ticket.status === st && s.statusBtnTextActive]}>
                    {STATUS_LABELS[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Commenti ({comments.length})</Text>
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
            <Text style={s.commentText}>{c.content}</Text>
          </View>
        ))}

        <View style={s.commentInputWrap}>
          <TextInput
            style={s.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Aggiungi un commento..."
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
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    errorText: { fontSize: 16, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    backBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
    titleRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    priorityBar: { width: 4, borderRadius: 2, alignSelf: "stretch", minHeight: 40 },
    ticketId: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    title: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    metaCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    metaRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    metaRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    metaLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    metaValue: { fontSize: 13, color: colors.foreground, fontWeight: "500" as const, fontFamily: "Inter_500Medium", maxWidth: "55%", textAlign: "right" },
    section: {},
    sectionTitle: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
    descBox: { backgroundColor: colors.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
    desc: { fontSize: 14, color: colors.foreground, lineHeight: 22, fontFamily: "Inter_400Regular" },
    statusRow: { flexDirection: "row", gap: 8 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    statusBtnText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    statusBtnTextActive: { color: colors.primaryForeground },
    commentCard: { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    commentHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    commentInitial: { color: colors.primaryForeground, fontWeight: "700" as const, fontSize: 13, fontFamily: "Inter_700Bold" },
    commentAuthor: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    commentDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    commentText: { fontSize: 14, color: colors.foreground, lineHeight: 20, fontFamily: "Inter_400Regular" },
    commentInputWrap: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
    commentInput: {
      flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      fontSize: 14, color: colors.foreground, minHeight: 48, maxHeight: 120, fontFamily: "Inter_400Regular",
    },
    sendBtn: { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    sendBtnDisabled: { opacity: 0.5 },
  });
