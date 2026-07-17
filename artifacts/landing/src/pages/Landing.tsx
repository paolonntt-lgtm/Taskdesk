import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";
import { trackCta, trackScrollDepth, trackSectionView, type CtaLocation, type ScrollDepthPct } from "@/lib/analytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown } from "lucide-react";
import { InstallPrompt } from "@/components/InstallPrompt";

const SITE_BASE = "https://taskdesk.it";

const APP_URL = "/app/";

const ANIMATIONS = `
@keyframes ld-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ld-ticker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes ld-gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes ld-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
@keyframes ld-bubble-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ld-typing {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%           { transform: translateY(-4px); opacity: 1; }
}
.ld-fade-up   { animation: ld-fadeUp 0.65s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-1 { animation: ld-fadeUp 0.65s 0.10s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-2 { animation: ld-fadeUp 0.65s 0.20s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-3 { animation: ld-fadeUp 0.65s 0.35s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-4 { animation: ld-fadeUp 0.65s 0.50s cubic-bezier(.16,1,.3,1) both; }
.ld-ticker { animation: ld-ticker 30s linear infinite; }
.ld-gradient-text {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #2563eb);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ld-gradient-shift 5s ease infinite;
}
.ld-float { animation: ld-float 5s ease-in-out infinite; }
.ld-bubble-in { animation: ld-bubble-in 0.4s cubic-bezier(.16,1,.3,1) both; }
.ld-card-hover {
  transition: all 0.25s cubic-bezier(.16,1,.3,1);
}
.ld-card-hover:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(37,99,235,0.12);
}
.ld-dot {
  display: inline-block;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #94a3b8;
  animation: ld-typing 1.4s ease infinite;
}
.ld-dot:nth-child(2) { animation-delay: 0.2s; }
.ld-dot:nth-child(3) { animation-delay: 0.4s; }
`;

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ${delay}s cubic-bezier(.16,1,.3,1), transform 0.6s ${delay}s cubic-bezier(.16,1,.3,1)`,
      }}
    >
      {children}
    </div>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

function MentionPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-300 text-xs font-semibold text-gray-700 bg-white mx-0.5">
      @{name}
    </span>
  );
}

function TicketChatMockup({ lang }: { lang: "it" | "en" }) {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  const messages = lang === "it" ? [
    {
      author: "Carla M.", color: "bg-violet-500", initials: "CM",
      text: "Salve, ho bisogno della documentazione per la dichiarazione dei redditi. Mancano ancora le certificazioni uniche dell'anno scorso.",
      time: "10:12",
    },
    {
      author: "Sara L.", color: "bg-orange-500", initials: "SL",
      text: null, mention: "Luca B.",
      textBefore: "Ho preso in carico la pratica.",
      textAfter: "puoi recuperare le CU dal cassetto fiscale?",
      time: "10:18",
    },
    {
      author: "Luca B.", color: "bg-blue-600", initials: "LB",
      isSolution: true,
      text: "CU recuperate e allegate. Ho verificato tutto — i dati sono corretti. Pratica pronta per la compilazione della dichiarazione.",
      time: "10:31",
    },
    {
      author: "Carla M.", color: "bg-violet-500", initials: "CM",
      text: null, mention: "Sara L.",
      textBefore: "",
      textAfter: "Perfetto, grazie mille! Posso procedere con la firma?",
      time: "10:34",
      liked: true,
    },
  ] : [
    {
      author: "Carla M.", color: "bg-violet-500", initials: "CM",
      text: "Hi, I need the documentation for my tax return. I'm still missing last year's income certificates.",
      time: "10:12",
    },
    {
      author: "Sara L.", color: "bg-orange-500", initials: "SL",
      text: null, mention: "Luca B.",
      textBefore: "I've picked up the request.",
      textAfter: "can you pull the certificates from the tax portal?",
      time: "10:18",
    },
    {
      author: "Luca B.", color: "bg-blue-600", initials: "LB",
      isSolution: true,
      text: "Certificates retrieved and attached. I've checked everything — the data is correct. Request is ready for the tax return filing.",
      time: "10:31",
    },
    {
      author: "Carla M.", color: "bg-violet-500", initials: "CM",
      text: null, mention: "Sara L.",
      textBefore: "",
      textAfter: "Perfect, thank you! Can I go ahead and sign?",
      time: "10:34",
      liked: true,
    },
  ];

  useEffect(() => {
    if (visibleMessages >= messages.length) return;
    if (visibleMessages === 0) {
      const t = setTimeout(() => setVisibleMessages(1), 600);
      return () => clearTimeout(t);
    }
    setShowTyping(true);
    const t1 = setTimeout(() => {
      setShowTyping(false);
      setVisibleMessages(v => v + 1);
    }, 1400);
    return () => clearTimeout(t1);
  }, [visibleMessages]);

  const title = lang === "it"
    ? "#5 — Documenti mancanti per dichiarazione dei redditi"
    : "#5 — Missing documents for tax return filing";

  return (
    <div className="ld-float bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden" style={{ maxWidth: 380 }}>
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white">
        <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wide">
          {lang === "it" ? "Pratica" : "Request"}
        </div>
        <div className="font-bold text-gray-900 text-sm leading-snug mb-2">{title}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
            {lang === "it" ? "Risolta" : "Resolved"}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-orange-300 text-orange-700">
            {lang === "it" ? "Alta" : "High"}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 text-blue-600">
            {lang === "it" ? "Fiscale" : "Tax"}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 min-h-[280px]" style={{ background: "#f8faff" }}>
        {messages.slice(0, visibleMessages).map((m, i) => (
          <div
            key={i}
            className="ld-bubble-in flex gap-2.5"
            style={{ animationDelay: "0s" }}
          >
            <Avatar initials={m.initials} color={m.color} />
            <div className="flex-1 min-w-0">
              {m.isSolution && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-green-600 text-xs">✅</span>
                  <span className="text-xs font-bold text-green-700">{lang === "it" ? "Soluzione" : "Solution"}</span>
                </div>
              )}
              <div
                className={`rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-800 leading-snug ${
                  m.isSolution
                    ? "bg-green-50 border border-green-200"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                <span className="font-semibold text-gray-900 block mb-0.5 text-xs">{m.author}</span>
                {m.text ? (
                  <span>{m.text}</span>
                ) : (
                  <span>
                    {(m as any).textBefore}{(m as any).textBefore ? " " : ""}
                    <MentionPill name={(m as any).mention} />
                    {(m as any).textAfter ? " " + (m as any).textAfter : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-xs text-gray-400">{m.time}</span>
                <span className="text-xs text-gray-400 hover:text-blue-500 cursor-pointer">
                  {lang === "it" ? "Rispondi" : "Reply"}
                </span>
                {(m as any).liked ? (
                  <span className="text-xs font-bold text-blue-600">👍 1</span>
                ) : (
                  <span className="text-xs text-gray-300 hover:text-gray-500 cursor-pointer">👍</span>
                )}
                {m.isSolution ? (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                    ✓ {lang === "it" ? "Soluzione" : "Solution"}
                  </span>
                ) : (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border border-green-400 text-green-600 flex items-center gap-1 cursor-pointer">
                    ✓ {lang === "it" ? "Segna soluzione" : "Mark solved"}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {showTyping && (
          <div className="ld-bubble-in flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <span className="ld-dot" />
              <span className="ld-dot" />
              <span className="ld-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
          <span className="flex-1">{lang === "it" ? "Scrivi un commento…" : "Write a comment…"}</span>
          <span className="text-gray-300 text-base font-bold">B</span>
          <span className="text-gray-300 text-base italic">I</span>
          <span className="text-gray-300 text-xs font-mono">&lt;&gt;</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { lang, setLang, t } = useLanguage();

  const tickerItems = [
    t.hero.trialBadge, t.ticker.rating,
    t.ticker.setup, `💶 ${lang === "it" ? "Da" : "From"} ${t.pricing.price}${t.pricing.unit}`, t.ticker.gdpr,
    t.hero.trialBadge, t.ticker.rating,
    t.ticker.setup, `💶 ${lang === "it" ? "Da" : "From"} ${t.pricing.price}${t.pricing.unit}`, t.ticker.gdpr,
  ];

  const featureCards = [
    { icon: "✏️", color: "bg-blue-50 text-blue-600 border-blue-100",      title: t.features.items.creation.title,  desc: t.features.items.creation.desc },
    { icon: "💬", color: "bg-violet-50 text-violet-600 border-violet-100", title: t.features.items.history.title,   desc: t.features.items.history.desc },
    { icon: "✅", color: "bg-green-50 text-green-600 border-green-100",    title: t.features.items.solution.title,  desc: t.features.items.solution.desc },
    { icon: "📊", color: "bg-orange-50 text-orange-600 border-orange-100", title: t.features.items.stats.title,     desc: t.features.items.stats.desc },
  ];

  const handleCta = (location: CtaLocation, planName?: string) => {
    trackCta(location, planName);
    window.location.href = APP_URL;
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      (["utm_source", "utm_medium", "utm_campaign"] as const).forEach((key) => {
        const val = params.get(key);
        if (val) utm[key] = val;
      });
      if (Object.keys(utm).length > 0) {
        sessionStorage.setItem("td_utm", JSON.stringify(utm));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const thresholds: ScrollDepthPct[] = [25, 50, 75, 100];
    const fired = new Set<number>();

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = (scrolled / total) * 100;
      for (const th of thresholds) {
        if (pct >= th && !fired.has(th)) {
          fired.add(th);
          trackScrollDepth(th);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const sectionIds = ["who-uses", "pain", "testimonials", "how", "features", "pricing", "final-cta"];
    const viewed = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting && !viewed.has(id)) {
            viewed.add(id);
            trackSectionView(id);
          }
        }
      },
      { threshold: 0.3 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  const jsonLd = JSON.stringify({
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
        "description": t.seo.description,
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
        "mainEntity": t.faq.items.map((item) => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a,
          },
        })),
      },
    ],
  });

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden" style={{ fontFamily: "var(--app-font-sans, sans-serif)" }}>
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
        <meta property="og:url" content={`${SITE_BASE}/${lang}/`} />
        <meta property="og:title" content={t.seo.ogTitle} />
        <meta property="og:description" content={t.seo.ogDescription} />
        <meta property="og:image" content={`${SITE_BASE}/opengraph.jpg`} />
        <meta name="twitter:title" content={t.seo.twitterTitle} />
        <meta name="twitter:description" content={t.seo.twitterDescription} />
        <meta name="twitter:image" content={`${SITE_BASE}/opengraph.jpg`} />
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>
      <style>{ANIMATIONS}</style>

      {/* Ticker */}
      <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 py-2.5 overflow-hidden">
        <div className="ld-ticker flex gap-10 whitespace-nowrap">
          {tickerItems.map((item, i) => (
            <span key={i} className="text-xs font-bold text-white/90 shrink-0">{item}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/taskdesk-logo.png" alt="TaskDesk logo" width="120" height="32" className="h-8 w-auto" />
          </div>
          <nav aria-label="Menu principale" className="hidden md:flex gap-8 text-sm text-gray-500">
            <a href="#how" className="hover:text-gray-900 transition-colors font-medium">{lang === "it" ? "Come funziona" : "How it works"}</a>
            <a href="#features" className="hover:text-gray-900 transition-colors font-medium">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors font-medium">{t.nav.pricing}</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors font-medium">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-md hover:bg-gray-100">
                  {lang.toUpperCase()} <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28 min-w-0">
                <DropdownMenuItem onClick={() => setLang('it')} className={lang === 'it' ? 'bg-muted font-medium' : ''}>Italiano</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'bg-muted font-medium' : ''}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50 bg-white">
              {t.nav.login}
            </a>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 transition-colors">
              {t.hero.cta} →
            </a>
          </div>
        </div>
      </header>

      <main id="main-content">

        {/* ── Hero ── */}
        <section aria-label="Hero" className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #eff6ff 100%)" }}>
          <div className="absolute top-[-60px] right-[-60px] w-[450px] h-[450px] rounded-full border border-blue-100 opacity-50 pointer-events-none" />
          <div className="absolute bottom-[-40px] left-[-40px] w-[300px] h-[300px] rounded-full border border-violet-100 opacity-40 pointer-events-none" />

          <div className="max-w-6xl mx-auto px-6 md:px-8 py-20 lg:py-32 relative">
            <div className="grid lg:grid-cols-2 gap-14 items-center">

              {/* Left: copy */}
              <div>
                <div className="ld-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-8">
                  <span className="relative flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-blue-500" />
                  </span>
                  {t.hero.trialBadge} — {t.hero.trialNote}
                </div>

                <h1 className="ld-fade-up-1 text-5xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-6">
                  {t.hero.titleLine1}
                  <br />
                  <span className="ld-gradient-text">{t.hero.titleLine2}</span>
                </h1>

                <p className="ld-fade-up-2 text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
                  {t.hero.subtitle}
                </p>

                <div className="ld-fade-up-3 flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => handleCta("hero")}
                    className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 flex items-center justify-center gap-2"
                  >
                    {t.hero.cta} →
                  </button>
                  <a href="#how" className="px-8 py-4 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all text-center">
                    {t.hero.secondaryCta}
                  </a>
                </div>

                <div className="ld-fade-up-4 flex flex-col gap-2">
                  <div className="text-sm text-gray-400 font-medium">
                    {t.hero.microProof.split(" · ").map((item, i, arr) => (
                      <span key={i}>
                        <span className="text-green-500 font-bold">✓</span>{" "}{item}
                        {i < arr.length - 1 && <span className="mx-2 text-gray-200">·</span>}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 italic">{t.hero.reassurance}</p>
                </div>
              </div>

              {/* Right: animated chat mockup — desktop */}
              <div className="hidden lg:flex justify-end">
                <TicketChatMockup lang={lang} />
              </div>
            </div>

            {/* Chat mockup — mobile/tablet (below copy) */}
            <div className="lg:hidden flex justify-center mt-12">
              <TicketChatMockup lang={lang} />
            </div>
          </div>
        </section>

        {/* ── Chi usa TaskDesk ── */}
        <section id="who-uses" aria-label="Chi usa TaskDesk" className="py-24 px-6 md:px-8 border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 leading-tight">
                  {t.whoUses.title}
                </h2>
                <p className="text-gray-400 text-lg max-w-xl mx-auto">{t.whoUses.subtitle}</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.whoUses.profiles.map((profile, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <div className="ld-card-hover bg-white rounded-2xl border border-gray-100 p-8 h-full shadow-sm cursor-default">
                    <div className="text-4xl mb-4">{profile.icon}</div>
                    <h3 className="font-black text-xl mb-2 text-gray-900">{profile.title}</h3>
                    <p className="text-gray-700 font-medium mb-3 text-sm leading-relaxed">{profile.desc}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{profile.detail}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Il problema ── */}
        <section id="pain" aria-label="Il problema" className="py-24 px-6 md:px-8" style={{ background: "linear-gradient(135deg, #fef9f0 0%, #fdf4ff 100%)" }}>
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 leading-tight text-gray-900">
                  {t.pain.title}
                </h2>
                <p className="text-gray-500 text-lg max-w-xl mx-auto">{t.pain.subtitle}</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.pain.cards.map((card, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <div className="bg-white rounded-2xl border border-orange-100 p-7 h-full shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-2xl mb-5">
                      {card.icon}
                    </div>
                    <h3 className="font-bold text-base mb-2 text-gray-900">{card.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonial bar ── */}
        <section id="testimonials" aria-label="Testimonianze" className="py-20 px-6 md:px-8 border-y border-gray-100 bg-white">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="flex justify-center mb-10">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-50 border border-yellow-100 text-yellow-700 text-sm font-bold">
                  {t.testimonials.ratingLabel}
                </span>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.testimonials.items.map((item, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 p-7 h-full flex flex-col gap-5">
                    <p className="text-gray-700 text-sm leading-relaxed flex-1">
                      &ldquo;{item.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${item.color}`}>
                        {item.initials}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.role}</div>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" aria-label="Come funziona" className="py-28 px-6 md:px-8">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                  {lang === "it" ? (
                    <><span className="ld-gradient-text">3 passi.</span> Fine.</>
                  ) : (
                    <><span className="ld-gradient-text">3 steps.</span> Done.</>
                  )}
                </h2>
                <p className="text-gray-400 text-lg max-w-md mx-auto">
                  {lang === "it"
                    ? "Dal caos delle richieste alla pratica risolta — tutto tracciato."
                    : "From chaotic requests to resolved tasks — everything tracked."}
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="absolute top-10 left-[calc(16.6%+1rem)] right-[calc(16.6%+1rem)] h-0.5 bg-gradient-to-r from-blue-200 via-violet-200 to-green-200 hidden md:block pointer-events-none" />

              {t.howItWorks.steps.map((s, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <div className="relative flex flex-col items-center text-center">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mb-5 shadow-md z-10 relative ${
                      i === 0 ? "bg-blue-50 border-2 border-blue-200" :
                      i === 1 ? "bg-violet-50 border-2 border-violet-200" :
                                "bg-green-50 border-2 border-green-200"
                    }`}>
                      {s.icon}
                      <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-black text-white flex items-center justify-center ${
                        i === 0 ? "bg-blue-600" : i === 1 ? "bg-violet-600" : "bg-green-600"
                      }`}>{s.n}</span>
                    </div>
                    <h3 className="font-black text-xl mb-3 text-gray-900">{s.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-xs">{s.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.2}>
              <div className="text-center mt-14">
                <button
                  onClick={() => handleCta("how_it_works")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200"
                >
                  {t.howItWorks.cta} →
                </button>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" aria-label="Funzionalità" className="py-28 px-6 md:px-8 bg-gray-50 border-y border-gray-100">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                  {t.features.title.split(".")[0]}.
                  <br />
                  <span className="ld-gradient-text">{t.features.title.split(".")[1]?.trim()}</span>
                </h2>
                <p className="text-gray-400 text-lg max-w-lg mx-auto">{t.features.subtitle}</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {featureCards.map((f, i) => (
                <ScrollReveal key={i} delay={i * 0.08}>
                  <div className="ld-card-hover bg-white rounded-2xl border border-gray-100 p-8 h-full cursor-default shadow-sm">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl mb-6 ${f.color}`}>
                      {f.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-3 text-gray-900">{f.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.2}>
              <div className="text-center mt-14">
                <button
                  onClick={() => handleCta("features")}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200"
                >
                  {t.features.cta} →
                </button>
                <p className="text-sm text-gray-400 mt-3">{t.hero.microProof}</p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" aria-label="Prezzi" className="py-28 px-6 md:px-8">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-14 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-6">
                  🎁 {t.pricing.trialLabel}
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-3 leading-tight">{t.pricing.title}</h2>
                <p className="text-xl font-semibold text-blue-600 mb-3">{t.pricing.trialHeader}</p>
                <p className="text-lg text-gray-400">{t.pricing.subtitle}</p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.pricing.plans.map((plan, idx) => (
                <ScrollReveal key={plan.name} delay={idx * 0.06}>
                  <div className={`relative h-full bg-white rounded-2xl p-7 flex flex-col ld-card-hover ${
                    plan.highlight ? "border-2 border-blue-600 shadow-xl shadow-blue-100" : "border border-gray-100 shadow-sm"
                  }`}>
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-wide uppercase shadow-md">
                        {t.pricing.mostPopular}
                      </div>
                    )}
                    <div className="mb-4">
                      <div className="text-sm font-bold text-gray-400 tracking-wider uppercase mb-1">{plan.name}</div>
                      <p className="text-sm text-gray-500 leading-relaxed min-h-[40px]">{plan.desc}</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-5xl font-black text-gray-900">{plan.price}</span>
                      {!plan.noUnit && <span className="text-sm text-gray-400 font-medium">{t.pricing.perMonth}</span>}
                    </div>
                    <div className="text-xs font-semibold text-gray-500 mb-6">
                      {plan.seats === null ? t.pricing.seatsUnlimited : `${plan.seats} ${t.pricing.seatsSuffix}`}
                    </div>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleCta("pricing", plan.name)}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        plan.highlight
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100"
                          : "bg-gray-900 hover:bg-gray-800 text-white"
                      }`}
                    >
                      {plan.cta} →
                    </button>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.2}>
              <div className="mt-12 bg-white border border-gray-100 rounded-2xl p-8 md:p-10 shadow-sm">
                <div className="text-center mb-7">
                  <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-2">{t.pricing.includedTitle}</h3>
                  <p className="text-gray-500">{t.pricing.includedSubtitle}</p>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 max-w-4xl mx-auto">
                  {t.pricing.included.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="font-bold mt-0.5 shrink-0 text-blue-600">✓</span>
                      <span className="text-sm text-gray-700 leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" aria-label="Domande frequenti" className="py-28 px-6 md:px-8 bg-gray-50 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-16">{t.faq.title}</h2>
            </ScrollReveal>
            <Accordion type="single" collapsible className="w-full">
              {t.faq.items.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b border-gray-100 py-1">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline hover:text-blue-600 transition-colors text-left py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400 text-base leading-relaxed pb-6">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── CTA finale ── */}
        <section id="final-cta" aria-label="Inizia ora" className="py-28 px-6 md:px-8">
          <ScrollReveal>
            <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #1d4ed8, #7c3aed, #1d4ed8)" }}>
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
              <div className="relative p-12 md:p-16 text-center text-white">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                  {t.finalCta.headline}
                </h2>
                <p className="text-white/75 mb-10 text-lg max-w-lg mx-auto">{t.finalCta.sub}</p>
                <button onClick={() => handleCta("final")} className="px-10 py-5 rounded-xl bg-white text-blue-700 font-black text-lg hover:bg-blue-50 transition-all shadow-2xl inline-flex items-center gap-2">
                  {t.pricing.cta} →
                </button>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-white/60">
                  <span><span className="text-white/80 font-bold">✓</span> {t.finalCta.proof1}</span>
                  <span><span className="text-white/80 font-bold">✓</span> {t.finalCta.proof2}</span>
                  <span><span className="text-white/80 font-bold">✓</span> {t.finalCta.proof3}</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

      </main>

      <footer className="py-8 border-t border-gray-100 px-6 md:px-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center opacity-50">
              <img src="/taskdesk-logo.png" alt="TaskDesk" width="90" height="24" loading="lazy" className="h-6 w-auto" style={{ filter: 'grayscale(1)' }} />
            </div>
            <p className="text-sm text-gray-400">{t.footer.text}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 border-t border-gray-100">
            <Link href="/privacy-policy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/cookie-policy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cookie Policy</Link>
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Termini di Servizio</Link>
            <Link href="/dpa" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Data Processing Agreement</Link>
          </div>
        </div>
      </footer>
      <InstallPrompt />
    </div>
  );
}
