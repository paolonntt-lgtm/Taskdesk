import { createContext, useContext, useState, ReactNode } from "react";

type Language = "it" | "en";

interface Translations {
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
  };
  pricing: {
    title: string;
    price: string;
    unit: string;
    subtitle: string;
    trialLabel: string;
    trialHeader: string;
    perMonth: string;
    mostPopular: string;
    seatsSuffix: string;
    seatsUnlimited: string;
    plans: Array<{
      name: string;
      price: string;
      seats: number | null;
      desc: string;
      highlight?: boolean;
      cta: string;
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
  };
}

const translations: Record<Language, Translations> = {
  it: {
    nav: {
      features: "Funzionalità",
      pricing: "Prezzi",
      faq: "FAQ",
      login: "Accedi",
    },
    hero: {
      title: "Il tuo team risolve i ticket — non li insegue.",
      titleLine1: "Il tuo team risolve i ticket",
      titleLine2: "— non li insegue.",
      subtitle: "Apri un ticket in 10 secondi. Il team commenta, si menziona a vicenda e segna la soluzione. Niente email perse, niente richieste dimenticate.",
      cta: "Inizia la prova gratuita",
      secondaryCta: "Scopri come funziona",
      trialBadge: "7 giorni gratis",
      trialNote: "Nessuna carta di credito richiesta",
      microProof: "7 giorni gratis · Nessuna carta · Cancella quando vuoi",
    },
    problem: {
      title: "I software enterprise sono gonfiati, costosi e lenti.",
      description: "Abbiamo eliminato il superfluo. Solo ciò che serve per gestire le richieste della tua azienda in modo impeccabile, con l'eleganza di un design essenziale."
    },
    proofBar: {
      setup: "Setup in 5 minuti",
      gdpr: "GDPR Compliant",
      trial: "7 giorni gratis",
      cancel: "Nessun vincolo contrattuale",
    },
    features: {
      title: "Tutto quello che serve. Niente di più.",
      subtitle: "Strumenti essenziali progettati con cura maniacale per la massima efficienza.",
      cta: "Inizia la prova gratuita",
      items: {
        creation: {
          title: "Creazione e Assegnazione",
          desc: "Apri un ticket in pochi secondi e assegnalo alla persona giusta, senza frizioni."
        },
        priority: {
          title: "Gestione Priorità e Stato",
          desc: "Tieni sempre sotto controllo cosa è urgente e cosa è già in lavorazione."
        },
        history: {
          title: "Commenti in thread",
          desc: "Ogni ticket è una conversazione: risposte, allegati e @menzioni per coinvolgere chi serve, senza email disperse."
        },
        solution: {
          title: "Soluzione marcata",
          desc: "Chi risolve marca il commento giusto come soluzione. Tutti vedono subito cosa ha funzionato — niente ambiguità."
        },
        stats: {
          title: "Report e Statistiche",
          desc: "Dashboard chiara per capire come sta performando il tuo team: trend, categorie, tempi di risposta.",
          bullets: [
            "Grafici per stato, priorità e categoria",
            "Trend ticket degli ultimi 30 giorni",
            "Statistiche per sede e operatore"
          ]
        },
        multi: {
          title: "Supporto Multi-Sede",
          desc: "Gestisci Sede A, Sede B e oltre, tutto da un'unica piattaforma centralizzata."
        },
        roles: {
          title: "Ruoli e Permessi",
          desc: "Admin per chi gestisce, User per chi richiede. Controllo preciso su chi vede e fa cosa."
        },
        fast: {
          title: "Semplice e Veloce",
          desc: "Nessun setup infinito. Sei operativo in pochi minuti, letteralmente."
        }
      }
    },
    howItWorks: {
      cta: "Inizia la prova gratuita",
    },
    pricing: {
      title: "Un piano per ogni team. Trasparente, senza sorprese.",
      price: "€9",
      unit: "/mese",
      subtitle: "Prezzo fisso per team, non per utente. Cambi piano quando vuoi.",
      trialLabel: "7 giorni di prova gratuita inclusi — nessuna carta di credito",
      trialHeader: "Prima prova gratis, poi scegli il piano",
      perMonth: "/mese",
      mostPopular: "Più scelto",
      seatsSuffix: "utenti inclusi",
      seatsUnlimited: "Utenti illimitati",
      plans: [
        { name: "Starter",    price: "€9",   seats: 5,                       desc: "Per piccoli team che iniziano con la gestione ticket.",                cta: "Inizia la prova" },
        { name: "Team",       price: "€25",  seats: 15,                      desc: "Per team in crescita che vogliono organizzazione e velocità.",        highlight: true, cta: "Inizia la prova" },
        { name: "Business",   price: "€69",  seats: 50,                      desc: "Per aziende strutturate con più reparti e sedi.",                     cta: "Inizia la prova" },
        { name: "Enterprise", price: "€149", seats: null as number | null,   desc: "Per organizzazioni che hanno bisogno di scalabilità senza limiti.",   cta: "Contattaci" },
      ],
      includedTitle: "Tutto incluso in ogni piano",
      includedSubtitle: "Stesse funzionalità per tutti. Cambia solo il numero di utenti.",
      included: [
        "Ticket e storage illimitati",
        "Dashboard e report dettagliati",
        "Gruppi di lavoro e assegnazioni",
        "Multi-sede e ruoli avanzati",
        "Notifiche in-app ed email personalizzabili",
        "Supporto via email",
      ],
      cta: "Inizia la prova gratuita"
    },
    faq: {
      title: "Domande Frequenti",
      items: [
        { q: "C'è un periodo di prova gratuita?", a: "Sì! I primi 7 giorni sono completamente gratuiti, senza bisogno di inserire la carta di credito. Al termine puoi scegliere il piano più adatto al tuo team, da €9/mese." },
        { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso. Sei operativo in pochi minuti." },
        { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione. Puoi disdire in qualsiasi momento dalla tua area account." },
        { q: "È adatto alla mia azienda?", a: "Se hai bisogno di mettere ordine nelle richieste interne o dei clienti senza setup complicati e senza spendere una fortuna, sì. TaskDesk è progettato per essere semplice da avviare e facile da usare ogni giorno." }
      ]
    },
    finalCta: {
      headline: "Pronto a smettere di rincorrere i ticket?",
      sub: "Inizia subito — i primi 7 giorni sono gratis, senza carta di credito.",
      proof1: "Nessuna carta di credito",
      proof2: "Setup in 5 minuti",
      proof3: "GDPR compliant",
    },
    footer: {
      text: "© 2025 TaskDesk. Il design essenziale per il business italiano."
    },
  },
  en: {
    nav: {
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      login: "Login",
    },
    hero: {
      title: "Your team solves tickets — it doesn't chase them.",
      titleLine1: "Your team solves tickets",
      titleLine2: "— it doesn't chase them.",
      subtitle: "Open a ticket in 10 seconds. The team comments, mentions each other, and marks the solution. No lost emails, no forgotten requests.",
      cta: "Start free trial",
      secondaryCta: "See how it works",
      trialBadge: "7 days free",
      trialNote: "No credit card required",
      microProof: "7 days free · No credit card · Cancel anytime",
    },
    problem: {
      title: "Enterprise software is bloated, expensive, and slow.",
      description: "We removed the excess. Only what you need to manage your company's requests flawlessly, with the elegance of essential design."
    },
    proofBar: {
      setup: "5-min setup",
      gdpr: "GDPR Compliant",
      trial: "7 days free",
      cancel: "No commitment",
    },
    features: {
      title: "Everything you need. Nothing you don't.",
      subtitle: "Essential tools designed with obsessive care for maximum efficiency.",
      cta: "Start free trial",
      items: {
        creation: {
          title: "Ticket Creation & Assignment",
          desc: "Open a ticket in seconds and assign it to the right person, friction-free."
        },
        priority: {
          title: "Priority & Status Management",
          desc: "Always keep track of what's urgent and what's currently being worked on."
        },
        history: {
          title: "Threaded Comments",
          desc: "Every ticket is a conversation: replies, attachments and @mentions to involve the right people — without scattered emails."
        },
        solution: {
          title: "Marked Solution",
          desc: "Whoever resolves it marks the right comment as the solution. Everyone sees immediately what worked — no ambiguity."
        },
        stats: {
          title: "Reports & Statistics",
          desc: "Clear dashboard to understand how your team is performing: trends, categories, response times.",
          bullets: [
            "Charts by status, priority and category",
            "Ticket trend over the last 30 days",
            "Statistics by location and assignee"
          ]
        },
        multi: {
          title: "Multi-Location Support",
          desc: "Manage Location A, Location B and beyond, all from a single centralized platform."
        },
        roles: {
          title: "Roles & Permissions",
          desc: "Admin for those who manage, User for those who request. Precise control over who sees and does what."
        },
        fast: {
          title: "Simple & Fast",
          desc: "No endless setup. You are up and running in minutes, literally."
        }
      }
    },
    howItWorks: {
      cta: "Start free trial",
    },
    pricing: {
      title: "A plan for every team. Transparent, no surprises.",
      price: "€9",
      unit: "/month",
      subtitle: "Flat price per team, not per user. Switch plans anytime.",
      trialLabel: "7-day free trial included — no credit card required",
      trialHeader: "Try free first, then pick your plan",
      perMonth: "/month",
      mostPopular: "Most popular",
      seatsSuffix: "users included",
      seatsUnlimited: "Unlimited users",
      plans: [
        { name: "Starter",    price: "€9",   seats: 5,                       desc: "For small teams getting started with ticket management.",         cta: "Start trial" },
        { name: "Team",       price: "€25",  seats: 15,                      desc: "For growing teams that need structure and speed.",                 highlight: true, cta: "Start trial" },
        { name: "Business",   price: "€69",  seats: 50,                      desc: "For structured companies with multiple teams and sites.",         cta: "Start trial" },
        { name: "Enterprise", price: "€149", seats: null as number | null,   desc: "For organizations that need to scale without limits.",            cta: "Contact us" },
      ],
      includedTitle: "Everything included in every plan",
      includedSubtitle: "Same features across all plans. Only the user count changes.",
      included: [
        "Unlimited tickets and storage",
        "Detailed dashboard and reports",
        "Workgroups and assignments",
        "Multi-location and advanced roles",
        "Customizable in-app and email notifications",
        "Email support",
      ],
      cta: "Start free trial"
    },
    faq: {
      title: "Frequently Asked Questions",
      items: [
        { q: "Is there a free trial?", a: "Yes! The first 7 days are completely free, with no credit card required. After that you can pick the plan that fits your team, starting at €9/month." },
        { q: "Is there a setup fee?", a: "Absolutely not. The software is ready to use from the first login. You are up and running in minutes." },
        { q: "Can I cancel at any time?", a: "Yes, there are no contractual obligations or cancellation penalties. You can cancel at any time from your account area." },
        { q: "Is it suitable for my company?", a: "If you are an SME that needs to bring order to internal or customer requests without spending a fortune, yes." }
      ]
    },
    finalCta: {
      headline: "Ready to stop chasing tickets?",
      sub: "Start now — the first 7 days are free, no credit card required.",
      proof1: "No credit card",
      proof2: "5-min setup",
      proof3: "GDPR compliant",
    },
    footer: {
      text: "© 2025 TaskDesk. Essential design for business."
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
  const [lang, setLang] = useState<Language>("it");

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
