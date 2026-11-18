import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";

const SITE_BASE = "https://taskdesk.it";
const APP_URL = "/app/";
const PRIVACY_URL = "/it/privacy-policy";
const CONTACT_EMAIL = "privacy@taskdesk.it";

export default function AccountDeletion() {
  const { lang } = useLanguage();
  const isItalian = lang === "it";
  const pageUrl = `${SITE_BASE}/${lang}/account-deletion`;
  const socialImage = `${SITE_BASE}/${isItalian ? "opengraph-it.jpg" : "opengraph.jpg"}`;
  const socialImageAlt = isItalian
    ? "TaskDesk — gestione pratiche e richieste clienti"
    : "TaskDesk — Ticket management software";

  const copy = isItalian
    ? {
        title: "Richiesta di eliminazione dell’account TaskDesk",
        description: "Come richiedere l’eliminazione del proprio account TaskDesk e dei dati personali associati.",
        back: "Torna a TaskDesk",
        heading: "Eliminazione account e dati",
        intro: "Puoi richiedere l’eliminazione del tuo account TaskDesk in uno di questi modi:",
        signedIn: "Se riesci ad accedere, apri TaskDesk e vai in Impostazioni → Profilo → Elimina il mio account. Conferma inserendo l’indirizzo email associato all’account.",
        email: "Se non riesci ad accedere, scrivi a privacy@taskdesk.it dall’indirizzo email associato al tuo account e chiedi l’eliminazione. Non inviare la password.",
        openApp: "Apri TaskDesk",
        mailSubject: "Richiesta di eliminazione account TaskDesk",
        whatDeleted: "Cosa viene eliminato",
        deletedDescription: "L’account viene disattivato, le sessioni di accesso revocate e i dati personali del profilo anonimizzati in modo irreversibile entro 30 giorni.",
        whatRetained: "Dati che possono essere conservati",
        retainedDescription: "I dati condivisi dell’organizzazione, come ticket, note e fatture, non vengono rimossi insieme al profilo: possono essere conservati per mantenere la cronologia aziendale e adempiere agli obblighi di legge. L’eliminazione dell’account non annulla un eventuale abbonamento.",
        adminNote: "Se sei l’unico amministratore di un’organizzazione o workspace, nomina prima un altro amministratore: in caso contrario l’eliminazione non può essere completata.",
        privacy: "Consulta l’informativa privacy",
      }
    : {
        title: "TaskDesk account deletion request",
        description: "How to request deletion of your TaskDesk account and associated personal data.",
        back: "Back to TaskDesk",
        heading: "Account and data deletion",
        intro: "You can request deletion of your TaskDesk account in either of these ways:",
        signedIn: "If you can sign in, open TaskDesk and go to Settings → Profile → Delete my account. Confirm by entering the email address associated with your account.",
        email: "If you cannot sign in, email privacy@taskdesk.it from the address associated with your account and request deletion. Do not send your password.",
        openApp: "Open TaskDesk",
        mailSubject: "TaskDesk account deletion request",
        whatDeleted: "What is deleted",
        deletedDescription: "Your account is deactivated, active sessions are revoked, and personal profile data is irreversibly anonymized within 30 days.",
        whatRetained: "Data that may be retained",
        retainedDescription: "Shared organization data, such as tickets, notes, and invoices, is not removed with your profile. It may be retained to preserve business records and meet legal obligations. Deleting your account does not cancel any subscription.",
        adminNote: "If you are the only administrator of an organization or workspace, appoint another administrator first. Otherwise, deletion cannot be completed.",
        privacy: "Read the Privacy Policy",
      };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Helmet>
        <html lang={lang} />
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:alt" content={socialImageAlt} />
        <meta name="twitter:title" content={copy.title} />
        <meta name="twitter:description" content={copy.description} />
        <meta name="twitter:image" content={socialImage} />
        <meta name="twitter:image:alt" content={socialImageAlt} />
      </Helmet>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href={`/${lang}/`} aria-label={copy.back}>
            <img src="/taskdesk-logo.svg" alt="TaskDesk" className="h-8 w-auto" />
          </Link>
          <Link
            href={`/${lang}/`}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            {copy.back}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{copy.heading}</h1>
          <p className="mt-4 leading-7 text-gray-700">{copy.intro}</p>
          <ol className="mt-5 list-decimal space-y-4 pl-5 leading-7 text-gray-700">
            <li>{copy.signedIn}</li>
            <li>
              {copy.email.split("privacy@taskdesk.it")[0]}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(copy.mailSubject)}`}
                className="font-semibold text-blue-700 underline underline-offset-2"
                data-testid="link-account-deletion-email"
              >
                {CONTACT_EMAIL}
              </a>
              {copy.email.split("privacy@taskdesk.it")[1]}
            </li>
          </ol>
          <a
            href={APP_URL}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            data-testid="link-open-taskdesk-for-deletion"
          >
            {copy.openApp}
          </a>
          <section className="mt-9 border-t border-gray-200 pt-7">
            <h2 className="text-lg font-bold">{copy.whatDeleted}</h2>
            <p className="mt-2 leading-7 text-gray-700">{copy.deletedDescription}</p>
          </section>
          <section className="mt-6">
            <h2 className="text-lg font-bold">{copy.whatRetained}</h2>
            <p className="mt-2 leading-7 text-gray-700">{copy.retainedDescription}</p>
            <p className="mt-3 leading-7 text-gray-700">{copy.adminNote}</p>
          </section>
          <Link
            href={PRIVACY_URL}
            className="mt-7 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2"
          >
            {copy.privacy}
          </Link>
        </article>
      </main>
    </div>
  );
}
