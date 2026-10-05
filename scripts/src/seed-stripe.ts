import { getUncachableStripeClient } from './stripeClient';

interface CatalogItem {
  key: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  taxCode?: string;
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
    description: 'Un posto aggiuntivo TaskDesk, fatturato con la stessa cadenza del piano.',
    metadata: { addon: 'seat' },
    taxCode: 'txcd_10103001',
    prices: [
      { interval: 'month', amount: 600, nickname: 'Collaboratore aggiuntivo mensile' },
      { interval: 'year', amount: 6000, nickname: 'Collaboratore aggiuntivo annuale' },
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
  const seatAddonOnly = process.env.STRIPE_SEED_SEAT_ADDON_ONLY === '1';
  const activateSeatAddon = process.env.STRIPE_ACTIVATE_SEAT_ADDON === '1';
  if (activateSeatAddon && !seatAddonOnly) {
    throw new Error('Activate the additional-collaborator product only with STRIPE_SEED_SEAT_ADDON_ONLY=1.');
  }
  if (!seatAddonOnly) {
    await ensureDefaultPortalConfiguration(stripe);
  }
  const [activeProductList, inactiveProductList] = await Promise.all([
    stripe.products.list({ active: true, limit: 100 }),
    stripe.products.list({ active: false, limit: 100 }),
  ]);
  const allProducts = [...activeProductList.data, ...inactiveProductList.data];
  let seatAddonActive: boolean | null = null;
  let seatAddonProductId: string | null = null;

  const catalogItems = seatAddonOnly ? catalog.filter((item) => item.key === 'seat-addon') : catalog;
  for (const item of catalogItems) {
    const matches = (item.key === 'seat-addon' ? allProducts : activeProductList.data).filter((product) =>
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
          ...(item.taxCode ? { tax_code: item.taxCode } : {}),
        },
        { idempotencyKey: `taskdesk-catalog-product-${item.key}-v1` }
      );
      if (item.key === 'seat-addon') {
        product = await stripe.products.update(product.id, { active: false });
      }
      console.log(`Created catalog product: ${item.name}`);
    }

    if (item.taxCode) {
      const currentTaxCode =
        typeof product.tax_code === 'string' ? product.tax_code : product.tax_code?.id;
      if (currentTaxCode !== item.taxCode) {
        if (product.active) {
          throw new Error(`The active product for "${item.key}" has a different tax code. Review Stripe manually; no changes were made.`);
        }
        product = await stripe.products.update(product.id, { tax_code: item.taxCode });
      }
    }
    if (item.key === 'seat-addon') {
      seatAddonActive = product.active;
      seatAddonProductId = product.id;
    }

    const [activePriceList, inactivePriceList] = await Promise.all([
      stripe.prices.list({ product: product.id, active: true, limit: 100 }),
      stripe.prices.list({ product: product.id, active: false, limit: 100 }),
    ]);
    const priceList = [...activePriceList.data, ...inactivePriceList.data];
    for (const desired of item.prices) {
      const sameInterval = priceList.filter(
        (price) => price.recurring?.interval === desired.interval
      );
      const matchesPrice = sameInterval.filter(
        (price) =>
          price.currency === 'eur' &&
          price.unit_amount === desired.amount &&
          price.tax_behavior === 'exclusive'
      );
      if (matchesPrice.length > 1 || (sameInterval.length > 0 && matchesPrice.length !== sameInterval.length)) {
        throw new Error(`Conflicting ${desired.interval} price on "${item.key}". Review Stripe manually; no price was changed.`);
      }
      if (matchesPrice.length === 1) {
        if (!matchesPrice[0].active) {
          throw new Error(`The matching ${desired.interval} price on "${item.key}" is inactive. Review Stripe manually before use.`);
        }
        console.log(`Verified ${item.name}: EUR ${(desired.amount / 100).toFixed(2)}/${desired.interval}`);
        continue;
      }
      if (item.key === 'seat-addon' && product.active) {
        throw new Error('The additional-collaborator product is already active but is missing a matching price. Publish the updated app before changing its live catalog.');
      }

      const createdPrice = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: desired.amount,
          currency: 'eur',
          recurring: { interval: desired.interval },
          nickname: desired.nickname,
          tax_behavior: 'exclusive',
        },
        { idempotencyKey: `taskdesk-catalog-price-${item.key}-${desired.interval}-v1` }
      );
      if (
        !createdPrice.active ||
        createdPrice.tax_behavior !== 'exclusive' ||
        createdPrice.unit_amount !== desired.amount ||
        createdPrice.recurring?.interval !== desired.interval
      ) {
        throw new Error(`Stripe returned an unexpected ${desired.interval} price for "${item.key}". Review the catalog before use.`);
      }
      console.log(`Created ${item.name}: EUR ${(desired.amount / 100).toFixed(2)}/${desired.interval}`);
    }
  }

  if (activateSeatAddon) {
    if (seatAddonProductId === null || seatAddonActive === null) {
      throw new Error('The additional-collaborator product was not found; nothing was activated.');
    }
    if (!seatAddonActive) {
      const activatedProduct = await stripe.products.update(seatAddonProductId, { active: true });
      if (!activatedProduct.active) {
        throw new Error('Stripe did not activate the additional-collaborator product. Review the Live catalog.');
      }
      seatAddonActive = true;
      console.log('Activated the additional-collaborator product after verifying both recurring prices.');
    }
  }

  const seatAddonStatus = seatAddonActive === false
    ? 'inactive until the updated app is published'
    : seatAddonActive
      ? 'active'
      : 'not part of this run';
  console.log(`TaskDesk Stripe catalog verified. Additional-collaborator product: ${seatAddonStatus}.`);
}

seedStripeCatalog().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected Stripe catalog error.';
  console.error('Stripe catalog setup stopped:', message);
  process.exit(1);
});