import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const publicDir = resolve(import.meta.dirname, "../dist/public");
const routes = [
  {
    path: "/it/",
    lang: "it",
    locale: "it_IT",
    title: "Gestione Pratiche per Studi e Agenzie",
    description: "Raccogli le richieste dei clienti",
    hero: ["Le richieste dei tuoi clienti,", "finalmente in ordine."],
    navigation: "Funzionalità",
    cta: "Inizia gratis — 7 giorni",
  },
  {
    path: "/en/",
    lang: "en",
    locale: "en_US",
    title: "Practice Management for Firms & Agencies",
    description: "Collect every client request in one place",
    hero: ["Your clients' requests,", "finally under control."],
    navigation: "Features",
    cta: "Start free — 7 days",
  },
];

for (const route of routes) {
  const filePath = resolve(publicDir, route.lang, "index.html");
  const html = readFileSync(filePath, "utf8");
  const document = new JSDOM(html).window.document;
  const bodyText = document.body.textContent ?? "";
  const heading = document.querySelector("h1")?.textContent ?? "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const ogLocale = document.querySelector('meta[property="og:locale"]')?.getAttribute("content");
  const jsonLdElement = document.querySelector('script[type="application/ld+json"]');

  assert.equal(document.documentElement.lang, route.lang, `${route.path} must set the HTML language`);
  assert.ok(document.title.includes(route.title), `${route.path} must have its localized title`);
  assert.ok(
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.includes(route.description),
    `${route.path} must have its localized description`,
  );
  assert.equal(canonical, `https://taskdesk.it${route.path}`, `${route.path} must have a matching canonical URL`);
  assert.equal(ogLocale, route.locale, `${route.path} must have its localized Open Graph locale`);
  assert.ok(heading.includes(route.hero[0]), `${route.path} must render its localized hero headline`);
  assert.ok(heading.includes(route.hero[1]), `${route.path} must render the complete localized hero headline`);
  assert.ok(bodyText.includes(route.navigation), `${route.path} must render localized navigation`);
  assert.ok(bodyText.includes(route.cta), `${route.path} must render its localized primary call to action`);
  assert.ok(jsonLdElement, `${route.path} must include structured data`);

  const jsonLd = JSON.parse(jsonLdElement.textContent ?? "");
  const website = jsonLd["@graph"]?.find((item) => item["@type"] === "WebSite");
  assert.equal(website?.inLanguage, route.lang, `${route.path} structured data must preserve the locale`);

  console.log(`✓ ${route.path} prerendered content and locale metadata`);
}
