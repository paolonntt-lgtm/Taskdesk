import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.join(root, "scripts/wordmark-visual-baselines");
const svgPath = path.join(root, "artifacts/landing/public/taskdesk-logo.svg");
const landingPath = path.join(root, "artifacts/landing/src/pages/Landing.tsx");
const loginPath = path.join(root, "artifacts/ticketing/src/pages/Login.tsx");
const chromiumPath = [
  process.env.CHROMIUM_PATH,
  "/repl/tools/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((candidate) => candidate && existsSync(candidate));
const requireFromTicketing = createRequire(
  path.join(root, "artifacts/ticketing/package.json"),
);
const { chromium } = requireFromTicketing("playwright-core");
const MAX_CHANGED_PIXEL_RATIO = 0.005;
const CHANNEL_TOLERANCE = 8;

function fail(message) {
  throw new Error(`[wordmark-visual] ${message}`);
}

function tailwindHeight(className, expectedAttributeHeight, location) {
  if (!className.split(/\s+/).includes("w-auto")) {
    fail(`${location} must keep its automatic width.`);
  }
  const heightClass = className.split(/\s+/).find((token) => /^h-\d+$/.test(token));
  const cssHeight = heightClass ? Number(heightClass.slice(2)) * 4 : NaN;
  if (cssHeight !== expectedAttributeHeight) {
    fail(
      `${location} CSS height (${cssHeight}px) must match its declared height (${expectedAttributeHeight}px).`,
    );
  }
  return cssHeight;
}

function extractCases() {
  const landing = readFileSync(landingPath, "utf8");
  const login = readFileSync(loginPath, "utf8");
  const header = landing.match(
    /<img src="\/taskdesk-logo\.svg" alt="TaskDesk logo" width="(\d+)" height="(\d+)" className="([^"]+)"/,
  );
  const footer = landing.match(
    /<img src="\/taskdesk-logo\.svg" alt="TaskDesk" width="(\d+)" height="(\d+)"[\s\S]{0,100}?className="([^"]+)"/,
  );
  const loginImage = login.match(
    /<img src="\/taskdesk-logo\.svg" alt="TaskDesk" style=\{\{\s*height:\s*(\d+),\s*width:\s*'auto',\s*display:\s*'block'\s*\}\}/,
  );
  if (!header || !footer || !loginImage) {
    fail("Could not find all three wordmark uses or their expected CSS sizing.");
  }

  const headerHeight = tailwindHeight(header[3], Number(header[2]), "Landing header logo");
  const footerHeight = tailwindHeight(footer[3], Number(footer[2]), "Landing footer logo");
  return [
    {
      id: "landing-header",
      height: headerHeight,
      background: "#ffffff",
      filter: "none",
    },
    {
      id: "landing-footer",
      height: footerHeight,
      background: "#ffffff",
      filter: "grayscale(1) opacity(0.5)",
    },
    {
      id: "ticketing-login",
      height: Number(loginImage[1]),
      background: "#eef2ff",
      filter: "none",
    },
  ];
}

function getViewBox(svg) {
  const match = svg.match(/\bviewBox="([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"/);
  if (!match) fail("The wordmark SVG has no numeric viewBox.");
  return {
    width: Number(match[3]),
    height: Number(match[4]),
  };
}

function pixels(pngPath) {
  return execFileSync("magick", [pngPath, "-depth", "8", "RGBA:-"], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

function imageDimensions(pngPath) {
  return execFileSync("magick", ["identify", "-format", "%wx%h", pngPath], {
    encoding: "utf8",
  }).trim();
}

function compareScreenshot(actualPath, baselinePath, caseId) {
  if (!existsSync(baselinePath)) {
    fail(`Missing baseline ${path.relative(root, baselinePath)}; regenerate with --update-baselines.`);
  }
  const actualDimensions = imageDimensions(actualPath);
  const baselineDimensions = imageDimensions(baselinePath);
  if (actualDimensions !== baselineDimensions) {
    fail(
      `${caseId} rendered at ${actualDimensions}, but its reference is ${baselineDimensions}.`,
    );
  }

  const actual = pixels(actualPath);
  const baseline = pixels(baselinePath);
  if (actual.length !== baseline.length) {
    fail(`${caseId} screenshot size does not match its reference.`);
  }

  let changedPixels = 0;
  for (let offset = 0; offset < actual.length; offset += 4) {
    if (
      Math.abs(actual[offset] - baseline[offset]) > CHANNEL_TOLERANCE ||
      Math.abs(actual[offset + 1] - baseline[offset + 1]) > CHANNEL_TOLERANCE ||
      Math.abs(actual[offset + 2] - baseline[offset + 2]) > CHANNEL_TOLERANCE ||
      Math.abs(actual[offset + 3] - baseline[offset + 3]) > CHANNEL_TOLERANCE
    ) {
      changedPixels += 1;
    }
  }
  const ratio = changedPixels / (actual.length / 4);
  if (ratio > MAX_CHANGED_PIXEL_RATIO) {
    fail(
      `${caseId} differs from its visual reference in ${(ratio * 100).toFixed(2)}% of pixels; maximum allowed is ${(MAX_CHANGED_PIXEL_RATIO * 100).toFixed(2)}%.`,
    );
  }
}

async function main() {
  if (!chromiumPath) {
    fail("Chromium not found. Set CHROMIUM_PATH to a Chromium executable.");
  }
  const updateBaselines = process.argv[2] === "--update-baselines";
  if (process.argv.length > 2 && !updateBaselines) {
    fail("Usage: node scripts/check-wordmark-visual.mjs [--update-baselines]");
  }
  const svg = readFileSync(svgPath, "utf8");
  const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const aspectRatio = getViewBox(svg).width / getViewBox(svg).height;
  const cases = extractCases();
  const browser = await chromium.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;font-family:sans-serif}.case{display:flex;align-items:center;justify-content:flex-start;padding:4px 0}</style></head><body>${cases
        .map(({ id, height, background, filter }) => `<div class="case" style="height:${height + 8}px"><img id="${id}" alt="" src="${svgData}" style="display:block;height:${height}px;width:auto;background:${background};filter:${filter}"></div>`)
        .join("")}</body></html>`,
      { waitUntil: "load" },
    );

    for (const visualCase of cases) {
      const image = page.locator(`#${visualCase.id}`);
      await image.evaluate((element) => element.decode());
      const bounds = await image.boundingBox();
      if (
        !bounds ||
        Math.abs(bounds.height - visualCase.height) > 0.1 ||
        Math.abs(bounds.width / bounds.height - aspectRatio) > 0.01
      ) {
        fail(
          `${visualCase.id} is distorted: rendered ${bounds?.width ?? 0}×${bounds?.height ?? 0}px, expected height ${visualCase.height}px and ratio ${aspectRatio.toFixed(3)}.`,
        );
      }

      const screenshot = await image.screenshot({ type: "png" });
      const baselinePath = path.join(fixturesPath, `${visualCase.id}.png`);
      if (updateBaselines) {
        mkdirSync(fixturesPath, { recursive: true });
        writeFileSync(baselinePath, screenshot);
        console.log(`[wordmark-visual] Updated ${path.relative(root, baselinePath)}.`);
      } else {
        const tempPath = path.join(os.tmpdir(), `${visualCase.id}-${process.pid}.png`);
        try {
          writeFileSync(tempPath, screenshot);
          compareScreenshot(tempPath, baselinePath, visualCase.id);
        } finally {
          // Keep generated screenshots out of the workspace.
          rmSync(tempPath, { force: true });
        }
        console.log(`[wordmark-visual] ${visualCase.id} matches its reference.`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
