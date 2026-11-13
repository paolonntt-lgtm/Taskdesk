import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { NotificationResponse } from "expo-notifications";
import { apiFetch } from "@/utils/api";
import {
  getNotificationResponseKey,
  getTicketIdFromNotificationResponse,
} from "@/utils/notificationNavigation";

type NotificationsModule = typeof import("expo-notifications");
export type PendingTicketNotification = { ticketId: number; sequence: number };

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
  const [pendingTicketNotification, setPendingTicketNotification] =
    useState<PendingTicketNotification | null>(null);

  useEffect(() => {
    // Remote push notifications are not supported in Expo Go on Android.
    if (Platform.OS === "web" || (Platform.OS === "android" && Constants.appOwnership === "expo")) return;

    let active = true;
    let responseSequence = 0;
    const recentResponses = new Map<string, number>();
    const initialize = async () => {
      try {
        const Notifications = await import("expo-notifications");
        if (!active) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const handleResponse = (response: NotificationResponse) => {
          const now = Date.now();
          for (const [key, receivedAt] of recentResponses) {
            if (now - receivedAt > 10_000) recentResponses.delete(key);
          }
          const responseKey = getNotificationResponseKey(response);
          const previousTime = responseKey ? recentResponses.get(responseKey) : undefined;
          if (responseKey && previousTime !== undefined && now - previousTime < 2_000) return;
          if (responseKey) recentResponses.set(responseKey, now);

          const ticketId = getTicketIdFromNotificationResponse(response);
          if (ticketId) {
            setPendingTicketNotification({ ticketId, sequence: ++responseSequence });
          }
          void Notifications.clearLastNotificationResponseAsync().catch((error) => {
            console.warn("[PushNotifications] Failed to clear handled notification response.", error);
          });
        };

        const responseListener =
          Notifications.addNotificationResponseReceivedListener(handleResponse);
        try {
          const lastResponse = await Notifications.getLastNotificationResponseAsync();
          if (active && lastResponse) handleResponse(lastResponse);
        } catch (error) {
          console.warn("[PushNotifications] Failed to read the launch notification response.", error);
        }

        return () => responseListener.remove();
      } catch (error) {
        console.warn("[PushNotifications] Push setup is unavailable in this runtime.", error);
      }
    };
    let removeResponseListener: (() => void) | undefined;
    void initialize().then((cleanup) => {
      removeResponseListener = cleanup;
      if (!active) cleanup?.();
    });

    return () => {
      active = false;
      removeResponseListener?.();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      void removeTokenFromServer();
      return;
    }
    // Remote push notifications are not supported in Expo Go on Android.
    if (Platform.OS === "web" || (Platform.OS === "android" && Constants.appOwnership === "expo")) return;

    let active = true;
    const register = async () => {
      try {
        const Notifications = await import("expo-notifications");
        const token = await registerForPushNotifications(Notifications);
        if (token && active) void saveTokenToServer(token);
      } catch (error) {
        console.warn("[PushNotifications] Push registration is unavailable in this runtime.", error);
      }
    };
    void register();
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  return pendingTicketNotification;
}
