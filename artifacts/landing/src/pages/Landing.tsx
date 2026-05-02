import React, { useEffect, useState } from "react";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  BarChart3, 
  MapPin, 
  ShieldCheck, 
  Zap, 
  Ticket,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const BASE = import.meta.env.BASE_URL;
const APP_URL = "/app/";

export default function Landing() {
  const { lang, setLang, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-panel py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-sm flex items-center justify-center font-bold text-xl">
              T
            </div>
            <span className="font-bold text-xl tracking-tight">TaskDesk</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.pricing}</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t.nav.faq}</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground font-medium">
                  {lang.toUpperCase()} <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-24 min-w-0">
                <DropdownMenuItem onClick={() => setLang('it')} className={lang === 'it' ? 'bg-muted font-medium' : ''}>
                  Italiano
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'bg-muted font-medium' : ''}>
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <a href={APP_URL}>
              <Button variant="ghost" className="hidden sm:inline-flex">{t.nav.login}</Button>
            </a>
            <a href={APP_URL}>
              <Button className="rounded-sm font-medium shadow-sm hover:shadow-md transition-all">
                {t.hero.trialBadge} <ArrowRight className="ml-1.5 w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="max-w-2xl animate-in slide-in-from-bottom-8 duration-700 fade-in">
              {/* Trial badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold mb-6 border border-primary/20">
                <Sparkles className="w-3.5 h-3.5" />
                {t.hero.trialBadge} — {t.hero.trialNote}
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
                {t.hero.title}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
                {t.hero.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={APP_URL}>
                  <Button size="lg" className="rounded-sm text-base h-14 px-8 shadow-md hover:shadow-lg transition-all w-full sm:w-auto">
                    {t.hero.cta} <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </a>
                <a href="#features">
                  <Button size="lg" variant="outline" className="rounded-sm text-base h-14 px-8 w-full sm:w-auto">
                    {t.hero.secondaryCta}
                  </Button>
                </a>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {t.hero.trialNote}
                <span className="mx-2 opacity-30">•</span>
                {t.pricing.price}{t.pricing.unit}
              </div>
            </div>
            <div className="relative animate-in slide-in-from-right-8 duration-1000 fade-in delay-200">
              <div className="absolute inset-0 bg-primary/5 rounded-[2rem] transform rotate-3 scale-105 -z-10"></div>
              <img 
                src={`${BASE}images/hero.png`}
                alt="TaskDesk Dashboard" 
                className="w-full h-auto rounded-xl shadow-2xl border border-border object-cover aspect-video bg-muted"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Value Prop */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">
            {t.problem.title}
          </h2>
          <p className="text-xl md:text-2xl text-primary-foreground/80 leading-relaxed font-light">
            {t.problem.description}
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">{t.features.title}</h2>
            <p className="text-xl text-muted-foreground">{t.features.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-16 mb-24">
            <FeatureCard 
              icon={<Ticket className="w-6 h-6" />}
              title={t.features.items.creation.title}
              description={t.features.items.creation.desc}
            />
            <FeatureCard 
              icon={<Zap className="w-6 h-6" />}
              title={t.features.items.priority.title}
              description={t.features.items.priority.desc}
            />
            <FeatureCard 
              icon={<MessageSquare className="w-6 h-6" />}
              title={t.features.items.history.title}
              description={t.features.items.history.desc}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div>
              <img 
                src={`${BASE}images/feature-1.png`}
                alt="Feature illustration" 
                className="w-full rounded-xl shadow-lg border border-border object-cover aspect-4/3 bg-muted"
              />
            </div>
            <div className="space-y-8">
              <FeatureItem 
                icon={<MapPin className="w-6 h-6" />}
                title={t.features.items.multi.title}
                description={t.features.items.multi.desc}
              />
              <FeatureItem 
                icon={<ShieldCheck className="w-6 h-6" />}
                title={t.features.items.roles.title}
                description={t.features.items.roles.desc}
              />
              <FeatureItem 
                icon={<CheckCircle2 className="w-6 h-6" />}
                title={t.features.items.fast.title}
                description={t.features.items.fast.desc}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 space-y-8">
              <h3 className="text-3xl font-bold tracking-tight">{t.features.items.stats.title}</h3>
              <p className="text-lg text-muted-foreground">{t.features.items.stats.desc}</p>
              <ul className="space-y-4 mt-6">
                {t.features.items.stats.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <img 
                src={`${BASE}images/feature-2.png`}
                alt="Statistics illustration" 
                className="w-full rounded-xl shadow-lg border border-border object-cover aspect-4/3 bg-muted"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 bg-muted/50 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                {t.pricing.title}
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                {t.pricing.subtitle}
              </p>
            </div>
            
            <div className="bg-card rounded-2xl border border-border shadow-xl p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
              
              {/* Trial highlight */}
              <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-4 py-2.5 text-sm font-semibold mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4 shrink-0" />
                {t.pricing.trialLabel}
              </div>

              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-6xl font-bold tracking-tighter">{t.pricing.price}</span>
                <span className="text-lg text-muted-foreground font-medium">{t.pricing.unit}</span>
              </div>
              
              <ul className="space-y-4 mb-10">
                {t.pricing.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${i === 0 ? 'text-primary font-semibold' : 'text-primary'}`} />
                    <span className={`font-medium ${i === 0 ? 'text-foreground font-semibold' : 'text-card-foreground/80'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
              
              <a href={APP_URL} className="block">
                <Button size="lg" className="w-full h-14 rounded-sm text-base shadow-md">
                  {t.pricing.cta}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-32 px-6">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-16">
            {t.faq.title}
          </h2>
          
          <Accordion type="single" collapsible className="w-full">
            {t.faq.items.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border py-2">
                <AccordionTrigger className="text-lg font-medium hover:no-underline hover:text-primary transition-colors text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 bg-primary text-primary-foreground text-center px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 border border-white/20">
            <Sparkles className="w-3.5 h-3.5" />
            {t.hero.trialBadge} — {t.hero.trialNote}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-10">
            {t.hero.title}
          </h2>
          <a href={APP_URL}>
            <Button size="lg" variant="secondary" className="rounded-sm text-base h-14 px-10 shadow-lg text-primary">
              {t.pricing.cta} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-8 border-t border-border px-6">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 bg-foreground text-background rounded-sm flex items-center justify-center font-bold text-xs">
              T
            </div>
            <span className="font-bold text-sm tracking-tight">TaskDesk</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.footer.text}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-start text-left">
      <div className="w-12 h-12 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex gap-5">
      <div className="w-12 h-12 bg-primary/5 text-primary rounded-lg flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
