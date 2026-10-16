import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  createBalanceTransaction: vi.fn(),
  retrieveCharge: vi.fn(),
  referral: null as any,
  idempotentTransactions: new Map<string, { id: string }>(),
  calls: 0,
}));

vi.mock("@workspace/db", () => {
  const select = () => {
    const query: any = {
      from: () => query,
      where: () => query,
      for: async () => mocks.referral ? [{ ...mocks.referral }] : [],
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(mocks.referral ? [{ ...mocks.referral }] : []).then(resolve),
    };
    return query;
  };
  const update = () => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => Object.assign(mocks.referral, values),
    }),
  });
  const tx = { select, update };
  return {
    db: {
      select,
      update,
      transaction: mocks.transaction,
    },
    organizationsTable: { id: "organizations.id", name: "organizations.name" },
    referralCodesTable: { code: "referral_codes.code", organizationId: "referral_codes.organizationId" },
    referralsTable: {
      id: "referrals.id",
      referrerOrganizationId: "referrals.referrerOrganizationId",
      referredOrganizationId: "referrals.referredOrganizationId",
      status: "referrals.status",
      qualifyingInvoiceId: "referrals.qualifyingInvoiceId",
      rewardCustomerId: "referrals.rewardCustomerId",
      rewardAmount: "referrals.rewardAmount",
      rewardCurrency: "referrals.rewardCurrency",
    },
    usersTable: {
      organizationId: "users.organizationId",
      stripeCustomerId: "users.stripeCustomerId",
      role: "users.role",
      isActive: "users.isActive",
    },
    __testTx: tx,
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  isNotNull: vi.fn(() => ({})),
}));

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    customers: { createBalanceTransaction: mocks.createBalanceTransaction },
    charges: { retrieve: mocks.retrieveCharge },
  })),
}));

import {
  processReferralChargeRefunded,
  processReferralDisputeCreated,
} from "./referralService";

let transactionQueue: Promise<void> = Promise.resolve();

function configureReferral(status: "pending_reward" | "rewarded") {
  mocks.referral = {
    id: 42,
    status,
    qualifyingInvoiceId: "in_qualifying",
    rewardCustomerId: "cus_referrer",
    rewardAmount: 4900,
    rewardCurrency: "eur",
    referredOrganizationId: 20,
  };
}

describe("referral reward invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionQueue = Promise.resolve();
    mocks.idempotentTransactions.clear();
    mocks.calls = 0;
    mocks.transaction.mockImplementation(async (callback) => {
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await callback({
          select: () => {
            const query: any = {
              from: () => query,
              where: () => query,
              for: async () => mocks.referral ? [{ ...mocks.referral }] : [],
            };
            return query;
          },
          update: () => ({
            set: (values: Record<string, unknown>) => ({
              where: async () => Object.assign(mocks.referral, values),
            }),
          }),
        });
      } finally {
        release();
      }
    });
    mocks.createBalanceTransaction.mockImplementation(async (_customer, _params, options) => {
      const existing = mocks.idempotentTransactions.get(options.idempotencyKey);
      if (existing) return existing;
      mocks.calls++;
      const result = { id: `cbtxn_${mocks.calls}` };
      mocks.idempotentTransactions.set(options.idempotencyKey, result);
      return result;
    });
  });

  it("revokes an unissued reward after the full qualifying payment is refunded", async () => {
    configureReferral("pending_reward");

    await processReferralChargeRefunded({
      amount: 4900,
      amount_refunded: 4900,
      invoice: "in_qualifying",
    } as any);

    expect(mocks.referral).toMatchObject({
      status: "revoked",
      rewardRevocationReason: "refund",
      stripeRewardReversalBalanceTransactionId: null,
    });
    expect(mocks.createBalanceTransaction).not.toHaveBeenCalled();
  });

  it("reverses an issued reward for a dispute and ignores duplicate retries", async () => {
    configureReferral("rewarded");
    const charge = { amount: 4900, amount_refunded: 0, invoice: "in_qualifying" } as any;

    await processReferralDisputeCreated({ charge } as any);
    await processReferralDisputeCreated({ charge } as any);

    expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.createBalanceTransaction).toHaveBeenCalledWith(
      "cus_referrer",
      expect.objectContaining({ amount: 4900, currency: "eur" }),
      { idempotencyKey: "taskdesk-referral-reversal-42" },
    );
    expect(mocks.referral).toMatchObject({
      status: "revoked",
      rewardRevocationReason: "dispute",
      stripeRewardReversalBalanceTransactionId: "cbtxn_1",
    });
  });

  it("serializes concurrent dispute retries so the reward is reversed only once", async () => {
    configureReferral("rewarded");
    const charge = { amount: 4900, amount_refunded: 0, invoice: "in_qualifying" } as any;

    await Promise.all([
      processReferralDisputeCreated({ charge } as any),
      processReferralDisputeCreated({ charge } as any),
    ]);

    expect(mocks.createBalanceTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.calls).toBe(1);
    expect(mocks.referral.status).toBe("revoked");
  });

  it("does not revoke a referral for a partial refund", async () => {
    configureReferral("pending_reward");

    await processReferralChargeRefunded({
      amount: 4900,
      amount_refunded: 1000,
      invoice: "in_qualifying",
    } as any);

    expect(mocks.referral.status).toBe("pending_reward");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("looks up an invoice when a dispute contains only the charge ID", async () => {
    configureReferral("pending_reward");
    mocks.retrieveCharge.mockResolvedValue({ invoice: "in_qualifying" });

    await processReferralDisputeCreated({ charge: "ch_disputed" } as any);

    expect(mocks.retrieveCharge).toHaveBeenCalledWith("ch_disputed");
    expect(mocks.referral).toMatchObject({
      status: "revoked",
      rewardRevocationReason: "dispute",
    });
  });
});
