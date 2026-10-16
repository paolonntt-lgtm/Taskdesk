import { describe, expect, it } from 'vitest';
import { canUseBillingDuringExpiredTrial } from './trialAccess';

describe('expired trial billing access', () => {
  it('allows admins to reach Stripe billing endpoints', () => {
    expect(canUseBillingDuringExpiredTrial('/api/stripe/checkout', 'admin')).toBe(true);
    expect(canUseBillingDuringExpiredTrial('/stripe/portal?return=billing', 'admin')).toBe(true);
  });

  it('blocks collaborators and all non-billing endpoints', () => {
    expect(canUseBillingDuringExpiredTrial('/api/stripe/checkout', 'user')).toBe(false);
    expect(canUseBillingDuringExpiredTrial('/api/tickets', 'admin')).toBe(false);
    expect(canUseBillingDuringExpiredTrial('/api/notifications', 'user')).toBe(false);
  });
});
