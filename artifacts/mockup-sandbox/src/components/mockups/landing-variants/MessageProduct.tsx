import React, { useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronDown, CircleCheck, Clock3, MessageSquare, Users } from "lucide-react";

const capabilities = [
  {
    number: "01",
    icon: Users,
    title: "Assegna con chiarezza",
    text: "Ogni attività ha un responsabile, una priorità e una scadenza visibile a tutto il gruppo.",
    tone: "coral",
  },
  {
    number: "02",
    icon: MessageSquare,
    title: "Parlate nello stesso posto",
    text: "Commenti, decisioni e file restano accanto al lavoro a cui si riferiscono.",
    tone: "teal",
  },
  {
    number: "03",
    icon: CircleCheck,
    title: "Chiudete il cerchio",
    text: "Lo stato aggiornato racconta cosa è in corso, cosa aspetta e cosa è già concluso.",
    tone: "yellow",
  },
];

const faqs = [
  {
    question: "Per quali team è pensato TaskDesk?",
    answer: "Per studi, agenzie e team interni che vogliono coordinare attività ricorrenti e progetti quotidiani senza distribuire il lavoro tra chat, fogli e caselle email.",
  },
  {
    question: "Possiamo organizzare più gruppi nello stesso spazio?",
    answer: "Sì. Puoi tenere insieme più team e aree di lavoro, mantenendo assegnatari, priorità e conversazioni nel loro contesto.",
  },
  {
    question: "Cosa succede quando un'attività è completata?",
    answer: "Resta nello storico del workspace con i commenti e i file collegati, così il team può ritrovare il percorso senza ricostruirlo.",
  },
];

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[820px]" id="workspace">
      <div className="absolute -inset-6 rounded-[2rem] bg-[#a8d8d1]/30 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[1.35rem] border border-[#d8d4cf] bg-[#fbfaf7] shadow-[0_28px_70px_rgba(22,39,61,.17)]">
        <div className="flex items-center gap-2 border-b border-[#e4e0da] bg-[#f4f1ec] px-4 py-3 sm:px-5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ee876f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e8c56a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#73b8a9]" />
          <span className="ml-2 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#89918d] sm:ml-4">taskdesk / workspace</span>
          <span className="ml-auto flex items-center gap-1.5 text-[9px] font-bold text-[#2d8b7e]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2d9d8c]" /> Sincronizzato
          </span>
        </div>
        <div className="grid min-h-[360px] grid-cols-1 sm:grid-cols-[172px_1fr]">
          <aside className="hidden border-r border-[#e4e0da] bg-[#f8f6f1] p-4 sm:block">
            <div className="mb-7 flex items-center gap-2 text-[11px] font-extrabold text-[#1d344c]">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1d344c] text-[10px] text-[#f7ca61]">T</span>
              Il mio spazio
            </div>
            <div className="space-y-1.5 text-[10px] font-semibold text-[#7d8783]">
              <div className="flex items-center justify-between rounded-lg bg-[#dff1ed] px-2.5 py-2.5 text-[#237d72]"><span className="flex items-center gap-2"><Clock3 size={12} /> In corso</span><b>8</b></div>
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2.5"><span className="flex items-center gap-2"><CircleCheck size={12} /> Completate</span><b>42</b></div>
              <div className="rounded-lg px-2.5 py-2.5">In attesa</div>
            </div>
            <div className="mt-8 border-t border-[#e4e0da] pt-4 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#a0a6a2]">Team</div>
            <div className="mt-3 space-y-3 text-[10px] font-semibold text-[#68746f]">
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e98572]" /> Amministrazione</span>
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#55a99e]" /> Progetto Atlas</span>
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e4b84d]" /> Comunicazione</span>
            </div>
          </aside>
          <div className="min-w-0">
            <div className="flex items-center justify-between border-b border-[#e4e0da] px-4 py-3.5 sm:px-5">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[.14em] text-[#a0a6a2]">Attività #2481</div>
                <div className="mt-1 text-[13px] font-extrabold text-[#1d344c] sm:text-[15px]">Preparare il report di avanzamento</div>
              </div>
              <span className="rounded-md border border-[#dedad3] px-2 py-1 text-[9px] font-bold text-[#85908b]">•••</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e0da] px-4 py-3 sm:px-5">
              <span className="rounded-full bg-[#fbe6de] px-2.5 py-1 text-[9px] font-extrabold text-[#b95d4c]">Priorità alta</span>
              <span className="rounded-full bg-[#dff1ed] px-2.5 py-1 text-[9px] font-extrabold text-[#237d72]">Assegnata a Luca B.</span>
              <span className="ml-auto text-[9px] font-semibold text-[#909994]">Scade il 14 giugno</span>
            </div>
            <div className="space-y-4 bg-[#fffefa] p-4 sm:p-5">
              <div className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3c9bd] text-[9px] font-extrabold text-[#1d344c]">MR</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[9px]"><b className="text-[#1d344c]">Marco R.</b><span className="text-[#a0a6a2]">09:42</span></div>
                  <p className="rounded-[1rem_1rem_.3rem_1rem] border border-[#e8e1d9] bg-[#f8f6f1] p-3 text-[10px] leading-relaxed text-[#5d6965]">Ho raccolto i dati del mese. Potete controllare la prima bozza?</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2cf69] text-[9px] font-extrabold text-[#1d344c]">SL</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[9px]"><b className="text-[#1d344c]">Sara L.</b><span className="text-[#a0a6a2]">10:08</span></div>
                  <p className="rounded-[1rem_1rem_.3rem_1rem] border border-[#c9e4df] bg-[#edf8f5] p-3 text-[10px] leading-relaxed text-[#4f6964]">Controllo io la sezione economica. Luca, quando è pronta aggiorna il riepilogo.</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b9d7e4] text-[9px] font-extrabold text-[#1d344c]">LB</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[9px]"><b className="text-[#1d344c]">Luca B.</b><span className="text-[#a0a6a2]">10:31</span></div>
                  <div className="rounded-[1rem_1rem_.3rem_1rem] border border-[#b4ddd4] bg-[#e3f4ef] p-3 text-[10px] leading-relaxed text-[#41645f]">
                    <div className="mb-1.5 flex items-center gap-1 text-[9px] font-extrabold text-[#237d72]"><CircleCheck size={11} /> Attività completata</div>
                    Report aggiornato e pronto per la riunione.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#e4e0da] bg-[#f8f6f1] px-4 py-3 text-[10px] text-[#9aa19d] sm:px-5"><span className="flex-1">Scrivi un aggiornamento…</span><span className="rounded-md bg-[#1d344c] px-2.5 py-1.5 font-bold text-[#fffefa]">Invia</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageProduct() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f6f1e8] text-[#1d344c]" style={{ fontFamily: "var(--app-font-sans, 'Avenir Next', 'Trebuchet MS', sans-serif)" }}>
      <style>{`
        @keyframes message-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes message-drift { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        .message-rise { animation: message-rise .75s cubic-bezier(.16,1,.3,1) both; }
        .message-delay-1 { animation-delay: .1s; }
        .message-delay-2 { animation-delay: .2s; }
        .message-drift { animation: message-drift 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .message-rise, .message-drift { animation: none !important; } }
      `}</style>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="#top" className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7846e]" aria-label="TaskDesk, torna all'inizio">
          <img src="/__mockup/taskdesk-logo.png" alt="TaskDesk" className="h-8 w-auto object-contain sm:h-9" />
        </a>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[#84908a]">Workspace condiviso</span>
      </header>

      <main id="top">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="grid items-end gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <div className="message-rise">
              <p className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#2f8b80]"><span className="h-2 w-2 rounded-full bg-[#e7846e]" /> Organizzazione interna</p>
              <h1 className="max-w-[600px] font-serif text-[clamp(3rem,7vw,6rem)] leading-[.92] tracking-[-.065em] text-[#1d344c]">Il lavoro del team, <em className="not-italic text-[#2f8b80]">in ordine.</em></h1>
              <p className="mt-7 max-w-[470px] text-[16px] leading-7 text-[#64716e] sm:text-[18px]">TaskDesk riunisce attività, persone e conversazioni in uno spazio condiviso. Sapete chi fa cosa, entro quando, e cosa è già stato completato.</p>
              <a href="#workspace" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#e7846e] px-5 py-3.5 text-[13px] font-extrabold text-[#fffaf2] shadow-[5px_6px_0_#bd6052] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1d344c]">
                Guarda il workspace <ArrowDown size={16} />
              </a>
            </div>
            <div className="message-rise message-delay-1 relative hidden min-h-[230px] overflow-hidden rounded-[1.25rem] border border-[#d8d4cf] lg:block">
              <img src="/images/hero.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center grayscale-[.15]" />
              <div className="absolute inset-0 bg-[#1d344c]/35" />
              <div className="absolute bottom-5 left-5 max-w-[260px] border-l-2 border-[#f2cf69] pl-4 text-[12px] font-semibold leading-5 text-[#fffaf2]">Un punto di riferimento per il lavoro che succede ogni giorno.</div>
              <div className="message-drift absolute right-5 top-5 rounded-lg bg-[#fffaf2]/95 px-3 py-2 text-[10px] font-extrabold text-[#1d344c] shadow-lg"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#2f9d8c]" /> Team online</div>
            </div>
          </div>
          <div className="message-rise message-delay-2 mt-14 sm:mt-20"><WorkspacePreview /></div>
        </section>

        <section className="border-y border-[#dcd6cc] bg-[#fffdf9] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#c26454]">Il minimo necessario</p>
                <h2 className="mt-3 max-w-[520px] font-serif text-4xl leading-[.98] tracking-[-.05em] sm:text-5xl">Meno passaggi.<br />Più lavoro chiuso.</h2>
              </div>
              <p className="max-w-[260px] text-sm leading-6 text-[#74807b]">Un flusso leggibile per chi coordina e per chi porta avanti le attività.</p>
            </div>
            <div className="grid gap-0 border-t border-[#ddd8d0] md:grid-cols-[1.15fr_.95fr_.85fr]">
              {capabilities.map((capability, index) => {
                const Icon = capability.icon;
                return (
                  <article key={capability.number} className={`border-b border-[#ddd8d0] py-7 md:border-b-0 md:py-8 ${index > 0 ? "md:border-l md:pl-7" : "md:pr-8"}`}>
                    <div className="flex items-center justify-between"><span className={`font-mono text-[11px] font-bold ${capability.tone === "coral" ? "text-[#c26454]" : capability.tone === "teal" ? "text-[#2f8b80]" : "text-[#ae8b30]"}`}>{capability.number}</span><Icon size={19} className={capability.tone === "coral" ? "text-[#e7846e]" : capability.tone === "teal" ? "text-[#2f8b80]" : "text-[#d0ae43]"} /></div>
                    <h3 className="mt-12 text-[19px] font-extrabold tracking-[-.03em]">{capability.title}</h3>
                    <p className="mt-3 max-w-[280px] text-[13px] leading-6 text-[#71807b]">{capability.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="informazioni" className="bg-[#1d344c] px-5 py-16 text-[#f6f1e8] sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#f2cf69]">Informazioni</p>
                <h2 className="mt-4 max-w-[420px] font-serif text-4xl leading-[.98] tracking-[-.05em] sm:text-5xl">Scegliete il ritmo del vostro team.</h2>
                <p className="mt-5 max-w-[340px] text-sm leading-6 text-[#b8c4c0]">Un piano chiaro per ogni dimensione di lavoro, con lo stesso spazio ordinato per tutti.</p>
                <div className="mt-8 flex items-center gap-2 text-[11px] font-bold text-[#d8e4df]"><Check size={15} className="text-[#76c9b6]" /> Tutti i piani includono attività, commenti e storico</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="border border-[#456076] bg-[#27445c] p-6">
                  <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#aabcb8]">Team</span>
                  <div className="mt-5 flex items-baseline gap-1"><strong className="font-serif text-5xl tracking-[-.07em]">€35</strong><span className="text-xs text-[#b8c4c0]">/ mese</span></div>
                  <p className="mt-3 text-xs leading-5 text-[#b8c4c0]">Per gruppi che vogliono un unico punto di coordinamento.</p>
                  <div className="mt-6 border-t border-[#456076] pt-4 text-[11px] font-semibold text-[#d8e4df]">Fino a 10 collaboratori</div>
                </article>
                <article className="border border-[#e7846e] bg-[#f6f1e8] p-6 text-[#1d344c]">
                  <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#c26454]">Studio</span>
                  <div className="mt-5 flex items-baseline gap-1"><strong className="font-serif text-5xl tracking-[-.07em]">€79</strong><span className="text-xs text-[#687570]">/ mese</span></div>
                  <p className="mt-3 text-xs leading-5 text-[#687570]">Per team che gestiscono più flussi di lavoro insieme.</p>
                  <div className="mt-6 border-t border-[#ddd6ca] pt-4 text-[11px] font-semibold text-[#41645f]">Fino a 25 collaboratori</div>
                </article>
              </div>
            </div>

            <div className="mt-16 border-t border-[#456076] pt-10">
              <div className="mb-7 flex items-end justify-between gap-5">
                <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#f2cf69]">Domande frequenti</p><h2 className="mt-3 font-serif text-3xl tracking-[-.04em]">Prima di iniziare</h2></div>
                <ArrowRight size={20} className="hidden text-[#76c9b6] sm:block" />
              </div>
              <div className="divide-y divide-[#456076] border-y border-[#456076]">
                {faqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div key={faq.question}>
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left text-[14px] font-bold text-[#f6f1e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2cf69]">
                        {faq.question}<ChevronDown size={17} className={`shrink-0 text-[#76c9b6] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && <p className="max-w-2xl pb-5 pr-8 text-[13px] leading-6 text-[#b8c4c0]">{faq.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-3 bg-[#f6f1e8] px-5 py-6 text-[10px] font-semibold uppercase tracking-[.14em] text-[#86908b] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>TaskDesk · lavoro condiviso, finalmente leggibile</span>
        <span>© 2024 TaskDesk</span>
      </footer>
    </div>
  );
}