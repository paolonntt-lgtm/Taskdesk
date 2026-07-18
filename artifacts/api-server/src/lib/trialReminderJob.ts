import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { db, organizationsTable, usersTable } from "@workspace/db";
import { sendEmailForOrg, buildTrialReminderEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkTrialReminders(): Promise<void> {
  try {
    const now = new Date();

    const admins = await db
      .select({
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        orgId: usersTable.organizationId,
        orgName: organizationsTable.name,
        trialEndsAt: usersTable.trialEndsAt,
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

    // Deduplicate: one action per org (pick the first admin encountered)
    const byOrg = new Map<number, (typeof admins)[number]>();
    for (const admin of admins) {
      if (admin.orgId && !byOrg.has(admin.orgId)) {
        byOrg.set(admin.orgId, admin);
      }
    }

    const baseUrl = appBaseUrl();
    const billingUrl = `${baseUrl}/app/billing`;

    for (const admin of byOrg.values()) {
      if (!admin.trialEndsAt || !admin.orgId || !admin.userEmail) continue;

      const trialEnd = new Date(admin.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysLeft <= 0) {
        // Expired — only send once and only within 30 days of expiry to avoid stale emails
        if (admin.trialExpiredReminderSentAt) continue;
        const daysSinceExpiry = Math.abs(daysLeft);
        if (daysSinceExpiry > 30) continue;

        const usersCount = await getActiveUsersCount(admin.orgId);

        const { subject, html, text } = buildTrialReminderEmail({
          adminName: admin.userName ?? admin.userEmail,
          orgName: admin.orgName ?? "",
          daysLeft: 0,
          billingUrl,
          usersCount,
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
            .where(
              and(
                eq(organizationsTable.id, admin.orgId),
                isNull(organizationsTable.trialExpiredReminderSentAt)
              )
            );
          logger.info({ orgId: admin.orgId, adminEmail: admin.userEmail }, "trialReminderJob: expired reminder sent");
        } else {
          logger.warn({ orgId: admin.orgId, err: result.error }, "trialReminderJob: failed to send expired reminder");
        }
      } else if (daysLeft >= 3 && daysLeft <= 4) {
        // 3-day window — send once
        if (admin.trialReminderSentAt) continue;

        const usersCount = await getActiveUsersCount(admin.orgId);

        const { subject, html, text } = buildTrialReminderEmail({
          adminName: admin.userName ?? admin.userEmail,
          orgName: admin.orgName ?? "",
          daysLeft,
          billingUrl,
          usersCount,
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
            .where(
              and(
                eq(organizationsTable.id, admin.orgId),
                isNull(organizationsTable.trialReminderSentAt)
              )
            );
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

async function getActiveUsersCount(orgId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(usersTable)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isActive, true)));
  return row?.value ?? 0;
}

export function startTrialReminderJob(): void {
  const interval = setInterval(() => {
    void checkTrialReminders();
  }, CHECK_INTERVAL_MS);
  interval.unref();
  void checkTrialReminders();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "trialReminderJob: started");
}
