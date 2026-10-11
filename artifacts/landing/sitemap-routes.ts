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
  "/it": { exclude: true },
  "/en": { exclude: true },
  "/": {
    changefreq: "monthly",
    priority: 1.0,
    urls: {
      it: `${SITEMAP_BASE_URL}/it/`,
      en: `${SITEMAP_BASE_URL}/en/`,
    },
    hreflang: [
      { lang: "it", href: `${SITEMAP_BASE_URL}/it/` },
      { lang: "en", href: `${SITEMAP_BASE_URL}/en/` },
    ],
  },
  // Legal/compliance pages are noindex — exclude from sitemap to avoid
  // contradictory crawl signals. Content is Italian-only so EN alternates
  // would be false language targeting.
  "/terms": { exclude: true },
  "/privacy-policy": { exclude: true },
  "/cookie-policy": { exclude: true },
  "/dpa": { exclude: true },
};

const professionSitemapEntries: Record<string, SitemapRouteMeta> = {
  "/commercialista": {
    changefreq: "monthly",
    priority: 0.8,
    urls: {
      it: `${SITEMAP_BASE_URL}/it/commercialista`,
      en: `${SITEMAP_BASE_URL}/en/accountant`,
    },
  },
  "/accountant": { exclude: true },
  "/avvocato": {
    changefreq: "monthly",
    priority: 0.8,
    urls: {
      it: `${SITEMAP_BASE_URL}/it/avvocato`,
      en: `${SITEMAP_BASE_URL}/en/lawyer`,
    },
  },
  "/lawyer": { exclude: true },
  "/consulente-del-lavoro": {
    changefreq: "monthly",
    priority: 0.8,
    urls: {
      it: `${SITEMAP_BASE_URL}/it/consulente-del-lavoro`,
      en: `${SITEMAP_BASE_URL}/en/employment-consultant`,
    },
  },
  "/employment-consultant": { exclude: true },
};

Object.assign(SITEMAP_ROUTE_META, professionSitemapEntries);
