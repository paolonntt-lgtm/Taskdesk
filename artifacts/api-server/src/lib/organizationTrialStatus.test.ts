import { describe, expect, it } from 'vitest';
import { getOrganizationTrialStatusFromAdmins } from './trialStatus';

describe('organization trial status', () => {
  it('uses the earliest admin trial end for the whole organization', () => {
    const status = getOrganizationTrialStatusFromAdmins([
      { trialEndsAt: new Date(Date.now() + 86_400_000), stripeSubscriptionId: null },
      { trialEndsAt: new Date(Date.now() - 86_400_000), stripeSubscriptionId: null },
    ]);

    expect(status?.isExpired).toBe(true);
  });

  it('keeps the organization active when a billing admin has a subscription', () => {
    const status = getOrganizationTrialStatusFromAdmins([
      { trialEndsAt: new Date(Date.now() - 86_400_000), stripeSubscriptionId: null },
      { trialEndsAt: null, stripeSubscriptionId: 'sub_active' },
    ]);

    expect(status).toBeNull();
  });

  it('does not invent a trial for organizations without a trial end date', () => {
    expect(getOrganizationTrialStatusFromAdmins([
      { trialEndsAt: null, stripeSubscriptionId: null },
    ])).toBeNull();
  });
});
