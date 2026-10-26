import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import * as Haptics from "expo-haptics";

type Mode = "login" | "register";
type Field = "name" | "email" | "password" | "confirm";

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
  const [focusedField, setFocusedField] = useState<Field | null>(null);

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
    <View style={s.root}>
      <View pointerEvents="none" style={s.decorLayer}>
        <View style={s.decorCircleLarge} />
        <View style={s.decorCircleSmall} />
      </View>
      <KeyboardAwareScrollViewCompat
        style={s.scrollView}
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
          },
        ]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <View style={s.logoTile}>
            <Image
              source={require("../assets/images/taskdesk-app-icon.png")}
              style={s.logo}
              resizeMode="contain"
              accessibilityLabel="TaskDesk"
            />
          </View>
          <Text style={s.brand}>TaskDesk</Text>
          <View style={s.secureNote}>
            <Feather name="shield" size={13} color={colors.secondaryForeground} />
            <Text style={s.secureNoteText}>{t.login.secureNote}</Text>
          </View>
        </View>

        <View style={s.intro}>
          <Text style={s.eyebrow}>{t.login.eyebrow}</Text>
          <Text style={s.title}>
            {mode === "login" ? t.login.signIn : t.login.register}
          </Text>
          <Text style={s.subtitle}>
            {mode === "login" ? t.login.loginIntro : t.login.registerIntro}
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
              <View style={[s.inputWrap, focusedField === "name" && s.inputWrapFocused]}>
                <Feather name="user" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Mario Rossi"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  importantForAutofill="yes"
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="next"
                  accessibilityLabel={t.login.name}
                />
              </View>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>{t.login.email}</Text>
            <View style={[s.inputWrap, focusedField === "email" && s.inputWrapFocused]}>
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="nome@azienda.it"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={mode === "login" ? "username" : "email"}
                  textContentType={mode === "login" ? "username" : "emailAddress"}
                  importantForAutofill="yes"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                returnKeyType="next"
                accessibilityLabel={t.login.email}
              />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t.login.password}</Text>
            <View style={[s.inputWrap, focusedField === "password" && s.inputWrapFocused]}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? t.login.passwordMin : "••••••••"}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPass}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                  textContentType={mode === "register" ? "newPassword" : "password"}
                  passwordRules={mode === "register" ? "minlength: 6;" : undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                  importantForAutofill="yes"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                returnKeyType={mode === "login" ? "done" : "next"}
                accessibilityLabel={t.login.password}
              />
              <Pressable
                onPress={() => setShowPass(!showPass)}
                style={s.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPass ? t.login.hidePassword : t.login.showPassword}
                hitSlop={8}
              >
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          {mode === "register" && (
            <View style={s.field}>
              <Text style={s.label}>{t.login.confirmPassword}</Text>
              <View
                style={[
                  s.inputWrap,
                  focusedField === "confirm" && s.inputWrapFocused,
                  confirm.length > 0 && confirm !== password && s.inputWrapError,
                ]}
              >
                <Feather name="lock" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={s.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder={t.login.confirmPlaceholder}
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  passwordRules="minlength: 6;"
                  autoCapitalize="none"
                  autoCorrect={false}
                  importantForAutofill="yes"
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
                  returnKeyType="done"
                  accessibilityLabel={t.login.confirmPassword}
                />
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              s.btn,
              loading && s.btnDisabled,
              pressed && !loading && s.btnPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <>
                <Text style={s.btnText}>
                  {mode === "login" ? t.login.submit : t.login.registerSubmit}
                </Text>
                <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
              </>
            )}
          </Pressable>

          <View style={s.switchRow}>
            <Text style={s.switchText}>
              {mode === "login" ? t.login.noAccount : t.login.hasAccount}
            </Text>
            <Pressable onPress={() => switchMode(mode === "login" ? "register" : "login")}>
              <Text style={s.switchLink}>
                {mode === "login" ? t.login.registerLink : t.login.loginLink}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={s.footer}>
          <View style={s.footerRule} />
          <Text style={s.footerText}>TaskDesk</Text>
          <View style={s.footerRule} />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    decorLayer: {
      ...StyleSheet.absoluteFill,
      overflow: "hidden",
    },
    decorCircleLarge: {
      position: "absolute",
      width: 300,
      height: 300,
      borderRadius: 150,
      top: -174,
      right: -88,
      backgroundColor: colors.secondary,
      opacity: 0.9,
    },
    decorCircleSmall: {
      position: "absolute",
      width: 170,
      height: 170,
      borderRadius: 85,
      top: 38,
      left: -112,
      backgroundColor: colors.accent,
      opacity: 0.08,
    },
    scrollView: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    header: { alignItems: "center", marginBottom: 28 },
    logoTile: {
      width: 84,
      height: 84,
      borderRadius: 25,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 5,
    },
    logo: { width: 70, height: 70, borderRadius: 18 },
    brand: {
      fontSize: 27,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.7,
    },
    secureNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.secondary,
    },
    secureNoteText: {
      color: colors.secondaryForeground,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
    },
    intro: { marginBottom: 20 },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.3,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.55,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.mutedForeground,
      marginTop: 6,
      fontFamily: "Inter_400Regular",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
      elevation: 3,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.destructive + "18",
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
      fontFamily: "Inter_400Regular",
    },
    field: { marginBottom: 15 },
    label: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      marginBottom: 7,
      fontFamily: "Inter_600SemiBold",
    },
    inputWrap: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
    },
    inputWrapFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.card,
    },
    inputWrapError: { borderColor: colors.destructive },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: {
      width: 32,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    btn: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 15,
      paddingHorizontal: 18,
      marginTop: 5,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 3,
    },
    btnDisabled: { opacity: 0.7 },
    btnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
    btnText: {
      color: colors.primaryForeground,
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 19,
      gap: 4,
    },
    switchText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    switchLink: {
      color: colors.primary,
      fontWeight: "600" as const,
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      paddingVertical: 4,
      paddingHorizontal: 3,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginTop: 26,
    },
    footerRule: {
      width: 38,
      height: 1,
      backgroundColor: colors.border,
    },
    footerText: {
      color: colors.mutedForeground,
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
  });
