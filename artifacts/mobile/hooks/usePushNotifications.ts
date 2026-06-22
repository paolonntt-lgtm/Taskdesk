import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { apiFetch } from "@/utils/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupAndroidNotificationChannel(): Promise<void> {
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

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  await setupAndroidNotificationChannel();

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
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      removeTokenFromServer();
      return;
    }

    registerForPushNotifications().then((token) => {
      if (token) saveTokenToServer(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is in foreground — handled by notification handler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { ticketId?: number };
      if (data?.ticketId) {
        router.push(`/ticket/${data.ticketId}`);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isLoggedIn]);
}
