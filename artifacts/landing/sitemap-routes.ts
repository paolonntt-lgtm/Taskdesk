export interface SitemapRouteMeta {
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  hreflang?: { lang: string; href: string }[];
  /**
   * Per-language URL overrides.
   * If a route has a dedicated Italian or English path, set them here.
   * When absent the shared base URL is used for both language sitemaps.
   */
  urls?: { it?: string; en?: string };
  /** Set to true to explicitly exclude a discovered route from the sitemap. */
  exclude?: boolean;
}

export const SITEMAP_BASE_URL = "https://taskdesk.it";

/**
 * Optional metadata for specific routes.
 * Routes are discovered automatically by scanning App.tsx — you do NOT need
 * to add an entry here when adding a new page.  Only add an entry here if
 * you want to customise changefreq / priority / hreflang / urls, or exclude
 * a route.
 *
 * Routes with dynamic segments (containing ":" or "*") are automatically
 * excluded from the sitemap regardless of this config.
 */
export const SITEMAP_ROUTE_META: Record<string, SitemapRouteMeta> = {
  "/": {
    changefreq: "monthly",
    priority: 1.0,
    urls: {
      it: `${SITEMAP_BASE_URL}/`,
      en: `${SITEMAP_BASE_URL}/`,
    },
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
