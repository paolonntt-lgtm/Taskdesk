import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown, X, Smartphone } from "lucide-react";

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
  50%       { transform: translateY(-10px); }
}
@keyframes ld-float2 {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
.ld-fade-up   { animation: ld-fadeUp 0.65s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-1 { animation: ld-fadeUp 0.65s 0.10s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-2 { animation: ld-fadeUp 0.65s 0.20s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-3 { animation: ld-fadeUp 0.65s 0.35s cubic-bezier(.16,1,.3,1) both; }
.ld-fade-up-4 { animation: ld-fadeUp 0.65s 0.50s cubic-bezier(.16,1,.3,1) both; }
.ld-ticker { animation: ld-ticker 30s linear infinite; }
.ld-gradient-text {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #db2777, #2563eb);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ld-gradient-shift 5s ease infinite;
}
.ld-glow-border {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #db2777);
  background-size: 300% 300%;
  animation: ld-gradient-shift 4s ease infinite;
  padding: 2px;
  border-radius: 14px;
}
.ld-float  { animation: ld-float  4s ease-in-out infinite; }
.ld-float2 { animation: ld-float2 5s 1s ease-in-out infinite; }
.ld-card-hover {
  transition: all 0.25s cubic-bezier(.16,1,.3,1);
}
.ld-card-hover:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(37,99,235,0.12);
}
`;

function useDevicePlatform() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "other");
  }, []);
  return platform;
}

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

function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const { ref, visible } = useInView();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let cur = 0;
    const step = to / 50;
    const id = setInterval(() => {
      cur = Math.min(cur + step, to);
      setVal(Math.round(cur));
      if (cur >= to) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [visible, to]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
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

function AppBanner() {
  const { t } = useLanguage();
  const platform = useDevicePlatform();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("app-banner-dismissed") === "1";
    if (!wasDismissed) setDismissed(false);
  }, []);

  const dismiss = () => {
    localStorage.setItem("app-banner-dismissed", "1");
    setDismissed(true);
  };

  const openApp = () => {
    const host = window.location.host;
    window.location.href = `exps://${host}/mobile`;
    setTimeout(() => { window.location.href = "/mobile"; }, 600);
  };

  if (platform === "other" || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-2xl px-4 py-3 flex items-center gap-3" style={{ animation: "ld-fadeUp 0.3s ease both" }}>
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-white font-bold text-lg">T</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight">TaskDesk</p>
        <p className="text-xs text-gray-400 leading-tight truncate">{t.appBanner.subtitle}</p>
      </div>
      <button
        onClick={openApp}
        className="shrink-0 h-8 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
      >
        {t.appBanner.open}
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Chiudi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Landing() {
  const { lang, setLang, t } = useLanguage();
  const platform = useDevicePlatform();
  const isMobile = platform !== "other";

  const tickerItems = [
    t.hero.trialBadge, "⭐ 4.9/5 soddisfazione media", "🏢 500+ aziende italiane",
    "🚀 Setup in 5 minuti", `💶 Da ${t.pricing.price}${t.pricing.unit}`, "🔒 GDPR Compliant",
    t.hero.trialBadge, "⭐ 4.9/5 soddisfazione media", "🏢 500+ aziende italiane",
    "🚀 Setup in 5 minuti", `💶 Da ${t.pricing.price}${t.pricing.unit}`, "🔒 GDPR Compliant",
  ];

  const featureCards = [
    { icon: "⚡", color: "bg-blue-50 text-blue-600 border-blue-100",   title: t.features.items.creation.title, desc: t.features.items.creation.desc },
    { icon: "📊", color: "bg-violet-50 text-violet-600 border-violet-100", title: t.features.items.stats.title,    desc: t.features.items.stats.desc },
    { icon: "🔐", color: "bg-pink-50 text-pink-600 border-pink-100",   title: t.features.items.roles.title,    desc: t.features.items.roles.desc },
    { icon: "🏢", color: "bg-green-50 text-green-600 border-green-100", title: t.features.items.multi.title,    desc: t.features.items.multi.desc },
    { icon: "💬", color: "bg-orange-50 text-orange-600 border-orange-100", title: t.features.items.history.title,  desc: t.features.items.history.desc },
    { icon: "✈️", color: "bg-teal-50 text-teal-600 border-teal-100",   title: t.features.items.fast.title,     desc: t.features.items.fast.desc },
  ];

  const handleCta = () => {
    if (isMobile) { window.location.href = "/mobile"; } 
    else { window.location.href = APP_URL; }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden" style={{ fontFamily: "var(--app-font-sans, sans-serif)" }}>
      <style>{ANIMATIONS}</style>
      <AppBanner />

      {/* Ticker */}
      <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 py-2.5 overflow-hidden">
        <div className="ld-ticker flex gap-10 whitespace-nowrap">
          {tickerItems.map((item, i) => (
            <span key={i} className="text-xs font-bold text-white/90 shrink-0">{item}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg">T</div>
            <span className="font-bold text-lg tracking-tight">TaskDesk</span>
          </div>

          <nav className="hidden md:flex gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors font-medium">{t.nav.features}</a>
            <a href="#pricing"  className="hover:text-gray-900 transition-colors font-medium">{t.nav.pricing}</a>
            <a href="#faq"      className="hover:text-gray-900 transition-colors font-medium">{t.nav.faq}</a>
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

            {isMobile ? (
              <button
                onClick={handleCta}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {t.appBanner.open}
              </button>
            ) : (
              <>
                <a href={APP_URL} className="hidden sm:block text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
                  {t.nav.login}
                </a>
                <div className="ld-glow-border">
                  <a href={APP_URL} className="block px-4 py-1.5 rounded-[12px] bg-white text-sm font-bold ld-gradient-text hover:bg-gray-50 transition-colors">
                    {t.hero.cta} →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 40%, #fdf2f8 100%)" }}>
        <div className="absolute top-[-50px] right-[-50px] w-[400px] h-[400px] rounded-full border border-blue-100 opacity-60 pointer-events-none" />
        <div className="absolute top-[50px] right-[50px] w-[280px] h-[280px] rounded-full border border-violet-100 opacity-60 pointer-events-none" />
        <div className="absolute bottom-[-30px] left-[-30px] w-[250px] h-[250px] rounded-full border border-pink-100 opacity-50 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-24 lg:py-36 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="ld-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-8">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-blue-500" />
                </span>
                {t.hero.trialBadge} — {t.hero.trialNote}
              </div>

              <h1 className="ld-fade-up-1 text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.05] mb-6">
                {t.hero.title.split(" ").slice(0, -2).join(" ")}
                <br />
                <span className="ld-gradient-text">{t.hero.title.split(" ").slice(-2).join(" ")}</span>
              </h1>

              <p className="ld-fade-up-2 text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
                {t.hero.subtitle}
              </p>

              <div className="ld-fade-up-3 flex flex-col sm:flex-row gap-4 mb-10">
                <button
                  onClick={handleCta}
                  className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 flex items-center justify-center gap-2"
                >
                  {isMobile ? <><Smartphone className="w-4 h-4" />{t.appBanner.downloadCta}</> : <>{t.hero.cta} →</>}
                </button>
                <a href="#features" className="px-8 py-4 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all text-center">
                  {t.hero.secondaryCta}
                </a>
              </div>

              <div className="ld-fade-up-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
                <span><span className="text-green-500 font-bold">✓</span> {t.hero.trialNote}</span>
                <span className="text-gray-200 hidden sm:inline">•</span>
                <span><span className="text-green-500 font-bold">✓</span> {lang === "it" ? "Da" : "From"} {t.pricing.price}{t.pricing.unit}</span>
              </div>
            </div>

            {/* Floating dashboard mockup */}
            <div className="relative hidden lg:block">
              <div className="ld-float bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-xs text-gray-400 font-semibold tracking-widest uppercase">Dashboard</div>
                    <div className="font-bold text-gray-900 text-lg mt-0.5">Ticket di oggi</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">T</div>
                </div>
                <div className="flex items-end gap-2 h-20 mb-5">
                  {[60, 85, 45, 90, 70, 55, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        background: i === 6 ? "linear-gradient(to top, #2563eb, #7c3aed)" : "#f3f4f6",
                      }}
                    />
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Stampante non funziona", status: "Aperto",   color: "text-orange-600 bg-orange-50" },
                    { label: "Accesso VPN bloccato",   status: "In corso", color: "text-blue-600 bg-blue-50" },
                    { label: "PC lento — Sede B",      status: "Risolto",  color: "text-green-600 bg-green-50" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50">
                      <span className="text-sm font-medium text-gray-700 truncate pr-4">{row.label}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${row.color}`}>{row.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ld-float2 absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-xl border border-gray-100 px-5 py-3.5 flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl shrink-0">✅</div>
                <div>
                  <div className="font-bold text-sm text-gray-900">Ticket risolto!</div>
                  <div className="text-xs text-gray-400">2 minuti fa • Sede A</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { to: 500, s: "+",  label: lang === "it" ? "Aziende attive"           : "Active companies" },
              { to: 98,  s: "%",  label: lang === "it" ? "Soddisfazione clienti"    : "Client satisfaction" },
              { to: 4,   s: "h",  label: lang === "it" ? "Tempo medio risoluzione"  : "Avg. resolution time" },
              { to: 9,   s: "",   label: lang === "it" ? "€/mese, piano Starter"     : "€/month, Starter plan", p: true },
            ].map(({ to, s, label, p }) => (
              <div key={label}>
                <div className="text-4xl md:text-5xl font-black ld-gradient-text">
                  {p ? "€" : ""}<CountUp to={to} suffix={s} />
                </div>
                <div className="text-sm text-gray-400 font-medium mt-2">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 px-6 md:px-8">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-28 px-6 md:px-8 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-6">
                {t.pricing.trialLabel}
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight">
                {t.pricing.title}
              </h2>
              <p className="text-lg text-gray-400">{t.pricing.subtitle}</p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.pricing.plans.map((plan, idx) => (
              <ScrollReveal key={plan.name} delay={idx * 0.06}>
                <div
                  className={`relative h-full bg-white rounded-2xl p-7 flex flex-col ld-card-hover ${
                    plan.highlight
                      ? "border-2 border-blue-600 shadow-xl shadow-blue-100"
                      : "border border-gray-100 shadow-sm"
                  }`}
                >
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
                    <span className="text-sm text-gray-400 font-medium">{t.pricing.perMonth}</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-500 mb-6">
                    {plan.seats === null ? t.pricing.seatsUnlimited : `${plan.seats} ${t.pricing.seatsSuffix}`}
                  </div>

                  <ul className="space-y-2.5 mb-7 flex-1">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`font-bold mt-0.5 shrink-0 ${plan.highlight ? "text-blue-600" : "text-blue-500"}`}>✓</span>
                        <span className="text-sm text-gray-600 leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={handleCta}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      plan.highlight
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {isMobile ? <><Smartphone className="w-4 h-4" />{t.appBanner.downloadCta}</> : <>{plan.cta} →</>}
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-28 px-6 md:px-8">
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

      {/* CTA finale */}
      <section className="py-28 px-6 md:px-8">
        <ScrollReveal>
          <div
            className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #7c3aed, #db2777)" }}
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
            />
            <div className="relative p-12 md:p-16 text-center text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/20 text-sm font-semibold mb-8">
                🚀 {t.hero.trialBadge} — {t.hero.trialNote}
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight">
                {t.hero.title}
              </h2>
              <p className="text-white/70 mb-10 text-lg">{t.pricing.subtitle}</p>
              <button
                onClick={handleCta}
                className="px-10 py-5 rounded-xl bg-white text-blue-700 font-black text-lg hover:bg-blue-50 transition-all shadow-2xl flex items-center gap-2 mx-auto"
              >
                {isMobile ? <><Smartphone className="w-5 h-5" />{t.appBanner.downloadCta}</> : <>{t.pricing.cta} →</>}
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100 px-6 md:px-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 bg-gray-900 text-white rounded-md flex items-center justify-center font-bold text-xs">T</div>
            <span className="font-bold text-sm tracking-tight text-gray-900">TaskDesk</span>
          </div>
          <p className="text-sm text-gray-400">{t.footer.text}</p>
        </div>
      </footer>
    </div>
  );
}
