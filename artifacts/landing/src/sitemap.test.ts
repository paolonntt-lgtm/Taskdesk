// @vitest-environment node
import path from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { build } from "vite";
import { sitemapPlugin } from "../vite-plugin-sitemap";
import { SITEMAP_BASE_URL, SITEMAP_ROUTE_META } from "../sitemap-routes";

async function generateSitemaps(date: string) {
  vi.setSystemTime(new Date(date));
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "sitemap-test-entry",
        resolveId: (id) => id === "virtual:sitemap-test" ? id : undefined,
        load: (id) => id === "virtual:sitemap-test" ? "export {};" : undefined,
      },
      sitemapPlugin({
        appRouterPath: path.resolve(import.meta.dirname, "App.tsx"),
        routeMeta: SITEMAP_ROUTE_META,
        baseUrl: SITEMAP_BASE_URL,
      }),
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: "virtual:sitemap-test" },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const sitemaps: Record<string, string> = {};
  for (const output of outputs) {
    if (!("output" in output)) throw new Error("Expected a completed build");
    for (const asset of output.output) {
      if (asset.type === "asset" && asset.fileName.endsWith(".xml")) {
        sitemaps[asset.fileName] = String(asset.source);
      }
    }
  }
  return sitemaps;
}

afterEach(() => vi.useRealTimers());

describe("sitemap freshness signals", () => {
  it("keeps localized page entries unchanged across build dates without claiming page updates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = await generateSitemaps("2026-01-15T12:00:00Z");
    const second = await generateSitemaps("2026-02-20T12:00:00Z");

    expect(Object.keys(first).sort()).toEqual([
      "sitemap-en.xml", "sitemap-index.xml", "sitemap-it.xml",
    ]);
    for (const lang of ["it", "en"]) {
      const name = `sitemap-${lang}.xml`;
      expect(first[name]).toBe(second[name]);
      const xml = new JSDOM(first[name], { contentType: "application/xml" }).window.document;
      expect(xml.querySelector("parsererror")).toBeNull();
      expect(xml.querySelectorAll("lastmod")).toHaveLength(0);
      expect(xml.querySelectorAll("url")).toHaveLength(7);
      for (const url of xml.querySelectorAll("url")) {
        expect(url.querySelector("loc")?.textContent).toMatch(
          new RegExp(`^${SITEMAP_BASE_URL}/${lang}/`),
        );
        expect(url.querySelector("changefreq")).not.toBeNull();
        expect(url.querySelector("priority")).not.toBeNull();
        expect(url.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")).toHaveLength(3);
      }
    }
    // Index dates describe the generated sitemap files, not their pages.
    expect(first["sitemap-index.xml"].match(/<lastmod>2026-01-15<\/lastmod>/g)).toHaveLength(2);
    expect(second["sitemap-index.xml"].match(/<lastmod>2026-02-20<\/lastmod>/g)).toHaveLength(2);
  });
});
