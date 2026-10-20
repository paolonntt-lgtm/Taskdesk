import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const appUrlInput = process.env.PERF_APP_URL;
const email = process.env.PERF_TEST_EMAIL;
const password = process.env.PERF_TEST_PASSWORD;

if (!appUrlInput || !email || !password) {
  console.error(
    "Set PERF_APP_URL, PERF_TEST_EMAIL, and PERF_TEST_PASSWORD as environment secrets before measuring.",
  );
  process.exit(1);
}

let appUrl;
try {
  appUrl = new URL(appUrlInput);
} catch {
  console.error("PERF_APP_URL must be a valid HTTP or HTTPS URL.");
  process.exit(1);
}

if (
  !["http:", "https:"].includes(appUrl.protocol) ||
  appUrl.username ||
  appUrl.password ||
  appUrl.search ||
  appUrl.hash
) {
  console.error("PERF_APP_URL must be an HTTP(S) app URL without credentials, query, or hash.");
  process.exit(1);
}

if (!appUrl.pathname.endsWith("/")) appUrl.pathname += "/";

const browserCandidates = [
  process.env.CHROMIUM_PATH,
  "/repl/tools/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  console.error("Chromium was not found. Set CHROMIUM_PATH to the browser executable.");
  process.exit(1);
}

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
};

let browser;
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.clearBrowserCache");
  await page.addInitScript(() => {
    window.__taskdeskLcp = null;
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries.at(-1);
        if (!lastEntry) return;
        const lcpEntry = lastEntry;
        window.__taskdeskLcp = {
          startTime: lcpEntry.startTime,
          size: lcpEntry.size,
          elementTag: lcpEntry.element?.tagName?.toLowerCase() ?? null,
          url: lcpEntry.url ?? "",
        };
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      window.__taskdeskLcp = null;
    }
  });

  await page.goto(appUrl.href, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();

  try {
    await page.locator('[data-testid="dashboard-root"]').waitFor({
      state: "visible",
      timeout: 30_000,
    });
  } catch {
    throw new Error(
      "Automated login did not reach the dashboard. Check that the test account is active, has completed onboarding, and can sign in with a password.",
    );
  }

  // Measure a fresh top-level dashboard navigation, not the login document or SPA transition.
  await cdp.send("Network.clearBrowserCache");
  await page.goto(appUrl.href, { waitUntil: "domcontentloaded" });
  try {
    await page.locator('[data-testid="dashboard-root"]').waitFor({
      state: "visible",
      timeout: 30_000,
    });
  } catch {
    throw new Error(
      "The authenticated reload did not render the dashboard. Verify that the test account session remains valid.",
    );
  }

  // Allow dashboard widgets to render and the LCP observer to receive its final candidate.
  await page.waitForTimeout(2_000);

  const measurement = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => entry);
    const largestContentfulPaint = window.__taskdeskLcp;
    if (!navigation || !largestContentfulPaint) return null;

    const assets = resources
      .map((resource) => ({
        url: resource.name,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
      }))
      .filter((resource) => {
        if (resource.transferSize <= 0) return false;
        try {
          const url = new URL(resource.url);
          return (
            !url.pathname.startsWith("/api/") &&
            ["script", "css", "img", "link"].includes(resource.initiatorType)
          );
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 12)
      .map((resource) => ({
        url: resource.url,
        initiatorType: resource.initiatorType,
        transferBytes: resource.transferSize,
        encodedBodyBytes: resource.encodedBodySize,
      }));

    const transferredBytes =
      navigation.transferSize +
      resources.reduce((total, resource) => total + resource.transferSize, 0);

    return {
      ttfbMs: Math.round((navigation.responseStart - navigation.requestStart) * 10) / 10,
      lcpMs: Math.round(largestContentfulPaint.startTime * 10) / 10,
      lcp: {
        sizePixels: largestContentfulPaint.size,
        elementTag: largestContentfulPaint.elementTag,
        url: largestContentfulPaint.url,
      },
      transferredBytes,
      documentTransferBytes: navigation.transferSize,
      assets,
    };
  });

  if (!measurement) {
    throw new Error(
      "The browser did not report navigation timing and LCP. Confirm the browser supports PerformanceObserver.",
    );
  }

  const lcpUrl = safeUrl(measurement.lcp.url);
  const result = {
    measuredAt: new Date().toISOString(),
    app: safeUrl(appUrl.href),
    cache: "disabled",
    authenticatedDashboard: true,
    ttfbMs: measurement.ttfbMs,
    lcpMs: measurement.lcpMs,
    lcp: {
      sizePixels: measurement.lcp.sizePixels,
      elementTag: measurement.lcp.elementTag,
      ...(lcpUrl ? { asset: lcpUrl } : {}),
    },
    transferredBytes: measurement.transferredBytes,
    documentTransferBytes: measurement.documentTransferBytes,
    mainAssets: measurement.assets.map((asset) => ({
      ...asset,
      url: safeUrl(asset.url),
    })),
  };

  console.log(JSON.stringify(result, null, 2));
  await context.close();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Dashboard performance measurement failed.");
  process.exitCode = 1;
} finally {
  await browser?.close();
}
