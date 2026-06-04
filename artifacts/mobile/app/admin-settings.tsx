import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPut, apiPost } from "@/utils/api";
import * as Haptics from "expo-haptics";

type SectionKey = "groups" | "locations" | "categories";

const API_PATH: Record<SectionKey, string> = {
  groups: "/settings/groups",
  locations: "/settings/locations",
  categories: "/settings/categories",
};

interface ModalState {
  visible: boolean;
  section: SectionKey;
  mode: "add" | "edit";
  editIndex: number | null;
  value: string;
}

const EMPTY_MODAL: ModalState = {
  visible: false,
  section: "groups",
  mode: "add",
  editIndex: null,
  value: "",
};

export default function AdminSettingsScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const s = styles(colors);

  const [groups, setGroups] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const [nameError, setNameError] = useState("");
  const [testPushLoading, setTestPushLoading] = useState(false);

  const dataMap: Record<SectionKey, string[]> = {
    groups,
    locations,
    categories,
  };

  const setters: Record<SectionKey, React.Dispatch<React.SetStateAction<string[]>>> = {
    groups: setGroups,
    locations: setLocations,
    categories: setCategories,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, l, c] = await Promise.all([
        apiGet<{ value: string[] }>(API_PATH.groups),
        apiGet<{ value: string[] }>(API_PATH.locations),
        apiGet<{ value: string[] }>(API_PATH.categories),
      ]);
      setGroups(g.value ?? []);
      setLocations(l.value ?? []);
      setCategories(c.value ?? []);
    } catch {
      Alert.alert(t.adminSettings.error, t.adminSettings.errorSave);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const openAdd = (section: SectionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNameError("");
    setModal({ visible: true, section, mode: "add", editIndex: null, value: "" });
  };

  const openEdit = (section: SectionKey, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNameError("");
    setModal({
      visible: true,
      section,
      mode: "edit",
      editIndex: index,
      value: dataMap[section][index],
    });
  };

  const closeModal = () => setModal(EMPTY_MODAL);

  const handleSave = async () => {
    const trimmed = modal.value.trim();
    if (!trimmed) {
      setNameError(t.adminSettings.emptyName);
      return;
    }

    const current = [...dataMap[modal.section]];
    if (modal.mode === "add") {
      current.push(trimmed);
    } else if (modal.editIndex !== null) {
      current[modal.editIndex] = trimmed;
    }

    setSaving(modal.section);
    try {
      const result = await apiPut<{ value: string[] }>(API_PATH[modal.section], { value: current });
      setters[modal.section](result.value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
    } catch (err: any) {
      Alert.alert(t.adminSettings.error, err.message || t.adminSettings.errorSave);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = (section: SectionKey, index: number) => {
    const current = dataMap[section];
    if (current.length <= 1) {
      Alert.alert(t.adminSettings.error, t.adminSettings.cantDeleteLast);
      return;
    }
    const item = current[index];
    Alert.alert(
      t.adminSettings.deleteTitle,
      `${t.adminSettings.deleteMsg} "${item}"?`,
      [
        { text: t.adminSettings.cancel, style: "cancel" },
        {
          text: t.adminSettings.deleteConfirm,
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const updated = current.filter((_, i) => i !== index);
            setSaving(section);
            try {
              const result = await apiPut<{ value: string[] }>(API_PATH[section], { value: updated });
              setters[section](result.value);
            } catch (err: any) {
              Alert.alert(t.adminSettings.error, err.message || t.adminSettings.errorSave);
            } finally {
              setSaving(null);
            }
          },
        },
      ]
    );
  };

  const handleTestPush = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTestPushLoading(true);
    try {
      await apiPost("/notifications/test-push", {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("TaskDesk", t.adminSettings.testPushSuccess);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("No push token")) {
        Alert.alert(t.adminSettings.error, t.adminSettings.testPushNoToken);
      } else {
        Alert.alert(t.adminSettings.error, t.adminSettings.testPushError);
      }
    } finally {
      setTestPushLoading(false);
    }
  };

  const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string }[] = [
    { key: "groups", label: t.adminSettings.groups, icon: "briefcase", color: colors.primary },
    { key: "locations", label: t.adminSettings.locations, icon: "map-pin", color: "#0d9488" },
    { key: "categories", label: t.adminSettings.categories, icon: "tag", color: "#7c3aed" },
  ];

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.testPushSection}>
          <View style={s.sectionTitleRow}>
            <View style={[s.sectionIcon, { backgroundColor: "#f59e0b18" }]}>
              <Feather name="bell" size={16} color="#f59e0b" />
            </View>
            <Text style={s.sectionTitle}>{t.adminSettings.testPushBtn}</Text>
          </View>
          <TouchableOpacity
            style={[s.testPushBtn, testPushLoading && { opacity: 0.6 }]}
            onPress={handleTestPush}
            activeOpacity={0.8}
            disabled={testPushLoading}
          >
            {testPushLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="send" size={15} color="#fff" />
                <Text style={s.testPushBtnText}>{t.adminSettings.testPushBtn}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {SECTIONS.map((section) => {
          const items = dataMap[section.key];
          const isSaving = saving === section.key;
          return (
            <View key={section.key} style={s.section}>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <View style={[s.sectionIcon, { backgroundColor: section.color + "18" }]}>
                    <Feather name={section.icon} size={16} color={section.color} />
                  </View>
                  <Text style={s.sectionTitle}>{section.label}</Text>
                  <Text style={s.sectionCount}>{items.length} {t.adminSettings.itemsCount}</Text>
                </View>
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: section.color }]}
                  onPress={() => openAdd(section.key)}
                  activeOpacity={0.8}
                  disabled={isSaving}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={s.addBtnText}>{t.adminSettings.add}</Text>
                </TouchableOpacity>
              </View>

              <View style={s.card}>
                {isSaving ? (
                  <View style={s.savingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                  </View>
                ) : items.length === 0 ? (
                  <View style={s.emptyRow}>
                    <Text style={s.emptyText}>—</Text>
                  </View>
                ) : (
                  items.map((item, i) => (
                    <View
                      key={`${section.key}-${i}`}
                      style={[s.itemRow, i > 0 && s.itemRowBorder]}
                    >
                      <View style={[s.itemDot, { backgroundColor: section.color + "40" }]} />
                      <Text style={s.itemLabel} numberOfLines={1}>{item}</Text>
                      <View style={s.itemActions}>
                        <TouchableOpacity
                          style={s.iconBtn}
                          onPress={() => openEdit(section.key, i)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.iconBtn}
                          onPress={() => handleDelete(section.key, i)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={15} color={colors.destructive} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={modal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={s.modalCancel}>
                <Text style={s.modalCancelText}>{t.adminSettings.cancel}</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>
                {modal.mode === "add" ? t.adminSettings.addItem : t.adminSettings.rename}
              </Text>
              <TouchableOpacity
                style={[s.modalSaveBtn, saving !== null && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving !== null}
              >
                {saving !== null
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalSaveBtnText}>{t.adminSettings.save}</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={s.modalContent}>
              {modal.section ? (() => {
                const sec = SECTIONS.find((s) => s.key === modal.section)!;
                return (
                  <View style={[s.sectionBadge, { backgroundColor: sec.color + "15" }]}>
                    <Feather name={sec.icon} size={13} color={sec.color} />
                    <Text style={[s.sectionBadgeText, { color: sec.color }]}>{sec.label}</Text>
                  </View>
                );
              })() : null}

              <TextInput
                style={[s.modalInput, nameError ? s.modalInputError : null]}
                value={modal.value}
                onChangeText={(v) => { setModal((m) => ({ ...m, value: v })); setNameError(""); }}
                placeholder={t.adminSettings.namePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              {nameError ? <Text style={s.errorText}>{nameError}</Text> : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    content: { padding: 16, gap: 24 },

    testPushSection: { gap: 10 },
    testPushBtn: {
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
      gap: 8, backgroundColor: "#f59e0b",
      paddingVertical: 13, borderRadius: 12,
    },
    testPushBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

    section: { gap: 10 },
    sectionHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    sectionIcon: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
    },
    sectionTitle: { fontSize: 15, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    sectionCount: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    },
    addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

    card: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    savingRow: { padding: 20, alignItems: "center" },
    emptyRow: { padding: 16, alignItems: "center" },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },

    itemRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    itemDot: { width: 8, height: 8, borderRadius: 4 },
    itemLabel: {
      flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium",
    },
    itemActions: { flexDirection: "row", gap: 4 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 8,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.muted,
    },

    modalRoot: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    modalCancel: { paddingVertical: 4, paddingHorizontal: 2 },
    modalCancelText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    modalSaveBtn: {
      backgroundColor: colors.primary, paddingHorizontal: 16,
      paddingVertical: 7, borderRadius: 20, minWidth: 60, alignItems: "center",
    },
    modalSaveBtnText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" },

    modalContent: { padding: 20, gap: 14 },
    sectionBadge: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    },
    sectionBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    modalInput: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
      fontSize: 16, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    modalInputError: { borderColor: colors.destructive },
    errorText: { fontSize: 12, color: colors.destructive, fontFamily: "Inter_400Regular" },
  });
