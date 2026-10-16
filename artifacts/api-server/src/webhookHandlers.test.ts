import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processWebhook: vi.fn(),
  processReferralInvoicePaid: vi.fn(),
  processReferralChargeRefunded: vi.fn(),
  processReferralDisputeCreated: vi.fn(),
}));

vi.mock("./stripeClient", () => ({
  getStripeSync: vi.fn(async () => ({ processWebhook: mocks.processWebhook })),
}));

vi.mock("./referralService", () => ({
  processReferralInvoicePaid: mocks.processReferralInvoicePaid,
  processReferralChargeRefunded: mocks.processReferralChargeRefunded,
  processReferralDisputeCreated: mocks.processReferralDisputeCreated,
}));

import { WebhookHandlers } from "./webhookHandlers";

function rawEvent(type: string): Buffer {
  return Buffer.from(JSON.stringify({
    id: "evt_test_referral",
    type,
    data: { object: { id: "in_test", amount_paid: 4900 } },
  }));
}

describe("Stripe webhook referral dispatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches invoice.paid only after StripeSync accepts the signed webhook", async () => {
    const payload = rawEvent("invoice.paid");
    mocks.processWebhook.mockResolvedValue(undefined);

    await WebhookHandlers.processWebhook(payload, "stripe-signature");

    expect(mocks.processWebhook).toHaveBeenCalledWith(payload, "stripe-signature");
    expect(mocks.processReferralInvoicePaid).toHaveBeenCalledWith({
      id: "in_test",
      amount_paid: 4900,
    });
    expect(mocks.processWebhook.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.processReferralInvoicePaid.mock.invocationCallOrder[0]);
  });

  it("does not dispatch referral processing when signature validation fails", async () => {
    mocks.processWebhook.mockRejectedValue(new Error("invalid signature"));

    await expect(WebhookHandlers.processWebhook(rawEvent("invoice.paid"), "bad-signature"))
      .rejects.toThrow("invalid signature");
    expect(mocks.processReferralInvoicePaid).not.toHaveBeenCalled();
  });

  it("does not treat unrelated Stripe events as referral payments", async () => {
    mocks.processWebhook.mockResolvedValue(undefined);
    await WebhookHandlers.processWebhook(rawEvent("invoice.payment_failed"), "stripe-signature");
    expect(mocks.processReferralInvoicePaid).not.toHaveBeenCalled();
    expect(mocks.processReferralChargeRefunded).not.toHaveBeenCalled();
    expect(mocks.processReferralDisputeCreated).not.toHaveBeenCalled();
  });

  it("dispatches full-refund events to the referral invalidation handler", async () => {
    mocks.processWebhook.mockResolvedValue(undefined);
    const payload = rawEvent("charge.refunded");

    await WebhookHandlers.processWebhook(payload, "stripe-signature");

    expect(mocks.processReferralChargeRefunded).toHaveBeenCalledWith({
      id: "in_test",
      amount_paid: 4900,
    });
  });

  it("dispatches dispute-created events to the referral invalidation handler", async () => {
    mocks.processWebhook.mockResolvedValue(undefined);
    const payload = rawEvent("charge.dispute.created");

    await WebhookHandlers.processWebhook(payload, "stripe-signature");

    expect(mocks.processReferralDisputeCreated).toHaveBeenCalledWith({
      id: "in_test",
      amount_paid: 4900,
    });
  });
});
