import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";
import {
  trackBillingCycle,
  trackCta,
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
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  FileText,
  Mail,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PROFESSION_SLUGS } from "@/profession-routes";
import { ProfessionEntryDialog } from "@/components/ProfessionEntryDialog";
import { ProfessionMark } from "@/components/ProfessionMark";

const SITE_BASE = "https://taskdesk.it";
const WHATSAPP_NUMBER = "393203177882";

const APP_URL = "/app/";

const ANIMATIONS = `
@keyframes ld-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ld-gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
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
.ld-gradient-text {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #2563eb);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ld-gradient-shift 5s ease infinite;
}
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

function ScrollReveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
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

export function WorkStatistic() {
  const { t } = useLanguage();

  return (
    <ScrollReveal className="mb-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-3xl border border-blue-100 bg-white px-6 py-7 text-center shadow-sm sm:px-9 md:flex-row md:gap-8 md:px-10 md:py-8 md:text-left">
        <div className="shrink-0 text-5xl font-black leading-none tracking-tight text-blue-600 sm:text-6xl">
          48%
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-relaxed text-gray-900 sm:text-lg">
            {t.workStatistic.statement}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {t.workStatistic.survey}{" "}
            <a
              href="https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {t.workStatistic.source}
            </a>
          </p>
        </div>
      </div>
    </ScrollReveal>
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
    <div data-testid="ticket-chat-mockup" className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden" style={{ maxWidth: 380 }}>
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

function HeroSourceCard({
  icon: Icon,
  source,
  title,
  note,
  iconClass,
  className,
}: {
  icon: LucideIcon;
  source: string;
  title: string;
  note: string;
  iconClass: string;
  className: string;
}) {
  return (
    <div
      data-testid={`hero-source-${source.toLowerCase()}`}
      className={`absolute z-10 w-[178px] rounded-2xl border border-white bg-white/95 p-3.5 shadow-[0_12px_34px_#24324a14] ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${iconClass}`}>
          <Icon aria-hidden="true" size={14} />
        </span>
        <span className="text-[11px] font-bold text-gray-600">{source}</span>
      </div>
      <p className="text-xs font-semibold leading-snug text-gray-800">{title}</p>
      <p className="mt-1 text-[10px] leading-snug text-gray-400">{note}</p>
    </div>
  );
}

function UnifiedRequestVisual({ lang }: { lang: "it" | "en" }) {
  const copy = lang === "it"
    ? {
        accessibleLabel: "Messaggi WhatsApp, email e appunti riuniti in una pratica TaskDesk",
        whatsappTitle: "«Mi ricordi a che punto siamo?»",
        whatsappNote: "Messaggio di ieri · 10:12",
        emailTitle: "Documenti per la dichiarazione",
        emailNote: "Da Carla M. · ieri",
        noteTitle: "Manca la CU dell’anno scorso",
        noteNote: "Nota presa al telefono",
        organized: "Tutto al suo posto",
        practice: "Pratica #5",
        practiceTitle: "Documenti per la dichiarazione",
        assigned: "In carico",
        sources: "fonti riunite",
      }
    : {
        accessibleLabel: "WhatsApp messages, emails, and notes brought together in one TaskDesk request",
        whatsappTitle: "“Can you remind me where we are?”",
        whatsappNote: "Message from yesterday · 10:12",
        emailTitle: "Documents for the tax return",
        emailNote: "From Carla M. · yesterday",
        noteTitle: "Last year’s income certificate is missing",
        noteNote: "Note from a phone call",
        organized: "Everything in one place",
        practice: "Request #5",
        practiceTitle: "Documents for the tax return",
        assigned: "Assigned",
        sources: "sources brought together",
      };

  return (
    <div
      data-testid="hero-unified-request-visual"
      role="img"
      aria-label={copy.accessibleLabel}
      className="relative h-[460px] w-full max-w-[490px]"
    >
      <div className="absolute inset-[5%] rounded-full border border-blue-100/80" aria-hidden="true" />
      <div className="absolute inset-[15%] rounded-full border border-violet-100/70" aria-hidden="true" />
      <div className="absolute left-[25%] top-[15%] h-[280px] w-[280px] rounded-full bg-blue-100/70 blur-3xl" aria-hidden="true" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 490 460" fill="none" aria-hidden="true">
        <path d="M102 116 C112 205 171 253 226 303" stroke="#93B4FA" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M388 66 C378 178 322 247 272 303" stroke="#A99AF2" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M90 256 C143 267 185 281 225 310" stroke="#86C9AE" strokeWidth="2" strokeDasharray="5 7" />
        <circle cx="226" cy="303" r="5" fill="#2563EB" />
        <circle cx="272" cy="303" r="5" fill="#7C3AED" />
      </svg>

      <HeroSourceCard
        icon={MessageCircle}
        source="WhatsApp"
        title={copy.whatsappTitle}
        note={copy.whatsappNote}
        iconClass="bg-green-50 text-green-600"
        className="left-0 top-[58px] rotate-[-4deg]"
      />
      <HeroSourceCard
        icon={Mail}
        source="Email"
        title={copy.emailTitle}
        note={copy.emailNote}
        iconClass="bg-blue-50 text-blue-600"
        className="right-0 top-[20px] rotate-[3deg]"
      />
      <HeroSourceCard
        icon={FileText}
        source={lang === "it" ? "Appunto" : "Note"}
        title={copy.noteTitle}
        note={copy.noteNote}
        iconClass="bg-amber-50 text-amber-600"
        className="left-[9px] top-[218px] rotate-[3deg]"
      />

      <div className="absolute bottom-[18px] left-1/2 z-20 w-[min(340px,88%)] -translate-x-1/2 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_22px_60px_#2855a71f]">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-blue-500">{copy.organized}</div>
            <div className="text-sm font-bold text-gray-900">{copy.practice}</div>
            <div className="mt-1 text-xs text-gray-500">{copy.practiceTitle}</div>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">{copy.assigned}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex -space-x-2" aria-hidden="true">
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-500 text-[9px] font-bold text-white">CM</span>
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-600 text-[9px] font-bold text-white">LB</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
            <span className="text-blue-500">3</span> {copy.sources}
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white">
            <CheckCircle2 aria-hidden="true" size={14} strokeWidth={2.5} />
          </span>
        </div>
      </div>
      <div className="absolute bottom-[142px] left-1/2 z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-blue-100 bg-white text-blue-500 shadow-sm" aria-hidden="true">
        <ArrowDown size={15} />
      </div>
    </div>
  );
}

export default function Landing() {
  const { lang, setLang, t } = useLanguage();
  const [professionDialogOpen, setProfessionDialogOpen] = useState(false);
  const handleLanguageChange = (next: "it" | "en") => {
    if (next !== lang) trackLanguageChange(next);
    setLang(next);
  };

  const tickerItems = [
    t.hero.trialBadge,
    t.ticker.setup, `💶 ${lang === "it" ? "Da" : "From"} ${t.pricing.price}${t.pricing.unit}`, t.ticker.gdpr,
  ];

  const handleCta = (location: CtaLocation, planName?: string) => {
    trackCta(location, planName);
    window.location.href = APP_URL;
  };

  const whatsappMessage = lang === "it"
    ? "Ciao, vorrei saperne di più su TaskDesk."
    : "Hi, I'd like to know more about TaskDesk.";
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
  const whatsappLabel = lang === "it" ? "Scrivimi su WhatsApp" : "Message me on WhatsApp";

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

    const sectionIds = ["pain", "solution", "team-memory", "who-uses", "pricing"];
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

  const paidPlanPrices = t.pricing.plans
    .map((p) => parseInt(p.price.replace(/[^0-9]/g, ""), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const offerLowPrice = paidPlanPrices.length > 0 ? String(Math.min(...paidPlanPrices)) : "35";
  const offerHighPrice = paidPlanPrices.length > 0 ? String(Math.max(...paidPlanPrices)) : "100";

  const paidPlans = t.pricing.plans.filter((p) => {
    const monthlyAmount = Number.parseInt(p.price.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(monthlyAmount) && monthlyAmount > 0;
  });
  const offerDescription =
    paidPlans
      .map((p) => `${p.name} ${p.price}${p.noUnit ? "" : t.pricing.perMonth} (${p.seats} ${t.pricing.seatsSuffix})`)
      .join(", ");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://taskdesk.it/#website",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "inLanguage": lang === "en" ? "en" : "it",
      },
      {
        "@type": "Organization",
        "@id": "https://taskdesk.it/#organization",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "logo": "https://taskdesk.it/taskdesk-logo.png",
        "sameAs": [
          "https://www.linkedin.com/company/taskdesk",
          "https://twitter.com/taskdesk"
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://taskdesk.it/#software",
        "name": "TaskDesk",
        "url": "https://taskdesk.it",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, iOS, Android",
        "description": t.seo.description,
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": offerLowPrice,
          "highPrice": offerHighPrice,
          "priceCurrency": "EUR",
          "offerCount": String(paidPlans.length),
          "description": offerDescription,
        },
      },
    ],
  });

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const socialImage = `${SITE_BASE}/${lang === 'it' ? 'opengraph-it.jpg' : 'opengraph.jpg'}`;
  const socialImageAlt = lang === 'it'
    ? 'TaskDesk — gestione pratiche e richieste clienti'
    : 'TaskDesk — Ticket management software';

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
        <link rel="manifest" href={`/${lang}/manifest.webmanifest`} />
        <meta property="og:url" content={`${SITE_BASE}/${lang}/`} />
        <meta property="og:locale" content={lang === 'en' ? 'en_US' : 'it_IT'} />
        <meta property="og:locale:alternate" content={lang === 'en' ? 'it_IT' : 'en_US'} />
        <meta property="og:title" content={t.seo.ogTitle} />
        <meta property="og:description" content={t.seo.ogDescription} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={socialImageAlt} />
        <meta name="twitter:title" content={t.seo.twitterTitle} />
        <meta name="twitter:description" content={t.seo.twitterDescription} />
        <meta name="twitter:image" content={socialImage} />
        <meta name="twitter:image:alt" content={socialImageAlt} />
        <script type="application/ld+json">{jsonLd}</script>
      </Helmet>
      <style>{ANIMATIONS}</style>
      <ProfessionEntryDialog
        open={professionDialogOpen}
        onOpenChange={setProfessionDialogOpen}
      />

      {/* Static promotional strip: all messages remain readable without motion. */}
      <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 px-4 py-2.5">
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-2 text-center">
          {tickerItems.map((item, i) => (
            <span key={i} className="text-xs font-bold text-white/90 shrink-0">{item}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/taskdesk-logo.webp" alt="TaskDesk logo" width="120" height="32" className="h-8 w-auto" />
          </div>
          <nav aria-label={t.landmarks.mainNavigation} className="hidden md:flex gap-8 text-sm text-gray-500">
            <a href="#pain" className="hover:text-gray-900 transition-colors font-medium">
              {lang === "it" ? "Il problema" : "The problem"}
            </a>
            <a href="#who-uses" className="hidden lg:inline hover:text-gray-900 transition-colors font-medium">
              {lang === "it" ? "Categorie" : "Categories"}
            </a>
            <a href="#solution" className="hover:text-gray-900 transition-colors font-medium">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors font-medium">{t.nav.pricing}</a>
          </nav>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors px-2 py-1.5 rounded-md hover:bg-gray-100">
                  {lang.toUpperCase()} <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28 min-w-0">
                 <DropdownMenuItem onClick={() => handleLanguageChange('it')} className={lang === 'it' ? 'bg-muted font-medium' : ''}>Italiano</DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleLanguageChange('en')} className={lang === 'en' ? 'bg-muted font-medium' : ''}>English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={whatsappLabel}
              title={whatsappLabel}
              className="inline-flex md:hidden lg:inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-teal-800 transition-colors hover:border-teal-200 hover:bg-teal-50"
            >
              <FaWhatsapp aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline text-sm font-semibold">WhatsApp</span>
            </a>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50 bg-white">
              {t.nav.login}
            </a>
            <a href={APP_URL} onClick={() => trackCta("navbar")} className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-200 transition-colors">
              {t.hero.cta} →
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>

        {/* ── Hero ── */}
        <section id="pain" aria-label={t.landmarks.hero} className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #eff6ff 100%)" }}>
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

                <h1 className="ld-fade-up-1 text-4xl md:text-5xl font-black tracking-tighter leading-[1.05] mb-5">
                  {t.hero.titleLine1}
                  <br />
                  <span className="ld-gradient-text">{t.hero.titleLine2}</span>
                </h1>

                <p className="ld-fade-up-2 text-base text-gray-500 leading-relaxed mb-5 max-w-md">
                  {t.hero.subtitle}
                </p>

                <ul className="ld-fade-up-3 mb-7 grid gap-2" aria-label={lang === "it" ? "Situazioni quotidiane" : "Everyday situations"}>
                  {t.hero.situations.map((situation) => (
                    <li key={situation.title} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                      <span aria-hidden="true" className="text-lg">{situation.icon}</span>
                      <span>{situation.title}</span>
                    </li>
                  ))}
                </ul>

                <div className="ld-fade-up-3 flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => handleCta("hero")}
                    className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 flex items-center justify-center gap-2"
                  >
                    {t.hero.cta} →
                  </button>
                  <a href="#who-uses" className="px-8 py-4 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all text-center">
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

              {/* Right: unified message/email/note visual — desktop */}
              <div className="hidden lg:flex justify-end">
                <UnifiedRequestVisual lang={lang} />
              </div>
            </div>

            {/* Unified request visual — mobile/tablet (below copy) */}
            <div className="lg:hidden flex justify-center mt-12">
              <UnifiedRequestVisual lang={lang} />
            </div>
          </div>
        </section>

        <div className="px-6 pt-10 md:px-8">
          <WorkStatistic />
        </div>

        {/* ── La soluzione ── */}
        <section id="solution" aria-label={t.landmarks.features} className="py-24 px-6 md:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <ScrollReveal>
              <div>
                <span className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  {lang === "it" ? "La soluzione" : "The solution"}
                </span>
                <h2 className="mb-5 text-3xl font-black leading-tight tracking-tight text-gray-900 md:text-4xl">
                  {t.solution.title}
                </h2>
                <p className="max-w-lg text-lg leading-relaxed text-gray-500">{t.solution.subtitle}</p>
                <div className="mt-8 flex flex-wrap gap-2 text-sm font-semibold text-gray-600">
                  {[lang === "it" ? "Commenti" : "Comments", lang === "it" ? "Assegnazione" : "Assignments", "Checklist", lang === "it" ? "Soluzione" : "Resolution"].map((label) => (
                    <span key={label} className="rounded-full border border-gray-200 bg-white px-3 py-1.5">{label}</span>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1} className="flex justify-center">
              <TicketChatMockup lang={lang} />
            </ScrollReveal>
          </div>
        </section>

        {/* ── Memoria del team ── */}
        <section id="team-memory" aria-label={t.landmarks.teamMemory} className="border-y border-gray-100 bg-slate-50 px-6 py-24 md:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <ScrollReveal>
              <div data-testid="team-memory-albert-card" className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
                <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-black shadow-md">
                  <img
                    src={`${import.meta.env.BASE_URL}albert-einstein-silhouette.png`}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
                <div className="text-xl font-black text-slate-900">{t.teamMemory.assistantName}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wide text-blue-600">{t.teamMemory.assistantSlogan}</div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <span className="mb-4 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">
                {lang === "it" ? "Memoria del team" : "Team memory"}
              </span>
              <h2 className="mb-5 text-3xl font-black leading-tight tracking-tight text-gray-900 md:text-4xl">{t.teamMemory.title}</h2>
              <p className="max-w-xl text-lg leading-relaxed text-gray-500">{t.teamMemory.subtitle}</p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Si adatta al lavoro ── */}
        <section id="who-uses" aria-label={t.landmarks.whoUses} className="px-6 py-24 md:px-8">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <div className="mb-10 text-center">
                <h2 className="mb-4 text-3xl font-black leading-tight tracking-tight md:text-4xl">{t.whoUses.title}</h2>
                <p className="mx-auto max-w-2xl text-lg text-gray-500">{t.whoUses.subtitle}</p>
              </div>
            </ScrollReveal>

            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
              {t.whoUses.profiles.map((profile) => (
                <Link
                  key={profile.profession}
                  href={`/${lang}/${PROFESSION_SLUGS[lang][profile.profession]}`}
                  data-testid={`link-profession-card-${profile.profession}`}
                  className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-center text-sm font-bold leading-tight text-gray-700 transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  <ProfessionMark profile={profile} />
                  <span className="group-hover:text-blue-700">{profile.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" aria-label={t.landmarks.pricing} className="py-28 px-6 md:px-8">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-14 max-w-3xl mx-auto">
                <div className="flex flex-wrap justify-center items-center gap-2 mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                    🚀 {t.pricing.launchBadge}
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold">
                    🎁 {t.pricing.trialLabel}
                  </div>
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-3 leading-tight">{t.pricing.title}</h2>
                <p className="text-xl font-semibold text-blue-600 mb-3">{t.pricing.trialHeader}</p>
                <p className="text-lg text-gray-600">{t.pricing.subtitle}</p>
              </div>
            </ScrollReveal>

            {/* Billing cycle toggle */}
            <div className="flex items-center justify-center mb-10">
              <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-full">
                <button
                  aria-pressed={billingCycle === 'monthly'}
                  onClick={() => {
                    trackBillingCycle('monthly');
                    setBillingCycle('monthly');
                  }}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {t.pricing.billingMonthly}
                </button>
                <div className="relative">
                  <button
                    aria-pressed={billingCycle === 'annual'}
                   onClick={() => {
                     trackBillingCycle('annual');
                     setBillingCycle('annual');
                   }}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    {t.pricing.billingAnnual}
                  </button>
                  <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full whitespace-nowrap pointer-events-none">
                    {t.pricing.annualSavings}
                  </span>
                </div>
              </div>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paidPlans.map((plan, idx) => (
                <ScrollReveal key={plan.name} delay={idx * 0.06}>
                  <div
                    data-testid={`landing-plan-card-${plan.name.toLowerCase()}`}
                    className={`relative h-full bg-white rounded-2xl p-7 flex flex-col ld-card-hover ${
                    plan.highlight ? "border-2 border-blue-600 shadow-xl shadow-blue-100" : "border border-gray-100 shadow-sm"
                  }`}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-wide uppercase shadow-md">
                        {t.pricing.mostPopular}
                      </div>
                    )}
                    <div className="mb-4">
                      <div className="text-sm font-bold text-gray-600 tracking-wider uppercase mb-1">{plan.name}</div>
                      <p className="text-sm text-gray-500 leading-relaxed min-h-[40px]">{plan.desc}</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-0.5">
                      <span className="text-5xl font-black text-gray-900">
                        {billingCycle === 'annual' ? plan.annualPrice : plan.price}
                      </span>
                      {!plan.noUnit && (
                        <span className="text-sm text-gray-600 font-medium">
                          {billingCycle === 'annual' ? t.pricing.perYear : t.pricing.perMonth}
                        </span>
                      )}
                    </div>
                    {billingCycle === 'annual' && !plan.noUnit && plan.annualMonthly && (
                      <div className="text-xs text-green-600 font-semibold mb-0.5">{plan.annualMonthly}</div>
                    )}
                    {!plan.noUnit && (
                      <div className="text-xs text-gray-600 mb-1">{t.pricing.vatNote}</div>
                    )}
                    {!plan.hideSeats && (
                      <div className="text-xs font-semibold text-gray-500 mb-2">
                        {plan.seats === null ? t.pricing.seatsUnlimited : `${plan.seats} ${t.pricing.seatsSuffix}`}
                      </div>
                    )}
                    {plan.maxAddon > 0 && (
                      <div className="text-xs text-blue-600 font-medium mb-4">
                        + {t.pricing.addonLabel} (max {plan.maxAddon})
                      </div>
                    )}
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

          </div>
        </section>

      </main>

      <footer className="py-8 border-t border-gray-100 px-6 md:px-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center opacity-50">
              <img src="/taskdesk-logo.webp" alt="TaskDesk" width="90" height="24" loading="lazy" className="h-6 w-auto" style={{ filter: 'grayscale(1)' }} />
            </div>
            <p className="text-sm text-gray-400">{t.footer.text}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 border-t border-gray-100">
            <Link href="/privacy-policy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/cookie-policy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cookie Policy</Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("td-open-cookie-settings"))}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {lang === "it" ? "Preferenze cookie" : "Cookie preferences"}
            </button>
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">{t.footer.terms}</Link>
            <Link href="/dpa" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Data Processing Agreement</Link>
          </div>
        </div>
      </footer>
      <InstallPrompt />
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={whatsappLabel}
        title={whatsappLabel}
        className="fixed bottom-5 right-4 sm:right-6 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
      >
        <FaWhatsapp aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span>{whatsappLabel}</span>
      </a>
    </div>
  );
}
