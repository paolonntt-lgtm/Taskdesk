import { and, eq, sql } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';
import { getOrganizationTrialStatusFromAdmins, getTrialStatus, type TrialStatus } from './trialStatus';
import { getOrganizationAccessStatus } from './organizationAccessStatus';

type TrialOwner = {
  organizationId: number | null;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
  isSuperAdmin?: boolean | null;
};

export async function getOrganizationTrialStatus(user: TrialOwner): Promise<TrialStatus | null> {
  if (user.isSuperAdmin) return null;
  if (user.organizationId == null) {
    return getTrialStatus(user.trialEndsAt, user.stripeSubscriptionId);
  }

  try {
    const result = await db.execute(sql`
      SELECT
        u.trial_ends_at AS "trialEndsAt",
        u.stripe_subscription_id AS "stripeSubscriptionId",
        s.id AS "subscriptionId",
        s.status AS "subscriptionStatus",
        s.cancel_at AS "cancelAt",
        s.current_period_end AS "currentPeriodEnd"
      FROM public.users u
      LEFT JOIN stripe.subscriptions s ON s.id = u.stripe_subscription_id
      WHERE u.organization_id = ${user.organizationId}
        AND u.role = 'admin'
    `);
    const rows = result.rows as Array<{
      trialEndsAt: Date | string | null;
      stripeSubscriptionId: string | null;
      subscriptionId: string | null;
      subscriptionStatus: string | null;
      cancelAt: number | string | null;
      currentPeriodEnd: number | string | null;
    }>;
    const admins = rows.map((row) => ({
      trialEndsAt: row.trialEndsAt == null ? null : new Date(row.trialEndsAt),
      stripeSubscriptionId: row.stripeSubscriptionId,
    }));
    const subscriptions = rows
      .filter((row) => row.subscriptionId && row.subscriptionStatus)
      .map((row) => ({
        id: row.subscriptionId!,
        status: row.subscriptionStatus!,
        cancel_at: row.cancelAt,
        current_period_end: row.currentPeriodEnd,
      }));
    return getOrganizationAccessStatus(admins, subscriptions);
  } catch {
    // Do not interrupt existing paid access if Stripe's synchronized schema is
    // temporarily unavailable; the normal trial check remains the fallback.
    const admins = await db
      .select({
        trialEndsAt: usersTable.trialEndsAt,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
      })
      .from(usersTable)
      .where(and(
        eq(usersTable.organizationId, user.organizationId),
        eq(usersTable.role, 'admin'),
      ));
    return getOrganizationTrialStatusFromAdmins(admins);
  }
}
