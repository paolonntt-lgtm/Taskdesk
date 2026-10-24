import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiDelete, apiGet, apiPost, apiPut } from "@/utils/api";

type CalendarItem = {
  type: "ticket" | "appointment";
  id: number;
  title: string;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isAllDay?: boolean;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localDateTimeValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const itemTime = (item: CalendarItem) => new Date(item.startsAt || `${item.date}T00:00:00`).getTime();

export default function CalendarScreen() {
  const c = useColors();
  const { lang, t } = useLanguage();
  const it = lang === "it";
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;
  const todayKey = dateKey(new Date());
  const qc = useQueryClient();
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["mobile-calendar", year, monthNumber],
    queryFn: () => apiGet<CalendarItem[]>(`/calendar?year=${year}&month=${monthNumber}`),
  });
  const itemsByDate = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of data) {
      const list = result.get(item.date) ?? [];
      list.push(item);
      result.set(item.date, list);
    }
    return result;
  }, [data]);
  const gridDays = useMemo(() => {
    const firstWeekday = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day < 1 || day > daysInMonth ? null : day;
    });
  }, [year, monthNumber]);
  const selectedItems = useMemo(
    () => [...(itemsByDate.get(selectedDate) ?? [])].sort((a, b) => itemTime(a) - itemTime(b)),
    [itemsByDate, selectedDate],
  );
  const selectedTickets = selectedItems.filter((item) => item.type === "ticket");
  const selectedAppointments = selectedItems.filter((item) => item.type === "appointment");
  const formatSelectedDate = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(it ? "it-IT" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const openForm = (item?: CalendarItem) => {
    setEditing(item ?? null);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    const date = item?.startsAt ? new Date(item.startsAt) : new Date(`${selectedDate}T09:00:00`);
    setStartsAt(localDateTimeValue(date));
    setFormOpen(true);
  };
  const save = async () => {
    if (!title.trim() || !startsAt) return;
    setSaving(true);
    try {
      const body = { title: title.trim(), description: description.trim() || null, startsAt: new Date(startsAt).toISOString(), endsAt: null, assignedTo: null };
      if (editing) await apiPut(`/appointments/${editing.id}`, body);
      else await apiPost("/appointments", body);
      await qc.invalidateQueries({ queryKey: ["mobile-calendar"] });
      setFormOpen(false);
    } catch {
      Alert.alert(t.calendar.error, t.calendar.errorSave);
    } finally {
      setSaving(false);
    }
  };
  const remove = (item: CalendarItem) => Alert.alert(t.calendar.deleteConfirmTitle, item.title, [
    { text: t.calendar.cancel, style: "cancel" },
    {
      text: t.calendar.delete,
      style: "destructive",
      onPress: async () => {
        try {
          await apiDelete(`/appointments/${item.id}`);
          await qc.invalidateQueries({ queryKey: ["mobile-calendar"] });
        } catch {
          Alert.alert(t.calendar.error, t.calendar.errorDelete);
        }
      },
    },
  ]);
  const changeMonth = (offset: number) => {
    const nextMonth = new Date(year, month.getMonth() + offset, 1);
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };
  const s = styles(c);

  return <ScrollView style={s.root} contentContainerStyle={s.content}>
    <View style={s.heading}>
      <Text style={s.title}>{t.calendar.title}</Text>
      <Pressable accessibilityRole="button" testID="calendar-add-appointment" style={s.add} onPress={() => openForm()}>
        <Feather name="plus" size={18} color={c.primaryForeground} />
        <Text style={s.addText}>{t.calendar.addAppointment}</Text>
      </Pressable>
    </View>

    <View style={s.calendarCard}>
      <View style={s.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={it ? "Mese precedente" : "Previous month"} testID="calendar-previous-month" onPress={() => changeMonth(-1)} style={s.icon}>
          <Feather name="chevron-left" size={22} color={c.primary} />
        </Pressable>
        <Text style={s.month}>{month.toLocaleDateString(it ? "it-IT" : "en-US", { month: "long", year: "numeric" })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={it ? "Mese successivo" : "Next month"} testID="calendar-next-month" onPress={() => changeMonth(1)} style={s.icon}>
          <Feather name="chevron-right" size={22} color={c.primary} />
        </Pressable>
      </View>
      <View style={s.weekdays}>
        {t.calendar.weekdays.map((weekday) => <Text key={weekday} style={s.weekdayHeader}>{weekday}</Text>)}
      </View>
      <View style={s.grid}>
        {gridDays.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={s.dayCell} />;
          const key = dateKey(new Date(year, monthNumber - 1, day));
          const dayItems = itemsByDate.get(key) ?? [];
          const hasTickets = dayItems.some((item) => item.type === "ticket");
          const hasAppointments = dayItems.some((item) => item.type === "appointment");
          const selected = key === selectedDate;
          const today = key === todayKey;
          const description = [
            day,
            hasTickets ? t.calendar.ticketsLegend : "",
            hasAppointments ? t.calendar.appointmentsLegend : "",
          ].filter(Boolean).join(", ");
          return <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={description}
            accessibilityState={{ selected }}
            testID={`calendar-day-${key}`}
            onPress={() => setSelectedDate(key)}
            style={[s.dayCell, selected && s.selectedDayCell, today && !selected && s.todayCell]}
          >
            <Text style={[s.dayNumber, selected && s.selectedDayNumber]}>{day}</Text>
            <View style={s.markers}>
              {hasTickets && <View style={[s.marker, { backgroundColor: c.primary }]} />}
              {hasAppointments && <View style={[s.marker, { backgroundColor: c.success }]} />}
            </View>
          </Pressable>;
        })}
      </View>
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.marker, { backgroundColor: c.primary }]} /><Text style={s.legendText}>{t.calendar.ticketsLegend}</Text></View>
        <View style={s.legendItem}><View style={[s.marker, { backgroundColor: c.success }]} /><Text style={s.legendText}>{t.calendar.appointmentsLegend}</Text></View>
      </View>
      <Pressable style={s.todayButton} onPress={() => {
        const today = new Date();
        setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDate(dateKey(today));
      }}>
        <Feather name="corner-up-left" size={14} color={c.primary} />
        <Text style={s.todayText}>{t.calendar.today}</Text>
      </Pressable>
    </View>

    {isLoading && <View style={s.loading}><ActivityIndicator color={c.primary} /><Text style={s.muted}>{t.calendar.loading}</Text></View>}
    {error && <View style={s.errorBox}>
      <Text style={s.errorText}>{t.calendar.loadError}</Text>
      <Pressable accessibilityRole="button" onPress={() => void refetch()}><Text style={s.retry}>{t.calendar.retry}</Text></Pressable>
    </View>}

    <View style={s.agendaHeading}>
      <View style={s.agendaIcon}><Feather name="calendar" size={17} color={c.primary} /></View>
      <View style={s.agendaHeaderText}>
        <Text style={s.agendaTitle}>{t.calendar.selectedDay}</Text>
        <Text style={s.selectedDate}>{formatSelectedDate(selectedDate)}</Text>
      </View>
    </View>

    <View style={s.section}>
      <View style={s.sectionHeading}>
        <View style={[s.sectionDot, { backgroundColor: c.primary }]} />
        <Text style={s.sectionTitle}>{t.calendar.ticketsLegend}</Text>
        <Text style={s.count}>{selectedTickets.length}</Text>
      </View>
      {selectedTickets.length === 0
        ? <Text style={s.empty}>{t.calendar.noTickets}</Text>
        : selectedTickets.map((item) => <AgendaItem key={`ticket-${item.id}`} item={item} c={c} s={s} t={t} it={it} onPress={() => router.push(`/ticket/${item.id}` as any)} />)}
    </View>

    <View style={s.section}>
      <View style={s.sectionHeading}>
        <View style={[s.sectionDot, { backgroundColor: c.success }]} />
        <Text style={s.sectionTitle}>{t.calendar.appointmentsLegend}</Text>
        <Text style={s.count}>{selectedAppointments.length}</Text>
      </View>
      {selectedAppointments.length === 0
        ? <Text style={s.empty}>{t.calendar.noAppointments}</Text>
        : selectedAppointments.map((item) => <AgendaItem key={`appointment-${item.id}`} item={item} c={c} s={s} t={t} it={it} onPress={() => openForm(item)} onLongPress={() => remove(item)} />)}
    </View>

    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
      <View style={s.overlay}><View style={s.modal}>
        <Text style={s.modalTitle}>{editing ? t.calendar.editAppointment : t.calendar.newAppointment}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder={t.calendar.titlePlaceholder} placeholderTextColor={c.mutedForeground} style={s.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder={t.calendar.descriptionField} placeholderTextColor={c.mutedForeground} style={[s.input, s.multiline]} multiline />
        <TextInput value={startsAt} onChangeText={setStartsAt} placeholder={t.calendar.dateTimePlaceholder} placeholderTextColor={c.mutedForeground} style={s.input} />
        <View style={s.modalActions}>
          <Pressable onPress={() => setFormOpen(false)} style={s.secondary}><Text style={s.modalActionText}>{t.calendar.cancel}</Text></Pressable>
          <Pressable onPress={() => void save()} disabled={saving || !title.trim() || !startsAt} style={[s.primaryButton, (saving || !title.trim() || !startsAt) && s.disabledButton]}>
            <Text style={s.primaryText}>{saving ? t.calendar.saving : t.calendar.save}</Text>
          </Pressable>
        </View>
        {editing && <Pressable onPress={() => { setFormOpen(false); remove(editing); }} style={s.delete}><Text style={s.deleteText}>{t.calendar.deleteAppointment}</Text></Pressable>}
      </View></View>
    </Modal>
  </ScrollView>;
}

function AgendaItem({
  item, c, s, t, it, onPress, onLongPress,
}: {
  item: CalendarItem;
  c: ReturnType<typeof useColors>;
  s: ReturnType<typeof styles>;
  t: ReturnType<typeof useLanguage>["t"];
  it: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const time = item.isAllDay
    ? t.calendar.allDay
    : item.startsAt
      ? new Date(item.startsAt).toLocaleTimeString(it ? "it-IT" : "en-US", { hour: "2-digit", minute: "2-digit" })
      : "";
  return <Pressable
    accessibilityRole="button"
    testID={`calendar-item-${item.type}-${item.id}`}
    style={s.card}
    onPress={onPress}
    onLongPress={onLongPress}
  >
    <View style={[s.timeBox, { backgroundColor: item.type === "ticket" ? c.secondary : c.muted }]}>
      <Text style={[s.timeText, { color: item.type === "ticket" ? c.secondaryForeground : c.foreground }]}>{time || "—"}</Text>
    </View>
    <View style={s.main}>
      <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={s.itemType}>{item.type === "ticket" ? t.calendar.ticket : t.calendar.appointment}</Text>
    </View>
    <Feather name={item.type === "ticket" ? "tool" : "calendar"} size={17} color={item.type === "ticket" ? c.primary : c.success} />
  </Pressable>;
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14, paddingBottom: 100 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: c.foreground, fontSize: 24, fontFamily: "Inter_700Bold" },
  add: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, backgroundColor: c.primary, paddingHorizontal: 11, paddingVertical: 9 },
  addText: { color: c.primaryForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  calendarCard: { padding: 12, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 16, gap: 8 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { color: c.foreground, fontSize: 17, textTransform: "capitalize", fontFamily: "Inter_600SemiBold" },
  icon: { padding: 7 },
  weekdays: { flexDirection: "row", marginBottom: 2 },
  weekdayHeader: { flex: 1, textAlign: "center", color: c.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.2857%", height: 43, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: "transparent", gap: 3 },
  selectedDayCell: { backgroundColor: c.primary },
  todayCell: { borderColor: c.primary },
  dayNumber: { color: c.foreground, fontSize: 14, fontFamily: "Inter_500Medium" },
  selectedDayNumber: { color: c.primaryForeground, fontFamily: "Inter_700Bold" },
  markers: { height: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  marker: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 5 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: c.mutedForeground, fontSize: 11 },
  todayButton: { alignSelf: "flex-end", flexDirection: "row", gap: 4, alignItems: "center", paddingVertical: 4, paddingHorizontal: 2 },
  todayText: { color: c.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, padding: 8 },
  muted: { color: c.mutedForeground },
  errorBox: { borderRadius: 12, padding: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.destructive, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  errorText: { flex: 1, color: c.destructive, fontSize: 13 },
  retry: { color: c.primary, fontFamily: "Inter_600SemiBold" },
  agendaHeading: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 3 },
  agendaIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: c.secondary, alignItems: "center", justifyContent: "center" },
  agendaHeaderText: { flex: 1, gap: 2 },
  agendaTitle: { color: c.mutedForeground, fontSize: 12 },
  selectedDate: { color: c.foreground, fontSize: 17, textTransform: "capitalize", fontFamily: "Inter_700Bold" },
  section: { gap: 9 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { color: c.foreground, flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  count: { minWidth: 22, textAlign: "center", overflow: "hidden", color: c.mutedForeground, backgroundColor: c.muted, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11 },
  empty: { color: c.mutedForeground, paddingVertical: 6, fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: 11, padding: 12, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 13 },
  timeBox: { minWidth: 56, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, borderRadius: 9 },
  timeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  main: { flex: 1, gap: 4 },
  itemTitle: { color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  itemType: { color: c.mutedForeground, fontSize: 11 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: c.card, borderRadius: 18, padding: 18, gap: 12 },
  modalTitle: { color: c.foreground, fontSize: 19, fontFamily: "Inter_700Bold" },
  input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 10, color: c.foreground, paddingHorizontal: 12, paddingVertical: 11 },
  multiline: { minHeight: 78, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  primaryButton: { backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  primaryText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  disabledButton: { opacity: 0.55 },
  secondary: { paddingHorizontal: 15, paddingVertical: 11 },
  modalActionText: { color: c.foreground },
  delete: { alignSelf: "flex-start", paddingVertical: 5 },
  deleteText: { color: c.destructive, fontSize: 13 },
});
