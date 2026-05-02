import { db, notificationsTable, usersTable } from "@workspace/db";

export async function createNotificationsForTicket(
  ticketId: number,
  text: string,
  excludeUserId: number
): Promise<void> {
  const users = await db.select({ id: usersTable.id }).from(usersTable);
  const targets = users.filter((u) => u.id !== excludeUserId);
  if (targets.length === 0) return;
  await db.insert(notificationsTable).values(
    targets.map((u) => ({
      userId: u.id,
      ticketId,
      notificationText: text,
      isRead: false,
    }))
  );
}

export async function createNotificationForUser(
  userId: number,
  ticketId: number | null,
  text: string
): Promise<void> {
  await db.insert(notificationsTable).values({
    userId,
    ticketId: ticketId ?? undefined,
    notificationText: text,
    isRead: false,
  });
}
