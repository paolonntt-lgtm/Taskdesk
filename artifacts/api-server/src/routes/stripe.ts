import { Router, type IRouter } from 'express';
import { stripeStorage } from '../stripeStorage';
import { stripeService } from '../stripeService';
import { getUncachableStripeClient } from '../stripeClient';
import { requireAuth } from '../middlewares/auth';

const router: IRouter = Router();

router.get('/stripe/products', async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });

    const result = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({ product: product.id, active: true });
        return {
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          active: product.active,
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

router.get('/stripe/subscription', requireAuth, async (req: any, res): Promise<void> => {
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

router.post('/stripe/checkout', requireAuth, async (req: any, res): Promise<void> => {
  try {
    const { priceId } = req.body;
    if (!priceId) { res.status(400).json({ error: 'priceId is required' }); return; }

    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const domains = process.env.REPLIT_DOMAINS?.split(',') ?? [];
    const baseUrl = domains[0] ? `https://${domains[0]}` : 'http://localhost:80';
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/billing?success=1`,
      `${baseUrl}/billing`
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/portal', requireAuth, async (req: any, res): Promise<void> => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'Nessun cliente Stripe trovato per questo utente' });
      return;
    }

    const domains = process.env.REPLIT_DOMAINS?.split(',') ?? [];
    const baseUrl = domains[0] ? `https://${domains[0]}` : 'http://localhost:80';
    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/billing`
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
