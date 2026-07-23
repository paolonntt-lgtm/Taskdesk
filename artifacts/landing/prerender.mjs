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
 * Inject the collected react-helmet-async output into the <head>.
 * Reads title, meta, and link tag strings from the helmet context object
 * and appends them before </head>. Also updates the lang attribute on <html>.
 */
function injectHelmetToHead(html, helmet) {
  let h = html;

  // Update the lang attribute on <html> from helmet.htmlAttributes
  const htmlAttrs = helmet.htmlAttributes?.toString?.() ?? '';
  if (htmlAttrs) {
    h = h.replace(/<html[^>]*>/, `<html ${htmlAttrs}>`);
  }

  // Collect per-route head tag strings from the helmet context
  const tags = [
    helmet.title?.toString?.() ?? '',
    helmet.meta?.toString?.() ?? '',
    helmet.link?.toString?.() ?? '',
  ].filter(s => s.trim()).join('\n    ');

  if (tags) {
    h = h.replace('</head>', `    ${tags}\n  </head>`);
  }

  return h;
}

/**
 * Strip elements that react-helmet-async renders into the SSR body string.
 * The library marks every element it manages with data-rh="true". These tags
 * belong in <head> (already injected via injectHelmetToHead) and must not
 * appear a second time inside #root.
 */
function stripHelmetFromBody(bodyHtml) {
  let h = bodyHtml;
  // Self-closing tags: <meta data-rh="true" .../>, <link data-rh="true" .../>
  h = h.replace(/<(?:meta|link|base)[^>]*data-rh="true"[^>]*\/?>/g, '');
  // Paired tags: <title data-rh="true">...</title>, <script data-rh="true">...</script>
  h = h.replace(/<(title|script|style|noscript)[^>]*data-rh="true"[^>]*>[\s\S]*?<\/\1>/g, '');
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
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "bestRating": "5",
          "ratingCount": "47",
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

  try {
    const ssrUrl = routePath.endsWith('/') ? routePath : `${routePath}/`;
    const { html: bodyHtml, helmet } = render(ssrUrl);

    // Inject the collected helmet context (title, meta, link) into <head>
    if (helmet) {
      html = injectHelmetToHead(html, helmet);
    }

    if (bodyHtml && bodyHtml.length > 0) {
      html = injectBody(html, bodyHtml);
    }
  } catch (e) {
    console.warn(`  ⚠ SSR failed for ${routePath}: ${e.message}`);
  }

  // JSON-LD: landing pages (/it/, /en/) get a full @graph; all other pages get none.
  const lang = routePath.startsWith('/en') ? 'en' : 'it';
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
