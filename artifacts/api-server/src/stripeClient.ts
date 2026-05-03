import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

async function fetchConnectionSettings(
  hostname: string,
  token: string,
  environment: 'production' | 'development',
): Promise<{ secret: string; publishable: string } | null> {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', environment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': token,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;

  const data = await response.json() as { items?: Array<{ settings?: { secret?: string; publishable?: string } }> };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret || !settings?.publishable) return null;

  return { secret: settings.secret, publishable: settings.publishable };
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error('Missing Replit environment variables. Ensure the Stripe integration is connected.');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';

  // Try the preferred environment first, then fall back to the other
  const preferred: Array<'production' | 'development'> = isProduction
    ? ['production', 'development']
    : ['development', 'production'];

  for (const env of preferred) {
    const settings = await fetchConnectionSettings(hostname, xReplitToken, env);
    if (settings) {
      return { publishableKey: settings.publishable, secretKey: settings.secret };
    }
  }

  throw new Error('Stripe connection not found. Connect Stripe via the Integrations tab.');
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const { secretKey } = await getCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: '',
  });
}
