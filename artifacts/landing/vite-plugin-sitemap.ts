import type { Plugin } from "vite";
import type { SitemapRoute } from "./sitemap-routes.js";

function buildSitemapXml(routes: SitemapRoute[], baseUrl: string): string {
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = routes
    .map((route) => {
      const loc = `${baseUrl}${route.path}`;
      const alts =
        route.hreflang
          ?.map(
            (h) =>
              `    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${h.href}" />`,
          )
          .join("\n") ?? "";

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${route.changefreq ?? "monthly"}</changefreq>`,
        `    <priority>${(route.priority ?? 0.5).toFixed(1)}</priority>`,
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
 * Vite plugin that generates sitemap.xml at build time.
 * The file is emitted as a build asset (written to outDir), overwriting
 * the static public/sitemap.xml copy.  lastmod is always today's date.
 */
export function sitemapPlugin(
  routes: SitemapRoute[],
  baseUrl: string,
): Plugin {
  return {
    name: "vite-plugin-sitemap",
    apply: "build",
    generateBundle() {
      const xml = buildSitemapXml(routes, baseUrl);
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
    },
  };
}
