import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationPreferencesTable,
  usersTable,
  type NotificationType,
} from "@workspace/db";
import { sendEmail, buildNotificationEmail } from "./email";
import { logger } from "./logger";

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
    map.set(id, { userId: id, inApp: true, email: true });
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

function appBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",").map((d) => d.trim()).filter(Boolean) ?? [];
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost";
}

async function dispatchEmails(
  recipients: Array<{ id: number; name: string | null; email: string | null }>,
  prefs: Map<number, PrefForUser>,
  text: string,
  ticketId: number | null
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
      return sendEmail({ to: u.email!, subject, html, text: body }).then((r) => {
        if (!r.ok) logger.warn({ userId: u.id, err: r.error }, "notification email failed");
      });
    })
  );
}

export async function createNotificationsForTicket(
  ticketId: number,
  text: string,
  excludeUserId: number,
  type: NotificationType = "system"
): Promise<void> {
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isActive: usersTable.isActive })
    .from(usersTable);
  const candidates = users.filter((u) => u.id !== excludeUserId && u.isActive !== false);
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

  // Email dispatch (independent of in-app)
  void dispatchEmails(candidates, prefs, text, ticketId);
}

export async function createNotificationForUser(
  userId: number,
  ticketId: number | null,
  text: string,
  type: NotificationType = "system"
): Promise<void> {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
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
  }

  void dispatchEmails([user], prefs, text, ticketId);
}
