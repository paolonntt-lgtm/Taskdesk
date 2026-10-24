import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiDelete, apiGet, apiPost, apiPut } from "@/utils/api";
import {
  dateKey,
  getCalendarDayMarkers,
  getItemsForDate,
  getMonthGridDays,
  getMonthSelection,
  groupCalendarItemsByDate,
  type CalendarItem,
} from "@/utils/calendar";

const localDateTimeValue = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const localDateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const dateKeyFromTimestamp = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

const isValidDateKey = (key: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [year, month, day] = key.split("-").map(Number);
  const date = localDateFromKey(key);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const formatDateKey = (key: string, locale: string) => localDateFromKey(key).toLocaleDateString(locale, { dateStyle: "medium" });

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
  const [isAllDay, setIsAllDay] = useState(false);
  const [allDayStartDate, setAllDayStartDate] = useState(selectedDate);
  const [allDayEndDate, setAllDayEndDate] = useState(selectedDate);
  const [activeDateField, setActiveDateField] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;
  const todayKey = dateKey(new Date());
  const qc = useQueryClient();
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["mobile-calendar", year, monthNumber],
    queryFn: () => apiGet<CalendarItem[]>(`/calendar?year=${year}&month=${monthNumber}`),
  });
  const itemsByDate = useMemo(() => groupCalendarItemsByDate(data), [data]);
  const gridDays = useMemo(() => getMonthGridDays(year, monthNumber), [year, monthNumber]);
  const selectedItems = useMemo(
    () => getItemsForDate(itemsByDate, selectedDate),
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
    const allDay = item?.isAllDay ?? false;
    setIsAllDay(allDay);
    setActiveDateField(null);
    if (allDay) {
      const startDate = dateKeyFromTimestamp(item?.startsAt) || selectedDate;
      setAllDayStartDate(startDate);
      setAllDayEndDate(dateKeyFromTimestamp(item?.endsAt) || startDate);
      setStartsAt("");
    } else {
      const date = item?.startsAt ? new Date(item.startsAt) : new Date(`${selectedDate}T09:00:00`);
      setStartsAt(localDateTimeValue(date));
      setAllDayStartDate(dateKey(date));
      setAllDayEndDate(dateKey(date));
    }
    setFormOpen(true);
  };

  const updateAllDayDate = (field: "start" | "end", date: Date) => {
    const key = dateKey(date);
    if (field === "start") {
      setAllDayStartDate(key);
      setAllDayEndDate((current) => current < key ? key : current);
    } else {
      setAllDayEndDate(key);
    }
  };

  const handleAllDayPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") {
      if (Platform.OS !== "ios") setActiveDateField(null);
      return;
    }
    if (date && activeDateField) updateAllDayDate(activeDateField, date);
    if (Platform.OS !== "ios") setActiveDateField(null);
  };

  const toggleAllDay = (next: boolean) => {
    setActiveDateField(null);
    if (next) {
      const key = startsAt.slice(0, 10) || selectedDate;
      setAllDayStartDate(key);
      setAllDayEndDate(key);
    } else {
      setStartsAt(`${allDayStartDate}T09:00`);
    }
    setIsAllDay(next);
  };

  const save = async () => {
    const validDates = isAllDay
      ? isValidDateKey(allDayStartDate) && isValidDateKey(allDayEndDate) && allDayEndDate >= allDayStartDate
      : Boolean(startsAt);
    if (!title.trim() || !validDates) return;
    setSaving(true);
    try {
      const body = isAllDay
        ? {
            title: title.trim(),
            description: description.trim() || null,
            startsAt: `${allDayStartDate}T00:00:00.000Z`,
            endsAt: `${allDayEndDate}T00:00:00.000Z`,
            isAllDay: true,
            assignedTo: null,
          }
        : {
            title: title.trim(),
            description: description.trim() || null,
            startsAt: new Date(startsAt).toISOString(),
            endsAt: null,
            isAllDay: false,
            assignedTo: null,
          };
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
    const next = getMonthSelection(month, offset);
    setMonth(next.month);
    setSelectedDate(next.selectedDate);
  };
  const canSave = Boolean(title.trim()) && (isAllDay
    ? isValidDateKey(allDayStartDate) && isValidDateKey(allDayEndDate) && allDayEndDate >= allDayStartDate
    : Boolean(startsAt));
  const activeDateKey = activeDateField === "end" ? allDayEndDate : allDayStartDate;
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
          const { hasTickets, hasAppointments } = getCalendarDayMarkers(dayItems);
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
      <View style={s.agendaCounts}>
        <View style={s.legendItem}>
          <View style={[s.marker, { backgroundColor: c.primary }]} />
          <Text style={s.legendText}>{t.calendar.ticketsLegend}</Text>
          <Text style={s.count}>{selectedTickets.length}</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.marker, { backgroundColor: c.success }]} />
          <Text style={s.legendText}>{t.calendar.appointmentsLegend}</Text>
          <Text style={s.count}>{selectedAppointments.length}</Text>
        </View>
      </View>
      {selectedItems.length === 0
        ? <>
            <Text style={s.empty}>{t.calendar.noTickets}</Text>
            <Text style={s.empty}>{t.calendar.noAppointments}</Text>
          </>
        : selectedItems.map((item) => <AgendaItem
            key={`${item.type}-${item.id}`}
            item={item}
            c={c}
            s={s}
            t={t}
            it={it}
            onPress={() => item.type === "ticket" ? router.push(`/ticket/${item.id}` as any) : openForm(item)}
            onLongPress={item.type === "appointment" ? () => remove(item) : undefined}
          />)}
    </View>

    <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
      <View style={s.overlay}><View style={s.modal}>
        <Text style={s.modalTitle}>{editing ? t.calendar.editAppointment : t.calendar.newAppointment}</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder={t.calendar.titlePlaceholder} placeholderTextColor={c.mutedForeground} style={s.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder={t.calendar.descriptionField} placeholderTextColor={c.mutedForeground} style={[s.input, s.multiline]} multiline />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isAllDay }}
          testID="calendar-all-day-toggle"
          onPress={() => toggleAllDay(!isAllDay)}
          style={s.allDayToggle}
        >
          <View style={[s.checkbox, isAllDay && s.checkboxChecked]}>
            {isAllDay && <Feather name="check" size={13} color={c.primaryForeground} />}
          </View>
          <Text style={s.allDayToggleText}>{t.calendar.allDayAppointment}</Text>
        </Pressable>
        {isAllDay ? <>
          <View style={s.dateFields}>
            {(["start", "end"] as const).map((field) => {
              const key = field === "start" ? allDayStartDate : allDayEndDate;
              const label = field === "start" ? t.calendar.startDateField : t.calendar.endDateField;
              return <View key={field} style={s.dateField}>
                <Text style={s.dateLabel}>{label}</Text>
                {Platform.OS === "web"
                  ? <TextInput
                      accessibilityLabel={label}
                      testID={`calendar-all-day-${field}-date`}
                      value={key}
                      onChangeText={(value) => {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) updateAllDayDate(field, localDateFromKey(value));
                        else if (field === "start") setAllDayStartDate(value);
                        else setAllDayEndDate(value);
                      }}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={c.mutedForeground}
                      style={s.input}
                    />
                  : <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${label}: ${formatDateKey(key, it ? "it-IT" : "en-US")}`}
                      testID={`calendar-all-day-${field}-date`}
                      onPress={() => setActiveDateField(field)}
                      style={s.dateButton}
                    >
                      <Feather name="calendar" size={16} color={c.primary} />
                      <Text style={s.dateButtonText}>{formatDateKey(key, it ? "it-IT" : "en-US")}</Text>
                    </Pressable>}
              </View>;
            })}
          </View>
          {activeDateField && Platform.OS !== "web" && <>
            <DateTimePicker
              value={localDateFromKey(activeDateKey)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={activeDateField === "end" ? localDateFromKey(allDayStartDate) : undefined}
              onChange={handleAllDayPickerChange}
            />
            {Platform.OS === "ios" && <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.calendar.done}
              onPress={() => setActiveDateField(null)}
              style={s.pickerDone}
            >
              <Feather name="check" size={18} color={c.primary} />
              <Text style={s.pickerDoneText}>{t.calendar.done}</Text>
            </Pressable>}
          </>}
        </> : <TextInput value={startsAt} onChangeText={setStartsAt} placeholder={t.calendar.dateTimePlaceholder} placeholderTextColor={c.mutedForeground} style={s.input} />}
        <View style={s.modalActions}>
          <Pressable onPress={() => setFormOpen(false)} style={s.secondary}><Text style={s.modalActionText}>{t.calendar.cancel}</Text></Pressable>
          <Pressable onPress={() => void save()} disabled={saving || !canSave} style={[s.primaryButton, (saving || !canSave) && s.disabledButton]}>
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
      <Text style={s.itemType}>{item.type === "ticket" ? t.calendar.ticket : item.isAllDay ? `${t.calendar.appointment} · ${t.calendar.allDay}` : t.calendar.appointment}</Text>
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
  agendaCounts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
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
  allDayToggle: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 3 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
  allDayToggleText: { color: c.foreground, fontSize: 14, fontFamily: "Inter_500Medium" },
  dateFields: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, gap: 6 },
  dateLabel: { color: c.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" },
  dateButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, borderRadius: 10, paddingHorizontal: 10 },
  dateButtonText: { color: c.foreground, fontSize: 13, flexShrink: 1 },
  pickerDone: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5 },
  pickerDoneText: { color: c.primary, fontFamily: "Inter_600SemiBold" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  primaryButton: { backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  primaryText: { color: c.primaryForeground, fontFamily: "Inter_600SemiBold" },
  disabledButton: { opacity: 0.55 },
  secondary: { paddingHorizontal: 15, paddingVertical: 11 },
  modalActionText: { color: c.foreground },
  delete: { alignSelf: "flex-start", paddingVertical: 5 },
  deleteText: { color: c.destructive, fontSize: 13 },
});
