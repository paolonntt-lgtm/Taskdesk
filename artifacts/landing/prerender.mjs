import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist/public');

function readTemplate() {
  return readFileSync(resolve(distDir, 'index.html'), 'utf-8');
}

function setMeta(html, opts) {
  let h = html;
  if (opts.lang) {
    h = h.replace(/<html lang="[^"]*"/, `<html lang="${opts.lang}"`);
  }
  if (opts.title) {
    h = h.replace(/<title>[^<]*<\/title>/, `<title>${opts.title}</title>`);
  }
  if (opts.description) {
    h = h.replace(/(<meta name="description" content=")[^"]*(")/,
      `$1${opts.description}$2`);
  }
  if (opts.robots) {
    h = h.replace(/(<meta name="robots" content=")[^"]*(")/,
      `$1${opts.robots}$2`);
  }
  if (opts.canonical) {
    h = h.replace(/(<link rel="canonical" href=")[^"]*(")/,
      `$1${opts.canonical}$2`);
  }
  if (opts.hreflangIt) {
    h = h.replace(/(<link rel="alternate" hreflang="it" href=")[^"]*(")/,
      `$1${opts.hreflangIt}$2`);
  }
  if (opts.hreflangEn) {
    h = h.replace(/(<link rel="alternate" hreflang="en" href=")[^"]*(")/,
      `$1${opts.hreflangEn}$2`);
  }
  if (opts.hreflangDefault) {
    h = h.replace(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/,
      `$1${opts.hreflangDefault}$2`);
  }
  if (opts.ogUrl) {
    h = h.replace(/(<meta property="og:url" content=")[^"]*(")/,
      `$1${opts.ogUrl}$2`);
  }
  if (opts.ogTitle) {
    h = h.replace(/(<meta property="og:title" content=")[^"]*(")/,
      `$1${opts.ogTitle}$2`);
    h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/,
      `$1${opts.ogTitle}$2`);
  }
  if (opts.ogDescription) {
    h = h.replace(/(<meta property="og:description" content=")[^"]*(")/,
      `$1${opts.ogDescription}$2`);
    h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/,
      `$1${opts.ogDescription}$2`);
  }
  if (opts.lang === 'en') {
    h = h.replace(/(<meta property="og:locale" content=")[^"]*(")/,
      `$1en_US$2`);
  }
  return h;
}

function injectBody(html, bodyHtml) {
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${bodyHtml}</div>`
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
  it: "TaskDesk è il sistema di gestione pratiche per studi commerciali, agenzie e consulenti. Raccogli le richieste dei clienti in un unico posto, assegnale al team e traccia ogni pratica fino alla chiusura. Da €35/mese + IVA.",
  en: "TaskDesk is the request management system for accounting firms, agencies and consultants. Collect every client request in one place, assign it to your team and track it to completion. From €35/month + VAT.",
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

async function writeRoute(routePath, metaOpts) {
  const cleanPath = routePath.replace(/^\//, '').replace(/\/$/, '');
  const dir = cleanPath ? resolve(distDir, cleanPath) : distDir;
  mkdirSync(dir, { recursive: true });

  const template = readTemplate();
  let html = setMeta(template, metaOpts);

  try {
    const ssrUrl = routePath.endsWith('/') ? routePath : `${routePath}/`;
    const { html: bodyHtml } = render(ssrUrl);

    if (bodyHtml && bodyHtml.length > 0) {
      html = injectBody(html, bodyHtml);
    }
  } catch (e) {
    console.warn(`  ⚠ SSR failed for ${routePath}: ${e.message}`);
  }

  // Replace all stale JSON-LD blocks with route-specific structured data.
  // Landing pages (/it/, /en/) get a full @graph; legal pages get none.
  const newJsonLd = metaOpts.lang && !metaOpts.robots
    ? generateLandingJsonLd(metaOpts.lang)
    : null;
  html = replaceJsonLd(html, newJsonLd);

  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ /${cleanPath || ''}/index.html`);
}

await writeRoute('/it/', {
  lang: 'it',
  title: 'TaskDesk — Software per Studi Commerciali e Agenzie | Da €35/mese + IVA',
  description: 'TaskDesk è il sistema di gestione pratiche per studi commerciali, agenzie e consulenti. Raccogli le richieste dei clienti in un unico posto, assegnale al team e traccia ogni pratica fino alla chiusura. Da €35/mese + IVA.',
  canonical: `${BASE}/it/`,
  ogTitle: 'TaskDesk — Software per Studi Commerciali e Agenzie | Da €35/mese + IVA',
  ogDescription: 'Gestisci le pratiche e le richieste dei tuoi clienti senza email disperse. Commenti, scadenze, soluzioni tracciate. Da €35/mese + IVA tutto incluso.',
  ogUrl: `${BASE}/it/`,
  hreflangIt: `${BASE}/it/`,
  hreflangEn: `${BASE}/en/`,
  hreflangDefault: `${BASE}/it/`,
});

await writeRoute('/en/', {
  lang: 'en',
  title: 'TaskDesk — Software for Accounting Firms & Agencies | From €35/month + VAT',
  description: 'TaskDesk is the request management system for accounting firms, agencies and consultants. Collect every client request in one place, assign it to your team and track it to completion. From €35/month + VAT.',
  canonical: `${BASE}/en/`,
  ogTitle: 'TaskDesk — Software for Accounting Firms & Agencies | From €35/month + VAT',
  ogDescription: 'Manage client requests and filings without scattered emails. Comments, deadlines, tracked solutions. From €35/month + VAT, all included.',
  ogUrl: `${BASE}/en/`,
  hreflangIt: `${BASE}/it/`,
  hreflangEn: `${BASE}/en/`,
  hreflangDefault: `${BASE}/it/`,
});

const legalPages = [
  {
    slug: 'privacy-policy',
    it: {
      title: 'Privacy Policy — TaskDesk',
      description: 'Informativa sul trattamento dei dati personali ai sensi del GDPR (Reg. UE 2016/679) per gli utenti di taskdesk.it.',
    },
    en: {
      title: 'Privacy Policy — TaskDesk',
      description: 'Privacy notice for the processing of personal data under GDPR (EU Regulation 2016/679) for taskdesk.it users.',
    },
  },
  {
    slug: 'terms',
    it: {
      title: 'Termini e Condizioni — TaskDesk',
      description: 'Termini e condizioni di utilizzo del servizio TaskDesk per studi commerciali, agenzie e consulenti.',
    },
    en: {
      title: 'Terms of Service — TaskDesk',
      description: 'Terms and conditions for using the TaskDesk service for accounting firms, agencies and consultants.',
    },
  },
  {
    slug: 'dpa',
    it: {
      title: 'Data Processing Agreement — TaskDesk',
      description: 'Accordo sul trattamento dei dati (DPA) tra TaskDesk e i propri clienti ai sensi del GDPR.',
    },
    en: {
      title: 'Data Processing Agreement — TaskDesk',
      description: 'Data Processing Agreement (DPA) between TaskDesk and its customers under GDPR.',
    },
  },
  {
    slug: 'cookie-policy',
    it: {
      title: 'Cookie Policy — TaskDesk',
      description: "Informativa sull'utilizzo dei cookie su taskdesk.it ai sensi della normativa europea in materia di privacy.",
    },
    en: {
      title: 'Cookie Policy — TaskDesk',
      description: 'Cookie policy for taskdesk.it under EU privacy regulations.',
    },
  },
];

for (const page of legalPages) {
  await writeRoute(`/it/${page.slug}`, {
    lang: 'it',
    title: page.it.title,
    description: page.it.description,
    canonical: `${BASE}/it/${page.slug}`,
    robots: 'noindex, follow',
    ogTitle: page.it.title,
    ogDescription: page.it.description,
    ogUrl: `${BASE}/it/${page.slug}`,
    hreflangIt: `${BASE}/it/${page.slug}`,
    hreflangEn: `${BASE}/en/${page.slug}`,
    hreflangDefault: `${BASE}/it/${page.slug}`,
  });

  await writeRoute(`/en/${page.slug}`, {
    lang: 'en',
    title: page.en.title,
    description: page.en.description,
    canonical: `${BASE}/en/${page.slug}`,
    robots: 'noindex, follow',
    ogTitle: page.en.title,
    ogDescription: page.en.description,
    ogUrl: `${BASE}/en/${page.slug}`,
    hreflangIt: `${BASE}/it/${page.slug}`,
    hreflangEn: `${BASE}/en/${page.slug}`,
    hreflangDefault: `${BASE}/it/${page.slug}`,
  });
}

console.log('Prerender complete.');
