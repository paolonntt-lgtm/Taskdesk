import { Router, type IRouter } from 'express';
import { stripeStorage } from '../stripeStorage';
import { stripeService } from '../stripeService';
import { requireAuth } from '../middlewares/auth';

const router: IRouter = Router();

router.get('/stripe/products', async (_req, res) => {
  try {
    const products = await stripeStorage.listProductsWithPrices();
    res.json({ data: products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stripe/subscription', requireAuth, async (req: any, res) => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeSubscriptionId) {
      return res.json({ subscription: null });
    }
    const subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
    res.json({ subscription });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/checkout', requireAuth, async (req: any, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId is required' });

    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, user.id);
      await stripeStorage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/billing/success`,
      `${baseUrl}/billing`
    );

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stripe/portal', requireAuth, async (req: any, res) => {
  try {
    const user = await stripeStorage.getUser(req.currentUser.id);
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this user' });
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
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
