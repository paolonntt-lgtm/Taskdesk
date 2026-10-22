import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const publicDir = resolve(import.meta.dirname, "../dist/public");
function verifySocialPreview(document, lang, routePath) {
  const image = `https://taskdesk.it/${lang === "it" ? "opengraph-it.jpg" : "opengraph.jpg"}`;
  const alt = lang === "it"
    ? "TaskDesk — gestione pratiche e richieste clienti"
    : "TaskDesk — Ticket management software";
  for (const [selector, expected] of [
    ['meta[property="og:image"]', image],
    ['meta[name="twitter:image"]', image],
    ['meta[property="og:image:alt"]', alt],
    ['meta[name="twitter:image:alt"]', alt],
  ]) {
    const tags = document.head.querySelectorAll(selector);
    assert.equal(tags.length, 1, `${routePath} must have exactly one ${selector} in its initial head`);
    assert.equal(tags[0].content, expected, `${routePath} must localize ${selector}`);
    assert.equal(document.body.querySelectorAll(selector).length, 0, `${routePath} must not duplicate ${selector} in its body`);
  }
}

for (const slug of ["privacy-policy", "terms", "dpa", "cookie-policy"]) {
  const routePath = `/it/${slug}`;
  const document = new JSDOM(readFileSync(resolve(publicDir, "it", slug, "index.html"), "utf8")).window.document;
  verifySocialPreview(document, "it", routePath);
  console.log(`✓ ${routePath} Italian social preview`);
}
const errorDocument = new JSDOM(readFileSync(resolve(publicDir, "404/index.html"), "utf8")).window.document;
assert.equal(errorDocument.documentElement.lang, "en", "The shared English 404 must declare English");
assert.ok(errorDocument.body.textContent.includes("404 Page Not Found"));
assert.equal(errorDocument.querySelector('meta[name="robots"]')?.content, "noindex, nofollow");

function verifyPricingContrast(document, selector, routePath) {
  const cards = [...document.querySelectorAll(selector)];
  assert.ok(cards.length > 0, `${routePath} must render pricing cards`);
  for (const card of cards) {
    assert.equal(card.querySelectorAll(".text-gray-400").length, 0, `${routePath} pricing must not use low-contrast gray-400`);
    const price = card.querySelector(".text-5xl, .text-4xl");
    const hasBillingUnit = Boolean(price?.nextElementSibling);
    assert.equal(card.querySelectorAll(".text-gray-600").length, hasBillingUnit ? 3 : 1, `${routePath} plan name and any billing unit and VAT note must use darker gray`);
  }
}
const { PROFESSION_IDS, PROFESSION_SLUGS, getProfessionPageProps, PROFESSIONS } =
  await import("../dist/server/entry-server.js");
const routes = [
  {
    path: "/it/",
    lang: "it",
    locale: "it_IT",
    title: "Gestione Pratiche per Studi e Agenzie",
    description: "Raccogli le richieste dei clienti",
    hero: ["Ti è mai capitato di sapere che qualcuno ne aveva parlato,", "ma non ricordare dove?"],
    heroSituations: [
      "Un messaggio WhatsApp dimenticato",
      "Una richiesta senza responsabile",
      "Una soluzione che nessuno riesce più a trovare",
    ],
    navigation: "Il prodotto",
    cta: "Inizia gratis — 7 giorni",
    sections: [
      "Conversazioni semplici. Lavoro organizzato.",
      "Un problema risolto oggi non deve tornare un problema domani.",
      "TaskDesk si adatta al tuo lavoro.",
    ],
    memoryContent: [
      "Albert",
      "Le risposte di ieri, utili oggi.",
    ],
    mockupContent: [
      "#5 — Documenti mancanti per dichiarazione dei redditi",
      "Risolta",
      "Fiscale",
    ],
    removedExamples: [
      "Accesso non riuscito",
      "Preparare la demo",
      "Ritrova i ticket utili e riparti dalle soluzioni già trovate dal team.",
    ],
  },
  {
    path: "/en/",
    lang: "en",
    locale: "en_US",
    title: "Practice Management for Firms & Agencies",
    description: "Collect every client request in one place",
    hero: ["Have you ever known someone had mentioned something,", "but couldn’t remember where?"],
    heroSituations: [
      "A forgotten WhatsApp message",
      "A request with no owner",
      "A solution no one can find anymore",
    ],
    navigation: "Product",
    cta: "Start free — 7 days",
    sections: [
      "Simple conversations. Organized work.",
      "A problem solved today should not become tomorrow’s problem.",
      "TaskDesk adapts to the way you work.",
    ],
    memoryContent: [
      "Albert",
      "Yesterday’s answers, useful today.",
    ],
    mockupContent: [
      "#5 — Missing documents for tax return filing",
      "Resolved",
      "Tax",
    ],
    removedExamples: [
      "Unable to sign in",
      "Prepare the demo",
      "Find useful past tickets and build on solutions your team has already found.",
    ],
  },
];

for (const route of routes) {
  const filePath = resolve(publicDir, route.lang, "index.html");
  const html = readFileSync(filePath, "utf8");
  const document = new JSDOM(html).window.document;
  verifySocialPreview(document, route.lang, route.path);
  verifyPricingContrast(document, '[data-testid^="landing-plan-card-"]', route.path);
  const billingButtons = [...document.querySelectorAll("button[aria-pressed]")];
  assert.deepEqual(billingButtons.map((button) => button.getAttribute("aria-pressed")), ["true", "false"]);
  assert.ok(!html.includes("ld-ticker"), `${route.path} must not auto-scroll the promotional text`);
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
  for (const situation of route.heroSituations) {
    assert.ok(heading.includes(situation) || bodyText.includes(situation), `${route.path} must render hero situation "${situation}"`);
  }
  assert.ok(bodyText.includes(route.navigation), `${route.path} must render localized navigation`);
  assert.ok(bodyText.includes(route.cta), `${route.path} must render its localized primary call to action`);
  for (const sectionCopy of route.sections) {
    assert.ok(bodyText.includes(sectionCopy), `${route.path} must render "${sectionCopy}"`);
  }
  for (const memoryCopy of route.memoryContent) {
    assert.ok(bodyText.includes(memoryCopy), `${route.path} must render team-memory content "${memoryCopy}"`);
  }
  assert.equal(
    document.querySelectorAll('[data-testid="team-memory-albert-card"]').length,
    1,
    `${route.path} must render the Albert assistant card in the team-memory section`,
  );
  assert.ok(
    document.querySelector('[data-testid="team-memory-albert-card"] img')?.getAttribute("src")?.endsWith("albert-einstein-silhouette.png"),
    `${route.path} must show Albert's monochrome Einstein icon`,
  );
  for (const mockupCopy of route.mockupContent) {
    assert.ok(bodyText.includes(mockupCopy), `${route.path} must render the activity mockup detail "${mockupCopy}"`);
  }
  assert.equal(
    document.querySelectorAll('[data-testid="ticket-chat-mockup"]').length,
    1,
    `${route.path} must keep the activity chat mockup in the solution section`,
  );
  assert.equal(
    document.querySelectorAll('[data-testid="hero-unified-request-visual"]').length,
    2,
    `${route.path} must render the unified source visual for desktop and mobile in the hero`,
  );
  for (const removedExample of route.removedExamples) {
    assert.ok(!bodyText.includes(removedExample), `${route.path} must not render removed example "${removedExample}"`);
  }
  assert.deepEqual(
    [...document.querySelectorAll('[data-testid^="landing-plan-card-"]')].map((card) => card.getAttribute("data-testid")),
    ["landing-plan-card-starter", "landing-plan-card-team", "landing-plan-card-business"],
    `${route.path} must show exactly the three fixed-price plans`,
  );
  const professionCards = [...document.querySelectorAll('[data-testid^="link-profession-card-"]')];
  assert.equal(professionCards.length, 6, `${route.path} must render all six profession tiles`);
  assert.ok(
    professionCards[0]?.parentElement?.className.includes("sm:grid-cols-3"),
    `${route.path} must arrange the six profession tiles in three columns on wider screens`,
  );
  for (const card of professionCards) {
    assert.ok(card.querySelector('[data-testid="profession-mark"]'), `${route.path} profession tiles must include a mark`);
    const profession = card.getAttribute("data-testid").replace("link-profession-card-", "");
    const slug = PROFESSION_SLUGS[route.lang][profession];
    assert.ok(slug, `${route.path} profession tiles must reference a known profession`);
    assert.equal(
      card.getAttribute("href"),
      `/${route.lang}/${slug}`,
      `${route.path} must link directly to the localized public ${profession} page in initial HTML`,
    );
    assert.ok(card.textContent.trim(), `${route.path} profession links must have descriptive text`);
    assert.ok(
      readFileSync(resolve(publicDir, route.lang, slug, "index.html"), "utf8").includes('id="root"'),
      `${route.path} profession link destination must have prerendered HTML`,
    );
  }
  assert.equal(
    document.querySelector('[data-testid="link-profession-card-commercialisti"] img')?.getAttribute("src"),
    "/images/accountants-logo.webp",
    `${route.path} must use the supplied accountants mark`,
  );
  assert.equal(
    document.querySelector('[data-testid="link-profession-card-avvocati"] img')?.getAttribute("src"),
    "/images/lawyer-scales.webp",
    `${route.path} must use the supplied lawyers mark`,
  );
  assert.equal(
    document.querySelector('[data-testid="link-profession-card-consulenti-del-lavoro"] img')?.getAttribute("src"),
    "/images/labour-consultant-logo.webp",
    `${route.path} must use the supplied labour consultant mark`,
  );
  assert.ok(jsonLdElement, `${route.path} must include structured data`);

  const jsonLd = JSON.parse(jsonLdElement.textContent ?? "");
  const website = jsonLd["@graph"]?.find((item) => item["@type"] === "WebSite");
  assert.equal(website?.inLanguage, route.lang, `${route.path} structured data must preserve the locale`);
  const software = jsonLd["@graph"]?.find((item) => item["@type"] === "SoftwareApplication");
  assert.equal(software?.offers?.offerCount, "3", `${route.path} structured data must match the three visible plans`);
  assert.ok(
    !jsonLd["@graph"]?.some((item) => item["@type"] === "FAQPage"),
    `${route.path} must not publish removed FAQ content`,
  );

  console.log(`✓ ${route.path} prerendered content and locale metadata`);
}

for (const profession of PROFESSION_IDS) {
  const pageProps = getProfessionPageProps(profession);

  for (const lang of ["it", "en"]) {
    const slug = PROFESSION_SLUGS[lang][profession];
    const routePath = `/${lang}/${slug}`;
    const filePath = resolve(publicDir, lang, slug, "index.html");
    const html = readFileSync(filePath, "utf8");
    const document = new JSDOM(html).window.document;
    verifySocialPreview(document, lang, routePath);
    const bodyText = document.body.textContent ?? "";
    const pageCopy = PROFESSIONS[profession][lang];
    const otherLanguage = lang === "it" ? "en" : "it";
    const metadata = pageProps.metadata[lang];
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const description = document.querySelector('meta[name="description"]')?.getAttribute("content");
    const ogLocale = document.querySelector('meta[property="og:locale"]')?.getAttribute("content");
    const jsonLdElement = document.querySelector('script[type="application/ld+json"]');

    assert.equal(document.documentElement.lang, lang, `${routePath} must set the HTML language`);
    assert.equal(document.title, metadata.title, `${routePath} must have its localized title`);
    assert.equal(description, metadata.description, `${routePath} must have its localized description`);
    assert.equal(canonical, metadata.canonical, `${routePath} must have its matching canonical URL`);
    assert.equal(ogLocale, lang === "it" ? "it_IT" : "en_US", `${routePath} must have its localized Open Graph locale`);
    assert.equal(
      document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
      metadata.canonical,
      `${routePath} Open Graph URL must match its canonical URL`,
    );
    assert.equal(
      document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      metadata.title,
      `${routePath} must have its localized Open Graph title`,
    );
    assert.equal(
      document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
      metadata.description,
      `${routePath} must have its localized Open Graph description`,
    );
    assert.equal(
      document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
      metadata.title,
      `${routePath} must have its localized Twitter title`,
    );
    assert.equal(
      document.querySelector('meta[name="twitter:description"]')?.getAttribute("content"),
      metadata.description,
      `${routePath} must have its localized Twitter description`,
    );

    const alternateLinks = [...document.querySelectorAll('link[rel="alternate"][hreflang]')];
    const alternates = Object.fromEntries(
      alternateLinks.map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]),
    );
    assert.equal(alternateLinks.length, 3, `${routePath} must have exactly three hreflang links`);
    assert.deepEqual(
      alternates,
      {
        it: metadata.alternates.it,
        en: metadata.alternates.en,
        "x-default": metadata.alternates.xDefault,
      },
      `${routePath} must link to the matching Italian, English, and default routes`,
    );

    assert.equal(
      document.querySelector("h1")?.textContent?.trim(),
      pageCopy.headline,
      `${routePath} must render its localized profession headline`,
    );
    assert.ok(bodyText.includes(pageCopy.intro), `${routePath} must render its localized introduction`);
    assert.ok(bodyText.includes(pageCopy.workflowHeading), `${routePath} must render localized workflow content`);
    assert.ok(bodyText.includes(pageCopy.primaryCta), `${routePath} must render its localized call to action`);
    assert.ok(
      !bodyText.includes(PROFESSIONS[profession][otherLanguage].headline),
      `${routePath} must not render the other language's profession headline`,
    );

    assert.ok(jsonLdElement, `${routePath} must include structured data`);
    const jsonLd = JSON.parse(jsonLdElement.textContent ?? "");
    assert.equal(jsonLd["@type"], "WebPage", `${routePath} structured data must describe a web page`);
    assert.equal(jsonLd["@id"], `${metadata.canonical}#webpage`, `${routePath} structured data must use its canonical URL`);
    assert.equal(jsonLd.url, metadata.canonical, `${routePath} structured data URL must match its canonical URL`);
    assert.equal(jsonLd.name, metadata.title, `${routePath} structured data must use its localized title`);
    assert.equal(jsonLd.description, metadata.description, `${routePath} structured data must use its localized description`);
    assert.equal(jsonLd.inLanguage, lang, `${routePath} structured data must preserve the route language`);

    verifyPricingContrast(document, '[data-testid^="pricing-plan-"]', routePath);
    console.log(`✓ ${routePath} profession content and locale metadata`);
  }
}
