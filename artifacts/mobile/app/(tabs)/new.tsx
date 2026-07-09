import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
  Platform, Alert,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiPost, apiGet, PRIORITIES, LOCATIONS } from "@/utils/api";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const PRIORITY_ICONS: Record<string, string> = {
  low: "arrow-down", medium: "minus", high: "arrow-up", urgent: "alert-triangle",
};

export default function NewTicketScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const s = styles(colors);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [priority, setPriority] = useState("medium");
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<{ value: string[] }>("/settings/categories"),
      apiGet<{ value: string | null }>("/settings/default-category"),
    ])
      .then(([catsData, defData]) => {
        const cats = catsData.value ?? [];
        const sorted = [...cats].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        setCategories(sorted);
        const defaultCat = defData.value;
        const preselect = (defaultCat && sorted.includes(defaultCat)) ? defaultCat : sorted[0] ?? "";
        setCategory(preselect);
      })
      .catch(() => {});
  }, []);

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
    try {
      await apiPost("/tickets", { title: title.trim(), description: description.trim(), category, location, priority, resource: resource.trim() || undefined });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-tickets"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle(""); setDescription(""); setResource(""); setPriority("medium");
      router.push("/(tabs)/tickets");
    } catch (e: any) {
      Alert.alert(t.newTicket.errorCreate, e.message || t.newTicket.errorCreateMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

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
          {LOCATIONS.map((l) => (
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

      <TouchableOpacity
        style={[s.btn, loading && s.btnDisabled]}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} size="small" />
        ) : (
          <>
            <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
            <Text style={s.btnText}>{t.newTicket.create}</Text>
          </>
        )}
      </TouchableOpacity>
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
    btn: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 16, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
    },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
