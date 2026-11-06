import { and, eq, isNotNull } from "drizzle-orm";
import { db, organizationsTable, usersTable } from "@workspace/db";
import { stripeStorage } from "../stripeStorage";
import { appBaseUrl } from "./appUrl";
import { buildSubscriptionEndingReminderEmail, sendEmailForOrg } from "./email";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkSubscriptionExpiryReminders(now = new Date()): Promise<void> {
  try {
    const admins = await db.select({
      name: usersTable.name,
      email: usersTable.email,
      language: usersTable.preferredLanguage,
      organizationId: usersTable.organizationId,
      organizationName: organizationsTable.name,
      subscriptionId: usersTable.stripeSubscriptionId,
      reminderKey: organizationsTable.subscriptionExpiryReminderKey,
    }).from(usersTable)
      .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
      .where(and(
        eq(usersTable.role, "admin"),
        eq(usersTable.isActive, true),
        isNotNull(usersTable.stripeSubscriptionId),
      ));

    const subscriptionIds = [...new Set(admins.map((admin) => admin.subscriptionId).filter((id): id is string => id != null))];
    if (!subscriptionIds.length) return;
    const subscriptions = await stripeStorage.getSubscriptions(subscriptionIds);
    const subscriptionsById = new Map(subscriptions.map((subscription) => [String(subscription.id), subscription]));
    const sentThisRun = new Set<number>();
    const billingUrl = `${appBaseUrl()}/app/billing`;

    for (const admin of admins) {
      if (!admin.organizationId || !admin.email || !admin.subscriptionId || sentThisRun.has(admin.organizationId)) continue;
      const subscription = subscriptionsById.get(admin.subscriptionId);
      if (!subscription || !["active", "trialing", "past_due"].includes(String(subscription.status))) continue;
      const cancelAt = Number(subscription.cancel_at);
      if (!Number.isFinite(cancelAt) || cancelAt <= 0) continue;

      const endsAt = new Date(cancelAt * 1000);
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft < 1 || daysLeft > 4) continue;

      const reminderKey = `${admin.subscriptionId}:${cancelAt}`;
      if (admin.reminderKey === reminderKey) continue;
      const message = buildSubscriptionEndingReminderEmail({
        adminName: admin.name ?? admin.email,
        orgName: admin.organizationName ?? "",
        endsAt,
        billingUrl,
        language: admin.language,
      });
      const result = await sendEmailForOrg(admin.organizationId, {
        to: admin.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (!result.ok) {
        logger.warn({ orgId: admin.organizationId, err: result.error }, "subscriptionExpiryReminderJob: email failed");
        continue;
      }

      await db.update(organizationsTable)
        .set({
          subscriptionExpiryReminderKey: reminderKey,
          subscriptionExpiryReminderSentAt: now,
        })
        .where(eq(organizationsTable.id, admin.organizationId));
      sentThisRun.add(admin.organizationId);
      logger.info({ orgId: admin.organizationId, subscriptionId: admin.subscriptionId, daysLeft }, "subscriptionExpiryReminderJob: reminder sent");
    }
  } catch (err) {
    logger.warn({ err }, "subscriptionExpiryReminderJob: check failed");
  }
}

export function startSubscriptionExpiryReminderJob(): void {
  const interval = setInterval(() => void checkSubscriptionExpiryReminders(), CHECK_INTERVAL_MS);
  interval.unref();
  void checkSubscriptionExpiryReminders();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "subscriptionExpiryReminderJob: started");
}
