import { getUncachableStripeClient } from './stripeClient';

interface CatalogItem {
  key: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Array<{
    interval: 'month' | 'year';
    amount: number;
    nickname: string;
  }>;
}

const catalog: CatalogItem[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Piano TaskDesk Starter — fino a 5 utenti.',
    metadata: { taskdesk_plan: 'starter', seats: '5' },
    prices: [
      { interval: 'month', amount: 3500, nickname: 'Starter mensile' },
      { interval: 'year', amount: 35000, nickname: 'Starter annuale' },
    ],
  },
  {
    key: 'team',
    name: 'Team',
    description: 'Piano TaskDesk Team — fino a 10 utenti.',
    metadata: { taskdesk_plan: 'team', seats: '10' },
    prices: [
      { interval: 'month', amount: 6000, nickname: 'Team mensile' },
      { interval: 'year', amount: 60000, nickname: 'Team annuale' },
    ],
  },
  {
    key: 'business',
    name: 'Business',
    description: 'Piano TaskDesk Business — fino a 20 utenti.',
    metadata: { taskdesk_plan: 'business', seats: '20' },
    prices: [
      { interval: 'month', amount: 10000, nickname: 'Business mensile' },
      { interval: 'year', amount: 100000, nickname: 'Business annuale' },
    ],
  },
  {
    key: 'seat-addon',
    name: 'Collaboratore aggiuntivo',
    description: 'Un posto aggiuntivo TaskDesk, fatturato mensilmente.',
    metadata: { addon: 'seat' },
    prices: [
      { interval: 'month', amount: 600, nickname: 'Collaboratore aggiuntivo mensile' },
    ],
  },
];

async function ensureDefaultPortalConfiguration(stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>) {
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const activeDefaults = configurations.data.filter(
    (configuration) => configuration.active && configuration.is_default
  );

  if (activeDefaults.length > 1) {
    throw new Error('Stripe returned multiple active default customer portal configurations. Review the account manually.');
  }
  if (activeDefaults.length === 1) {
    const config = activeDefaults[0];
    const features = config.features;
    const matches =
      features.invoice_history.enabled &&
      features.payment_method_update.enabled &&
      features.subscription_cancel.enabled &&
      features.subscription_cancel.mode === 'at_period_end' &&
      features.subscription_cancel.proration_behavior === 'none' &&
      !features.subscription_update.enabled;
    if (!matches) {
      throw new Error('The default customer portal configuration differs from TaskDesk billing behavior. Review it manually; it was not changed.');
    }
    console.log('Verified the existing default customer portal configuration.');
    return;
  }

  const activeConfigurations = configurations.data.filter((configuration) => configuration.active);
  if (activeConfigurations.length > 0) {
    throw new Error('An active non-default customer portal configuration exists. Review it manually; no configuration was changed.');
  }

  const config = await stripe.billingPortal.configurations.create({
    name: 'TaskDesk subscription management',
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
        cancellation_reason: { enabled: false, options: ['too_expensive', 'other'] },
      },
      // Plan changes stay in TaskDesk, where seat limits are checked.
      subscription_update: {
        enabled: false,
        default_allowed_updates: [],
        proration_behavior: 'none',
        schedule_at_period_end: { conditions: [] },
        trial_update_behavior: 'continue_trial',
      },
    },
  });

  if (!config.active || !config.is_default) {
    throw new Error('Stripe created a portal configuration, but it is not active and default. Review the Stripe Dashboard before use.');
  }
  console.log('Created and verified the default customer portal configuration.');
}

async function seedStripeCatalog() {
  const stripe = await getUncachableStripeClient();
  await ensureDefaultPortalConfiguration(stripe);
  const productList = await stripe.products.list({ active: true, limit: 100 });

  for (const item of catalog) {
    const matches = productList.data.filter((product) =>
      item.key === 'seat-addon'
        ? product.metadata.addon === 'seat'
        : product.metadata.taskdesk_plan === item.key
    );
    if (matches.length > 1) {
      throw new Error(`Multiple active Stripe products match TaskDesk catalog item "${item.key}". Review them before seeding.`);
    }

    let product = matches[0];
    if (product) {
      const metadataMatches = Object.entries(item.metadata).every(
        ([key, value]) => product!.metadata[key] === value
      );
      if (!metadataMatches || product.name !== item.name) {
        throw new Error(`The existing Stripe product for "${item.key}" has conflicting name or metadata. Review it manually; no changes were made.`);
      }
    } else {
      product = await stripe.products.create(
        {
          name: item.name,
          description: item.description,
          metadata: item.metadata,
        },
        { idempotencyKey: `taskdesk-catalog-product-${item.key}-v1` }
      );
      console.log(`Created catalog product: ${item.name}`);
    }

    const priceList = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    for (const desired of item.prices) {
      const sameInterval = priceList.data.filter(
        (price) => price.recurring?.interval === desired.interval
      );
      const matchesPrice = sameInterval.filter(
        (price) => price.currency === 'eur' && price.unit_amount === desired.amount
      );
      if (matchesPrice.length > 1 || (sameInterval.length > 0 && matchesPrice.length !== sameInterval.length)) {
        throw new Error(`Conflicting active ${desired.interval} price on "${item.key}". Review Stripe manually; no price was changed.`);
      }
      if (matchesPrice.length === 1) {
        console.log(`Verified ${item.name}: EUR ${(desired.amount / 100).toFixed(2)}/${desired.interval}`);
        continue;
      }

      await stripe.prices.create(
        {
          product: product.id,
          unit_amount: desired.amount,
          currency: 'eur',
          recurring: { interval: desired.interval },
          nickname: desired.nickname,
        },
        { idempotencyKey: `taskdesk-catalog-price-${item.key}-${desired.interval}-v1` }
      );
      console.log(`Created ${item.name}: EUR ${(desired.amount / 100).toFixed(2)}/${desired.interval}`);
    }
  }

  console.log('TaskDesk Stripe catalog verified. No Enterprise price or trial was created.');
}

seedStripeCatalog().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected Stripe catalog error.';
  console.error('Stripe catalog setup stopped:', message);
  process.exit(1);
});