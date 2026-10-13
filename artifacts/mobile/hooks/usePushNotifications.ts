import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { apiFetch } from "@/utils/api";

type NotificationsModule = typeof import("expo-notifications");
type NotificationSubscription = { remove: () => void };

async function setupAndroidNotificationChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("taskdesk-default", {
    name: "TaskDesk",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    enableLights: true,
    lightColor: "#0f62fe",
    sound: "default",
    showBadge: true,
  });
}

function resolveProjectId(): string | null {
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (
    !fromConfig ||
    fromConfig === "YOUR_EAS_PROJECT_ID" ||
    fromConfig.trim() === ""
  ) {
    return null;
  }

  return fromConfig as string;
}

async function registerForPushNotifications(Notifications: NotificationsModule): Promise<string | null> {
  if (Platform.OS === "web") return null;

  await setupAndroidNotificationChannel(Notifications);

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[PushNotifications] Permission not granted — status:", finalStatus);
    return null;
  }

  const projectId = resolveProjectId();

  if (!projectId) {
    console.warn(
      "[PushNotifications] EAS projectId is missing or still set to placeholder. " +
        "Follow PLAY_STORE_SETUP.md Step 1 to run `eas init` and update app.json."
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[PushNotifications] Token obtained:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.error("[PushNotifications] Failed to get push token:", err);
    return null;
  }
}

async function saveTokenToServer(token: string): Promise<void> {
  try {
    await apiFetch("/notifications/push-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.warn("[PushNotifications] Failed to save token to server:", err);
  }
}

async function removeTokenFromServer(): Promise<void> {
  try {
    await apiFetch("/notifications/push-token", { method: "DELETE" });
  } catch (err) {
    console.warn("[PushNotifications] Failed to remove token from server:", err);
  }
}

export function usePushNotifications(isLoggedIn: boolean) {
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      void removeTokenFromServer();
      return;
    }
    // Remote push notifications are not supported in Expo Go on Android.
    // Keep iOS Expo Go enabled, and avoid loading the native module in web.
    if (Platform.OS === "web" || (Platform.OS === "android" && Constants.appOwnership === "expo")) return;

    let active = true;
    const initialize = async () => {
      try {
        const Notifications = await import("expo-notifications");
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const token = await registerForPushNotifications(Notifications);
        if (token && active) void saveTokenToServer(token);

        if (!active) return;
        notificationListener.current = Notifications.addNotificationReceivedListener(() => {
          // Foreground notifications are also available in the in-app inbox.
        });
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as { ticketId?: number };
          if (data?.ticketId) router.push(`/ticket/${data.ticketId}`);
        });
      } catch (error) {
        console.warn("[PushNotifications] Push setup is unavailable in this runtime.", error);
      }
    };
    void initialize();

    return () => {
      active = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [isLoggedIn]);
}
