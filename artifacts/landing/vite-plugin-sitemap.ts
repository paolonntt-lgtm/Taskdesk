import fs from "fs";
import type { Plugin } from "vite";
import type { SitemapRouteMeta } from "./sitemap-routes.js";

export interface SitemapPluginOptions {
  /** Absolute path to the file containing <Route path="..." /> declarations. */
  appRouterPath: string;
  /** Per-route metadata overrides (optional — new routes get sensible defaults). */
  routeMeta: Record<string, SitemapRouteMeta>;
  /** Base URL, e.g. "https://taskdesk.it" */
  baseUrl: string;
}

/**
 * Scan a file for wouter/react-router <Route path="…" /> declarations and
 * return a deduplicated list of static paths (dynamic segments containing
 * ":" or "*" are automatically excluded).
 */
function discoverRoutes(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const matches = [...content.matchAll(/<Route\s[^>]*path="([^"]+)"/g)];
  const paths = matches
    .map((m) => m[1])
    .filter((p) => !p.includes(":") && !p.includes("*"));
  return [...new Set(paths)];
}

/**
 * Resolve the canonical URL for a route in a given language.
 * Falls back to `baseUrl + path` when no language-specific override exists.
 */
function resolveUrl(
  path: string,
  meta: SitemapRouteMeta,
  baseUrl: string,
  lang: "it" | "en",
): string {
  return meta.urls?.[lang] ?? `${baseUrl}${path}`;
}

/**
 * Build a language-specific sitemap XML string.
 * Each <url> points to the language variant of that page and includes
 * xhtml:link hreflang alternates for both languages.
 */
function buildLanguageSitemapXml(
  routes: string[],
  routeMeta: Record<string, SitemapRouteMeta>,
  baseUrl: string,
  lang: "it" | "en",
): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const otherLang: "it" | "en" = lang === "it" ? "en" : "it";

  const urls = routes
    .filter((path) => !routeMeta[path]?.exclude)
    .map((path) => {
      const meta = routeMeta[path] ?? {};
      const loc = resolveUrl(path, meta, baseUrl, lang);
      const altSelf = resolveUrl(path, meta, baseUrl, lang);
      const altOther = resolveUrl(path, meta, baseUrl, otherLang);

      // x-default always points to the Italian version (the site's default locale),
      // regardless of which language sitemap is being generated.
      const xDefault = resolveUrl(path, meta, baseUrl, "it");

      const alts = [
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${altSelf}" />`,
        `    <xhtml:link rel="alternate" hreflang="${otherLang}" href="${altOther}" />`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}" />`,
      ].join("\n");

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${meta.changefreq ?? "monthly"}</changefreq>`,
        `    <priority>${(meta.priority ?? 0.5).toFixed(1)}</priority>`,
        alts,
        "  </url>",
      ].join("\n");
    })
    .join("\n\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    "",
    urls,
    "",
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * Build the sitemap index XML that references the two language sitemaps.
 */
function buildSitemapIndexXml(baseUrl: string): string {
  const lastmod = new Date().toISOString().slice(0, 10);

  const sitemaps = ["sitemap-it.xml", "sitemap-en.xml"]
    .map((name) =>
      [
        "  <sitemap>",
        `    <loc>${baseUrl}/${name}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        "  </sitemap>",
      ].join("\n"),
    )
    .join("\n\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "",
    sitemaps,
    "",
    "</sitemapindex>",
    "",
  ].join("\n");
}

/**
 * Vite plugin that generates per-language sitemaps and a sitemap index at
 * build time by:
 * 1. Scanning `appRouterPath` for <Route path="..." /> declarations.
 * 2. Merging discovered paths with optional metadata from `routeMeta`.
 * 3. Emitting sitemap-it.xml, sitemap-en.xml, and sitemap-index.xml.
 *
 * Adding a new <Route> to App.tsx is all that is needed for it to appear
 * in the next deployed sitemaps.  Per-language URL overrides and metadata
 * customisation are optional via sitemap-routes.ts.
 */
export function sitemapPlugin(options: SitemapPluginOptions): Plugin {
  return {
    name: "vite-plugin-sitemap",
    apply: "build",
    generateBundle() {
      const routes = discoverRoutes(options.appRouterPath);

      const itXml = buildLanguageSitemapXml(routes, options.routeMeta, options.baseUrl, "it");
      const enXml = buildLanguageSitemapXml(routes, options.routeMeta, options.baseUrl, "en");
      const indexXml = buildSitemapIndexXml(options.baseUrl);

      this.emitFile({ type: "asset", fileName: "sitemap-it.xml",    source: itXml });
      this.emitFile({ type: "asset", fileName: "sitemap-en.xml",    source: enXml });
      this.emitFile({ type: "asset", fileName: "sitemap-index.xml", source: indexXml });
    },
  };
}
