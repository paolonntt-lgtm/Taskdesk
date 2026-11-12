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
import { cacheMobileOrganizationSettings } from "@/utils/optionalTabs";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";

type SectionKey = "groups" | "locations" | "categories";
type SettingsTabKey = "organization" | "modules" | "tickets" | "notifications";
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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [modal, setModal] = useState<ModalState>(EMPTY_MODAL);
  const [nameError, setNameError] = useState("");
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(null);
  const [savedOrganization, setSavedOrganization] = useState<OrganizationSettings | null>(null);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [organizationError, setOrganizationError] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("organization");

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
  const organizationDirty = Boolean(
    organization &&
    savedOrganization &&
    (
      organization.name !== savedOrganization.name ||
      organization.businessType !== savedOrganization.businessType ||
      organization.clientsEnabled !== savedOrganization.clientsEnabled ||
      organization.workedTimeEnabled !== savedOrganization.workedTimeEnabled ||
      organization.timeTrackingModuleEnabled !== savedOrganization.timeTrackingModuleEnabled ||
      organization.entitySingular !== savedOrganization.entitySingular ||
      organization.entityPlural !== savedOrganization.entityPlural
    ),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
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
      setSavedOrganization(org);
    } catch {
      setLoadError(true);
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
      setSavedOrganization(updated);
      cacheMobileOrganizationSettings(queryClient, user?.organizationId, updated);
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
    { key: "locations", label: t.adminSettings.locations, icon: "map-pin", color: colors.accent },
    { key: "categories", label: t.adminSettings.categories, icon: "tag", color: colors.warning },
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

  if (loadError) {
    return (
      <View style={[s.center, s.loadErrorPanel]}>
        <Feather name="alert-circle" size={28} color={colors.destructive} />
        <Text style={s.loadErrorText}>{t.adminSettings.loadError}</Text>
        <TouchableOpacity
          style={s.retryButton}
          onPress={() => void load()}
          accessibilityRole="button"
          testID="admin-settings-retry-load"
        >
          <Feather name="refresh-cw" size={15} color={colors.primaryForeground} />
          <Text style={s.retryText}>{t.adminSettings.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.hero}>
          <View style={s.heroTopline}>
            <View style={s.adminMark}><Feather name="settings" size={13} color={colors.primaryForeground} /></View>
            <Text style={s.eyebrow}>{t.adminSettings.adminSettingsEyebrow}</Text>
          </View>
          <Text style={s.pageTitle}>{t.adminSettings.title}</Text>
          <Text style={s.pageDescription}>{t.adminSettings.mobileIntro}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBar}
          accessibilityRole="tablist"
        >
          {([
            ["organization", t.adminSettings.organizationTab, "home"],
            ["modules", t.adminSettings.modulesTab, "grid"],
            ["tickets", t.adminSettings.ticketDataTab, "tag"],
            ["notifications", t.adminSettings.notificationsTab, "bell"],
          ] as const).map(([key, label, icon], index) => {
            const selected = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                testID={`admin-settings-tab-${key}`}
                onPress={() => setActiveTab(key)}
                style={[s.tab, selected && s.tabActive]}
                activeOpacity={0.78}
              >
                <Text style={[s.tabIndex, selected && s.tabIndexActive]}>{`0${index + 1}`}</Text>
                <View style={s.tabLabelRow}>
                  <Feather name={icon} size={14} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[s.tabText, selected && s.tabTextActive]}>{label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeTab === "organization" && organization && (
          <View style={s.panel} testID="admin-settings-panel-organization">
            <View style={s.panelHeading}>
              <View style={[s.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="home" size={17} color={colors.primary} />
              </View>
              <View style={s.headingCopy}>
                <Text style={s.sectionTitle}>{t.adminSettings.organization}</Text>
                <Text style={s.panelDescription}>{t.adminSettings.organizationDescription}</Text>
              </View>
              <Text style={s.sectionNumber}>01</Text>
            </View>
            <View style={s.card}>
              <View style={s.orgField}>
                <Text style={s.orgLabel}>{t.adminSettings.organizationName}</Text>
                <TextInput
                  style={s.orgInput}
                  testID="admin-settings-org-name"
                  value={organization.name}
                  onChangeText={(name) => setOrganization((current) => current ? { ...current, name } : current)}
                  placeholder={t.adminSettings.organizationName}
                  placeholderTextColor={colors.mutedForeground}
                  editable={!organizationSaving}
                />
              </View>
              <View style={s.divider} />
              <View style={s.orgField}>
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
                      accessibilityRole="button"
                      accessibilityState={{ selected: organization.businessType === value }}
                      onPress={() => setOrganization((current) => current ? { ...current, businessType: value } : current)}
                      style={[s.businessType, organization.businessType === value && s.businessTypeActive]}
                      disabled={organizationSaving}
                    >
                      <Text style={[s.businessTypeText, organization.businessType === value && s.businessTypeTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {organization.clientsEnabled && (
                <View style={s.entityFields}>
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
                </View>
              )}
              {organizationDirty ? <Text style={s.orgUnsaved} testID="admin-settings-unsaved">{t.adminSettings.unsavedChanges}</Text> : null}
              {organizationError ? <Text style={s.orgError}>{organizationError}</Text> : null}
              <TouchableOpacity
                style={[s.orgSaveBtn, !organizationDirty && s.orgSaveBtnDisabled]}
                onPress={() => void saveOrganization()}
                disabled={organizationSaving || !organizationDirty}
                activeOpacity={0.8}
              >
                {organizationSaving ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Feather name="check" size={16} color={colors.primaryForeground} />}
                <Text style={s.saveBtnText}>{organizationSaving ? t.adminSettings.saving : t.adminSettings.saveOrganization}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === "modules" && organization && (
          <View style={s.panel} testID="admin-settings-panel-modules">
            <View style={s.panelHeading}>
              <View style={[s.sectionIcon, { backgroundColor: colors.accent + "20" }]}>
                <Feather name="grid" size={17} color={colors.accent} />
              </View>
              <View style={s.headingCopy}>
                <Text style={s.sectionTitle}>{t.adminSettings.modulesTab}</Text>
                <Text style={s.panelDescription}>{t.adminSettings.modulesDescription}</Text>
              </View>
              <Text style={s.sectionNumber}>02</Text>
            </View>
            <View style={s.card}>
              <View style={s.moduleRow}>
                <View style={[s.moduleGlyph, { backgroundColor: colors.primary + "14" }]}>
                  <Feather name="users" size={17} color={colors.primary} />
                </View>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.clientsEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.clientsEnabledHelp}</Text>
                </View>
                <Switch
                  testID="admin-settings-module-clients"
                  value={organization.clientsEnabled}
                  onValueChange={(clientsEnabled) => setOrganization((current) => current ? { ...current, clientsEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View style={s.moduleDivider} />
              <View style={s.moduleRow}>
                <View style={[s.moduleGlyph, { backgroundColor: colors.accent + "20" }]}>
                  <Feather name="clock" size={17} color={colors.accent} />
                </View>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.workedTimeEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.workedTimeEnabledHelp}</Text>
                </View>
                <Switch
                  testID="admin-settings-module-worked-time"
                  value={organization.workedTimeEnabled}
                  onValueChange={(workedTimeEnabled) => setOrganization((current) => current ? { ...current, workedTimeEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View style={s.moduleDivider} />
              <View style={s.moduleRow}>
                <View style={[s.moduleGlyph, { backgroundColor: colors.warning + "24" }]}>
                  <Feather name="activity" size={17} color={colors.warning} />
                </View>
                <View style={s.orgSwitchText}>
                  <Text style={s.orgLabel}>{t.adminSettings.timeTrackingModuleEnabled}</Text>
                  <Text style={s.orgDescription}>{t.adminSettings.timeTrackingModuleEnabledHelp}</Text>
                </View>
                <Switch
                  testID="admin-settings-module-tasktrack"
                  value={organization.timeTrackingModuleEnabled}
                  onValueChange={(timeTrackingModuleEnabled) => setOrganization((current) => current ? { ...current, timeTrackingModuleEnabled } : current)}
                  disabled={organizationSaving}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              {organizationDirty ? <Text style={s.orgUnsaved} testID="admin-settings-unsaved">{t.adminSettings.unsavedChanges}</Text> : null}
              {organizationError ? <Text style={s.orgError}>{organizationError}</Text> : null}
              <TouchableOpacity
                style={[s.orgSaveBtn, !organizationDirty && s.orgSaveBtnDisabled]}
                onPress={() => void saveOrganization()}
                disabled={organizationSaving || !organizationDirty}
                activeOpacity={0.8}
              >
                {organizationSaving ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Feather name="check" size={16} color={colors.primaryForeground} />}
                <Text style={s.saveBtnText}>{organizationSaving ? t.adminSettings.saving : t.adminSettings.saveOrganization}</Text>
              </TouchableOpacity>
              {organization.timeTrackingModuleEnabled && (
                <TouchableOpacity
                  style={s.reportLink}
                  onPress={() => router.push("/time-report")}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  testID="open-time-report"
                >
                  <View style={s.reportIcon}><Feather name="bar-chart-2" size={16} color={colors.primary} /></View>
                  <Text style={s.reportText}>{lang === "it" ? "Apri rendiconto ore" : "Open hours report"}</Text>
                  <Feather name="arrow-up-right" size={15} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {activeTab === "notifications" && (
          <View style={s.panel} testID="admin-settings-panel-notifications">
            <View style={s.panelHeading}>
              <View style={[s.sectionIcon, { backgroundColor: colors.warning + "24" }]}>
                <Feather name="bell" size={17} color={colors.warning} />
              </View>
              <View style={s.headingCopy}>
                <Text style={s.sectionTitle}>{t.adminSettings.notificationsTab}</Text>
                <Text style={s.panelDescription}>{t.adminSettings.notificationDescription}</Text>
              </View>
              <Text style={s.sectionNumber}>04</Text>
            </View>
            <View style={s.noticeCard}>
              <View style={s.noticeIllustration}>
                <View style={s.noticeSignal} />
                <Feather name="bell" size={23} color={colors.warning} />
              </View>
              <Text style={s.noticeTitle}>{t.adminSettings.testPushBtn}</Text>
              <Text style={s.noticeBody}>{t.adminSettings.notificationDescription}</Text>
              <TouchableOpacity
                style={[s.testPushBtn, testPushLoading && s.buttonBusy]}
                onPress={handleTestPush}
                activeOpacity={0.8}
                disabled={testPushLoading}
                accessibilityRole="button"
                testID="admin-settings-test-push"
              >
                {testPushLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <>
                    <Feather name="send" size={15} color={colors.primaryForeground} />
                    <Text style={s.testPushBtnText}>{t.adminSettings.testPushBtn}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === "tickets" && (
          <View style={s.ticketSettings} testID="admin-settings-panel-tickets">
            <View style={s.panelHeading}>
              <View style={[s.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="tag" size={17} color={colors.primary} />
              </View>
              <View style={s.headingCopy}>
                <Text style={s.sectionTitle}>{t.adminSettings.ticketDataTab}</Text>
                <Text style={s.panelDescription}>{t.adminSettings.ticketDataDescription}</Text>
              </View>
              <Text style={s.sectionNumber}>03</Text>
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
                      <View style={s.headingCopy}>
                        <Text style={s.sectionTitle}>{section.label}</Text>
                        <Text style={s.sectionCount}>{items.length} {t.adminSettings.itemsCount}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[s.addBtn, { backgroundColor: section.color }]}
                      onPress={() => openAdd(section.key)}
                      activeOpacity={0.8}
                      disabled={isSaving}
                      accessibilityRole="button"
                      testID={`admin-settings-add-${section.key}`}
                    >
                      <Feather name="plus" size={14} color={colors.primaryForeground} />
                      <Text style={s.addBtnText}>{t.adminSettings.add}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.card}>
                    {isSaving ? (
                      <View style={s.savingRow}><ActivityIndicator color={colors.primary} size="small" /></View>
                    ) : items.length === 0 ? (
                      <View style={s.emptyRow}><Text style={s.emptyText}>—</Text></View>
                    ) : (
                      items.map((item, i) => (
                        <View key={`${section.key}-${i}`} style={[s.itemRow, i > 0 && s.itemRowBorder]}>
                          <View style={[s.itemDot, { backgroundColor: section.color }]} />
                          <Text style={s.itemLabel} numberOfLines={1}>{item}</Text>
                          <View style={s.itemActions}>
                            <TouchableOpacity
                              style={s.iconBtn}
                              onPress={() => openEdit(section.key, i)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityRole="button"
                              accessibilityLabel={`${t.adminSettings.rename}: ${item}`}
                              testID={`admin-settings-edit-${section.key}-${i}`}
                            >
                              <Feather name="edit-2" size={15} color={colors.mutedForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.iconBtn}
                              onPress={() => handleDelete(section.key, i)}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityRole="button"
                              accessibilityLabel={`${t.adminSettings.deleteConfirm}: ${item}`}
                              testID={`admin-settings-delete-${section.key}-${i}`}
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
          </View>
        )}
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
    loadErrorPanel: { padding: 28, gap: 14 },
    loadErrorText: { color: colors.foreground, fontSize: 15, lineHeight: 22, textAlign: "center", fontFamily: "Inter_500Medium" },
    retryButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
    retryText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    content: { paddingHorizontal: 18, paddingTop: 16, gap: 20 },
    hero: {
      backgroundColor: colors.secondary,
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 22,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      gap: 8,
    },
    heroTopline: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    adminMark: { width: 25, height: 25, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    eyebrow: { color: colors.secondaryForeground, fontSize: 10, letterSpacing: 1.35, fontFamily: "Inter_700Bold" },
    pageTitle: { color: colors.foreground, fontSize: 27, lineHeight: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
    pageDescription: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", maxWidth: 310 },
    tabBar: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 8,
      paddingRight: 18,
    },
    tab: {
      minWidth: 102,
      minHeight: 59,
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: {
      backgroundColor: colors.secondary,
      borderColor: colors.primary,
    },
    tabIndex: { color: colors.mutedForeground, fontSize: 9, letterSpacing: 1.3, fontFamily: "Inter_700Bold" },
    tabIndexActive: { color: colors.primary },
    tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    tabText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    tabTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },
    panel: { gap: 14 },
    panelHeading: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 2 },
    headingCopy: { flex: 1, gap: 3 },
    sectionNumber: { color: colors.mutedForeground, fontSize: 11, letterSpacing: 1, fontFamily: "Inter_700Bold" },
    orgField: { gap: 7 },
    orgLabel: { color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    orgDescription: { color: colors.mutedForeground, fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
    orgInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium" },
    divider: { height: 1, backgroundColor: colors.border },
    entityFields: { gap: 13, paddingTop: 1 },
    businessTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    businessType: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.background },
    businessTypeActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
    businessTypeText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" },
    businessTypeTextActive: { color: colors.primary },
    orgSwitchText: { flex: 1, gap: 4 },
    orgError: { color: colors.destructive, fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
    orgUnsaved: { color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold", paddingTop: 2 },
    orgSaveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 14, marginTop: 2 },
    orgSaveBtnDisabled: { opacity: 0.45 },
    saveBtnText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_700Bold" },
    panelDescription: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
    moduleRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 14 },
    moduleDivider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
    moduleGlyph: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    reportLink: { marginTop: 2, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 12, backgroundColor: colors.background },
    reportIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
    reportText: { flex: 1, color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    noticeCard: { alignItems: "center", gap: 11, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20 },
    noticeIllustration: { width: 74, height: 74, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.warning + "20", marginBottom: 5 },
    noticeSignal: { position: "absolute", top: 13, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    noticeTitle: { color: colors.foreground, fontSize: 17, textAlign: "center", fontFamily: "Inter_700Bold" },
    noticeBody: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19, textAlign: "center", fontFamily: "Inter_400Regular" },
    ticketSettings: { gap: 17 },
    testPushBtn: {
      flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
      gap: 9, backgroundColor: colors.primary,
      paddingVertical: 14, borderRadius: 13, paddingHorizontal: 18, width: "100%", marginTop: 7,
    },
    testPushBtnText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_700Bold" },
    buttonBusy: { opacity: 0.65 },

    section: { gap: 10 },
    sectionHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    sectionIcon: {
      width: 38, height: 38, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
    },
    sectionTitle: { fontSize: 16, color: colors.foreground, fontFamily: "Inter_700Bold" },
    sectionCount: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11,
    },
    addBtnText: { color: colors.primaryForeground, fontSize: 12, fontFamily: "Inter_700Bold" },

    card: {
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
      padding: 16, gap: 16,
    },
    savingRow: { padding: 20, alignItems: "center" },
    emptyRow: { padding: 16, alignItems: "center" },
    emptyText: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },

    itemRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 3, paddingVertical: 11, gap: 12,
    },
    itemRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    itemDot: { width: 7, height: 7, borderRadius: 4 },
    itemLabel: {
      flex: 1, fontSize: 14, color: colors.foreground, fontFamily: "Inter_600SemiBold",
    },
    itemActions: { flexDirection: "row", gap: 4 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.muted,
    },

    modalRoot: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 18, paddingVertical: 15,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    modalCancel: { paddingVertical: 4, paddingHorizontal: 2 },
    modalCancelText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    modalSaveBtn: {
      backgroundColor: colors.primary, paddingHorizontal: 17,
      paddingVertical: 9, borderRadius: 12, minWidth: 64, alignItems: "center",
    },
    modalSaveBtnText: { color: colors.primaryForeground, fontSize: 14, fontFamily: "Inter_600SemiBold" },

    modalContent: { padding: 20, gap: 16 },
    sectionBadge: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-start", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11,
    },
    sectionBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    modalInput: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 13, paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    modalInputError: { borderColor: colors.destructive },
    errorText: { fontSize: 12, color: colors.destructive, fontFamily: "Inter_400Regular" },
  });
