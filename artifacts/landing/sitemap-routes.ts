export interface SitemapRouteMeta {
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  hreflang?: { lang: string; href: string }[];
  /** Set to true to explicitly exclude a discovered route from the sitemap. */
  exclude?: boolean;
}

export const SITEMAP_BASE_URL = "https://taskdesk.it";

/**
 * Optional metadata for specific routes.
 * Routes are discovered automatically by scanning App.tsx — you do NOT need
 * to add an entry here when adding a new page.  Only add an entry here if
 * you want to customise changefreq / priority / hreflang, or exclude a route.
 *
 * Routes with dynamic segments (containing ":" or "*") are automatically
 * excluded from the sitemap regardless of this config.
 */
export const SITEMAP_ROUTE_META: Record<string, SitemapRouteMeta> = {
  "/": {
    changefreq: "monthly",
    priority: 1.0,
    hreflang: [
      { lang: "it", href: `${SITEMAP_BASE_URL}/` },
      { lang: "en", href: `${SITEMAP_BASE_URL}/` },
    ],
  },
  "/terms":          { changefreq: "yearly", priority: 0.3 },
  "/privacy-policy": { changefreq: "yearly", priority: 0.3 },
  "/cookie-policy":  { changefreq: "yearly", priority: 0.2 },
  "/dpa":            { changefreq: "yearly", priority: 0.2 },
};
