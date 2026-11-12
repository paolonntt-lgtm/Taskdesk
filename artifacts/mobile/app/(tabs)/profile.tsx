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
        <View style={s.menuSectionHeading}>
          <View style={s.menuHeadingMark} />
          <Text style={s.cardTitle}>{lang === "it" ? "Altri strumenti" : "More tools"}</Text>
        </View>
        <View style={s.toolList}>
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
        ].map((item, index) => {
          const accent = menuAccents[index % menuAccents.length];
          return (
          <TouchableOpacity
            key={item.path}
            style={[s.toolRow, { backgroundColor: `${accent}14`, borderColor: `${accent}42`, borderLeftColor: accent }]}
            onPress={() => router.push(item.path as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={`profile-tool-${item.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`}
          >
            <View style={[s.toolIconWrap, { backgroundColor: `${accent}24`, borderColor: `${accent}50` }]}>
              <Feather name={item.icon} size={19} color={accent} />
            </View>
            <Text style={s.toolLabel} numberOfLines={2}>{item.label}</Text>
            <View style={[s.toolArrow, { backgroundColor: `${accent}22` }]}>
              <Feather name="chevron-right" size={17} color={accent} />
            </View>
          </TouchableOpacity>
          );
        })}
        </View>
      </View>

      {isOrganizationAdmin && (
        <View style={s.card}>
          <View style={s.menuSectionHeading}>
            <View style={[s.menuHeadingMark, { backgroundColor: colors.warning }]} />
            <Text style={s.cardTitle}>{t.profile.administration}</Text>
          </View>
          <View style={s.toolList}>
            <TouchableOpacity
              style={[s.toolRow, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}42`, borderLeftColor: colors.primary }]}
              onPress={() => router.push("/users" as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.profile.manageUsers}
              testID="profile-admin-users"
            >
              <View style={[s.toolIconWrap, { backgroundColor: `${colors.primary}24`, borderColor: `${colors.primary}50` }]}>
                <Feather name="users" size={19} color={colors.primary} />
              </View>
              <Text style={s.toolLabel} numberOfLines={2}>{t.profile.manageUsers}</Text>
              <View style={[s.toolArrow, { backgroundColor: `${colors.primary}22` }]}>
                <Feather name="chevron-right" size={17} color={colors.primary} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toolRow, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}42`, borderLeftColor: colors.accent }]}
              onPress={() => router.push("/admin-settings" as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.profile.manageSettings}
              testID="profile-admin-settings"
            >
              <View style={[s.toolIconWrap, { backgroundColor: `${colors.accent}24`, borderColor: `${colors.accent}50` }]}>
                <Feather name="settings" size={19} color={colors.accent} />
              </View>
              <Text style={s.toolLabel} numberOfLines={2}>{t.profile.manageSettings}</Text>
              <View style={[s.toolArrow, { backgroundColor: `${colors.accent}22` }]}>
                <Feather name="chevron-right" size={17} color={colors.accent} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toolRow, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}48`, borderLeftColor: colors.warning }]}
              onPress={handleGenerateInvite}
              activeOpacity={0.7}
              disabled={generatingInvite}
              accessibilityRole="button"
              accessibilityLabel={t.profile.inviteCollab}
              accessibilityState={{ disabled: generatingInvite, busy: generatingInvite }}
              testID="profile-admin-invite"
            >
              <View style={[s.toolIconWrap, { backgroundColor: `${colors.warning}28`, borderColor: `${colors.warning}55` }]}>
                <Feather name="user-plus" size={19} color={colors.warning} />
              </View>
              <Text style={s.toolLabel} numberOfLines={2}>{t.profile.inviteCollab}</Text>
              <View style={[s.toolArrow, { backgroundColor: `${colors.warning}25` }]}>
                {generatingInvite
                  ? <ActivityIndicator size="small" color={colors.warning} />
                  : <Feather name="share-2" size={15} color={colors.warning} />
                }
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  menuSectionHeading: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.muted + "55",
  },
  menuHeadingMark: {
    width: 4, height: 16, borderRadius: 3,
    backgroundColor: colors.primary, marginLeft: 16,
  },
  toolList: {
    flexDirection: "column", paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  toolRow: {
    width: "100%", minHeight: 54, flexDirection: "row", alignItems: "center",
    gap: 10, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderLeftWidth: 3, borderRadius: 12,
  },
  toolIconWrap: {
    width: 34, height: 34, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  toolLabel: {
    flex: 1, fontSize: 14, lineHeight: 18, color: colors.foreground,
    fontFamily: "Inter_600SemiBold",
  },
  toolArrow: {
    width: 26, height: 26, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
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
