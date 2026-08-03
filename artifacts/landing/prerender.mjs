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
 * og:image:width/height/alt, og:locale:alternate, twitter:card,
 * twitter:image:alt) are left in place — they never vary per-route.
 */
function stripDynamicHeadTags(html) {
  let h = html;
  h = h.replace(/\s*<title>[^<]*<\/title>/g, '');
  h = h.replace(/\s*<meta name="description"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="keywords"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="robots"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<link rel="canonical"[^>]*\/?>/gi, '');
  // Remove all hreflang alternate links (vary per route/language)
  h = h.replace(/\s*<link rel="alternate"\s[^>]*hreflang[^>]*\/?>/gi, '');
  // Remove per-route og/twitter tags; keep static ones (type, site_name, image:*, locale:alternate)
  h = h.replace(/\s*<meta property="og:url"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta property="og:title"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta property="og:description"[^>]*\/?>/gi, '');
  // og:image (not og:image:width / og:image:height / og:image:alt)
  h = h.replace(/\s*<meta property="og:image"(?!:)[^>]*\/?>/gi, '');
  // og:locale (not og:locale:alternate)
  h = h.replace(/\s*<meta property="og:locale"(?!:)[^>]*\/?>/gi, '');
  // twitter:title / twitter:description / twitter:image (not twitter:image:alt or twitter:card)
  h = h.replace(/\s*<meta name="twitter:title"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="twitter:description"[^>]*\/?>/gi, '');
  h = h.replace(/\s*<meta name="twitter:image"(?!:)[^>]*\/?>/gi, '');
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
    h = h.replace('</head>', `    ${headTags}\n  </head>`);
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

// FAQ content mirrored from src/i18n.tsx (kept in sync with translations)
const FAQ_ITEMS = {
  it: [
    { q: "È adatto al mio studio commerciale o alla mia agenzia?", a: "Sì, TaskDesk è pensato esattamente per questo. Studi commerciali, studi di consulenza del lavoro, agenzie e liberi professionisti lo usano per raccogliere le richieste dei clienti in un unico posto, assegnarle ai collaboratori e tracciarle fino alla chiusura — senza email disperse o WhatsApp irrintracciabili." },
    { q: "C'è un periodo di prova gratuita?", a: "Sì! I primi 7 giorni sono completamente gratuiti, senza bisogno di inserire la carta di credito. Al termine puoi scegliere il piano più adatto al tuo studio, da €35/mese + IVA (o €350/anno + IVA). Enterprise su preventivo." },
    { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso. Sei operativo in pochi minuti, senza formazione." },
    { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione. Puoi disdire in qualsiasi momento dalla tua area account." },
    { q: "I miei clienti possono accedere e inviare richieste?", a: "Oggi i clienti vengono aggiunti come utenti dedicati. Ogni cliente vede solo le proprie pratiche. Una funzionalità di portale clienti semplificato è nella roadmap." },
  ],
  en: [
    { q: "Is it right for my accounting firm or agency?", a: "Yes, TaskDesk is designed exactly for this. Accounting firms, labour consultancies, agencies and sole practitioners use it to collect client requests in one place, assign them to team members and track them through to completion — without scattered emails or untraceable WhatsApp messages." },
    { q: "Is there a free trial?", a: "Yes! The first 7 days are completely free, with no credit card required. Afterwards you can choose the plan that best suits your firm, from €35/month + VAT (or €350/year + VAT). Enterprise is priced on request." },
    { q: "Is there a setup cost?", a: "Absolutely not. The software is ready to use from your first login. You are up and running in minutes, with no training needed." },
    { q: "Can I cancel at any time?", a: "Yes, there are no contractual commitments or cancellation fees. You can cancel at any time from your account area." },
    { q: "Can my clients access the system and submit requests?", a: "Today clients are added as dedicated users. Each client sees only their own requests. A simplified client portal feature is on the roadmap." },
  ],
};

const SEO_DESC = {
  it: "TaskDesk è il sistema di gestione pratiche per studi commerciali, agenzie e consulenti. Raccogli le richieste dei clienti in un unico posto, assegnale al team e traccia ogni pratica fino alla chiusura. Prezzi di lancio da €35/mese + IVA.",
  en: "TaskDesk is the request management system for accounting firms, agencies and consultants. Collect every client request in one place, assign it to your team and track it to completion. Launch prices from €35/month + VAT.",
};

function generateLandingJsonLd(lang) {
  const faqItems = FAQ_ITEMS[lang] || FAQ_ITEMS.it;
  const description = SEO_DESC[lang] || SEO_DESC.it;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "inLanguage": lang === "en" ? "en" : "it",
      },
      {
        "@type": "Organization",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "logo": "https://taskdesk.it/taskdesk-logo.png",
        "sameAs": [],
      },
      {
        "@type": "SoftwareApplication",
        "name": "TaskDesk",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, iOS, Android",
        "description": description,
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "35",
          "highPrice": "100",
          "priceCurrency": "EUR",
          "offerCount": "4",
        },
      },
      {
        "@type": "FAQPage",
        "mainEntity": faqItems.map((item) => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a,
          },
        })),
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function replaceJsonLd(html, newJsonLd) {
  // Remove all existing application/ld+json script blocks from <head>
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

const BASE = 'https://taskdesk.it';

console.log('Prerendering routes...');

async function writeRoute(routePath, isLandingPage = false) {
  const cleanPath = routePath.replace(/^\//, '').replace(/\/$/, '');
  const dir = cleanPath ? resolve(distDir, cleanPath) : distDir;
  mkdirSync(dir, { recursive: true });

  // Start from the template with all dynamic head tags stripped.
  // The route component's <Helmet> output will be the single source of truth.
  const template = readTemplate();
  let html = stripDynamicHeadTags(template);

  const lang = routePath.startsWith('/en') ? 'en' : 'it';

  try {
    const ssrUrl = routePath.endsWith('/') ? routePath : `${routePath}/`;
    const { html: bodyHtml } = render(ssrUrl);

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

  // JSON-LD: landing pages (/it/, /en/) get a full @graph; all other pages get none.
  const newJsonLd = isLandingPage ? generateLandingJsonLd(lang) : null;
  html = replaceJsonLd(html, newJsonLd);

  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ /${cleanPath || ''}/index.html`);
}

await writeRoute('/it/', true);
await writeRoute('/en/', true);

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

// 404 not-found page — served with HTTP 404 for any unknown route
await writeRoute('/404', false);

console.log('Prerender complete.');
