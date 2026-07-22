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
    console.warn(`  ⚠ SSR body failed for ${routePath}: ${e.message}`);
  }

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
