import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileText,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Users,
} from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "Come si organizza il lavoro dei collaboratori?",
    answer:
      "Ogni attività ha un responsabile, una priorità e uno stato. Le conversazioni restano accanto al lavoro, così il contesto non si disperde.",
  },
  {
    question: "Posso vedere cosa è ancora da completare?",
    answer:
      "Sì. La posta in arrivo raccoglie le attività aperte e il team può aggiornarne lo stato direttamente dalla stessa area.",
  },
  {
    question: "Quanto costa TaskDesk?",
    answer:
      "L’area di lavoro parte da 9 € al mese per collaboratore. Il prezzo comprende assegnazioni, conversazioni e storico delle attività.",
  },
];

function WorkspacePreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-[720px] overflow-hidden rounded-[22px] border border-[#d8d5c8] bg-[#fffdf8] shadow-[0_28px_80px_rgba(23,48,71,.16)]"
      aria-label="Anteprima dell'area di lavoro TaskDesk"
    >
      <div className="flex items-center gap-2 border-b border-[#e8e3d8] bg-[#f8f5ed] px-4 py-3 sm:px-5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e66b5d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f8cf53]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#19a79a]" />
        <span className="ml-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#8b918c] sm:ml-4">
          TaskDesk / Area di lavoro
        </span>
      </div>

      <div className="grid min-h-[370px] grid-cols-[138px_1fr] sm:grid-cols-[178px_1fr]">
        <aside className="border-r border-[#e8e3d8] bg-[#faf8f2] p-3 sm:p-4">
          <div className="mb-7 flex items-center gap-2 text-[11px] font-bold text-[#173047]">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#173047] text-[#f8cf53]">
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="hidden sm:inline">Attività</span>
          </div>
          <div className="space-y-1 text-[10px] sm:text-[11px]">
            <div className="flex items-center justify-between rounded-lg bg-[#dff4ee] px-2 py-2 font-bold text-[#087f78]">
              <span className="flex items-center gap-2">
                <Inbox size={13} />
                <span className="hidden sm:inline">Da fare</span>
              </span>
              <span>12</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-[#78817f]">
              <Clock3 size={13} />
              <span className="hidden sm:inline">In attesa</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2 text-[#78817f]">
              <span className="flex items-center gap-2">
                <CircleCheck size={13} />
                <span className="hidden sm:inline">Completate</span>
              </span>
              <span>48</span>
            </div>
          </div>
          <div className="mt-8 border-t border-[#e8e3d8] pt-4 text-[9px] font-bold uppercase tracking-[.16em] text-[#9a9d98]">
            Team
          </div>
          <div className="mt-3 space-y-3 text-[10px] text-[#69726f] sm:text-[11px]">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-[#e66b5d]" />
              Amministrazione
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-[#19a79a]" />
              Operazioni
            </span>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-[#e8e3d8] px-4 py-3 sm:px-5">
            <div>
              <div className="text-[9px] uppercase tracking-[.15em] text-[#9a9d98]">
                Attività #1048
              </div>
              <div className="mt-1 text-[12px] font-bold text-[#173047] sm:text-sm">
                Chiusura bilancio mensile
              </div>
            </div>
            <MoreHorizontal size={17} className="text-[#87908b]" />
          </div>
          <div className="flex items-center gap-2 border-b border-[#e8e3d8] px-4 py-3 text-[9px] sm:px-5 sm:text-[10px]">
            <span className="rounded-full bg-[#fff1c7] px-2 py-1 font-bold text-[#8c6500]">
              Priorità alta
            </span>
            <span className="hidden rounded-full bg-[#d9efea] px-2 py-1 font-bold text-[#087f78] sm:inline">
              Luca B.
            </span>
            <span className="ml-auto text-[#8b918c]">14 giugno</span>
          </div>
          <div className="space-y-4 bg-[#fffdf8] p-4 sm:p-5">
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7c8bb] text-[9px] font-bold text-[#173047]">
                MR
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[10px]">
                  <b className="text-[#173047]">Marco R.</b>
                  <span className="text-[#9a9d98]">10:12</span>
                </div>
                <div className="rounded-[17px_17px_4px_17px] border border-[#e8e3d8] bg-[#faf8f2] p-3 text-[10px] leading-relaxed text-[#53605e] sm:text-[11px]">
                  Ho caricato i documenti aggiornati per la chiusura.
                </div>
              </div>
            </div>
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f8cf53] text-[9px] font-bold text-[#173047]">
                SL
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[10px]">
                  <b className="text-[#173047]">Sara L.</b>
                  <span className="text-[#9a9d98]">10:18</span>
                </div>
                <div className="rounded-[17px_17px_4px_17px] border border-[#bce3dc] bg-[#edf9f6] p-3 text-[10px] leading-relaxed text-[#53605e] sm:text-[11px]">
                  Elena, controlli i dati e lasci un commento?
                </div>
              </div>
            </div>
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b9d9e9] text-[9px] font-bold text-[#173047]">
                LB
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[10px]">
                  <b className="text-[#173047]">Luca B.</b>
                  <span className="text-[#9a9d98]">10:31</span>
                </div>
                <div className="rounded-[17px_17px_4px_17px] border border-[#9dd6c9] bg-[#dff4ee] p-3 text-[10px] leading-relaxed text-[#355e5a] sm:text-[11px]">
                  <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-[#087f78]">
                    <CircleCheck size={12} />
                    Attività completata
                  </div>
                  Documenti verificati. La pratica è pronta.
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-[#e8e3d8] bg-[#faf8f2] px-4 py-3 text-[10px] text-[#9a9d98] sm:px-5 sm:text-[11px]">
            <Paperclip size={14} />
            <span className="flex-1">Scrivi un aggiornamento…</span>
            <span className="rounded-md bg-[#173047] px-2 py-1 text-[9px] font-bold text-[#fffdf8]">
              Invia
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailFaq({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[#d8d5c8]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-5 py-5 text-left text-sm font-bold text-[#173047] transition-colors hover:text-[#087f78] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f8cf53]"
      >
        <span>{item.question}</span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          className={`shrink-0 text-[#087f78] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="max-w-2xl pb-5 pr-8 text-sm leading-6 text-[#64716e]">{item.answer}</p>}
    </div>
  );
}

export function ProductFirstMinimal() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-[#f6f0e5] text-[#173047]"
      style={{ fontFamily: "var(--app-font-sans)" }}
    >
      <header className="border-b border-[#ddd5c8] bg-[#f6f0e5]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center px-5 sm:px-8">
          <a
            href="#contenuto"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f8cf53]"
            aria-label="Vai al contenuto"
          >
            <img
              src="/__mockup/images/taskdesk-logo.png"
              alt="TaskDesk"
              className="h-auto w-[132px] object-contain sm:w-[148px]"
            />
          </a>
        </div>
      </header>

      <main id="contenuto">
        <section className="border-b border-[#ddd5c8] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
            <div className="max-w-[480px]">
              <h1 className="max-w-[520px] font-serif text-[clamp(3rem,7vw,5.8rem)] leading-[.94] tracking-[-.07em] text-[#173047]">
                Il lavoro del team,
                <span className="block text-[#087f78]">in ordine.</span>
              </h1>
              <p className="mt-7 max-w-[405px] text-[16px] leading-7 text-[#61716f] sm:text-[17px]">
                Assegna attività, condividi il contesto e guarda subito cosa è completo.
              </p>
              <a
                href="/app/"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#e66b5d] px-5 py-3.5 text-sm font-bold text-[#fff9ef] shadow-[4px_5px_0_#b84b3d] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f8cf53] focus-visible:shadow-[4px_5px_0_#b84b3d]"
              >
                Apri il workspace
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>

            <div className="relative isolate">
              <img
                src="/__mockup/images/hero.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] rounded-[28px] object-cover opacity-25 grayscale"
              />
              <div className="relative py-3 sm:py-5">
                <WorkspacePreview />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="In breve" className="border-b border-[#ddd5c8] bg-[#fffdf8] px-5 py-7 sm:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 text-[11px] font-bold uppercase tracking-[.16em] text-[#087f78] sm:grid-cols-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:border-r sm:border-[#d8d5c8] sm:px-7 first:sm:pl-0">
              <Users size={15} aria-hidden="true" />
              Collaboratori allineati
            </div>
            <div className="flex items-center gap-3 sm:border-r sm:border-[#d8d5c8] sm:px-7">
              <FileText size={15} aria-hidden="true" />
              Attività assegnate
            </div>
            <div className="flex items-center gap-3 sm:px-7 sm:last:pr-0">
              <MessageSquare size={15} aria-hidden="true" />
              Stato sempre chiaro
            </div>
          </div>
        </section>

        <section id="dettagli" className="bg-[#eee8dc] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 flex items-end justify-between gap-6 border-b border-[#d0c9bb] pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b84b3d]">Dettagli</p>
                <h2 className="mt-3 font-serif text-4xl tracking-[-.06em] text-[#173047] sm:text-5xl">
                  Quanto serve per iniziare.
                </h2>
              </div>
              <span className="hidden text-right text-xs leading-5 text-[#71807b] sm:block">
                Una vista chiara.<br />Niente di superfluo.
              </span>
            </div>

            <div className="grid gap-14 lg:grid-cols-[.72fr_1.28fr] lg:gap-24">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#7b8580]">Prezzo di partenza</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-serif text-6xl tracking-[-.08em] text-[#173047]">9 €</span>
                  <span className="text-sm text-[#71807b]">/ collaboratore al mese</span>
                </div>
                <p className="mt-5 max-w-[300px] text-sm leading-6 text-[#64716e]">
                  Assegnazioni, conversazioni e stato del lavoro in un unico spazio condiviso.
                </p>
                <a
                  href="/app/"
                  className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#087f78] underline decoration-[#9dd6c9] decoration-2 underline-offset-4 transition-colors hover:text-[#173047] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f8cf53]"
                >
                  Vai al workspace
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#7b8580]">
                  <span className="h-2 w-2 rounded-full bg-[#19a79a]" />
                  Domande frequenti
                </div>
                {faqItems.map((item, index) => (
                  <DetailFaq
                    key={item.question}
                    item={item}
                    open={openFaq === index}
                    onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d8d0c2] bg-[#f6f0e5] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-[11px] text-[#7a8580]">
          <span>TaskDesk</span>
          <span>Organizzare il lavoro, insieme.</span>
        </div>
      </footer>
    </div>
  );
}

export default ProductFirstMinimal;