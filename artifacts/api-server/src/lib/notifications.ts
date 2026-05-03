import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationPreferencesTable,
  usersTable,
  type NotificationType,
} from "@workspace/db";

/**
 * Returns the set of user IDs (from candidates) who have IN-APP notifications
 * enabled for the given type. Defaults to enabled when no preference row exists.
 */
async function filterByPreference(
  candidateIds: number[],
  type: NotificationType
): Promise<number[]> {
  if (candidateIds.length === 0) return [];
  const prefs = await db
    .select({
      userId: notificationPreferencesTable.userId,
      inApp: notificationPreferencesTable.inApp,
    })
    .from(notificationPreferencesTable)
    .where(
      and(
        eq(notificationPreferencesTable.type, type),
        inArray(notificationPreferencesTable.userId, candidateIds)
      )
    );
  const disabled = new Set(prefs.filter((p) => p.inApp === false).map((p) => p.userId));
  return candidateIds.filter((id) => !disabled.has(id));
}

export async function createNotificationsForTicket(
  ticketId: number,
  text: string,
  excludeUserId: number,
  type: NotificationType = "system"
): Promise<void> {
  const users = await db.select({ id: usersTable.id, isActive: usersTable.isActive }).from(usersTable);
  const candidates = users.filter((u) => u.id !== excludeUserId && u.isActive !== false).map((u) => u.id);
  const targets = await filterByPreference(candidates, type);
  if (targets.length === 0) return;
  await db.insert(notificationsTable).values(
    targets.map((id) => ({
      userId: id,
      ticketId,
      type,
      notificationText: text,
      isRead: false,
    }))
  );
}

export async function createNotificationForUser(
  userId: number,
  ticketId: number | null,
  text: string,
  type: NotificationType = "system"
): Promise<void> {
  const allowed = await filterByPreference([userId], type);
  if (allowed.length === 0) return;
  await db.insert(notificationsTable).values({
    userId,
    ticketId: ticketId ?? undefined,
    type,
    notificationText: text,
    isRead: false,
  });
}
