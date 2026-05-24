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

function checkXml(
  body: string,
  opts: { rootElement: string; mustContain?: string[] },
): string | null {
  if (!body.trimStart().startsWith("<?xml")) {
    return "response does not start with <?xml declaration";
  }
  if (!body.includes(`<${opts.rootElement}`)) {
    return `missing root element <${opts.rootElement}>`;
  }
  for (const fragment of opts.mustContain ?? []) {
    if (!body.includes(fragment)) {
      return `missing expected content: "${fragment}"`;
    }
  }
  return null;
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
    name: "sitemap-index.xml — valid XML, references both language sitemaps",
    url: `${BASE_URL}/sitemap-index.xml`,
    validate: (_, body) =>
      checkXml(body, {
        rootElement: "sitemapindex",
        mustContain: ["sitemap-it.xml", "sitemap-en.xml"],
      }),
  },
  {
    name: "sitemap-it.xml — HTTP 200",
    url: `${BASE_URL}/sitemap-it.xml`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "sitemap-it.xml — valid XML with <url> entries",
    url: `${BASE_URL}/sitemap-it.xml`,
    validate: (_, body) =>
      checkXml(body, { rootElement: "urlset", mustContain: ["<url>", "<loc>"] }),
  },
  {
    name: "sitemap-en.xml — HTTP 200",
    url: `${BASE_URL}/sitemap-en.xml`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "sitemap-en.xml — valid XML with <url> entries",
    url: `${BASE_URL}/sitemap-en.xml`,
    validate: (_, body) =>
      checkXml(body, { rootElement: "urlset", mustContain: ["<url>", "<loc>"] }),
  },
  {
    name: "robots.txt — HTTP 200",
    url: `${BASE_URL}/robots.txt`,
    validate: (s) => (s === 200 ? null : `HTTP ${s}`),
  },
  {
    name: "robots.txt — Sitemap directive points to sitemap-index.xml",
    url: `${BASE_URL}/robots.txt`,
    validate: (_, body) =>
      body.includes("Sitemap:") && body.includes("sitemap-index.xml")
        ? null
        : "missing 'Sitemap: .../sitemap-index.xml' directive",
  },
];

async function runChecks(): Promise<void> {
  const SEPARATOR = "─".repeat(62);

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
