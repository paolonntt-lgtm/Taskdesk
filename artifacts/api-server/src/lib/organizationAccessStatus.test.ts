import { describe, expect, it } from "vitest";
import { getOrganizationAccessStatus } from "./organizationAccessStatus";

const NOW = Date.UTC(2026, 10, 6);
const billingAdmin = {
  trialEndsAt: new Date(NOW - 30 * 24 * 60 * 60 * 1000),
  stripeSubscriptionId: "sub-1",
};

describe("organization paid subscription access", () => {
  it("keeps access through a scheduled end date", () => {
    expect(getOrganizationAccessStatus([billingAdmin], [{
      id: "sub-1",
      status: "active",
      cancel_at: Math.floor((NOW + 2 * 24 * 60 * 60 * 1000) / 1000),
      current_period_end: Math.floor((NOW + 2 * 24 * 60 * 60 * 1000) / 1000),
    }], NOW)).toBeNull();
  });

  it("blocks access after Stripe marks the subscription canceled", () => {
    expect(getOrganizationAccessStatus([billingAdmin], [{
      id: "sub-1",
      status: "canceled",
      cancel_at: null,
      current_period_end: Math.floor((NOW - 1) / 1000),
    }], NOW)).toMatchObject({
      isExpired: true,
      expirationType: "subscription",
    });
  });

  it("blocks access when the scheduled cancellation time has passed", () => {
    expect(getOrganizationAccessStatus([billingAdmin], [{
      id: "sub-1",
      status: "active",
      cancel_at: Math.floor((NOW - 1) / 1000),
      current_period_end: Math.floor((NOW - 1) / 1000),
    }], NOW)).toMatchObject({
      isExpired: true,
      expirationType: "subscription",
    });
  });

  it("preserves active access when an organization has another active billing admin", () => {
    expect(getOrganizationAccessStatus([
      billingAdmin,
      { trialEndsAt: null, stripeSubscriptionId: "sub-2" },
    ], [
      { id: "sub-1", status: "canceled", cancel_at: null, current_period_end: null },
      { id: "sub-2", status: "active", cancel_at: null, current_period_end: null },
    ], NOW)).toBeNull();
  });

  it("continues enforcing an expired free trial when no paid subscription is active", () => {
    expect(getOrganizationAccessStatus([
      { trialEndsAt: new Date(NOW - 24 * 60 * 60 * 1000), stripeSubscriptionId: null },
    ], [], NOW)).toMatchObject({
      isExpired: true,
      expirationType: "trial",
    });
  });
});
