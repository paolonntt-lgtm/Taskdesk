import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Users,
} from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    question: "Per quali team è pensato TaskDesk?",
    answer:
      "Per aziende, agenzie e team interni che vogliono coordinare attività, responsabilità e scadenze in un unico spazio condiviso.",
  },
  {
    question: "Possiamo organizzare il lavoro per progetto?",
    answer:
      "Sì. Ogni attività vive nel suo progetto, con assegnatari, conversazioni, allegati e una vista chiara di ciò che è aperto o completato.",
  },
  {
    question: "Come funziona la collaborazione?",
    answer:
      "Le persone commentano direttamente sull'attività, ricevono gli aggiornamenti importanti e lasciano una cronologia leggibile per tutto il team.",
  },
];

const taskRows = [
  {
    title: "Rivedere il piano editoriale",
    meta: "Marketing · oggi",
    initials: "LC",
    tone: "bg-[#d9eeea] text-[#1d6f6a]",
    status: "In revisione",
    statusTone: "bg-[#e2f1ee] text-[#23766e]",
  },
  {
    title: "Preparare report vendite Q2",
    meta: "Amministrazione · domani",
    initials: "MB",
    tone: "bg-[#f9dfb6] text-[#8a5d1a]",
    status: "Da iniziare",
    statusTone: "bg-[#fff0d5] text-[#99651a]",
  },
  {
    title: "Approvare il calendario turni",
    meta: "Operazioni · completata",
    initials: "ER",
    tone: "bg-[#e7d9ed] text-[#765385]",
    status: "Completata",
    statusTone: "bg-[#e8e9ee] text-[#626a79]",
  },
];

function TeamAvatar({
  initials,
  tone,
  small = false,
}: {
  initials: string;
  tone: string;
  small?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold ${
        small ? "h-6 w-6 text-[8px]" : "h-8 w-8 text-[10px]"
      } ${tone}`}
      aria-label={`Persona ${initials}`}
    >
      {initials}
    </span>
  );
}

function WorkspaceMockup() {
  return (
    <div
      id="workspace-proof"
      className="relative z-10 overflow-hidden rounded-[20px] border border-[#cdd5d0] bg-[#fffdfa] shadow-[0_22px_55px_rgba(24,42,56,0.16)]"
      aria-label="Anteprima del workspace TaskDesk"
    >
      <div className="flex items-center justify-between border-b border-[#e7e4dd] bg-[#f7f5ef] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#e57b67]" />
          <span className="h-2 w-2 rounded-full bg-[#e7bd55]" />
          <span className="h-2 w-2 rounded-full bg-[#70b6a7]" />
          <span className="ml-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#85918d]">
            taskdesk / workspace
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#568e85]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5eb2a2]" />
          Sincronizzato
        </span>
      </div>

      <div className="grid min-h-[334px] grid-cols-[154px_1fr]">
        <aside className="hidden border-r border-[#e7e4dd] bg-[#faf8f2] p-3.5 sm:block">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-bold text-[#19334a]">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#19334a] text-[#f4cb62]">
              <LayoutDashboard size={12} />
            </span>
            Il mio spazio
          </div>
          <div className="space-y-1 text-[10px] font-semibold">
            <div className="flex items-center justify-between rounded-lg bg-[#dcefea] px-2.5 py-2 text-[#29786f]">
              <span className="flex items-center gap-2">
                <FolderKanban size={12} />
                Attività
              </span>
              <span>12</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#7a8681]">
              <Clock3 size={12} />
              In attesa
            </div>
            <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-[#7a8681]">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={12} />
                Completate
              </span>
              <span>48</span>
            </div>
          </div>
          <div className="mt-7 border-t border-[#e4e1d9] pt-4 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#9ca49f]">
            Progetti
          </div>
          <div className="mt-3 space-y-3 text-[10px] font-semibold text-[#6d7974]">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-[#e77d68]" />
              Piano editoriale
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-[#66aa9e]" />
              Operazioni
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-[#e0b654]" />
              Amministrazione
            </span>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between border-b border-[#e7e4dd] px-4 py-3.5">
            <div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#a0a7a3]">
                Vista del team
              </div>
              <h3 className="mt-1 text-[15px] font-bold tracking-[-0.02em] text-[#19334a]">
                Attività in corso
              </h3>
            </div>
            <button
              type="button"
              aria-label="Altre opzioni"
              className="rounded-md p-1.5 text-[#8d9994] transition-colors hover:bg-[#f0eee8] hover:text-[#19334a]"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-[#e7e4dd] px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#87918c]">
              <span className="rounded-full bg-[#f2eee5] px-2 py-1 text-[#69766f]">Tutte</span>
              <span className="rounded-full px-2 py-1">Assegnate a me</span>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#7d8c86]">
              <Users size={12} />
              8 collaboratori
            </span>
          </div>

          <div className="space-y-2 bg-[#fffdfa] p-3.5">
            {taskRows.map((task) => (
              <div
                key={task.title}
                className="group flex items-center gap-2.5 rounded-xl border border-[#eeeae2] bg-[#fffefa] px-3 py-3 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e1e4de] text-[#78a197]">
                  <Check size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-[#243f53]">{task.title}</p>
                  <p className="mt-1 text-[9px] font-medium text-[#9ca49f]">{task.meta}</p>
                </div>
                <span className={`hidden rounded-full px-2 py-1 text-[9px] font-bold md:inline-flex ${task.statusTone}`}>
                  {task.status}
                </span>
                <TeamAvatar initials={task.initials} tone={task.tone} small />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-[#e7e4dd] bg-[#faf8f2] px-4 py-3 text-[10px] text-[#9aa39e]">
            <Paperclip size={13} />
            <span className="flex-1">Aggiungi un aggiornamento al team…</span>
            <span className="rounded-md bg-[#19334a] px-2 py-1 font-bold text-[#fffdfa]">Invia</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OneScreenEssential() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [notice, setNotice] = useState(false);

  const handlePrimaryAction = () => {
    setNotice(true);
    document.getElementById("workspace-proof")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setNotice(false), 3200);
  };

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-[#f7f4ed] text-[#19334a] selection:bg-[#f1c95c] selection:text-[#19334a]"
      style={{ fontFamily: "'Avenir Next', 'Trebuchet MS', sans-serif" }}
    >
      <header className="relative z-20 border-b border-[#dddcd3] bg-[#f7f4ed]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <a href="#top" className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d39b2d]">
            <img src="/__mockup/taskdesk-logo.png" alt="TaskDesk" className="h-auto w-[128px] object-contain" />
          </a>
          <nav className="hidden items-center gap-7 text-[12px] font-bold text-[#64736e] md:flex" aria-label="Navigazione principale">
            <a className="transition-colors hover:text-[#19334a]" href="#workspace-proof">
              Il workspace
            </a>
            <a className="transition-colors hover:text-[#19334a]" href="#vantaggi">
              Vantaggi
            </a>
            <a className="transition-colors hover:text-[#19334a]" href="#informazioni">
              Prezzi e FAQ
            </a>
          </nav>
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="group inline-flex items-center gap-2 rounded-lg bg-[#19334a] px-3.5 py-2.5 text-[11px] font-bold text-[#fffdfa] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#d39b2d]"
          >
            Vai al workspace
            <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-[#deddd5]">
          <div className="pointer-events-none absolute -right-28 -top-36 h-[440px] w-[440px] rounded-full border border-[#e2c978]/45 bg-[#f2d98b]/25" />
          <div className="pointer-events-none absolute left-[6%] top-[18%] h-1.5 w-1.5 rounded-full bg-[#e77b68]" />
          <div className="mx-auto grid max-w-[1180px] gap-12 px-5 pb-16 pt-14 sm:px-8 md:pb-20 md:pt-20 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-16">
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#418980]">
                <span className="h-2 w-2 rounded-full bg-[#60ad9f]" />
                Un solo spazio condiviso
              </div>
              <h1 className="max-w-[540px] font-serif text-[clamp(3.4rem,7.4vw,6.45rem)] leading-[0.91] tracking-[-0.075em] text-[#19334a]">
                Il lavoro del team,
                <span className="block text-[#398c82]">in ordine.</span>
              </h1>
              <p className="mt-7 max-w-[440px] text-[16px] leading-7 text-[#65736f]">
                TaskDesk riunisce attività, persone e scadenze in un workspace chiaro. Così ogni collaboratore sa cosa fare, quando farlo e dove lasciare il contesto.
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="group inline-flex items-center gap-2 rounded-lg bg-[#e57866] px-5 py-3.5 text-[13px] font-bold text-[#fffaf2] shadow-[5px_5px_0_#c9574d] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0_#c9574d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#d39b2d]"
                >
                  Apri il workspace
                  <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
                <a
                  href="#workspace-proof"
                  className="inline-flex items-center gap-2 text-[12px] font-bold text-[#64736e] underline decoration-[#bdd1c9] decoration-2 underline-offset-4 transition-colors hover:text-[#19334a]"
                >
                  Guarda come funziona
                  <ArrowDownRight size={15} />
                </a>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#87928d]">
                <span className="flex items-center gap-1.5"><Check size={13} className="text-[#398c82]" /> Assegnazioni chiare</span>
                <span className="flex items-center gap-1.5"><Check size={13} className="text-[#398c82]" /> Scadenze visibili</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[650px] lg:pt-7">
              <div className="absolute -right-2 -top-3 hidden h-[170px] w-[220px] overflow-hidden rounded-[18px] border-[6px] border-[#fffdfa] bg-[#dfe3e1] shadow-[0_12px_30px_rgba(24,42,56,0.12)] sm:block md:-right-5 md:-top-1">
                <img src="/images/hero.png" alt="" className="h-full w-full object-cover object-center opacity-80" />
              </div>
              <div className="relative mx-auto w-[calc(100%-10px)] sm:w-[calc(100%-28px)]">
                <WorkspaceMockup />
                <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-[#d4ded9] bg-[#fffdfa] px-3 py-2 text-[10px] font-bold text-[#337c74] shadow-[0_10px_22px_rgba(24,42,56,0.11)] sm:flex">
                  <CheckCircle2 size={14} />
                  Il team ha chiuso 48 attività
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="vantaggi" className="border-b border-[#deddd5] bg-[#eef4ef] px-5 py-14 sm:px-8 md:py-16">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#418980]">Il punto di partenza</p>
                <h2 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] leading-none tracking-[-0.055em] text-[#19334a]">Meno passaggi. Più lavoro fatto.</h2>
              </div>
              <MessageSquare className="hidden h-8 w-8 text-[#86b9ab] sm:block" strokeWidth={1.5} />
            </div>
            <div className="grid border-y border-[#cbdcd5] md:grid-cols-3">
              <article className="border-b border-[#cbdcd5] py-6 md:border-b-0 md:border-r md:pr-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#df7565]">01</span>
                  <Users size={19} className="text-[#418980]" />
                </div>
                <h3 className="text-[17px] font-bold tracking-[-0.03em]">Responsabilità in vista</h3>
                <p className="mt-2 max-w-[270px] text-[13px] leading-6 text-[#6b7b74]">Ogni attività ha un nome, un referente e il contesto giusto per partire senza rincorrersi.</p>
              </article>
              <article className="border-b border-[#cbdcd5] py-6 md:border-b-0 md:border-r md:px-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#df7565]">02</span>
                  <CalendarDays size={19} className="text-[#418980]" />
                </div>
                <h3 className="text-[17px] font-bold tracking-[-0.03em]">Scadenze che tengono il passo</h3>
                <p className="mt-2 max-w-[270px] text-[13px] leading-6 text-[#6b7b74]">Le priorità sono leggibili, gli aggiornamenti arrivano dove servono, il lavoro non si perde.</p>
              </article>
              <article className="py-6 md:pl-7">
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#df7565]">03</span>
                  <CheckCircle2 size={19} className="text-[#418980]" />
                </div>
                <h3 className="text-[17px] font-bold tracking-[-0.03em]">Una fine, non solo un inizio</h3>
                <p className="mt-2 max-w-[270px] text-[13px] leading-6 text-[#6b7b74]">La cronologia conserva ciò che è stato fatto, così il team può avanzare con fiducia.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="informazioni" className="bg-[#19334a] px-5 py-14 text-[#f8f5ed] sm:px-8 md:py-18">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-col gap-3 border-b border-[#466071] pb-8 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0c95e]">Informazioni</p>
                <h2 className="mt-3 max-w-[520px] font-serif text-[clamp(2.2rem,4vw,3.7rem)] leading-[0.95] tracking-[-0.06em]">Scegli lo spazio che serve al tuo team.</h2>
              </div>
              <p className="max-w-[300px] text-[13px] leading-6 text-[#adc0ba]">Un’informazione chiara prima di iniziare: prezzi leggibili e risposte alle domande più frequenti.</p>
            </div>
            <div className="grid gap-10 pt-9 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
              <div className="border border-[#496473] bg-[#223e51] p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#a9c2ba]">Piano team</span>
                  <span className="rounded-full bg-[#f0c95e] px-2.5 py-1 font-mono text-[9px] font-bold text-[#19334a]">Più scelto</span>
                </div>
                <div className="mt-8 flex items-end gap-2">
                  <strong className="font-serif text-6xl leading-none tracking-[-0.08em] text-[#fffaf1]">€8</strong>
                  <span className="pb-1 text-[11px] text-[#b2c2bc]">per persona / mese</span>
                </div>
                <p className="mt-4 max-w-[280px] text-[13px] leading-6 text-[#b2c2bc]">Tutto il necessario per coordinare attività, conversazioni e scadenze in modo condiviso.</p>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#e57866] px-4 py-3 text-[12px] font-bold text-[#fffaf2] transition-colors hover:bg-[#ee8d78] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#f0c95e]"
                >
                  Parliamone
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div>
                <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#a9c2ba]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f0c95e]" />
                  Domande frequenti
                </div>
                <div className="divide-y divide-[#496473] border-y border-[#496473]">
                  {faqItems.map((item, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={item.question}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          className="flex w-full items-center justify-between gap-4 py-5 text-left text-[14px] font-bold text-[#f8f5ed] transition-colors hover:text-[#f0c95e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c95e]"
                        >
                          {item.question}
                          <ChevronDown size={17} className={`shrink-0 text-[#8eaba1] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && <p className="max-w-[620px] pb-5 pr-7 text-[13px] leading-6 text-[#b2c2bc]">{item.answer}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#f7f4ed] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b9691] sm:flex-row sm:items-center sm:justify-between">
          <span>TaskDesk · Organizzazione del lavoro condiviso</span>
          <span className="flex items-center gap-2"><Plus size={12} className="text-[#e57866]" /> Fatto insieme, meglio.</span>
        </div>
      </footer>

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#bdd8ce] bg-[#fffdfa] px-4 py-3 text-[12px] font-bold text-[#28786f] shadow-[0_14px_32px_rgba(24,42,56,0.16)]"
        >
          <CheckCircle2 size={15} />
          Workspace pronto per il tuo team.
        </div>
      )}
    </div>
  );
}

export default OneScreenEssential;