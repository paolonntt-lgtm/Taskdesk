import React, { useState } from "react";
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Linking,
  ScrollView, Alert, Platform, Share, ActivityIndicator, Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Lang } from "@/i18n/translations";
import * as Haptics from "expo-haptics";
import { apiGet, apiPatch, apiPost, getUserAvatarQueryKey } from "@/utils/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOptionalProfileMenuItems, type MobileOrganizationSettings } from "@/utils/profileMenu";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, updateUser, switchWorkspace } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const queryClient = useQueryClient();
  const s = styles(colors);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  const organizationSettings = useQuery({
    queryKey: ["mobile-profile-organization-settings", user?.organizationId],
    queryFn: () => apiGet<MobileOrganizationSettings>("/settings/organization"),
    enabled: user?.organizationId != null,
  });

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const data = await apiPost<{ token: string }>("/invites", {});
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
      const url = `https://${domain}/app/invite/${data.token}`;
      await Share.share({
        message: `${t.profile.inviteShareMsg}\n${url}`,
        url,
        title: "TaskDesk — Invita collaboratore",
      });
    } catch {
      Alert.alert("Errore", t.profile.inviteError);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const saveAvatar = async (avatarUrl: string | null) => {
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const result = await apiPatch<{ user?: { avatarUrl?: string | null } }>("/auth/profile", { avatarUrl });
      const savedAvatarUrl = result.user?.avatarUrl ?? avatarUrl;
      setAvatarOverride(savedAvatarUrl);
      updateUser({ avatarUrl: savedAvatarUrl });
      if (user?.id != null && user.organizationId != null) {
        queryClient.setQueryData(
          getUserAvatarQueryKey(user.organizationId, user.id),
          { avatarUrl: savedAvatarUrl },
        );
      }
    } catch {
      setAvatarError(t.profile.photoUpdateError);
    } finally {
      setAvatarSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    setAvatarError(null);
    if (!mediaPermission?.granted) {
      let permission;
      try {
        permission = await requestMediaPermission();
      } catch {
        setAvatarError(t.profile.photoUpdateError);
        return;
      }
      if (!permission.granted) {
        if (Platform.OS !== "web" && !permission.canAskAgain) {
          Alert.alert(t.profile.photoPermissionTitle, t.profile.photoPermissionMessage, [
            { text: t.profile.logoutCancel, style: "cancel" },
            { text: t.profile.photoOpenSettings, onPress: () => { void Linking.openSettings().catch(() => {}); } },
          ]);
        } else {
          Alert.alert(t.profile.photoPermissionTitle, t.profile.photoPermissionMessage);
        }
        return;
      }
    }

    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (selection.canceled) return;

      const asset = selection.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        setAvatarError(t.profile.photoSizeError);
        return;
      }

      setAvatarSaving(true);
      let avatarUrl: string | null = null;
      for (const compress of [0.72, 0.58, 0.44, 0.3]) {
        const image = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 256, height: 256 } }],
          { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        const dataUriPrefix = "data:image/jpeg;base64,";
        if (image.base64 && image.base64.length + dataUriPrefix.length <= 100_000) {
          avatarUrl = `${dataUriPrefix}${image.base64}`;
          break;
        }
      }
      if (!avatarUrl) {
        setAvatarError(t.profile.photoSizeError);
        setAvatarSaving(false);
        return;
      }
      await saveAvatar(avatarUrl);
    } catch {
      setAvatarError(t.profile.photoUpdateError);
      setAvatarSaving(false);
    }
  };

  const confirmRemoveAvatar = () => {
    Alert.alert(t.profile.photoRemoveTitle, t.profile.photoRemoveConfirm, [
      { text: t.profile.logoutCancel, style: "cancel" },
      { text: t.profile.photoRemove, style: "destructive", onPress: () => { void saveAvatar(null); } },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(t.profile.logoutTitle, t.profile.logoutMessage, [
      { text: t.profile.logoutCancel, style: "cancel" },
      {
        text: t.profile.logoutConfirm, style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const initials = user?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const avatarUrl = avatarOverride === undefined ? user?.avatarUrl ?? null : avatarOverride;
  const isOrganizationAdmin = user?.role === "admin" && user.organizationId != null;
  const workspaces = user?.workspaces ?? [];
  const activeWorkspaceId = user?.activeWorkspaceId ?? user?.organizationId;
  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
    user?.organizationName ??
    "";
  const menuAccents = [colors.primary, colors.accent, colors.warning];
  const openSection = (path: string) =>
    router.push({ pathname: path as any, params: { fromProfile: "1" } } as any);

  const LANGS: { value: Lang; label: string; flag: string }[] = [
    { value: "it", label: "Italiano", flag: "IT" },
    { value: "en", label: "English", flag: "EN" },
  ];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.avatarSection}>
        <TouchableOpacity
          style={s.avatarButton}
          onPress={() => void handlePickAvatar()}
          disabled={avatarSaving}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={avatarUrl ? t.profile.photoChange : t.profile.photoAdd}
          accessibilityState={{ disabled: avatarSaving, busy: avatarSaving }}
          testID="profile-avatar-button"
        >
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.avatar} resizeMode="cover" />
            : <View style={s.avatar}><Text style={s.initials}>{initials}</Text></View>
          }
          <View style={s.avatarCameraBadge}>
            <Feather name="camera" size={14} color={colors.primaryForeground} />
          </View>
        </TouchableOpacity>
        <View style={s.avatarActions}>
          <TouchableOpacity
            onPress={() => void handlePickAvatar()}
            disabled={avatarSaving}
            accessibilityRole="button"
          >
            <Text style={s.avatarActionText}>{avatarUrl ? t.profile.photoChange : t.profile.photoAdd}</Text>
          </TouchableOpacity>
          {avatarUrl ? (
            <TouchableOpacity
              onPress={confirmRemoveAvatar}
              disabled={avatarSaving}
              accessibilityRole="button"
            >
              <Text style={s.avatarRemoveText}>{t.profile.photoRemove}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {avatarSaving ? (
          <View style={s.avatarStatus}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.avatarStatusText}>{t.profile.photoUploading}</Text>
          </View>
        ) : null}
        {avatarError ? <Text style={s.avatarError} accessibilityRole="alert">{avatarError}</Text> : null}
        <Text style={s.name}>{user?.name}</Text>
        <View style={[s.roleBadge, (user?.role === "admin" || user?.isSuperAdmin) && s.roleBadgeAdmin]}>
          <Text style={[s.roleText, (user?.role === "admin" || user?.isSuperAdmin) && s.roleTextAdmin]}>
            {user?.isSuperAdmin ? (lang === "it" ? "Superamministratore" : "Superadmin") : user?.role === "admin" ? t.profile.admin : t.profile.user}
          </Text>
        </View>
        {!!user?.email && (
          <View style={s.emailLine}>
            <Feather name="mail" size={14} color={colors.mutedForeground} />
            <Text style={s.emailText} numberOfLines={1}>{user.email}</Text>
          </View>
        )}
      </View>

      {workspaces.length > 0 && (
        <View style={s.card} testID="profile-workspace-section">
          <Text style={s.cardTitle}>{t.profile.workspaceSection}</Text>
          <View style={s.workspaceSummary}>
            <View style={s.workspaceIcon}>
              <Feather name="briefcase" size={17} color={colors.primary} />
            </View>
            <View style={s.workspaceCopy}>
              <Text style={s.workspaceLabel}>{t.profile.activeWorkspace}</Text>
              <Text style={s.workspaceName} numberOfLines={2}>{activeWorkspaceName}</Text>
            </View>
            <TouchableOpacity
              style={[s.workspaceChangeButton, workspaces.length < 2 && s.workspaceChangeButtonDisabled]}
              onPress={() => {
                setWorkspaceError(null);
                setWorkspacePickerOpen(true);
              }}
              disabled={workspaces.length < 2 || workspaceSwitching}
              accessibilityRole="button"
              accessibilityLabel={t.profile.changeWorkspace}
              testID="profile-change-workspace"
            >
              <Text style={s.workspaceChangeText}>{t.profile.changeWorkspace}</Text>
              <Feather name="chevron-down" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>{t.profile.settings}</Text>
        <View style={[s.infoRow, { gap: 8 }]}>
          <View style={s.infoLeft}>
            <Feather name="globe" size={16} color={colors.mutedForeground} />
            <Text style={s.infoLabel}>{t.profile.languageLabel}</Text>
          </View>
          <View style={s.langRow}>
            {LANGS.map((l) => (
              <TouchableOpacity
                key={l.value}
                style={[s.langBtn, lang === l.value && s.langBtnActive]}
                onPress={() => setLang(l.value)}
                activeOpacity={0.75}
              >
                <Text style={s.langFlag}>{l.flag}</Text>
                <Text style={[s.langLabel, lang === l.value && s.langLabelActive]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.menuSectionHeader}>
          <View style={s.menuSectionMark} />
          <Text style={s.menuSectionTitle}>{lang === "it" ? "Altri strumenti" : "More tools"}</Text>
        </View>
        {[
          { label: t.tabs.reports, icon: "bar-chart-2" as const, path: "/reports" },
          ...getOptionalProfileMenuItems({
            settings: organizationSettings.data,
            settingsLoaded: organizationSettings.isSuccess,
            isOrganizationAdmin,
            lang,
          }),
          { label: lang === "it" ? "Notifiche" : "Notifications", icon: "bell" as const, path: "/notifications" },
          ...(isOrganizationAdmin ? [
            { label: lang === "it" ? "Cestino ticket" : "Ticket trash", icon: "trash-2" as const, path: "/ticket-trash" },
            { label: lang === "it" ? "Fatturazione" : "Billing", icon: "credit-card" as const, path: "/billing" },
            { label: lang === "it" ? "Avvisi" : "Announcements", icon: "bell" as const, path: "/announcements" },
          ] : []),
        ].map((item, index, items) => (
          <TouchableOpacity
            key={item.path}
            style={[s.menuItem, index === items.length - 1 && !isOrganizationAdmin && s.menuItemLast]}
            onPress={() => openSection(item.path)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={`profile-tool-${item.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}
          >
            <View style={[s.menuIconWrap, { backgroundColor: `${menuAccents[index % menuAccents.length]}18` }]}>
              <Feather name={item.icon} size={16} color={menuAccents[index % menuAccents.length]} />
            </View>
            <Text style={s.toolLabel} numberOfLines={2}>{item.label}</Text>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}

      {isOrganizationAdmin && (
        <>
          <View style={[s.menuSectionHeader, s.menuAdminHeader]}>
            <View style={[s.menuSectionMark, s.menuAdminMark]} />
            <Text style={s.menuSectionTitle}>{t.profile.administration}</Text>
          </View>
          <TouchableOpacity
            style={[s.menuItem, s.menuItemBorder]}
            onPress={() => openSection("/users")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.profile.manageUsers}
            testID="profile-admin-users"
          >
            <View style={[s.menuIconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="users" size={16} color={colors.primary} />
            </View>
            <Text style={s.toolLabel} numberOfLines={2}>{t.profile.manageUsers}</Text>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.menuItem, s.menuItemBorder]}
            onPress={() => openSection("/admin-settings")}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.profile.manageSettings}
            testID="profile-admin-settings"
          >
            <View style={[s.menuIconWrap, { backgroundColor: `${colors.accent}18` }]}>
              <Feather name="settings" size={16} color={colors.accent} />
            </View>
            <Text style={s.toolLabel} numberOfLines={2}>{t.profile.manageSettings}</Text>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.menuItem, s.menuItemLast]}
            onPress={handleGenerateInvite}
            activeOpacity={0.7}
            disabled={generatingInvite}
            accessibilityRole="button"
            accessibilityLabel={t.profile.inviteCollab}
            accessibilityState={{ disabled: generatingInvite, busy: generatingInvite }}
            testID="profile-admin-invite"
          >
            <View style={[s.menuIconWrap, { backgroundColor: `${colors.warning}25` }]}>
              <Feather name="user-plus" size={16} color={colors.warning} />
            </View>
            <Text style={s.toolLabel} numberOfLines={2}>{t.profile.inviteCollab}</Text>
            {generatingInvite
              ? <ActivityIndicator size="small" color={colors.warning} />
              : <Feather name="share-2" size={16} color={colors.mutedForeground} />
            }
          </TouchableOpacity>
        </>
      )}
      </View>

      {user?.isSuperAdmin && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{lang === "it" ? "Superamministrazione" : "Superadmin"}</Text>
          <TouchableOpacity style={s.infoRow} onPress={() => openSection("/superadmin")} activeOpacity={0.7}>
            <View style={s.infoLeft}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={[s.infoLabel, { color: colors.primary }]}>{lang === "it" ? "Console piattaforma" : "Platform console"}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={s.logoutText}>{t.profile.logout}</Text>
      </TouchableOpacity>
      <Modal
        visible={workspacePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!workspaceSwitching) setWorkspacePickerOpen(false); }}
      >
        <View style={s.workspaceModalBackdrop}>
          <View style={s.workspaceModal} accessibilityViewIsModal testID="workspace-picker-modal">
            <View style={s.workspaceModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.workspaceModalTitle}>{t.profile.workspacePickerTitle}</Text>
                <Text style={s.workspaceModalSubtitle}>{t.profile.workspacePickerSubtitle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setWorkspacePickerOpen(false)}
                disabled={workspaceSwitching}
                accessibilityRole="button"
                accessibilityLabel={t.profile.workspaceClose}
                testID="workspace-picker-close"
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {workspaceError ? <Text style={s.workspaceError} accessibilityRole="alert">{workspaceError}</Text> : null}
            {workspaces.map((workspace) => {
              const selected = workspace.id === activeWorkspaceId;
              return (
                <TouchableOpacity
                  key={workspace.id}
                  style={[s.workspaceOption, selected && s.workspaceOptionSelected]}
                  onPress={() => {
                    if (selected || workspaceSwitching) return;
                    setWorkspaceSwitching(true);
                    setWorkspaceError(null);
                    void switchWorkspace(workspace.id)
                      .then(() => setWorkspacePickerOpen(false))
                      .catch(() => setWorkspaceError(t.profile.workspaceSwitchError))
                      .finally(() => setWorkspaceSwitching(false));
                  }}
                  disabled={workspaceSwitching}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: workspaceSwitching, busy: workspaceSwitching && !selected }}
                  testID={`workspace-option-${workspace.id}`}
                >
                  <View style={s.workspaceOptionCopy}>
                    <Text style={[s.workspaceOptionName, selected && s.workspaceOptionNameSelected]} numberOfLines={2}>
                      {workspace.name}
                    </Text>
                    <Text style={s.workspaceOptionRole}>
                      {workspace.role === "admin" ? t.profile.admin : t.profile.user}
                    </Text>
                  </View>
                  {workspaceSwitching && !selected
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : selected
                      ? <Feather name="check-circle" size={19} color={colors.primary} />
                      : <View style={s.workspaceOptionSpacer} />}
                </TouchableOpacity>
              );
            })}
            {workspaceSwitching ? (
              <View style={s.workspaceSwitching}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={s.workspaceOptionRole}>{t.profile.workspaceSwitching}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 16 },
    avatarSection: { alignItems: "center", paddingVertical: 24 },
    avatarButton: {
      width: 80, height: 80, marginBottom: 9,
    },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    avatarCameraBadge: {
      position: "absolute", right: 0, bottom: 0,
      width: 27, height: 27, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.background,
    },
    avatarActions: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
    avatarActionText: { color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    avatarRemoveText: { color: colors.destructive, fontSize: 13, fontFamily: "Inter_500Medium" },
    avatarStatus: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    avatarStatusText: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
    avatarError: { color: colors.destructive, fontSize: 12, marginBottom: 8, textAlign: "center" },
    initials: { fontSize: 28, fontWeight: "700" as const, color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
    name: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, marginBottom: 8, fontFamily: "Inter_700Bold" },
    roleBadge: {
      paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
      backgroundColor: colors.muted,
    },
    roleBadgeAdmin: { backgroundColor: colors.primary + "22" },
    roleText: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    roleTextAdmin: { color: colors.primary },
    emailLine: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 7, marginTop: 10, maxWidth: "100%",
    },
    emailText: {
      flexShrink: 1, fontSize: 14, color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    card: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    cardTitle: {
      fontSize: 12, fontWeight: "600" as const, color: colors.mutedForeground,
      paddingHorizontal: 16, paddingVertical: 10,
      fontFamily: "Inter_600SemiBold",
      backgroundColor: colors.muted + "55",
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    workspaceSummary: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
    workspaceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "14" },
    workspaceCopy: { flex: 1, minWidth: 0, gap: 3 },
    workspaceLabel: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" },
    workspaceName: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" },
    workspaceChangeButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.primary + "12" },
    workspaceChangeButtonDisabled: { opacity: 0.55 },
    workspaceChangeText: { color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    workspaceModalBackdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.45)" },
    workspaceModal: { padding: 18, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    workspaceModalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
    workspaceModalTitle: { color: colors.foreground, fontSize: 19, fontFamily: "Inter_700Bold" },
    workspaceModalSubtitle: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 4, fontFamily: "Inter_400Regular" },
    workspaceOption: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
    workspaceOptionSelected: { backgroundColor: colors.primary + "0C", borderColor: colors.primary },
    workspaceOptionCopy: { flex: 1, gap: 3 },
    workspaceOptionName: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" },
    workspaceOptionNameSelected: { color: colors.primary },
    workspaceOptionRole: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" },
    workspaceOptionSpacer: { width: 19, height: 19 },
    workspaceError: { color: colors.destructive, fontSize: 13, lineHeight: 18, marginBottom: 6, fontFamily: "Inter_500Medium" },
    workspaceSwitching: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingTop: 14 },
  menuSectionHeader: {
    minHeight: 40, flexDirection: "row", alignItems: "center", gap: 9,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.primary + "0B",
  },
  menuAdminHeader: {
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.accent + "10",
  },
  menuSectionMark: {
    width: 4, height: 15, borderRadius: 2, backgroundColor: colors.primary,
  },
  menuAdminMark: {
    backgroundColor: colors.accent,
  },
  menuSectionTitle: {
    fontSize: 12, color: colors.mutedForeground,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  menuItem: {
    width: "100%", minHeight: 46, flexDirection: "row", alignItems: "center",
    gap: 10, paddingHorizontal: 14, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuIconWrap: {
    width: 30, height: 30, alignItems: "center", justifyContent: "center",
    borderRadius: 9,
  },
  menuItemBorder: { borderBottomWidth: 1 },
  menuItemLast: { borderBottomWidth: 0 },
  toolLabel: {
    flex: 1, fontSize: 14, lineHeight: 18, color: colors.foreground,
    fontFamily: "Inter_500Medium",
  },
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
    infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    infoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    infoLabel: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    infoValue: { fontSize: 14, color: colors.mutedForeground, maxWidth: "55%", textAlign: "right", fontFamily: "Inter_400Regular" },
    langRow: { flexDirection: "row", gap: 8 },
    langBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
    },
    langBtnActive: { backgroundColor: colors.primary + "18", borderColor: colors.primary },
    langFlag: { fontSize: 10, color: colors.primary, fontWeight: "700" as const, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
    langLabel: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    langLabelActive: { color: colors.primary, fontWeight: "600" as const },
    logoutBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: colors.destructive + "15",
      borderRadius: 12, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.destructive + "30",
    },
    logoutText: { color: colors.destructive, fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
