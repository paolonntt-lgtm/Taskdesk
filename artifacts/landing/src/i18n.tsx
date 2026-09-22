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
    profiles: Array<{ icon: string; title: string; desc: string; detail: string }>;
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
      title: "Il lavoro del team, finalmente in ordine.",
      titleLine1: "Il lavoro del team,",
      titleLine2: "finalmente in ordine.",
      subtitle: "TaskDesk organizza attività, pratiche e scadenze in un unico posto. Assegna il lavoro ai collaboratori, confrontati in un thread e sai sempre cosa è stato completato.",
      cta: "Inizia gratis — 7 giorni",
      secondaryCta: "Scopri come funziona",
      trialBadge: "7 giorni gratis",
      trialNote: "Nessuna carta di credito richiesta",
      microProof: "7 giorni gratis · Nessuna carta · Cancella quando vuoi",
      reassurance: "Scelto da studi, agenzie e team in tutta Italia",
    },
    whoUses: {
      title: "Fatto per chi lavora con i clienti ogni giorno",
      subtitle: "Studi, agenzie e consulenti usano TaskDesk per mettere ordine nelle richieste senza complicazioni.",
      profiles: [
        {
          icon: "building",
          title: "Studio Commerciale",
          desc: "Gestisci le pratiche fiscali e contabili dei clienti senza email disperse.",
          detail: "Dichiarazioni, F24, visure, revisioni — ogni richiesta ha uno stato, un assegnatario e una scadenza.",
        },
        {
          icon: "target",
          title: "Agenzia",
          desc: "Tieni traccia di brief, revisioni e consegne senza perdere nulla.",
          detail: "Il cliente manda la richiesta, il team la prende in carico, tutti vedono lo stato in tempo reale.",
        },
        {
          icon: "briefcase",
          title: "Studio di Consulenza",
          desc: "Organizza le richieste dei clienti e assegnale ai tuoi consulenti.",
          detail: "Ogni consulente vede solo le pratiche assegnate. Niente confusione, niente sovrapposizioni.",
        },
      ],
    },
    pain: {
      title: "Quante richieste stai perdendo oggi?",
      subtitle: "Senza un sistema dedicato, le richieste dei clienti finiscono ovunque — e alcune non tornano mai.",
      cards: [
        {
          icon: "mail",
          title: "Email disperse su più caselle",
          desc: "Le richieste arrivano via email, WhatsApp, telefono e a voce. Non c'è un posto unico dove trovarle tutte.",
        },
        {
          icon: "clock",
          title: "Scadenze che si perdono",
          desc: "Senza un sistema, le pratiche urgenti si seppelliscono tra i messaggi. Il cliente aspetta. Lo studio perde credibilità.",
        },
        {
          icon: "visibility",
          title: "Nessuna visibilità su chi sta facendo cosa",
          desc: "Non sai se un collega ha già preso in carico una pratica, né se il cliente è stato aggiornato sull'avanzamento.",
        },
      ],
    },
    testimonials: {
      ratingLabel: "4.9/5 — Valutazione media",
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
      subtitle: "Gli strumenti essenziali per coordinare il lavoro e mantenere il team allineato.",
      cta: "Inizia gratis — 7 giorni",
      items: {
        creation: {
          title: "Crea un'attività in pochi secondi",
          desc: "Apri una pratica e assegnala al collaboratore giusto, senza frizioni."
        },
        priority: {
          title: "Priorità e scadenze sempre visibili",
          desc: "Tieni sempre sotto controllo cosa è urgente e cosa è già in lavorazione. Niente pratiche dimenticate."
        },
        history: {
          title: "Conversazioni in un unico thread",
          desc: "Commenti, allegati e @menzioni per coinvolgere il collega giusto, senza email disperse."
        },
        solution: {
          title: "Chiusure sempre tracciate",
          desc: "Chi completa il lavoro marca la soluzione. Il team vede subito cosa è stato fatto."
        },
        stats: {
          title: "Report e Statistiche",
          desc: "Dashboard chiara per capire come lavora il tuo team: attività per stato, categoria e collaboratore.",
          bullets: [
            "Grafici per stato, priorità e categoria",
            "Trend pratiche degli ultimi 30 giorni",
            "Statistiche per collaboratore"
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
          icon: "edit",
          title: "Crea un'attività",
          desc: "Titolo, categoria e scadenza: in pochi secondi il lavoro è tracciato e visibile al team.",
        },
        {
          n: "2",
          icon: "message",
          title: "Assegna e lavora insieme",
          desc: "Commenti, @menzioni e allegati in un unico thread, sempre ricercabile.",
        },
        {
          n: "3",
          icon: "check",
          title: "Completa e archivia",
          desc: "Chi chiude l'attività marca la soluzione. Il lavoro resta tracciato e il team sa che è fatto.",
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
      title: "Le risposte che servono",
      items: [
        { q: "È adatto al mio studio o al mio team?", a: "Sì. TaskDesk aiuta studi, agenzie e team a organizzare attività e pratiche, assegnarle ai collaboratori e seguirle fino alla chiusura — senza email disperse o informazioni introvabili." },
        { q: "C'è un periodo di prova gratuita?", a: "Sì! I primi 7 giorni sono completamente gratuiti, senza bisogno di inserire la carta di credito. Al termine puoi scegliere il piano più adatto al tuo studio, da €35/mese + IVA (o €350/anno + IVA). Enterprise su preventivo." },
        { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso. Sei operativo in pochi minuti, senza formazione." },
        { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione. Puoi disdire in qualsiasi momento dalla tua area account." },
        { q: "Posso gestire ruoli e collaboratori?", a: "Sì. Puoi invitare i collaboratori, assegnare le attività e definire ruoli e permessi per mantenere ogni persona concentrata sul lavoro che le compete." },
      ]
    },
    finalCta: {
      headline: "Metti ordine nel lavoro del team.",
      sub: "Inizia subito — i primi 7 giorni sono gratis, senza carta di credito.",
      proof1: "Nessuna carta di credito",
      proof2: "Setup in 5 minuti",
      proof3: "GDPR compliant",
    },
    footer: {
      text: "© 2025 TaskDesk. Il sistema per organizzare il lavoro di studi, agenzie e team italiani.",
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
      title: "TaskDesk — Organizza il lavoro del tuo team",
      description: "Organizza attività, pratiche e scadenze, assegnale ai collaboratori e segui ogni lavoro fino alla chiusura. 7 giorni gratis.",
      keywords: "software organizzazione team, gestione attività collaboratori, gestione pratiche studio, ticketing per team, software per agenzie, coordinamento lavoro",
      ogTitle: "TaskDesk — Organizza il lavoro del tuo team",
      ogDescription: "Attività, pratiche e scadenze in un unico posto. Assegnazioni, commenti e chiusure tracciate per il tuo team.",
      twitterTitle: "TaskDesk — Organizza il lavoro del tuo team",
      twitterDescription: "Organizza il lavoro del team senza email disperse. Attività, assegnazioni e scadenze sempre sotto controllo.",
    },
    ticker: {
      rating: "4.9/5 soddisfazione media",
      setup: "Setup in 5 minuti",
      trial: "7 giorni gratis",
      gdpr: "GDPR Compliant",
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
      title: "Your team's work, finally under control.",
      titleLine1: "Your team's work,",
      titleLine2: "finally under control.",
      subtitle: "TaskDesk organizes tasks, work items and deadlines in one place. Assign work to collaborators, discuss it in a thread and always know what is complete.",
      cta: "Start free — 7 days",
      secondaryCta: "See how it works",
      trialBadge: "7 days free",
      trialNote: "No credit card required",
      microProof: "7 days free · No credit card · Cancel anytime",
      reassurance: "Chosen by firms, agencies and teams across Italy",
    },
    whoUses: {
      title: "Built for those who work with clients every day",
      subtitle: "Firms, agencies and consultants use TaskDesk to bring order to client requests — without the complexity.",
      profiles: [
        {
          icon: "building",
          title: "Accounting Firm",
          desc: "Manage client filings and accounting requests without scattered emails.",
          detail: "Tax returns, payments, reviews — every request has a status, an assignee and a deadline.",
        },
        {
          icon: "target",
          title: "Agency",
          desc: "Track briefs, revisions and deliverables without losing anything.",
          detail: "The client sends a request, the team picks it up, everyone sees the status in real time.",
        },
        {
          icon: "briefcase",
          title: "Consulting Firm",
          desc: "Organise client requests and assign them to your consultants.",
          detail: "Each consultant sees only their assigned work. No confusion, no overlap.",
        },
      ],
    },
    pain: {
      title: "How many client requests are slipping through today?",
      subtitle: "Without a dedicated system, client requests end up everywhere — and some never come back.",
      cards: [
        {
          icon: "mail",
          title: "Requests scattered across channels",
          desc: "Requests arrive via email, WhatsApp, phone and in person. There's no single place to find them all.",
        },
        {
          icon: "clock",
          title: "Deadlines that get lost",
          desc: "Without a system, urgent tasks get buried in messages. The client waits. Your firm loses credibility.",
        },
        {
          icon: "visibility",
          title: "No visibility into who's doing what",
          desc: "You don't know whether a colleague has already picked something up, or whether the client has been updated.",
        },
      ],
    },
    testimonials: {
      ratingLabel: "4.9/5 — Average rating",
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
      subtitle: "The essential tools to coordinate work and keep your team aligned.",
      cta: "Start free — 7 days",
      items: {
        creation: {
          title: "Create a task in seconds",
          desc: "Open a work item and assign it to the right collaborator — friction-free."
        },
        priority: {
          title: "Priorities and deadlines always visible",
          desc: "Always keep track of what's urgent and what's in progress. No more forgotten tasks."
        },
        history: {
          title: "One thread for every task",
          desc: "Comments, attachments and @mentions keep the right colleagues involved, without scattered emails."
        },
        solution: {
          title: "Completion always tracked",
          desc: "Whoever finishes the work marks the solution. The team can immediately see what is done."
        },
        stats: {
          title: "Reports & Statistics",
          desc: "A clear dashboard to understand how your team works: tasks by status, category and collaborator.",
          bullets: [
            "Charts by status, priority and category",
            "Request trend over the last 30 days",
            "Statistics by collaborator"
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
          icon: "edit",
          title: "Create a task",
          desc: "Title, category and deadline: the work is tracked in seconds and visible to the team.",
        },
        {
          n: "2",
          icon: "message",
          title: "Assign and work together",
          desc: "Comments, @mentions and attachments in a single thread, always searchable.",
        },
        {
          n: "3",
          icon: "check",
          title: "Complete and archive",
          desc: "Whoever closes the task marks the solution. The work stays traceable and the team knows it is done.",
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
      title: "The answers you need",
      items: [
        { q: "Is it right for my firm or team?", a: "Yes. TaskDesk helps firms, agencies and teams organise work, assign it to collaborators and follow it through to completion — without scattered emails or hard-to-find information." },
        { q: "Is there a free trial?", a: "Yes! The first 7 days are completely free, with no credit card required. Afterwards you can choose the plan that best suits your firm, from €35/month + VAT (or €350/year + VAT). Enterprise is priced on request." },
        { q: "Is there a setup cost?", a: "Absolutely not. The software is ready to use from your first login. You are up and running in minutes, with no training needed." },
        { q: "Can I cancel at any time?", a: "Yes, there are no contractual commitments or cancellation fees. You can cancel at any time from your account area." },
        { q: "Can I manage roles and collaborators?", a: "Yes. Invite collaborators, assign tasks and define roles and permissions so everyone stays focused on the work they own." },
      ]
    },
    finalCta: {
      headline: "Bring order to your team's work.",
      sub: "Start now — the first 7 days are free, no credit card required.",
      proof1: "No credit card",
      proof2: "5-min setup",
      proof3: "GDPR compliant",
    },
    footer: {
      text: "© 2025 TaskDesk. The work management system for Italian firms, agencies and teams.",
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
      title: "TaskDesk — Organize your team's work",
      description: "Organize tasks, work items and deadlines, assign them to collaborators and track every job through completion. 7-day free trial.",
      keywords: "team work management software, collaborator task management, practice management software, agency team ticketing, work coordination software",
      ogTitle: "TaskDesk — Organize your team's work",
      ogDescription: "Tasks, work items and deadlines in one place. Assignments, comments and tracked completion for your team.",
      twitterTitle: "TaskDesk — Organize your team's work",
      twitterDescription: "Organize team work without scattered emails. Tasks, assignments and deadlines always under control.",
    },
    ticker: {
      rating: "4.9/5 average satisfaction",
      setup: "5-min setup",
      trial: "7 days free",
      gdpr: "GDPR Compliant",
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
