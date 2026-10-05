export function appBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")
    .map((d) => d.trim())
    .filter(Boolean) ?? [];
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:80";
}

const KNOWN_APP_HOSTS = new Set([
  "taskdesk.it",
  "www.taskdesk.it",
  "www.taskdesk.uk",
  "taskdesk.replit.app",
]);

/**
 * Build return URLs on the same verified host that served the current request.
 * This keeps host-scoped session cookies available after external checkouts.
 */
function allowedAppHosts(): Set<string> {
  const allowedHosts = new Set(KNOWN_APP_HOSTS);
  for (const domain of process.env.REPLIT_DOMAINS?.split(",") ?? []) {
    const configuredHost = domain.trim().toLowerCase();
    if (configuredHost) allowedHosts.add(configuredHost);
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim().toLowerCase();
  if (devDomain) allowedHosts.add(devDomain);
  return allowedHosts;
}

export function appBaseUrlForRequest(originHeader?: string, hostHeader?: string): string {
  const allowedHosts = allowedAppHosts();

  if (originHeader) {
    try {
      const origin = new URL(originHeader);
      if (
        origin.origin === originHeader &&
        origin.protocol === "https:" &&
        allowedHosts.has(origin.hostname.toLowerCase())
      ) {
        return origin.origin;
      }
    } catch {
      // Ignore malformed or untrusted Origin headers and check the host instead.
    }
  }

  const match = hostHeader?.trim().match(/^([a-z0-9.-]+)(?::\d+)?$/i);
  const hostname = match?.[1].toLowerCase();
  return hostname && allowedHosts.has(hostname) ? `https://${hostname}` : appBaseUrl();
}
