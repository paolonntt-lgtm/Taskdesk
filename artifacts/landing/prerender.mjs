import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

function writeRoute(path, html) {
  const cleanPath = path.replace(/^\//, '').replace(/\/$/, '');
  const dir = cleanPath ? resolve(distDir, cleanPath) : distDir;
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
  console.log(`  ✓ /${cleanPath}/index.html`);
}

function writeRedirect(path, target) {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <link rel="canonical" href="https://taskdesk.it${target}" />
  <meta http-equiv="refresh" content="0; url=${target}" />
  <script>window.location.replace("${target}");</script>
</head>
<body></body>
</html>`;
  const cleanPath = path.replace(/^\//, '');
  const dir = resolve(distDir, cleanPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8');
  console.log(`  ↪ /${cleanPath} → ${target}`);
}

const BASE = 'https://taskdesk.it';

console.log('Prerendering routes...');
const template = readTemplate();

writeRoute('/it/', setMeta(template, {
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
}));

writeRoute('/en/', setMeta(template, {
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
}));

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
  writeRoute(`/it/${page.slug}`, setMeta(template, {
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
  }));

  writeRoute(`/en/${page.slug}`, setMeta(template, {
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
  }));

  writeRedirect(`/${page.slug}`, `/it/${page.slug}`);
}

console.log('Prerender complete.');
