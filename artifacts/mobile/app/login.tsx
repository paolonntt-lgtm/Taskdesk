import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import * as Haptics from "expo-haptics";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setName("");
    setEmail("");
    setPassword("");
    setConfirm("");
  };

  const handleSubmit = async () => {
    setError(null);
    if (mode === "register") {
      if (!name.trim()) { setError(t.login.errorName); return; }
      if (password.length < 6) { setError(t.login.errorPasswordMin); return; }
      if (password !== confirm) { setError(t.login.errorPasswordMatch); return; }
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (e: any) {
      setError(e.message || t.login.errorGeneric);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.iconWrap}>
            <Feather name="check-square" size={32} color={colors.primaryForeground} />
          </View>
          <Text style={s.brand}>TaskDesk</Text>
          <Text style={s.subtitle}>
            {mode === "login" ? t.login.signIn : t.login.register}
          </Text>
        </View>

        <View style={s.card}>
          {error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {mode === "register" && (
            <View style={s.field}>
              <Text style={s.label}>{t.login.name}</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Mario Rossi"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>{t.login.email}</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="nome@azienda.it"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t.login.password}</Text>
            <View style={s.passWrap}>
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? t.login.passwordMin : "••••••••"}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPass}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === "register" && (
            <View style={s.field}>
              <Text style={s.label}>{t.login.confirmPassword}</Text>
              <TextInput
                style={[s.input, confirm.length > 0 && confirm !== password && { borderColor: colors.destructive }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t.login.confirmPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPass}
                autoComplete="new-password"
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={s.btnText}>
                {mode === "login" ? t.login.submit : t.login.registerSubmit}
              </Text>
            )}
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchText}>
              {mode === "login" ? t.login.noAccount : t.login.hasAccount}
            </Text>
            <TouchableOpacity onPress={() => switchMode(mode === "login" ? "register" : "login")}>
              <Text style={s.switchLink}> {mode === "login" ? t.login.registerLink : t.login.loginLink}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, paddingHorizontal: 24 },
    header: { alignItems: "center", marginBottom: 32 },
    iconWrap: {
      width: 64, height: 64, borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    },
    brand: { fontSize: 28, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    subtitle: { fontSize: 15, color: colors.mutedForeground, marginTop: 4, fontFamily: "Inter_400Regular" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.destructive + "18",
      borderRadius: 8, padding: 12, marginBottom: 16,
    },
    errorText: { color: colors.destructive, fontSize: 13, flex: 1, fontFamily: "Inter_400Regular" },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: colors.foreground, fontFamily: "Inter_400Regular",
    },
    passWrap: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingRight: 12,
    },
    eyeBtn: { padding: 4 },
    btn: {
      backgroundColor: colors.primary, borderRadius: 10,
      paddingVertical: 14, alignItems: "center", marginTop: 8,
    },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
    switchText: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
    switchLink: { color: colors.primary, fontWeight: "600" as const, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
