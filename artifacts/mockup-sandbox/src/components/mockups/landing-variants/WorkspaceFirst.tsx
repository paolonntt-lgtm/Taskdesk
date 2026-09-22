import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Workspace", href: "#workspace" },
  { label: "Come funziona", href: "#outcomes" },
  { label: "Dettagli", href: "#details" },
];

const TASKS = [
  { title: "Rivedere il piano editoriale", person: "Chiara M.", initials: "CM", tone: "bg-[#e9d9ff] text-[#63408a]", tag: "Marketing", date: "Oggi", status: "In corso", statusTone: "text-[#996019] bg-[#fff1cc]" },
  { title: "Preparare report mensile", person: "Davide R.", initials: "DR", tone: "bg-[#cbe8e5] text-[#1d6765]", tag: "Amministrazione", date: "Dom 18", status: "Da iniziare", statusTone: "text-[#536274] bg-[#edf0f3]" },
  { title: "Confermare materiali per evento", person: "Elisa P.", initials: "EP", tone: "bg-[#f9d9d2] text-[#9a463c]", tag: "Operativo", date: "Lun 19", status: "In revisione", statusTone: "text-[#225f65] bg-[#dff0ef]" },
];

const FAQS = [
  {
    question: "Per quali team è pensato TaskDesk?",
    answer: "Per studi, agenzie e team interni che vogliono tenere nello stesso spazio attività, responsabilità, conversazioni e scadenze.",
  },
  {
    question: "Come si organizza il lavoro di una squadra?",
    answer: "Ogni attività ha un responsabile, una data e un contesto. Il team può commentare, aggiornare lo stato e ritrovare lo storico senza rincorrere messaggi sparsi.",
  },
  {
    question: "Posso cambiare piano in seguito?",
    answer: "Sì. Il piano può essere aggiornato quando cambiano le dimensioni o il modo di lavorare del team.",
  },
];

const ASSET_BASE = "/__mockup/images";

function BrandMark() {
  return (
    <img
      src={`${ASSET_BASE}/taskdesk-logo.png`}
      alt="TaskDesk"
      className="h-auto w-[142px] object-contain"
    />
  );
}

function Avatar({ initials, tone }: { initials: string; tone: string }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${tone}`}>
      {initials}
    </span>
  );
}

function WorkspacePanel() {
  return (
    <div className="relative mx-auto w-full max-w-[1060px]">
      <div className="absolute -inset-5 rounded-[32px] bg-[#b9a7f2]/15 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[20px] border border-[#dce2ec] bg-[#fbfcfe] shadow-[0_28px_80px_rgba(39,45,71,.18)]">
        <div className="flex h-11 items-center justify-between border-b border-[#e5e8ef] bg-[#f4f6fa] px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f2a09b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f1ce76]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#84cbbd]" />
            <span className="ml-2 hidden font-mono text-[9px] font-bold tracking-[.16em] text-[#8992a2] sm:inline">TASKDESK / WORKSPACE</span>
          </div>
          <div className="flex items-center gap-3 text-[#8992a2]">
            <Search size={14} />
            <MoreHorizontal size={16} />
          </div>
        </div>

        <div className="grid min-h-[455px] md:grid-cols-[190px_1fr]">
          <aside className="hidden border-r border-[#e5e8ef] bg-[#f7f8fb] p-4 md:block">
            <div className="mb-8 flex items-center gap-2 text-[11px] font-bold text-[#28344a]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#273452] text-[#f5c969]"><LayoutDashboard size={12} /></span>
              Il tuo spazio
            </div>
            <div className="space-y-1.5 text-[11px] font-semibold text-[#7c8798]">
              <div className="flex items-center gap-2 rounded-lg bg-[#e6e1fb] px-2.5 py-2.5 text-[#5c4c99]"><FolderKanban size={14} /> Attività <span className="ml-auto text-[10px]">24</span></div>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-2.5"><Users size={14} /> Collaboratori</div>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-2.5"><CalendarDays size={14} /> Calendario</div>
            </div>
            <div className="mt-8 border-t border-[#e4e7ed] pt-5 text-[9px] font-bold uppercase tracking-[.15em] text-[#a3aab5]">Progetti</div>
            <div className="mt-4 space-y-3 text-[11px] font-semibold text-[#788497]">
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e69e94]" /> Piano editoriale</span>
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#83c8c0]" /> Operatività</span>
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#a797de]" /> Amministrazione</span>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8ef] px-4 py-4 sm:px-6">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#9aa2af]">Panoramica team</p>
                <h3 className="mt-1 text-base font-bold tracking-[-.02em] text-[#28344a]">Lavoro della settimana</h3>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#293653] px-3 py-2 text-[10px] font-bold text-[#fffdf9] transition-transform hover:-translate-y-0.5" onClick={() => document.getElementById("details")?.scrollIntoView({ behavior: "smooth" })}>
                <Plus size={13} /> Nuova attività
              </button>
            </div>
            <div className="grid gap-3 border-b border-[#e5e8ef] bg-[#fbfcfe] p-4 sm:grid-cols-3 sm:px-6">
              <div className="rounded-xl border border-[#e3e6ee] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#9ca5b3]">Da completare</p><p className="mt-2 text-2xl font-bold text-[#293653]">24</p><p className="mt-1 text-[10px] text-[#7f8999]">nel team</p></div>
              <div className="rounded-xl border border-[#e3e6ee] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#9ca5b3]">In scadenza</p><p className="mt-2 text-2xl font-bold text-[#b06f2c]">06</p><p className="mt-1 text-[10px] text-[#7f8999]">entro venerdì</p></div>
              <div className="rounded-xl border border-[#e3e6ee] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#9ca5b3]">Completate</p><p className="mt-2 text-2xl font-bold text-[#328378]">18</p><p className="mt-1 text-[10px] text-[#7f8999]">questa settimana</p></div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#8993a2]">Attività assegnate</p>
                <button type="button" className="text-[10px] font-bold text-[#6658a5] hover:underline" onClick={() => document.getElementById("outcomes")?.scrollIntoView({ behavior: "smooth" })}>Vedi tutte</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#e5e8ef]">
                {TASKS.map((task, index) => (
                  <div key={task.title} className={`grid gap-3 px-3 py-3.5 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-4 ${index > 0 ? "border-t border-[#edf0f4]" : ""}`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${index === 0 ? "bg-[#d9d2f4] text-[#64559b]" : "bg-[#edf0f4] text-[#7c8798]"}`}><CircleDot size={14} /></span>
                      <div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#354158]">{task.title}</p><p className="mt-1 text-[10px] text-[#929aa8]">{task.tag}</p></div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#707c8f]"><Avatar initials={task.initials} tone={task.tone} /><span className="hidden lg:inline">{task.person}</span></div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.statusTone}`}>{task.status}</span><span className="flex items-center gap-1 text-[10px] text-[#8993a2]"><Clock3 size={12} /> {task.date}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f4f1ff] px-3 py-3 text-[10px] text-[#655a8d]">
                <span className="flex items-center gap-2 font-semibold"><MessageCircle size={14} /> 4 aggiornamenti da leggere</span>
                <span className="font-bold">Apri attività <ArrowRight size={12} className="ml-1 inline" /></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceFirst() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f7f6f3] text-[#28344a]" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-50 border-b border-[#e5e4e1] bg-[#f7f6f3]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <a href="#top" aria-label="TaskDesk, torna all'inizio"><BrandMark /></a>
          <nav className="hidden items-center gap-8 text-[12px] font-bold text-[#788194] md:flex" aria-label="Navigazione principale">
            {NAV_ITEMS.map((item) => <a key={item.href} href={item.href} className="transition-colors hover:text-[#6658a5]">{item.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <a href="#details" className="hidden rounded-lg px-3 py-2 text-[12px] font-bold text-[#566176] transition-colors hover:bg-[#eceaf5] sm:inline-flex">Accedi</a>
            <button type="button" onClick={() => scrollTo("details")} className="hidden rounded-lg bg-[#293653] px-4 py-2.5 text-[11px] font-bold text-[#fffdf9] shadow-[0_5px_0_#cbc7dc] transition-transform hover:-translate-y-0.5 sm:inline-flex">Parliamone <ArrowRight size={14} /></button>
            <button type="button" aria-label={mobileMenuOpen ? "Chiudi menu" : "Apri menu"} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-lg p-2 text-[#45526c] md:hidden">{mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}</button>
          </div>
        </div>
        {mobileMenuOpen && <nav className="border-t border-[#e5e4e1] bg-[#f7f6f3] px-5 py-3 md:hidden" aria-label="Navigazione mobile">{NAV_ITEMS.map((item) => <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="block border-b border-[#e9e7e4] py-3 text-sm font-bold text-[#566176]">{item.label}</a>)}</nav>}
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-[#e5e4e1] bg-[#f7f6f3] px-5 pb-14 pt-16 sm:px-8 sm:pt-24 lg:pb-20">
          <div className="pointer-events-none absolute -right-24 -top-28 h-[480px] w-[480px] rounded-full border border-[#ded9ef] bg-[#ece8fb]/45" />
          <div className="pointer-events-none absolute left-[8%] top-[30%] h-24 w-24 rounded-full border border-[#e3d4b8] bg-[#f4e8d3]/50" />
          <div className="relative mx-auto max-w-[1240px]">
            <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
              <div className="max-w-[530px]">
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dcd7ed] bg-[#f0eefb] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#6558a0]"><span className="h-1.5 w-1.5 rounded-full bg-[#8d7ed0]" /> Il lavoro, in uno spazio condiviso</div>
                <h1 className="max-w-[560px] text-[clamp(3.25rem,7vw,6.6rem)] font-semibold leading-[.91] tracking-[-.075em] text-[#293653]">Il team vede<br /><span className="text-[#7565b0]">il lavoro.</span></h1>
                <p className="mt-7 max-w-[430px] text-[16px] leading-7 text-[#697589]">TaskDesk riunisce attività, persone, scadenze e conversazioni in un workspace che tutti capiscono al primo sguardo.</p>
                <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => scrollTo("workspace")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#293653] px-5 py-3.5 text-[12px] font-bold text-[#fffdf9] shadow-[0_6px_0_#cfc9e4] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_#cfc9e4]">Guarda il workspace <ArrowRight size={15} /></button>
                  <a href="#outcomes" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-[12px] font-bold text-[#6d7890] transition-colors hover:text-[#6658a5]">Come funziona <ArrowRight size={14} /></a>
                </div>
                <div className="mt-9 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#9aa1ad]"><CheckCircle2 size={15} className="text-[#4a9d91]" /> Responsabilità chiare, meno passaggi persi</div>
              </div>
              <div className="relative pt-4 lg:pt-10">
                <div className="absolute -right-2 top-0 hidden -rotate-2 rounded-xl border border-[#eadbc3] bg-[#fffaf0] px-3 py-2 shadow-[0_8px_20px_rgba(66,56,47,.08)] sm:block"><p className="font-mono text-[8px] font-bold uppercase tracking-[.13em] text-[#a17b46]">Questa settimana</p><p className="mt-1 text-[13px] font-bold text-[#566176]">18 attività chiuse</p></div>
                <div id="workspace" className="scroll-mt-28"><WorkspacePanel /></div>
              </div>
            </div>
          </div>
        </section>

        <section id="outcomes" className="scroll-mt-20 border-b border-[#e5e4e1] bg-[#293653] px-5 py-14 text-[#fffdf9] sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid gap-9 md:grid-cols-[.74fr_1.26fr] md:items-end">
              <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#b8abd8]">Tre risultati concreti</p><h2 className="mt-4 max-w-[310px] text-3xl font-semibold leading-[1.02] tracking-[-.05em] sm:text-4xl">Meno coordinamento.<br />Più lavoro finito.</h2></div>
              <div className="grid gap-7 sm:grid-cols-3">
                <div className="border-t border-[#54617b] pt-4"><span className="text-2xl font-semibold text-[#e6c67f]">01</span><h3 className="mt-5 text-sm font-bold">Assegna senza ambiguità</h3><p className="mt-2 text-[12px] leading-5 text-[#bdc4d0]">Ogni attività ha una persona responsabile e un prossimo passo visibile.</p></div>
                <div className="border-t border-[#54617b] pt-4"><span className="text-2xl font-semibold text-[#e6c67f]">02</span><h3 className="mt-5 text-sm font-bold">Discuti nel contesto</h3><p className="mt-2 text-[12px] leading-5 text-[#bdc4d0]">Commenti e decisioni restano dove il lavoro succede.</p></div>
                <div className="border-t border-[#54617b] pt-4"><span className="text-2xl font-semibold text-[#e6c67f]">03</span><h3 className="mt-5 text-sm font-bold">Chiudi con fiducia</h3><p className="mt-2 text-[12px] leading-5 text-[#bdc4d0]">Scadenze e stati raccontano cosa è davvero completato.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#e5e4e1] bg-[#f7f6f3] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7465ac]">Uno spazio che fa ordine</p><h2 className="mt-3 max-w-[500px] text-3xl font-semibold leading-[1] tracking-[-.055em] text-[#293653]">Dal primo incarico<br />all’ultimo aggiornamento.</h2></div><p className="max-w-[300px] text-[13px] leading-6 text-[#7c8798]">Un modo più semplice per tenere il filo quando il team cresce e le giornate si riempiono.</p></div>
            <div className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
              <article className="group overflow-hidden rounded-2xl border border-[#e1e1e3] bg-[#fffdf9] p-3 shadow-[0_10px_25px_rgba(49,58,81,.05)]">
                <div className="relative h-[220px] overflow-hidden rounded-xl bg-[#e7edf5]"><img src={`${ASSET_BASE}/feature-1.png`} alt="Documenti ordinati in gruppi di lavoro" className="h-full w-full object-cover grayscale-[.15] transition-transform duration-500 group-hover:scale-[1.03]" /><div className="absolute bottom-3 left-3 rounded-lg border border-white/60 bg-[#fffdf9]/90 px-3 py-2 backdrop-blur-sm"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7e8797]">Vista attività</p><p className="mt-1 text-[11px] font-bold text-[#3a465d]">Tutto al posto giusto</p></div></div>
                <div className="flex items-start justify-between gap-4 px-2 pb-1 pt-5"><div><h3 className="text-base font-bold text-[#344057]">Dai un posto alle cose</h3><p className="mt-2 max-w-[430px] text-[12px] leading-5 text-[#7c8798]">Progetti, attività e file sono leggibili da chi deve portarli avanti.</p></div><FolderKanban size={18} className="mt-1 shrink-0 text-[#7868af]" /></div>
              </article>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                <article className="group overflow-hidden rounded-2xl border border-[#e1e1e3] bg-[#fffdf9] p-3 shadow-[0_10px_25px_rgba(49,58,81,.05)]"><div className="relative h-[145px] overflow-hidden rounded-xl bg-[#e8eef5]"><img src={`${ASSET_BASE}/feature-2.png`} alt="Risultati e numeri del lavoro del team" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /><div className="absolute right-3 top-3 rounded-lg bg-[#293653] px-2.5 py-2 text-[#fffdf9]"><p className="text-[8px] uppercase tracking-[.1em] text-[#bac2cf]">Completato</p><p className="mt-0.5 text-sm font-bold">+32%</p></div></div><div className="flex items-center justify-between px-2 pb-1 pt-4"><div><h3 className="text-sm font-bold text-[#344057]">Misura il passo</h3><p className="mt-1 text-[11px] text-[#7c8798]">Il lavoro fatto, senza supposizioni.</p></div><CheckCircle2 size={17} className="text-[#4a9d91]" /></div></article>
                <article className="relative overflow-hidden rounded-2xl border border-[#e1e1e3] bg-[#ece8fb] p-5 shadow-[0_10px_25px_rgba(49,58,81,.05)] sm:col-span-2 md:col-span-1"><img src={`${ASSET_BASE}/hero.png`} alt="Postazione con TaskDesk aperto" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-multiply" /><div className="relative flex h-full min-h-[145px] flex-col justify-between"><div className="flex items-center justify-between"><span className="rounded-full bg-[#fffdf9]/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#6c5da3]">Focus</span><MessageCircle size={17} className="text-[#7565b0]" /></div><div><h3 className="max-w-[180px] text-base font-bold leading-tight text-[#3f356e]">La conversazione non si perde.</h3><p className="mt-2 max-w-[220px] text-[11px] leading-5 text-[#6e6590]">Ogni commento accompagna l’attività fino alla chiusura.</p></div></div></article>
              </div>
            </div>
          </div>
        </section>

        <section id="details" className="scroll-mt-20 border-t border-[#dedde0] bg-[#eeedf4] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="max-w-[620px]"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7465ac]">Dettagli</p><h2 className="mt-4 text-4xl font-semibold leading-[.98] tracking-[-.06em] text-[#293653] sm:text-5xl">Scegli lo spazio<br />che serve al team.</h2><p className="mt-5 text-[14px] leading-6 text-[#707b8d]">Piani chiari per organizzare il lavoro quotidiano, senza aggiungere complessità.</p></div>
            <div className="mt-10 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-[#d9d9e1] bg-[#fffdf9] p-5"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#8b94a3]">Team</p><p className="mt-4 text-3xl font-semibold tracking-[-.05em] text-[#293653]">€ 9</p><p className="mt-1 text-[11px] text-[#8b94a3]">per collaboratore / mese</p><div className="my-5 h-px bg-[#e7e5e6]" /><ul className="space-y-3 text-[11px] text-[#667286]"><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#4a9d91]" /> Workspace condiviso</li><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#4a9d91]" /> Attività e scadenze</li><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#4a9d91]" /> Commenti e storico</li></ul></article>
                <article className="rounded-2xl border border-[#293653] bg-[#293653] p-5 text-[#fffdf9] shadow-[0_8px_0_#d0ccdf]"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#b8abd8]">Azienda</p><p className="mt-4 text-3xl font-semibold tracking-[-.05em] text-[#fffdf9]">Su misura</p><p className="mt-1 text-[11px] text-[#b9c0ce]">per strutture organizzate</p><div className="my-5 h-px bg-[#4b5772]" /><ul className="space-y-3 text-[11px] text-[#d1d5dd]"><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#e6c67f]" /> Ruoli e permessi</li><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#e6c67f]" /> Supporto dedicato</li><li className="flex gap-2"><Check size={14} className="shrink-0 text-[#e6c67f]" /> Flussi personalizzati</li></ul></article>
              </div>
              <div className="rounded-2xl border border-[#d9d9e1] bg-[#f8f7fb] p-5 sm:p-7">
                <div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#8b94a3]">Domande frequenti</p><p className="mt-2 text-sm font-bold text-[#3b465e]">Prima di iniziare</p></div><span className="text-[10px] font-mono text-[#9da4b1]">FAQ / 03</span></div>
                <div className="divide-y divide-[#e1e0e6]">
                  {FAQS.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return <div key={faq.question}><button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? null : index)} className="flex w-full items-center justify-between gap-4 py-4 text-left text-[12px] font-bold text-[#48546b]"><span>{faq.question}</span><ChevronDown size={15} className={`shrink-0 text-[#877ab4] transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen && <p className="pb-4 pr-5 text-[11px] leading-5 text-[#7a8495]">{faq.answer}</p>}</div>;
                  })}
                </div>
                <button type="button" onClick={() => window.location.href = "mailto:ciao@taskdesk.it"} className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold text-[#6658a5] hover:underline">Hai un’altra domanda? Scrivici <ArrowRight size={13} /></button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#f7f6f3] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 border-t border-[#e3e2df] pt-6 sm:flex-row sm:items-center sm:justify-between"><BrandMark /><div className="flex flex-wrap items-center gap-5 text-[10px] font-bold text-[#8992a1]"><a href="#workspace" className="hover:text-[#6658a5]">Workspace</a><a href="#details" className="hover:text-[#6658a5]">Dettagli</a><span>© 2025 TaskDesk</span></div></div>
      </footer>
    </div>
  );
}