import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  stripeSubscriptionsList: vi.fn(),
  stripeSubscriptionsRetrieve: vi.fn(),
  stripeProductsRetrieve: vi.fn(),
  stripeBalanceCredit: vi.fn(),
  externalCreditsCreated: 0,
  balanceTransactions: new Map<string, { id: string }>(),
  stripeChargeRetrieve: vi.fn(),
}));
vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    transaction: vi.fn(async (callback) => callback({ select: mocks.select, update: mocks.update })),
  },
  organizationsTable: { id: "organizations.id", name: "organizations.name" },
  referralCodesTable: { code: "referral_codes.code", organizationId: "referral_codes.organizationId" },
  referralsTable: {
    id: "referrals.id",
    referrerOrganizationId: "referrals.referrerOrganizationId",
    referredOrganizationId: "referrals.referredOrganizationId",
    status: "referrals.status",
    qualifyingInvoiceId: "referrals.qualifyingInvoiceId",
    rewardRevocationReason: "referrals.rewardRevocationReason",
    rewardRevokedAt: "referrals.rewardRevokedAt",
    stripeRewardReversalBalanceTransactionId: "referrals.stripeRewardReversalBalanceTransactionId",
    rewardCustomerId: "referrals.rewardCustomerId",
    rewardAmount: "referrals.rewardAmount",
    rewardCurrency: "referrals.rewardCurrency",
  },
  usersTable: {
    organizationId: "users.organizationId",
    stripeCustomerId: "users.stripeCustomerId",
    role: "users.role",
    isActive: "users.isActive",
    email: "users.email",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
}));

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    subscriptions: {
      list: mocks.stripeSubscriptionsList,
      retrieve: mocks.stripeSubscriptionsRetrieve,
    },
    products: { retrieve: mocks.stripeProductsRetrieve },
    customers: { createBalanceTransaction: mocks.stripeBalanceCredit },
    charges: { retrieve: mocks.stripeChargeRetrieve },
  })),
}));

import {
  applyPendingReferralCreditsForCustomer,
  calculateReferralMonthlyReward,
  getReferralOverview,
  processReferralInvoicePaid,
} from "./referralService";
import type Stripe from "stripe";

function queryReturning(value: unknown) {
  const query: any = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    for: vi.fn(async () => value),
    then: (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return query;
}

const monthlyPrice = {
  id: "price_month",
  product: "prod_taskdesk",
  currency: "eur",
  unit_amount: 4900,
  recurring: { interval: "month" },
} as unknown as Stripe.Price;

const activeSubscription = {
  id: "sub_referrer",
  customer: "cus_referrer",
  status: "active",
  created: 20,
  items: { data: [{ price: monthlyPrice, quantity: 1 }] },
};

const canceledSubscription = { ...activeSubscription, status: "canceled" };

const pendingReferral = {
  id: 42,
  referrerOrganizationId: 10,
  referredOrganizationId: 20,
  status: "pending_reward",
  rewardCustomerId: "cus_referrer",
  rewardAmount: 4900,
  rewardCurrency: "eur",
};

function makeInvoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: "in_first_paid",
    customer: "cus_invitee",
    status: "paid",
    amount_paid: 4900,
    billing_reason: "subscription_create",
    parent: { subscription_details: { subscription: "sub_invitee" } },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function configureStripe(subscription = activeSubscription) {
  mocks.stripeSubscriptionsList.mockResolvedValue({ data: [subscription] });
  mocks.stripeSubscriptionsRetrieve.mockResolvedValue({
    items: { data: [{ price: { ...monthlyPrice, product: { id: "prod_taskdesk", metadata: { seats: "5" } } } }] },
  });
  mocks.stripeProductsRetrieve.mockResolvedValue({ id: "prod_taskdesk", metadata: { seats: "5" } });
}

describe("TaskDesk referral Stripe rewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.externalCreditsCreated = 0;
    mocks.balanceTransactions.clear();
    mocks.select.mockImplementation((projection?: Record<string, unknown>) => {
      const keys = Object.keys(projection ?? {});
      if (keys.includes("organizationId")) return queryReturning([{ organizationId: 10 }]);
      if (keys.includes("stripeCustomerId")) return queryReturning([{ stripeCustomerId: "cus_referrer" }]);
      return queryReturning([pendingReferral]);
    });
    mocks.update.mockImplementation(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    }));
    mocks.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => [{ id: 43 }]),
        })),
      })),
    }));
    configureStripe();
    mocks.stripeBalanceCredit.mockImplementation(async (_customer, _params, options) => {
      const key = options.idempotencyKey;
      const existing = mocks.balanceTransactions.get(key);
      if (existing) return existing;
      mocks.externalCreditsCreated++;
      const transaction = { id: "cbtxn_referral_42" };
      mocks.balanceTransactions.set(key, transaction);
      return transaction;
    });
  });

  it("ignores zero-value trial invoices without looking up or qualifying a referral", async () => {
    await processReferralInvoicePaid(makeInvoice({ amount_paid: 0 }));
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.stripeBalanceCredit).not.toHaveBeenCalled();
  });

  it("ignores invoices that have an amount but have not been paid", async () => {
    await processReferralInvoicePaid(makeInvoice({ status: "open" }));
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.stripeBalanceCredit).not.toHaveBeenCalled();
  });

  it("ignores a paid invoice from another Stripe product even if the customer has a TaskDesk plan", async () => {
    mocks.stripeSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{
        price: {
          ...monthlyPrice,
          product: { id: "prod_other", metadata: {} },
        },
      }] },
    });
    mocks.stripeSubscriptionsList.mockResolvedValue({ data: [activeSubscription] });

    await processReferralInvoicePaid(makeInvoice());

    expect(mocks.stripeSubscriptionsRetrieve).toHaveBeenCalledWith("sub_invitee", {
      expand: ["items.data.price.product"],
    });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.stripeBalanceCredit).not.toHaveBeenCalled();
  });

  it("retries a pending reward on a paid subscription update without qualifying a new referral", async () => {
    let organizationLookups = 0;
    mocks.select.mockImplementation((projection?: Record<string, unknown>) => {
      const keys = Object.keys(projection ?? {});
      if (keys.includes("organizationId")) {
        organizationLookups++;
        return queryReturning(organizationLookups === 1
          ? [{ organizationId: 20 }]
          : organizationLookups === 2
            ? [{ organizationId: 10 }]
            : []);
      }
      if (keys.includes("stripeCustomerId")) return queryReturning([{ stripeCustomerId: "cus_referrer" }]);
      if (keys.includes("rewardCustomerId")) return queryReturning([{ rewardCustomerId: "cus_referrer" }]);
      return queryReturning([pendingReferral]);
    });

    await processReferralInvoicePaid(makeInvoice({ billing_reason: "subscription_update" }));

    expect(mocks.stripeBalanceCredit).toHaveBeenCalledWith(
      "cus_referrer",
      expect.objectContaining({ amount: -4900, currency: "eur" }),
      { idempotencyKey: "taskdesk-referral-42" },
    );
  });

  it("qualifies the first actual payment but keeps the reward pending for an inactive referrer", async () => {
    const updates: Record<string, unknown>[] = [];
    mocks.select
      .mockImplementationOnce(() => queryReturning([{ organizationId: 20 }]))
      .mockImplementationOnce(() => queryReturning([{
        id: 42,
        referrerOrganizationId: 10,
        referredOrganizationId: 20,
        status: "pending_payment",
      }]))
      .mockImplementationOnce(() => queryReturning([{ stripeCustomerId: "cus_referrer" }]))
      .mockImplementationOnce(() => queryReturning([{ organizationId: 10 }]))
      .mockImplementationOnce(() => queryReturning([{ stripeCustomerId: "cus_referrer" }]));
    mocks.stripeSubscriptionsList.mockResolvedValue({ data: [canceledSubscription] });
    mocks.update.mockImplementation(() => ({
      set: vi.fn((values) => {
        updates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    }));

    await processReferralInvoicePaid(makeInvoice());

    expect(updates[0]).toMatchObject({
      status: "pending_reward",
      qualifyingInvoiceId: "in_first_paid",
      rewardCustomerId: "cus_referrer",
      rewardAmount: 4900,
      rewardCurrency: "eur",
    });
    expect(mocks.stripeBalanceCredit).not.toHaveBeenCalled();
  });

  it("calculates one month for monthly and annual base plans, including quantity", () => {
    expect(calculateReferralMonthlyReward(monthlyPrice, 2)).toBe(9800);
    const annualPrice = {
      ...monthlyPrice,
      recurring: { interval: "year" },
      unit_amount: 120000,
    } as unknown as Stripe.Price;
    expect(calculateReferralMonthlyReward(annualPrice, 2)).toBe(20000);
    const weeklyPrice = {
      ...monthlyPrice,
      recurring: { interval: "week" },
    } as unknown as Stripe.Price;
    expect(calculateReferralMonthlyReward(weeklyPrice)).toBeNull();
  });

  it("uses the same Stripe idempotency key when concurrent webhook retries credit one reward", async () => {
    configureStripe(activeSubscription);
    await Promise.all([
      applyPendingReferralCreditsForCustomer("cus_referrer"),
      applyPendingReferralCreditsForCustomer("cus_referrer"),
    ]);

    expect(mocks.stripeBalanceCredit).toHaveBeenCalledTimes(2);
    expect(mocks.stripeBalanceCredit.mock.calls.map((call) => call[2].idempotencyKey))
      .toEqual(["taskdesk-referral-42", "taskdesk-referral-42"]);
    // Stripe's idempotency behavior is represented by the keyed mock above:
    // both webhook attempts resolve to the same balance transaction.
    expect(mocks.externalCreditsCreated).toBe(1);
  });

  it("credits one month of the referrer's current plan after a plan and Stripe customer change", async () => {
    const annualPrice = {
      ...monthlyPrice,
      id: "price_annual",
      currency: "usd",
      unit_amount: 144000,
      recurring: { interval: "year" },
    } as unknown as Stripe.Price;
    const renewedSubscription = {
      ...activeSubscription,
      customer: "cus_renewed",
      items: { data: [{ price: annualPrice, quantity: 1 }] },
    };
    const updates: Record<string, unknown>[] = [];
    configureStripe(renewedSubscription);
    mocks.update.mockImplementation(() => ({
      set: vi.fn((values) => {
        updates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    }));
    mocks.select.mockImplementation((projection?: Record<string, unknown>) => {
      const keys = Object.keys(projection ?? {});
      if (keys.includes("organizationId")) return queryReturning([{ organizationId: 10 }]);
      if (keys.includes("stripeCustomerId")) return queryReturning([{ stripeCustomerId: "cus_renewed" }]);
      return queryReturning([pendingReferral]);
    });

    await applyPendingReferralCreditsForCustomer("cus_referrer");

    expect(mocks.stripeBalanceCredit).toHaveBeenCalledWith(
      "cus_renewed",
      expect.objectContaining({ amount: -12000, currency: "usd" }),
      { idempotencyKey: "taskdesk-referral-42" },
    );
    expect(updates[0]).toMatchObject({
      status: "rewarded",
      rewardCustomerId: "cus_renewed",
      rewardAmount: 12000,
      rewardCurrency: "usd",
    });
  });

  it("shows the current one-month estimate for pending rewards, not the old plan value", async () => {
    mocks.select.mockImplementation((projection?: Record<string, unknown>) => {
      const keys = Object.keys(projection ?? {});
      if (keys.includes("name")) return queryReturning([{ name: "Referrer" }]);
      if (keys.includes("code")) return queryReturning([{ code: "ReferralCode_123" }]);
      return queryReturning([pendingReferral]);
    });

    const activePlan = {
      customerId: "cus_referrer",
      subscription: activeSubscription as unknown as Stripe.Subscription,
      price: { ...monthlyPrice, unit_amount: 7500 },
      monthlyReward: 7500,
    };
    const withActivePlan = await getReferralOverview(10, activePlan);
    expect(withActivePlan.referrals[0]).toMatchObject({
      rewardAmount: 7500,
      rewardCurrency: "eur",
    });

    const withoutActivePlan = await getReferralOverview(10, null);
    expect(withoutActivePlan.referrals[0]).toMatchObject({
      rewardAmount: null,
      rewardCurrency: null,
    });
  });

  it("rejects malformed referral codes without querying storage or Stripe", async () => {
    await expect(
      (await import("./referralService")).attachReferralAtSignup("bad", 20, "new@example.test"),
    ).resolves.toBe(false);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.stripeSubscriptionsList).not.toHaveBeenCalled();
  });

  it("rejects a well-formed but unknown referral code", async () => {
    mocks.select.mockImplementationOnce(() => queryReturning([]));
    const { attachReferralAtSignup } = await import("./referralService");

    await expect(attachReferralAtSignup("ValidCode_123", 20, "new@example.test")).resolves.toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not create a second attribution when the referred organization already has one", async () => {
    mocks.select
      .mockImplementationOnce(() => queryReturning([{
        organizationId: 10,
        referrerEmail: "referrer@example.test",
      }]))
      .mockImplementationOnce(() => queryReturning([{ stripeCustomerId: "cus_referrer" }]));
    mocks.insert.mockImplementationOnce(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    }));
    const { attachReferralAtSignup } = await import("./referralService");

    await expect(attachReferralAtSignup("ValidCode_123", 20, "new@example.test")).resolves.toBe(false);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});
