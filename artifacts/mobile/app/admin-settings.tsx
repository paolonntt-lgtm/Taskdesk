import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
  Platform, KeyboardAvoidingView, Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, apiPut, apiPost, apiPatch } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";

type SectionKey = "groups" | "locations" | "categories";
type OrganizationSettings = {
  name: string;
  businessType: string | null;
  clientsEnabled: boolean;
  workedTimeEnabled: boolean;
  timeTrackingModuleEnabled: boolean;
  entitySingular: string | null;
  entityPlural: string | null;
};

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
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const s = styles(colors);

  const [groups, setGroups] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const [nameError, setNameError] = useState("");
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [organizationError, setOrganizationError] = useState("");

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
      const [g, l, c, org] = await Promise.all([
        apiGet<{ value: string[] }>(API_PATH.groups),
        apiGet<{ value: string[] }>(API_PATH.locations),
        apiGet<{ value: string[] }>(API_PATH.categories),
        apiGet<OrganizationSettings>("/settings/organization"),
      ]);
      setGroups(g.value ?? []);
      setLocations(l.value ?? []);
      const cats = c.value ?? [];
      setCategories([...cats].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
      setOrganization(org);
    } catch {
      Alert.alert(t.adminSettings.error, t.adminSettings.errorSave);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { if (user?.role === "admin" && user.organizationId != null) void load(); }, [load, user?.role, user?.organizationId]);

  const saveOrganization = async () => {
    if (!organization) return;
    if (organization.name.trim().length < 2) {
      setOrganizationError(t.adminSettings.organizationNameError);
      return;
    }
    setOrganizationSaving(true);
    setOrganizationError("");
    try {
      const updated = await apiPatch<OrganizationSettings>("/settings/organization", organization);
      setOrganization(updated);
      queryClient.setQueryData(["mobile-organization-settings", user?.organizationId], updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.adminSettings.saved, t.adminSettings.organizationSaved);
    } catch (err: any) {
      setOrganizationError(err.message || t.adminSettings.errorSave);
    } finally {
      setOrganizationSaving(false);
    }
  };

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
    if (Platform.OS === "android" && Constants.appOwnership === "expo") {
      Alert.alert(t.adminSettings.error, t.adminSettings.testPushExpoGoAndroid);
      return;
    }
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
        Alert.alert(t.adminSettings.error, msg ? `${t.adminSettings.testPushError}\n\n${msg}` : t.adminSettings.testPushError);
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

  if (user?.role !== "admin" || user.organizationId == null) {
    return <View style={s.center}><Text style={s.emptyText}>{user?.role === "admin" ? t.adminSettings.organizationRequired : t.adminSettings.adminOnly}</Text></View>;
  }

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
        {organization && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={[s.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="home" size={16} color={colors.primary} />
              </View>
              <Text style={s.sectionTitle}>{t.adminSettings.organization}</Text>
            </View>
            <View style={s.card}>
              <View style={s.orgField}>
                <Text style={s.orgLabel}>{t.adminSettings.organizationName}</Text>
                <TextInput
                  style={s.orgInput}
                  value={organization.name}
                  onChangeText={(name) => setOrganization((current) => current ? { ...current, name } : current)}
                  placeholder={t.adminSettings.organizationName}
                  placeholderTextColor={colors.mutedForeground}
                  editable={!organizationSaving}
                />
              </View>
              {organization.clientsEnabled && (
                <>
                  <View style={s.orgField}>
                    <Text style={s.orgLabel}>{t.adminSettings.entitySingular}</Text>
                    <TextInput
                      style={s.orgInput}
                      value={organization.entitySingular ?? ""}
                      onChangeText={(entitySingular) => setOrganization((current) => current ? { ...current, entitySingular } : current)}
                      placeholder={t.adminSettings.entitySingularPlaceholder}
                      placeholderTextColor={colors.mutedForeground}
                      editable={!organizationSaving}
                    />
                  </View>
                  <View style={s.orgField}>
                    <Text style={s.orgLabel}>{t.adminSettings.entityPlural}</Text>
                    <TextInput
                      style={s.orgInput}
                      value={organization.entityPlural ?? ""}
                      onChangeText={(entityPlural) => setOrganization((current) => current ? { ...current, entityPlural } : current)}
                      placeholder={t.adminSettings.entityPluralPlaceholder}
                      placeholderTextColor={colors.mutedForeground}
                      editable={!organizationSaving}
                    />
                  </View>
                </>
              )}
              <Text style={s.orgLabel}>{t.adminSettings.businessType}</Text>
              <View style={s.businessTypes}>
                {[
                  ["it_support", t.adminSettings.businessIT],
                  ["professional_studio", t.adminSettings.businessStudio],
                  ["agency", t.adminSettings.businessAgency],
                  ["other", t.adminSettings.businessOther],
                ].map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setOrganization((current) => current ? { ...current, businessType: value } : current)}
                    style={[s.businessType, organization.businessType === value && s.businessTypeActive]}
                    disabled={organizationSaving}
                  >
                    <Text style={[s.businessTypeText, organization.businessType === value && s.businessTypeTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.orgSwitchRow}>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.clientsEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.clientsEnabledHelp}</Text>
                </View>
                <Switch
                  value={organization.clientsEnabled}
                  onValueChange={(clientsEnabled) => setOrganization((current) => current ? { ...current, clientsEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View style={s.orgSwitchRow}>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.workedTimeEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.workedTimeEnabledHelp}</Text>
                </View>
                <Switch
                  value={organization.workedTimeEnabled}
                  onValueChange={(workedTimeEnabled) => setOrganization((current) => current ? { ...current, workedTimeEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View style={s.orgSwitchRow}>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.timeTrackingModuleEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.timeTrackingModuleEnabledHelp}</Text>
                </View>
                <Switch
                  value={organization.timeTrackingModuleEnabled}
                  onValueChange={(timeTrackingModuleEnabled) => setOrganization((current) => current ? { ...current, timeTrackingModuleEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              {organizationError ? <Text style={s.orgError}>{organizationError}</Text> : null}
              <TouchableOpacity style={s.orgSaveBtn} onPress={() => void saveOrganization()} disabled={organizationSaving} activeOpacity={0.8}>
                {organizationSaving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="save" size={15} color="#fff" />}
                <Text style={s.addBtnText}>{organizationSaving ? t.adminSettings.saving : t.adminSettings.saveOrganization}</Text>
              </TouchableOpacity>
              {organization.timeTrackingModuleEnabled && (
                <TouchableOpacity
                  style={[s.orgSaveBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]}
                  onPress={() => router.push("/time-report")}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  testID="open-time-report"
                >
                  <Feather name="bar-chart-2" size={15} color={colors.primary} />
                  <Text style={[s.addBtnText, { color: colors.primary }]}>{lang === "it" ? "Apri rendiconto ore" : "Open hours report"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

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
    orgField: { gap: 6 },
    orgLabel: { color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" },
    orgDescription: { color: colors.mutedForeground, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
    orgInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14, fontFamily: "Inter_400Regular" },
    businessTypes: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    businessType: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.card },
    businessTypeActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    businessTypeText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" },
    businessTypeTextActive: { color: colors.primary },
    orgSwitchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    orgSwitchText: { flex: 1, gap: 3 },
    orgError: { color: colors.destructive, fontSize: 12, fontFamily: "Inter_400Regular" },
    orgSaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 11 },

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
