import { stripeStorage } from './stripeStorage';
import { getUncachableStripeClient } from './stripeClient';

interface BillingInfo {
  ragioneSociale?: string | null;
  piva?: string | null;
  codiceFiscale?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  paese?: string | null;
  sdiCode?: string | null;
  pec?: string | null;
}

export class StripeService {
  async createCustomer(email: string, userId: number) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId: String(userId) },
    });
  }

  async updateCustomerBilling(customerId: string, billing: BillingInfo) {
    const stripe = await getUncachableStripeClient();
    await stripe.customers.update(customerId, {
      name: billing.ragioneSociale ?? undefined,
      address: {
        line1: billing.indirizzo ?? '',
        postal_code: billing.cap ?? '',
        city: billing.citta ?? '',
        state: billing.provincia ?? '',
        country: billing.paese ?? 'IT',
      },
      metadata: {
        piva: billing.piva ?? '',
        codice_fiscale: billing.codiceFiscale ?? '',
        sdi_code: billing.sdiCode ?? '',
        pec: billing.pec ?? '',
      },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }
}

export const stripeService = new StripeService();
