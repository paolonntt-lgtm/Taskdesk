import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUncachableStripeClient: vi.fn(),
  getSeatUsage: vi.fn(),
  getUser: vi.fn(),
  updateUserStripeInfo: vi.fn(),
  createCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
}));

vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: mocks.getUncachableStripeClient,
  isStripeNotConfiguredError: () => false,
}));

vi.mock('../seatService', () => ({
  getSeatUsage: mocks.getSeatUsage,
}));

vi.mock('../stripeStorage', () => ({
  stripeStorage: {
    getUser: mocks.getUser,
    updateUserStripeInfo: mocks.updateUserStripeInfo,
  },
}));

vi.mock('../stripeService', () => ({
  stripeService: {
    createCustomer: mocks.createCustomer,
    createCheckoutSession: mocks.createCheckoutSession,
    createCustomerPortalSession: mocks.createCustomerPortalSession,
  },
}));

vi.mock('../middlewares/auth', () => {
  const attachTestAdmin = (req: any, _res: any, next: any) => {
    req.currentUser = { id: 50, organizationId: 20, role: 'admin', isSuperAdmin: false };
    next();
  };
  return {
    requireAuth: attachTestAdmin,
    requireAdmin: (_req: any, _res: any, next: any) => next(),
  };
});

import stripeRouter from './stripe';

describe('Stripe billing routes', () => {
  let server: Server;
  let baseUrl: string;
  let stripe: {
    prices: { retrieve: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
    products: { list: ReturnType<typeof vi.fn> };
    subscriptions: { update: ReturnType<typeof vi.fn>; retrieve: ReturnType<typeof vi.fn> };
    subscriptionItems: {
      del: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    stripe = {
      prices: { retrieve: vi.fn(), list: vi.fn() },
      products: { list: vi.fn() },
      subscriptions: { update: vi.fn(), retrieve: vi.fn() },
      subscriptionItems: { del: vi.fn(), update: vi.fn(), create: vi.fn() },
    };
    mocks.getUncachableStripeClient.mockResolvedValue(stripe);
    mocks.getUser.mockResolvedValue({
      id: 50,
      email: 'billing-test@example.invalid',
      stripeCustomerId: 'cus_taskdesk_test',
    });

    const app = express();
    app.use(express.json());
    app.use('/api', stripeRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function post(path: string, body: unknown) {
    return fetch(`${baseUrl}/api/stripe/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('starts Checkout for an active EUR plan without adding a Stripe trial', async () => {
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'month' },
      product: { metadata: { taskdesk_plan: 'starter', seats: '5' } },
    });
    mocks.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });

    const response = await post('checkout', { priceId: 'price_starter_month' });

    expect(response.status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckoutSession.mock.calls[0]).toHaveLength(4);
    expect(mocks.createCheckoutSession.mock.calls[0][1]).toBe('price_starter_month');
    expect(mocks.createCheckoutSession.mock.calls[0][2]).toContain('/app/billing?success=1');
    expect(mocks.createCheckoutSession.mock.calls[0][3]).toContain('/app/billing');
  });

  it('rejects an add-on price as a new subscription plan', async () => {
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'month' },
      product: { metadata: { addon: 'seat' } },
    });

    const response = await post('checkout', { priceId: 'price_addon_month' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'INVALID_PLAN_PRICE' });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('blocks a plan downgrade below the organization’s active user count', async () => {
    mocks.getSeatUsage.mockResolvedValue({
      subscriptionId: 'sub_taskdesk_test',
      subscriptionItemId: 'si_starter',
      currentPriceId: 'price_team_month',
      usedSeats: 8,
      planSeats: 10,
      unlimited: false,
    });
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'month' },
      product: { metadata: { taskdesk_plan: 'starter', seats: '5' }, name: 'Starter' },
    });

    const response = await post('upgrade', { priceId: 'price_starter_month' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'CANNOT_DOWNGRADE_BELOW_USAGE' });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('enforces the Starter add-on cap before changing Stripe', async () => {
    mocks.getSeatUsage.mockResolvedValue({
      subscriptionId: 'sub_taskdesk_test',
      planSeats: 5,
      usedSeats: 5,
      unlimited: false,
    });

    const response = await post('add-seats', { quantity: 5 });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'ADDON_LIMIT_EXCEEDED' });
    expect(stripe.products.list).not.toHaveBeenCalled();
  });

  it('adds allowed seat add-ons to the active subscription', async () => {
    mocks.getSeatUsage
      .mockResolvedValueOnce({
        subscriptionId: 'sub_taskdesk_test',
        planSeats: 5,
        usedSeats: 5,
        unlimited: false,
      })
      .mockResolvedValueOnce({
        addonSeats: 2,
        available: 2,
        limitReached: false,
      });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [{
        id: 'price_seat_addon',
        unit_amount: 600,
        currency: 'eur',
        recurring: { interval: 'month' },
      }],
    });
    stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });
    stripe.subscriptionItems.create.mockResolvedValue({ quantity: 2 });

    const response = await post('add-seats', { quantity: 2 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ addonSeats: 2, available: 2, limitReached: false });
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith({
      subscription: 'sub_taskdesk_test',
      price: 'price_seat_addon',
      quantity: 2,
      proration_behavior: 'create_prorations',
    });
  });
});