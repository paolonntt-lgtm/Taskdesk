import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, or, inArray } from "drizzle-orm";
import { db, notificationsTable, ticketsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  const notifications = await db
    .select({
      id: notificationsTable.id,
      userId: notificationsTable.userId,
      ticketId: notificationsTable.ticketId,
      dailyReportId: notificationsTable.dailyReportId,
      ticketNumber: ticketsTable.ticketNumber,
      type: notificationsTable.type,
      notificationText: notificationsTable.notificationText,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .where(and(
      eq(notificationsTable.userId, currentUser.id),
      currentUser.role === "admin"
        ? undefined
        : or(isNull(notificationsTable.ticketId), eq(ticketsTable.visibility, "organization")),
    ))
    .orderBy(desc(notificationsTable.createdAt));

  res.setHeader("Cache-Control", "no-cache, private");
  res.json(notifications);
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;

  if (!Number.isInteger(id) || id < 1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [ownedNotification] = await db
    .select({
      id: notificationsTable.id,
      ticketVisibility: ticketsTable.visibility,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id)))
    .limit(1);

  if (
    !ownedNotification ||
    (currentUser.role !== "admin" && ownedNotification.ticketVisibility === "admins")
  ) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id)))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(notification);
});

router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  if (currentUser.role === "admin") {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.userId, currentUser.id), eq(notificationsTable.isRead, false)));
  } else {
    const visibleNotifications = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
      .where(and(
        eq(notificationsTable.userId, currentUser.id),
        eq(notificationsTable.isRead, false),
        or(isNull(notificationsTable.ticketId), eq(ticketsTable.visibility, "organization")),
      ));

    if (visibleNotifications.length > 0) {
      await db
        .update(notificationsTable)
        .set({ isRead: true })
        .where(inArray(notificationsTable.id, visibleNotifications.map(({ id }) => id)));
    }
  }

  res.json({ success: true, message: "Tutte le notifiche marcate come lette" });
});

const pushTokenSchema = z.object({ token: z.string().min(1).max(500) });

router.post("/notifications/push-token", requireAuth, async (req, res): Promise<void> => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Token non valido" });
    return;
  }
  const currentUser = (req as any).currentUser;
  await db
    .update(usersTable)
    .set({ expoPushToken: parsed.data.token })
    .where(eq(usersTable.id, currentUser.id));
  res.json({ success: true });
});

router.delete("/notifications/push-token", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  await db
    .update(usersTable)
    .set({ expoPushToken: null })
    .where(eq(usersTable.id, currentUser.id));
  res.json({ success: true });
});

router.post("/notifications/test-push", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const [user] = await db
    .select({ expoPushToken: usersTable.expoPushToken })
    .from(usersTable)
    .where(eq(usersTable.id, currentUser.id));

  if (!user?.expoPushToken) {
    res.status(400).json({ error: "No push token registered for your account" });
    return;
  }

  try {
    const result = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{
        to: user.expoPushToken,
        sound: "default",
        title: "TaskDesk",
        body: "Push notifications are working correctly",
        data: {},
      }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) {
      res.status(502).json({ error: "Push delivery failed" });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(502).json({ error: "Push delivery failed" });
  }
});

export default router;
