import { eq, and, isNotNull } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';
import { getUncachableStripeClient } from './stripeClient';

export interface SeatUsage {
  usedSeats: number;
  planSeats: number | null;
  planName: string;
  currentPriceId: string | null;
  subscriptionId: string | null;
  subscriptionItemId: string | null;
  status: string | null;
  hasActiveSubscription: boolean;
  unlimited: boolean;
  available: number | null;
  limitReached: boolean;
}

/**
 * Returns seat usage for the given organization.
 *
 * Billing state is resolved at the organization level: we look through all
 * admin users in the organization (role='admin') who have a stripeCustomerId,
 * and search each one for an active/trialing/past_due subscription.
 * This prevents any admin without a Stripe customer record from failing open
 * to unlimited seats, and ensures we don't accidentally pick up a non-admin
 * user's personal Stripe customer record.
 */
export async function getSeatUsage(organizationId: number | null): Promise<SeatUsage> {
  // Count active users in the organization
  const activeUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      organizationId != null
        ? and(eq(usersTable.isActive, true), eq(usersTable.organizationId, organizationId))
        : eq(usersTable.isActive, true)
    );
  const usedSeats = activeUsers.length;

  // Collect stripeCustomerIds from admin users in this organization only.
  // Restricting to role='admin' prevents a non-admin user's personal Stripe
  // customer (created e.g. via /stripe/checkout) from influencing enforcement.
  let adminCustomerIds: string[] = [];
  if (organizationId != null) {
    const adminRows = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.organizationId, organizationId),
          eq(usersTable.role, 'admin'),
          isNotNull(usersTable.stripeCustomerId)
        )
      );
    adminCustomerIds = adminRows
      .map((r) => r.stripeCustomerId)
      .filter((id): id is string => id != null);
  }

  let planSeats: number | null = null;
  let planName = 'Free';
  let currentPriceId: string | null = null;
  let subscriptionId: string | null = null;
  let subscriptionItemId: string | null = null;
  let status: string | null = null;
  let unlimited = true;
  let hasActiveSubscription = false;

  if (adminCustomerIds.length > 0) {
    try {
      const stripe = await getUncachableStripeClient();

      // Iterate through each admin's Stripe customer to find an active
      // subscription. We stop at the first one found. In a well-formed org
      // there is exactly one billing admin, but this handles edge cases
      // without picking an arbitrary record via LIMIT 1.
      for (const customerId of adminCustomerIds) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 5,
          expand: ['data.items.data.price.product'],
        });
        const sub = subs.data.find((s) =>
          ['active', 'trialing', 'past_due'].includes(s.status)
        );
        if (sub) {
          hasActiveSubscription = true;
          status = sub.status;
          subscriptionId = sub.id;
          const item = sub.items.data[0];
          if (item) {
            subscriptionItemId = item.id;
            currentPriceId = item.price.id;
            const product = item.price.product as any;
            planName = product?.name ?? 'Plan';
            const seatsMeta = product?.metadata?.seats;
            if (seatsMeta === 'unlimited' || !seatsMeta) {
              unlimited = true;
              planSeats = null;
            } else {
              const n = parseInt(String(seatsMeta), 10);
              if (!isNaN(n) && n > 0) {
                planSeats = n;
                unlimited = false;
              }
            }
          }
          // Found an active subscription — stop searching
          break;
        }
      }
    } catch (err) {
      // Stripe failure → fail-open, no seat limit
      // eslint-disable-next-line no-console
      console.warn('[seatService] Stripe lookup failed, defaulting to unlimited:', (err as any)?.message);
    }
  }

  const available = unlimited || planSeats === null ? null : Math.max(0, planSeats - usedSeats);
  const limitReached = !unlimited && planSeats !== null && usedSeats >= planSeats;

  return {
    usedSeats,
    planSeats,
    planName,
    currentPriceId,
    subscriptionId,
    subscriptionItemId,
    status,
    hasActiveSubscription,
    unlimited,
    available,
    limitReached,
  };
}

export interface SeatLimitError {
  error: 'SEAT_LIMIT_REACHED';
  message: string;
  messageEn: string;
  usedSeats: number;
  planSeats: number;
  planName: string;
}

export function buildSeatLimitError(usage: SeatUsage): SeatLimitError {
  return {
    error: 'SEAT_LIMIT_REACHED',
    message: `Hai raggiunto il limite di ${usage.planSeats} posti del piano ${usage.planName}. Esegui l'upgrade per aggiungere altri utenti.`,
    messageEn: `You have reached the ${usage.planSeats}-seat limit of the ${usage.planName} plan. Upgrade to add more users.`,
    usedSeats: usage.usedSeats,
    planSeats: usage.planSeats!,
    planName: usage.planName,
  };
}
