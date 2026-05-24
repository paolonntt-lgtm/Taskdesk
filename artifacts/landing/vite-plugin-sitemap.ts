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

function buildSitemapXml(
  routes: string[],
  routeMeta: Record<string, SitemapRouteMeta>,
  baseUrl: string,
): string {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = routes
    .filter((path) => !routeMeta[path]?.exclude)
    .map((path) => {
      const meta = routeMeta[path] ?? {};
      const loc = `${baseUrl}${path}`;
      const alts =
        meta.hreflang
          ?.map(
            (h) =>
              `    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${h.href}" />`,
          )
          .join("\n") ?? "";

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${meta.changefreq ?? "monthly"}</changefreq>`,
        `    <priority>${(meta.priority ?? 0.5).toFixed(1)}</priority>`,
        ...(alts ? [alts] : []),
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
 * Vite plugin that generates sitemap.xml at build time by:
 * 1. Scanning `appRouterPath` for <Route path="..." /> declarations.
 * 2. Merging discovered paths with optional metadata from `routeMeta`.
 * 3. Emitting the XML asset into the output directory.
 *
 * Adding a new <Route> to App.tsx is all that is needed for it to appear
 * in the next deployed sitemap.  Metadata customisation is optional.
 */
export function sitemapPlugin(options: SitemapPluginOptions): Plugin {
  return {
    name: "vite-plugin-sitemap",
    apply: "build",
    generateBundle() {
      const routes = discoverRoutes(options.appRouterPath);
      const xml = buildSitemapXml(routes, options.routeMeta, options.baseUrl);
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
    },
  };
}
