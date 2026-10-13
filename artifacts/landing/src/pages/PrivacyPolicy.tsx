import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";

const META = {
  it: {
    title: "Privacy Policy — TaskDesk",
    description: "Informativa sul trattamento dei dati personali ai sensi del GDPR (Reg. UE 2016/679) per gli utenti di taskdesk.it.",
  },
  en: {
    title: "Privacy Policy — TaskDesk",
    description: "Privacy notice for the processing of personal data under GDPR (EU Regulation 2016/679) for taskdesk.it users.",
  },
};

export default function PrivacyPolicy() {
  const { lang } = useLanguage();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // Body content is Italian-only; canonical always points to the Italian version
  // to avoid false hreflang="en" signals on untranslated legal content.
  const canonicalUrl = `https://taskdesk.it/it/privacy-policy`;
  const meta = META[lang];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Helmet>
        <html lang="it" />
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hrefLang="it" href={canonicalUrl} />
        <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:image" content="https://taskdesk.it/opengraph-it.jpg" />
        <meta property="og:image:alt" content="TaskDesk — gestione pratiche e richieste clienti" />
        <meta property="og:locale" content="it_IT" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content="https://taskdesk.it/opengraph-it.jpg" />
        <meta name="twitter:image:alt" content="TaskDesk — gestione pratiche e richieste clienti" />
      </Helmet>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <img src="/taskdesk-logo.webp" alt="TaskDesk" style={{ height: 32, width: "auto", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>/ Privacy Policy</span>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <Section title="1. Titolare del trattamento">
          <p>
            Il Titolare del trattamento dei dati personali raccolti tramite la piattaforma TaskDesk è:
          </p>
          <ul>
            <li><strong>Denominazione iscritta al Registro Imprese:</strong> IANNETTI PAOLO (Paolo Iannetti), impresa individuale</li>
            <li><strong>Sede:</strong> Via Danubio 21, 65015 Montesilvano (PE), Italia</li>
            <li><strong>Partita IVA:</strong> 02420280683</li>
            <li><strong>Codice fiscale:</strong> NNTPLA84T16G482R</li>
            <li><strong>REA:</strong> PE - 432412</li>
            <li><strong>Indirizzo email:</strong> privacy@taskdesk.it</li>
            <li><strong>PEC:</strong> paolo.iannetti@arubapec.it</li>
            <li><strong>Sito web:</strong> www.taskdesk.it</li>
          </ul>
          <p>
            Per qualsiasi questione relativa al trattamento dei tuoi dati personali puoi contattarci all'indirizzo email indicato sopra.
          </p>
        </Section>

        <Section title="2. Tipologie di dati raccolti">
          <p>TaskDesk raccoglie le seguenti categorie di dati personali:</p>
          <h3 style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Dati forniti direttamente dall'utente</h3>
          <ul>
            <li><strong>Dati di registrazione:</strong> nome, indirizzo email, password (conservata in forma cifrata), nome dell'organizzazione.</li>
            <li><strong>Dati del profilo:</strong> foto profilo, numero di telefono, sede principale, gruppo di appartenenza.</li>
            <li><strong>Contenuti generati:</strong> testo dei ticket, commenti, note interne, allegati caricati sulla piattaforma.</li>
          </ul>
          <h3 style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Dati raccolti automaticamente</h3>
          <ul>
            <li><strong>Dati di navigazione:</strong> indirizzo IP, tipo di browser, pagine visitate, data e ora di accesso.</li>
            <li><strong>Dati di sessione:</strong> cookie di sessione necessari al funzionamento del servizio.</li>
            <li><strong>Log di attività:</strong> azioni eseguite sulla piattaforma (apertura ticket, cambio stato, assegnazioni) a fini di audit e cronologia.</li>
            <li><strong>Dati tecnici di notifica:</strong> token push associato al dispositivo per recapitare notifiche nell'app mobile.</li>
          </ul>
          <h3 style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Dati di fatturazione</h3>
          <ul>
            <li>I dati relativi ai pagamenti (carta di credito, IBAN, ecc.) sono gestiti esclusivamente da <strong>Stripe Inc.</strong>, nostro fornitore di servizi di pagamento, e non vengono mai memorizzati sui nostri server. Stripe è certificato PCI-DSS.</li>
          </ul>
        </Section>

        <Section title="3. Finalità e base giuridica del trattamento">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={thStyle}>Finalità</th>
                <th style={thStyle}>Base giuridica</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Erogazione del servizio TaskDesk (gestione ticket, utenti, notifiche)", "Esecuzione del contratto (art. 6, par. 1, lett. b GDPR)"],
                ["Gestione degli account utente e autenticazione", "Esecuzione del contratto (art. 6, par. 1, lett. b GDPR)"],
                ["Fatturazione e gestione degli abbonamenti", "Esecuzione del contratto / obbligo legale (art. 6, par. 1, lett. b e c GDPR)"],
                ["Invio di comunicazioni relative al servizio (aggiornamenti, manutenzione)", "Legittimo interesse (art. 6, par. 1, lett. f GDPR)"],
                ["Misurazione aggregata dell'utilizzo tramite Google Analytics, solo previo consenso", "Consenso (art. 6, par. 1, lett. a GDPR)"],
                ["Sicurezza informatica e prevenzione delle frodi", "Legittimo interesse (art. 6, par. 1, lett. f GDPR)"],
                ["Adempimento di obblighi di legge", "Obbligo legale (art. 6, par. 1, lett. c GDPR)"],
              ].map(([fin, base], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}>{fin}</td>
                  <td style={tdStyle}>{base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Modalità di trattamento e conservazione">
          <p>
            I dati personali sono trattati con strumenti elettronici nel rispetto delle misure di sicurezza previste dal GDPR. In particolare:
          </p>
          <ul>
            <li>Le password sono conservate come hash bcrypt con 12 round di calcolo; non sono conservate in chiaro né recuperabili dal sistema.</li>
            <li>Le comunicazioni tra browser e server avvengono sempre tramite protocollo <strong>HTTPS/TLS</strong>.</li>
            <li>I database sono ospitati su infrastrutture cloud con accesso ristretto e audit log attivi.</li>
            <li>I dati di log di attività vengono conservati per un massimo di <strong>24 mesi</strong>.</li>
            <li>I dati dell'account vengono conservati per tutta la durata del contratto e per i <strong>12 mesi successivi</strong> alla sua scadenza, salvo diversi obblighi di legge.</li>
            <li>Dopo la cancellazione dell'account, i dati personali vengono anonimizzati in modo irreversibile entro 30 giorni.</li>
          </ul>
        </Section>

        <Section title="5. Destinatari dei dati">
          <p>I dati personali possono essere comunicati alle seguenti categorie di destinatari:</p>
          <ul>
            <li><strong>Fornitori di servizi tecnici:</strong> fornitori di infrastruttura cloud, hosting e database (es. Replit, Neon/PostgreSQL) che agiscono in qualità di Responsabili del trattamento ex art. 28 GDPR.</li>
            <li><strong>Stripe Inc.:</strong> per la gestione sicura dei pagamenti. Stripe opera in qualità di titolare autonomo per i dati di pagamento.</li>
            <li><strong>Resend Inc.:</strong> per l'invio di email transazionali (inviti, notifiche).</li>
            <li><strong>Expo:</strong> per l'instradamento delle notifiche push; riceve il token del dispositivo e i dati necessari al recapito della notifica.</li>
            <li><strong>Autorità competenti:</strong> qualora richiesto da obblighi di legge, regolamenti o provvedimenti dell'autorità giudiziaria.</li>
          </ul>
          <p>
            I dati non vengono venduti né ceduti a terzi per finalità di marketing. Tutti i fornitori sono vincolati da accordi di trattamento dati conformi al GDPR.
          </p>
        </Section>

        <Section title="6. Trasferimento dei dati al di fuori dell'UE">
          <p>
            Alcuni dei nostri fornitori tecnici (es. Stripe, Resend) possono trattare dati al di fuori dell'Unione Europea. In questi casi, il trasferimento avviene nel rispetto delle garanzie previste dal GDPR, in particolare attraverso:
          </p>
          <ul>
            <li>Clausole Contrattuali Standard approvate dalla Commissione Europea;</li>
            <li>Certificazioni di adeguatezza riconosciute (es. EU-US Data Privacy Framework).</li>
          </ul>
        </Section>

        <Section title="7. Cookie e tecnologie di tracciamento">
          <p>TaskDesk utilizza cookie tecnici strettamente necessari al funzionamento del servizio e, solo previo consenso, cookie analitici di Google Analytics:</p>
          <ul>
            <li><strong>Cookie di sessione (<code>session_id</code>):</strong> necessario per mantenere l'utente autenticato durante la navigazione. Non viene utilizzato per profilazione. Scade al termine della sessione o dopo 24 ore.</li>
            <li><strong>Cookie analitici (<code>_ga</code>, <code>_ga_*</code>):</strong> utilizzati da Google Analytics per statistiche aggregate sull'utilizzo del sito e della piattaforma. Vengono installati esclusivamente dopo il consenso e possono durare fino a 2 anni.</li>
          </ul>
          <p>
            I cookie tecnici non richiedono consenso preventivo. I cookie analitici richiedono invece il consenso, che può essere rifiutato o revocato in qualsiasi momento tramite le preferenze cookie.
          </p>
        </Section>

        <Section title="8. Diritti dell'interessato">
          <p>
            Ai sensi degli artt. 15-22 del GDPR, hai il diritto di:
          </p>
          <ul>
            <li><strong>Accesso (art. 15):</strong> ottenere conferma che sia in corso un trattamento di dati che ti riguardano e riceverne copia.</li>
            <li><strong>Rettifica (art. 16):</strong> richiedere la correzione di dati inesatti o incompleti.</li>
            <li><strong>Cancellazione ("diritto all'oblio", art. 17):</strong> richiedere la cancellazione dei tuoi dati personali, nei limiti previsti dalla legge.</li>
            <li><strong>Limitazione del trattamento (art. 18):</strong> richiedere la sospensione del trattamento in determinate circostanze.</li>
            <li><strong>Portabilità (art. 20):</strong> ricevere i tuoi dati in formato strutturato, leggibile da dispositivo automatico.</li>
            <li><strong>Opposizione (art. 21):</strong> opporti al trattamento basato su legittimo interesse.</li>
            <li><strong>Revoca del consenso:</strong> qualora il trattamento si basi sul consenso, revocarlo in qualsiasi momento senza pregiudicare la liceità del trattamento precedente.</li>
          </ul>
          <p>
            Per esercitare i tuoi diritti, invia una richiesta scritta a <strong>privacy@taskdesk.it</strong>. Risponderemo entro 30 giorni dalla ricezione. Hai inoltre il diritto di proporre reclamo al <strong>Garante per la protezione dei dati personali</strong> (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>www.garanteprivacy.it</a>).
          </p>
        </Section>

        <Section title="9. Sicurezza dei dati">
          <p>
            Adottiamo misure tecniche e organizzative adeguate a proteggere i dati personali da accessi non autorizzati, perdita, distruzione o divulgazione, tra cui:
          </p>
          <ul>
            <li>Cifratura delle password con algoritmo hash non reversibile;</li>
            <li>Trasmissione dati cifrata via TLS/HTTPS;</li>
            <li>Isolamento dei dati per organizzazione (multi-tenancy): ogni azienda accede esclusivamente ai propri dati;</li>
            <li>Accesso ai sistemi di produzione ristretto al solo personale autorizzato;</li>
            <li>Backup regolari dei database con cifratura at-rest.</li>
          </ul>
          <p>
            In caso di violazione dei dati (data breach) che possa comportare un rischio per i diritti e le libertà degli interessati, provvederemo a notificare l'evento all'Autorità Garante entro 72 ore e agli interessati senza ingiustificato ritardo.
          </p>
        </Section>

        <Section title="10. Modifiche alla presente Privacy Policy">
          <p>
            La presente Privacy Policy può essere aggiornata periodicamente per riflettere modifiche normative, tecniche o operative. In caso di modifiche sostanziali, gli utenti registrati saranno informati tramite email o avviso sulla piattaforma. La data in cima al documento indica l'ultima versione in vigore. Ti invitiamo a consultare periodicamente questa pagina.
          </p>
        </Section>

        <Section title="11. Contatti">
          <p>
            Per qualsiasi domanda relativa al trattamento dei tuoi dati personali o per esercitare i tuoi diritti, contattaci a:
          </p>
          <ul>
            <li><strong>Email:</strong> privacy@taskdesk.it</li>
            <li><strong>Sito web:</strong> <a href="https://www.taskdesk.it" style={{ color: "#2563eb" }}>www.taskdesk.it</a></li>
          </ul>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
          <Link href="/">
            <span style={{ color: "#2563eb", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>
              ← Torna alla home
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 12, paddingBottom: 8, borderBottom: "2px solid #e5e7eb" }}>
        {title}
      </h2>
      <div style={{ color: "#374151", fontSize: 15, lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontWeight: 600,
  color: "#374151",
  fontSize: 13,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#374151",
  fontSize: 13,
  verticalAlign: "top",
};
