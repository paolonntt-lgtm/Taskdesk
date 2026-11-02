import { Router, type IRouter } from "express";
import { eq, and, desc, gt, isNull, or, inArray } from "drizzle-orm";
import { db, notificationsTable, organizationsTable, ticketsTable, usersTable, workspaceInviteTokensTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

function getNotificationWorkspaceAccess(currentUser: any) {
  const workspaces = Array.isArray(currentUser.workspaces) ? currentUser.workspaces : [];
  const workspaceIds = workspaces
    .map((workspace: any) => Number(workspace.id))
    .filter((id: number) => Number.isInteger(id) && id > 0);
  const homeOrganizationId = currentUser.billingOrganizationId ?? currentUser.organizationId ?? null;
  const workspaceRoles = new Map<number, string>(
    workspaces.map((workspace: any) => [Number(workspace.id), workspace.role]),
  );
  const canSeeHomeWorkspace = homeOrganizationId != null && workspaceIds.includes(homeOrganizationId);
  const scope = workspaceIds.length === 0
    ? eq(notificationsTable.id, -1)
    : canSeeHomeWorkspace
      ? or(inArray(notificationsTable.organizationId, workspaceIds), isNull(notificationsTable.organizationId))
      : inArray(notificationsTable.organizationId, workspaceIds);

  return { workspaceIds, homeOrganizationId, workspaceRoles, workspaces, scope };
}

function canViewNotification(
  notification: { organizationId: number | null; ticketId: number | null; ticketVisibility: string | null },
  workspaceRoles: Map<number, string>,
  homeOrganizationId: number | null,
): boolean {
  if (notification.ticketId == null || notification.ticketVisibility !== "admins") return true;
  const workspaceId = notification.organizationId ?? homeOrganizationId;
  return workspaceId != null && workspaceRoles.get(workspaceId) === "admin";
}

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { workspaceIds, homeOrganizationId, workspaceRoles, workspaces, scope } =
    getNotificationWorkspaceAccess(currentUser);

  const rows = await db
    .select({
      id: notificationsTable.id,
      userId: notificationsTable.userId,
      organizationId: notificationsTable.organizationId,
      ticketId: notificationsTable.ticketId,
      dailyReportId: notificationsTable.dailyReportId,
      workspaceInviteToken: workspaceInviteTokensTable.token,
      ticketNumber: ticketsTable.ticketNumber,
      ticketVisibility: ticketsTable.visibility,
      type: notificationsTable.type,
      notificationText: notificationsTable.notificationText,
      isRead: notificationsTable.isRead,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .leftJoin(workspaceInviteTokensTable, and(
      eq(notificationsTable.workspaceInviteId, workspaceInviteTokensTable.id),
      eq(workspaceInviteTokensTable.inviteeUserId, currentUser.id),
      isNull(workspaceInviteTokensTable.revokedAt),
      isNull(workspaceInviteTokensTable.acceptedAt),
      gt(workspaceInviteTokensTable.expiresAt, new Date()),
    ))
    .where(and(
      eq(notificationsTable.userId, currentUser.id),
      scope,
    ))
    .orderBy(desc(notificationsTable.createdAt));

  const notifications = rows.filter((notification) =>
    canViewNotification(notification, workspaceRoles, homeOrganizationId),
  );
  const workspaceNameById = new Map<number, string>(
    workspaces.map((workspace: any) => [Number(workspace.id), workspace.name]),
  );
  const pendingInvites = await db.select({
    token: workspaceInviteTokensTable.token,
    workspaceId: workspaceInviteTokensTable.workspaceOrganizationId,
    workspaceName: organizationsTable.name,
  }).from(workspaceInviteTokensTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, workspaceInviteTokensTable.workspaceOrganizationId))
    .where(and(
      eq(workspaceInviteTokensTable.inviteeUserId, currentUser.id),
      isNull(workspaceInviteTokensTable.revokedAt),
      isNull(workspaceInviteTokensTable.acceptedAt),
      gt(workspaceInviteTokensTable.expiresAt, new Date()),
    ))
    .orderBy(desc(workspaceInviteTokensTable.id));
  const notificationsWithWorkspaces = notifications.map((notification) => {
    const invite = pendingInvites.find(({ token }) => token === notification.workspaceInviteToken) ??
      (!notification.workspaceInviteToken && notification.type === "system" &&
        /\b(invito|invitation)\b/i.test(notification.notificationText)
        ? pendingInvites.find(({ workspaceName }) => notification.notificationText.includes(workspaceName))
        : undefined);
    const { ticketVisibility: _ticketVisibility, ...visibleNotification } = notification;
    const workspaceId = invite?.workspaceId ?? notification.organizationId ?? homeOrganizationId;
    return {
      ...visibleNotification,
      workspaceInviteToken: invite?.token ?? notification.workspaceInviteToken,
      workspaceName: invite?.workspaceName ?? (workspaceId == null ? null : workspaceNameById.get(workspaceId) ?? null),
    };
  });

  res.setHeader("Cache-Control", "no-cache, private");
  res.json(notificationsWithWorkspaces);
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const { homeOrganizationId, workspaceRoles, scope } = getNotificationWorkspaceAccess(currentUser);

  if (!Number.isInteger(id) || id < 1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [ownedNotification] = await db
    .select({
      id: notificationsTable.id,
      organizationId: notificationsTable.organizationId,
      ticketId: notificationsTable.ticketId,
      ticketVisibility: ticketsTable.visibility,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id), scope))
    .limit(1);

  if (
    !ownedNotification ||
    !canViewNotification(ownedNotification, workspaceRoles, homeOrganizationId)
  ) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id), scope))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(notification);
});

router.patch("/notifications/:id/unread", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const { homeOrganizationId, workspaceRoles, scope } = getNotificationWorkspaceAccess(currentUser);

  if (!Number.isInteger(id) || id < 1) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [ownedNotification] = await db
    .select({
      id: notificationsTable.id,
      organizationId: notificationsTable.organizationId,
      ticketId: notificationsTable.ticketId,
      ticketVisibility: ticketsTable.visibility,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id), scope))
    .limit(1);

  if (
    !ownedNotification ||
    !canViewNotification(ownedNotification, workspaceRoles, homeOrganizationId)
  ) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: false })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, currentUser.id), scope))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(notification);
});

router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const { homeOrganizationId, workspaceRoles, scope } = getNotificationWorkspaceAccess(currentUser);
  const unreadNotifications = await db
    .select({
      id: notificationsTable.id,
      organizationId: notificationsTable.organizationId,
      ticketId: notificationsTable.ticketId,
      ticketVisibility: ticketsTable.visibility,
    })
    .from(notificationsTable)
    .leftJoin(ticketsTable, eq(notificationsTable.ticketId, ticketsTable.id))
    .where(and(
      eq(notificationsTable.userId, currentUser.id),
      eq(notificationsTable.isRead, false),
      scope,
    ));
  const visibleIds = unreadNotifications
    .filter((notification) => canViewNotification(notification, workspaceRoles, homeOrganizationId))
    .map(({ id }) => id);

  if (visibleIds.length > 0) {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.userId, currentUser.id),
        inArray(notificationsTable.id, visibleIds),
        scope,
      ));
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
    const responseBody = await result.json().catch(() => null) as {
      data?: { status?: string; details?: { error?: string } } | Array<{ status?: string; details?: { error?: string } }>;
      errors?: Array<{ code?: string }>;
    } | null;
    const ticket = Array.isArray(responseBody?.data) ? responseBody.data[0] : responseBody?.data;
    if (!result.ok || ticket?.status !== "ok") {
      const reason = ticket?.details?.error ?? responseBody?.errors?.[0]?.code ?? "unknown";
      res.status(502).json({ error: `Push service rejected the notification (${reason})` });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(502).json({ error: "Push delivery failed" });
  }
});

export default router;
