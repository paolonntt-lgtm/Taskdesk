import { and, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationPreferencesTable,
  ticketSubscriptionsTable,
  usersTable,
  ticketsTable,
  organizationsTable,
  workspaceMembershipsTable,
  type NotificationType,
} from "@workspace/db";
import { sendEmailForOrg, buildNotificationEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { logger } from "./logger";
import { renderNotificationText, type NotificationContent, type NotificationLanguage } from "./notificationText";

type NotificationRecipient = {
  id: number;
  name: string | null;
  email: string | null;
  expoPushToken?: string | null;
  preferredLanguage?: string | null;
};

function languageForRecipient(language: string | null | undefined): NotificationLanguage {
  return language === "it" ? "it" : "en";
}

async function getOrgRecipients(organizationId: number): Promise<Array<{ id: number; role: string }>> {
  const [organization] = await db.select({ shared: organizationsTable.isSharedWorkspace })
    .from(organizationsTable).where(eq(organizationsTable.id, organizationId));
  if (organization?.shared) {
    return db.select({ id: usersTable.id, role: workspaceMembershipsTable.role })
      .from(workspaceMembershipsTable)
      .innerJoin(usersTable, eq(usersTable.id, workspaceMembershipsTable.userId))
      .where(eq(workspaceMembershipsTable.workspaceOrganizationId, organizationId));
  }
  return db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)
    .where(eq(usersTable.organizationId, organizationId));
}

async function sendExpoPushNotifications(
  notifications: Array<{ token: string; body: string }>,
  title: string,
  ticketId: number | null
): Promise<void> {
  if (notifications.length === 0) return;
  const messages = notifications.map(({ token, body }) => ({
    to: token,
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
    map.set(id, { userId: id, inApp: true, email: type === "ticket_assigned" || type === "ticket_due" });
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
  recipients: NotificationRecipient[],
  prefs: Map<number, PrefForUser>,
  content: NotificationContent,
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
      const language = languageForRecipient(u.preferredLanguage);
      const text = renderNotificationText(content, language);
      const { subject, html, text: body } = buildNotificationEmail({
        recipientName: u.name ?? u.email ?? "",
        text,
        ticketId,
        appBaseUrl: baseUrl,
        language,
      });
      return sendEmailForOrg(orgId, { to: u.email!, subject, html, text: body }).then((r) => {
        if (!r.ok) logger.warn({ userId: u.id, orgId, err: r.error }, "notification email failed");
      });
    })
  );
}

export async function subscribeUserToTicket(
  userId: number,
  ticketId: number,
  organizationId: number
): Promise<void> {
  await db
    .insert(ticketSubscriptionsTable)
    .values({ ticketId, userId, organizationId })
    .onConflictDoNothing();
}

export async function createNotificationsForSubscribers(
  ticketId: number,
  content: NotificationContent,
  excludeUserId: number,
  type: NotificationType = "system",
  organizationId?: number | null,
  alsoExcludeIds?: number[]
): Promise<void> {
  const excludeSet = new Set([excludeUserId, ...(alsoExcludeIds ?? [])]);
  const [ticket] = ticketId
    ? await db.select({ visibility: ticketsTable.visibility }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1)
    : [];
  const adminsOnly = ticket?.visibility === "admins";

  const subs = await db
    .select({ userId: ticketSubscriptionsTable.userId })
    .from(ticketSubscriptionsTable)
    .where(
      and(
        eq(ticketSubscriptionsTable.ticketId, ticketId),
        ...(organizationId != null ? [eq(ticketSubscriptionsTable.organizationId, organizationId)] : [])
      )
    );

  const candidateIds = subs.map((s) => s.userId).filter((id) => !excludeSet.has(id));
  if (candidateIds.length === 0) return;

  const workspaceRecipients = organizationId == null ? [] : await getOrgRecipients(organizationId);
  const allowedRecipientIds = new Set(workspaceRecipients.map((recipient) => recipient.id));
  const candidates = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      expoPushToken: usersTable.expoPushToken,
      preferredLanguage: usersTable.preferredLanguage,
    })
    .from(usersTable)
    .where(and(
      inArray(usersTable.id, candidateIds),
      eq(usersTable.isActive, true),
    ));
  const allowedCandidates = candidates.filter((candidate) =>
    allowedRecipientIds.has(candidate.id) &&
    (!adminsOnly || workspaceRecipients.some((recipient) => recipient.id === candidate.id && recipient.role === "admin"))
  );
  if (allowedCandidates.length === 0) return;

  const prefs = await getChannelPrefs(allowedCandidates.map((u) => u.id), type);
  const textByUserId = new Map(allowedCandidates.map((user) => [
    user.id,
    renderNotificationText(content, languageForRecipient(user.preferredLanguage)),
  ]));

  const inAppTargets = allowedCandidates.filter((u) => prefs.get(u.id)?.inApp !== false).map((u) => u.id);
  if (inAppTargets.length > 0) {
    await db.insert(notificationsTable).values(
      inAppTargets.map((id) => ({
        userId: id,
        organizationId: organizationId ?? undefined,
        ticketId,
        type,
        notificationText: textByUserId.get(id)!,
        isRead: false,
      }))
    );
  }

  const pushNotifications = allowedCandidates
    .filter((u) => prefs.get(u.id)?.inApp !== false && u.expoPushToken)
    .map((u) => ({ token: u.expoPushToken!, body: textByUserId.get(u.id)! }));
  void sendExpoPushNotifications(pushNotifications, "TaskDesk", ticketId);

  void dispatchEmails(allowedCandidates, prefs, content, ticketId, organizationId);
}

export async function createNotificationsForTicket(
  ticketId: number,
  content: NotificationContent,
  excludeUserId: number,
  type: NotificationType = "system",
  organizationId?: number | null
): Promise<void> {
  const [ticket] = await db.select({ visibility: ticketsTable.visibility }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
  const adminsOnly = ticket?.visibility === "admins";
  const conditions = [ne(usersTable.id, excludeUserId), eq(usersTable.isActive, true)];
  const workspaceRecipients = organizationId != null
    ? await getOrgRecipients(organizationId)
    : await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.isActive, true));
  const allowedRecipientIds = new Set(workspaceRecipients.filter((recipient) =>
    recipient.id !== excludeUserId && (!adminsOnly || recipient.role === "admin")
  ).map((recipient) => recipient.id));
  if (allowedRecipientIds.size === 0) return;
  const candidates = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      expoPushToken: usersTable.expoPushToken,
      preferredLanguage: usersTable.preferredLanguage,
    })
    .from(usersTable)
    .where(and(...conditions, inArray(usersTable.id, [...allowedRecipientIds])));
  if (candidates.length === 0) return;

  const prefs = await getChannelPrefs(candidates.map((u) => u.id), type);
  const textByUserId = new Map(candidates.map((user) => [
    user.id,
    renderNotificationText(content, languageForRecipient(user.preferredLanguage)),
  ]));

  // In-app inserts
  const inAppTargets = candidates.filter((u) => prefs.get(u.id)?.inApp !== false).map((u) => u.id);
  if (inAppTargets.length > 0) {
    await db.insert(notificationsTable).values(
      inAppTargets.map((id) => ({
        userId: id,
        organizationId,
        ticketId,
        type,
        notificationText: textByUserId.get(id)!,
        isRead: false,
      }))
    );
  }

  // Push notifications
  const pushNotifications = candidates
    .filter((u) => prefs.get(u.id)?.inApp !== false && u.expoPushToken)
    .map((u) => ({ token: u.expoPushToken!, body: textByUserId.get(u.id)! }));
  void sendExpoPushNotifications(pushNotifications, "TaskDesk", ticketId);

  // Email dispatch (independent of in-app)
  void dispatchEmails(candidates, prefs, content, ticketId, organizationId);
}

/**
 * Send an in-app (+ push + email) notification to every active member of an org,
 * excluding the author. ticketId is null for non-ticket notifications.
 */
export async function createNotificationsForOrg(
  organizationId: number,
  excludeUserId: number,
  content: NotificationContent,
  type: NotificationType = "system",
  ticketId: number | null = null,
): Promise<void> {
  const [ticket] = ticketId
    ? await db.select({ visibility: ticketsTable.visibility }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1)
    : [];
  const adminsOnly = ticket?.visibility === "admins";
  const workspaceRecipients = await getOrgRecipients(organizationId);
  const allowedRecipientIds = new Set(workspaceRecipients.filter((recipient) =>
    recipient.id !== excludeUserId && (!adminsOnly || recipient.role === "admin")
  ).map((recipient) => recipient.id));
  if (allowedRecipientIds.size === 0) return;
  const candidates = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      expoPushToken: usersTable.expoPushToken,
      preferredLanguage: usersTable.preferredLanguage,
    })
    .from(usersTable)
    .where(and(
      inArray(usersTable.id, [...allowedRecipientIds]),
      ne(usersTable.id, excludeUserId),
      eq(usersTable.isActive, true),
    ));
  if (candidates.length === 0) return;

  const prefs = await getChannelPrefs(candidates.map((u) => u.id), type);
  const textByUserId = new Map(candidates.map((user) => [
    user.id,
    renderNotificationText(content, languageForRecipient(user.preferredLanguage)),
  ]));

  const inAppTargets = candidates.filter((u) => prefs.get(u.id)?.inApp !== false).map((u) => u.id);
  if (inAppTargets.length > 0) {
    await db.insert(notificationsTable).values(
      inAppTargets.map((id) => ({
        userId: id,
        organizationId,
        ticketId: ticketId ?? undefined,
        type,
        notificationText: textByUserId.get(id)!,
        isRead: false,
      }))
    );
  }

  const pushNotifications = candidates
    .filter((u) => prefs.get(u.id)?.inApp !== false && u.expoPushToken)
    .map((u) => ({ token: u.expoPushToken!, body: textByUserId.get(u.id)! }));
  void sendExpoPushNotifications(pushNotifications, "TaskDesk", ticketId);
  void dispatchEmails(candidates, prefs, content, ticketId, organizationId);
}

/**
 * Create only in-app notifications for every active member of an organization,
 * excluding the author and honoring each recipient's in-app preference.
 */
export async function createInAppNotificationsForOrg(
  organizationId: number,
  excludeUserId: number,
  content: NotificationContent,
  type: NotificationType,
  ticketId: number | null = null,
  dailyReportId: number | null = null,
): Promise<number> {
  const workspaceRecipients = await getOrgRecipients(organizationId);
  const candidates = await db
    .select({ id: usersTable.id, preferredLanguage: usersTable.preferredLanguage })
    .from(usersTable)
    .where(and(
      inArray(usersTable.id, workspaceRecipients.map((recipient) => recipient.id)),
      ne(usersTable.id, excludeUserId),
      eq(usersTable.isActive, true),
    ));
  if (candidates.length === 0) return 0;

  const prefs = await getChannelPrefs(candidates.map((user) => user.id), type);
  const inAppTargets = candidates
    .filter((user) => prefs.get(user.id)?.inApp !== false)
    .map((user) => user.id);
  if (inAppTargets.length === 0) return 0;

  await db.insert(notificationsTable).values(
    inAppTargets.map((userId) => ({
      userId,
      organizationId,
      ticketId: ticketId ?? undefined,
      dailyReportId: dailyReportId ?? undefined,
      type,
      notificationText: renderNotificationText(
        content,
        languageForRecipient(candidates.find((candidate) => candidate.id === userId)?.preferredLanguage),
      ),
      isRead: false,
    }))
  );
  return inAppTargets.length;
}

export async function createNotificationForUser(
  userId: number,
  ticketId: number | null,
  content: NotificationContent,
  type: NotificationType = "system",
  organizationId?: number | null,
  workspaceInviteId?: number | null,
): Promise<void> {
  const conditions = [eq(usersTable.id, userId)];

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      expoPushToken: usersTable.expoPushToken,
      role: usersTable.role,
      preferredLanguage: usersTable.preferredLanguage,
    })
    .from(usersTable)
    .where(and(...conditions));
  if (!user) return;
  let workspaceRole = user.role;
  if (organizationId != null) {
    const memberIds = await getOrgRecipients(organizationId);
    const membership = memberIds.find((member) => member.id === userId);
    if (!membership) return;
    workspaceRole = membership.role;
  }
  if (ticketId != null) {
    const [ticket] = await db.select({ visibility: ticketsTable.visibility }).from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
    if (ticket?.visibility === "admins" && workspaceRole !== "admin") return;
  }

  const prefs = await getChannelPrefs([userId], type);
  const p = prefs.get(userId);
  const text = renderNotificationText(content, languageForRecipient(user.preferredLanguage));

  if (p?.inApp !== false) {
    await db.insert(notificationsTable).values({
      userId,
      organizationId: organizationId ?? undefined,
      ticketId: ticketId ?? undefined,
      workspaceInviteId: workspaceInviteId ?? undefined,
      type,
      notificationText: text,
      isRead: false,
    });
    if (user.expoPushToken) {
      void sendExpoPushNotifications([{ token: user.expoPushToken, body: text }], "TaskDesk", ticketId);
    }
  }

  void dispatchEmails([user], prefs, content, ticketId, organizationId);
}
