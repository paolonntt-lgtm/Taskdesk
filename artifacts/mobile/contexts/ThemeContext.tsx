import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform, useColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";

const THEME_PREFERENCE_STORAGE_KEY = "theme-preference";

interface ThemeContextValue {
  preference: ThemePreference;
  isLoaded: boolean;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const defaultValue: ThemeContextValue = {
  preference: "system",
  isLoaded: true,
  setThemePreference: async () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function applyNativeColorScheme(preference: ThemePreference): void {
  if (Platform.OS === "web" || typeof Appearance.setColorScheme !== "function") return;
  Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
      .then((saved) => {
        if (!isMounted) return;
        const nextPreference = isThemePreference(saved) ? saved : "system";
        setPreference(nextPreference);
        applyNativeColorScheme(nextPreference);
      })
      .catch((error) => {
        console.warn("Could not load the saved theme preference", error);
        if (isMounted) applyNativeColorScheme("system");
      })
      .finally(() => {
        if (isMounted) setIsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemePreference = useCallback(async (nextPreference: ThemePreference) => {
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
    } catch (error) {
      console.warn("Could not save the theme preference", error);
      throw error;
    }
    setPreference(nextPreference);
    applyNativeColorScheme(nextPreference);
  }, []);

  const value = useMemo(
    () => ({ preference, isLoaded, setThemePreference }),
    [preference, isLoaded, setThemePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

export function useResolvedColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const { preference } = useThemePreference();
  if (preference !== "system") return preference;
  return systemScheme === "dark" ? "dark" : "light";
}
