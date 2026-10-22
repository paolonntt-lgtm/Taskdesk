import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowUpRight, Check, Clock3, ClipboardList, MessagesSquare } from "lucide-react";
import { useLanguage } from "@/i18n";
import { PROFESSIONS, type ProfessionId, type ProfessionLanguage } from "../profession-content";
import { trackProfessionalTrialCta, type ProfessionalCampaign } from "../lib/analytics";

export interface ProfessionSeoMetadata {
  title: string;
  description: string;
  canonical: string;
  alternates: {
    it: string;
    en: string;
    xDefault: string;
  };
}

export interface ProfessionRouteSet {
  home: string;
  professions: Record<ProfessionId, string>;
}

export interface ProfessionLandingProps {
  profession: ProfessionId;
  metadata: Record<ProfessionLanguage, ProfessionSeoMetadata>;
  routes: Record<ProfessionLanguage, ProfessionRouteSet>;
  campaign?: ProfessionalCampaign;
}

const APP_URL = "/app/";

export function ProfessionLanding({
  profession,
  metadata,
  routes,
  campaign = "unattributed",
}: ProfessionLandingProps) {
  const { lang, t } = useLanguage();
  const [, navigate] = useLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const copy = PROFESSIONS[profession][lang];
  const signupUrl = `${APP_URL}?trial_profession=${encodeURIComponent(profession)}&trial_language=${encodeURIComponent(lang)}`;
  const campaignQuery = campaign === "unattributed" ? "" : `?utm_campaign=${campaign}`;
  const currentMetadata = metadata[lang];
  const currentRoutes = routes[lang];
  const socialImage = `https://taskdesk.it/${lang === "it" ? "opengraph-it.jpg" : "opengraph.jpg"}`;
  const socialImageAlt = lang === "it"
    ? "TaskDesk — gestione pratiche e richieste clienti"
    : "TaskDesk — Ticket management software";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${currentMetadata.canonical}#webpage`,
    url: currentMetadata.canonical,
    name: currentMetadata.title,
    description: currentMetadata.description,
    inLanguage: lang,
    about: {
      "@type": "Thing",
      name: copy.name,
    },
    mentions: {
      "@type": "SoftwareApplication",
      "@id": "https://taskdesk.it/#software",
      name: "TaskDesk",
      url: "https://taskdesk.it",
    },
  };
  const relatedProfessions = (Object.keys(PROFESSIONS) as ProfessionId[]).filter((id) => id !== profession);
  const otherLabel = (id: ProfessionId) => PROFESSIONS[id][lang].navLabel;
  const changeLanguage = () => {
    const nextLang: ProfessionLanguage = lang === "it" ? "en" : "it";
    try {
      localStorage.setItem("td_landing_lang", nextLang);
    } catch {
      // Ignore storage errors; route navigation still changes the page language.
    }
    const currentSearch = typeof window === "undefined" ? "" : window.location.search;
    navigate(`${routes[nextLang].professions[profession]}${currentSearch}`);
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-white text-gray-900" style={{ fontFamily: "var(--app-font-sans, sans-serif)" }}>
      <Helmet>
        <html lang={lang} />
        <title>{currentMetadata.title}</title>
        <meta name="description" content={currentMetadata.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={currentMetadata.canonical} />
        <link rel="alternate" hrefLang="it" href={currentMetadata.alternates.it} />
        <link rel="alternate" hrefLang="en" href={currentMetadata.alternates.en} />
        <link rel="alternate" hrefLang="x-default" href={currentMetadata.alternates.xDefault} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentMetadata.canonical} />
        <meta property="og:locale" content={lang === "it" ? "it_IT" : "en_US"} />
        <meta property="og:title" content={currentMetadata.title} />
        <meta property="og:description" content={currentMetadata.description} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={socialImageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={currentMetadata.title} />
        <meta name="twitter:description" content={currentMetadata.description} />
        <meta name="twitter:image" content={socialImage} />
        <meta name="twitter:image:alt" content={socialImageAlt} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
          <Link href={currentRoutes.home} className="inline-flex shrink-0 items-center" aria-label={copy.homeLink}>
            <img src="/taskdesk-logo.webp" alt="TaskDesk" width="120" height="32" className="h-8 w-auto" />
          </Link>
          <nav aria-label={lang === "it" ? "Navigazione principale" : "Main navigation"} className="hidden items-center gap-7 text-sm font-medium text-gray-500 md:flex">
            <a href="#workflow" className="transition-colors hover:text-gray-950">{copy.workflowHeading}</a>
            <a href="#examples" className="transition-colors hover:text-gray-950">{copy.examplesHeading}</a>
            <a href="#pricing" className="transition-colors hover:text-gray-950">{t.nav.pricing}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={changeLanguage}
              className="rounded-lg px-2.5 py-2 text-xs font-bold tracking-wide text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              aria-label={lang === "it" ? "Switch language to English" : "Cambia lingua in italiano"}
              data-testid="button-language"
            >
              {lang === "it" ? "EN" : "IT"}
            </button>
            <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "navbar", campaign)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" data-testid="link-profession-hero-cta">
              <span className="hidden sm:inline">{copy.primaryCta}</span><span className="sm:hidden">{lang === "it" ? "Inizia" : "Get started"}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section aria-labelledby="profession-title" className="relative isolate overflow-hidden border-b border-gray-100 bg-[#f8fafc]">
          <div aria-hidden="true" className="absolute -right-28 -top-32 -z-10 h-[28rem] w-[28rem] rounded-full bg-blue-100/70 blur-3xl" />
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8 md:py-24">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.13em] text-blue-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                {copy.eyebrow}
              </p>
              <h1 id="profession-title" className="max-w-[14ch] text-4xl font-black leading-[1.08] tracking-[-0.045em] text-gray-950 sm:text-5xl md:text-6xl">
                {copy.headline}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 md:text-lg md:leading-8">{copy.intro}</p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "hero", campaign)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" data-testid="link-profession-primary-cta">
                  {copy.primaryCta}<ArrowRight aria-hidden="true" className="h-4 w-4" />
                </a>
                <span className="max-w-xs text-sm leading-5 text-gray-500">{copy.reassurance}</span>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-gray-200 pt-5 text-xs font-semibold text-gray-500">
                <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-blue-600" />{lang === "it" ? "Attivazione semplice" : "Straightforward setup"}</span>
                <span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4 text-blue-600" />{lang === "it" ? "Team e clienti nello stesso flusso" : "Clients and team in one workflow"}</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md md:ml-auto">
              <div aria-hidden="true" className="absolute -inset-4 -rotate-2 rounded-[2rem] border border-blue-100 bg-blue-50/50" />
              <article className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-7">
                <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-600">{lang === "it" ? "Richiesta in lavorazione" : "Request in progress"}</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">{copy.examples[0].title}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">{lang === "it" ? "In attesa" : "Waiting"}</span>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardList aria-hidden="true" className="h-4 w-4" /></span>
                    <div><p className="text-xs font-semibold text-gray-600">{lang === "it" ? "Prossimo passaggio" : "Next step"}</p><p className="mt-1 text-sm font-semibold text-gray-800">{copy.examples[0].description}</p></div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600"><Clock3 aria-hidden="true" className="h-4 w-4 text-blue-600" />{lang === "it" ? "Data prevista" : "Target date"}</span>
                    <span className="text-xs font-bold text-gray-800">{lang === "it" ? "Questa settimana" : "This week"}</span>
                  </div>
                  <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf0fa] text-xs font-black text-blue-800">{lang === "it" ? "ST" : "TM"}</span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-bold text-gray-800">{lang === "it" ? "Team dello studio" : "Practice team"}</p><p className="text-xs text-gray-600">{lang === "it" ? "Responsabile assegnato" : "Assigned owner"}</p></div>
                    <MessagesSquare aria-hidden="true" className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <p className="mt-5 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-600">{lang === "it" ? "Un esempio illustrativo dell’organizzazione del lavoro in TaskDesk." : "An illustrative example of organising work in TaskDesk."}</p>
              </article>
              <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{lang === "it" ? "Tutto collegato" : "Connected context"}</p>
                <p className="mt-1 text-xs font-bold text-gray-800">{lang === "it" ? "Richiesta · team · conversazione" : "Request · team · conversation"}</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="use-cases-title" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-700">{copy.name}</p>
              <h2 id="use-cases-title" className="text-3xl font-black leading-tight tracking-[-0.035em] text-gray-950 md:text-4xl">{copy.useCasesHeading}</h2>
              <p className="mt-4 text-base leading-7 text-gray-500">{copy.useCasesIntro}</p>
            </div>
            <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
              {copy.useCases.map((item, index) => (
                <article key={item.title} className="border-t-2 border-blue-600 pt-5" data-testid={`use-case-${index}`}>
                  <p className="font-mono text-xs font-bold tracking-wide text-blue-700">0{index + 1}</p>
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-gray-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-500">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" aria-labelledby="examples-title" className="border-y border-gray-100 bg-gray-50 px-5 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-11 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-700">{lang === "it" ? "Esempi di lavoro" : "Work examples"}</p>
                <h2 id="examples-title" className="text-3xl font-black leading-tight tracking-[-0.035em] text-gray-950 md:text-4xl">{copy.examplesHeading}</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-gray-500">{copy.examplesIntro}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {copy.examples.map((item, index) => (
                <article key={item.title} className="group flex min-h-56 flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60" data-testid={`example-${index}`}>
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{item.tag}</span>
                    <span className="font-mono text-xs text-gray-300">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold leading-snug text-gray-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-500">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" aria-labelledby="workflow-title" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[0.8fr_1.2fr] md:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-700">{lang === "it" ? "Il flusso" : "The workflow"}</p>
              <h2 id="workflow-title" className="text-3xl font-black leading-tight tracking-[-0.035em] text-gray-950 md:text-4xl">{copy.workflowHeading}</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-gray-500">{copy.messageBody}</p>
              <p className="mt-7 border-l-2 border-blue-600 pl-4 text-xs leading-5 text-gray-600">{copy.boundaryNote}</p>
            </div>
            <ol className="space-y-3">
              {copy.workflowSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-5 rounded-xl border border-gray-100 bg-[#fbfcfe] p-5 sm:p-6" data-testid={`workflow-step-${index + 1}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${index === 1 ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>0{index + 1}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-800 sm:text-base">{step}</span>
                  {index < copy.workflowSteps.length - 1 && <ArrowRight aria-hidden="true" className="ml-auto hidden h-4 w-4 shrink-0 text-gray-300 sm:block" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="message-title" className="bg-[#13233f] px-5 py-16 text-white md:px-8 md:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-200">{lang === "it" ? "Contesto condiviso" : "Shared context"}</p>
              <h2 id="message-title" className="text-3xl font-black leading-tight tracking-[-0.035em] md:text-4xl">{copy.messageHeading}</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100/75 md:text-base">{copy.messageBody}</p>
            </div>
            <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "message", campaign)} className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#13233f] transition-colors hover:bg-blue-50 md:self-center" data-testid="link-profession-message-cta">
              {copy.primaryCta}<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-700">{lang === "it" ? "Prezzi TaskDesk" : "TaskDesk pricing"}</p>
              <h2 id="pricing-title" className="text-3xl font-black leading-tight tracking-[-0.035em] text-gray-950 md:text-4xl">{copy.pricingHeading}</h2>
              <p className="mt-4 text-base leading-7 text-gray-500">{copy.pricingIntro}</p>
            </div>
            <div className="mb-9 flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1" role="group" aria-label={lang === "it" ? "Ciclo di fatturazione" : "Billing cycle"}>
                <button type="button" aria-pressed={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")} className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${billingCycle === "monthly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`} data-testid="button-billing-monthly">{t.pricing.billingMonthly}</button>
                <button type="button" aria-pressed={billingCycle === "annual"} onClick={() => setBillingCycle("annual")} className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${billingCycle === "annual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`} data-testid="button-billing-annual">{t.pricing.billingAnnual}</button>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {t.pricing.plans.map((plan, index) => (
                <article key={plan.name} className={`relative flex flex-col rounded-2xl bg-white p-6 ${plan.highlight ? "border-2 border-blue-600 shadow-xl shadow-blue-100" : "border border-gray-200 shadow-sm"}`} data-testid={`pricing-plan-${index}`}>
                  {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{t.pricing.mostPopular}</span>}
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-600">{plan.name}</p>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-gray-500">{plan.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight text-gray-950">{billingCycle === "annual" ? plan.annualPrice : plan.price}</span>
                    {!plan.noUnit && <span className="text-xs font-medium text-gray-600">{billingCycle === "annual" ? t.pricing.perYear : t.pricing.perMonth}</span>}
                  </div>
                  {billingCycle === "annual" && !plan.noUnit && plan.annualMonthly && <p className="mt-1 text-xs font-semibold text-emerald-700">{plan.annualMonthly}</p>}
                  {!plan.noUnit && <p className="mt-1 text-[11px] text-gray-600">{t.pricing.vatNote}</p>}
                  {!plan.hideSeats && <p className="mt-3 text-xs font-semibold text-gray-500">{plan.seats === null ? t.pricing.seatsUnlimited : `${plan.seats} ${t.pricing.seatsSuffix}`}</p>}
                  {plan.maxAddon > 0 && <p className="mt-2 text-xs font-medium text-blue-700">+ {t.pricing.addonLabel} (max {plan.maxAddon})</p>}
                  <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "pricing", campaign)} className={`mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-900 text-white hover:bg-gray-800"}`} data-testid={`link-plan-cta-${index}`}>
                    {plan.cta}<ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-black tracking-tight text-gray-900">{t.pricing.includedTitle}</h3>
                <p className="mt-2 text-sm text-gray-500">{t.pricing.includedSubtitle}</p>
              </div>
              <ul className="mx-auto grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {t.pricing.included.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-gray-600"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{feature}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="related-title" className="border-t border-gray-100 bg-[#f8fafc] px-5 py-16 md:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 id="related-title" className="text-xl font-black tracking-tight text-gray-900">{copy.relatedHeading}</h2>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {relatedProfessions.map((id) => (
                <Link key={id} href={`${currentRoutes.professions[id]}${campaignQuery}`} className="inline-flex items-center justify-between gap-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-200 hover:text-blue-700" data-testid={`link-profession-${id}`}>
                  {otherLabel(id)}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                </Link>
              ))}
              <Link href={currentRoutes.home} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50" data-testid="link-general-landing">
                {copy.homeLink}<ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="final-cta-title" className="px-5 py-16 md:px-8 md:py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 rounded-2xl bg-blue-600 p-7 text-white md:flex-row md:items-center md:p-10">
            <div className="max-w-2xl">
              <h2 id="final-cta-title" className="text-2xl font-black tracking-tight md:text-3xl">{copy.finalHeading}</h2>
              <p className="mt-3 text-sm leading-6 text-blue-100 md:text-base">{copy.finalBody}</p>
            </div>
            <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "final", campaign)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50" data-testid="link-profession-final-cta">
              {copy.primaryCta}<ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 px-5 py-7 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href={currentRoutes.home} className="text-sm font-bold tracking-tight text-gray-700">TaskDesk</Link>
          <p className="text-center text-xs text-gray-600">{copy.boundaryNote}</p>
          <a href={signupUrl} onClick={() => trackProfessionalTrialCta(profession, lang, "footer", campaign)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">{copy.primaryCta}</a>
        </div>
      </footer>
    </div>
  );
}

export default ProfessionLanding;
