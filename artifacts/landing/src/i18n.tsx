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
      stats: { title: string; desc: string };
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
    features: string[];
    cta: string;
  };
  faq: {
    title: string;
    items: Array<{ q: string; a: string }>;
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
      title: "Il supporto tecnico non deve essere complicato.",
      subtitle: "Ticket Manager è l'alternativa chiara, diretta e ultra-accessibile ai complessi help desk aziendali. Pensato per le PMI italiane che vogliono far funzionare le cose, senza leggere manuali.",
      cta: "Inizia subito",
      secondaryCta: "Scopri come funziona",
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
          desc: "Dati chiari e leggibili per capire come sta performando il tuo team."
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
      title: "Un prezzo talmente semplice da sembrare un regalo.",
      price: "€1",
      unit: "/utente/mese",
      subtitle: "Nessun costo nascosto. Nessun contratto a lungo termine. Disdici quando vuoi.",
      features: [
        "Utenti illimitati (paghi solo per chi lo usa)",
        "Ticket e storage illimitati",
        "Tutte le funzionalità incluse",
        "Supporto via email"
      ],
      cta: "Crea il tuo account"
    },
    faq: {
      title: "Domande Frequenti",
      items: [
        { q: "C'è un costo di setup?", a: "Assolutamente no. Il software è pronto all'uso fin dal primo accesso." },
        { q: "Posso cancellare in qualsiasi momento?", a: "Sì, non ci sono vincoli contrattuali o penali di cancellazione." },
        { q: "È adatto alla mia azienda?", a: "Se sei una PMI italiana che ha bisogno di mettere ordine nelle richieste interne o dei clienti senza spendere una fortuna, sì." }
      ]
    },
    footer: {
      text: "© 2024 Ticket Manager. Il design essenziale per il business italiano."
    }
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
      subtitle: "Ticket Manager is the clear, direct, and ultra-affordable alternative to bloated enterprise help desks. Designed for businesses that want things to just work, without reading manuals.",
      cta: "Get started now",
      secondaryCta: "See how it works",
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
          desc: "Clear and readable data to understand how your team is performing."
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
      title: "A price so simple it feels like a gift.",
      price: "€1",
      unit: "/user/month",
      subtitle: "No hidden costs. No long-term contracts. Cancel anytime.",
      features: [
        "Unlimited users (pay only for active ones)",
        "Unlimited tickets and storage",
        "All features included",
        "Email support"
      ],
      cta: "Create your account"
    },
    faq: {
      title: "Frequently Asked Questions",
      items: [
        { q: "Is there a setup fee?", a: "Absolutely not. The software is ready to use from the first login." },
        { q: "Can I cancel at any time?", a: "Yes, there are no contractual obligations or cancellation penalties." },
        { q: "Is it suitable for my company?", a: "If you are an SME that needs to bring order to internal or customer requests without spending a fortune, yes." }
      ]
    },
    footer: {
      text: "© 2024 Ticket Manager. Essential design for business."
    }
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
