import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import type { ProfessionId } from "./profession-content";

type Language = "it" | "en";

interface Translations {
  landmarks: {
    mainNavigation: string;
    hero: string;
    whoUses: string;
    problem: string;
    features: string;
    teamMemory: string;
    pricing: string;
  };
  nav: {
    features: string;
    pricing: string;
    login: string;
  };
  hero: {
    title: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    situations: Array<{ icon: string; title: string }>;
    cta: string;
    secondaryCta: string;
    trialBadge: string;
    trialNote: string;
    microProof: string;
    reassurance: string;
  };
  whoUses: {
    title: string;
    subtitle: string;
    profiles: Array<{
      profession: ProfessionId;
      icon?: string;
      logo?: string;
      logoPresentation?: "horizontal" | "square";
      title: string;
      desc: string;
      detail: string;
    }>;
  };
  professionDialog: {
    eyebrow: string;
    title: string;
    description: string;
    close: string;
  };
  solution: {
    title: string;
    subtitle: string;
  };
  teamMemory: {
    title: string;
    subtitle: string;
    assistantName: string;
    assistantRole: string;
    assistantDescription: string;
  };
  workStatistic: {
    statement: string;
    survey: string;
    source: string;
  };
  problem: {
    title: string;
    description: string;
  };
  proofBar: {
    setup: string;
    gdpr: string;
    trial: string;
    cancel: string;
  };
  features: {
    title: string;
    subtitle: string;
    cta: string;
    items: {
      creation: { title: string; desc: string };
      priority: { title: string; desc: string };
      history: { title: string; desc: string };
      solution: { title: string; desc: string };
      stats: { title: string; desc: string; bullets: string[] };
      multi: { title: string; desc: string };
      roles: { title: string; desc: string };
      fast: { title: string; desc: string };
    };
  };
  pricing: {
    title: string;
    price: string;
    unit: string;
    subtitle: string;
    launchBadge: string;
    trialLabel: string;
    trialHeader: string;
    perMonth: string;
    perYear: string;
    billingMonthly: string;
    billingAnnual: string;
    annualSavings: string;
    vatNote: string;
    addonLabel: string;
    mostPopular: string;
    seatsSuffix: string;
    seatsUnlimited: string;
    plans: Array<{
      name: string;
      price: string;
      annualPrice: string;
      annualMonthly: string;
      seats: number | null;
      maxAddon: number;
      desc: string;
      highlight?: boolean;
      cta: string;
      noUnit?: boolean;
      hideSeats?: boolean;
    }>;
    includedTitle: string;
    includedSubtitle: string;
    included: string[];
    cta: string;
  };
  footer: {
    text: string;
    terms: string;
  };
  installPrompt: {
    title: string;
    iosTap: string;
    share: string;
    then: string;
    addToHomeScreen: string;
    offline: string;
    install: string;
    close: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
    twitterTitle: string;
    twitterDescription: string;
  };
  ticker: {
    setup: string;
    trial: string;
    gdpr: string;
  };
}

const translations: Record<Language, Translations> = {
  it: {
    landmarks: {
      mainNavigation: "Menu principale",
      hero: "Hero",
      whoUses: "Chi usa TaskDesk",
      problem: "Il problema",
      features: "La soluzione",
      teamMemory: "Memoria del team",
      pricing: "Prezzi",
    },
    nav: {
      features: "Il prodotto",
      pricing: "Prezzi",
      login: "Accedi",
    },
    hero: {
      title: "Ti è mai capitato di sapere che qualcuno ne aveva parlato, ma non ricordare dove?",
      titleLine1: "Ti è mai capitato di sapere che qualcuno ne aveva parlato,",
      titleLine2: "ma non ricordare dove?",
      subtitle: "Capita quando il lavoro resta sparso tra chat, email e memoria delle persone.",
      situations: [
        { icon: "💬", title: "Un messaggio WhatsApp dimenticato" },
        { icon: "🙋", title: "Una richiesta senza responsabile" },
        { icon: "🔎", title: "Una soluzione che nessuno riesce più a trovare" },
      ],
      cta: "Inizia gratis — 7 giorni",
      secondaryCta: "Scopri le categorie",
      trialBadge: "7 giorni gratis",
      trialNote: "Nessuna carta di credito richiesta",
      microProof: "7 giorni gratis · Nessuna carta · Cancella quando vuoi",
      reassurance: "Usato da studi commerciali, agenzie e consulenti in tutta Italia",
    },
    whoUses: {
      title: "TaskDesk si adatta al tuo lavoro.",
      subtitle: "Cambiano i termini e l’organizzazione, non il modo di lavorare: non serve imparare un software diverso.",
      profiles: [
        {
          profession: "commercialisti",
          logo: "/images/accountants-logo.webp",
          logoPresentation: "horizontal",
          title: "Commercialista",
          desc: "Raccogli documenti e richieste dei clienti in uno spazio condiviso.",
          detail: "Assegna le verifiche, rendi visibili le scadenze e ritrova gli aggiornamenti della pratica.",
        },
        {
          profession: "avvocati",
          logo: "/images/lawyer-scales.webp",
          logoPresentation: "square",
          title: "Avvocato",
          desc: "Tieni richieste, documenti e comunicazioni collegate a ogni pratica.",
          detail: "Il team vede chi segue il caso, cosa è in attesa e qual è il prossimo passaggio.",
        },
        {
          profession: "consulenti-del-lavoro",
          logo: "/images/labour-consultant-logo.webp",
          logoPresentation: "square",
          title: "Consulente del lavoro",
          desc: "Coordina le richieste delle aziende e i documenti del personale.",
          detail: "Assegna attività e aggiornamenti allo studio senza perdere il contesto tra i referenti.",
        },
        {
          profession: "notai",
          icon: "⚖️",
          title: "Notaio",
          desc: "Coordina richieste, documenti e appuntamenti dello studio notarile.",
          detail: "Collega responsabili, verifiche e aggiornamenti a ogni pratica.",
        },
        {
          profession: "commercio",
          icon: "🛍️",
          title: "Commercio",
          desc: "Coordina richieste dei clienti, ordini e attività del team.",
          detail: "Tieni aggiornamenti e responsabili collegati a ogni richiesta.",
        },
        {
          profession: "agenzie",
          icon: "📣",
          title: "Agenzia",
          desc: "Coordina richieste, revisioni e consegne dei clienti in un unico flusso.",
          detail: "Collega feedback, responsabili e prossimi passaggi a ogni progetto.",
        },
      ],
    },
    professionDialog: {
      eyebrow: "Una soluzione per il tuo studio",
      title: "Qual è la tua professione?",
      description: "Scegli il tuo ambito per vedere come TaskDesk si adatta al tuo lavoro. Puoi chiudere questa finestra e continuare sulla pagina generale.",
      close: "Chiudi la scelta della professione",
    },
    solution: {
      title: "Conversazioni semplici. Lavoro organizzato.",
      subtitle: "Commenti, responsabile, checklist e soluzione restano insieme, nello stesso posto.",
    },
    teamMemory: {
      title: "Un problema risolto oggi non deve tornare un problema domani.",
      subtitle: "Cerca nello storico, collega le attività simili e metti in evidenza la soluzione efficace: il team potrà ritrovarla e riutilizzarla.",
      assistantName: "Albert",
      assistantRole: "Assistente AI TaskDesk",
      assistantDescription: "Ti aiuta a ritrovare ticket passati utili per affrontare richieste simili.",
    },
    workStatistic: {
      statement: "dei dipendenti intervistati afferma che il proprio lavoro è caotico e frammentato.",
      survey: "Il report analizza dati di sondaggio su 31.000 lavoratori in 31 Paesi.",
      source: "Microsoft Work Trend Index 2025",
    },
    problem: {
      title: "I software enterprise sono gonfiati, costosi e lenti.",
      description: "Abbiamo eliminato il superfluo. Solo ciò che serve per gestire le pratiche dei tuoi clienti in modo impeccabile, con l'eleganza di un design essenziale."
    },
    proofBar: {
      setup: "Setup in 5 minuti",
      gdpr: "GDPR Compliant",
      trial: "7 giorni gratis",
      cancel: "Nessun vincolo contrattuale",
    },
    features: {
      title: "Tutto quello che serve. Niente di più.",
      subtitle: "Strumenti essenziali progettati per studi e agenzie che vogliono smettere di rincorrere le richieste dei clienti.",
      cta: "Inizia gratis — 7 giorni",
      items: {
        creation: {
          title: "Apertura pratica in 10 secondi",
          desc: "Apri una pratica per un cliente in pochi secondi e assegnala al consulente giusto, senza frizioni."
        },
        priority: {
          title: "Priorità e scadenze sempre visibili",
          desc: "Tieni sempre sotto controllo cosa è urgente e cosa è già in lavorazione. Niente pratiche dimenticate."
        },
        history: {
          title: "Conversazione per ogni pratica",
          desc: "Ogni pratica è un thread: commenti, allegati e @menzioni per coinvolgere il collega giusto, senza email disperse."
        },
        solution: {
          title: "Soluzione tracciata",
          desc: "Chi risolve marca il commento giusto come soluzione. Il cliente e il team vedono subito cosa ha funzionato."
        },
        stats: {
          title: "Report e Statistiche",
          desc: "Dashboard chiara per capire come sta performando il tuo studio: pratiche per stato, categoria, operatore.",
          bullets: [
            "Grafici per stato, priorità e categoria",
            "Trend pratiche degli ultimi 30 giorni",
            "Statistiche per operatore e cliente"
          ]
        },
        multi: {
          title: "Multi-Sede e Multi-Team",
          desc: "Gestisci più sedi o divisioni — contabilità, lavoro, consulenza — tutto da un'unica piattaforma centralizzata."
        },
        roles: {
          title: "Ruoli e Permessi",
          desc: "Admin per chi gestisce lo studio, Operatore per i consulenti. Controllo preciso su chi vede e fa cosa."
        },
        fast: {
          title: "Semplice e Veloce",
          desc: "Nessun setup infinito. Sei operativo in pochi minuti — il tuo team non ha bisogno di formazione."
        }
      }
    },
    pricing: {
      title: "Tre piani. Prezzi chiari, senza sorprese.",
      price: "€35",
      unit: "/mese",
      subtitle: "Prezzo fisso per studio, non per utente. Cambi piano quando vuoi.",
      launchBadge: "Prezzi di lancio — riservati ai primi clienti",
      trialLabel: "7 giorni di prova gratuita inclusi — nessuna carta di credito",
      trialHeader: "Prima prova gratis, poi scegli il piano",
      perMonth: "/mese",
      perYear: "/anno",
      billingMonthly: "Mensile",
      billingAnnual: "Annuale",
      annualSavings: "-2 mesi",
      vatNote: "+ IVA",
      addonLabel: "Collaboratori aggiuntivi a €6/mese",
      mostPopular: "Più scelto",
      seatsSuffix: "utenti inclusi",
      seatsUnlimited: "Utenti illimitati",
      plans: [
        { name: "Starter",    price: "€35",       annualPrice: "€350",      annualMonthly: "≡ €29/mese", seats: 5,    maxAddon: 4, desc: "Per piccoli studi e liberi professionisti che iniziano a gestire le pratiche.",  cta: "Inizia la prova" },
        { name: "Team",       price: "€60",       annualPrice: "€600",      annualMonthly: "≡ €50/mese", seats: 10,   maxAddon: 9, desc: "Per studi in crescita che vogliono organizzazione e velocità.",                   highlight: true, cta: "Inizia la prova" },
        { name: "Business",   price: "€100",      annualPrice: "€1.000",    annualMonthly: "≡ €83/mese", seats: 20,   maxAddon: 0, desc: "Per studi strutturati con più consulenti e sedi.",                                cta: "Inizia la prova" },
        { name: "Enterprise", price: "Su misura", annualPrice: "Su misura", annualMonthly: "",            seats: null as number | null, maxAddon: 0, desc: "Per grandi organizzazioni che hanno bisogno di scalabilità senza limiti.", cta: "Contattaci", noUnit: true, hideSeats: true },
      ],
      includedTitle: "Tutto incluso in ogni piano",
      includedSubtitle: "Stesse funzionalità per tutti. Cambia solo il numero di utenti.",
      included: [
        "Pratiche e storage illimitati",
        "Dashboard e report dettagliati",
        "Assegnazioni e gruppi di lavoro",
        "Multi-sede e ruoli avanzati",
        "Notifiche in-app ed email personalizzabili",
        "Supporto via email",
      ],
      cta: "Inizia gratis — 7 giorni"
    },
    footer: {
      text: "© 2025 TaskDesk. Il sistema di gestione pratiche per studi e agenzie italiane.",
      terms: "Termini di Servizio",
    },
    installPrompt: {
      title: "Aggiungi TaskDesk alla schermata Home",
      iosTap: "Tocca",
      share: "Condividi",
      then: "poi",
      addToHomeScreen: "Aggiungi a schermata Home",
      offline: "Accedi più velocemente ai tuoi ticket, anche offline.",
      install: "Installa app →",
      close: "Chiudi",
    },
    seo: {
      title: "TaskDesk — Gestione Pratiche per Studi e Agenzie",
      description: "Raccogli le richieste dei clienti, assegnale al team e traccia ogni pratica. Per studi commerciali e agenzie. Da €35/mese + IVA, 7 giorni gratis.",
      keywords: "software studi commerciali, gestione pratiche clienti, ticketing per agenzie, software notarile, gestione richieste commercio, software consulenza, sistema ticket studio commercialista",
      ogTitle: "TaskDesk — Gestione Pratiche per Studi e Agenzie",
      ogDescription: "Gestisci pratiche e richieste senza email disperse. Commenti, scadenze, soluzioni tracciate. Prezzi di lancio da €35/mese + IVA tutto incluso.",
      twitterTitle: "TaskDesk — Gestione Pratiche per Studi e Agenzie",
      twitterDescription: "Pratiche clienti senza email disperse. Commenti, scadenze, soluzioni tracciate. Prezzi di lancio da €35/mese + IVA.",
    },
    ticker: {
      setup: "🚀 Setup in 5 minuti",
      trial: "🎁 7 giorni gratis",
      gdpr: "🔒 GDPR Compliant",
    },
  },
  en: {
    landmarks: {
      mainNavigation: "Main navigation",
      hero: "Hero",
      whoUses: "Who uses TaskDesk",
      problem: "The problem",
      features: "The solution",
      teamMemory: "Team memory",
      pricing: "Pricing",
    },
    nav: {
      features: "Product",
      pricing: "Pricing",
      login: "Login",
    },
    hero: {
      title: "Have you ever known someone had mentioned something, but couldn’t remember where?",
      titleLine1: "Have you ever known someone had mentioned something,",
      titleLine2: "but couldn’t remember where?",
      subtitle: "It happens when work is scattered across chats, email and people’s memory.",
      situations: [
        { icon: "💬", title: "A forgotten WhatsApp message" },
        { icon: "🙋", title: "A request with no owner" },
        { icon: "🔎", title: "A solution no one can find anymore" },
      ],
      cta: "Start free — 7 days",
      secondaryCta: "Browse categories",
      trialBadge: "7 days free",
      trialNote: "No credit card required",
      microProof: "7 days free · No credit card · Cancel anytime",
      reassurance: "Used by accounting firms, agencies and consultants across Italy",
    },
    whoUses: {
      title: "TaskDesk adapts to the way you work.",
      subtitle: "The terminology and organisation change, not the way you work. There’s no different software to learn.",
      profiles: [
        {
          profession: "commercialisti",
          logo: "/images/accountants-logo.webp",
          logoPresentation: "horizontal",
          title: "Accountant",
          desc: "Collect client documents and requests in one shared workspace.",
          detail: "Assign reviews, make deadlines visible and keep every practice update together.",
        },
        {
          profession: "avvocati",
          logo: "/images/lawyer-scales.webp",
          logoPresentation: "square",
          title: "Lawyer",
          desc: "Keep requests, documents and conversations connected to each matter.",
          detail: "Your team can see who owns the case, what is waiting and what happens next.",
        },
        {
          profession: "consulenti-del-lavoro",
          logo: "/images/labour-consultant-logo.webp",
          logoPresentation: "square",
          title: "Labour consultant",
          desc: "Coordinate employer requests and employee documentation.",
          detail: "Assign practice tasks and updates without losing context between contacts.",
        },
        {
          profession: "notai",
          icon: "⚖️",
          title: "Notary",
          desc: "Coordinate requests, documents and appointments for your notary practice.",
          detail: "Connect owners, checks and updates to every matter.",
        },
        {
          profession: "commercio",
          icon: "🛍️",
          title: "Commerce",
          desc: "Coordinate customer requests, orders and team tasks.",
          detail: "Keep owners and updates connected to every request.",
        },
        {
          profession: "agenzie",
          icon: "📣",
          title: "Agency",
          desc: "Coordinate client requests, reviews and deliverables in one workflow.",
          detail: "Connect feedback, owners and next steps to every project.",
        },
      ],
    },
    professionDialog: {
      eyebrow: "A solution for your practice",
      title: "What is your profession?",
      description: "Choose your field to see how TaskDesk fits your work. You can close this window and continue to the general page.",
      close: "Close profession selection",
    },
    solution: {
      title: "Simple conversations. Organized work.",
      subtitle: "Comments, owner, checklist and resolution stay together in one place.",
    },
    teamMemory: {
      title: "A problem solved today should not become tomorrow’s problem.",
      subtitle: "Search the history, connect similar tasks, and highlight the solution that worked so the whole team can find and reuse it.",
      assistantName: "Albert",
      assistantRole: "TaskDesk AI assistant",
      assistantDescription: "Albert helps you find useful past tickets and bring the team’s previous solutions back into view.",
    },
    workStatistic: {
      statement: "of employees surveyed say their work feels chaotic and fragmented.",
      survey: "The report analyzes survey data from 31,000 workers across 31 countries.",
      source: "Microsoft Work Trend Index 2025",
    },
    problem: {
      title: "Enterprise software is bloated, expensive, and slow.",
      description: "We removed the excess. Only what you need to manage your clients' requests flawlessly, with the elegance of essential design."
    },
    proofBar: {
      setup: "5-min setup",
      gdpr: "GDPR Compliant",
      trial: "7 days free",
      cancel: "No commitment",
    },
    features: {
      title: "Everything you need. Nothing you don't.",
      subtitle: "Essential tools designed for firms and agencies that want to stop chasing client requests.",
      cta: "Start free — 7 days",
      items: {
        creation: {
          title: "Open a request in 10 seconds",
          desc: "Open a client request in seconds and assign it to the right person — friction-free."
        },
        priority: {
          title: "Priorities and deadlines always visible",
          desc: "Always keep track of what's urgent and what's in progress. No more forgotten tasks."
        },
        history: {
          title: "Threaded conversation per request",
          desc: "Every request is a thread: replies, attachments and @mentions — like a chat, but organised and always searchable."
        },
        solution: {
          title: "Tracked resolution",
          desc: "Whoever resolves it marks the right comment as the solution. The client and team see immediately what worked."
        },
        stats: {
          title: "Reports & Statistics",
          desc: "Clear dashboard to understand how your firm is performing: requests by status, category and consultant.",
          bullets: [
            "Charts by status, priority and category",
            "Request trend over the last 30 days",
            "Statistics by consultant and client"
          ]
        },
        multi: {
          title: "Multi-location & Multi-team",
          desc: "Manage multiple offices or divisions — accounting, labour law, consulting — all from one centralised platform."
        },
        roles: {
          title: "Roles & Permissions",
          desc: "Admin for firm managers, Operator for consultants. Precise control over who sees and does what."
        },
        fast: {
          title: "Simple & Fast",
          desc: "No endless setup. You are up and running in minutes — your team needs no training."
        }
      }
    },
    pricing: {
      title: "Three plans. Clear prices, no surprises.",
      price: "€35",
      unit: "/month",
      subtitle: "Flat price per firm, not per user. Switch plans anytime.",
      launchBadge: "Launch prices — reserved for early customers",
      trialLabel: "7-day free trial included — no credit card required",
      trialHeader: "Try free first, then pick your plan",
      perMonth: "/month",
      perYear: "/year",
      billingMonthly: "Monthly",
      billingAnnual: "Annual",
      annualSavings: "-2 months",
      vatNote: "+ VAT",
      addonLabel: "Additional collaborators at €6/month",
      mostPopular: "Most popular",
      seatsSuffix: "users included",
      seatsUnlimited: "Unlimited users",
      plans: [
        { name: "Starter",    price: "€35",   annualPrice: "€350",   annualMonthly: "≡ €29/mo", seats: 5,    maxAddon: 4, desc: "For small firms and sole practitioners getting started.",                  cta: "Start trial" },
        { name: "Team",       price: "€60",   annualPrice: "€600",   annualMonthly: "≡ €50/mo", seats: 10,   maxAddon: 9, desc: "For growing firms that need structure and speed.",                          highlight: true, cta: "Start trial" },
        { name: "Business",   price: "€100",  annualPrice: "€1,000", annualMonthly: "≡ €83/mo", seats: 20,   maxAddon: 0, desc: "For established firms with multiple consultants and locations.",            cta: "Start trial" },
        { name: "Enterprise", price: "Custom", annualPrice: "Custom", annualMonthly: "", seats: null as number | null, maxAddon: 0, desc: "For large organisations that need to scale without limits.",       cta: "Contact us", noUnit: true, hideSeats: true },
      ],
      includedTitle: "Everything included in every plan",
      includedSubtitle: "Same features across all plans. Only the user count changes.",
      included: [
        "Unlimited requests and storage",
        "Detailed dashboard and reports",
        "Assignments and workgroups",
        "Multi-location and advanced roles",
        "Customizable in-app and email notifications",
        "Email support",
      ],
      cta: "Start free — 7 days"
    },
    footer: {
      text: "© 2025 TaskDesk. The request management system for Italian firms and agencies.",
      terms: "Terms of Service",
    },
    installPrompt: {
      title: "Add TaskDesk to your Home Screen",
      iosTap: "Tap",
      share: "Share",
      then: "then",
      addToHomeScreen: "Add to Home Screen",
      offline: "Access your tickets faster, even offline.",
      install: "Install app →",
      close: "Close",
    },
    seo: {
      title: "TaskDesk — Practice Management for Firms & Agencies",
      description: "Collect every client request in one place, assign it to your team, and track it to completion. Built for accounting firms and agencies. 7-day free trial.",
      keywords: "software for accounting firms, client request management, ticketing for agencies, notary practice software, commerce request management, consulting software, accountant ticket system",
      ogTitle: "TaskDesk — Practice Management for Firms & Agencies",
      ogDescription: "Manage client requests without scattered emails. Comments, deadlines, tracked solutions. From €35/month + VAT, all included.",
      twitterTitle: "TaskDesk — Practice Management for Firms & Agencies",
      twitterDescription: "Client requests without scattered emails. Comments, deadlines, tracked solutions. From €35/month + VAT.",
    },
    ticker: {
      setup: "🚀 5-min setup",
      trial: "🎁 7 days free",
      gdpr: "🔒 GDPR Compliant",
    },
  }
};

type LanguageContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  const lang: Language = location.startsWith("/en") ? "en" : "it";

  function setLang(newLang: Language) {
    if (newLang === lang) return;
    try {
      localStorage.setItem("td_landing_lang", newLang);
    } catch {
      // ignore storage errors
    }
    const newPath = location.replace(/^\/(it|en)/, `/${newLang}`);
    navigate(newPath);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
