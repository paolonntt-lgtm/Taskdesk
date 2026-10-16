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
    const accountId = await sync.getAccountId();
    const secretResult = await sync.postgresClient.query(
      'SELECT secret FROM "stripe"."_managed_webhooks" WHERE account_id = $1 LIMIT 1',
      [accountId],
    );
    const secret = secretResult.rows[0]?.secret;
    if (!secret) throw new Error('Managed Stripe webhook secret is missing');
    const event = await sync.stripe.webhooks.constructEventAsync(payload, signature, secret);
    await sync.processEvent(event);
    if (event.type === 'invoice.paid') {
      await processReferralInvoicePaid(event.data.object as Stripe.Invoice);
    }
  }
}
