import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";
import "./albert.css";

const base = "https://taskdesk.it";

export default function Albert() {
  const { lang, setLang } = useLanguage();
  const it = lang === "it";
  const copy = it ? {
    title: "Albert — l’assistente conversazionale di TaskDesk",
    description: "Conosci Albert, l’assistente conversazionale di TaskDesk: risponde sui ticket e commenti, prepara report giornalieri rivedibili e cerca nell’archivio completo.",
    kicker: "Una mano in più, dentro TaskDesk",
    hero: <>Le cose chiare.<br />Il lavoro <em>più leggero.</em></>,
    intro: "Lui è Albert: l’assistente conversazionale che conosce il lavoro del tuo team. Chiedigli dei ticket, prepara insieme a lui il report della giornata, ritrova un passaggio di consegne.",
    cta: "Incontra Albert in TaskDesk",
    explore: "Scopri cosa sa fare",
    note: "Albert vive dentro TaskDesk. Tu resti sempre al comando.",
    question: "Chi ha seguito la pratica IVA di Officina Verde? Cosa è successo dopo il commento di Marta?",
    response: <>Nel ticket <strong>#284 — Verifica IVA Officina Verde</strong>, Marta ha chiesto i registri del secondo trimestre il 12 giugno. Paolo ha caricato la documentazione il 13 giugno e ha segnato la pratica come risolta.</>,
    ticketTag: "Ticket #284 · commenti aggiornati",
    exampleLabel: "Esempio illustrativo",
    proof: ["Ticket e commenti aggiornati", "Report sempre rivedibili", "Archivio completo"],
    clarityKicker: "Una conversazione, lavoro vero",
    clarityTitle: <>Chiedi in modo naturale.<br /><em>Capisci al volo.</em></>,
    clarityText: "Albert cerca nei ticket e nei commenti dell’organizzazione per rispondere alle tue domande, usando i record aggiornati. Puoi chiedere cosa è successo, chi ha scritto un commento o a che punto è una pratica.",
    clarityNum: "01",
    clarityBoundary: <>Le risposte si basano sui dati disponibili in TaskDesk. Albert può leggere descrizioni, note di risoluzione e commenti visibili: <strong>non accede alle note interne o agli allegati.</strong></>,
    dailyKicker: "Dalla giornata alla consegna",
    dailyTitle: <>Un report che parte<br />dal lavoro <em>di oggi.</em></>,
    dailyIntro: "A fine giornata, Albert mette in ordine le attività recenti dei ticket in una bozza compatta. Il team può aggiungere contesto che non compare nei record, correggere e rivedere tutto prima di pubblicare.",
    steps: [
      ["01", "Parte dalle attività recenti", "Prepara il report dalle attività sui ticket delle ultime 12 ore non già incluse in un report recente."],
      ["02", "Tiene il filo delle note", "Appunti e correzioni dei collaboratori restano nel report aggiornato, anche quando la bozza cambia."],
      ["03", "Pubblicazione solo dopo il tuo sì", "Mostra il testo completo per la revisione. Albert pubblica solo dopo una conferma esplicita; puoi creare più report nella stessa giornata."],
    ],
    reportDate: "Esempio · report giornaliero · sede Milano",
    reportStatus: "BOZZA DA RIVEDERE",
    reportBullet1: "Ticket #284 — Verifica IVA Officina Verde",
    reportBullet2: "Registri caricati da Paolo; pratica segnata come risolta.",
    reportBullet3: "Ticket #291 — Accesso portale fornitori",
    reportBullet4: "Il cliente richiamerà domani mattina per confermare.",
    reportNote: "Nota aggiunta da Giulia: avvisare il cliente prima della chiusura.",
    reviewHint: "Testo completo visibile prima della pubblicazione",
    reviewButton: "Pubblica report",
    archiveKicker: "La memoria del team",
    archiveTitle: <>Ritrova anche ciò<br />che è successo <em>tempo fa.</em></>,
    archiveText: "Quando serve ricostruire una decisione o un passaggio di consegne, Albert cerca nell’intero archivio dei report giornalieri dell’organizzazione, senza fermarsi agli ultimi giorni. Autore, sede e data aiutano a ritrovare il contesto.",
    searchExample: "Esempio: “fornitore”, autore: Marta",
    reportOne: "Report di fine giornata",
    reportTwo: "Consegna — pratiche aperte",
    reportThree: "Riepilogo attività clienti",
    byMarta: "Marta R. · sede Milano",
    byLuca: "Luca B. · sede Torino",
    byGiulia: "Giulia F. · sede Milano",
    boundariesKicker: "Un collega utile, non una scatola nera",
    boundariesTitle: <>Sa dove aiutare.<br /><em>E dove fermarsi.</em></>,
    boundariesIntro: "Albert è pensato per alleggerire le attività quotidiane senza togliere controllo alle persone che le svolgono.",
    boundaries: [
      ["A", "Le richieste restano richieste", "Crea un ticket soltanto quando gli chiedi esplicitamente di aprirne uno."],
      ["B", "La bozza resta una bozza", "Il report completo è sempre visibile al team prima della pubblicazione."],
      ["C", "Contesto, non supposizioni", "Per ticket e commenti usa i record correnti; per i report cerca nell’archivio completo e distingue la cronologia dallo stato attuale."],
      ["D", "Albert è Albert", "Un nome ispirato con leggerezza ad Albert Einstein. Non è una persona e non pretende di esserlo."],
    ],
    finalKicker: "Un collega in più, già al suo posto",
    finalTitle: <>Conosci Albert.<br /><em>Dentro TaskDesk.</em></>,
    finalText: "Le pratiche e le conversazioni del team sono già lì. Albert ti aiuta a orientarti e a preparare il prossimo passaggio.",
    footer: "Il sistema di gestione richieste per studi, agenzie e team che lavorano con i clienti.",
    home: "TaskDesk",
    dailyNav: "Report",
    archiveNav: "Archivio",
  } : {
    title: "Albert — TaskDesk’s conversational assistant",
    description: "Meet Albert, TaskDesk’s conversational assistant: get answers from tickets and comments, prepare reviewable daily reports, and search the complete archive.",
    kicker: "An extra pair of hands, inside TaskDesk",
    hero: <>Clear answers.<br />Lighter <em>workdays.</em></>,
    intro: "Meet Albert: the conversational assistant who knows your team’s work. Ask about tickets, prepare the day’s report together, or find a past handoff.",
    cta: "Meet Albert in TaskDesk",
    explore: "See what Albert can do",
    note: "Albert lives inside TaskDesk. You stay in control.",
    question: "Who handled the VAT filing for Officina Verde? What happened after Marta’s comment?",
    response: <>In ticket <strong>#284 — Officina Verde VAT check</strong>, Marta asked for the second-quarter ledgers on 12 June. Paolo uploaded the documents on 13 June and marked the request resolved.</>,
    ticketTag: "Ticket #284 · current comments",
    exampleLabel: "Illustrative example",
    proof: ["Current tickets and comments", "Reports reviewed before publishing", "Complete report archive"],
    clarityKicker: "A conversation that gets work done",
    clarityTitle: <>Ask naturally.<br /><em>Get your bearings.</em></>,
    clarityText: "Albert searches your organisation’s tickets and comments to answer questions from current records. Ask what happened, who wrote a comment, or where a request stands.",
    clarityNum: "01",
    clarityBoundary: <>Answers are based on the records available in TaskDesk. Albert can read descriptions, resolution notes and visible comments: <strong>he cannot access internal notes or attachments.</strong></>,
    dailyKicker: "From the day’s work to a handoff",
    dailyTitle: <>A daily report built<br />from <em>today’s work.</em></>,
    dailyIntro: "At the end of the day, Albert gathers recent ticket activity into a compact draft. Your team can add context that isn’t in the records, make corrections and review everything before publishing.",
    steps: [
      ["01", "Starts with recent activity", "Builds the report from ticket activity in the last 12 hours that hasn’t already appeared in a recent report."],
      ["02", "Keeps every note in view", "Collaborators’ notes and corrections stay in the revised report, even as the draft changes."],
      ["03", "Publishes only when you say so", "Shows the complete text for review. Albert publishes only after explicit confirmation; you can create multiple reports in one day."],
    ],
    reportDate: "Example · daily report · Milan office",
    reportStatus: "DRAFT FOR REVIEW",
    reportBullet1: "Ticket #284 — Officina Verde VAT check",
    reportBullet2: "Ledgers uploaded by Paolo; request marked resolved.",
    reportBullet3: "Ticket #291 — Supplier portal access",
    reportBullet4: "The client will call back tomorrow morning to confirm.",
    reportNote: "Note from Giulia: let the client know before closing.",
    reviewHint: "Complete text shown before publication",
    reviewButton: "Publish report",
    archiveKicker: "The team’s memory",
    archiveTitle: <>Find what happened,<br />even <em>further back.</em></>,
    archiveText: "When you need to retrace a decision or handoff, Albert searches your organisation’s complete daily-report archive—not just the last few days. Author, location and date help bring the context back.",
    searchExample: "Example: “supplier”, author: Marta",
    reportOne: "End-of-day report",
    reportTwo: "Handoff — open requests",
    reportThree: "Client activity summary",
    byMarta: "Marta R. · Milan office",
    byLuca: "Luca B. · Turin office",
    byGiulia: "Giulia F. · Milan office",
    boundariesKicker: "A useful colleague, not a black box",
    boundariesTitle: <>Knows how to help.<br /><em>And when to stop.</em></>,
    boundariesIntro: "Albert is here to lighten everyday work without taking control away from the people doing it.",
    boundaries: [
      ["A", "A request stays a request", "Creates a ticket only when you explicitly ask him to open one."],
      ["B", "A draft stays a draft", "The complete report is visible to your team before publication."],
      ["C", "Context, not guesswork", "Uses current records for tickets and comments; searches the complete archive for reports and distinguishes history from current ticket status."],
      ["D", "Albert is Albert", "A playful nod to Albert Einstein. He is not a person and never claims to be one."],
    ],
    finalKicker: "An extra colleague, already in place",
    finalTitle: <>Meet Albert.<br /><em>Inside TaskDesk.</em></>,
    finalText: "Your team’s requests and conversations are already there. Albert helps you find your bearings and prepare what comes next.",
    footer: "Request management for firms, agencies and teams who work with clients.",
    home: "TaskDesk",
    dailyNav: "Daily reports",
    archiveNav: "Archive",
  };

  const pageUrl = `${base}/${lang}/albert`;
  return (
    <div className="albert-page">
      <Helmet>
        <html lang={lang} />
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <link rel="alternate" hrefLang="it" href={`${base}/it/albert`} />
        <link rel="alternate" hrefLang="en" href={`${base}/en/albert`} />
        <link rel="alternate" hrefLang="x-default" href={`${base}/it/albert`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TaskDesk" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:locale" content={it ? "it_IT" : "en_US"} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.description} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={copy.title} />
        <meta name="twitter:description" content={copy.description} />
      </Helmet>
      <header className="albert-wrap albert-nav">
        <Link href="/" className="albert-brand" aria-label="TaskDesk home">
          <img src="/taskdesk-logo.webp" alt="TaskDesk" />
          <span className="albert-brand-divider" />
          <span className="albert-brand-name">Albert</span>
        </Link>
        <nav className="albert-nav-links" aria-label={it ? "Navigazione Albert" : "Albert navigation"}>
          <a href="#how">{it ? "Come aiuta" : "How he helps"}</a>
          <a href="#daily">{copy.dailyNav}</a>
          <a href="#archive">{copy.archiveNav}</a>
        </nav>
        <div className="albert-nav-actions">
          <button className="albert-lang" onClick={() => setLang(it ? "en" : "it")} aria-label={it ? "Switch to English" : "Passa all’italiano"}>{it ? "EN" : "IT"}</button>
          <a className="albert-button" href="/app/">{it ? "Apri TaskDesk" : "Open TaskDesk"} <ArrowRight size={15} /></a>
        </div>
      </header>
      <main>
        <section className="albert-wrap albert-hero" aria-labelledby="albert-title">
          <div className="albert-hero-grid">
            <div>
              <div className="albert-kicker">{copy.kicker}</div>
              <h1 id="albert-title" className="albert-display">{copy.hero}</h1>
              <p className="albert-hero-copy">{copy.intro}</p>
              <div className="albert-hero-ctas">
                <a className="albert-button" href="/app/">{copy.cta} <ArrowRight size={15} /></a>
                <a className="albert-text-link" href="#how">{copy.explore}</a>
              </div>
              <p className="albert-note">{copy.note}</p>
            </div>
            <div className="albert-console" aria-label={it ? "Esempio di conversazione con Albert" : "Example conversation with Albert"}>
              <div className="albert-console-top"><span>TaskDesk / Albert</span><span className="albert-example-label">{copy.exampleLabel}</span><span className="albert-live">{it ? "Pronto ad aiutare" : "Ready to help"}</span></div>
              <div className="albert-chat">
                 <div className="albert-chat-meta"><img className="albert-orb" src="/app/albert-einstein-silhouette.png" alt="" aria-hidden="true" /><span>Albert · {it ? "assistente TaskDesk" : "TaskDesk assistant"}</span></div>
                <div className="albert-question">{copy.question}</div>
                 <div className="albert-answer"><img className="albert-orb" src="/app/albert-einstein-silhouette.png" alt="" aria-hidden="true" /><div className="albert-answer-text">{copy.response}<br /><span className="albert-ticket-ref">{copy.ticketTag}</span></div></div>
                <div className="albert-prompt"><span>{it ? "Chiedi ad Albert…" : "Ask Albert…"}</span><b>↗</b></div>
              </div>
            </div>
          </div>
        </section>
        <div className="albert-proofline" aria-label={it ? "In breve" : "At a glance"}>{copy.proof.map((item, i) => <span key={item}><b>0{i + 1}</b>{item}</span>)}</div>
        <section id="how" className="albert-section albert-section--paper">
          <div className="albert-wrap albert-split">
            <div className="albert-section-heading">
              <div className="albert-kicker">{copy.clarityKicker}</div>
              <h2 className="albert-display">{copy.clarityTitle}</h2>
              <p>{copy.clarityText}</p>
            </div>
            <div>
              <div className="albert-big-number">{copy.clarityNum}</div>
              <p className="albert-boundary">{copy.clarityBoundary}</p>
            </div>
          </div>
        </section>
        <section id="daily" className="albert-section albert-section--deep">
          <div className="albert-wrap albert-workflow">
            <div>
              <div className="albert-section-heading">
                <div className="albert-kicker">{copy.dailyKicker}</div>
                <h2 className="albert-display">{copy.dailyTitle}</h2>
                <p>{copy.dailyIntro}</p>
              </div>
              <div className="albert-steps">{copy.steps.map(([number, title, text]) => <div className="albert-step" key={number}><span className="albert-step-index">{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
            </div>
            <div className="albert-report">
              <div className="albert-report-head"><div><span>{copy.reportDate}</span><strong>{it ? "Martedì, 18 giugno" : "Tuesday, 18 June"}</strong></div><div className="albert-draft-label">{copy.reportStatus}</div></div>
              <ul><li><strong>{copy.reportBullet1}</strong><br />{copy.reportBullet2}</li><li><strong>{copy.reportBullet3}</strong><br />{copy.reportBullet4}</li></ul>
              <div className="albert-report-note">{copy.reportNote}</div>
              <div className="albert-review"><span>{copy.reviewHint}</span><button type="button" disabled>{copy.reviewButton}</button></div>
            </div>
          </div>
        </section>
        <section id="archive" className="albert-section">
          <div className="albert-wrap albert-archive">
            <div className="albert-archive-panel">
              <div className="albert-search"><strong>{copy.searchExample}</strong><span>⌕</span></div>
              <div className="albert-report-row"><strong>{copy.reportOne}</strong><small>{copy.byMarta}</small><time>18 Jun</time></div>
              <div className="albert-report-row"><strong>{copy.reportTwo}</strong><small>{copy.byLuca}</small><time>04 Apr</time></div>
              <div className="albert-report-row"><strong>{copy.reportThree}</strong><small>{copy.byGiulia}</small><time>21 Jan</time></div>
            </div>
            <div className="albert-section-heading">
              <div className="albert-kicker">{copy.archiveKicker}</div>
              <h2 className="albert-display">{copy.archiveTitle}</h2>
              <p>{copy.archiveText}</p>
            </div>
          </div>
        </section>
        <section className="albert-section albert-section--paper">
          <div className="albert-wrap">
            <div className="albert-section-heading">
              <div className="albert-kicker">{copy.boundariesKicker}</div>
              <h2 className="albert-display">{copy.boundariesTitle}</h2>
              <p>{copy.boundariesIntro}</p>
            </div>
            <div className="albert-guardrail-grid">{copy.boundaries.map(([letter, title, text]) => <article className="albert-guardrail" key={letter}><span>{letter}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>
        <section className="albert-final">
          <div className="albert-wrap">
            <div className="albert-kicker" style={{ justifyContent: "center" }}>{copy.finalKicker}</div>
            <h2 className="albert-display">{copy.finalTitle}</h2>
            <p>{copy.finalText}</p>
            <a className="albert-button" href="/app/">{copy.cta} <ArrowRight size={15} /></a>
          </div>
        </section>
      </main>
      <footer className="albert-wrap albert-footer">
        <Link href="/" className="albert-brand"><img src="/taskdesk-logo.webp" alt="TaskDesk" /></Link>
        <span>{copy.footer}</span>
        <Link href="/">{copy.home}</Link>
      </footer>
    </div>
  );
}
