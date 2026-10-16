export interface TrialStatus {
  isInTrial: boolean;
  isExpired: boolean;
  daysLeft: number;
}

export const FREE_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getTrialStatus(
  trialEndsAt: Date | string | null | undefined,
  stripeSubscriptionId: string | null | undefined
): TrialStatus | null {
  if (!trialEndsAt || stripeSubscriptionId) return null;
  const end = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return {
    isInTrial: daysLeft > 0,
    isExpired: daysLeft <= 0,
    daysLeft,
  };
}

export function getOrganizationTrialStatusFromAdmins(
  admins: Array<{ trialEndsAt: Date | null; stripeSubscriptionId: string | null }>
): TrialStatus | null {
  const trialEndsAt = admins
    .map((admin) => admin.trialEndsAt)
    .filter((end): end is Date => end != null)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const subscriptionId = admins.find((admin) => admin.stripeSubscriptionId)?.stripeSubscriptionId ?? null;

  return getTrialStatus(trialEndsAt, subscriptionId);
}
