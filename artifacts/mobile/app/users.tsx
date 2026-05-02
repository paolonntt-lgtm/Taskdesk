import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPost } from "@/utils/api";
import * as Haptics from "expo-haptics";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  group?: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  { value: "user", label: "Utente" },
  { value: "admin", label: "Amministratore" },
];

export default function UsersScreen() {
  const colors = useColors();
  const s = styles(colors);
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "user", group: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<User[]>("/users"),
  });

  useEffect(() => {
    apiGet<{ value: string[] }>("/settings/groups")
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", role: "user", group: "" });
    setErrors({});
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome obbligatorio";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Email non valida";
    if (!form.password || form.password.length < 6)
      e.password = "Password minimo 6 caratteri";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiPost("/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        group: form.group || null,
      });
      qc.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
      resetForm();
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (msg.toLowerCase().includes("email") || msg.includes("409")) {
        setErrors({ email: "Email già in uso" });
      } else {
        Alert.alert("Errore", msg || "Impossibile creare l'utente");
      }
    } finally {
      setSaving(false);
    }
  };

  const activeCount = users.filter((u) => u.isActive !== false).length;

  const renderUser = ({ item }: { item: User }) => {
    const isActive = item.isActive !== false;
    const initials = item.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (
      <View style={[s.userCard, !isActive && { opacity: 0.5 }]}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={s.userName}>{item.name}</Text>
          <Text style={s.userEmail}>{item.email}</Text>
          {item.group ? <Text style={s.userGroup}>{item.group}</Text> : null}
        </View>
        <View style={s.userRight}>
          <View style={[s.roleBadge, item.role === "admin" && s.roleBadgeAdmin]}>
            <Text style={[s.roleText, item.role === "admin" && s.roleTextAdmin]}>
              {item.role === "admin" ? "Admin" : "Utente"}
            </Text>
          </View>
          {!isActive && (
            <Text style={s.inactiveTag}>Disattivato</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.subtitle}>{activeCount} utenti attivi</Text>
        <TouchableOpacity style={s.addBtn} onPress={openModal} activeOpacity={0.8}>
          <Feather name="user-plus" size={16} color={colors.primaryForeground} />
          <Text style={s.addBtnText}>Nuovo utente</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={[s.list, { paddingBottom: Platform.OS === "web" ? 34 : 20 }]}
          refreshing={false}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="users" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>Nessun utente trovato</Text>
            </View>
          }
        />
      )}

      {/* Create User Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalRoot}>
            {/* Modal Header */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Nuovo utente</Text>
              <TouchableOpacity
                onPress={handleSave}
                style={[s.modalSaveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={colors.primaryForeground} size="small" />
                  : <Text style={s.modalSaveBtnText}>Salva</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Nome */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Nome *</Text>
                <TextInput
                  style={[s.input, errors.name ? s.inputError : null]}
                  value={form.name}
                  onChangeText={(v) => { setForm((f) => ({ ...f, name: v })); setErrors((e) => ({ ...e, name: "" })); }}
                  placeholder="Nome completo"
                  placeholderTextColor={colors.mutedForeground}
                  autoCorrect={false}
                />
                {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}
              </View>

              {/* Email */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Email *</Text>
                <TextInput
                  style={[s.input, errors.email ? s.inputError : null]}
                  value={form.email}
                  onChangeText={(v) => { setForm((f) => ({ ...f, email: v })); setErrors((e) => ({ ...e, email: "" })); }}
                  placeholder="email@azienda.it"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email ? <Text style={s.errorText}>{errors.email}</Text> : null}
              </View>

              {/* Password */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Password *</Text>
                <TextInput
                  style={[s.input, errors.password ? s.inputError : null]}
                  value={form.password}
                  onChangeText={(v) => { setForm((f) => ({ ...f, password: v })); setErrors((e) => ({ ...e, password: "" })); }}
                  placeholder="Minimo 6 caratteri"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                />
                {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}
              </View>

              {/* Ruolo */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>Ruolo</Text>
                <View style={s.segmentRow}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[s.segmentBtn, form.role === r.value && s.segmentBtnActive]}
                      onPress={() => setForm((f) => ({ ...f, role: r.value }))}
                    >
                      <Text style={[s.segmentText, form.role === r.value && s.segmentTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Gruppo */}
              {groups.length > 0 && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Gruppo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.segmentRow}>
                      <TouchableOpacity
                        style={[s.segmentBtn, !form.group && s.segmentBtnActive]}
                        onPress={() => setForm((f) => ({ ...f, group: "" }))}
                      >
                        <Text style={[s.segmentText, !form.group && s.segmentTextActive]}>Nessuno</Text>
                      </TouchableOpacity>
                      {groups.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[s.segmentBtn, form.group === g && s.segmentBtnActive]}
                          onPress={() => setForm((f) => ({ ...f, group: g }))}
                        >
                          <Text style={[s.segmentText, form.group === g && s.segmentTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20,
    },
    addBtnText: { color: colors.primaryForeground, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    list: { padding: 16, gap: 10 },
    userCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    avatar: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: colors.primaryForeground, fontSize: 15, fontFamily: "Inter_700Bold" },
    userInfo: { flex: 1, gap: 2 },
    userName: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    userEmail: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    userGroup: { fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium", marginTop: 2 },
    userRight: { alignItems: "flex-end", gap: 4 },
    roleBadge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
      backgroundColor: colors.muted,
    },
    roleBadgeAdmin: { backgroundColor: colors.primary + "22" },
    roleText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    roleTextAdmin: { color: colors.primary },
    inactiveTag: { fontSize: 10, color: colors.destructive, fontFamily: "Inter_400Regular" },
    empty: { alignItems: "center", paddingTop: 80, gap: 12 },
    emptyText: { fontSize: 15, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    // Modal
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
    modalContent: { padding: 20, gap: 20, paddingBottom: 40 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: "500" as const, color: colors.foreground, fontFamily: "Inter_500Medium" },
    input: {
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    inputError: { borderColor: colors.destructive },
    errorText: { fontSize: 12, color: colors.destructive, fontFamily: "Inter_400Regular" },
    segmentRow: { flexDirection: "row", gap: 8 },
    segmentBtn: {
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    segmentBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentText: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    segmentTextActive: { color: colors.primaryForeground },
  });
