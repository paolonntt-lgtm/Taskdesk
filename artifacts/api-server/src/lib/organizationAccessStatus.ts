import { getOrganizationTrialStatusFromAdmins, type TrialStatus } from "./trialStatus";

type AdminBilling = {
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
};

type SubscriptionState = {
  id: string;
  status: string;
  cancel_at: number | string | null;
  current_period_end: number | string | null;
};

function unixMilliseconds(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1000 : null;
}

export function getOrganizationAccessStatus(
  admins: AdminBilling[],
  subscriptions: SubscriptionState[],
  now = Date.now(),
): TrialStatus | null {
  const byId = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const ids = admins.map((admin) => admin.stripeSubscriptionId).filter((id): id is string => id != null);

  // A saved ID without a matching StripeSync row is not enough evidence to
  // revoke access; retain the previous behavior while synchronization catches up.
  if (ids.some((id) => !byId.has(id))) return null;

  const states = ids.map((id) => byId.get(id)!);
  const entitled = states.some((subscription) => {
    if (!["active", "trialing", "past_due"].includes(subscription.status)) return false;
    const cancelAt = unixMilliseconds(subscription.cancel_at);
    return cancelAt == null || cancelAt > now;
  });
  if (entitled) return null;

  const endedPaidSubscription = states.some((subscription) =>
    ["canceled", "unpaid", "paused", "incomplete_expired"].includes(subscription.status) ||
    (unixMilliseconds(subscription.cancel_at) != null && unixMilliseconds(subscription.cancel_at)! <= now)
  );
  if (endedPaidSubscription) {
    return {
      isInTrial: false,
      isExpired: true,
      daysLeft: 0,
      expirationType: "subscription",
    };
  }

  const trialStatus = getOrganizationTrialStatusFromAdmins(
    admins.map((admin) => ({ ...admin, stripeSubscriptionId: null })),
  );
  return trialStatus?.isExpired
    ? { ...trialStatus, expirationType: "trial" }
    : trialStatus;
}
