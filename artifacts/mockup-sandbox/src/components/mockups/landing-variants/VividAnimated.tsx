import { useEffect, useRef, useState } from "react";

const style = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes ping-once {
  0% { transform: scale(1); opacity: 1; }
  75% { transform: scale(1.4); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
.fade-up { animation: fadeUp 0.65s cubic-bezier(.16,1,.3,1) both; }
.fade-up-1 { animation: fadeUp 0.65s 0.1s cubic-bezier(.16,1,.3,1) both; }
.fade-up-2 { animation: fadeUp 0.65s 0.2s cubic-bezier(.16,1,.3,1) both; }
.fade-up-3 { animation: fadeUp 0.65s 0.35s cubic-bezier(.16,1,.3,1) both; }
.fade-up-4 { animation: fadeUp 0.65s 0.5s cubic-bezier(.16,1,.3,1) both; }
.ticker-track { animation: ticker 30s linear infinite; }
.gradient-text {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #db2777, #2563eb);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 5s ease infinite;
}
.hero-gradient {
  background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 40%, #fdf2f8 100%);
}
.card-hover {
  transition: all 0.25s cubic-bezier(.16,1,.3,1);
}
.card-hover:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(37,99,235,0.12);
}
.float-el { animation: float 4s ease-in-out infinite; }
.float-el-2 { animation: float 5s 1s ease-in-out infinite; }
.spin-slow { animation: spin-slow 12s linear infinite; }
.glow-border {
  background: linear-gradient(135deg, #2563eb, #7c3aed, #db2777);
  background-size: 300% 300%;
  animation: gradient-shift 4s ease infinite;
  padding: 2px;
  border-radius: 14px;
}
.notification-enter {
  animation: fadeUp 0.4s ease both;
}
`;

const tickerItems = [
  "✅ Ticket risolto in media in 4h", "⭐ 4.9/5 soddisfazione media", "🏢 500+ aziende italiane",
  "🚀 Setup in 5 minuti", "💶 Solo €1/utente/mese", "🔒 GDPR Compliant",
  "✅ Ticket risolto in media in 4h", "⭐ 4.9/5 soddisfazione media", "🏢 500+ aziende italiane",
  "🚀 Setup in 5 minuti", "💶 Solo €1/utente/mese", "🔒 GDPR Compliant",
];

const features = [
  { icon: "⚡", color: "bg-blue-50 text-blue-600 border-blue-100", title: "Creazione Rapida", desc: "Apri un ticket in 10 secondi e assegnalo alla persona giusta, senza frizioni." },
  { icon: "📊", color: "bg-violet-50 text-violet-600 border-violet-100", title: "Report & Statistiche", desc: "Dati chiari: grafici per stato, priorità, sede e operatore in tempo reale." },
  { icon: "🔐", color: "bg-pink-50 text-pink-600 border-pink-100", title: "Accesso per Ruoli", desc: "Admin e utenti separati. Controllo totale su chi vede cosa." },
  { icon: "🏢", color: "bg-green-50 text-green-600 border-green-100", title: "Multi-Sede", desc: "Gestisci tutte le sedi da un'unica piattaforma centralizzata." },
  { icon: "💬", color: "bg-orange-50 text-orange-600 border-orange-100", title: "Commenti & Cronologia", desc: "Una fonte di verità per ogni richiesta, accessibile a tutti i collaboratori." },
  { icon: "✈️", color: "bg-teal-50 text-teal-600 border-teal-100", title: "Pronto Subito", desc: "Sei operativo in meno di 5 minuti. Letteralmente." },
];

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
    let start = 0;
    const step = to / 50;
    const id = setInterval(() => {
      start = Math.min(start + step, to);
      setVal(Math.round(start));
      if (start >= to) clearInterval(id);
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

export function VividAnimated() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans">
      <style>{style}</style>

      {/* Ticker */}
      <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-pink-600 py-2.5 overflow-hidden">
        <div className="ticker-track flex gap-10 whitespace-nowrap">
          {tickerItems.map((t, i) => (
            <span key={i} className="text-xs font-bold text-white/90 shrink-0">{t}</span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg">T</div>
            <span className="font-bold text-lg tracking-tight">TaskDesk</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm text-gray-500">
            <span className="hover:text-gray-900 transition-colors cursor-pointer font-medium">Funzionalità</span>
            <span className="hover:text-gray-900 transition-colors cursor-pointer font-medium">Prezzi</span>
            <span className="hover:text-gray-900 transition-colors cursor-pointer font-medium">FAQ</span>
          </nav>
          <div className="flex items-center gap-3">
            <button className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-4 py-2">Accedi</button>
            <div className="glow-border">
              <button className="block px-5 py-2 rounded-[12px] bg-white text-sm font-bold text-transparent gradient-text hover:bg-gray-50 transition-colors">
                Prova Gratis →
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-50px] right-[-50px] w-[400px] h-[400px] rounded-full border border-blue-100 opacity-60" />
        <div className="absolute top-[50px] right-[50px] w-[280px] h-[280px] rounded-full border border-violet-100 opacity-60" />
        <div className="absolute bottom-[-30px] left-[-30px] w-[250px] h-[250px] rounded-full border border-pink-100 opacity-50" />

        <div className="max-w-6xl mx-auto px-8 py-28 lg:py-36 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-8">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-blue-500" />
                </span>
                7 giorni gratis — nessuna carta richiesta
              </div>

              <h1 className="fade-up-1 text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.0] mb-6">
                Supporto tecnico
                <br />
                <span className="gradient-text">semplice e veloce.</span>
              </h1>
              <p className="fade-up-2 text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
                Il ticketing aziendale essenziale per le PMI italiane. Chiaro, diretto e conveniente.
              </p>
              <div className="fade-up-3 flex flex-col sm:flex-row gap-4 mb-12">
                <button className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300">
                  Inizia la prova gratuita →
                </button>
                <button className="px-8 py-4 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
                  Scopri come funziona
                </button>
              </div>
              <div className="fade-up-4 flex items-center gap-3 text-sm text-gray-400">
                <span className="text-green-500">✓</span> Nessuna carta di credito
                <span className="mx-2 text-gray-200">•</span>
                <span className="text-green-500">✓</span> Disdici quando vuoi
                <span className="mx-2 text-gray-200">•</span>
                <span className="text-green-500">✓</span> €1/utente/mese
              </div>
            </div>

            {/* Dashboard mock */}
            <div className="relative hidden lg:block">
              <div className="float-el bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-xs text-gray-400 font-medium">DASHBOARD</div>
                    <div className="font-bold text-gray-900 text-lg">Ticket di oggi</div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">T</div>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-2 h-24 mb-6">
                  {[60,85,45,90,70,55,95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{
                      height: `${h}%`,
                      background: i === 6
                        ? "linear-gradient(to top, #2563eb, #7c3aed)"
                        : "#f3f4f6"
                    }} />
                  ))}
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Stampante non funziona", status: "Aperto", color: "text-orange-600 bg-orange-50" },
                    { label: "Accesso VPN bloccato", status: "In corso", color: "text-blue-600 bg-blue-50" },
                    { label: "PC lento - Sede B", status: "Risolto", color: "text-green-600 bg-green-50" },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <span className="text-sm font-medium text-gray-700 truncate pr-4">{t.label}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${t.color}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="float-el-2 absolute -bottom-6 -left-8 bg-white rounded-2xl shadow-xl border border-gray-100 px-5 py-4 flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">✅</div>
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
      <section className="py-16 border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { n: 500, s: "+", label: "Aziende attive" },
              { n: 98, s: "%", label: "Soddisfazione clienti" },
              { n: 4, s: "h", label: "Tempo medio risoluzione" },
              { n: 1, s: "€", label: "Per utente/mese", p: true },
            ].map(({ n, s, label, p }) => (
              <div key={label}>
                <div className="text-4xl md:text-5xl font-black gradient-text">
                  {p ? s : ""}<CountUp to={n} suffix={p ? "" : s} />
                </div>
                <div className="text-sm text-gray-400 font-medium mt-2">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Tutto quello che serve.
                <br />
                <span className="gradient-text">Niente di più.</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-lg mx-auto">Strumenti essenziali, progettati con cura maniacale per la massima efficienza.</p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <ScrollReveal key={i} delay={i * 0.08}>
                <div className="card-hover bg-white rounded-2xl border border-gray-100 p-8 h-full cursor-default shadow-sm">
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

      {/* CTA */}
      <section className="py-32 px-8">
        <ScrollReveal>
          <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #1d4ed8, #7c3aed, #db2777)" }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
            <div className="relative p-16 text-center text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/20 text-sm font-semibold mb-8">
                🚀 Inizia gratis oggi
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
                Pronto a semplificare
                <br />il tuo supporto tecnico?
              </h2>
              <p className="text-white/70 mb-10 text-lg">7 giorni gratis. Nessuna carta. Setup in 5 minuti.</p>
              <button className="px-10 py-5 rounded-xl bg-white text-blue-700 font-black text-lg hover:bg-blue-50 transition-all shadow-2xl hover:shadow-white/20">
                Inizia ora — è gratis →
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
