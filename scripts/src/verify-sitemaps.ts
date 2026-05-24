#!/usr/bin/env tsx
/**
 * Smoke-test: verify sitemap files are accessible and well-formed at a given
 * base URL.  Exits with code 1 if any check fails.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run verify-sitemaps
 *   pnpm --filter @workspace/scripts run verify-sitemaps -- https://taskdesk.it
 *   pnpm --filter @workspace/scripts run verify-sitemaps -- http://localhost:80
 */

import { XMLParser } from "fast-xml-parser";

const args = process.argv.slice(2).filter((a) => a !== "--");
const BASE_URL = (args[0] ?? "https://taskdesk.it").replace(/\/$/, "");

interface CheckResult {
  name: string;
  passed: boolean;
  reason?: string;
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await res.text();
  return { status: res.status, body };
}

const xmlParser = new XMLParser({ ignoreAttributes: false });

/**
 * Parse body as XML and return an error string on failure, or null on success.
 * Uses fast-xml-parser so actual XML syntax errors are caught.
 */
function parseXml(body: string): { parsed: unknown; error: string | null } {
  try {
    const parsed = xmlParser.parse(body);
    return { parsed, error: null };
  } catch (err) {
    return {
      parsed: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Validate an XML response: parse it, then check for expected top-level keys.
 */
function checkXml(
  body: string,
  opts: { requiredKey: string; mustContain?: string[] },
): string | null {
  const { parsed, error } = parseXml(body);
  if (error) return `XML parse error: ${error}`;
  if (typeof parsed !== "object" || parsed === null) {
    return "parsed XML is not an object";
  }
  if (!(opts.requiredKey in (parsed as Record<string, unknown>))) {
    return `missing root element <${opts.requiredKey}>`;
  }
  for (const fragment of opts.mustContain ?? []) {
    if (!body.includes(fragment)) {
      return `missing expected content: "${fragment}"`;
    }
  }
  return null;
}

/**
 * Verify that robots.txt contains a Sitemap directive whose value:
 *  - is an absolute URL (starts with http:// or https://)
 *  - ends with /sitemap-index.xml
 *
 * We do NOT require the host to match BASE_URL because robots.txt always
 * declares the canonical production URL even when the script is run against
 * a local build or a staging host.
 */
function checkRobotsDirective(body: string): string | null {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^Sitemap:\s*(.+)$/i);
    if (!m) continue;
    const url = m[1].trim();
    if (/^https?:\/\/.+\/sitemap-index\.xml$/.test(url)) return null;
    return `Sitemap directive found but does not point to sitemap-index.xml: "${url}"`;
  }
  return `no "Sitemap: ..." directive found in robots.txt`;
}

const CHECKS: Array<{
  name: string;
  url: string;
  validate: (status: number, body: string) => string | null;
}> = [
  {
    name: "sitemap-index.xml — HTTP 200",
    url: `${BASE_URL}/sitemap-index.xml`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "sitemap-index.xml — valid XML with <sitemapindex> root, references both language sitemaps",
    url: `${BASE_URL}/sitemap-index.xml`,
    validate: (_, body) =>
      checkXml(body, {
        requiredKey: "sitemapindex",
        mustContain: ["sitemap-it.xml", "sitemap-en.xml"],
      }),
  },
  {
    name: "sitemap-it.xml — HTTP 200",
    url: `${BASE_URL}/sitemap-it.xml`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "sitemap-it.xml — valid XML with <urlset> root and <url> entries",
    url: `${BASE_URL}/sitemap-it.xml`,
    validate: (_, body) =>
      checkXml(body, { requiredKey: "urlset", mustContain: ["<url>", "<loc>"] }),
  },
  {
    name: "sitemap-en.xml — HTTP 200",
    url: `${BASE_URL}/sitemap-en.xml`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "sitemap-en.xml — valid XML with <urlset> root and <url> entries",
    url: `${BASE_URL}/sitemap-en.xml`,
    validate: (_, body) =>
      checkXml(body, { requiredKey: "urlset", mustContain: ["<url>", "<loc>"] }),
  },
  {
    name: "robots.txt — HTTP 200",
    url: `${BASE_URL}/robots.txt`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "robots.txt — Sitemap directive is an absolute URL ending with /sitemap-index.xml",
    url: `${BASE_URL}/robots.txt`,
    validate: (_, body) => checkRobotsDirective(body),
  },
];

async function runChecks(): Promise<void> {
  const SEPARATOR = "─".repeat(66);

  console.log(`\nTaskDesk sitemap smoke-test`);
  console.log(`Target: ${BASE_URL}`);
  console.log(SEPARATOR);

  const cache = new Map<string, Promise<{ status: number; body: string }>>();
  const cachedFetch = (url: string) => {
    if (!cache.has(url)) cache.set(url, fetchText(url));
    return cache.get(url)!;
  };

  const results: CheckResult[] = await Promise.all(
    CHECKS.map(async (check) => {
      try {
        const { status, body } = await cachedFetch(check.url);
        const reason = check.validate(status, body) ?? undefined;
        return { name: check.name, passed: !reason, reason };
      } catch (err) {
        return {
          name: check.name,
          passed: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    const label = r.passed ? "PASS" : "FAIL";
    console.log(`${icon} [${label}] ${r.name}`);
    if (!r.passed) console.log(`       ↳ ${r.reason}`);
  }

  console.log(SEPARATOR);
  const failed = results.filter((r) => !r.passed).length;
  const passed = results.length - failed;
  console.log(`Result: ${passed}/${results.length} checks passed\n`);

  if (failed > 0) process.exit(1);
}

runChecks().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
