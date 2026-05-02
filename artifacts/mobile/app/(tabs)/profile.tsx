import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const s = styles(colors);

  const handleLogout = () => {
    Alert.alert("Esci", "Vuoi uscire dall'account?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci", style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const initials = user?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  const infoItems = [
    { icon: "mail" as const, label: "Email", value: user?.email ?? "" },
    { icon: "shield" as const, label: "Ruolo", value: user?.role === "admin" ? "Amministratore" : "Utente" },
  ];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 34 : 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.name}</Text>
        <View style={[s.roleBadge, user?.role === "admin" && s.roleBadgeAdmin]}>
          <Text style={[s.roleText, user?.role === "admin" && s.roleTextAdmin]}>
            {user?.role === "admin" ? "Amministratore" : "Utente"}
          </Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Informazioni account</Text>
        {infoItems.map((item, i) => (
          <View key={item.label} style={[s.infoRow, i < infoItems.length - 1 && s.infoRowBorder]}>
            <View style={s.infoLeft}>
              <Feather name={item.icon} size={16} color={colors.mutedForeground} />
              <Text style={s.infoLabel}>{item.label}</Text>
            </View>
            <Text style={s.infoValue} numberOfLines={1}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>App</Text>
        <View style={s.infoRow}>
          <View style={s.infoLeft}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={s.infoLabel}>Versione</Text>
          </View>
          <Text style={s.infoValue}>1.0.0</Text>
        </View>
        <View style={[s.infoRow, s.infoRowBorder, { borderTopWidth: 1 }]}>
          <View style={s.infoLeft}>
            <Feather name="check-square" size={16} color={colors.primary} />
            <Text style={s.infoLabel}>TaskDesk</Text>
          </View>
          <Text style={s.infoValue}>Sistema di ticketing</Text>
        </View>
      </View>

      {user?.role === "admin" && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Amministrazione</Text>
          <TouchableOpacity
            style={s.infoRow}
            onPress={() => router.push("/users" as any)}
            activeOpacity={0.7}
          >
            <View style={s.infoLeft}>
              <Feather name="users" size={16} color={colors.primary} />
              <Text style={[s.infoLabel, { color: colors.primary }]}>Gestione utenti</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={s.logoutText}>Esci dall'account</Text>
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
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
    infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    infoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    infoLabel: { fontSize: 14, color: colors.foreground, fontFamily: "Inter_500Medium" },
    infoValue: { fontSize: 14, color: colors.mutedForeground, maxWidth: "55%", textAlign: "right", fontFamily: "Inter_400Regular" },
    logoutBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      backgroundColor: colors.destructive + "15",
      borderRadius: 12, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.destructive + "30",
    },
    logoutText: { color: colors.destructive, fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
