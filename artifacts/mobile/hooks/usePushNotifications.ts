import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
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

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

async function saveTokenToServer(token: string): Promise<void> {
  try {
    await apiFetch("/notifications/push-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch {
    // silently ignore — token will be retried on next login
  }
}

async function removeTokenFromServer(): Promise<void> {
  try {
    await apiFetch("/notifications/push-token", { method: "DELETE" });
  } catch {
    // silently ignore
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
