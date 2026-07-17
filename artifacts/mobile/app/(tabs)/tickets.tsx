import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { apiGet, PRIORITY_COLORS } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTicketStatuses } from "@/hooks/useTicketStatuses";

interface Ticket {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  location: string;
  createdAt: string;
  resolutionNote?: string | null;
  creator?: { name: string };
  assignee?: { name: string } | null;
  recurrence?: boolean;
  scheduledAt?: string | null;
}

export default function TicketsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { statuses: orgStatuses, getLabelForKey } = useTicketStatuses();
  const s = styles(colors);
  const params = useLocalSearchParams<{ status?: string; priority?: string }>();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(params.status ?? "");
  const [priorityFilter, setPriorityFilter] = useState(params.priority ?? "");
  const [scheduledFilter, setScheduledFilter] = useState(false);

  const buildQuery = () => {
    const parts: string[] = [];
    if (statusFilter) parts.push(`status=${statusFilter}`);
    if (priorityFilter) parts.push(`priority=${priorityFilter}`);
    if (scheduledFilter) parts.push(`scheduled=true`);
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  };

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, scheduledFilter],
    queryFn: () => apiGet<Ticket[]>(`/tickets${buildQuery()}`),
    enabled: !!user,
  });

  const q = search.toLowerCase();
  const filtered = tickets.filter((ticket) =>
    !search ||
    ticket.title.toLowerCase().includes(q) ||
    ticket.description?.toLowerCase().includes(q) ||
    String(ticket.id).includes(search)
  );

  const renderTicket = ({ item }: { item: Ticket }) => {
    const hasNote = !!(item.resolutionNote && (item.status === "resolved" || item.status === "closed"));
    return (
      <TouchableOpacity
        style={[s.card, hasNote && s.cardResolved]}
        onPress={() => router.push(`/ticket/${item.id}` as any)}
        activeOpacity={0.75}
      >
        <View style={s.cardTop}>
          <View style={[s.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] + "22" }]}>
            <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
            <Text style={[s.priorityText, { color: PRIORITY_COLORS[item.priority] }]}>
              {t.priority[item.priority] ?? item.priority}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {item.recurrence && (
              <Feather name="repeat" size={12} color={colors.primary} />
            )}
            {item.scheduledAt && new Date(item.scheduledAt) > new Date() && (
              <Feather name="calendar" size={12} color="#e65100" />
            )}
            <Text style={s.ticketId}>#{item.id}</Text>
          </View>
        </View>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <View style={s.meta}>
          <View style={s.metaItem}>
            <Feather name="tag" size={11} color={colors.mutedForeground} />
            <Text style={s.metaText}>{item.category}</Text>
          </View>
          {item.location ? (
            <View style={s.metaItem}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={s.metaText}>{item.location}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.cardBottom}>
          <View style={s.statusBadge}>
            <Text style={s.statusText}>{getLabelForKey(item.status) || t.status[item.status] || item.status}</Text>
          </View>
          <View style={s.cardBottomRight}>
            {hasNote && (
              <View style={s.noteChip}>
                <Feather name="check-circle" size={11} color={colors.success} />
                <Text style={s.noteChipText}>{t.tickets.resolvedNote}</Text>
              </View>
            )}
            <Text style={s.assignee}>
              {item.assignee ? item.assignee.name : t.tickets.unassigned}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.root, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      <View style={s.searchBar}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.tickets.search}
          placeholderTextColor={colors.mutedForeground}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.filtersRow}>
        <TouchableOpacity
          key=""
          style={[s.filterBtn, statusFilter === "" && !priorityFilter && s.filterBtnActive]}
          onPress={() => { setStatusFilter(""); setPriorityFilter(""); }}
        >
          <Text style={[s.filterText, statusFilter === "" && !priorityFilter && s.filterTextActive]}>
            {t.tickets.all}
          </Text>
        </TouchableOpacity>
        {orgStatuses.map((st) => (
          <TouchableOpacity
            key={st.key}
            style={[s.filterBtn, statusFilter === st.key && !priorityFilter && s.filterBtnActive]}
            onPress={() => { setStatusFilter(st.key); setPriorityFilter(""); }}
          >
            <Text style={[s.filterText, statusFilter === st.key && !priorityFilter && s.filterTextActive]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.filterBtn, priorityFilter === "urgent" && s.filterBtnUrgent]}
          onPress={() => { setPriorityFilter(priorityFilter === "urgent" ? "" : "urgent"); setStatusFilter(""); }}
        >
          <Text style={[s.filterText, priorityFilter === "urgent" && s.filterTextUrgent]}>
            {t.priority["urgent"]}
          </Text>
        </TouchableOpacity>
        {user?.role === "admin" && (
          <TouchableOpacity
            style={[s.filterBtn, scheduledFilter && s.filterBtnScheduled]}
            onPress={() => { setScheduledFilter(!scheduledFilter); setStatusFilter(""); setPriorityFilter(""); }}
          >
            <Text style={[s.filterText, scheduledFilter && s.filterTextScheduled]}>
              {t.tickets.scheduled}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(ticket) => String(ticket.id)}
          renderItem={renderTicket}
          contentContainerStyle={[s.list, { paddingBottom: Platform.OS === "web" ? 100 : 0 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>{t.tickets.noTickets}</Text>
            </View>
          }
          scrollEnabled
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    searchBar: {
      flexDirection: "row", alignItems: "center",
      margin: 16, paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: colors.card, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_400Regular" },
    filtersRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8, flexWrap: "wrap" },
    filterBtn: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterBtnUrgent: { backgroundColor: colors.destructive, borderColor: colors.destructive },
    filterBtnScheduled: { backgroundColor: "#e65100", borderColor: "#e65100" },
    filterText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    filterTextActive: { color: colors.primaryForeground },
    filterTextUrgent: { color: "#fff" },
    filterTextScheduled: { color: "#fff" },
    list: { padding: 16, paddingTop: 8 },
    card: {
      backgroundColor: colors.card, borderRadius: 12, padding: 16,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border, gap: 8,
    },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    priorityBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },
    priorityText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    ticketId: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    title: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    meta: { flexDirection: "row", gap: 14 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    cardResolved: { borderLeftWidth: 3, borderLeftColor: colors.success },
    cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardBottomRight: { flexDirection: "column", alignItems: "flex-end", gap: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.muted, borderRadius: 6 },
    statusText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    noteChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.success + "18",
      paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    },
    noteChipText: { fontSize: 10, color: colors.success, fontFamily: "Inter_600SemiBold" },
    assignee: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    empty: { alignItems: "center", paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
  });
