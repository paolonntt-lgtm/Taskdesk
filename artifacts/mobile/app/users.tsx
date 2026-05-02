import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, ScrollView,
  Platform, KeyboardAvoidingView, Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete, LOCATIONS } from "@/utils/api";
import * as Haptics from "expo-haptics";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  group?: string | null;
  mainLocation?: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  { value: "user", label: "Utente" },
  { value: "admin", label: "Admin" },
];

type ModalMode = "create" | "edit";

const EMPTY_FORM = {
  name: "", email: "", password: "",
  role: "user", group: "", mainLocation: "", isActive: true,
};

export default function UsersScreen() {
  const colors = useColors();
  const s = styles(colors);
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const [mode, setMode] = useState<ModalMode>("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<User[]>("/users"),
  });

  useEffect(() => {
    apiGet<{ value: string[] }>("/settings/groups")
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
    apiGet<{ value: string[] }>("/settings/locations")
      .then((d) => setLocations(d.value ?? LOCATIONS))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
  };

  const openCreate = () => {
    setMode("create");
    setEditingUser(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("edit");
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      group: u.group ?? "",
      mainLocation: u.mainLocation ?? "",
      isActive: u.isActive,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome obbligatorio";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Email non valida";
    if (mode === "create" && (!form.password || form.password.length < 6))
      e.password = "Password minimo 6 caratteri";
    if (mode === "edit" && form.password && form.password.length < 6)
      e.password = "Password minimo 6 caratteri";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (mode === "create") {
        await apiPost("/users", {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          group: form.group || null,
          mainLocation: form.mainLocation || null,
        });
      } else if (editingUser) {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          group: form.group || null,
          mainLocation: form.mainLocation || null,
          isActive: form.isActive,
        };
        if (form.password) body.password = form.password;
        await apiPatch(`/users/${editingUser.id}`, body);
      }
      qc.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
      resetForm();
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (msg.toLowerCase().includes("email") || msg.includes("409")) {
        setErrors({ email: "Email già in uso" });
      } else {
        Alert.alert("Errore", msg || "Impossibile salvare l'utente");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (u: User) => {
    const action = u.isActive ? "disattivare" : "riattivare";
    const actionLabel = u.isActive ? "Disattiva" : "Riattiva";
    Alert.alert(
      `${actionLabel} utente`,
      `Vuoi ${action} ${u.name}?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: actionLabel,
          style: u.isActive ? "destructive" : "default",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              if (u.isActive) {
                await apiDelete(`/users/${u.id}`);
              } else {
                await apiPatch(`/users/${u.id}`, { isActive: true });
              }
              qc.invalidateQueries({ queryKey: ["users"] });
            } catch (err: any) {
              Alert.alert("Errore", err.message);
            }
          },
        },
      ]
    );
  };

  const setField = <K extends keyof typeof form>(key: K, val: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const activeCount = users.filter((u) => u.isActive !== false).length;

  const renderUser = ({ item }: { item: User }) => {
    const isActive = item.isActive !== false;
    const isMe = item.id === me?.id;
    const initials = item.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (
      <TouchableOpacity
        style={[s.userCard, !isActive && s.userCardInactive]}
        onPress={() => openEdit(item)}
        activeOpacity={0.75}
      >
        <View style={[s.avatar, !isActive && { backgroundColor: colors.muted }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={s.userInfo}>
          <View style={s.userNameRow}>
            <Text style={[s.userName, !isActive && { color: colors.mutedForeground }]}>{item.name}</Text>
            {isMe && <View style={s.meBadge}><Text style={s.meBadgeText}>tu</Text></View>}
          </View>
          <Text style={s.userEmail}>{item.email}</Text>
          <View style={s.userTagsRow}>
            {item.group ? <Text style={s.tag}>{item.group}</Text> : null}
            {item.mainLocation ? <Text style={s.tag}>{item.mainLocation}</Text> : null}
          </View>
        </View>
        <View style={s.userRight}>
          <View style={[s.roleBadge, item.role === "admin" && s.roleBadgeAdmin]}>
            <Text style={[s.roleText, item.role === "admin" && s.roleTextAdmin]}>
              {item.role === "admin" ? "Admin" : "Utente"}
            </Text>
          </View>
          {!isActive
            ? <Text style={s.inactiveTag}>Disattivato</Text>
            : <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          }
        </View>
      </TouchableOpacity>
    );
  };

  const isMe = editingUser?.id === me?.id;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.subtitle}>{activeCount} utenti attivi · {users.length} totali</Text>
        <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <Feather name="user-plus" size={16} color={colors.primaryForeground} />
          <Text style={s.addBtnText}>Nuovo</Text>
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

      {/* Create / Edit Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modalRoot}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{mode === "create" ? "Nuovo utente" : "Modifica utente"}</Text>
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
                  onChangeText={(v) => setField("name", v)}
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
                  onChangeText={(v) => setField("email", v)}
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
                <Text style={s.fieldLabel}>{mode === "edit" ? "Nuova password (opzionale)" : "Password *"}</Text>
                <TextInput
                  style={[s.input, errors.password ? s.inputError : null]}
                  value={form.password}
                  onChangeText={(v) => setField("password", v)}
                  placeholder={mode === "edit" ? "Lascia vuoto per non cambiare" : "Minimo 6 caratteri"}
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
                      onPress={() => setField("role", r.value)}
                      disabled={isMe}
                    >
                      <Text style={[s.segmentText, form.role === r.value && s.segmentTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isMe && (
                  <Text style={s.hintText}>Non puoi cambiare il tuo ruolo</Text>
                )}
              </View>

              {/* Gruppo */}
              {groups.length > 0 && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Gruppo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.segmentRow}>
                      <TouchableOpacity
                        style={[s.segmentBtn, !form.group && s.segmentBtnActive]}
                        onPress={() => setField("group", "")}
                      >
                        <Text style={[s.segmentText, !form.group && s.segmentTextActive]}>Nessuno</Text>
                      </TouchableOpacity>
                      {groups.map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[s.segmentBtn, form.group === g && s.segmentBtnActive]}
                          onPress={() => setField("group", g)}
                        >
                          <Text style={[s.segmentText, form.group === g && s.segmentTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Sede principale */}
              {locations.length > 0 && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Sede principale</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.segmentRow}>
                      <TouchableOpacity
                        style={[s.segmentBtn, !form.mainLocation && s.segmentBtnActive]}
                        onPress={() => setField("mainLocation", "")}
                      >
                        <Text style={[s.segmentText, !form.mainLocation && s.segmentTextActive]}>Nessuna</Text>
                      </TouchableOpacity>
                      {locations.map((loc) => (
                        <TouchableOpacity
                          key={loc}
                          style={[s.segmentBtn, form.mainLocation === loc && s.segmentBtnActive]}
                          onPress={() => setField("mainLocation", loc)}
                        >
                          <Text style={[s.segmentText, form.mainLocation === loc && s.segmentTextActive]}>{loc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Stato account (solo in edit, e non su se stesso) */}
              {mode === "edit" && !isMe && (
                <View style={s.switchRow}>
                  <View>
                    <Text style={s.fieldLabel}>Account attivo</Text>
                    <Text style={s.hintText}>Disattivando l'utente non potrà accedere</Text>
                  </View>
                  <Switch
                    value={form.isActive}
                    onValueChange={(v) => setField("isActive", v)}
                    trackColor={{ false: colors.muted, true: colors.primary + "88" }}
                    thumbColor={form.isActive ? colors.primary : colors.mutedForeground}
                  />
                </View>
              )}

              {/* Pulsante disattiva/riattiva rapido */}
              {mode === "edit" && !isMe && editingUser && (
                <TouchableOpacity
                  style={[s.dangerBtn, !editingUser.isActive && s.successBtn]}
                  onPress={() => {
                    setModalOpen(false);
                    setTimeout(() => handleDeactivate(editingUser), 350);
                  }}
                >
                  <Feather
                    name={editingUser.isActive ? "user-x" : "user-check"}
                    size={15}
                    color={editingUser.isActive ? colors.destructive : colors.success}
                  />
                  <Text style={[s.dangerBtnText, !editingUser.isActive && { color: colors.success }]}>
                    {editingUser.isActive ? "Disattiva account" : "Riattiva account"}
                  </Text>
                </TouchableOpacity>
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
    subtitle: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
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
    userCardInactive: { opacity: 0.55 },
    avatar: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { color: colors.primaryForeground, fontSize: 15, fontFamily: "Inter_700Bold" },
    userInfo: { flex: 1, gap: 3 },
    userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    userName: { fontSize: 14, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    meBadge: { backgroundColor: colors.primary + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    meBadgeText: { fontSize: 10, color: colors.primary, fontFamily: "Inter_600SemiBold" },
    userEmail: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    userTagsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    tag: { fontSize: 11, color: colors.primary, fontFamily: "Inter_500Medium" },
    userRight: { alignItems: "flex-end", gap: 6 },
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
    modalContent: { padding: 20, gap: 20, paddingBottom: 48 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontWeight: "500" as const, color: colors.foreground, fontFamily: "Inter_500Medium" },
    hintText: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
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
    switchRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    dangerBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 13, borderRadius: 12,
      borderWidth: 1, borderColor: colors.destructive + "60",
      backgroundColor: colors.destructive + "10",
    },
    successBtn: {
      borderColor: colors.success + "60",
      backgroundColor: colors.success + "10",
    },
    dangerBtnText: { fontSize: 14, color: colors.destructive, fontFamily: "Inter_600SemiBold" },
  });
