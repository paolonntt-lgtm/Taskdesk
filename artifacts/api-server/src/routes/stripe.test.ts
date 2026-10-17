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
  getReferralApplicationStatus: vi.fn(),
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

vi.mock('../referralService', () => ({
  getReferralOverview: vi.fn(),
  getReferralPlan: vi.fn(),
  getOrCreateReferralCode: vi.fn(),
  getReferralApplicationStatus: mocks.getReferralApplicationStatus,
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
    products: { list: ReturnType<typeof vi.fn>; retrieve: ReturnType<typeof vi.fn> };
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
      products: { list: vi.fn(), retrieve: vi.fn() },
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
      headers: { 'content-type': 'application/json', origin: 'https://www.taskdesk.it' },
      body: JSON.stringify(body),
    });
  }

  async function get(path: string) {
    return fetch(`${baseUrl}/api/stripe/${path}`, {
      headers: { origin: 'https://www.taskdesk.it' },
    });
  }

  it('starts Checkout for an active EUR plan without adding a Stripe trial', async () => {
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'month' },
      product: { active: true, metadata: { taskdesk_plan: 'starter', seats: '5' } },
    });
    mocks.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });

    const response = await post('checkout', { priceId: 'price_starter_month' });

    expect(response.status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckoutSession.mock.calls[0]).toHaveLength(4);
    expect(mocks.createCheckoutSession.mock.calls[0][1]).toBe('price_starter_month');
    expect(mocks.createCheckoutSession.mock.calls[0][2]).toBe('https://www.taskdesk.it/app/billing?success=1');
    expect(mocks.createCheckoutSession.mock.calls[0][3]).toBe('https://www.taskdesk.it/app/billing');
  });

  it('returns the billing portal to the same verified host', async () => {
    mocks.createCustomerPortalSession.mockResolvedValue({ url: 'https://billing.stripe.test/session' });

    const response = await post('portal', {});

    expect(response.status).toBe(200);
    expect(mocks.createCustomerPortalSession).toHaveBeenCalledWith(
      'cus_taskdesk_test',
      'https://www.taskdesk.it/app/billing',
    );
  });

  it('returns only the signed-in organization’s persisted referral status', async () => {
    mocks.getReferralApplicationStatus.mockResolvedValue({ applied: false, attempted: true });

    const response = await get('referrals/status');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ applied: false, attempted: true });
    expect(mocks.getReferralApplicationStatus).toHaveBeenCalledWith(20);
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

  it('rejects a price whose plan product is inactive', async () => {
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'month' },
      product: { active: false, metadata: { taskdesk_plan: 'starter', seats: '5' } },
    });

    const response = await post('checkout', { priceId: 'price_staged_month' });

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
      product: { active: true, metadata: { taskdesk_plan: 'starter', seats: '5' }, name: 'Starter' },
    });

    const response = await post('upgrade', { priceId: 'price_starter_month' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'CANNOT_DOWNGRADE_BELOW_USAGE' });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('switches existing add-ons to the annual cadence when changing the base plan', async () => {
    mocks.getSeatUsage.mockResolvedValue({
      subscriptionId: 'sub_taskdesk_test',
      subscriptionItemId: 'si_base_plan',
      currentPriceId: 'price_starter_month',
      usedSeats: 5,
      planSeats: 5,
      unlimited: false,
    });
    stripe.prices.retrieve.mockResolvedValue({
      active: true,
      currency: 'eur',
      recurring: { interval: 'year' },
      product: { active: true, metadata: { taskdesk_plan: 'team', seats: '10' }, name: 'Team' },
    });
    stripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [
          { id: 'si_base_plan', quantity: 1, price: { id: 'price_starter_month', product: 'prod_starter' } },
          { id: 'si_seat_addon', quantity: 2, price: { id: 'price_seat_month', product: 'prod_seat_addon' } },
        ],
      },
    });
    stripe.products.retrieve.mockResolvedValue({ metadata: { addon: 'seat' } });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [{
        id: 'price_seat_year',
        active: true,
        unit_amount: 6000,
        currency: 'eur',
        recurring: { interval: 'year' },
      }],
    });
    stripe.subscriptions.update.mockResolvedValue({ id: 'sub_taskdesk_test', status: 'active' });

    const response = await post('upgrade', { priceId: 'price_team_year' });

    expect(response.status).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_taskdesk_test', {
      items: [
        { id: 'si_base_plan', price: 'price_team_year', quantity: 1 },
        { id: 'si_seat_addon', price: 'price_seat_year', quantity: 2 },
      ],
      proration_behavior: 'create_prorations',
      payment_behavior: 'pending_if_incomplete',
    });
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

  it('returns the annual additional-seat price for an annual subscription', async () => {
    mocks.getSeatUsage.mockResolvedValue({
      subscriptionId: 'sub_taskdesk_test',
      currentPriceId: 'price_team_year',
    });
    stripe.prices.retrieve.mockResolvedValue({ recurring: { interval: 'year' } });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [
        { id: 'price_seat_month', active: true, unit_amount: 600, currency: 'eur', recurring: { interval: 'month' } },
        { id: 'price_seat_year', active: true, unit_amount: 6000, currency: 'eur', recurring: { interval: 'year' } },
      ],
    });

    const response = await get('addon-price');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      priceId: 'price_seat_year',
      unitAmount: 6000,
      currency: 'eur',
      interval: 'year',
    });
  });

  it('adds allowed seat add-ons to the active subscription', async () => {
    mocks.getSeatUsage
      .mockResolvedValueOnce({
        subscriptionId: 'sub_taskdesk_test',
        currentPriceId: 'price_starter_month',
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
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.retrieve.mockResolvedValue({ recurring: { interval: 'month' } });
    stripe.prices.list.mockResolvedValue({
      data: [
        { id: 'price_seat_addon_month', active: true, unit_amount: 600, currency: 'eur', recurring: { interval: 'month' } },
        { id: 'price_seat_addon_year', active: true, unit_amount: 6000, currency: 'eur', recurring: { interval: 'year' } },
      ],
    });
    stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });
    stripe.subscriptionItems.create.mockResolvedValue({ quantity: 2 });

    const response = await post('add-seats', { quantity: 2 });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ addonSeats: 2, available: 2, limitReached: false });
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith({
      subscription: 'sub_taskdesk_test',
      price: 'price_seat_addon_month',
      quantity: 2,
      proration_behavior: 'create_prorations',
    });
  });

  it('adds annual seats using the annual add-on price', async () => {
    mocks.getSeatUsage
      .mockResolvedValueOnce({
        subscriptionId: 'sub_taskdesk_test',
        currentPriceId: 'price_starter_year',
        planSeats: 5,
        usedSeats: 5,
        unlimited: false,
      })
      .mockResolvedValueOnce({ addonSeats: 1, available: 1, limitReached: false });
    stripe.prices.retrieve.mockResolvedValue({ recurring: { interval: 'year' } });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [
        { id: 'price_seat_addon_month', active: true, unit_amount: 600, currency: 'eur', recurring: { interval: 'month' } },
        { id: 'price_seat_addon_year', active: true, unit_amount: 6000, currency: 'eur', recurring: { interval: 'year' } },
      ],
    });
    stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });

    const response = await post('add-seats', { quantity: 1 });

    expect(response.status).toBe(200);
    expect(stripe.subscriptionItems.create).toHaveBeenCalledWith({
      subscription: 'sub_taskdesk_test',
      price: 'price_seat_addon_year',
      quantity: 1,
      proration_behavior: 'create_prorations',
    });
  });

  it('switches an existing monthly add-on item to annual billing without creating a duplicate', async () => {
    mocks.getSeatUsage
      .mockResolvedValueOnce({
        subscriptionId: 'sub_taskdesk_test',
        currentPriceId: 'price_starter_year',
        planSeats: 5,
        usedSeats: 5,
        unlimited: false,
      })
      .mockResolvedValueOnce({ addonSeats: 3, available: 3, limitReached: false });
    stripe.prices.retrieve.mockResolvedValue({ recurring: { interval: 'year' } });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [
        { id: 'price_seat_addon_month', active: true, unit_amount: 600, currency: 'eur', recurring: { interval: 'month' } },
        { id: 'price_seat_addon_year', active: true, unit_amount: 6000, currency: 'eur', recurring: { interval: 'year' } },
      ],
    });
    stripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [{
          id: 'si_seat_addon_month',
          quantity: 2,
          price: { id: 'price_seat_addon_month', product: 'prod_seat_addon' },
        }],
      },
    });

    const response = await post('add-seats', { quantity: 3 });

    expect(response.status).toBe(200);
    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith('si_seat_addon_month', {
      price: 'price_seat_addon_year',
      quantity: 3,
      proration_behavior: 'create_prorations',
    });
    expect(stripe.subscriptionItems.create).not.toHaveBeenCalled();
  });

  it('removes add-on subscription items when the desired quantity is zero', async () => {
    mocks.getSeatUsage
      .mockResolvedValueOnce({
        subscriptionId: 'sub_taskdesk_test',
        currentPriceId: 'price_starter_month',
        planSeats: 5,
        usedSeats: 5,
        unlimited: false,
      })
      .mockResolvedValueOnce({ addonSeats: 0, available: 0, limitReached: true });
    stripe.prices.retrieve.mockResolvedValue({ recurring: { interval: 'month' } });
    stripe.products.list.mockResolvedValue({
      data: [{ id: 'prod_seat_addon', active: true, metadata: { addon: 'seat' } }],
    });
    stripe.prices.list.mockResolvedValue({
      data: [{
        id: 'price_seat_addon_month',
        active: true,
        unit_amount: 600,
        currency: 'eur',
        recurring: { interval: 'month' },
      }],
    });
    stripe.subscriptions.retrieve.mockResolvedValue({
      items: {
        data: [{
          id: 'si_seat_addon',
          quantity: 2,
          price: { id: 'price_seat_addon_month', product: 'prod_seat_addon' },
        }],
      },
    });

    const response = await post('add-seats', { quantity: 0 });

    expect(response.status).toBe(200);
    expect(stripe.subscriptionItems.del).toHaveBeenCalledWith('si_seat_addon', {
      proration_behavior: 'create_prorations',
    });
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
  });
});