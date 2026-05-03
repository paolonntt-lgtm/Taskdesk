import { eq } from 'drizzle-orm';
import { db, usersTable } from '@workspace/db';
import { getUncachableStripeClient } from './stripeClient';
import { stripeStorage } from './stripeStorage';

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

export async function getSeatUsage(userId: number): Promise<SeatUsage> {
  const user = await stripeStorage.getUser(userId);

  const activeUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isActive, true));
  const usedSeats = activeUsers.length;

  let planSeats: number | null = null;
  let planName = 'Free';
  let currentPriceId: string | null = null;
  let subscriptionId: string | null = null;
  let subscriptionItemId: string | null = null;
  let status: string | null = null;
  let unlimited = true;
  let hasActiveSubscription = false;

  if (user?.stripeCustomerId) {
    try {
      const stripe = await getUncachableStripeClient();
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 5,
        expand: ['data.items.data.price.product'],
      });
      const sub = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
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
