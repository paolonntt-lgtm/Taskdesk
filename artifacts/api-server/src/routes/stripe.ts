import { Router, type IRouter } from 'express';
import { z } from 'zod';
import {
  GetStripeAddonPriceResponse,
  SetStripeAddonSeatsBody,
  SetStripeAddonSeatsResponse,
} from '@workspace/api-zod';
import { stripeStorage } from '../stripeStorage';
import { stripeService } from '../stripeService';
import { getUncachableStripeClient, isStripeNotConfiguredError } from '../stripeClient';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { getSeatUsage } from '../seatService';
import { appBaseUrlForRequest } from '../lib/appUrl';
import {
  getReferralOverview,
  getReferralPlan,
  getOrCreateReferralCode,
  getReferralApplicationStatus,
} from '../referralService';
import { isTaskDeskPlanProduct } from '../lib/stripeProductRules';

const priceIdBody = z.object({ priceId: z.string().min(1).max(200) });

const router: IRouter = Router();

router.get('/stripe/referrals/status', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  const organizationId = req.currentUser.organizationId;
  if (organizationId == null) {
    res.status(403).json({ error: 'Admin account has no organization' });
    return;
  }

  try {
    const status = await getReferralApplicationStatus(organizationId);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      applied: status.applied === true,
      attempted: status.attempted === true,
      retryPending: status.retryPending === true,
    });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

router.get('/stripe/referrals', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const organizationId = req.currentUser.organizationId;
    const plan = await getReferralPlan(organizationId, true);
    const overview = await getReferralOverview(organizationId, plan);
    res.setHeader('Cache-Control', 'no-store');
    if (!plan) {
      res.json({ eligible: false, referrals: overview.referrals });
      return;
    }
    const code = await getOrCreateReferralCode(organizationId);
    const baseUrl = appBaseUrlForRequest(req.get('origin'), req.get('host'));
    res.json({
      eligible: true,
      referralUrl: `${baseUrl}/app/?ref=${encodeURIComponent(code)}`,
      referrals: overview.referrals,
    });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

/** Returns true when the Stripe error indicates the customer ID is stale/invalid. */
function isNoSuchCustomer(err: any): boolean {
  return (
    err?.code === 'resource_missing' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('no such customer'))
  );
}

function sendStripeError(res: any, err: any): void {
  if (isStripeNotConfiguredError(err)) {
    res.status(503).json({
      error: 'STRIPE_NOT_CONFIGURED',
      message: 'Stripe billing is not configured yet.',
    });
    return;
  }
  res.status(500).json({ error: err?.message ?? 'Stripe request failed' });
}

function isPlanProduct(product: any): boolean {
  return isTaskDeskPlanProduct(product);
}

function isSupportedPlanPrice(price: any, product: any): boolean {
  return (
    price?.active === true &&
    price.currency === 'eur' &&
    ['month', 'year'].includes(price.recurring?.interval) &&
    product?.active === true &&
    isPlanProduct(product)
  );
}

type StripeBillingInterval = 'month' | 'year';

const ADDON_AMOUNT_BY_INTERVAL: Record<StripeBillingInterval, number> = {
  month: 600,
  year: 6000,
};

function isStripeBillingInterval(interval: unknown): interval is StripeBillingInterval {
  return interval === 'month' || interval === 'year';
}

function stripeProductId(product: any): string | null {
  if (typeof product === 'string') return product;
  return typeof product?.id === 'string' ? product.id : null;
}

async function findActiveSeatAddonProduct(stripe: any): Promise<any | undefined> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  return products.data.find((product: any) => product.metadata?.addon === 'seat');
}

async function findActiveSeatAddonPrice(
  stripe: any,
  productId: string,
  interval: StripeBillingInterval,
): Promise<any | undefined> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return prices.data.find((price: any) =>
    price.active === true &&
    price.recurring?.interval === interval &&
    price.currency === 'eur' &&
    price.unit_amount === ADDON_AMOUNT_BY_INTERVAL[interval]
  );
}

router.get('/stripe/products', async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });

    const result = await Promise.all(
      products.data.filter(isPlanProduct).map(async (product) => {
        const prices = await stripe.prices.list({ product: product.id, active: true });
        const seatsMeta = product.metadata?.seats;
        let seats: number | null = null;
        let unlimited = false;
        if (seatsMeta === 'unlimited') unlimited = true;
        else if (seatsMeta) {
          const n = parseInt(String(seatsMeta), 10);
          if (!isNaN(n) && n > 0) seats = n;
        }
        return {
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          active: product.active,
          metadata: product.metadata ?? {},
          seats,
          unlimited,
          prices: prices.data.map((p) => ({
            id: p.id,
            unit_amount: p.unit_amount,
            currency: p.currency,
            recurring: p.recurring ? { interval: p.recurring.interval } : null,
            active: p.active,
          })),
        };
      })
    );

    res.json({ data: result });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

router.get('/stripe/subscription', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.json({ subscription: null });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let sub = null;
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 1,
      });
      sub = subscriptions.data[0] ?? null;
    } catch (stripeErr: any) {
      if (isNoSuchCustomer(stripeErr)) {
        // Stale customer ID — clear it so future calls don't hit Stripe with a dead ID
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: null, stripeSubscriptionId: null });
        res.json({ subscription: null });
        return;
      }
      throw stripeErr;
    }

    res.json({ subscription: sub });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

function maxAddonForPlan(planSeats: number | null, unlimited: boolean): number {
  if (unlimited) return 0;
  if (!planSeats) return 0;
  if (planSeats <= 5) return 4;
  if (planSeats <= 10) return 9;
  return 0;
}

router.get('/stripe/seat-usage', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const usage = await getSeatUsage(req.currentUser.organizationId ?? null);
    const maxAddonSeats = maxAddonForPlan(usage.planSeats, usage.unlimited);
    res.json({ ...usage, maxAddonSeats });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

router.post('/stripe/checkout', requireAuth, async (req: any, res): Promise<void> => {
  try {
    const parsed = priceIdBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'priceId is required' }); return; }
    const { priceId } = parsed.data;

    const stripe = await getUncachableStripeClient();
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product as any;
    if (!isSupportedPlanPrice(price, product)) {
      res.status(400).json({ error: 'INVALID_PLAN_PRICE' });
      return;
    }

    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const baseUrl = appBaseUrlForRequest(req.get('origin'), req.get('host'));
    const doCheckout = (cid: string) =>
      stripeService.createCheckoutSession(
        cid,
        priceId,
        `${baseUrl}/app/billing?success=1`,
        `${baseUrl}/app/billing`
      );

    let session;
    try {
      session = await doCheckout(customerId);
    } catch (stripeErr: any) {
      if (isNoSuchCustomer(stripeErr)) {
        // Stale customer ID — clear it, create a fresh customer, retry once
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: null });
        const newCustomer = await stripeService.createCustomer(user.email, user.id);
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: newCustomer.id });
        session = await doCheckout(newCustomer.id);
      } else {
        throw stripeErr;
      }
    }

    res.json({ url: session.url });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

/**
 * Sync the latest Stripe subscription ID into the users table.
 * Called by the frontend after a successful Stripe Checkout redirect (?success=1)
 * so the trial-enforcement check in requireAuth can see the active subscription.
 */
router.post('/stripe/sync-subscription', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.json({ subscriptionId: null });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let subscriptionId: string | null = null;
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 5,
      });
      const activeSub = subs.data.find((s) =>
        ['active', 'trialing', 'past_due'].includes(s.status)
      );
      subscriptionId = activeSub?.id ?? null;
    } catch (stripeErr: any) {
      if (isNoSuchCustomer(stripeErr)) {
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: null, stripeSubscriptionId: null });
        res.json({ subscriptionId: null });
        return;
      }
      throw stripeErr;
    }

    await stripeStorage.updateUserStripeInfo(user.id, { stripeSubscriptionId: subscriptionId });
    res.json({ subscriptionId });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

router.post('/stripe/upgrade', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const parsed = priceIdBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'priceId is required' }); return; }
    const { priceId } = parsed.data;

    const usage = await getSeatUsage(req.currentUser.organizationId ?? null);
    if (!usage.subscriptionId || !usage.subscriptionItemId) {
      res.status(400).json({ error: 'NO_ACTIVE_SUBSCRIPTION', message: 'Nessun abbonamento attivo da modificare.' });
      return;
    }
    if (priceId === usage.currentPriceId) {
      res.status(400).json({ error: 'SAME_PLAN', message: 'È già il piano attuale.' });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const newPrice = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const newProduct = newPrice.product as any;
    if (!isSupportedPlanPrice(newPrice, newProduct)) {
      res.status(400).json({ error: 'INVALID_PLAN_PRICE', message: 'Il prezzo selezionato non è un piano disponibile.' });
      return;
    }
    const newSeatsMeta = newProduct?.metadata?.seats;
    let newSeats: number | null = null;
    let newUnlimited = false;
    if (newSeatsMeta === 'unlimited') newUnlimited = true;
    else {
      const n = parseInt(String(newSeatsMeta), 10);
      if (!isNaN(n) && n > 0) newSeats = n;
    }

    if (!newUnlimited && newSeats !== null && newSeats < usage.usedSeats) {
      res.status(400).json({
        error: 'CANNOT_DOWNGRADE_BELOW_USAGE',
        message: `Il piano scelto offre ${newSeats} posti ma stai usando ${usage.usedSeats} utenti attivi. Disattiva alcuni utenti prima di passare a questo piano.`,
        usedSeats: usage.usedSeats,
        newSeats,
        newPlanName: newProduct?.name,
      });
      return;
    }

    const currentSubscription = await stripe.subscriptions.retrieve(usage.subscriptionId, {
      expand: ['items.data.price'],
    });
    const addonItems: any[] = [];
    for (const item of currentSubscription.items.data) {
      if (item.id === usage.subscriptionItemId) continue;
      const productId = stripeProductId(item.price.product);
      if (!productId) continue;
      const itemProduct = await stripe.products.retrieve(productId);
      if (itemProduct.metadata?.addon === 'seat') addonItems.push(item);
    }

    const subscriptionItems: any[] = [{ id: usage.subscriptionItemId, price: priceId }];
    if (addonItems.length > 0) {
      const addonProductId = stripeProductId(addonItems[0].price.product);
      if (!addonProductId || !isStripeBillingInterval(newPrice.recurring?.interval)) {
        res.status(400).json({ error: 'ADDON_BILLING_INTERVAL_UNSUPPORTED' });
        return;
      }
      const addonPrice = await findActiveSeatAddonPrice(stripe, addonProductId, newPrice.recurring.interval);
      if (!addonPrice) {
        res.status(404).json({
          error: 'ADDON_NOT_CONFIGURED',
          message: 'Non è configurato il prezzo collaboratore per la cadenza del piano selezionato.',
        });
        return;
      }

      subscriptionItems[0].quantity = currentSubscription.items.data.find(
        (item: any) => item.id === usage.subscriptionItemId,
      )?.quantity ?? 1;
      subscriptionItems.push({
        id: addonItems[0].id,
        price: addonPrice.id,
        quantity: addonItems.reduce((total, item) => total + (item.quantity ?? 0), 0),
      });
      for (const duplicateItem of addonItems.slice(1)) {
        subscriptionItems.push({ id: duplicateItem.id, deleted: true });
      }
    }

    const updated = await stripe.subscriptions.update(usage.subscriptionId, {
      items: subscriptionItems,
      proration_behavior: 'create_prorations',
      payment_behavior: 'pending_if_incomplete',
    });

    res.json({
      subscription: { id: updated.id, status: updated.status },
      newPlanName: newProduct?.name,
      newSeats: newUnlimited ? null : newSeats,
      unlimited: newUnlimited,
    });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

/**
 * Returns the price info for the "Additional Seat" addon product.
 * The admin must create a product in Stripe with metadata.addon = "seat".
 * Returns 404 if not configured.
 */
router.get('/stripe/addon-price', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const usage = await getSeatUsage(req.currentUser.organizationId ?? null);
    if (!usage.subscriptionId || !usage.currentPriceId) {
      res.status(400).json({
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'È necessario un abbonamento attivo per aggiungere collaboratori.',
      });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const basePrice = await stripe.prices.retrieve(usage.currentPriceId);
    const interval = basePrice.recurring?.interval;
    if (!isStripeBillingInterval(interval)) {
      res.status(400).json({ error: 'ADDON_BILLING_INTERVAL_UNSUPPORTED' });
      return;
    }

    const addonProduct = await findActiveSeatAddonProduct(stripe);
    if (!addonProduct) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED' });
      return;
    }
    const price = await findActiveSeatAddonPrice(stripe, addonProduct.id, interval);
    if (!price) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED' });
      return;
    }
    res.json(GetStripeAddonPriceResponse.parse({
      priceId: price.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval,
    }));
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

/**
 * Add or remove addon seats on the active subscription.
 * Body: { quantity: number } — total desired addon seat count (not delta).
 * quantity === 0 removes the addon item from the subscription.
 */
router.post('/stripe/add-seats', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const parsed = SetStripeAddonSeatsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_QUANTITY', message: 'quantity must be an integer between 0 and 500' });
      return;
    }
    const { quantity } = parsed.data;

    const usage = await getSeatUsage(req.currentUser.organizationId ?? null);
    if (!usage.subscriptionId) {
      res.status(400).json({ error: 'NO_ACTIVE_SUBSCRIPTION', message: 'Nessun abbonamento attivo.' });
      return;
    }
    if (usage.unlimited) {
      res.status(400).json({ error: 'UNLIMITED_PLAN', message: 'Il piano Enterprise ha posti illimitati.' });
      return;
    }
    const maxAddon = maxAddonForPlan(usage.planSeats, usage.unlimited);
    if (quantity > 0 && maxAddon === 0) {
      res.status(400).json({ error: 'ADDON_NOT_ALLOWED', message: 'Il tuo piano non supporta collaboratori aggiuntivi. Passa al piano Enterprise per avere utenti illimitati.' });
      return;
    }
    if (quantity > maxAddon) {
      res.status(400).json({ error: 'ADDON_LIMIT_EXCEEDED', message: `Il tuo piano supporta al massimo ${maxAddon} collaboratori aggiuntivi.` });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const addonProduct = await findActiveSeatAddonProduct(stripe);
    if (!addonProduct) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED', message: 'Prodotto addon non configurato su Stripe.' });
      return;
    }

    const basePrice = usage.currentPriceId
      ? await stripe.prices.retrieve(usage.currentPriceId)
      : null;
    const interval = basePrice?.recurring?.interval;
    if (!isStripeBillingInterval(interval)) {
      res.status(400).json({ error: 'ADDON_BILLING_INTERVAL_UNSUPPORTED' });
      return;
    }

    const addonPrice = await findActiveSeatAddonPrice(stripe, addonProduct.id, interval);
    if (!addonPrice) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED', message: 'Prezzo addon non trovato.' });
      return;
    }

    // Retrieve the subscription to find any existing addon item
    const sub = await stripe.subscriptions.retrieve(usage.subscriptionId, {
      expand: ['items.data.price'],
    });
    const existingAddonItems: any[] = [];
    for (const item of sub.items.data) {
      const productId = stripeProductId(item.price.product);
      if (productId === addonProduct.id) existingAddonItems.push(item);
    }

    if (quantity === 0) {
      for (const item of existingAddonItems) {
        await stripe.subscriptionItems.del(item.id, {
          proration_behavior: 'create_prorations',
        });
      }
    } else if (existingAddonItems.length > 0) {
      await stripe.subscriptionItems.update(existingAddonItems[0].id, {
        price: addonPrice.id,
        quantity,
        proration_behavior: 'create_prorations',
      });
      for (const duplicateItem of existingAddonItems.slice(1)) {
        await stripe.subscriptionItems.del(duplicateItem.id, {
          proration_behavior: 'create_prorations',
        });
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: usage.subscriptionId,
        price: addonPrice.id,
        quantity,
        proration_behavior: 'create_prorations',
      });
    }

    const updated = await getSeatUsage(req.currentUser.organizationId ?? null);
    res.json(SetStripeAddonSeatsResponse.parse({
      addonSeats: updated.addonSeats,
      available: updated.available,
      limitReached: updated.limitReached,
    }));
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

router.post('/stripe/portal', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'Nessun cliente Stripe trovato per questo utente' });
      return;
    }

    const baseUrl = appBaseUrlForRequest(req.get('origin'), req.get('host'));
    let session;
    try {
      session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/app/billing`
      );
    } catch (stripeErr: any) {
      if (isNoSuchCustomer(stripeErr)) {
        await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: null, stripeSubscriptionId: null });
        res.status(400).json({ error: 'Nessun cliente Stripe trovato per questo utente' });
        return;
      }
      throw stripeErr;
    }

    res.json({ url: session.url });
  } catch (err: any) {
    sendStripeError(res, err);
  }
});

export default router;
