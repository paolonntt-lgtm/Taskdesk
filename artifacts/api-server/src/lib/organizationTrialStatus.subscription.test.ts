import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  usersTable: { organizationId: {}, role: {}, trialEndsAt: {}, stripeSubscriptionId: {} },
}));

vi.mock("@workspace/db", () => ({
  db: { execute: mocks.execute, select: mocks.select },
  usersTable: mocks.usersTable,
}));

import { getOrganizationTrialStatus } from "./organizationTrialStatus";

describe("organization subscription expiry enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks an organization expired when its saved subscription is canceled", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{
        trialEndsAt: null,
        stripeSubscriptionId: "sub-canceled",
        subscriptionId: "sub-canceled",
        subscriptionStatus: "canceled",
        cancelAt: null,
        currentPeriodEnd: 1_800_000_000,
      }],
    });

    const status = await getOrganizationTrialStatus({
      organizationId: 12,
      trialEndsAt: null,
      stripeSubscriptionId: "sub-canceled",
    });

    expect(status).toMatchObject({ isExpired: true, expirationType: "subscription" });
  });

  it("keeps access while an active scheduled cancellation is still in its paid period", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{
        trialEndsAt: null,
        stripeSubscriptionId: "sub-active",
        subscriptionId: "sub-active",
        subscriptionStatus: "active",
        cancelAt: Math.floor(Date.now() / 1000) + 86_400,
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 86_400,
      }],
    });

    const status = await getOrganizationTrialStatus({
      organizationId: 12,
      trialEndsAt: null,
      stripeSubscriptionId: "sub-active",
    });

    expect(status).toBeNull();
  });
});
