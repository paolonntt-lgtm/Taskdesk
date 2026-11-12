import React, { useEffect, useRef, useState } from "react";
import {
  Alert, AppState, Linking, View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Platform, useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiGet, PRIORITY_COLORS } from "@/utils/api";
import { getGetCurrentWeatherQueryKey, useGetCurrentWeather } from "@workspace/api-client-react";

const WEATHER_CONSENT_KEY = "taskdesk.dashboard.weather-consent.v1";
const LOCATION_FIX_TIMEOUT_MS = 15_000;
const REVERSE_GEOCODE_TIMEOUT_MS = 5_000;
const LOCATION_PERMISSION_TIMEOUT_MS = 60_000;
const LOCATION_SERVICES_TIMEOUT_MS = 5_000;

type WeatherConsent = "loading" | "unknown" | "accepted" | "declined";
type WeatherIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Location lookup timed out")), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function weatherIconName(code: number, isDay: boolean): WeatherIconName {
  if (code === 1000) return isDay ? "weather-sunny" : "weather-night";
  if (code === 1003) return "weather-partly-cloudy";
  if ([1030, 1135, 1147].includes(code)) return "weather-fog";
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return "weather-lightning-rainy";
  if ([1066, 1069, 1072, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258, 1261, 1264].includes(code)) {
    return "weather-snowy";
  }
  if ([1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)) {
    return "weather-rainy";
  }
  return "weather-cloudy";
}

interface DashboardStats {
  openTickets: number;
  inProgressTickets: number;
  urgentTickets: number;
  closedTickets: number;
}

interface Ticket {
  id: number;
  title: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  creator?: { name: string };
  latestActivity?: {
    actionType: string;
    actorName: string | null;
    createdAt: string;
  } | null;
}

function recentActivityLabel(actionType: string, lang: string) {
  const labels: Record<string, [string, string]> = {
    created: ["Ticket creato", "Ticket created"],
    status_changed: ["Stato modificato", "Status changed"],
    assigned: ["Ticket assegnato", "Ticket assigned"],
    reassigned: ["Assegnazione modificata", "Assignment changed"],
    unassigned: ["Assegnazione rimossa", "Assignment removed"],
    priority_changed: ["Priorità modificata", "Priority changed"],
    category_changed: ["Categoria modificata", "Category changed"],
    location_changed: ["Sede modificata", "Location changed"],
    comment_added: ["Commento aggiunto", "Comment added"],
    email_reply_sent: ["Risposta email inviata", "Email reply sent"],
    checklist_item_updated: ["Checklist aggiornata", "Checklist updated"],
    checklist_applied_from_template: ["Checklist applicata", "Checklist applied"],
    recurrence_set: ["Ricorrenza aggiornata", "Recurrence updated"],
    recurrence_created: ["Ticket ricorrente creato", "Recurring ticket created"],
    solution_marked: ["Soluzione registrata", "Solution recorded"],
  };
  const label = labels[actionType] ?? (actionType.startsWith("ticket_field_")
    ? ["Ticket aggiornato", "Ticket updated"]
    : ["Attività aggiornata", "Activity updated"]);
  return lang === "it" ? label[0] : label[1];
}

export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const singleRowStats = width >= 360;
  const s = styles(colors);
  const [now, setNow] = useState<Date>(() => new Date());
  const [gpsLocation, setGpsLocation] = useState<string | null>(null);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [weatherConsent, setWeatherConsent] = useState<WeatherConsent>("loading");
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions({
    get: Platform.OS !== "web",
  });
  const locationPromptedThisMount = useRef(false);
  const locationPromptActive = useRef(false);
  const weatherPromptActive = useRef(false);
  const onAppResume = useRef<() => void>(() => {});
  const weatherConsentKey = user?.id ? `${WEATHER_CONSENT_KEY}.${user.id}` : null;

  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const interval = setInterval(refreshClock, 60_000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshClock();
        onAppResume.current();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWeatherConsent("loading");
    if (!weatherConsentKey) {
      setWeatherConsent("unknown");
      return;
    }
    AsyncStorage.getItem(weatherConsentKey)
      .then((value) => {
        if (cancelled) return;
        setWeatherConsent(value === "accepted" || value === "declined" ? value : "unknown");
      })
      .catch(() => {
        if (!cancelled) setWeatherConsent("unknown");
      });
    return () => { cancelled = true; };
  }, [weatherConsentKey]);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiGet<DashboardStats>("/stats/dashboard"),
    enabled: !!user,
  });

  const { data: recentTickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["recent-tickets"],
    queryFn: () => apiGet<Ticket[]>("/stats/recent-tickets"),
    enabled: !!user,
  });

  const greetingHour = now.getHours();
  const greeting =
    greetingHour < 12
      ? t.dashboard.goodMorning
      : greetingHour < 18
        ? t.dashboard.goodAfternoon
        : t.dashboard.goodEvening;
  const greetingIcon = greetingHour < 12 ? "sunrise" : greetingHour < 18 ? "sun" : "moon";
  const firstName = user?.name?.split(" ")[0] ?? t.profile.user;
  const locale = lang === "it" ? "it-IT" : "en-US";
  const heroDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now).replace(/\.$/, "");
  const mainLocation = user?.mainLocation?.trim();
  const weatherParams = {
    lat: gpsCoordinates?.latitude ?? 0,
    lon: gpsCoordinates?.longitude ?? 0,
    lang: lang === "it" ? "it" as const : "en" as const,
  };
  const weatherQuery = useGetCurrentWeather(weatherParams, {
    query: {
      queryKey: getGetCurrentWeatherQueryKey(weatherParams),
      enabled: weatherConsent === "accepted" && gpsCoordinates !== null,
      staleTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });
  const displayLocation = Platform.OS === "web"
    ? weatherQuery.data?.locationName || gpsLocation || mainLocation
    : gpsLocation || weatherQuery.data?.locationName || mainLocation;

  const onRefresh = () => {
    void refetchStats();
    void refetchTickets();
    if (weatherConsent === "accepted" && gpsCoordinates) void weatherQuery.refetch();
  };

  const captureGpsLocation = async (askSystemPermission = false) => {
    try {
      const permission = Platform.OS === "web"
        ? { granted: true, canAskAgain: true }
        : locationPermission?.granted
          ? locationPermission
          : askSystemPermission && locationPermission?.canAskAgain
            ? await withTimeout(requestLocationPermission(), LOCATION_PERMISSION_TIMEOUT_MS)
            : locationPermission;
      if (!permission?.granted) {
        if (permission && !permission.canAskAgain) {
          Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationPermissionDenied, [
            { text: lang === "it" ? "Annulla" : "Cancel", style: "cancel" },
            {
              text: lang === "it" ? "Impostazioni" : "Settings",
              onPress: () => { void Linking.openSettings().catch(() => {}); },
            },
          ]);
        } else {
          Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationPermissionDenied);
        }
        return;
      }

      setIsGettingLocation(true);
      if (!(await withTimeout(Location.hasServicesEnabledAsync(), LOCATION_SERVICES_TIMEOUT_MS))) {
        Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationUnavailable);
        return;
      }

      let position: Location.LocationObject;
      try {
        position = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          LOCATION_FIX_TIMEOUT_MS,
        );
      } catch (currentPositionError) {
        const lastKnownPosition = await withTimeout(
          Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 5_000 }),
          2_500,
        ).catch(() => null);
        if (!lastKnownPosition) throw currentPositionError;
        position = lastKnownPosition;
      }
      const roundedCoordinates = {
        latitude: Math.round(position.coords.latitude * 100) / 100,
        longitude: Math.round(position.coords.longitude * 100) / 100,
      };
      setGpsCoordinates(roundedCoordinates);
      if (Platform.OS === "web") {
        setGpsLocation(`${roundedCoordinates.latitude.toFixed(2)}, ${roundedCoordinates.longitude.toFixed(2)}`);
      } else {
        try {
          const [address] = await withTimeout(
            Location.reverseGeocodeAsync({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
            REVERSE_GEOCODE_TIMEOUT_MS,
          );
          const area = address?.city ?? address?.subregion ?? address?.region;
          if (area) setGpsLocation([area, address?.country].filter(Boolean).join(", "));
          else setGpsLocation(mainLocation || null);
        } catch {
          setGpsLocation(mainLocation || null);
        }
      }
    } catch {
      Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationUnavailable);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const askForGpsLocation = () => {
    if (locationPermission?.granted) {
      void captureGpsLocation();
      return;
    }
    if (locationPromptActive.current) return;
    locationPromptActive.current = true;
    Alert.alert(t.dashboard.locationDisclosureTitle, t.dashboard.locationDisclosureMessage, [
      {
        text: lang === "it" ? "Annulla" : "Cancel",
        style: "cancel",
        onPress: () => { locationPromptActive.current = false; },
      },
      {
        text: t.dashboard.locationContinue,
        onPress: () => {
          void captureGpsLocation(true).finally(() => {
            locationPromptActive.current = false;
          });
        },
      },
    ], { cancelable: true, onDismiss: () => { locationPromptActive.current = false; } });
  };

  const saveWeatherConsent = (consent: "accepted" | "declined") => {
    setWeatherConsent(consent);
    if (weatherConsentKey) void AsyncStorage.setItem(weatherConsentKey, consent).catch(() => {});
  };

  const askForWeatherConsent = () => {
    if (weatherPromptActive.current || !gpsCoordinates || !weatherConsentKey) return;
    weatherPromptActive.current = true;
    Alert.alert(
      t.dashboard.weatherConsentTitle,
      t.dashboard.weatherConsentMessage,
      [
        {
          text: t.dashboard.weatherNotNow,
          style: "cancel",
          onPress: () => {
            weatherPromptActive.current = false;
            saveWeatherConsent("declined");
          },
        },
        {
          text: t.dashboard.weatherContinue,
          onPress: () => {
            weatherPromptActive.current = false;
            saveWeatherConsent("accepted");
          },
        },
      ],
      { cancelable: false },
    );
  };

  useEffect(() => {
    if (
      weatherConsent === "unknown" &&
      gpsCoordinates &&
      user?.id &&
      !weatherPromptActive.current
    ) {
      askForWeatherConsent();
    }
  }, [weatherConsent, gpsCoordinates, user?.id, lang]);

  const handleWeatherPress = () => {
    if (weatherConsent === "loading") return;
    if (!gpsCoordinates) {
      if (locationPermission?.granted) void captureGpsLocation();
      else askForGpsLocation();
      return;
    }
    if (weatherConsent !== "accepted") {
      askForWeatherConsent();
      return;
    }
    void weatherQuery.refetch();
  };

  onAppResume.current = () => {
    if (locationPermission?.granted) void captureGpsLocation();
    else if (locationPermission) askForGpsLocation();
  };

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      !user ||
      !locationPermission ||
      locationPromptedThisMount.current
    ) return;

    locationPromptedThisMount.current = true;
    if (locationPermission.granted) {
      void captureGpsLocation();
    } else {
      askForGpsLocation();
    }
  }, [user, locationPermission]);

  const statCards = [
    { label: t.dashboard.open, value: stats?.openTickets ?? 0, color: colors.primary, icon: "inbox" as const, filter: "status=open" },
    { label: t.dashboard.inProgress, value: stats?.inProgressTickets ?? 0, color: "#f1c21b", icon: "clock" as const, filter: "status=in_progress" },
    { label: t.dashboard.urgent, value: stats?.urgentTickets ?? 0, color: colors.destructive, icon: "alert-triangle" as const, filter: "priority=urgent" },
    { label: t.dashboard.closed, value: stats?.closedTickets ?? 0, color: colors.success, icon: "check-circle" as const, filter: "status=closed" },
  ];

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 100 : 0 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.headerOrbitLarge} pointerEvents="none" />
        <View style={s.headerOrbitSmall} pointerEvents="none" />
        <View style={s.greetingCopy}>
          <View style={s.greetingEyebrow}>
            <View style={s.greetingDot} />
            <Text style={s.greetingSubtitle} numberOfLines={1}>
              {lang === "it" ? "La tua giornata" : "Your day"}
            </Text>
          </View>
          <View style={s.greetingLine} testID="dashboard-greeting-line">
            <Text style={s.greeting}>{greeting}</Text>
            <Text
              style={s.greetingName}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="dashboard-greeting-name"
            >
              {firstName}
            </Text>
          </View>
          <View style={s.heroDetails}>
            <View style={s.heroDate}>
              <Feather name="calendar" size={16} color={colors.primaryForeground} />
              <Text style={s.heroDateText} testID="dashboard-hero-date">{heroDate}</Text>
            </View>
            {displayLocation ? (
              <View style={s.heroMetaItem}>
                <Feather name="map-pin" size={12} color={colors.primaryForeground} />
                <Text style={s.heroMetaText} numberOfLines={1} testID="dashboard-hero-location">
                  {displayLocation}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={s.heroMetaItem}
              onPress={askForGpsLocation}
              disabled={isGettingLocation || (Platform.OS !== "web" && !locationPermission)}
              activeOpacity={0.7}
              accessibilityRole="button"
              testID="dashboard-hero-gps-button"
            >
              {isGettingLocation
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Feather name="map-pin" size={12} color={colors.primaryForeground} />}
              <Text style={s.heroMetaText}>
                {isGettingLocation
                  ? (lang === "it" ? "Ricerca posizione…" : "Finding location…")
                  : gpsLocation ? t.dashboard.refreshGpsLocation : t.dashboard.useGpsLocation}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={s.greetingArtwork}
          onPress={handleWeatherPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            weatherQuery.data
              ? `${weatherQuery.data.temperatureC}°, ${weatherQuery.data.conditionText}. WeatherAPI.com`
              : t.dashboard.weatherTapToEnable
          }
          testID="dashboard-weather-card"
        >
          <LinearGradient
            colors={weatherQuery.data || greetingIcon === "moon"
              ? [colors.primary, colors.accent]
              : [colors.warning, colors.destructive]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.greetingIllustration}
          >
            {weatherQuery.data ? (
              <>
                <MaterialCommunityIcons
                  name={weatherIconName(weatherQuery.data.conditionCode, weatherQuery.data.isDay)}
                  size={27}
                  color={colors.primaryForeground}
                />
                <Text style={s.weatherTemperature}>{weatherQuery.data.temperatureC}°</Text>
                <Text style={s.weatherCondition} numberOfLines={1}>{weatherQuery.data.conditionText}</Text>
                <Text style={s.weatherAttribution}>WeatherAPI.com</Text>
              </>
            ) : (
              <>
                {weatherQuery.isLoading && weatherConsent === "accepted"
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Feather
                      name={greetingIcon as "sunrise" | "sun" | "moon"}
                      size={30}
                      color={colors.primaryForeground}
                    />}
                <Text style={s.weatherHint} numberOfLines={2}>
                  {weatherQuery.isError
                    ? t.dashboard.weatherRetry
                    : weatherQuery.isLoading
                      ? t.dashboard.weatherLoading
                      : t.dashboard.weatherTapToEnable}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {statsLoading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={[s.statsGrid, singleRowStats && s.statsGridSingleRow]}>
          {statCards.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[s.statCard, singleRowStats && s.statCardSingleRow, { borderLeftColor: c.color }]}
              onPress={() => router.push(`/(tabs)/tickets?${c.filter}` as any)}
              activeOpacity={0.75}
            >
              <Feather name={c.icon} size={singleRowStats ? 14 : 16} color={c.color} />
              <Text style={[s.statValue, singleRowStats && s.statValueSingleRow]}>{c.value}</Text>
              <Text
                style={[s.statLabel, singleRowStats && s.statLabelSingleRow]}
                numberOfLines={singleRowStats ? 1 : undefined}
                adjustsFontSizeToFit={singleRowStats}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t.dashboard.recentActivity}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/tickets")}>
            <Text style={s.seeAll}>{t.dashboard.seeAll}</Text>
          </TouchableOpacity>
        </View>

        {ticketsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : recentTickets.length === 0 ? (
          <View style={s.empty}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>{t.dashboard.noRecentTickets}</Text>
          </View>
        ) : (
          recentTickets.slice(0, 5).map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={s.ticketRow}
              onPress={() => router.push(`/ticket/${ticket.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLORS[ticket.priority] ?? colors.muted }]} />
              <View style={s.ticketInfo}>
                <Text style={s.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                <Text
                  style={s.ticketActivity}
                  numberOfLines={1}
                  testID={`dashboard-recent-ticket-activity-${ticket.id}`}
                >
                  {ticket.latestActivity
                    ? [
                        recentActivityLabel(ticket.latestActivity.actionType, lang),
                        ticket.latestActivity.actorName,
                      ].filter(Boolean).join(" · ")
                    : t.dashboard.activityNotRecorded}
                </Text>
                <Text style={s.ticketMeta}>#{ticket.id} · {t.status[ticket.status] ?? ticket.status}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 18, paddingTop: 16, gap: 2 },
    header: {
    minHeight: 194,
      marginBottom: 20,
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderRadius: colors.radius * 2.4,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 5,
    },
    headerGlow: {
      position: "absolute",
      right: -56,
      bottom: -106,
      width: 214,
      height: 214,
      borderRadius: 107,
      backgroundColor: colors.primaryForeground,
      opacity: 0.12,
    },
    headerOrbitLarge: {
      position: "absolute",
      right: -30,
      top: -104,
      width: 224,
      height: 224,
      borderRadius: 112,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.17,
    },
    headerOrbitSmall: {
      position: "absolute",
      right: -5,
      top: -78,
      width: 172,
      height: 172,
      borderRadius: 86,
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      opacity: 0.13,
    },
    greetingCopy: { flex: 1, gap: 14, zIndex: 1, minWidth: 0 },
    greetingEyebrow: { flexDirection: "row", alignItems: "center", gap: 9 },
    greetingDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accentForeground,
      opacity: 0.95,
    },
    greetingLine: { minWidth: 0, gap: 0 },
    greeting: {
      fontSize: 15,
      fontWeight: "500" as const,
      color: colors.primaryForeground,
      opacity: 0.84,
      fontFamily: "Inter_500Medium",
    },
    greetingName: {
      fontSize: 31,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.7,
    },
    heroDetails: { gap: 5, marginTop: 2 },
    heroDate: { flexDirection: "row", alignItems: "center", gap: 8 },
    heroDateText: {
      flexShrink: 1,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.2,
    },
    heroMetaItem: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    heroMetaText: {
      flexShrink: 1,
      fontSize: 10,
      lineHeight: 14,
      color: colors.primaryForeground,
      opacity: 0.84,
      fontFamily: "Inter_500Medium",
    },
    greetingSubtitle: {
      fontSize: 10,
      color: colors.primaryForeground,
      opacity: 0.86,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontFamily: "Inter_600SemiBold",
    },
    greetingArtwork: {
      width: 92,
      height: 92,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
      zIndex: 1,
    },
    greetingIllustration: {
      width: 78,
      height: 82,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.primaryForeground,
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    weatherTemperature: {
      marginTop: -2,
      fontSize: 17,
      lineHeight: 19,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    weatherCondition: {
      maxWidth: 70,
      fontSize: 8,
      lineHeight: 10,
      color: colors.primaryForeground,
      opacity: 0.9,
      fontFamily: "Inter_500Medium",
    },
    weatherAttribution: {
      fontSize: 5.5,
      lineHeight: 7,
      color: colors.primaryForeground,
      opacity: 0.78,
      fontFamily: "Inter_400Regular",
    },
    weatherHint: {
      maxWidth: 66,
      textAlign: "center",
      fontSize: 8,
      lineHeight: 10,
      color: colors.primaryForeground,
      opacity: 0.9,
      fontFamily: "Inter_500Medium",
    },
    loadingRow: { height: 120, alignItems: "center", justifyContent: "center" },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
    statsGridSingleRow: { flexWrap: "nowrap", gap: 6 },
    statCard: {
      flex: 1, minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: colors.radius + 3, padding: 10,
      borderLeftWidth: 3,
      gap: 5,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.055, shadowRadius: 8, elevation: 1,
    },
    statCardSingleRow: { minWidth: 0, paddingHorizontal: 5, paddingVertical: 8, gap: 3, alignItems: "center" },
    statValue: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, fontFamily: "Inter_700Bold" },
    statValueSingleRow: { fontSize: 19 },
    statLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    statLabelSingleRow: { fontSize: 11, lineHeight: 13, textAlign: "center" },
    section: {},
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: "600" as const, color: colors.foreground, fontFamily: "Inter_600SemiBold" },
    seeAll: { fontSize: 14, color: colors.primary, fontFamily: "Inter_500Medium" },
    empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
    emptyText: { color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" },
    ticketRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius + 2, padding: 14, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, gap: 12,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.045, shadowRadius: 6, elevation: 1,
    },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    ticketInfo: { flex: 1 },
    ticketTitle: { fontSize: 14, fontWeight: "500" as const, color: colors.foreground, fontFamily: "Inter_500Medium" },
    ticketActivity: { fontSize: 12, color: colors.primary, marginTop: 3, fontFamily: "Inter_600SemiBold" },
    ticketMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" },
  });
