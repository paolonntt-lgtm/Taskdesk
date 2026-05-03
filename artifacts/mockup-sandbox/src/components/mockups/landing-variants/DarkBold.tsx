import { useEffect, useRef, useState } from "react";

const style = `
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -40px) scale(1.08); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes blob2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(1.1); }
  66% { transform: translate(25px, -15px) scale(0.92); }
}
@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.2); }
  50% { box-shadow: 0 0 30px rgba(139,92,246,0.7), 0 0 60px rgba(139,92,246,0.35); }
}
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-12px); }
}
.blob { animation: blob 8s ease-in-out infinite; }
.blob2 { animation: blob2 10s ease-in-out infinite; }
.ticker-track { animation: ticker 28s linear infinite; }
.fade-up { animation: fadeUp 0.7s cubic-bezier(.16,1,.3,1) both; }
.fade-up-d1 { animation: fadeUp 0.7s 0.1s cubic-bezier(.16,1,.3,1) both; }
.fade-up-d2 { animation: fadeUp 0.7s 0.2s cubic-bezier(.16,1,.3,1) both; }
.fade-up-d3 { animation: fadeUp 0.7s 0.35s cubic-bezier(.16,1,.3,1) both; }
.fade-up-d4 { animation: fadeUp 0.7s 0.5s cubic-bezier(.16,1,.3,1) both; }
.glow-btn { animation: pulse-glow 3s ease-in-out infinite; }
.shimmer-text {
  background: linear-gradient(90deg, #a78bfa, #7c3aed, #c4b5fd, #7c3aed, #a78bfa);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 4s linear infinite;
}
.float-card { animation: float 5s ease-in-out infinite; }
.float-card-d { animation: float 5s 1.5s ease-in-out infinite; }
.glass {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(12px);
}
.glass:hover {
  background: rgba(255,255,255,0.07);
  border-color: rgba(139,92,246,0.4);
  transform: translateY(-4px);
  transition: all 0.3s ease;
}
.noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
}
`;

const tickers = [
  "🚀 7 giorni gratis", "✨ Nessuna carta di credito", "⚡ Setup in 5 minuti",
  "🔒 Sicuro al 100%", "📊 Dashboard in tempo reale", "🏢 Multi-sede",
  "🚀 7 giorni gratis", "✨ Nessuna carta di credito", "⚡ Setup in 5 minuti",
  "🔒 Sicuro al 100%", "📊 Dashboard in tempo reale", "🏢 Multi-sede",
];

const features = [
  { icon: "⚡", title: "Ticket in 10 secondi", desc: "Crea, assegna e traccia richieste con pochi tap. Zero formazione." },
  { icon: "📊", title: "Report Istantanei", desc: "Grafici live su stati, priorità e carichi di lavoro del team." },
  { icon: "🔐", title: "Ruoli & Permessi", desc: "Admin e utenti separati. Solo chi deve vedere, vede." },
  { icon: "🏢", title: "Multi-Sede", desc: "Gestisci più uffici da un'unica dashboard centralizzata." },
  { icon: "💬", title: "Commenti & Log", desc: "Ogni ticket ha una storia completa. Mai perdere un dettaglio." },
  { icon: "🚀", title: "Pronto in 5 minuti", desc: "Zero setup complicato. Sei operativo prima del caffè." },
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

function AnimatedCount({ target, suffix = "" }: { target: number; suffix?: string }) {
  const { ref, visible } = useInView();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = target / 60;
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.round(start));
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [visible, target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

export function DarkBold() {
  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden font-sans">
      <style>{style}</style>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 glass fade-up">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-violet-900">T</div>
            <span className="font-bold text-lg tracking-tight">TaskDesk</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm text-white/50">
            <span className="hover:text-white transition-colors cursor-pointer">Funzionalità</span>
            <span className="hover:text-white transition-colors cursor-pointer">Prezzi</span>
            <span className="hover:text-white transition-colors cursor-pointer">FAQ</span>
          </nav>
          <button className="glow-btn px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-colors">
            Inizia gratis →
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Blobs */}
        <div className="blob absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-700/25 blur-[120px] pointer-events-none" />
        <div className="blob2 absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[140px] pointer-events-none" />
        <div className="blob absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-fuchsia-700/15 blur-[100px] pointer-events-none" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-6xl mx-auto px-8 py-32 w-full">
          <div className="max-w-3xl">
            <div className="fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              7 giorni gratuiti — nessuna carta richiesta
            </div>

            <h1 className="fade-up-d1 text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-8">
              Il ticketing
              <br />
              <span className="shimmer-text">che non ti</span>
              <br />
              complica la vita.
            </h1>

            <p className="fade-up-d2 text-lg md:text-xl text-white/50 leading-relaxed mb-10 max-w-xl">
              TaskDesk è l'alternativa essenziale ai pachidermi enterprise. Pensato per le PMI italiane che vogliono risultati, non manuali.
            </p>

            <div className="fade-up-d3 flex flex-wrap gap-4">
              <button className="glow-btn px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-base transition-all">
                Inizia la prova gratuita →
              </button>
              <button className="px-8 py-4 rounded-xl glass font-semibold text-base text-white/70 hover:text-white transition-all">
                Scopri come funziona
              </button>
            </div>

            {/* Stats */}
            <div className="fade-up-d4 mt-16 flex flex-wrap gap-12">
              {[
                { n: 500, s: "+", label: "Aziende attive" },
                { n: 98, s: "%", label: "Soddisfazione" },
                { n: 1, s: "€", label: "Per utente/mese", pre: true },
              ].map(({ n, s, label, pre }) => (
                <div key={label}>
                  <div className="text-4xl font-black text-white">
                    {pre && s}<AnimatedCount target={n} suffix={pre ? "" : s} />
                  </div>
                  <div className="text-sm text-white/40 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating cards */}
          <div className="float-card absolute right-8 top-[20%] hidden lg:block">
            <div className="glass rounded-2xl p-5 w-64 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 text-sm">✓</div>
                <div>
                  <div className="text-xs font-bold text-white/90">Ticket risolto</div>
                  <div className="text-xs text-white/40">Stampante Sede B</div>
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full"><div className="h-full w-full bg-green-500 rounded-full" /></div>
            </div>
          </div>

          <div className="float-card-d absolute right-32 top-[55%] hidden lg:block">
            <div className="glass rounded-2xl p-4 w-52 shadow-2xl">
              <div className="text-xs text-white/40 mb-2">Ticket aperti oggi</div>
              <div className="text-3xl font-black text-violet-300">12</div>
              <div className="text-xs text-green-400 mt-1">↓ 3 rispetto a ieri</div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="border-y border-white/10 bg-white/[0.02] py-4 overflow-hidden">
        <div className="ticker-track flex gap-12 whitespace-nowrap">
          {tickers.map((t, i) => (
            <span key={i} className="text-sm font-semibold text-white/40 shrink-0">{t}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="py-32 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Tutto quello che serve.
              <br />
              <span className="shimmer-text">Niente di più.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">Strumenti essenziali, progettati con cura maniacale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="glass rounded-2xl p-7 cursor-default transition-all duration-300" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="text-3xl mb-5">{f.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-white/90">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-8 text-center relative overflow-hidden">
        <div className="blob absolute top-[-20%] left-[30%] w-[400px] h-[400px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-5xl font-black tracking-tight mb-6">
            Pronto a semplificare
            <br />
            <span className="shimmer-text">il tuo supporto?</span>
          </h2>
          <p className="text-white/40 mb-10">7 giorni gratis. Nessuna carta di credito. Setup in 5 minuti.</p>
          <button className="glow-btn px-10 py-5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-lg transition-all">
            Inizia ora — è gratis →
          </button>
        </div>
      </section>
    </div>
  );
}
