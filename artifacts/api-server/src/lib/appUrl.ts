export function appBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")
    .map((d) => d.trim())
    .filter(Boolean) ?? [];
  if (domains.length > 0) return `https://${domains[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:80";
}
