export interface SitemapRoute {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  hreflang?: { lang: string; href: string }[];
}

export const SITEMAP_BASE_URL = "https://taskdesk.it";

/**
 * Single source of truth for all public landing pages.
 * When you add a new page to App.tsx, add its entry here too —
 * the sitemap is regenerated automatically at every build.
 */
export const SITEMAP_ROUTES: SitemapRoute[] = [
  {
    path: "/",
    changefreq: "monthly",
    priority: 1.0,
    hreflang: [
      { lang: "it", href: `${SITEMAP_BASE_URL}/` },
      { lang: "en", href: `${SITEMAP_BASE_URL}/` },
    ],
  },
  { path: "/terms",          changefreq: "yearly", priority: 0.3 },
  { path: "/privacy-policy", changefreq: "yearly", priority: 0.3 },
  { path: "/cookie-policy",  changefreq: "yearly", priority: 0.2 },
  { path: "/dpa",            changefreq: "yearly", priority: 0.2 },
];
