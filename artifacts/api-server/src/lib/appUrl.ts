export function appBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")
    .map((d) => d.trim())
    .filter(Boolean) ?? [];
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:80";
}

const MICROSOFT_ONEDRIVE_CALLBACK_PATH = "/api/onedrive/callback";

export function microsoftOneDriveCallbackUri(): string {
  const configuredUri = process.env.MICROSOFT_ONEDRIVE_REDIRECT_URI?.trim();
  if (!configuredUri) {
    throw new Error(
      "Microsoft OneDrive OAuth requires MICROSOFT_ONEDRIVE_REDIRECT_URI to be set to the exact registered callback URI.",
    );
  }

  let callback: URL;
  try {
    callback = new URL(configuredUri);
  } catch {
    throw new Error(
      `MICROSOFT_ONEDRIVE_REDIRECT_URI must be an absolute HTTPS URL ending in ${MICROSOFT_ONEDRIVE_CALLBACK_PATH}.`,
    );
  }

  if (
    callback.protocol !== "https:" ||
    callback.username ||
    callback.password ||
    callback.pathname !== MICROSOFT_ONEDRIVE_CALLBACK_PATH ||
    callback.search ||
    callback.hash ||
    callback.href !== configuredUri
  ) {
    throw new Error(
      `MICROSOFT_ONEDRIVE_REDIRECT_URI must be the exact registered HTTPS URI with path ${MICROSOFT_ONEDRIVE_CALLBACK_PATH}, without credentials, query, or fragment.`,
    );
  }

  return configuredUri;
}

export function microsoftOneDriveCallbackOrigin(): string {
  return new URL(microsoftOneDriveCallbackUri()).origin;
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
