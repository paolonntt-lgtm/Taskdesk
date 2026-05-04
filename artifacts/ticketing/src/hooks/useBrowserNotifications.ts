import { useEffect, useRef, useCallback } from "react";

interface NotificationItem {
  id: number;
  isRead: boolean;
  notificationText: string;
  ticketId?: number | null;
  type?: string | null;
}

export interface NotifPrefByType {
  [type: string]: { inApp: boolean; browser: boolean; sound: boolean };
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

const isIT = () => (navigator.language || "").toLowerCase().startsWith("it");

const TYPE_META: Record<string, { emoji: string; it: string; en: string; requireInteraction?: boolean }> = {
  ticket_created:          { emoji: "🎫", it: "Nuovo ticket",      en: "New ticket",       requireInteraction: true },
  ticket_status_changed:   { emoji: "🔄", it: "Cambio stato",       en: "Status changed" },
  ticket_commented:        { emoji: "💬", it: "Nuovo commento",     en: "New comment" },
  ticket_assigned:         { emoji: "👤", it: "Ticket assegnato",   en: "Ticket assigned",  requireInteraction: true },
  ticket_priority_changed: { emoji: "⚠️", it: "Priorità aggiornata", en: "Priority changed" },
  system:                  { emoji: "ℹ️", it: "TaskDesk",            en: "TaskDesk" },
};

function buildNotificationTitle(type: string | null | undefined, ticketId?: number | null): string {
  const meta = TYPE_META[type ?? "system"] ?? TYPE_META.system;
  const label = isIT() ? meta.it : meta.en;
  const ticketPart = ticketId ? ` · #${ticketId}` : "";
  return `${meta.emoji} ${label}${ticketPart}`;
}

function showBrowserNotification(item: NotificationItem) {
  if (Notification.permission !== "granted") return;
  const { notificationText, ticketId, type } = item;

  const title = buildNotificationTitle(type, ticketId);
  const meta = TYPE_META[type ?? "system"] ?? TYPE_META.system;

  const now = new Date();
  const timeStr = now.toLocaleTimeString(isIT() ? "it-IT" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = `${notificationText}\n${timeStr}`;

  const notif = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `taskdesk-${type ?? "system"}-${ticketId ?? item.id}`,
    requireInteraction: meta.requireInteraction ?? false,
    silent: false,
  });

  if (ticketId) {
    notif.onclick = () => {
      window.focus();
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      window.location.href = `${base}/tickets/${ticketId}`;
    };
  }
}

function getPref(prefs: NotifPrefByType | undefined, type: string | null | undefined, channel: "browser" | "sound"): boolean {
  if (!prefs) return true;
  const t = type ?? "system";
  const p = prefs[t];
  if (!p) return true;
  return p[channel] !== false;
}

export function useBrowserNotifications(
  notifications: NotificationItem[],
  enabled: boolean,
  prefs?: NotifPrefByType
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
      notifications.forEach((n) => seenIds.current.add(n.id));
      initialized.current = true;
      return;
    }

    const newUnread = notifications.filter(
      (n) => !n.isRead && !seenIds.current.has(n.id)
    );
    if (newUnread.length === 0) return;

    let anySound = false;
    newUnread.forEach((n) => {
      seenIds.current.add(n.id);
      if (getPref(prefs, n.type, "browser")) {
        showBrowserNotification(n);
      }
      if (getPref(prefs, n.type, "sound")) {
        anySound = true;
      }
    });

    if (anySound) playChime();
  }, [notifications, enabled, prefs]);

  return { requestPermission };
}
