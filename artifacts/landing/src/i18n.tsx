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
    subtitle: string;
    cta: string;
    secondaryCta: string;
    trialBadge: string;
    trialNote: string;
  };
  problem: {
    title: string;
    description: string;
  };
  features: {
    title: string;
    subtitle: string;
    items: {
      creation: { title: string; desc: string };
      priority: { title: string; desc: string };
      history: { title: string; desc: string };
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
    trialLabel: string;
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
      features: string[];
      cta: string;
    }>;
    cta: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  footer: {
    text: string;
  };
  appBanner: {
    subtitle: string;
    open: string;
    downloadCta: string;
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
      title: "Il supporto tecnico non deve essere complicato.",
      subtitle: "TaskDesk è l'alternativa chiara, diretta e ultra-accessibile ai complessi help desk aziendali. Pensato per le PMI italiane che vogliono far funzionare le cose, senza leggere manuali.",
      cta: "Inizia la prova gratuita",
      secondaryCta: "Scopri come funziona",
      trialBadge: "7 giorni gratis",
      trialNote: "Nessuna carta di credito richiesta",
    },
    problem: {
      title: "I software enterprise sono gonfiati, costosi e lenti.",
      description: "Abbiamo eliminato il superfluo. Solo ciò che serve per gestire le richieste della tua azienda in modo impeccabile, con l'eleganza di un design essenziale."
    },
    features: {
      title: "Tutto quello che serve. Niente di più.",
      subtitle: "Strumenti essenziali progettati con cura maniacale per la massima efficienza.",
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
          title: "Commenti e Cronologia",
          desc: "Una singola fonte di verità per ogni richiesta, accessibile a tutti i collaboratori."
        },
        stats: {
          title: "Report e Statistiche",
          desc: "Dati chiari e leggibili per capire come sta performando il tuo team.",
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
          title: "Accesso Basato su Ruoli",
          desc: "Admin per chi gestisce, User per chi richiede. Semplice e sicuro."
        },
        fast: {
          title: "Semplice e Veloce",
          desc: "Nessun setup infinito. Sei operativo in pochi minuti, letteralmente."
        }
      }
    },
    pricing: {
      title: "Un piano per ogni team. Trasparente, senza sorprese.",
      price: "€9",
      unit: "/mese",
      subtitle: "Scegli il piano in base al numero di utenti. Cambi quando vuoi, paghi solo la differenza.",
      trialLabel: "7 giorni di prova gratuita inclusi — nessuna carta di credito",
      perMonth: "/mese",
      mostPopular: "Più scelto",
      seatsSuffix: "utenti inclusi",
      seatsUnlimited: "Utenti illimitati",
      plans: [
        {
          name: "Starter",
          price: "€9",
          seats: 5,
          desc: "Per piccoli team che iniziano con la gestione ticket.",
          features: [
            "Fino a 5 utenti",
            "Ticket e storage illimitati",
            "Dashboard e report base",
            "Notifiche in-app ed email",
            "Supporto via email",
          ],
          cta: "Inizia la prova",
        },
        {
          name: "Team",
          price: "€25",
          seats: 15,
          desc: "Per team in crescita che vogliono organizzazione e velocità.",
          highlight: true,
          features: [
            "Fino a 15 utenti",
            "Tutto del piano Starter",
            "Gruppi di lavoro e assegnazioni",
            "Notifiche personalizzate per tipo",
            "Multi-sede e ruoli avanzati",
          ],
          cta: "Inizia la prova",
        },
        {
          name: "Business",
          price: "€69",
          seats: 50,
          desc: "Per aziende strutturate con più reparti e sedi.",
          features: [
            "Fino a 50 utenti",
            "Tutto del piano Team",
            "Report dettagliati e priorità",
            "SLA e tempi di risposta",
            "Onboarding dedicato",
          ],
          cta: "Inizia la prova",
        },
        {
          name: "Enterprise",
          price: "€149",
          seats: null as number | null,
          desc: "Per organizzazioni che hanno bisogno di scalabilità senza limiti.",
          features: [
            "Utenti illimitati",
            "Tutto del piano Business",
            "SLA dedicato",
            "Supporto prioritario",
            "Integrazioni su misura",
          ],
          cta: "Contattaci",
        },
      ],
      cta: "Inizia la prova gratuita"
    },
    faq: {
      title: "Domande Frequenti",
      items: [
        { q: "C'è un periodo di prova gratuita?", a: "Sì! I primi 7 giorni sono completamente gratuiti, senza bisogno di inserire la carta di credito. Al termine puoi scegliere il piano più adatto al tuo team, da €9/mese." },
        { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso. Sei operativo in pochi minuti." },
        { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione. Puoi disdire in qualsiasi momento dalla tua area account." },
        { q: "È adatto alla mia azienda?", a: "Se sei una PMI italiana che ha bisogno di mettere ordine nelle richieste interne o dei clienti senza spendere una fortuna, sì." }
      ]
    },
    footer: {
      text: "© 2025 TaskDesk. Il design essenziale per il business italiano."
    },
    appBanner: {
      subtitle: "Apri l'app di ticketing aziendale",
      open: "Apri",
      downloadCta: "Scarica l'app",
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
      title: "IT support doesn't have to be complicated.",
      subtitle: "TaskDesk is the clear, direct, and ultra-affordable alternative to bloated enterprise help desks. Designed for businesses that want things to just work, without reading manuals.",
      cta: "Start free trial",
      secondaryCta: "See how it works",
      trialBadge: "7 days free",
      trialNote: "No credit card required",
    },
    problem: {
      title: "Enterprise software is bloated, expensive, and slow.",
      description: "We removed the excess. Only what you need to manage your company's requests flawlessly, with the elegance of essential design."
    },
    features: {
      title: "Everything you need. Nothing you don't.",
      subtitle: "Essential tools designed with obsessive care for maximum efficiency.",
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
          title: "Comments & History",
          desc: "A single source of truth for every request, accessible to all collaborators."
        },
        stats: {
          title: "Reports & Statistics",
          desc: "Clear and readable data to understand how your team is performing.",
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
          title: "Role-Based Access",
          desc: "Admin for those who manage, User for those who request. Simple and secure."
        },
        fast: {
          title: "Simple & Fast",
          desc: "No endless setup. You are up and running in minutes, literally."
        }
      }
    },
    pricing: {
      title: "A plan for every team. Transparent, no surprises.",
      price: "€9",
      unit: "/month",
      subtitle: "Pick a plan based on how many users you have. Switch anytime — only pay the difference.",
      trialLabel: "7-day free trial included — no credit card required",
      perMonth: "/month",
      mostPopular: "Most popular",
      seatsSuffix: "users included",
      seatsUnlimited: "Unlimited users",
      plans: [
        {
          name: "Starter",
          price: "€9",
          seats: 5,
          desc: "For small teams getting started with ticket management.",
          features: [
            "Up to 5 users",
            "Unlimited tickets and storage",
            "Basic dashboard and reports",
            "In-app and email notifications",
            "Email support",
          ],
          cta: "Start trial",
        },
        {
          name: "Team",
          price: "€25",
          seats: 15,
          desc: "For growing teams that need structure and speed.",
          highlight: true,
          features: [
            "Up to 15 users",
            "Everything in Starter",
            "Workgroups and assignments",
            "Per-event notification preferences",
            "Multi-location and advanced roles",
          ],
          cta: "Start trial",
        },
        {
          name: "Business",
          price: "€69",
          seats: 50,
          desc: "For structured companies with multiple teams and sites.",
          features: [
            "Up to 50 users",
            "Everything in Team",
            "Detailed reports and priorities",
            "SLAs and response times",
            "Dedicated onboarding",
          ],
          cta: "Start trial",
        },
        {
          name: "Enterprise",
          price: "€149",
          seats: null as number | null,
          desc: "For organizations that need to scale without limits.",
          features: [
            "Unlimited users",
            "Everything in Business",
            "Dedicated SLA",
            "Priority support",
            "Custom integrations",
          ],
          cta: "Contact us",
        },
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
    footer: {
      text: "© 2025 TaskDesk. Essential design for business."
    },
    appBanner: {
      subtitle: "Open the company ticketing app",
      open: "Open",
      downloadCta: "Download app",
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
