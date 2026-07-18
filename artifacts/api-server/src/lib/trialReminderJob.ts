import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, organizationsTable, usersTable } from "@workspace/db";
import { sendEmailForOrg, buildTrialReminderEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkTrialReminders(): Promise<void> {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const admins = await db
      .select({
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        orgId: usersTable.organizationId,
        orgName: organizationsTable.name,
        trialEndsAt: usersTable.trialEndsAt,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        trialReminderSentAt: organizationsTable.trialReminderSentAt,
        trialExpiredReminderSentAt: organizationsTable.trialExpiredReminderSentAt,
      })
      .from(usersTable)
      .leftJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
      .where(
        and(
          eq(usersTable.role, "admin"),
          eq(usersTable.isActive, true),
          isNotNull(usersTable.trialEndsAt),
          isNull(usersTable.stripeSubscriptionId)
        )
      );

    const baseUrl = appBaseUrl();
    const billingUrl = `${baseUrl}/app/billing`;

    for (const admin of admins) {
      if (!admin.trialEndsAt || !admin.orgId || !admin.userEmail) continue;

      const trialEnd = new Date(admin.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysLeft <= 0) {
        if (admin.trialExpiredReminderSentAt) continue;

        const { subject, html, text } = buildTrialReminderEmail({
          adminName: admin.userName ?? admin.userEmail,
          orgName: admin.orgName ?? "",
          daysLeft: 0,
          billingUrl,
        });

        const result = await sendEmailForOrg(admin.orgId, {
          to: admin.userEmail,
          subject,
          html,
          text,
        });

        if (result.ok) {
          await db
            .update(organizationsTable)
            .set({ trialExpiredReminderSentAt: now })
            .where(eq(organizationsTable.id, admin.orgId));
          logger.info({ orgId: admin.orgId, adminEmail: admin.userEmail }, "trialReminderJob: expired reminder sent");
        } else {
          logger.warn({ orgId: admin.orgId, err: result.error }, "trialReminderJob: failed to send expired reminder");
        }
      } else if (daysLeft <= 3) {
        if (admin.trialReminderSentAt) continue;

        const { subject, html, text } = buildTrialReminderEmail({
          adminName: admin.userName ?? admin.userEmail,
          orgName: admin.orgName ?? "",
          daysLeft,
          billingUrl,
        });

        const result = await sendEmailForOrg(admin.orgId, {
          to: admin.userEmail,
          subject,
          html,
          text,
        });

        if (result.ok) {
          await db
            .update(organizationsTable)
            .set({ trialReminderSentAt: now })
            .where(eq(organizationsTable.id, admin.orgId));
          logger.info({ orgId: admin.orgId, adminEmail: admin.userEmail, daysLeft }, "trialReminderJob: 3-day reminder sent");
        } else {
          logger.warn({ orgId: admin.orgId, err: result.error }, "trialReminderJob: failed to send 3-day reminder");
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "trialReminderJob: check failed");
  }
}

export function startTrialReminderJob(): void {
  const interval = setInterval(() => {
    void checkTrialReminders();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  void checkTrialReminders();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "trialReminderJob: started");
}
