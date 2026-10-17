import { randomBytes } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  db, notificationsTable, organizationsTable, referralCodesTable, referralsTable, usersTable,
} from "@workspace/db";
import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { isTaskDeskPlanProduct, subscriptionHasTaskDeskPlan } from "./lib/stripeProductRules";

export type ReferralPlan = {
  customerId: string;
  subscription: Stripe.Subscription;
  price: Stripe.Price;
  monthlyReward: number;
};

export function calculateReferralMonthlyReward(price: Stripe.Price, quantity = 1): number | null {
  if (price.unit_amount == null || !price.recurring) return null;
  if (price.recurring.interval !== "month" && price.recurring.interval !== "year") return null;
  const monthlyUnitAmount = price.recurring.interval === "year"
    ? price.unit_amount / 12
    : price.unit_amount;
  return Math.round(monthlyUnitAmount * quantity);
}

export async function getReferralPlan(organizationId: number, activeOnly = true): Promise<ReferralPlan | null> {
  const admins = await db.select({ stripeCustomerId: usersTable.stripeCustomerId })
    .from(usersTable).where(and(
      eq(usersTable.organizationId, organizationId),
      eq(usersTable.role, "admin"),
      eq(usersTable.isActive, true),
      isNotNull(usersTable.stripeCustomerId),
    ));
  const customerIds = admins.map((row) => row.stripeCustomerId).filter((id): id is string => !!id);
  if (!customerIds.length) return null;
  const stripe = await getUncachableStripeClient();
  const subs: Stripe.Subscription[] = [];
  for (const customer of customerIds) {
    let startingAfter: string | undefined;
    while (true) {
      const result = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
        expand: ["data.items.data.price"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subs.push(...result.data);
      if (!result.has_more) break;
      const lastSubscription = result.data.at(-1);
      if (!lastSubscription) {
        throw new Error(`Stripe returned another subscription page without a cursor for customer ${customer}`);
      }
      startingAfter = lastSubscription.id;
    }
  }
  const candidates = subs
    .filter((sub) => activeOnly ? sub.status === "active" : !["trialing", "incomplete", "incomplete_expired"].includes(sub.status))
    .sort((a, b) => {
      const createdOrder = b.created - a.created;
      if (createdOrder !== 0) return createdOrder;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  for (const subscription of candidates) {
    for (const item of subscription.items.data) {
      const price = item.price as Stripe.Price;
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const product = await stripe.products.retrieve(productId);
      const monthlyReward = calculateReferralMonthlyReward(price, item.quantity ?? 1);
      if (!isTaskDeskPlanProduct(product) || monthlyReward == null) continue;
      return { customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id, subscription, price, monthlyReward };
    }
  }
  return null;
}

export async function getOrCreateReferralCode(organizationId: number): Promise<string> {
  const [existing] = await db.select({ code: referralCodesTable.code })
    .from(referralCodesTable).where(eq(referralCodesTable.organizationId, organizationId));
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(9).toString("base64url");
    try {
      await db.insert(referralCodesTable).values({ organizationId, code });
      return code;
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
      const [raceWinner] = await db.select({ code: referralCodesTable.code })
        .from(referralCodesTable).where(eq(referralCodesTable.organizationId, organizationId));
      if (raceWinner) return raceWinner.code;
    }
  }
  throw new Error("Could not create a unique referral code");
}

export async function attachReferralAtSignup(
  code: unknown,
  referredOrganizationId: number,
  signupEmail: string,
): Promise<boolean> {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(code)) return false;
  const records = await db.select({
    organizationId: referralCodesTable.organizationId,
    referrerEmail: usersTable.email,
  }).from(referralCodesTable)
    .innerJoin(usersTable, and(
      eq(usersTable.organizationId, referralCodesTable.organizationId),
      eq(usersTable.role, "admin"),
      eq(usersTable.isActive, true),
    ))
    .where(eq(referralCodesTable.code, code));
  const organizationId = records[0]?.organizationId;
  if (!organizationId || organizationId === referredOrganizationId
    || records.some((record) => record.referrerEmail.toLowerCase() === signupEmail.toLowerCase())) return false;
  if (!(await getReferralPlan(organizationId, true))) return false;
  const inserted = await db.insert(referralsTable).values({
    referrerOrganizationId: organizationId,
    referredOrganizationId,
    status: "pending_payment",
  }).onConflictDoNothing().returning({ id: referralsTable.id });
  return inserted.length > 0;
}

export async function hasReferralAttribution(referredOrganizationId: number): Promise<boolean> {
  const [referral] = await db.select({ id: referralsTable.id })
    .from(referralsTable)
    .where(eq(referralsTable.referredOrganizationId, referredOrganizationId));
  return Boolean(referral);
}

export async function processReferralInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const rawSubscriptionId = (invoice as any).subscription
    ?? (invoice as any).parent?.subscription_details?.subscription;
  const subscriptionId = typeof rawSubscriptionId === "string" ? rawSubscriptionId : rawSubscriptionId?.id;
  if (!customerId || !subscriptionId || invoice.status !== "paid" || invoice.amount_paid <= 0) return;
  const stripe = await getUncachableStripeClient();
  const paidSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  });
  if (!(await subscriptionHasTaskDeskPlan(stripe, paidSubscription))) return;
  const [buyer] = await db.select({ organizationId: usersTable.organizationId })
    .from(usersTable).where(and(eq(usersTable.stripeCustomerId, customerId), eq(usersTable.role, "admin")));
  if (!buyer?.organizationId) return;
  const isQualifyingPayment = ["subscription_create", "subscription_cycle"]
    .includes(invoice.billing_reason ?? "");
  const [referral] = isQualifyingPayment
    ? await db.select().from(referralsTable).where(and(
      eq(referralsTable.referredOrganizationId, buyer.organizationId),
      eq(referralsTable.status, "pending_payment"),
    ))
    : [undefined];
  if (!referral) {
    const [qualifiedReferral] = await db.select({
      rewardCustomerId: referralsTable.rewardCustomerId,
    }).from(referralsTable).where(and(
      eq(referralsTable.referredOrganizationId, buyer.organizationId),
      eq(referralsTable.status, "pending_reward"),
    ));
    if (qualifiedReferral?.rewardCustomerId) {
      await applyPendingReferralCreditsForCustomer(qualifiedReferral.rewardCustomerId);
    }
    await applyPendingReferralCreditsForCustomer(customerId);
    return;
  }
  const plan = await getReferralPlan(referral.referrerOrganizationId, false);
  if (!plan || plan.monthlyReward <= 0) return;
  await db.update(referralsTable).set({
    status: "pending_reward",
    qualifyingInvoiceId: invoice.id,
    rewardCustomerId: plan.customerId,
    rewardAmount: plan.monthlyReward,
    rewardCurrency: plan.price.currency,
    qualifiedAt: new Date(),
  }).where(and(
    eq(referralsTable.id, referral.id),
    eq(referralsTable.status, "pending_payment"),
  ));
  await applyPendingReferralCreditsForCustomer(plan.customerId);
}

function getChargeInvoiceId(charge: Stripe.Charge): string | null {
  const invoice = (charge as any).invoice;
  if (typeof invoice === "string") return invoice;
  return typeof invoice?.id === "string" ? invoice.id : null;
}
export async function applyPendingReferralCreditsForCustomer(customerId: string): Promise<void> {
  const [admin] = await db.select({ organizationId: usersTable.organizationId })
    .from(usersTable).where(and(
      eq(usersTable.stripeCustomerId, customerId),
      eq(usersTable.role, "admin"),
      eq(usersTable.isActive, true),
    ));
  if (!admin?.organizationId) return;
  // The current active subscription defines the one-month reward. This is
  // intentionally resolved at credit time, so plan changes and reactivations
  // update pending rewards instead of applying a stale qualification-time value.
  const activePlan = await getReferralPlan(admin.organizationId, true);
  if (!activePlan || activePlan.monthlyReward <= 0) return;
  const pending = await db.select().from(referralsTable).where(and(
    eq(referralsTable.referrerOrganizationId, admin.organizationId),
    eq(referralsTable.status, "pending_reward"),
    isNotNull(referralsTable.rewardAmount),
    isNotNull(referralsTable.rewardCurrency),
  ));
  if (!pending.length) return;
  const stripe = await getUncachableStripeClient();
  for (const referral of pending) {
    await db.transaction(async (tx) => {
      const [lockedReferral] = await tx.select().from(referralsTable)
        .where(and(eq(referralsTable.id, referral.id), eq(referralsTable.status, "pending_reward")))
        .for("update");
      if (!lockedReferral) return;
      const transaction = await stripe.customers.createBalanceTransaction(activePlan.customerId, {
        amount: -Math.abs(activePlan.monthlyReward),
        currency: activePlan.price.currency,
        description: "TaskDesk referral reward — one month of subscription",
        metadata: {
          referralId: String(lockedReferral.id),
          referredOrganizationId: String(lockedReferral.referredOrganizationId),
        },
      }, { idempotencyKey: `taskdesk-referral-${lockedReferral.id}` });
      const creditedCustomerId = typeof transaction.customer === "string"
        ? transaction.customer
        : transaction.customer.id;
      await tx.update(referralsTable).set({
        status: "rewarded",
        rewardCustomerId: creditedCustomerId,
        rewardAmount: Math.abs(transaction.amount),
        rewardCurrency: transaction.currency,
        stripeBalanceTransactionId: transaction.id,
        rewardedAt: new Date(),
      }).where(and(
        eq(referralsTable.id, lockedReferral.id),
        eq(referralsTable.status, "pending_reward"),
      ));

      const [referredOrganization] = await tx.select({
        name: organizationsTable.name,
      }).from(organizationsTable).where(
        eq(organizationsTable.id, lockedReferral.referredOrganizationId),
      );
      if (!referredOrganization?.name) {
        throw new Error(`Referred organization for referral ${lockedReferral.id} was not found`);
      }
      const admins = await tx.select({ id: usersTable.id }).from(usersTable).where(and(
        eq(usersTable.organizationId, lockedReferral.referrerOrganizationId),
        eq(usersTable.role, "admin"),
        eq(usersTable.isActive, true),
      ));
      if (admins.length > 0) {
        await tx.insert(notificationsTable).values(admins.map(({ id }) => ({
          userId: id,
          ticketId: null,
          type: "system",
          notificationText: `Premio referral accreditato per ${referredOrganization.name}`,
          isRead: false,
        })));
      }
    });
  }
}

export async function getReferralOverview(organizationId: number, activePlan: ReferralPlan | null) {
  const [organization] = await db.select({ name: organizationsTable.name })
    .from(organizationsTable).where(eq(organizationsTable.id, organizationId));
  const [code] = await db.select({ code: referralCodesTable.code })
    .from(referralCodesTable).where(eq(referralCodesTable.organizationId, organizationId));
  const referrals = await db.select({
    id: referralsTable.id,
    status: referralsTable.status,
    rewardAmount: referralsTable.rewardAmount,
    rewardCurrency: referralsTable.rewardCurrency,
    rewardRevocationReason: referralsTable.rewardRevocationReason,
    createdAt: referralsTable.createdAt,
    qualifiedAt: referralsTable.qualifiedAt,
    rewardedAt: referralsTable.rewardedAt,
    referredOrganizationName: organizationsTable.name,
  }).from(referralsTable).innerJoin(
    organizationsTable,
    eq(organizationsTable.id, referralsTable.referredOrganizationId),
  ).where(eq(referralsTable.referrerOrganizationId, organizationId));
  return {
    organization,
    code: code?.code ?? null,
    referrals: referrals.map((referral) => referral.status === "pending_reward"
      ? {
          ...referral,
          // Pending amounts are estimates, not a promise to preserve the
          // plan that was active when the referred customer first paid.
          rewardAmount: activePlan?.monthlyReward ?? null,
          rewardCurrency: activePlan?.price.currency ?? null,
        }
      : referral),
  };
}

export async function processReferralDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const stripe = await getUncachableStripeClient();
  const charge = typeof dispute.charge === "string"
    ? await stripe.charges.retrieve(dispute.charge)
    : dispute.charge;
  const invoiceId = getChargeInvoiceId(charge);
  if (invoiceId) await revokeReferralForInvoice(invoiceId, "dispute");
}

async function revokeReferralForInvoice(
  invoiceId: string,
  reason: "refund" | "dispute",
): Promise<void> {
  await db.transaction(async (tx) => {
    const [referral] = await tx.select().from(referralsTable)
      .where(eq(referralsTable.qualifyingInvoiceId, invoiceId))
      .for("update");
    if (!referral || !["pending_reward", "rewarded"].includes(referral.status)) return;

    let reversalTransactionId: string | null = null;
    if (referral.status === "rewarded") {
      if (!referral.rewardCustomerId || !referral.rewardAmount || !referral.rewardCurrency) {
        throw new Error(`Referral ${referral.id} is missing reward details; cannot revoke its credit`);
      }
      const stripe = await getUncachableStripeClient();
      const reversal = await stripe.customers.createBalanceTransaction(
        referral.rewardCustomerId,
        {
          amount: Math.abs(referral.rewardAmount),
          currency: referral.rewardCurrency,
          description: "TaskDesk referral reward reversal — qualifying payment invalidated",
          metadata: {
            referralId: String(referral.id),
            qualifyingInvoiceId: invoiceId,
            reason,
          },
        },
        { idempotencyKey: `taskdesk-referral-reversal-${referral.id}` },
      );
      reversalTransactionId = reversal.id;
    }

    await tx.update(referralsTable).set({
      status: "revoked",
      stripeRewardReversalBalanceTransactionId: reversalTransactionId,
      rewardRevocationReason: reason,
      rewardRevokedAt: new Date(),
    }).where(eq(referralsTable.id, referral.id));
  });
}

export async function processReferralChargeRefunded(charge: Stripe.Charge): Promise<void> {
  // A partial refund leaves the qualifying payment valid. Revoke only once the
  // full invoice charge has been refunded.
  if (charge.amount <= 0 || charge.amount_refunded < charge.amount) return;
  const invoiceId = getChargeInvoiceId(charge);
  if (invoiceId) await revokeReferralForInvoice(invoiceId, "refund");
}
