import { and, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationPreferencesTable,
  usersTable,
  type NotificationType,
} from "@workspace/db";
import { sendEmailForOrg, buildNotificationEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { logger } from "./logger";

async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  ticketId: number | null
): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({
    to,
    sound: "default" as const,
    title,
    body,
    data: ticketId ? { ticketId } : {},
  }));
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "expo push send failed");
    }
  } catch (err) {
    logger.warn({ err }, "expo push send error");
  }
}

interface PrefForUser {
  userId: number;
  inApp: boolean;
  email: boolean;
}

/**
 * Returns per-user channel preferences (in-app + email) for the given type.
 * Defaults to enabled when no preference row exists.
 */
async function getChannelPrefs(
  candidateIds: number[],
  type: NotificationType
): Promise<Map<number, PrefForUser>> {
  const map = new Map<number, PrefForUser>();
  for (const id of candidateIds) {
    map.set(id, { userId: id, inApp: true, email: false });
  }
  if (candidateIds.length === 0) return map;

  const rows = await db
    .select({
      userId: notificationPreferencesTable.userId,
      inApp: notificationPreferencesTable.inApp,
      email: notificationPreferencesTable.email,
    })
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.type, type),
        inArray(notificationPreferencesTable.userId, candidateIds)
      )
    );
  for (const r of rows) {
    map.set(r.userId, { userId: r.userId, inApp: r.inApp, email: r.email });
  }
  return map;
}

async function dispatchEmails(
  recipients: Array<{ id: number; name: string | null; email: string | null }>,
  prefs: Map<number, PrefForUser>,
  text: string,
  ticketId: number | null,
  orgId?: number | null
): Promise<void> {
  const baseUrl = appBaseUrl();
  const targets = recipients.filter((u) => {
    const p = prefs.get(u.id);
    return p?.email !== false && !!u.email;
  });
  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map((u) => {
      const { subject, html, text: body } = buildNotificationEmail({
        recipientName: u.name ?? u.email ?? "",
        text,
        ticketId,
        appBaseUrl: baseUrl,
      });
      return sendEmailForOrg(orgId, { to: u.email!, subject, html, text: body }).then((r) => {
        if (!r.ok) logger.warn({ userId: u.id, orgId, err: r.error }, "notification email failed");
      });
    })
  );
}

export async function createNotificationsForTicket(
  ticketId: number,
  text: string,
  excludeUserId: number,
  type: NotificationType = "system",
  organizationId?: number | null
): Promise<void> {
  const conditions = [ne(usersTable.id, excludeUserId), eq(usersTable.isActive, true)];
  if (organizationId != null) conditions.push(eq(usersTable.organizationId, organizationId));

  const candidates = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(and(...conditions));
  if (candidates.length === 0) return;

  const prefs = await getChannelPrefs(candidates.map((u) => u.id), type);

  // In-app inserts
  const inAppTargets = candidates.filter((u) => prefs.get(u.id)?.inApp !== false).map((u) => u.id);
  if (inAppTargets.length > 0) {
    await db.insert(notificationsTable).values(
      inAppTargets.map((id) => ({
        userId: id,
        ticketId,
        type,
        notificationText: text,
        isRead: false,
      }))
    );
  }

  // Push notifications
  const pushTokens = candidates
    .filter((u) => prefs.get(u.id)?.inApp !== false && u.expoPushToken)
    .map((u) => u.expoPushToken!);
  void sendExpoPushNotifications(pushTokens, "TaskDesk", text, ticketId);

  // Email dispatch (independent of in-app)
  void dispatchEmails(candidates, prefs, text, ticketId, organizationId);
}

export async function createNotificationForUser(
  userId: number,
  ticketId: number | null,
  text: string,
  type: NotificationType = "system",
  organizationId?: number | null
): Promise<void> {
  const conditions = [eq(usersTable.id, userId)];
  if (organizationId != null) conditions.push(eq(usersTable.organizationId, organizationId));

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(and(...conditions));
  if (!user) return;

  const prefs = await getChannelPrefs([userId], type);
  const p = prefs.get(userId);

  if (p?.inApp !== false) {
    await db.insert(notificationsTable).values({
      userId,
      ticketId: ticketId ?? undefined,
      type,
      notificationText: text,
      isRead: false,
    });
    if (user.expoPushToken) {
      void sendExpoPushNotifications([user.expoPushToken], "TaskDesk", text, ticketId);
    }
  }

  void dispatchEmails([user], prefs, text, ticketId, organizationId);
}
