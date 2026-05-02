import { getUncachableStripeClient } from './stripeClient';

async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Checking for existing TaskDesk products...');

    const existing = await stripe.products.search({
      query: "name:'TaskDesk' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log('TaskDesk product already exists. Skipping creation.');
      const product = existing.data[0];
      console.log(`Product ID: ${product.id}`);

      const prices = await stripe.prices.list({ product: product.id, active: true });
      for (const price of prices.data) {
        const amount = ((price.unit_amount ?? 0) / 100).toFixed(2);
        const currency = price.currency.toUpperCase();
        const interval = price.recurring?.interval ?? 'one_time';
        console.log(`Price: ${currency} ${amount}/${interval} (${price.id})`);
      }
      return;
    }

    console.log('Creating TaskDesk product...');

    const product = await stripe.products.create({
      name: 'TaskDesk',
      description: 'Sistema di ticketing aziendale — €1 per utente attivo al mese. 7 giorni di prova gratuita.',
      metadata: {
        trialDays: '7',
      },
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 100,
      currency: 'eur',
      recurring: {
        interval: 'month',
      },
      nickname: 'Per utente/mese',
    });
    console.log(`Created price: EUR 1.00/mese (${monthlyPrice.id})`);

    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1000,
      currency: 'eur',
      recurring: {
        interval: 'year',
      },
      nickname: 'Per utente/anno (2 mesi gratis)',
    });
    console.log(`Created price: EUR 10.00/anno (${yearlyPrice.id})`);

    console.log('\nProdotti e prezzi creati con successo!');
    console.log('I webhook sincronizzeranno i dati nel database automaticamente.');
  } catch (error: any) {
    console.error('Errore durante la creazione dei prodotti:', error.message);
    process.exit(1);
  }
}

seedStripeProducts();
