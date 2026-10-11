import { ArrowRight, Check, Mail, MessageCircle, Search, UserRound, X } from "lucide-react";
import { TicketChatMockup } from "./Current";
import "./_group.css";

const scenarios = [
  { icon: MessageCircle, text: "Un messaggio WhatsApp dimenticato", number: "01" },
  { icon: UserRound, text: "Una richiesta senza responsabile", number: "02" },
  { icon: Search, text: "Una soluzione che nessuno riesce più a trovare", number: "03" },
];

export function FreshHero() {
  return (
    <main className="taskdesk-hero-root min-h-[100dvh] overflow-hidden bg-[#f5f2e9] text-[#183b37]">
      <section className="relative isolate min-h-[760px] overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_76%_45%,#e8e5d5_0%,#f5f2e9_48%,#f5f2e9_100%)]" />
        <div className="pointer-events-none absolute -right-28 top-16 -z-10 h-[650px] w-[650px] rounded-full border border-[#d6d4c8] opacity-70" />
        <div className="pointer-events-none absolute -right-12 top-32 -z-10 h-[520px] w-[520px] rounded-full border border-[#d6d4c8] opacity-55" />
        <div className="pointer-events-none absolute bottom-[-210px] left-[-150px] -z-10 h-[430px] w-[430px] rounded-full bg-[#e8dfc7]/55 blur-3xl" />

        <div className="mx-auto max-w-[1360px] px-6 pb-10 pt-6 sm:px-10 lg:px-16 lg:pb-10 lg:pt-7">
          <nav className="mb-9 flex items-center justify-between sm:mb-12" aria-label="Navigazione">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183b37] text-[#f5f2e9]">
                <span className="text-lg font-black tracking-[-.1em]">td</span>
              </span>
              <span className="text-[19px] font-extrabold tracking-[-.05em]">taskdesk</span>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-[#d9d7cc] bg-[#f8f6f0]/80 px-4 py-2 text-xs font-semibold tracking-wide text-[#65736c] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b16d48]" />
              IL LAVORO, FINALMENTE IN ORDINE
            </span>
          </nav>

          <div className="grid items-center gap-9 lg:grid-cols-[1.04fr_.96fr] lg:gap-6">
            <div className="relative z-10 max-w-[650px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8d4c7] bg-[#f8f6ef] px-3.5 py-2 text-xs font-bold text-[#49625a] shadow-[0_3px_12px_#314c3b0b]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#dce8d9] text-[#365847]"><Check size={12} strokeWidth={3} /></span>
                7 giorni di prova, senza pensieri
              </div>

              <h1 className="mb-5 max-w-[680px] text-[clamp(2.3rem,4.2vw,3.6rem)] font-black leading-[1.01] tracking-[-.065em] text-[#183b37]">
                Ti è mai capitato di sapere che qualcuno ne aveva parlato,
                <span className="relative mt-1 block font-['Fraunces',Georgia,serif] font-medium italic tracking-[-.055em] text-[#b16d48]">
                  ma non ricordare dove?
                  <svg className="absolute -bottom-3 left-0 h-3 w-[78%]" viewBox="0 0 460 14" fill="none" aria-hidden="true">
                    <path d="M3 10C100 2 267 1 456 8" stroke="#d9a47d" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="mb-4 max-w-[470px] text-[15px] leading-6 text-[#65736c]">
                Chat, email, memoria. Le richieste importanti si perdono nel rumore — finché non c’è un posto solo per ritrovarle.
              </p>

              <ul aria-label="Situazioni quotidiane" className="mb-5 max-w-[520px]">
                {scenarios.map(({ icon: Icon, text, number }) => (
                  <li key={number} className="group flex items-center gap-4 border-t border-[#d9d7cc] py-2.5 first:border-t-0">
                    <span className="w-7 font-mono text-[10px] tracking-wider text-[#ad795d]">{number}</span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e9e5d9] text-[#66776b] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="text-[14px] font-semibold tracking-[-.015em] text-[#344f47]">{text}</span>
                    <X size={14} className="ml-auto text-[#c1bdb0]" aria-hidden="true" />
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button className="group flex items-center justify-center gap-4 rounded-xl bg-[#b16d48] px-6 py-3.5 text-[15px] font-bold text-[#fffaf0] shadow-[0_10px_24px_#a9684440] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#9e5e3d] hover:shadow-[0_14px_28px_#a968444a]">
                  Inizia gratis — 7 giorni
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <span className="text-xs font-medium text-[#77827a]">Attivi in pochi minuti</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-[#68756d]">
                <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#6e8a68]" />Nessuna carta di credito</span>
                <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-[#6e8a68]" />Cancella quando vuoi</span>
              </div>
              <p className="mt-4 text-[11px] font-medium tracking-[.015em] text-[#889087]">
                Usato da studi commerciali, agenzie e consulenti in tutta Italia
              </p>
            </div>

            <div className="relative flex min-h-[500px] items-center justify-center lg:min-h-[570px]">
              <div className="absolute right-[4%] top-[9%] h-[440px] w-[440px] rounded-full bg-[#e2e6d7] opacity-75" />
              <div className="absolute right-[13%] top-[17%] h-[350px] w-[350px] rounded-full border border-[#c5cabb]" />
              <div className="absolute left-[6%] top-[17%] z-10 flex items-center gap-2 rounded-full border border-[#dedace] bg-[#f8f6ef] px-3 py-2 text-[10px] font-semibold text-[#66756c] shadow-sm">
                <Mail size={13} className="text-[#b16d48]" /> email
                <span className="mx-1 text-[#c7c2b6]">+</span>
                <MessageCircle size={13} className="text-[#82937b]" /> chat
              </div>
              <div className="relative z-10 w-full max-w-[380px] translate-x-1 lg:translate-x-4">
                <TicketChatMockup lang="it" />
              </div>
              <div className="absolute bottom-[8%] right-[4%] z-20 flex items-center gap-2 rounded-xl border border-[#d8d8ca] bg-[#f8f6ef] px-3.5 py-3 shadow-[0_8px_30px_#30483b15]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dce8d9] text-[#45644d]"><Check size={14} strokeWidth={2.5} /></span>
                <span><span className="block text-[10px] font-bold text-[#28453d]">Soluzione trovata</span><span className="block text-[9px] text-[#879087]">e salvata per il team</span></span>
              </div>
              <span className="absolute bottom-[2%] left-[10%] font-mono text-[9px] uppercase tracking-[.18em] text-[#9a9c8e]">Ogni richiesta, al suo posto</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
