import { PROFESSIONS, type ProfessionId, type ProfessionLanguage } from "./profession-content";
import type { ProfessionLandingProps } from "./pages/ProfessionLanding";

export const PROFESSION_IDS: ProfessionId[] = [
  "commercialisti",
  "avvocati",
  "consulenti-del-lavoro",
  "notai",
  "commercio",
  "agenzie",
];

export const PROFESSION_SLUGS: Record<ProfessionLanguage, Record<ProfessionId, string>> = {
  it: {
    commercialisti: "commercialista",
    avvocati: "avvocato",
    "consulenti-del-lavoro": "consulente-del-lavoro",
    notai: "notaio",
    commercio: "commercio",
    agenzie: "agenzia",
  },
  en: {
    commercialisti: "accountant",
    avvocati: "lawyer",
    "consulenti-del-lavoro": "employment-consultant",
    notai: "notary",
    commercio: "commerce",
    agenzie: "agency",
  },
};

const SITE_BASE_URL = "https://taskdesk.it";

const SEO_COPY: Record<
  ProfessionId,
  Record<ProfessionLanguage, { title: string; description: string }>
> = {
  commercialisti: {
    it: {
      title: "TaskDesk per commercialisti | Richieste clienti",
      description:
        "Organizza richieste, documenti e scadenze del tuo studio di commercialisti. Assegna ogni attività al team e mantieni aggiornato il cliente.",
    },
    en: {
      title: "TaskDesk for Accountants | Client Requests",
      description:
        "Organise client requests, documents and deadlines in your accounting practice. Assign work across the team and keep every client updated.",
    },
  },
  avvocati: {
    it: {
      title: "TaskDesk per avvocati | Lavoro dello studio",
      description:
        "Raccogli richieste, documenti e aggiornamenti delle pratiche legali in un flusso condiviso, con responsabili e prossimi passaggi visibili.",
    },
    en: {
      title: "TaskDesk for Law Firms | Matter Workflow",
      description:
        "Bring legal client requests, documents and matter updates into one shared workflow, with clear ownership and next steps for your team.",
    },
  },
  "consulenti-del-lavoro": {
    it: {
      title: "TaskDesk per consulenti del lavoro",
      description:
        "Coordina richieste aziendali, documenti del personale e attività dello studio con assegnazioni chiare e aggiornamenti sempre collegati.",
    },
    en: {
      title: "TaskDesk for Labour Consultants",
      description:
        "Coordinate employer requests, employee documents and practice tasks with clear ownership and updates connected to every request.",
    },
  },
  notai: {
    it: {
      title: "TaskDesk per notai | Gestione delle pratiche notarili",
      description: "Coordina richieste, documenti e attività dello studio notarile con responsabili e aggiornamenti sempre visibili.",
    },
    en: {
      title: "TaskDesk for Notaries | Notary Practice Workflow",
      description: "Coordinate requests, documents and work across your notary practice with clear ownership and visible updates.",
    },
  },
  commercio: {
    it: {
      title: "TaskDesk per il commercio | Richieste e attività clienti",
      description: "Coordina richieste dei clienti, ordini e attività del team commerciale in un flusso condiviso.",
    },
    en: {
      title: "TaskDesk for Commerce | Customer Requests and Tasks",
      description: "Coordinate customer requests, orders and team tasks in one shared commerce workflow.",
    },
  },
  agenzie: {
    it: {
      title: "TaskDesk per agenzie | Richieste e progetti cliente",
      description: "Coordina richieste, revisioni e consegne dei clienti in un unico flusso condiviso per il team dell'agenzia.",
    },
    en: {
      title: "TaskDesk for Agencies | Client Requests and Projects",
      description: "Coordinate client requests, reviews and deliverables in one shared workflow for your agency team.",
    },
  },
};

function absoluteRoute(lang: ProfessionLanguage, profession: ProfessionId): string {
  return `${SITE_BASE_URL}/${lang}/${PROFESSION_SLUGS[lang][profession]}`;
}

export function getProfessionPageProps(profession: ProfessionId): ProfessionLandingProps {
  const itUrl = absoluteRoute("it", profession);
  const enUrl = absoluteRoute("en", profession);

  return {
    profession,
    routes: {
      it: {
        home: "/it/",
        professions: Object.fromEntries(
          PROFESSION_IDS.map((id) => [id, `/it/${PROFESSION_SLUGS.it[id]}`]),
        ) as Record<ProfessionId, string>,
      },
      en: {
        home: "/en/",
        professions: Object.fromEntries(
          PROFESSION_IDS.map((id) => [id, `/en/${PROFESSION_SLUGS.en[id]}`]),
        ) as Record<ProfessionId, string>,
      },
    },
    metadata: {
      it: {
        ...SEO_COPY[profession].it,
        canonical: itUrl,
        alternates: { it: itUrl, en: enUrl, xDefault: itUrl },
      },
      en: {
        ...SEO_COPY[profession].en,
        canonical: enUrl,
        alternates: { it: itUrl, en: enUrl, xDefault: itUrl },
      },
    },
  };
}
