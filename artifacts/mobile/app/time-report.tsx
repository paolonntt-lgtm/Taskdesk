import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet } from "@/utils/api";

type ReportRow = {
  kind: "session" | "manual";
  ticketId: number;
  ticketNumber: number | null;
  title: string;
  date: string;
  durationMinutes: number;
  clientId: number | null;
  clientName: string | null;
  collaboratorId: number | null;
  collaboratorName: string | null;
  billingStatus: "unbilled" | "billed";
};

type TimeReport = {
  customerRows: ReportRow[];
  collaboratorRows: ReportRow[];
  totals: {
    clientBillableMinutes: number;
    clientUnbilledMinutes: number;
    clientBilledMinutes: number;
    collaboratorRecognizableMinutes: number;
  };
};

type FilterOption = { id: number; name: string };

function formatDuration(minutes: number, english: boolean): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (english) return hours ? `${hours} hr${hours === 1 ? "" : "s"} ${remainder} min` : `${remainder} min`;
  return hours ? `${hours} h ${remainder} min` : `${remainder} min`;
}

export default function TimeReportScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const english = lang !== "it";
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [collaboratorId, setCollaboratorId] = useState<number | null>(null);
  const [showClientOptions, setShowClientOptions] = useState(false);
  const [showCollaboratorOptions, setShowCollaboratorOptions] = useState(false);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) params.set("dateFrom", dateFrom);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) params.set("dateTo", dateTo);
    if (clientId != null) params.set("clientId", String(clientId));
    if (collaboratorId != null) params.set("collaboratorId", String(collaboratorId));
    return params.toString();
  }, [dateFrom, dateTo, clientId, collaboratorId]);

  const settingsQuery = useQuery({
    queryKey: ["mobile-organization-settings", user?.organizationId],
    queryFn: () => apiGet<{ timeTrackingModuleEnabled?: boolean }>("/settings/organization"),
    enabled: user?.organizationId != null,
  });
  const reportQuery = useQuery({
    queryKey: ["mobile-time-report", queryString],
    queryFn: () => apiGet<TimeReport>(`/time-tracking/report${queryString ? `?${queryString}` : ""}`),
    enabled: user?.role === "admin" && settingsQuery.data?.timeTrackingModuleEnabled === true,
  });
  const clientQuery = useQuery({
    queryKey: ["mobile-time-report-clients"],
    queryFn: () => apiGet<FilterOption[]>("/clients"),
    enabled: user?.role === "admin" && settingsQuery.data?.timeTrackingModuleEnabled === true,
  });
  const userQuery = useQuery({
    queryKey: ["mobile-time-report-users"],
    queryFn: () => apiGet<FilterOption[]>("/users"),
    enabled: user?.role === "admin" && settingsQuery.data?.timeTrackingModuleEnabled === true,
  });

  const palette = {
    background: colors.background,
    card: colors.card,
    foreground: colors.foreground,
    muted: colors.mutedForeground,
    border: colors.border,
    primary: colors.primary,
    success: colors.success,
  };
  const styles = createStyles(palette);
  const labels = {
    title: english ? "Hours report" : "Rendiconto ore",
    disabled: english ? "The hours module is disabled for this organization." : "Il modulo di tracciamento ore è disattivato per questa organizzazione.",
    dateFrom: english ? "From (YYYY-MM-DD)" : "Dal (AAAA-MM-GG)",
    dateTo: english ? "To (YYYY-MM-DD)" : "Al (AAAA-MM-GG)",
    allClients: english ? "All clients" : "Tutti i clienti",
    allCollaborators: english ? "All collaborators" : "Tutti i collaboratori",
    client: english ? "Client" : "Cliente",
    collaborator: english ? "Collaborator" : "Collaboratore",
    customer: english ? "Customer-billable time" : "Ore fatturabili ai clienti",
    collaboratorHours: english ? "Hours to recognize" : "Ore da riconoscere",
    unbilled: english ? "To invoice" : "Da fatturare",
    billed: english ? "Invoiced" : "Fatturate",
    notPaid: english ? "Recognition total; not a payment record." : "Totale da riconoscere; non indica un pagamento effettuato.",
    noRows: english ? "No tickets in this period." : "Nessun ticket nel periodo selezionato.",
    loading: english ? "Loading report…" : "Caricamento rendiconto…",
    loadError: english ? "Could not load the report." : "Impossibile caricare il rendiconto.",
    retry: english ? "Retry" : "Riprova",
    ticket: english ? "Ticket" : "Ticket",
  };

  if (user?.role !== "admin") {
    return <View style={styles.center}><Text style={styles.mutedText}>{english ? "Admins only." : "Solo per amministratori."}</Text></View>;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" testID="back-time-report">
        <Feather name="arrow-left" size={18} color={palette.primary} />
        <Text style={styles.backText}>{english ? "Back" : "Indietro"}</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>{labels.title}</Text>
      {settingsQuery.data?.timeTrackingModuleEnabled !== true ? (
        <View style={styles.card}><Text style={styles.mutedText}>{labels.disabled}</Text></View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.filterTitle}>{english ? "Period" : "Periodo"}</Text>
            <View style={styles.dateRow}>
              <TextInput value={dateFrom} onChangeText={setDateFrom} placeholder={labels.dateFrom} placeholderTextColor={palette.muted} style={styles.dateInput} testID="input-time-report-date-from" />
              <TextInput value={dateTo} onChangeText={setDateTo} placeholder={labels.dateTo} placeholderTextColor={palette.muted} style={styles.dateInput} testID="input-time-report-date-to" />
            </View>
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowClientOptions((value) => !value)} testID="filter-time-report-client">
              <Text style={styles.filterValue}>{clientQuery.data?.find((item) => item.id === clientId)?.name ?? labels.allClients}</Text>
              <Feather name={showClientOptions ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
            </TouchableOpacity>
            {showClientOptions && (
              <View style={styles.chips}>
                <FilterChip label={labels.allClients} selected={clientId == null} onPress={() => { setClientId(null); setShowClientOptions(false); }} styles={styles} />
                {(clientQuery.data ?? []).map((option) => (
                  <FilterChip key={option.id} label={option.name} selected={clientId === option.id} onPress={() => { setClientId(option.id); setShowClientOptions(false); }} styles={styles} />
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowCollaboratorOptions((value) => !value)} testID="filter-time-report-collaborator">
              <Text style={styles.filterValue}>{userQuery.data?.find((item) => item.id === collaboratorId)?.name ?? labels.allCollaborators}</Text>
              <Feather name={showCollaboratorOptions ? "chevron-up" : "chevron-down"} size={16} color={palette.muted} />
            </TouchableOpacity>
            {showCollaboratorOptions && (
              <View style={styles.chips}>
                <FilterChip label={labels.allCollaborators} selected={collaboratorId == null} onPress={() => { setCollaboratorId(null); setShowCollaboratorOptions(false); }} styles={styles} />
                {(userQuery.data ?? []).map((option) => (
                  <FilterChip key={option.id} label={option.name} selected={collaboratorId === option.id} onPress={() => { setCollaboratorId(option.id); setShowCollaboratorOptions(false); }} styles={styles} />
                ))}
              </View>
            )}
          </View>

          {reportQuery.isLoading ? (
            <View style={styles.card}><Text style={styles.mutedText}>{labels.loading}</Text></View>
          ) : reportQuery.isError ? (
            <View style={styles.card}>
              <Text style={styles.mutedText}>{labels.loadError}</Text>
              <TouchableOpacity style={styles.retry} onPress={() => void reportQuery.refetch()}><Text style={styles.retryText}>{labels.retry}</Text></TouchableOpacity>
            </View>
          ) : reportQuery.data ? (
            <>
              <View style={styles.summaryRow}>
                <SummaryCard label={labels.customer} value={formatDuration(reportQuery.data.totals.clientBillableMinutes, english)} styles={styles} />
                <SummaryCard label={labels.collaboratorHours} value={formatDuration(reportQuery.data.totals.collaboratorRecognizableMinutes, english)} styles={styles} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryCard label={labels.unbilled} value={formatDuration(reportQuery.data.totals.clientUnbilledMinutes, english)} styles={styles} />
                <SummaryCard label={labels.billed} value={formatDuration(reportQuery.data.totals.clientBilledMinutes, english)} styles={styles} />
              </View>
              <Text style={styles.disclaimer}>{labels.notPaid}</Text>
              <ReportList title={labels.customer} rows={reportQuery.data.customerRows} labels={labels} styles={styles} english={english} palette={palette} />
              <ReportList title={labels.collaboratorHours} rows={reportQuery.data.collaboratorRows} labels={labels} styles={styles} english={english} palette={palette} />
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, selected, onPress, styles }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipActive]} accessibilityRole="button">
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryCard({ label, value, styles }: any) {
  return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

function ReportList({ title, rows, labels, styles, english, palette }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.mutedText}>{labels.noRows}</Text> : rows.map((row: ReportRow, index: number) => (
        <TouchableOpacity key={`${row.ticketId}-${row.collaboratorId ?? "client"}-${row.kind}-${index}`} style={styles.reportRow} onPress={() => router.push(`/ticket/${row.ticketId}`)} testID={`time-report-ticket-${row.ticketId}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{labels.ticket} #{row.ticketNumber ?? row.ticketId}: {row.title}</Text>
            <Text style={styles.rowMeta}>
              {new Date(row.date).toLocaleDateString(english ? "en-GB" : "it-IT")}
              {row.clientName ? ` · ${labels.client}: ${row.clientName}` : ""}
              {row.collaboratorName ? ` · ${labels.collaborator}: ${row.collaboratorName}` : ""}
              {row.kind === "manual" ? ` · ${english ? "Manual" : "Manuale"}` : ""}
            </Text>
            {row.collaboratorId == null && (
              <Text style={[styles.rowMeta, { color: row.billingStatus === "billed" ? palette.success : palette.primary }]}>
                {row.billingStatus === "billed" ? labels.billed : labels.unbilled}
              </Text>
            )}
          </View>
          <Text style={styles.rowDuration}>{formatDuration(row.durationMinutes, english)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(p: { background: string; card: string; foreground: string; muted: string; border: string; primary: string; success: string }) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: p.background },
    content: { padding: 18, paddingBottom: 40, gap: 12 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    heading: { fontFamily: "Inter_700Bold", fontSize: 24, color: p.foreground, marginBottom: 2 },
    back: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 4, alignSelf: "flex-start" },
    backText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: p.primary },
    card: { backgroundColor: p.card, borderRadius: 12, borderColor: p.border, borderWidth: 1, padding: 14 },
    filterTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: p.foreground, marginBottom: 8 },
    dateRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
    dateInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: p.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: p.foreground, fontFamily: "Inter_400Regular", fontSize: 12 },
    filterButton: { minHeight: 42, borderBottomWidth: 1, borderColor: p.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterValue: { color: p.foreground, fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 8 },
    chip: { borderRadius: 20, borderWidth: 1, borderColor: p.border, paddingHorizontal: 10, paddingVertical: 6 },
    chipActive: { backgroundColor: p.primary, borderColor: p.primary },
    chipText: { color: p.foreground, fontFamily: "Inter_500Medium", fontSize: 12 },
    chipTextActive: { color: "#fff" },
    summaryRow: { flexDirection: "row", gap: 8 },
    summaryCard: { flex: 1, minHeight: 86, borderRadius: 12, padding: 12, backgroundColor: p.card, borderColor: p.border, borderWidth: 1, justifyContent: "space-between" },
    summaryLabel: { color: p.muted, fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 15 },
    summaryValue: { color: p.foreground, fontFamily: "Inter_700Bold", fontSize: 18 },
    disclaimer: { color: p.muted, fontFamily: "Inter_400Regular", fontSize: 12, marginHorizontal: 2 },
    sectionTitle: { color: p.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 8 },
    reportRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderColor: p.border },
    rowTitle: { color: p.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 },
    rowMeta: { color: p.muted, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 },
    rowDuration: { color: p.foreground, fontFamily: "Inter_700Bold", fontSize: 13 },
    mutedText: { color: p.muted, fontFamily: "Inter_400Regular", fontSize: 13 },
    retry: { marginTop: 12, padding: 10, alignItems: "center", backgroundColor: p.primary, borderRadius: 8 },
    retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  });
}
