import { getStripeSync } from './stripeClient';
import { processReferralInvoicePaid } from './referralService';
import type Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    // StripeSync validates the signature and processes the event. Only parse the
    // same raw payload for our additional handler after that call succeeds.
    await sync.processWebhook(payload, signature);
    const verifiedEvent = JSON.parse(payload.toString('utf8')) as Stripe.Event;
    if (verifiedEvent.type === 'invoice.paid') {
      await processReferralInvoicePaid(verifiedEvent.data.object as Stripe.Invoice);
    }
  }
}
