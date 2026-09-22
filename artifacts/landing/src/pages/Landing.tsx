import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileCheck2,
  FileText,
  Inbox,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import {
  trackBillingCycle,
  trackCta,
  trackFaqToggle,
  trackLanguageChange,
  trackScrollDepth,
  trackSectionView,
  type CtaLocation,
  type ScrollDepthPct,
} from "@/lib/analytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InstallPrompt } from "@/components/InstallPrompt";

const SITE_BASE = "https://taskdesk.it";
const APP_URL = "/app/";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: `opacity .7s ${delay}s cubic-bezier(.16,1,.3,1), transform .7s ${delay}s cubic-bezier(.16,1,.3,1)`,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "coral" }) {
  return (
    <div className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] ${tone === "coral" ? "text-[#b84b3d]" : "text-[#087f78]"}`}>
      <span className={`h-2 w-2 rounded-full ${tone === "coral" ? "bg-[#e66b5d]" : "bg-[#19a79a]"}`} />
      {children}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="TaskDesk">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#173047] text-[#f8cf53]">
        <span className="absolute h-3.5 w-3.5 rounded-[4px] border-[2px] border-current" />
        <span className="absolute right-[6px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#f8cf53]" />
      </div>
      {!compact && <span className="text-[18px] font-bold tracking-[-.04em] text-[#173047]">taskdesk</span>}
    </div>
  );
}

function Avatar({ initials, className }: { initials: string; className: string }) {
  return <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#173047] ${className}`}>{initials}</span>;
}

function WorkspacePreview({ lang }: { lang: "it" | "en" }) {
  const labels = lang === "it"
    ? { inbox: "Posta in arrivo", open: "Aperte", solved: "Risolte", title: "Documenti per dichiarazione", client: "Carla M.", priority: "Alta", assigned: "Assegnata a Luca B.", reply: "Risposta inviata", today: "Oggi, 10:31" }
    : { inbox: "Inbox", open: "Open", solved: "Solved", title: "Documents for tax return", client: "Carla M.", priority: "High", assigned: "Assigned to Luca B.", reply: "Reply sent", today: "Today, 10:31" };
  return (
    <div className="td-drift relative mx-auto w-full max-w-[570px]">
      <div className="absolute -inset-4 rounded-[2rem] bg-[#f8cf53]/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.4rem] border border-[#d7cdbd] bg-[#fffdf8] shadow-[0_28px_70px_rgba(23,48,71,.18)]">
        <div className="flex items-center gap-2 border-b border-[#e8dfd2] bg-[#f8f1e7] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e66b5d]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f8cf53]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#19a79a]" />
          <span className="ml-3 text-[10px] font-semibold tracking-[.12em] text-[#7a817e]">TASKDESK / WORKSPACE</span>
        </div>
        <div className="grid min-h-[370px] grid-cols-[150px_1fr]">
          <aside className="hidden border-r border-[#e8dfd2] bg-[#faf6ef] p-4 sm:block">
            <div className="mb-6 flex items-center gap-2 text-xs font-bold text-[#173047]"><Logo compact /> {labels.inbox}</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between rounded-lg bg-[#d9efea] px-2.5 py-2 font-bold text-[#087f78]"><span className="flex items-center gap-2"><Inbox size={13} /> {labels.open}</span><span>12</span></div>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#78817f]"><Clock3 size={13} /> In attesa</div>
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[#78817f]"><span className="flex items-center gap-2"><CircleCheck size={13} /> {labels.solved}</span><span>48</span></div>
            </div>
            <div className="mt-8 border-t border-[#e8dfd2] pt-4 text-[10px] font-bold uppercase tracking-[.14em] text-[#9a9d98]">Categorie</div>
            <div className="mt-3 space-y-3 text-[11px] text-[#69726f]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e66b5d]" /> Fiscale</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#19a79a]" /> Amministrazione</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#f0ad34]" /> Urgente</span></div>
          </aside>
          <div className="min-w-0">
            <div className="flex items-center justify-between border-b border-[#e8dfd2] px-4 py-3 sm:px-5">
              <div><div className="text-[10px] uppercase tracking-[.14em] text-[#9a9d98]">Pratica #1048</div><div className="mt-1 text-sm font-bold text-[#173047]">{labels.title}</div></div>
              <MoreHorizontal size={18} className="text-[#87908b]" />
            </div>
            <div className="flex items-center gap-2 border-b border-[#e8dfd2] px-4 py-3 text-[10px] sm:px-5">
              <span className="rounded-full bg-[#f8cf53]/30 px-2 py-1 font-bold text-[#8c6500]">{labels.priority}</span>
              <span className="rounded-full bg-[#d9efea] px-2 py-1 font-bold text-[#087f78]">{labels.assigned}</span>
              <span className="ml-auto text-[#8b918c]">Due 14 Jun</span>
            </div>
            <div className="space-y-4 bg-[#fffdf8] p-4 sm:p-5">
              <div className="flex gap-2.5"><Avatar initials="CM" className="bg-[#f7c8bb]" /><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between text-[10px]"><b className="text-[#173047]">{labels.client}</b><span className="text-[#9a9d98]">10:12</span></div><div className="td-corner border border-[#e8dfd2] bg-[#faf6ef] p-3 text-[11px] leading-relaxed text-[#53605e]">Salve, ho bisogno della documentazione per la dichiarazione dei redditi.</div></div></div>
              <div className="flex gap-2.5"><Avatar initials="SL" className="bg-[#f8cf53]" /><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between text-[10px]"><b className="text-[#173047]">Sara L.</b><span className="text-[#9a9d98]">10:18</span></div><div className="td-corner border border-[#bce3dc] bg-[#edf9f6] p-3 text-[11px] leading-relaxed text-[#53605e]">{labels.assigned}. Recuperi le CU dal cassetto fiscale?</div></div></div>
              <div className="flex gap-2.5"><Avatar initials="LB" className="bg-[#b9d9e9]" /><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between text-[10px]"><b className="text-[#173047]">Luca B.</b><span className="text-[#9a9d98]">{labels.today}</span></div><div className="td-corner border border-[#9dd6c9] bg-[#dff4ee] p-3 text-[11px] leading-relaxed text-[#355e5a]"><div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-[#087f78]"><CircleCheck size={12} /> {labels.reply}</div>CU recuperate e allegate. Ho verificato tutto: pratica pronta.</div></div></div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#e8dfd2] bg-[#faf6ef] px-4 py-3 text-[11px] text-[#9a9d98] sm:px-5"><Paperclip size={14} /><span className="flex-1">Scrivi un aggiornamento…</span><span className="rounded-md bg-[#173047] px-2 py-1 text-[10px] font-bold text-[#fffdf8]">Invia</span></div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl border border-[#d7cdbd] bg-[#fffdf8] px-3 py-2 text-[10px] font-bold text-[#087f78] shadow-lg sm:flex"><CircleCheck size={14} /> {labels.solved}</div>
    </div>
  );
}

export default function Landing() {
  const { lang, setLang, t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [mobileMenu, setMobileMenu] = useState(false);
  const handleLanguageChange = (next: "it" | "en") => {
    if (next !== lang) trackLanguageChange(next);
    setLang(next);
  };
  const handleCta = (location: CtaLocation, planName?: string) => {
    trackCta(location, planName);
    window.location.href = APP_URL;
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      (["utm_source", "utm_medium", "utm_campaign"] as const).forEach((key) => {
        const value = params.get(key);
        if (value) utm[key] = value;
      });
      if (Object.keys(utm).length) sessionStorage.setItem("td_utm", JSON.stringify(utm));
    } catch { /* storage can be unavailable */ }
  }, []);

  useEffect(() => {
    const thresholds: ScrollDepthPct[] = [25, 50, 75, 100];
    const fired = new Set<number>();
    const viewed = new Set<string>();
    const onScroll = () => {
      const percent = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
      thresholds.forEach((threshold) => {
        if (percent >= threshold && !fired.has(threshold)) {
          fired.add(threshold);
          trackScrollDepth(threshold);
        }
      });
    };
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const id = entry.target.id;
      if (entry.isIntersecting && id && !viewed.has(id)) {
        viewed.add(id);
        trackSectionView(id);
      }
    }), { threshold: 0.3 });
    ["who-uses", "pain", "testimonials", "how", "features", "pricing", "final-cta"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  const paidPlanPrices = t.pricing.plans.map((plan) => parseInt(plan.price.replace(/[^0-9]/g, ""), 10)).filter((price) => !Number.isNaN(price) && price > 0);
  const offerLowPrice = paidPlanPrices.length ? String(Math.min(...paidPlanPrices)) : "35";
  const offerHighPrice = paidPlanPrices.length ? String(Math.max(...paidPlanPrices)) : "100";
  const paidPlans = t.pricing.plans.filter((plan) => plan.seats !== null);
  const offerDescription = paidPlans.map((plan) => `${plan.name} ${plan.price}${plan.noUnit ? "" : t.pricing.perMonth} (${plan.seats} ${t.pricing.seatsSuffix})`).join(", ") + (lang === "it" ? ", Enterprise su preventivo." : ", Enterprise on request.");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_BASE}/#website`, name: "TaskDesk", url: SITE_BASE, inLanguage: lang },
      { "@type": "Organization", "@id": `${SITE_BASE}/#organization`, name: "TaskDesk", url: SITE_BASE, logo: `${SITE_BASE}/taskdesk-logo.png`, sameAs: ["https://www.linkedin.com/company/taskdesk", "https://twitter.com/taskdesk"] },
      { "@type": "SoftwareApplication", "@id": `${SITE_BASE}/#software`, name: "TaskDesk", url: SITE_BASE, applicationCategory: "BusinessApplication", operatingSystem: "Web, iOS, Android", description: t.seo.description, offers: { "@type": "AggregateOffer", lowPrice: offerLowPrice, highPrice: offerHighPrice, priceCurrency: "EUR", offerCount: String(t.pricing.plans.length), description: offerDescription } },
      { "@type": "FAQPage", "@id": `${SITE_BASE}/${lang}/#faq`, mainEntity: t.faq.items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
    ],
  });
  const socialImage = `${SITE_BASE}/${lang === "it" ? "opengraph-it.jpg" : "opengraph.jpg"}`;

  const featureRows = [
    { icon: FileText, title: t.features.items.creation.title, desc: t.features.items.creation.desc, tint: "bg-[#dff4ee]" },
    { icon: Clock3, title: t.features.items.priority.title, desc: t.features.items.priority.desc, tint: "bg-[#fff1c7]" },
    { icon: MessageSquare, title: t.features.items.history.title, desc: t.features.items.history.desc, tint: "bg-[#f9ddd7]" },
    { icon: CircleCheck, title: t.features.items.solution.title, desc: t.features.items.solution.desc, tint: "bg-[#dcebf4]" },
  ];

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f6f0e5] text-[#173047]" style={{ fontFamily: "var(--app-font-sans)" }}>
      <Helmet>
        <html lang={lang} />
        <title>{t.seo.title}</title>
        <meta name="description" content={t.seo.description} />
        <meta name="keywords" content={t.seo.keywords} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${SITE_BASE}/${lang}/`} />
        <link rel="alternate" hrefLang="it" href={`${SITE_BASE}/it/`} />
        <link rel="alternate" hrefLang="en" href={`${SITE_BASE}/en/`} />
        <link rel="alternate" hrefLang="x-default" href={`${SITE_BASE}/it/`} />
        <link rel="manifest" href={`/${lang}/manifest.webmanifest`} />
        <meta property="og:url" content={`${SITE_BASE}/${lang}/`} />
        <meta property="og:locale" content={lang === "en" ? "en_US" : "it_IT"} />
        <meta property="og:title" content={t.seo.ogTitle} />
        <meta property="og:description" content={t.seo.ogDescription} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={lang === "it" ? "TaskDesk — gestione pratiche e richieste clienti" : "TaskDesk — ticket management software"} />
        <meta name="twitter:title" content={t.seo.twitterTitle} />
        <meta name="twitter:description" content={t.seo.twitterDescription} />
        <meta name="twitter:image" content={socialImage} />
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>

      <div className="overflow-hidden border-b border-[#29445b] bg-[#173047] text-[#f6f0e5]">
        <div className="td-marquee flex w-max items-center gap-9 py-2 text-[10px] font-bold uppercase tracking-[.17em]">
          {[t.ticker.rating.replace(/^.[ ]*/, ""), t.ticker.setup.replace(/^.[ ]*/, ""), t.ticker.trial.replace(/^.[ ]*/, ""), t.ticker.gdpr.replace(/^.[ ]*/, ""), t.ticker.rating.replace(/^.[ ]*/, ""), t.ticker.setup.replace(/^.[ ]*/, ""), t.ticker.trial.replace(/^.[ ]*/, ""), t.ticker.gdpr.replace(/^.[ ]*/, "")].map((item, index) => <span key={index} className="flex items-center gap-3 whitespace-nowrap"><i className="h-1.5 w-1.5 rounded-full bg-[#f8cf53]" />{item}</span>)}
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#ddd2c3] bg-[#f6f0e5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <a href="#main-content" className="td-focus-ring"><Logo /></a>
          <nav aria-label={t.landmarks.mainNavigation} className="hidden items-center gap-7 text-[13px] font-semibold text-[#61716f] lg:flex">
            <a href="#how" className="td-focus-ring transition-colors hover:text-[#087f78]">{lang === "it" ? "Come funziona" : "How it works"}</a>
            <a href="#features" className="td-focus-ring transition-colors hover:text-[#087f78]">{t.nav.features}</a>
            <a href="#pricing" className="td-focus-ring transition-colors hover:text-[#087f78]">{t.nav.pricing}</a>
            <a href="#faq" className="td-focus-ring transition-colors hover:text-[#087f78]">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="td-focus-ring flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-bold text-[#61716f] hover:bg-[#ebe2d5]">{lang.toUpperCase()} <ChevronDown size={13} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[#d7cdbd] bg-[#fffdf8]">
                <DropdownMenuItem onClick={() => handleLanguageChange("it")} className={lang === "it" ? "bg-[#dff4ee] font-bold" : ""}>Italiano</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLanguageChange("en")} className={lang === "en" ? "bg-[#dff4ee] font-bold" : ""}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="hidden rounded-lg px-3 py-2 text-[12px] font-bold text-[#173047] transition-colors hover:bg-[#ebe2d5] sm:inline-flex">{t.nav.login}</a>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e66b5d] px-4 py-2.5 text-[12px] font-bold text-[#fff9ef] transition-all hover:-translate-y-0.5 hover:bg-[#c95649]">{t.hero.cta} <ArrowUpRight size={14} /></a>
            <button type="button" aria-label="Menu" onClick={() => setMobileMenu((open) => !open)} className="td-focus-ring rounded-lg p-2 lg:hidden">{mobileMenu ? <X size={18} /> : <LayoutGrid size={18} />}</button>
          </div>
        </div>
        {mobileMenu && <div className="border-t border-[#ddd2c3] bg-[#f6f0e5] px-5 py-4 lg:hidden"><nav className="flex flex-col gap-1 text-sm font-semibold"><a onClick={() => setMobileMenu(false)} href="#how" className="rounded-lg px-3 py-3 hover:bg-[#ebe2d5]">Come funziona</a><a onClick={() => setMobileMenu(false)} href="#features" className="rounded-lg px-3 py-3 hover:bg-[#ebe2d5]">{t.nav.features}</a><a onClick={() => setMobileMenu(false)} href="#pricing" className="rounded-lg px-3 py-3 hover:bg-[#ebe2d5]">{t.nav.pricing}</a><a onClick={() => setMobileMenu(false)} href="#faq" className="rounded-lg px-3 py-3 hover:bg-[#ebe2d5]">{t.nav.faq}</a></nav></div>}
      </header>

      <main id="main-content">
        <section aria-label={t.landmarks.hero} className="relative overflow-hidden border-b border-[#ddd2c3]">
          <div className="absolute inset-0 td-grid opacity-40" />
          <div className="absolute -right-40 -top-36 h-[580px] w-[580px] rounded-full border border-[#d7cdbd] bg-[#f8cf53]/20" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 md:px-8 md:pt-24 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:gap-16 lg:pb-28">
            <div>
              <div className="td-rise mb-8 inline-flex items-center gap-2 rounded-full border border-[#b9d8d0] bg-[#e7f6f1] px-3 py-1.5 text-[11px] font-bold text-[#087f78]"><Sparkles size={13} /> {t.hero.trialBadge} <span className="font-normal text-[#5a807a]">/ {t.hero.trialNote}</span></div>
              <h1 className="td-rise td-delay-1 max-w-[620px] font-serif text-[clamp(3.2rem,7vw,6.5rem)] leading-[.94] tracking-[-.065em] text-[#173047]">{t.hero.titleLine1}<br /><em className="not-italic text-[#087f78]">{t.hero.titleLine2}</em></h1>
              <p className="td-rise td-delay-2 mt-8 max-w-[510px] text-[17px] leading-[1.65] text-[#5f6e6c]">{t.hero.subtitle}</p>
              <div className="td-rise td-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => handleCta("hero")} className="td-focus-ring group inline-flex items-center justify-center gap-2 rounded-lg bg-[#e66b5d] px-6 py-3.5 text-sm font-bold text-[#fff9ef] shadow-[5px_6px_0_#b84b3d] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_4px_0_#b84b3d]">{t.hero.cta} <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
                <a href="#how" className="td-focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-[#cfc3b3] bg-[#fffdf8]/70 px-6 py-3.5 text-sm font-bold text-[#173047] transition-colors hover:bg-[#fffdf8]">{t.hero.secondaryCta} <ArrowDownRight size={16} /></a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#7a8580]">{t.hero.microProof.split(" · ").map((proof) => <span key={proof} className="flex items-center gap-1.5"><Check size={13} className="text-[#087f78]" />{proof}</span>)}</div>
            </div>
            <div className="relative pt-4 lg:pt-0"><WorkspacePreview lang={lang} /><div className="absolute -right-2 top-0 hidden rounded-lg border border-[#d7cdbd] bg-[#fffdf8] px-3 py-2 text-[10px] font-bold text-[#61716f] shadow-md sm:block"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#19a79a]" /> Live workspace</div></div>
          </div>
        </section>

        <section id="who-uses" aria-label={t.landmarks.whoUses} className="border-b border-[#ddd2c3] bg-[#fffdf8] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-end"><div><SectionLabel>{lang === "it" ? "Per chi è" : "Made for"}</SectionLabel><h2 className="mt-5 max-w-md font-serif text-4xl leading-[1.04] tracking-[-.045em] md:text-5xl">{t.whoUses.title}</h2></div><p className="max-w-md text-[16px] leading-7 text-[#667370]">{t.whoUses.subtitle}</p></div></Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">{t.whoUses.profiles.map((profile, index) => { const Icon = [BriefcaseBusiness, Sparkles, Users][index] ?? BriefcaseBusiness; return <Reveal key={profile.title} delay={index * .08}><article className="group h-full border-t-2 border-[#173047] py-6 transition-transform hover:-translate-y-1"><div className="mb-10 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8cf53]/35 text-[#173047]"><Icon size={19} /></span><span className="font-mono text-[11px] text-[#a0a39d]">0{index + 1}</span></div><h3 className="text-xl font-bold tracking-[-.03em]">{profile.title}</h3><p className="mt-3 text-sm font-semibold leading-6 text-[#52615e]">{profile.desc}</p><p className="mt-3 text-sm leading-6 text-[#89908b]">{profile.detail}</p></article></Reveal>; })}</div>
          </div>
        </section>

        <section id="pain" aria-label={t.landmarks.problem} className="bg-[#173047] px-5 py-20 text-[#f6f0e5] md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="grid gap-7 md:grid-cols-[1.1fr_.9fr] md:items-end"><div><SectionLabel tone="coral">{lang === "it" ? "Il punto di rottura" : "The breaking point"}</SectionLabel><h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.02] tracking-[-.045em] md:text-6xl">{t.pain.title}</h2></div><p className="max-w-sm text-[15px] leading-7 text-[#b7c2bd]">{t.pain.subtitle}</p></div></Reveal>
            <div className="mt-16 grid gap-px overflow-hidden border border-[#476070] bg-[#476070] md:grid-cols-3">{t.pain.cards.map((card, index) => { const Icon = [Inbox, Clock3, Search][index] ?? Inbox; return <Reveal key={card.title} delay={index * .08}><article className="h-full bg-[#173047] p-7 transition-colors hover:bg-[#21425a] md:p-9"><div className="mb-16 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f8cf53] text-[#173047]"><Icon size={18} /></div><h3 className="max-w-[220px] text-lg font-bold leading-tight">{card.title}</h3><p className="mt-4 text-sm leading-6 text-[#afbfba]">{card.desc}</p></article></Reveal>; })}</div>
          </div>
        </section>

        <section id="testimonials" aria-label={t.landmarks.testimonials} className="border-b border-[#ddd2c3] bg-[#f6f0e5] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="flex flex-col justify-between gap-5 border-b border-[#d7cdbd] pb-8 md:flex-row md:items-end"><div><SectionLabel>{lang === "it" ? "Voci dal lavoro vero" : "From the work floor"}</SectionLabel><h2 className="mt-4 font-serif text-4xl tracking-[-.045em] md:text-5xl">{lang === "it" ? "Meno rincorse. Più lavoro fatto." : "Less chasing. More done."}</h2></div><span className="text-sm font-bold text-[#087f78]">{t.testimonials.ratingLabel.replace(/^.[ ]*/, "")}</span></div></Reveal>
            <div className="mt-10 grid gap-8 md:grid-cols-3">{t.testimonials.items.map((item, index) => <Reveal key={item.name} delay={index * .08}><figure className="flex h-full flex-col justify-between"><blockquote className="font-serif text-[21px] leading-[1.25] tracking-[-.02em] text-[#314b5b]">“{item.text}”</blockquote><figcaption className="mt-8 flex items-center gap-3"><Avatar initials={item.initials} className={index === 0 ? "bg-[#f7c8bb]" : index === 1 ? "bg-[#b9d9e9]" : "bg-[#c9e5b7]"} /><span><strong className="block text-sm">{item.name}</strong><span className="block text-xs text-[#818b86]">{item.role}</span></span></figcaption></figure></Reveal>)}</div>
          </div>
        </section>

        <section id="how" aria-label={t.landmarks.howItWorks} className="border-b border-[#ddd2c3] bg-[#fffdf8] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="grid gap-8 md:grid-cols-[.75fr_1.25fr]"><div><SectionLabel>{lang === "it" ? "Il metodo" : "The method"}</SectionLabel><h2 className="mt-5 max-w-sm font-serif text-5xl leading-[.98] tracking-[-.06em]">{lang === "it" ? <>Da richiesta<br /><span className="text-[#087f78]">a risolta.</span></> : <>From request<br /><span className="text-[#087f78]">to resolved.</span></>}</h2></div><p className="max-w-md self-end text-[16px] leading-7 text-[#667370]">{lang === "it" ? "Un flusso corto e leggibile: ogni richiesta trova la persona giusta, il contesto giusto e una fine chiara." : "A short, readable flow: every request finds the right person, the right context and a clear finish."}</p></div></Reveal>
            <div className="mt-16 grid gap-10 md:grid-cols-3">{t.howItWorks.steps.map((step, index) => { const Icon = [Plus, MessageSquare, FileCheck2][index] ?? Plus; return <Reveal key={step.title} delay={index * .1}><article className="relative border-t border-[#d7cdbd] pt-5"><div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-[#e66b5d]">0{step.n}</span><Icon size={20} className="text-[#087f78]" /></div><h3 className="mt-12 text-xl font-bold tracking-[-.03em]">{step.title}</h3><p className="mt-3 text-sm leading-6 text-[#7a8580]">{step.desc}</p></article></Reveal>; })}</div>
            <Reveal delay={.2}><button type="button" onClick={() => handleCta("how_it_works")} className="td-focus-ring mt-12 inline-flex items-center gap-2 rounded-lg bg-[#173047] px-5 py-3 text-sm font-bold text-[#fffdf8] transition-colors hover:bg-[#087f78]">{t.howItWorks.cta} <ArrowUpRight size={15} /></button></Reveal>
          </div>
        </section>

        <section id="features" aria-label={t.landmarks.features} className="border-b border-[#ddd2c3] bg-[#e8f3ef] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><SectionLabel>{lang === "it" ? "Dentro TaskDesk" : "Inside TaskDesk"}</SectionLabel><h2 className="mt-5 max-w-xl font-serif text-5xl leading-[.98] tracking-[-.055em]">{t.features.title}</h2></div><p className="max-w-sm text-[15px] leading-7 text-[#5d716c]">{t.features.subtitle}</p></div></Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-2">{featureRows.map(({ icon: Icon, title, desc, tint }, index) => <Reveal key={title} delay={index * .07}><article className="group flex gap-5 border border-[#c8ddd6] bg-[#fffdf8]/70 p-6 transition-all hover:-translate-y-1 hover:bg-[#fffdf8] md:p-8"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tint} text-[#173047]`}><Icon size={19} /></span><div><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#71807b]">{desc}</p></div><ArrowUpRight size={16} className="ml-auto shrink-0 text-[#9cac9f] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" /></article></Reveal>)}</div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.25fr_.75fr]"><Reveal delay={.1}><article className="td-ink-shadow h-full bg-[#173047] p-7 text-[#f6f0e5] md:p-9"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f8cf53] text-[#173047]"><LayoutGrid size={19} /></span><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#93aaa8]">Reports / 30d</span></div><h3 className="mt-12 text-2xl font-bold">{t.features.items.stats.title}</h3><p className="mt-3 max-w-md text-sm leading-6 text-[#b7c2bd]">{t.features.items.stats.desc}</p><div className="mt-8 flex h-20 items-end gap-2 border-b border-[#476070]">{[34, 46, 40, 67, 54, 79, 62, 88, 71, 96, 82, 100].map((height, index) => <span key={index} style={{ height: `${height}%` }} className={`flex-1 rounded-t-sm ${index > 8 ? "bg-[#f8cf53]" : "bg-[#4b8d91]"}`} />)}</div></article></Reveal><Reveal delay={.16}><article className="h-full border border-[#c8ddd6] bg-[#fffdf8] p-7 md:p-9"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f9ddd7] text-[#b84b3d]"><ShieldCheck size={19} /></span><h3 className="mt-12 text-2xl font-bold">{t.features.items.roles.title}</h3><p className="mt-3 text-sm leading-6 text-[#71807b]">{t.features.items.roles.desc}</p><div className="mt-7 space-y-2 text-xs font-bold text-[#52615e]"><span className="flex items-center gap-2"><Check size={14} className="text-[#087f78]" /> {t.features.items.multi.title}</span><span className="flex items-center gap-2"><Check size={14} className="text-[#087f78]" /> {t.features.items.fast.title}</span></div></article></Reveal></div>
            <Reveal delay={.2}><div className="mt-12 flex flex-wrap items-center gap-5"><button type="button" onClick={() => handleCta("features")} className="td-focus-ring inline-flex items-center gap-2 rounded-lg bg-[#e66b5d] px-5 py-3 text-sm font-bold text-[#fffdf8] hover:bg-[#c95649]">{t.features.cta} <ArrowUpRight size={15} /></button><span className="text-xs font-bold uppercase tracking-[.1em] text-[#68817b]">{t.hero.microProof}</span></div></Reveal>
          </div>
        </section>

        <section id="pricing" aria-label={t.landmarks.pricing} className="bg-[#f6f0e5] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-7xl"><Reveal><div className="max-w-2xl"><SectionLabel tone="coral">{t.pricing.launchBadge}</SectionLabel><h2 className="mt-5 font-serif text-5xl leading-[.98] tracking-[-.055em] md:text-6xl">{t.pricing.title}</h2><p className="mt-5 text-[16px] leading-7 text-[#667370]">{t.pricing.subtitle}</p></div></Reveal>
            <div className="mt-10 flex flex-wrap items-center gap-5 border-y border-[#d7cdbd] py-4"><div className="inline-flex rounded-lg border border-[#cfc3b3] bg-[#fffdf8] p-1"><button type="button" onClick={() => { trackBillingCycle("monthly"); setBillingCycle("monthly"); }} className={`rounded-md px-4 py-2 text-xs font-bold ${billingCycle === "monthly" ? "bg-[#173047] text-[#fffdf8]" : "text-[#75817c]"}`}>{t.pricing.billingMonthly}</button><button type="button" onClick={() => { trackBillingCycle("annual"); setBillingCycle("annual"); }} className={`rounded-md px-4 py-2 text-xs font-bold ${billingCycle === "annual" ? "bg-[#173047] text-[#fffdf8]" : "text-[#75817c]"}`}>{t.pricing.billingAnnual}</button></div><span className="text-xs font-bold text-[#087f78]">{t.pricing.annualSavings} · {t.pricing.trialLabel}</span></div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{t.pricing.plans.map((plan, index) => <Reveal key={plan.name} delay={index * .07}><article className={`relative flex h-full min-h-[350px] flex-col border p-6 ${plan.highlight ? "border-[#e66b5d] bg-[#fffdf8] td-ink-shadow" : "border-[#d7cdbd] bg-[#fffdf8]/60"}`}>{plan.highlight && <span className="absolute -top-3 left-5 rounded-full bg-[#e66b5d] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#fffdf8]">{t.pricing.mostPopular}</span>}<span className="text-xs font-bold uppercase tracking-[.16em] text-[#7d8882]">{plan.name}</span><p className="mt-4 min-h-[48px] text-sm leading-6 text-[#65736f]">{plan.desc}</p><div className="mt-6 flex items-baseline gap-1"><strong className="font-serif text-5xl tracking-[-.07em]">{billingCycle === "annual" ? plan.annualPrice : plan.price}</strong>{!plan.noUnit && <span className="text-xs text-[#7d8882]">{billingCycle === "annual" ? t.pricing.perYear : t.pricing.perMonth}</span>}</div>{billingCycle === "annual" && !plan.noUnit && plan.annualMonthly && <span className="mt-1 text-xs font-bold text-[#087f78]">{plan.annualMonthly}</span>}<div className="mt-2 text-xs text-[#7d8882]">{!plan.noUnit && t.pricing.vatNote}{!plan.hideSeats && <><br />{plan.seats === null ? t.pricing.seatsUnlimited : `${plan.seats} ${t.pricing.seatsSuffix}`}</>}</div><div className="flex-1" /><button type="button" onClick={() => handleCta("pricing", plan.name)} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold ${plan.highlight ? "bg-[#e66b5d] text-[#fffdf8] hover:bg-[#c95649]" : "bg-[#173047] text-[#fffdf8] hover:bg-[#087f78]"}`}>{plan.cta} <ArrowUpRight size={14} /></button></article></Reveal>)}</div>
            <Reveal delay={.15}><div className="mt-5 grid gap-5 border border-[#d7cdbd] bg-[#fffdf8] p-6 md:grid-cols-[.7fr_1.3fr] md:p-8"><div><h3 className="text-lg font-bold">{t.pricing.includedTitle}</h3><p className="mt-2 text-sm text-[#77827e]">{t.pricing.includedSubtitle}</p></div><ul className="grid gap-3 sm:grid-cols-2">{t.pricing.included.map((item) => <li key={item} className="flex gap-2 text-sm text-[#52615e]"><Check size={15} className="mt-0.5 shrink-0 text-[#087f78]" />{item}</li>)}</ul></div></Reveal>
          </div>
        </section>

        <section id="faq" aria-label={t.landmarks.faq} className="border-t border-[#ddd2c3] bg-[#fffdf8] px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-4xl"><Reveal><div className="mb-12 flex items-end justify-between gap-5"><div><SectionLabel>{lang === "it" ? "Chiarezza prima di tutto" : "Clarity first"}</SectionLabel><h2 className="mt-5 font-serif text-5xl tracking-[-.055em]">{t.faq.title}</h2></div><FileCheck2 className="hidden text-[#e66b5d] sm:block" size={38} /></div></Reveal><Accordion type="single" collapsible className="w-full" onValueChange={(value) => trackFaqToggle(Boolean(value))}>{t.faq.items.map((item, index) => <AccordionItem key={item.q} value={`item-${index}`} className="border-b border-[#d7cdbd] py-1"><AccordionTrigger className="td-focus-ring py-5 text-left text-base font-bold text-[#173047] hover:no-underline hover:text-[#087f78]">{item.q}</AccordionTrigger><AccordionContent className="max-w-3xl pb-6 text-sm leading-7 text-[#687671]">{item.a}</AccordionContent></AccordionItem>)}</Accordion></div>
        </section>

        <section id="final-cta" aria-label={t.landmarks.finalCta} className="bg-[#e8f3ef] px-5 py-20 md:px-8 md:py-28">
          <Reveal><div className="relative mx-auto max-w-7xl overflow-hidden bg-[#173047] px-7 py-14 text-[#f6f0e5] md:px-16 md:py-20"><div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border border-[#4b707c]" /><div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full border border-[#4b707c]" /><div className="relative max-w-2xl"><SectionLabel tone="coral">{lang === "it" ? "Il prossimo passo" : "The next step"}</SectionLabel><h2 className="mt-5 font-serif text-5xl leading-[.98] tracking-[-.055em] md:text-7xl">{t.finalCta.headline}</h2><p className="mt-6 max-w-lg text-[16px] leading-7 text-[#b7c2bd]">{t.finalCta.sub}</p><button type="button" onClick={() => handleCta("final")} className="td-focus-ring mt-9 inline-flex items-center gap-2 rounded-lg bg-[#f8cf53] px-6 py-3.5 text-sm font-bold text-[#173047] hover:bg-[#ffe18a]">{t.pricing.cta} <ArrowUpRight size={16} /></button><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#aebfba]"><span className="flex items-center gap-1.5"><Check size={13} className="text-[#f8cf53]" />{t.finalCta.proof1}</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[#f8cf53]" />{t.finalCta.proof2}</span><span className="flex items-center gap-1.5"><Check size={13} className="text-[#f8cf53]" />{t.finalCta.proof3}</span></div></div></div></Reveal>
        </section>
      </main>

      <footer className="border-t border-[#d7cdbd] bg-[#f6f0e5] px-5 pb-24 pt-10 md:px-8 md:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-center"><Logo /><p className="max-w-md text-xs leading-5 text-[#7b8580]">{t.footer.text}</p></div><div className="td-rule" /><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#7b8580]"><Link href="/privacy-policy" className="hover:text-[#087f78]">Privacy Policy</Link><Link href="/cookie-policy" className="hover:text-[#087f78]">Cookie Policy</Link><button type="button" onClick={() => window.dispatchEvent(new Event("td-open-cookie-settings"))} className="hover:text-[#087f78]">{lang === "it" ? "Preferenze cookie" : "Cookie preferences"}</button><Link href="/terms" className="hover:text-[#087f78]">{t.footer.terms}</Link><Link href="/dpa" className="hover:text-[#087f78]">Data Processing Agreement</Link></div></div>
      </footer>
      <InstallPrompt />
    </div>
  );
}