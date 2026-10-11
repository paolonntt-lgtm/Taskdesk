import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";

type Language = "it" | "en";

interface Translations {
  landmarks: {
    mainNavigation: string;
    hero: string;
    whoUses: string;
    problem: string;
    testimonials: string;
    howItWorks: string;
    features: string;
    pricing: string;
    faq: string;
    finalCta: string;
  };
  nav: {
    features: string;
    pricing: string;
    faq: string;
    login: string;
  };
  hero: {
    title: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
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
      profession: "commercialisti" | "avvocati" | "consulenti-del-lavoro";
      icon?: string;
      logo?: string;
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
  pain: {
    title: string;
    subtitle: string;
    cards: Array<{ icon: string; title: string; desc: string }>;
  };
  testimonials: {
    ratingLabel: string;
    items: Array<{ name: string; role: string; text: string; initials: string; color: string }>;
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
  howItWorks: {
    cta: string;
    steps: Array<{ n: string; icon: string; title: string; desc: string }>;
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
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  finalCta: {
    headline: string;
    sub: string;
    proof1: string;
    proof2: string;
    proof3: string;
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
    rating: string;
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
      testimonials: "Testimonianze",
      howItWorks: "Come funziona",
      features: "Funzionalità",
      pricing: "Prezzi",
      faq: "Domande frequenti",
      finalCta: "Inizia ora",
    },
    nav: {
      features: "Funzionalità",
      pricing: "Prezzi",
      faq: "FAQ",
      login: "Accedi",
    },
    hero: {
      title: "Le richieste dei tuoi clienti, finalmente in ordine.",
      titleLine1: "Le richieste dei tuoi clienti,",
      titleLine2: "finalmente in ordine.",
      subtitle: "Smetti di rincorrere email e WhatsApp. TaskDesk raccoglie ogni pratica, richiesta e scadenza in un unico posto — con commenti, assegnazioni e soluzioni tracciate.",
      cta: "Inizia gratis — 7 giorni",
      secondaryCta: "Scopri come funziona",
      trialBadge: "7 giorni gratis",
      trialNote: "Nessuna carta di credito richiesta",
      microProof: "7 giorni gratis · Nessuna carta · Cancella quando vuoi",
      reassurance: "Usato da studi commerciali, agenzie e consulenti in tutta Italia",
    },
    whoUses: {
      title: "Fatto per chi lavora con i clienti ogni giorno",
      subtitle: "Scegli il tuo ambito per vedere esempi concreti di come organizzare le richieste dello studio.",
      profiles: [
        {
          profession: "commercialisti",
          icon: "🏛️",
          title: "Commercialisti",
          desc: "Raccogli documenti e richieste dei clienti in uno spazio condiviso.",
          detail: "Assegna le verifiche, rendi visibili le scadenze e ritrova gli aggiornamenti della pratica.",
        },
        {
          profession: "avvocati",
          logo: "/images/lawyer-scales.webp",
          title: "Avvocati",
          desc: "Tieni richieste, documenti e comunicazioni collegate a ogni pratica.",
          detail: "Il team vede chi segue il caso, cosa è in attesa e qual è il prossimo passaggio.",
        },
        {
          profession: "consulenti-del-lavoro",
          icon: "💼",
          title: "Consulenti del lavoro",
          desc: "Coordina le richieste delle aziende e i documenti del personale.",
          detail: "Assegna attività e aggiornamenti allo studio senza perdere il contesto tra i referenti.",
        },
      ],
    },
    professionDialog: {
      eyebrow: "Una soluzione per il tuo studio",
      title: "Qual è la tua professione?",
      description: "Scegli il tuo ambito per vedere come TaskDesk si adatta al tuo lavoro. Puoi chiudere questa finestra e continuare sulla pagina generale.",
      close: "Chiudi la scelta della professione",
    },
    pain: {
      title: "Quante richieste stai perdendo oggi?",
      subtitle: "Senza un sistema dedicato, le richieste dei clienti finiscono ovunque — e alcune non tornano mai.",
      cards: [
        {
          icon: "📧",
          title: "Email disperse su più caselle",
          desc: "Le richieste arrivano via email, WhatsApp, telefono e a voce. Non c'è un posto unico dove trovarle tutte.",
        },
        {
          icon: "⏰",
          title: "Scadenze che si perdono",
          desc: "Senza un sistema, le pratiche urgenti si seppelliscono tra i messaggi. Il cliente aspetta. Lo studio perde credibilità.",
        },
        {
          icon: "🤷",
          title: "Nessuna visibilità su chi sta facendo cosa",
          desc: "Non sai se un collega ha già preso in carico una pratica, né se il cliente è stato aggiornato sull'avanzamento.",
        },
      ],
    },
    testimonials: {
      ratingLabel: "⭐ 4.9/5 — Valutazione media",
      items: [
        {
          name: "Giulia Ferretti",
          role: "Commercialista, Studio Ferretti & Associati",
          text: "Finalmente riusciamo a gestire le richieste dei clienti senza perderci nulla. Il team sa sempre cosa fare e il cliente vede i progressi.",
          initials: "GF",
          color: "bg-violet-500",
        },
        {
          name: "Marco Trentini",
          role: "Account Manager, Agenzia Pixel",
          text: "Prima vivevo su WhatsApp con i clienti. Ora ogni brief e ogni revisione è un ticket con stato, assegnatario e scadenza. Niente va più perso.",
          initials: "MT",
          color: "bg-blue-500",
        },
        {
          name: "Laura Bianchi",
          role: "Consulente del Lavoro, Studio Bianchi",
          text: "Setup in 10 minuti. I miei collaboratori ci hanno preso subito senza formazione. Consigliatissimo per studi come il mio.",
          initials: "LB",
          color: "bg-emerald-500",
        },
      ],
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
    howItWorks: {
      cta: "Inizia gratis — 7 giorni",
      steps: [
        {
          n: "1",
          icon: "✏️",
          title: "Apri una pratica",
          desc: "Il cliente manda una richiesta o tu la apri per lui. Titolo, categoria, scadenza: in 10 secondi è tracciata e visibile al team.",
        },
        {
          n: "2",
          icon: "💬",
          title: "Il team lavora in thread",
          desc: "Commenti, @menzioni e allegati in un unico thread — come una chat, ma organizzata e sempre ricercabile.",
        },
        {
          n: "3",
          icon: "✅",
          title: "Pratica risolta e archiviata",
          desc: "Chi risolve marca la soluzione. La pratica si chiude. Tutti — incluso il cliente — sanno che è fatta.",
        },
      ],
    },
    pricing: {
      title: "Un piano per ogni studio. Trasparente, senza sorprese.",
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
    faq: {
      title: "Domande Frequenti",
      items: [
        { q: "È adatto al mio studio commerciale o alla mia agenzia?", a: "Sì, TaskDesk è pensato esattamente per questo. Studi commerciali, studi di consulenza del lavoro, agenzie e liberi professionisti lo usano per raccogliere le richieste dei clienti in un unico posto, assegnarle ai collaboratori e tracciarle fino alla chiusura — senza email disperse o WhatsApp irrintracciabili." },
        { q: "C'è un periodo di prova gratuita?", a: "Sì! I primi 7 giorni sono completamente gratuiti, senza bisogno di inserire la carta di credito. Al termine puoi scegliere il piano più adatto al tuo studio, da €35/mese + IVA (o €350/anno + IVA). Enterprise su preventivo." },
        { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso. Sei operativo in pochi minuti, senza formazione." },
        { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione. Puoi disdire in qualsiasi momento dalla tua area account." },
        { q: "I miei clienti possono accedere e inviare richieste?", a: "Oggi i clienti vengono aggiunti come utenti dedicati. Ogni cliente vede solo le proprie pratiche. Una funzionalità di portale clienti semplificato è nella roadmap." },
      ]
    },
    finalCta: {
      headline: "Metti ordine nelle pratiche dei tuoi clienti.",
      sub: "Inizia subito — i primi 7 giorni sono gratis, senza carta di credito.",
      proof1: "Nessuna carta di credito",
      proof2: "Setup in 5 minuti",
      proof3: "GDPR compliant",
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
      keywords: "software studi commerciali, gestione pratiche clienti, ticketing per agenzie, software consulenza, gestione richieste clienti, sistema ticket studio commercialista",
      ogTitle: "TaskDesk — Gestione Pratiche per Studi e Agenzie",
      ogDescription: "Gestisci pratiche e richieste senza email disperse. Commenti, scadenze, soluzioni tracciate. Prezzi di lancio da €35/mese + IVA tutto incluso.",
      twitterTitle: "TaskDesk — Gestione Pratiche per Studi e Agenzie",
      twitterDescription: "Pratiche clienti senza email disperse. Commenti, scadenze, soluzioni tracciate. Prezzi di lancio da €35/mese + IVA.",
    },
    ticker: {
      rating: "⭐ 4.9/5 soddisfazione media",
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
      testimonials: "Testimonials",
      howItWorks: "How it works",
      features: "Features",
      pricing: "Pricing",
      faq: "Frequently asked questions",
      finalCta: "Get started",
    },
    nav: {
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Login",
    },
    hero: {
      title: "Your clients' requests, finally under control.",
      titleLine1: "Your clients' requests,",
      titleLine2: "finally under control.",
      subtitle: "Stop chasing emails and WhatsApp messages. TaskDesk collects every client request, task and deadline in one place — with comments, assignments and tracked solutions.",
      cta: "Start free — 7 days",
      secondaryCta: "See how it works",
      trialBadge: "7 days free",
      trialNote: "No credit card required",
      microProof: "7 days free · No credit card · Cancel anytime",
      reassurance: "Used by accounting firms, agencies and consultants across Italy",
    },
    whoUses: {
      title: "Built for those who work with clients every day",
      subtitle: "Choose your profession to see practical examples of how TaskDesk can organise your practice's requests.",
      profiles: [
        {
          profession: "commercialisti",
          icon: "🏛️",
          title: "Accountants",
          desc: "Collect client documents and requests in one shared workspace.",
          detail: "Assign reviews, make deadlines visible and keep every practice update together.",
        },
        {
          profession: "avvocati",
          logo: "/images/lawyer-scales.webp",
          title: "Lawyers",
          desc: "Keep requests, documents and conversations connected to each matter.",
          detail: "Your team can see who owns the case, what is waiting and what happens next.",
        },
        {
          profession: "consulenti-del-lavoro",
          icon: "💼",
          title: "Labour consultants",
          desc: "Coordinate employer requests and employee documentation.",
          detail: "Assign practice tasks and updates without losing context between contacts.",
        },
      ],
    },
    professionDialog: {
      eyebrow: "A solution for your practice",
      title: "What is your profession?",
      description: "Choose your field to see how TaskDesk fits your work. You can close this window and continue to the general page.",
      close: "Close profession selection",
    },
    pain: {
      title: "How many client requests are slipping through today?",
      subtitle: "Without a dedicated system, client requests end up everywhere — and some never come back.",
      cards: [
        {
          icon: "📧",
          title: "Requests scattered across channels",
          desc: "Requests arrive via email, WhatsApp, phone and in person. There's no single place to find them all.",
        },
        {
          icon: "⏰",
          title: "Deadlines that get lost",
          desc: "Without a system, urgent tasks get buried in messages. The client waits. Your firm loses credibility.",
        },
        {
          icon: "🤷",
          title: "No visibility into who's doing what",
          desc: "You don't know whether a colleague has already picked something up, or whether the client has been updated.",
        },
      ],
    },
    testimonials: {
      ratingLabel: "⭐ 4.9/5 — Average rating",
      items: [
        {
          name: "Giulia Ferretti",
          role: "CPA, Studio Ferretti & Associati",
          text: "We can finally manage client requests without losing anything. The team always knows what to do, and clients can see their progress.",
          initials: "GF",
          color: "bg-violet-500",
        },
        {
          name: "Marco Trentini",
          role: "Account Manager, Pixel Agency",
          text: "I used to live on WhatsApp with clients. Now every brief and revision is a ticket with a status, assignee and deadline. Nothing gets lost.",
          initials: "MT",
          color: "bg-blue-500",
        },
        {
          name: "Laura Bianchi",
          role: "HR Consultant, Studio Bianchi",
          text: "Set up in 10 minutes. My team picked it up straight away with zero training. Highly recommended for firms like mine.",
          initials: "LB",
          color: "bg-emerald-500",
        },
      ],
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
    howItWorks: {
      cta: "Start free — 7 days",
      steps: [
        {
          n: "1",
          icon: "✏️",
          title: "Open a request",
          desc: "The client sends a request or you open one for them. Title, category, deadline: tracked in 10 seconds and visible to the team.",
        },
        {
          n: "2",
          icon: "💬",
          title: "Team works in a thread",
          desc: "Comments, @mentions and attachments in a single thread — like a chat, but organised and always searchable.",
        },
        {
          n: "3",
          icon: "✅",
          title: "Request resolved and archived",
          desc: "Whoever resolves it marks the solution. The request closes. Everyone — including the client — knows it's done.",
        },
      ],
    },
    pricing: {
      title: "A plan for every firm. Transparent, no surprises.",
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
    faq: {
      title: "Frequently Asked Questions",
      items: [
        { q: "Is it right for my accounting firm or agency?", a: "Yes, TaskDesk is designed exactly for this. Accounting firms, labour consultancies, agencies and sole practitioners use it to collect client requests in one place, assign them to team members and track them through to completion — without scattered emails or untraceable WhatsApp messages." },
        { q: "Is there a free trial?", a: "Yes! The first 7 days are completely free, with no credit card required. Afterwards you can choose the plan that best suits your firm, from €35/month + VAT (or €350/year + VAT). Enterprise is priced on request." },
        { q: "Is there a setup cost?", a: "Absolutely not. The software is ready to use from your first login. You are up and running in minutes, with no training needed." },
        { q: "Can I cancel at any time?", a: "Yes, there are no contractual commitments or cancellation fees. You can cancel at any time from your account area." },
        { q: "Can my clients access the system and submit requests?", a: "Today clients are added as dedicated users. Each client sees only their own requests. A simplified client portal feature is on the roadmap." },
      ]
    },
    finalCta: {
      headline: "Bring order to your clients' requests.",
      sub: "Start now — the first 7 days are free, no credit card required.",
      proof1: "No credit card",
      proof2: "5-min setup",
      proof3: "GDPR compliant",
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
      keywords: "software for accounting firms, client request management, ticketing for agencies, consulting software, client task tracking, accountant ticket system",
      ogTitle: "TaskDesk — Practice Management for Firms & Agencies",
      ogDescription: "Manage client requests without scattered emails. Comments, deadlines, tracked solutions. From €35/month + VAT, all included.",
      twitterTitle: "TaskDesk — Practice Management for Firms & Agencies",
      twitterDescription: "Client requests without scattered emails. Comments, deadlines, tracked solutions. From €35/month + VAT.",
    },
    ticker: {
      rating: "⭐ 4.9/5 average satisfaction",
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
