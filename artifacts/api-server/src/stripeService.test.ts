import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUncachableStripeClient: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock('./stripeClient', () => ({
  getUncachableStripeClient: mocks.getUncachableStripeClient,
}));

import { StripeService } from './stripeService';

describe('StripeService checkout tax settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createCheckoutSession.mockResolvedValue({
      id: 'cs_taskdesk_test',
      url: 'https://checkout.stripe.test/session',
    });
    mocks.getUncachableStripeClient.mockResolvedValue({
      checkout: {
        sessions: {
          create: mocks.createCheckoutSession,
        },
      },
    });
  });

  it('collects the billing address and VAT ID and enables automatic tax', async () => {
    const service = new StripeService();

    await service.createCheckoutSession(
      'cus_taskdesk_test',
      'price_starter_month',
      'https://www.taskdesk.it/app/billing?success=1',
      'https://www.taskdesk.it/app/billing',
    );

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      customer: 'cus_taskdesk_test',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_starter_month', quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://www.taskdesk.it/app/billing?success=1',
      cancel_url: 'https://www.taskdesk.it/app/billing',
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
    });
  });
});
