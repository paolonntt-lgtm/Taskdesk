import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform, Pressable } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { usePushNotifications } from "@/hooks/usePushNotifications";

if (Platform.OS !== "web" && process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
} else {
  setBaseUrl(null);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
});

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const { lang, t } = useLanguage();
  const colors = useColors();
  usePushNotifications(!!user);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  return (
    <Stack screenOptions={({ navigation, route }) => {
      const openedFromProfile =
        (route.params as { fromProfile?: unknown } | undefined)?.fromProfile === "1";
      return {
        headerBackTitle: lang === "it" ? "Indietro" : "Back",
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
        headerLeft: openedFromProfile
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={lang === "it" ? "Torna al profilo" : "Back to profile"}
                testID="profile-section-back-button"
                hitSlop={10}
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else router.replace("/(tabs)/profile");
                }}
                style={{ paddingRight: 12 }}
              >
                <Feather name="arrow-left" size={21} color={colors.foreground} />
              </Pressable>
            )
          : undefined,
      };
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="ticket/[id]"
        options={{
          title: "Dettaglio ticket",
          headerBackTitle: "Indietro",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="users"
        options={{
          title: lang === "it" ? "Gestione utenti" : "User management",
        }}
      />
      <Stack.Screen
        name="admin-settings"
        options={{
          title: t.adminSettings.title,
        }}
      />
      <Stack.Screen
        name="billing"
        options={{ title: lang === "it" ? "Fatturazione" : "Billing" }}
      />
      <Stack.Screen
        name="announcements"
        options={{ title: lang === "it" ? "Avvisi" : "Announcements" }}
      />
      <Stack.Screen
        name="superadmin"
        options={{ title: lang === "it" ? "Console piattaforma" : "Platform console" }}
      />
      <Stack.Screen name="notifications" options={{ title: t.notifications.title }} />
      <Stack.Screen
        name="ticket-trash"
        options={{ title: lang === "it" ? "Cestino ticket" : "Ticket trash" }}
      />
      <Stack.Screen name="clients/index" options={{ title: t.tabs.clients }} />
      <Stack.Screen name="time-report" options={{ title: t.tabs.hoursReport }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LanguageProvider>
                <AuthProvider>
                  <RootLayoutNav />
                </AuthProvider>
              </LanguageProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
