import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { stripeStorage } from '../stripeStorage';
import { stripeService } from '../stripeService';
import { getUncachableStripeClient } from '../stripeClient';
import { requireAuth, requireAdmin } from '../middlewares/auth';
import { getSeatUsage } from '../seatService';
import { appBaseUrl } from '../lib/appUrl';

const priceIdBody = z.object({ priceId: z.string().min(1).max(200) });

const router: IRouter = Router();

/** Returns true when the Stripe error indicates the customer ID is stale/invalid. */
function isNoSuchCustomer(err: any): boolean {
  return (
    err?.code === 'resource_missing' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('no such customer'))
  );
}

router.get('/stripe/products', async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });

    const result = await Promise.all(
      products.data.map(async (product) => {
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/checkout', requireAuth, async (req: any, res): Promise<void> => {
  try {
    const parsed = priceIdBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'priceId is required' }); return; }
    const { priceId } = parsed.data;

    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const baseUrl = appBaseUrl();
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    const newSeatsMeta = newProduct?.metadata?.seats;
    let newSeats: number | null = null;
    let newUnlimited = false;
    if (newSeatsMeta === 'unlimited' || !newSeatsMeta) newUnlimited = true;
    else {
      const n = parseInt(String(newSeatsMeta), 10);
      if (!isNaN(n) && n > 0) newSeats = n;
      else newUnlimited = true;
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

    const updated = await stripe.subscriptions.update(usage.subscriptionId, {
      items: [{ id: usage.subscriptionItemId, price: priceId }],
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
    res.status(500).json({ error: err.message });
  }
});

/**
 * Returns the price info for the "Additional Seat" addon product.
 * The admin must create a product in Stripe with metadata.addon = "seat".
 * Returns 404 if not configured.
 */
router.get('/stripe/addon-price', requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true });
    const addonProduct = products.data.find((p) => p.metadata?.addon === 'seat');
    if (!addonProduct) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED' });
      return;
    }
    const prices = await stripe.prices.list({ product: addonProduct.id, active: true });
    const price = prices.data.find((p) => p.recurring?.interval === 'month') ?? prices.data[0];
    if (!price) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED' });
      return;
    }
    res.json({ priceId: price.id, unitAmount: price.unit_amount, currency: price.currency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Add or remove addon seats on the active subscription.
 * Body: { quantity: number } — total desired addon seat count (not delta).
 * quantity === 0 removes the addon item from the subscription.
 */
router.post('/stripe/add-seats', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const parsed = z.object({ quantity: z.number().int().min(0).max(500) }).safeParse(req.body);
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

    // Find the addon price
    const products = await stripe.products.list({ active: true });
    const addonProduct = products.data.find((p) => p.metadata?.addon === 'seat');
    if (!addonProduct) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED', message: 'Prodotto addon non configurato su Stripe.' });
      return;
    }
    const prices = await stripe.prices.list({ product: addonProduct.id, active: true });
    const addonPrice = prices.data.find((p) => p.recurring?.interval === 'month') ?? prices.data[0];
    if (!addonPrice) {
      res.status(404).json({ error: 'ADDON_NOT_CONFIGURED', message: 'Prezzo addon non trovato.' });
      return;
    }

    // Retrieve the subscription to find any existing addon item
    const sub = await stripe.subscriptions.retrieve(usage.subscriptionId, {
      expand: ['items.data.price'],
    });
    const existingAddonItem = sub.items.data.find((item) => item.price.id === addonPrice.id);

    if (quantity === 0) {
      if (existingAddonItem) {
        await stripe.subscriptionItems.del(existingAddonItem.id, {
          proration_behavior: 'create_prorations',
        });
      }
    } else if (existingAddonItem) {
      await stripe.subscriptionItems.update(existingAddonItem.id, {
        quantity,
        proration_behavior: 'create_prorations',
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: usage.subscriptionId,
        price: addonPrice.id,
        quantity,
        proration_behavior: 'create_prorations',
      });
    }

    const updated = await getSeatUsage(req.currentUser.organizationId ?? null);
    res.json({ addonSeats: updated.addonSeats, available: updated.available, limitReached: updated.limitReached });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/portal', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'Nessun cliente Stripe trovato per questo utente' });
      return;
    }

    const baseUrl = appBaseUrl();
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
