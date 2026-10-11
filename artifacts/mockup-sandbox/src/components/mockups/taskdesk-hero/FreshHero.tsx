import { ArrowDown, Check, FileText, Mail, MessageCircle } from "lucide-react";
import "./_group.css";

function SourceCard({
  icon: Icon,
  label,
  title,
  note,
  iconClass,
  className,
}: {
  icon: typeof Mail;
  label: string;
  title: string;
  note: string;
  iconClass: string;
  className: string;
}) {
  return (
    <div className={`absolute z-10 w-[178px] rounded-2xl border border-white bg-white/95 p-3.5 shadow-[0_12px_34px_#24324a14] ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${iconClass}`}><Icon size={14} /></span>
        <span className="text-[11px] font-bold text-gray-600">{label}</span>
      </div>
      <p className="text-xs font-semibold leading-snug text-gray-800">{title}</p>
      <p className="mt-1 text-[10px] leading-snug text-gray-400">{note}</p>
    </div>
  );
}

function UnifiedRequestVisual() {
  return (
    <div className="relative h-[460px] w-full max-w-[490px]" aria-label="Messaggi, email e appunti riuniti in una pratica TaskDesk">
      <div className="absolute inset-[5%] rounded-full border border-blue-100/80" />
      <div className="absolute inset-[15%] rounded-full border border-violet-100/70" />
      <div className="absolute left-[25%] top-[15%] h-[280px] w-[280px] rounded-full bg-blue-100/70 blur-3xl" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 490 460" fill="none" aria-hidden="true">
        <path d="M102 116 C112 205 171 253 226 303" stroke="#93B4FA" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M388 66 C378 178 322 247 272 303" stroke="#A99AF2" strokeWidth="2" strokeDasharray="5 7" />
        <path d="M90 256 C143 267 185 281 225 310" stroke="#86C9AE" strokeWidth="2" strokeDasharray="5 7" />
        <circle cx="226" cy="303" r="5" fill="#2563EB" />
        <circle cx="272" cy="303" r="5" fill="#7C3AED" />
      </svg>

      <SourceCard
        icon={MessageCircle}
        label="WhatsApp"
        title="«Mi ricordi a che punto siamo?»"
        note="Messaggio di ieri · 10:12"
        iconClass="bg-green-50 text-green-600"
        className="left-0 top-[58px] rotate-[-4deg]"
      />
      <SourceCard
        icon={Mail}
        label="Email"
        title="Documenti per la dichiarazione"
        note="Da Carla M. · ieri"
        iconClass="bg-blue-50 text-blue-600"
        className="right-0 top-[20px] rotate-[3deg]"
      />
      <SourceCard
        icon={FileText}
        label="Appunto"
        title="Manca la CU dell’anno scorso"
        note="Nota presa al telefono"
        iconClass="bg-amber-50 text-amber-600"
        className="left-[9px] top-[218px] rotate-[3deg]"
      />

      <div className="absolute bottom-[18px] left-1/2 z-20 w-[min(340px,88%)] -translate-x-1/2 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_22px_60px_#2855a71f]">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-blue-500">Tutto al suo posto</div>
            <div className="text-sm font-bold text-gray-900">Pratica #5</div>
            <div className="mt-1 text-xs text-gray-500">Documenti per la dichiarazione</div>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">In carico</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex -space-x-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-500 text-[9px] font-bold text-white">CM</span>
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-600 text-[9px] font-bold text-white">LB</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
            <span className="text-blue-500">3</span> fonti riunite
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white"><Check size={14} strokeWidth={2.5} /></span>
        </div>
      </div>
      <div className="absolute bottom-[142px] left-1/2 z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-blue-100 bg-white text-blue-500 shadow-sm">
        <ArrowDown size={15} />
      </div>
    </div>
  );
}

export function FreshHero() {
  return (
    <main className="taskdesk-hero-root min-h-screen overflow-hidden bg-white text-gray-900">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#eff6ff_0%,#f5f3ff_50%,#eff6ff_100%)]">
        <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[450px] w-[450px] rounded-full border border-blue-100 opacity-50" />
        <div className="pointer-events-none absolute -bottom-[40px] -left-[40px] h-[300px] w-[300px] rounded-full border border-violet-100 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-8 py-20 lg:py-24">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" /></span>
                7 giorni gratis — Nessuna carta di credito richiesta
              </div>
              <h1 className="mb-5 text-4xl font-black leading-[1.05] tracking-tighter md:text-5xl">
                Ti è mai capitato di sapere che qualcuno ne aveva parlato,<br />
                <span className="taskdesk-hero-gradient-text">ma non ricordare dove?</span>
              </h1>
              <p className="mb-5 max-w-md text-base leading-relaxed text-gray-500">Capita quando il lavoro resta sparso tra chat, email e memoria delle persone.</p>
              <ul aria-label="Situazioni quotidiane" className="mb-7 grid gap-2">
                <li className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"><span className="text-lg">💬</span>Un messaggio WhatsApp dimenticato</li>
                <li className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"><span className="text-lg">🙋</span>Una richiesta senza responsabile</li>
                <li className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/65 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm"><span className="text-lg">🔎</span>Una soluzione che nessuno riesce più a trovare</li>
              </ul>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <button className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-200">Inizia gratis — 7 giorni →</button>
                <a href="#who-uses" className="rounded-xl border-2 border-gray-200 px-8 py-4 text-center font-semibold text-gray-600">Scopri le categorie</a>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium text-gray-400"><span className="text-green-500">✓</span> 7 giorni gratis <span className="mx-2 text-gray-200">·</span><span className="text-green-500">✓</span> Nessuna carta <span className="mx-2 text-gray-200">·</span><span className="text-green-500">✓</span> Cancella quando vuoi</div>
                <p className="text-xs italic text-gray-400">Usato da studi commerciali, agenzie e consulenti in tutta Italia</p>
              </div>
            </div>
            <div className="hidden justify-end lg:flex"><UnifiedRequestVisual /></div>
          </div>
          <div className="mt-12 flex justify-center lg:hidden"><UnifiedRequestVisual /></div>
        </div>
      </section>
    </main>
  );
}
