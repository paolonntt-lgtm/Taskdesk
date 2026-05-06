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
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    const sub = subscriptions.data[0] ?? null;
    res.json({ subscription: sub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stripe/seat-usage', requireAuth, async (req: any, res): Promise<void> => {
  try {
    const usage = await getSeatUsage(req.currentUser.id);
    res.json(usage);
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
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/app/billing?success=1`,
      `${baseUrl}/app/billing`
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/upgrade', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const parsed = priceIdBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'priceId is required' }); return; }
    const { priceId } = parsed.data;

    const usage = await getSeatUsage(req.currentUser.id);
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

router.post('/stripe/portal', requireAuth, requireAdmin, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'Nessun cliente Stripe trovato per questo utente' });
      return;
    }

    const baseUrl = appBaseUrl();
    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/app/billing`
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
