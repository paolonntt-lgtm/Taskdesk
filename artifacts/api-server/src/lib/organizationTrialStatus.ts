import { and, eq } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';
import { getOrganizationTrialStatusFromAdmins, getTrialStatus, type TrialStatus } from './trialStatus';

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
