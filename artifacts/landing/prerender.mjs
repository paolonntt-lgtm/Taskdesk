import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist/public');

function readTemplate() {
  return readFileSync(resolve(distDir, 'index.html'), 'utf-8');
}

/**
 * Remove all dynamic head tags from the template that will be injected
 * via the collected Helmet context from SSR. Static tags (charset, viewport,
 * theme-color, GA script, favicon, preconnects, fonts, og:type, og:site_name,
 * og:image:width/height, twitter:card) are left in place because they do not
 * vary per-route. The landing page image and its alt text are stripped when
 * prerendering /it/ and /en/ because both vary by locale. og:locale:alternate
 * is stripped here because it differs between /it/ and /en/ and is injected
 * per-locale by the Landing component's <Helmet> block.
 */
function stripDynamicHeadTags(html, isLandingPage = false) {
  let h = html;
  h = h.replace(/\s*<title>[^<]*<\/title>/g, '');
  h = h.replace(/\s*<meta name="description"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="keywords"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="robots"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<link rel="canonical"[^>]*\/?>/gi, '');
  // Remove all hreflang alternate links (vary per route/language)
  h = h.replace(/\s*<link rel="alternate"\s[^>]*hreflang[^>]*\/?>/gi, '');
  // Remove the static generic manifest link; each locale injects its own via Helmet
  h = h.replace(/\s*<link rel="manifest"[^>]*\/?>/gi, '');
  // Remove per-route og/twitter tags; Helmet is the single source of truth for all of these
  h = h.replace(/\s*<meta property="og:url"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta property="og:title"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta property="og:description"[^>]*\/?>/gi, '');
  // og:image (not og:image:width / og:image:height / og:image:alt)
  h = h.replace(/\s*<meta property="og:image"(?!:)[^>]*\/?>/gi, '');
  if (isLandingPage) {
    h = h.replace(/\s*<meta property="og:image:alt"[^>]*\/?>/gi, '');
  }
  // og:locale and og:locale:alternate (both vary per locale)
  h = h.replace(/\s*<meta property="og:locale"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta property="og:locale:alternate"[^>]*\/?>/gi, '');
  // twitter:title / twitter:description / twitter:image (not twitter:image:alt)
  h = h.replace(/\s*<meta name="twitter:title"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="twitter:description"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="twitter:image"(?!:)[^>]*\/?>/gi, '');
  if (isLandingPage) {
    h = h.replace(/\s*<meta name="twitter:image:alt"[^>]*\/?>/gi, '');
  }
  return h;
}

/**
 * Extract SEO/Helmet tags that React 19 hoists to the start of the SSR body
 * string. When using React 19, react-helmet-async does NOT populate the
 * helmetContext — instead React itself moves <title>, <meta>, <link>, and
 * similar tags to the very beginning of the renderToString output (before
 * any real component markup). Everything before the first real DOM element
 * (i.e. before the first "<div", "<nav", "<main", "<header", or "<section")
 * is collected as the hoisted head content.
 */
function extractHelmetTagsFromBody(bodyHtml) {
  // Find the start of real page markup — the first block-level element.
  const firstContentIdx = bodyHtml.search(/<(?:div|nav|main|header|section|article|footer|ul|ol|form|h[1-6])\b/i);
  if (firstContentIdx <= 0) return '';
  return bodyHtml.slice(0, firstContentIdx).trim();
}

/**
 * Inject per-route head tags into the HTML template and set the correct
 * lang attribute on <html>. Works with both the legacy helmetContext API
 * (v2 / React < 19) and the React 19 path where tags are passed as a raw
 * HTML string extracted from the SSR body.
 *
 * @param {string} html - The full HTML template string.
 * @param {string} lang - The page language ('it' | 'en').
 * @param {string} headTags - Raw HTML string of tags to inject before </head>.
 */
function injectHeadTags(html, lang, headTags) {
  let h = html;

  // Always set the correct lang attribute based on the route.
  h = h.replace(/<html[^>]*>/, `<html lang="${lang}">`);

  if (headTags && headTags.trim()) {
    // React SSR (via react-helmet-async) emits hrefLang (camelCase) in raw HTML
    // output; normalise to the spec-correct lowercase hreflang before injection.
    const normalised = headTags.replace(/\bhrefLang=/g, 'hreflang=');
    h = h.replace('</head>', `    ${normalised}\n  </head>`);
  }

  return h;
}

/**
 * Strip elements that react-helmet-async renders into the SSR body string.
 *
 * react-helmet-async adds data-rh="true" to elements only during client-side
 * hydration, NOT during SSR renderToString. In SSR the library emits bare tags
 * (no data-rh attribute) into the body HTML while simultaneously collecting
 * them in the helmetContext. We must strip both forms so that metadata appears
 * exactly once — inside <head>, injected by injectHelmetToHead.
 */
function stripHelmetFromBody(bodyHtml) {
  let h = bodyHtml;

  // --- 1. data-rh="true" variants (client-hydration path, belt-and-suspenders) ---
  // Self-closing: <meta data-rh="true" .../>, <link data-rh="true" .../>
  h = h.replace(/<(?:meta|link|base)[^>]*data-rh="true"[^>]*\/?>/g, '');
  // Paired: <title data-rh="true">...</title>
  h = h.replace(/<(title|script|style|noscript)[^>]*data-rh="true"[^>]*>[\s\S]*?<\/\1>/g, '');

  // --- 2. Bare SEO tags emitted by Helmet during SSR renderToString ---
  // <title>…</title>
  h = h.replace(/<title>[^<]*<\/title>/g, '');
  // <meta name="description|keywords|robots|author|…" …/>
  h = h.replace(/<meta name="(?:description|keywords|robots|author|twitter:[^"]*)"[^>]*\/?>/gi, '');
  // <meta property="og:…" …/>
  h = h.replace(/<meta property="og:[^"]*"[^>]*\/?>/gi, '');
  // <link rel="canonical" …/>
  h = h.replace(/<link rel="canonical"[^>]*\/?>/gi, '');
  // <link rel="alternate" …hreflang… or …hrefLang… (SSR renders camelCase hrefLang)
  h = h.replace(/<link rel="alternate"\s[^>]*href[Ll]ang[^>]*\/?>/gi, '');
  // <link rel="manifest" …/> (locale-aware manifest injected by Helmet; must only appear in <head>)
  h = h.replace(/<link rel="manifest"[^>]*\/?>/gi, '');
  // <link rel="preload" …/> (Helmet sometimes renders logo/image preloads into body)
  h = h.replace(/<link rel="preload"[^>]*\/?>/gi, '');

  return h;
}

function injectBody(html, bodyHtml) {
  const cleanBody = stripHelmetFromBody(bodyHtml);
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${cleanBody}</div>`
  );
}

const SEO_DESC = {
  it: "TaskDesk è il sistema di gestione pratiche per studi commerciali, agenzie e consulenti. Raccogli le richieste dei clienti in un unico posto, assegnale al team e traccia ogni pratica fino alla chiusura. Prezzi di lancio da €35/mese + IVA.",
  en: "TaskDesk is the request management system for accounting firms, agencies and consultants. Collect every client request in one place, assign it to your team and track it to completion. Launch prices from €35/month + VAT.",
};

function generateLandingJsonLd(lang) {
  const description = SEO_DESC[lang] || SEO_DESC.it;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://taskdesk.it/#website",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "inLanguage": lang === "en" ? "en" : "it",
      },
      {
        "@type": "Organization",
        "@id": "https://taskdesk.it/#organization",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "logo": "https://taskdesk.it/taskdesk-logo.png",
        "sameAs": [
          "https://www.linkedin.com/company/taskdesk",
          "https://twitter.com/taskdesk"
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://taskdesk.it/#software",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, iOS, Android",
        "description": description,
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "35",
          "highPrice": "100",
          "priceCurrency": "EUR",
          "offerCount": "3",
        },
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function replaceJsonLd(html, newJsonLd) {
  // Remove existing application/ld+json blocks before injecting the route's
  // server-rendered structured data exactly once.
  let h = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
    ''
  );
  // Inject new JSON-LD before </head> (if provided)
  if (newJsonLd && newJsonLd.trim()) {
    h = h.replace('</head>', `  ${newJsonLd.trim()}\n  </head>`);
  }
  return h;
}

function getRenderedJsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[0]);
}

// Build SSR bundle
console.log('Building SSR bundle for prerender...');
await build({
  configFile: resolve(__dirname, 'vite.ssr.config.ts'),
  logLevel: 'warn',
});
console.log('SSR bundle ready.');

// Import server render function (fresh import after build)
const ssrModule = await import(`./dist/server/entry-server.js?v=${Date.now()}`);
const render = ssrModule.render;
const professionIds = ssrModule.PROFESSION_IDS;
const professionSlugs = ssrModule.PROFESSION_SLUGS;

const BASE = 'https://taskdesk.it';

console.log('Prerendering routes...');

async function writeRoute(routePath, isLandingPage = false, isProfessionPage = false, languageOverride) {
  const cleanPath = routePath.replace(/^\//, '').replace(/\/$/, '');
  const dir = cleanPath ? resolve(distDir, cleanPath) : distDir;
  mkdirSync(dir, { recursive: true });

  // Start from the template with all dynamic head tags stripped.
  // The route component's <Helmet> output will be the single source of truth.
  const template = readTemplate();
  let html = stripDynamicHeadTags(template, isLandingPage);

  const lang = languageOverride ?? (routePath.startsWith('/en') ? 'en' : 'it');
  let bodyHtml = '';

  try {
    const ssrUrl = routePath.endsWith('/') ? routePath : `${routePath}/`;
    bodyHtml = render(ssrUrl).html;

    // React 19 + react-helmet-async: the library's helmetContext is never
    // populated because React 19 natively hoists <title>/<meta>/<link> tags
    // to the start of the renderToString output instead. Extract those hoisted
    // tags from the body and inject them into <head> before stripping them.
    const headTags = extractHelmetTagsFromBody(bodyHtml);
    html = injectHeadTags(html, lang, headTags);

    if (bodyHtml && bodyHtml.length > 0) {
      html = injectBody(html, bodyHtml);
    }
  } catch (e) {
    console.warn(`  ⚠ SSR failed for ${routePath}: ${e.message}`);
    // Even on SSR failure, set the correct lang attribute on <html>.
    html = injectHeadTags(html, lang, '');
  }

  // The professional page's JSON-LD is authored by the React page component.
  // Preserve its SSR output and validate it before writing the static page.
  let newJsonLd = isLandingPage ? generateLandingJsonLd(lang) : null;
  if (isProfessionPage) {
    const renderedJsonLd = getRenderedJsonLd(bodyHtml);
    if (renderedJsonLd.length !== 1) {
      throw new Error(
        `Expected exactly one server-rendered JSON-LD block for ${routePath}, found ${renderedJsonLd.length}.`
      );
    }
    const jsonText = renderedJsonLd[0].replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Invalid server-rendered JSON-LD for ${routePath}: ${error.message}`);
    }
    newJsonLd = renderedJsonLd[0];
  }
  html = replaceJsonLd(html, newJsonLd);

  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ /${cleanPath || ''}/index.html`);
}

await writeRoute('/it/', true);
await writeRoute('/en/', true);

for (const profession of professionIds) {
  await writeRoute(`/it/${professionSlugs.it[profession]}`, false, true);
  await writeRoute(`/en/${professionSlugs.en[profession]}`, false, true);
}

const legalPages = [
  { slug: 'privacy-policy' },
  { slug: 'terms' },
  { slug: 'dpa' },
  { slug: 'cookie-policy' },
];

// Legal pages only exist in Italian. stripDynamicHeadTags removes the
// template's head tags; the component's <Helmet> is the sole source of truth.
for (const page of legalPages) {
  await writeRoute(`/it/${page.slug}`, false);
}

// Shared English error document, served with HTTP 404 for any unknown route.
await writeRoute('/404', false, false, 'en');

console.log('Prerender complete.');
