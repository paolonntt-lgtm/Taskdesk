import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPatch, apiPost } from "@/utils/api";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

type Organization = {
  id: number; name: string; createdAt: string | null; totalTickets: number;
  users: Array<{ id: number; name: string; email: string; role: string; createdAt: string | null; lastLoginAt: string | null }>;
};
type BugReport = {
  id: number; userName: string; userEmail: string; organizationId: number | null;
  organizationName: string | null; description: string; currentPage: string;
  status: "pending" | "replied" | "processed"; replyText: string | null;
  repliedAt: string | null; processedAt: string | null; isRead: boolean; createdAt: string | null;
};
type BugReportPage = { reports: BugReport[]; total: number; page: number; pendingCount: number };

export default function SuperadminScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const it = lang === "it";
  const c = makeStyles(colors);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"organizations" | "reports">("organizations");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [replyTo, setReplyTo] = useState<BugReport | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const authorized = user?.isSuperAdmin === true;
  const orgQuery = useQuery({
    queryKey: ["mobile-superadmin-orgs"],
    queryFn: () => apiGet<{ organizations: Organization[] }>("/superadmin"),
    enabled: authorized,
  });
  const reportQuery = useQuery({
    queryKey: ["mobile-superadmin-reports", page],
    queryFn: () => apiGet<BugReportPage>(`/superadmin/bug-reports?page=${page}`),
    enabled: authorized && tab === "reports",
  });
  const organizations = useMemo(() => (orgQuery.data?.organizations ?? []).filter((org) => {
    const query = search.trim().toLowerCase();
    return !query || org.name.toLowerCase().includes(query) ||
      org.users.some((person) => person.name.toLowerCase().includes(query) || person.email.toLowerCase().includes(query));
  }), [orgQuery.data, search]);
  const refreshReports = async () => qc.invalidateQueries({ queryKey: ["mobile-superadmin-reports"] });

  const markRead = async (report: BugReport) => {
    if (report.isRead) return;
    try {
      await apiPatch(`/superadmin/bug-reports/${report.id}`, { isRead: true });
      await refreshReports();
    } catch (error: any) {
      Alert.alert(it ? "Errore" : "Error", error.message ?? (it ? "Impossibile aggiornare la segnalazione." : "Could not update report."));
    }
  };
  const markProcessed = (report: BugReport) => Alert.alert(
    it ? "Contrassegnare come gestita?" : "Mark as processed?",
    it ? "La segnalazione verrà contrassegnata come gestita." : "This report will be marked as processed.",
    [{ text: it ? "Annulla" : "Cancel", style: "cancel" }, { text: it ? "Conferma" : "Confirm", onPress: async () => {
      try {
        await apiPatch(`/superadmin/bug-reports/${report.id}`, { status: "processed" });
        await refreshReports();
      } catch (error: any) { Alert.alert(it ? "Errore" : "Error", error.message ?? (it ? "Impossibile aggiornare." : "Could not update.")); }
    } }],
  );
  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      await apiPost(`/superadmin/bug-reports/${replyTo.id}/reply`, { replyText: replyText.trim() });
      setReplyTo(null); setReplyText(""); await refreshReports();
      Alert.alert(it ? "Risposta inviata" : "Reply sent");
    } catch (error: any) {
      Alert.alert(it ? "Errore" : "Error", error.message ?? (it ? "Invio della risposta non riuscito." : "Could not send the reply."));
    } finally { setReplyLoading(false); }
  };
  if (!authorized) return <View style={c.center}><Feather name="shield-off" size={28} color={colors.destructive} /><Text style={c.denied}>{it ? "Questa console è riservata ai superamministratori." : "This console is available to superadmins only."}</Text></View>;
  const reports = reportQuery.data?.reports ?? [];
  const totalPages = Math.max(1, Math.ceil((reportQuery.data?.total ?? 0) / 20));

  return <View style={c.root}>
    <ScrollView contentContainerStyle={c.content}>
      <View style={c.heading}><Text style={c.title}>{it ? "Console piattaforma" : "Platform console"}</Text><Text style={c.muted}>{it ? "Organizzazioni e segnalazioni di assistenza." : "Organizations and support reports."}</Text></View>
      <View style={c.tabs}>
        <Pressable onPress={() => setTab("organizations")} style={[c.tab, tab === "organizations" && c.tabActive]}><Feather name="briefcase" size={15} color={tab === "organizations" ? colors.primary : colors.mutedForeground} /><Text style={[c.tabText, tab === "organizations" && c.tabTextActive]}>{it ? "Organizzazioni" : "Organizations"}</Text></Pressable>
        <Pressable onPress={() => setTab("reports")} style={[c.tab, tab === "reports" && c.tabActive]}><Feather name="alert-circle" size={15} color={tab === "reports" ? colors.primary : colors.mutedForeground} /><Text style={[c.tabText, tab === "reports" && c.tabTextActive]}>{it ? `Segnalazioni${reportQuery.data?.pendingCount ? ` (${reportQuery.data.pendingCount})` : ""}` : `Reports${reportQuery.data?.pendingCount ? ` (${reportQuery.data.pendingCount})` : ""}`}</Text></Pressable>
      </View>
      {tab === "organizations" ? <>
        {orgQuery.data && <View style={c.stats}><Stat label={it ? "Organizzazioni" : "Organizations"} value={orgQuery.data.organizations.length} c={c} /><Stat label={it ? "Utenti attivi" : "Active users"} value={orgQuery.data.organizations.reduce((sum, org) => sum + org.users.length, 0)} c={c} /><Stat label={it ? "Ticket" : "Tickets"} value={orgQuery.data.organizations.reduce((sum, org) => sum + org.totalTickets, 0)} c={c} /></View>}
        <TextInput value={search} onChangeText={setSearch} placeholder={it ? "Cerca azienda, persona o email" : "Search organization, person, or email"} placeholderTextColor={colors.mutedForeground} style={c.search} />
        {orgQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {orgQuery.error ? <Text style={c.error}>{it ? "Accesso negato o impossibile caricare le organizzazioni." : "Access denied or organizations could not be loaded."}</Text> : null}
        {organizations.map((org) => <View key={org.id} style={c.card}>
          <View style={c.cardHeader}><View style={c.orgIcon}><Feather name="briefcase" size={16} color={colors.primary} /></View><View style={c.flex}><Text style={c.cardTitle}>{org.name}</Text><Text style={c.muted}>{org.users.length} {it ? "utenti" : "users"} · {org.totalTickets} {it ? "ticket" : "tickets"}</Text></View></View>
          <Text style={c.sectionLabel}>{it ? "UTENTI ATTIVI" : "ACTIVE USERS"}</Text>
          {org.users.length ? org.users.map((person) => <View key={person.id} style={c.personRow}><View style={c.flex}><Text style={c.personName}>{person.name}</Text><Text style={c.muted}>{person.email}</Text></View><Text style={[c.role, person.role === "admin" && c.adminRole]}>{person.role === "admin" ? "Admin" : it ? "Utente" : "User"}</Text></View>) : <Text style={c.muted}>{it ? "Nessun utente attivo" : "No active users"}</Text>}
        </View>)}
        {!orgQuery.isLoading && organizations.length === 0 && !orgQuery.error && <Text style={c.muted}>{it ? "Nessuna organizzazione trovata." : "No organizations found."}</Text>}
      </> : <>
        {reportQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {reportQuery.error ? <Text style={c.error}>{it ? "Impossibile caricare le segnalazioni." : "Could not load support reports."}</Text> : null}
        {reports.length === 0 && !reportQuery.isLoading ? <Text style={c.muted}>{it ? "Nessuna segnalazione." : "No support reports."}</Text> : reports.map((report) => <View key={report.id} style={[c.card, !report.isRead && c.unreadCard]}>
          <Pressable onPress={() => { setExpanded(expanded === report.id ? null : report.id); void markRead(report); }} style={c.cardHeader}>
            <View style={[c.readDot, report.isRead && c.readDotDone]} />
            <View style={c.flex}><Text style={c.cardTitle}>{report.userName}</Text><Text style={c.muted}>{report.organizationName ?? (it ? "Senza organizzazione" : "No organization")} · {report.userEmail}</Text></View>
            <Text style={[c.role, report.status === "pending" ? c.pending : report.status === "replied" ? c.replied : c.processed]}>{report.status === "pending" ? it ? "In attesa" : "Pending" : report.status === "replied" ? it ? "Risposto" : "Replied" : it ? "Gestito" : "Processed"}</Text>
          </Pressable>
          {expanded === report.id && <View style={c.reportBody}>
            <Text style={c.sectionLabel}>{it ? "SEGNALAZIONE" : "REPORT"}</Text>
            <Text style={c.reportText}>{report.description}</Text>
            <Text style={c.muted}>{it ? "Pagina" : "Page"}: {report.currentPage || "—"} · {report.createdAt ? new Date(report.createdAt).toLocaleString(it ? "it-IT" : "en-GB") : "—"}</Text>
            {report.replyText ? <View style={c.replyBox}><Text style={c.sectionLabel}>{it ? "RISPOSTA INVIATA" : "REPLY SENT"}</Text><Text style={c.reportText}>{report.replyText}</Text></View> : null}
            <View style={c.actions}>
              {report.status !== "processed" && <Pressable style={c.action} onPress={() => { setReplyTo(report); setReplyText(""); }}><Feather name="corner-up-left" size={15} color={colors.primary} /><Text style={c.actionText}>{it ? "Rispondi" : "Reply"}</Text></Pressable>}
              {report.status !== "processed" && <Pressable style={c.action} onPress={() => markProcessed(report)}><Feather name="check-circle" size={15} color={colors.success} /><Text style={[c.actionText, { color: colors.success }]}>{it ? "Segna gestita" : "Mark processed"}</Text></Pressable>}
            </View>
          </View>}
        </View>)}
        {reportQuery.data && <View style={c.pagination}><Pressable disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}><Text style={[c.pageButton, page <= 1 && c.disabled]}>{it ? "Precedente" : "Previous"}</Text></Pressable><Text style={c.muted}>{page} / {totalPages}</Text><Pressable disabled={page >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}><Text style={[c.pageButton, page >= totalPages && c.disabled]}>{it ? "Successiva" : "Next"}</Text></Pressable></View>}
      </>}
    </ScrollView>
    <Modal visible={!!replyTo} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !replyLoading && setReplyTo(null)}>
      <View style={c.modal}>
        <View style={c.modalHeader}><Pressable onPress={() => setReplyTo(null)} disabled={replyLoading}><Text style={c.muted}>{it ? "Annulla" : "Cancel"}</Text></Pressable><Text style={c.modalTitle}>{it ? "Rispondi alla segnalazione" : "Reply to report"}</Text><Pressable onPress={() => void sendReply()} disabled={replyLoading || !replyText.trim()}><Text style={[c.pageButton, (!replyText.trim() || replyLoading) && c.disabled]}>{replyLoading ? "…" : it ? "Invia" : "Send"}</Text></Pressable></View>
        <KeyboardAwareScrollViewCompat style={{ flex: 1 }} contentContainerStyle={c.replyForm} keyboardShouldPersistTaps="handled">
          <Text style={c.muted}>{replyTo?.userName} · {replyTo?.userEmail}</Text>
          <TextInput value={replyText} onChangeText={setReplyText} multiline maxLength={4000} placeholder={it ? "Scrivi la risposta…" : "Write your reply…"} placeholderTextColor={colors.mutedForeground} style={c.replyInput} />
          <Pressable style={[c.sendButton, (!replyText.trim() || replyLoading) && c.disabledButton]} disabled={!replyText.trim() || replyLoading} onPress={() => void sendReply()}><Text style={c.sendText}>{replyLoading ? it ? "Invio…" : "Sending…" : it ? "Invia risposta" : "Send reply"}</Text></Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  </View>;
}

function Stat({ label, value, c }: { label: string; value: number; c: ReturnType<typeof makeStyles> }) {
  return <View style={c.stat}><Text style={c.statValue}>{value}</Text><Text style={c.muted}>{label}</Text></View>;
}
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 32, gap: 13 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
    heading: { gap: 4 }, title: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 24 }, muted: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 }, denied: { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign: "center" },
    tabs: { flexDirection: "row", backgroundColor: colors.muted, borderRadius: 11, padding: 4 }, tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 }, tabActive: { backgroundColor: colors.card }, tabText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }, tabTextActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    stats: { flexDirection: "row", gap: 8 }, stat: { flex: 1, alignItems: "center", gap: 2, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 11 }, statValue: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }, search: { backgroundColor: colors.card, color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 12, fontFamily: "Inter_400Regular", fontSize: 14 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13, gap: 10 }, unreadCard: { borderColor: colors.primary }, cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, orgIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "18" }, flex: { flex: 1 }, cardTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }, sectionLabel: { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
    personRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }, personName: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }, role: { overflow: "hidden", borderRadius: 15, backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 4, color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10 }, adminRole: { backgroundColor: colors.primary + "18", color: colors.primary }, pending: { backgroundColor: colors.warning + "30", color: colors.foreground }, replied: { backgroundColor: colors.primary + "18", color: colors.primary }, processed: { backgroundColor: colors.success + "22", color: colors.success },
    readDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }, readDotDone: { backgroundColor: colors.border }, reportBody: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, gap: 9 }, reportText: { color: colors.foreground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 }, replyBox: { borderRadius: 9, padding: 10, backgroundColor: colors.muted, gap: 6 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 18, paddingTop: 4 }, action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5 }, actionText: { color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }, pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 }, pageButton: { color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }, disabled: { opacity: 0.4 }, error: { color: colors.destructive, fontFamily: "Inter_400Regular", fontSize: 13 },
    modal: { flex: 1, backgroundColor: colors.background }, modalHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, modalTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }, replyForm: { padding: 16, gap: 13 }, replyInput: { minHeight: 150, textAlignVertical: "top", color: colors.foreground, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontFamily: "Inter_400Regular", fontSize: 15 }, sendButton: { backgroundColor: colors.primary, borderRadius: 10, minHeight: 45, alignItems: "center", justifyContent: "center" }, disabledButton: { opacity: 0.5 }, sendText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  });
}
