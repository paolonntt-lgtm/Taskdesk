import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Platform, Share, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Lang } from "@/i18n/translations";
import * as Haptics from "expo-haptics";
import { apiPost } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import { getOptionalProfileMenuItems, type MobileOrganizationSettings } from "@/utils/profileMenu";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const s = styles(colors);
  const [generatingInvite, setGeneratingInvite] = useState(false);
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
  const isOrganizationAdmin = user?.role === "admin" && user.organizationId != null;
  const menuAccents = [colors.primary, colors.accent, colors.warning];

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
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
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
            onPress={() => router.push(item.path as any)}
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
            onPress={() => router.push("/users" as any)}
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
            onPress={() => router.push("/admin-settings" as any)}
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
          <TouchableOpacity style={s.infoRow} onPress={() => router.push("/superadmin" as any)} activeOpacity={0.7}>
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
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 16 },
    avatarSection: { alignItems: "center", paddingVertical: 24 },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      marginBottom: 12,
    },
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
