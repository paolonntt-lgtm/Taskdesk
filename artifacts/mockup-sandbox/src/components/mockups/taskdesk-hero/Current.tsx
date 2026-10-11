import { useEffect, useState } from "react";
import "./_group.css";

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
      {initials}
    </div>
  );
}

function MentionPill({ name }: { name: string }) {
  return (
    <span className="mx-0.5 inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
      @{name}
    </span>
  );
}

type Message = {
  author: string;
  color: string;
  initials: string;
  text?: string;
  mention?: string;
  textBefore?: string;
  textAfter?: string;
  time: string;
  isSolution?: boolean;
  liked?: boolean;
};

export function TicketChatMockup({ lang = "it" }: { lang?: "it" | "en" }) {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const messages: Message[] = lang === "it" ? [
    { author: "Carla M.", color: "bg-violet-500", initials: "CM", text: "Salve, ho bisogno della documentazione per la dichiarazione dei redditi. Mancano ancora le certificazioni uniche dell'anno scorso.", time: "10:12" },
    { author: "Sara L.", color: "bg-orange-500", initials: "SL", mention: "Luca B.", textBefore: "Ho preso in carico la pratica.", textAfter: "puoi recuperare le CU dal cassetto fiscale?", time: "10:18" },
    { author: "Luca B.", color: "bg-blue-600", initials: "LB", isSolution: true, text: "CU recuperate e allegate. Ho verificato tutto — i dati sono corretti. Pratica pronta per la compilazione della dichiarazione.", time: "10:31" },
    { author: "Carla M.", color: "bg-violet-500", initials: "CM", mention: "Sara L.", textAfter: "Perfetto, grazie mille! Posso procedere con la firma?", time: "10:34", liked: true },
  ] : [
    { author: "Carla M.", color: "bg-violet-500", initials: "CM", text: "Salve, ho bisogno della documentazione per la dichiarazione dei redditi. Mancano ancora le certificazioni uniche dell'anno scorso.", time: "10:12" },
    { author: "Sara L.", color: "bg-orange-500", initials: "SL", mention: "Luca B.", textBefore: "Ho preso in carico la pratica.", textAfter: "puoi recuperare le CU dal cassetto fiscale?", time: "10:18" },
    { author: "Luca B.", color: "bg-blue-600", initials: "LB", isSolution: true, text: "CU recuperate e allegate. Ho verificato tutto — i dati sono corretti. Pratica pronta per la compilazione della dichiarazione.", time: "10:31" },
    { author: "Carla M.", color: "bg-violet-500", initials: "CM", mention: "Sara L.", textAfter: "Perfetto, grazie mille! Posso procedere con la firma?", time: "10:34", liked: true },
  ];

  useEffect(() => {
    if (visibleMessages >= messages.length) return;
    const timeout = window.setTimeout(() => {
      if (visibleMessages === 0) {
        setVisibleMessages(1);
        return;
      }
      setShowTyping(true);
      window.setTimeout(() => {
        setShowTyping(false);
        setVisibleMessages((count) => count + 1);
      }, 900);
    }, visibleMessages === 0 ? 600 : 300);
    return () => window.clearTimeout(timeout);
  }, [visibleMessages, messages.length]);

  return (
    <div data-testid="ticket-chat-mockup" className="taskdesk-hero-float w-full max-w-[380px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
      <div className="border-b border-gray-100 bg-white px-4 pb-3 pt-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{lang === "it" ? "Pratica" : "Request"}</div>
        <div className="mb-2 text-sm font-bold leading-snug text-gray-900">#5 — Documenti mancanti per dichiarazione dei redditi</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">Risolta</span>
          <span className="rounded-full border border-orange-300 px-2.5 py-1 text-xs font-semibold text-orange-700">Alta</span>
          <span className="rounded-full border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600">Fiscale</span>
        </div>
      </div>
      <div className="min-h-[280px] space-y-3 bg-[#f8faff] px-4 py-3">
        {messages.slice(0, visibleMessages).map((message, index) => (
          <div key={index} className="flex gap-2.5">
            <Avatar initials={message.initials} color={message.color} />
            <div className="min-w-0 flex-1">
              {message.isSolution && <div className="mb-1 flex items-center gap-1 text-xs font-bold text-green-700">✅ Soluzione</div>}
              <div className={`rounded-2xl rounded-tl-sm border px-3 py-2 text-sm leading-snug text-gray-800 ${message.isSolution ? "border-green-200 bg-green-50" : "border-gray-200 bg-white shadow-sm"}`}>
                <span className="mb-0.5 block text-xs font-semibold text-gray-900">{message.author}</span>
                {message.text ?? <span>{message.textBefore}{message.textBefore ? " " : ""}<MentionPill name={message.mention ?? ""} /> {message.textAfter}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 px-1 text-xs text-gray-400">
                <span>{message.time}</span><span>Rispondi</span><span>{message.liked ? "👍 1" : "👍"}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${message.isSolution ? "bg-blue-600 text-white" : "border border-green-400 text-green-600"}`}>✓ {message.isSolution ? "Soluzione" : "Segna soluzione"}</span>
              </div>
            </div>
          </div>
        ))}
        {showTyping && <div className="ml-10 rounded-2xl bg-white px-4 py-3 text-xs tracking-[.2em] text-gray-400">•••</div>}
      </div>
      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
          <span className="flex-1">Scrivi un commento…</span><span className="font-bold">B</span><span className="italic">I</span><span className="font-mono text-xs">&lt;&gt;</span>
        </div>
      </div>
    </div>
  );
}

export function Current() {
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
            <div className="hidden justify-end lg:flex"><TicketChatMockup /></div>
          </div>
          <div className="mt-12 flex justify-center lg:hidden"><TicketChatMockup /></div>
        </div>
      </section>
    </main>
  );
}
