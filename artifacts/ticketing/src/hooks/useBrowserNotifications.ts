import { useEffect, useRef, useCallback } from "react";

interface NotificationItem {
  id: number;
  isRead: boolean;
  notificationText: string;
  ticketId?: number | null;
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const notes = [880, 1108.73, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);

      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });

    setTimeout(() => ctx.close(), 2000);
  } catch {
    // silently ignore if audio not available
  }
}

function showBrowserNotification(text: string, ticketId?: number | null) {
  if (Notification.permission !== "granted") return;
  const title = "TaskDesk";
  const body = text;
  const notif = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `taskdesk-ticket-${ticketId ?? "general"}`,
  });
  if (ticketId) {
    notif.onclick = () => {
      window.focus();
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      window.location.href = `${base}/tickets/${ticketId}`;
    };
  }
}

export function useBrowserNotifications(
  notifications: NotificationItem[],
  enabled: boolean
) {
  const seenIds = useRef<Set<number>>(new Set());
  const initialized = useRef(false);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "default") {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  }, []);

  useEffect(() => {
    if (!enabled || notifications.length === 0) return;

    if (!initialized.current) {
      // On first load, record all existing notifications as already seen
      // so we don't spam the user with old ones
      notifications.forEach((n) => seenIds.current.add(n.id));
      initialized.current = true;
      return;
    }

    const newUnread = notifications.filter(
      (n) => !n.isRead && !seenIds.current.has(n.id)
    );

    if (newUnread.length === 0) return;

    newUnread.forEach((n) => {
      seenIds.current.add(n.id);
      showBrowserNotification(n.notificationText, n.ticketId);
    });

    // Play chime once for all new notifications
    playChime();
  }, [notifications, enabled]);

  return { requestPermission };
}
