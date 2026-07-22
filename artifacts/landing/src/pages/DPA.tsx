import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";

const META = {
  it: {
    title: "Data Processing Agreement (DPA) — TaskDesk",
    description: "Accordo sul trattamento dei dati (DPA) tra TaskDesk e i clienti ai sensi del GDPR. Consulta o scarica il modello di accordo.",
  },
  en: {
    title: "Data Processing Agreement — TaskDesk",
    description: "Data Processing Agreement (DPA) between TaskDesk and its customers under GDPR.",
  },
};

export default function DPA() {
  const { lang } = useLanguage();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const canonicalUrl = `https://taskdesk.it/${lang}/dpa`;
  const meta = META[lang];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <header style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <img src="/taskdesk-logo.png" alt="TaskDesk" style={{ height: 32, width: "auto", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>/ Accordo sul Trattamento dei Dati</span>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Data Processing Agreement
        </h1>
        <p style={{ fontSize: 20, color: "#6b7280", marginBottom: 8 }}>
          Accordo sul Trattamento dei Dati Personali
        </p>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })} — ai sensi dell'art. 28 del Regolamento (UE) 2016/679 (GDPR)
        </p>

        <InfoBox>
          Il presente Accordo sul Trattamento dei Dati ("DPA") si applica automaticamente a tutti i Clienti che utilizzano la piattaforma TaskDesk e integra i Termini di Servizio. Utilizzando TaskDesk, il Cliente accetta il presente DPA senza necessità di firma separata, salvo diverso accordo scritto.
        </InfoBox>

        <Section title="1. Parti dell'Accordo">
          <p>Il presente DPA è stipulato tra:</p>
          <ul>
            <li>
              <strong>Titolare del trattamento ("Cliente"):</strong> la persona fisica o giuridica che ha sottoscritto i Termini di Servizio di TaskDesk, che determina le finalità e i mezzi del trattamento dei dati personali dei propri dipendenti e utenti.
            </li>
            <li>
              <strong>Responsabile del trattamento ("TaskDesk"):</strong> il fornitore della piattaforma TaskDesk, che tratta i dati personali per conto e su istruzione del Cliente, ai sensi dell'art. 28 GDPR.
            </li>
          </ul>
        </Section>

        <Section title="2. Oggetto e Natura del Trattamento">
          <p>
            TaskDesk, in qualità di Responsabile del trattamento, tratta i dati personali per conto del Cliente al solo scopo di erogare il Servizio descritto nei Termini di Servizio. Il trattamento include:
          </p>
          <ul>
            <li>conservazione, organizzazione e gestione dei dati inseriti dal Cliente e dai suoi Utenti;</li>
            <li>elaborazione dei dati per la funzionalità della piattaforma (ticket, commenti, notifiche, statistiche);</li>
            <li>backup e ripristino dei dati;</li>
            <li>supporto tecnico, nei limiti strettamente necessari.</li>
          </ul>
        </Section>

        <Section title="3. Tipologie di Dati Personali Trattati">
          <p>I dati personali trattati da TaskDesk per conto del Cliente includono:</p>
          <ul>
            <li><strong>Dati identificativi degli Utenti:</strong> nome, indirizzo email, ruolo, foto profilo, numero di telefono.</li>
            <li><strong>Dati di utilizzo:</strong> ticket aperti, commenti, note interne, log di attività, allegati caricati.</li>
            <li><strong>Dati tecnici:</strong> indirizzi IP, cookie di sessione, log di accesso.</li>
          </ul>
          <p>
            Le categorie di interessati sono: dipendenti, collaboratori e consulenti del Cliente che utilizzano la piattaforma.
          </p>
          <p>
            <strong>Dati particolari:</strong> TaskDesk non è progettata per trattare categorie particolari di dati ai sensi dell'art. 9 GDPR. Il Cliente si impegna a non inserire nella piattaforma tali categorie di dati senza preventivo accordo scritto.
          </p>
        </Section>

        <Section title="4. Istruzioni del Titolare">
          <p>
            TaskDesk tratta i dati personali esclusivamente sulla base delle istruzioni documentate del Cliente, che consistono nei presenti Termini di Servizio e DPA, e nelle configurazioni effettuate dal Cliente tramite la piattaforma.
          </p>
          <p>
            Se TaskDesk ritiene che un'istruzione del Cliente violi il GDPR o altra normativa applicabile, ne darà immediata comunicazione al Cliente. TaskDesk non è tenuta a seguire istruzioni che comportino una violazione della normativa vigente.
          </p>
        </Section>

        <Section title="5. Obblighi di TaskDesk in qualità di Responsabile">
          <p>TaskDesk si impegna a:</p>
          <ul>
            <li>trattare i dati personali esclusivamente per le finalità previste dal presente DPA e su istruzione del Cliente;</li>
            <li>garantire che le persone autorizzate al trattamento abbiano assunto obblighi di riservatezza;</li>
            <li>adottare tutte le misure di sicurezza richieste dall'art. 32 GDPR (v. art. 7 del presente DPA);</li>
            <li>rispettare le condizioni per il ricorso a sub-responsabili del trattamento (art. 6);</li>
            <li>assistere il Cliente, nei limiti del possibile e tenuto conto della natura del trattamento, nell'adempimento degli obblighi di risposta alle richieste degli interessati (artt. 15-22 GDPR);</li>
            <li>assistere il Cliente nel garantire il rispetto degli obblighi di sicurezza, notifica delle violazioni e valutazione d'impatto (artt. 32-36 GDPR);</li>
            <li>su scelta del Cliente, cancellare o restituire tutti i dati personali al termine della fornitura del Servizio;</li>
            <li>mettere a disposizione del Cliente tutte le informazioni necessarie per dimostrare il rispetto del presente DPA e consentire audit ragionevoli.</li>
          </ul>
        </Section>

        <Section title="6. Sub-responsabili del Trattamento">
          <p>
            Il Cliente autorizza TaskDesk a ricorrere ai seguenti sub-responsabili del trattamento:
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 8 }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={thStyle}>Sub-responsabile</th>
                <th style={thStyle}>Paese</th>
                <th style={thStyle}>Finalità</th>
                <th style={thStyle}>Garanzie</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Replit Inc.", "USA", "Hosting e infrastruttura applicativa", "EU-US DPF / SCC"],
                ["Neon / PostgreSQL hosting", "UE/USA", "Database PostgreSQL", "SCC / GDPR-compliant"],
                ["Stripe Inc.", "USA", "Pagamenti e fatturazione", "EU-US DPF / SCC"],
                ["Resend Inc.", "USA", "Email transazionali (inviti, notifiche)", "SCC"],
              ].map(([name, country, purpose, guarantee], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={tdStyle}><strong>{name}</strong></td>
                  <td style={tdStyle}>{country}</td>
                  <td style={tdStyle}>{purpose}</td>
                  <td style={tdStyle}>{guarantee}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 16 }}>
            TaskDesk comunicherà al Cliente con almeno <strong>30 giorni di anticipo</strong> qualsiasi modifica prevista ai sub-responsabili, offrendo la possibilità di opporsi. I sub-responsabili sono vincolati da obblighi di protezione dei dati equivalenti a quelli del presente DPA.
          </p>
        </Section>

        <Section title="7. Sicurezza del Trattamento">
          <p>
            TaskDesk adotta misure tecniche e organizzative adeguate per garantire un livello di sicurezza commisurato al rischio (art. 32 GDPR), tra cui:
          </p>
          <ul>
            <li><strong>Cifratura in transito:</strong> tutte le comunicazioni avvengono tramite TLS/HTTPS;</li>
            <li><strong>Cifratura at-rest:</strong> i database sono conservati su storage cifrato;</li>
            <li><strong>Isolamento dei dati:</strong> architettura multi-tenant che garantisce l'isolamento completo tra le organizzazioni dei diversi Clienti;</li>
            <li><strong>Cifratura delle password:</strong> le password degli utenti sono conservate esclusivamente come hash irreversibili (SHA-256 con salt);</li>
            <li><strong>Controllo degli accessi:</strong> accesso ai sistemi di produzione limitato al personale autorizzato, con autenticazione a più fattori;</li>
            <li><strong>Backup:</strong> backup automatici regolari dei dati con possibilità di ripristino;</li>
            <li><strong>Monitoraggio:</strong> log di accesso e attività conservati per finalità di sicurezza e audit.</li>
          </ul>
        </Section>

        <Section title="8. Notifica delle Violazioni dei Dati">
          <p>
            In caso di violazione dei dati personali (data breach) che riguardi dati trattati per conto del Cliente, TaskDesk notificherà il Cliente <strong>senza ingiustificato ritardo e, ove possibile, entro 72 ore</strong> dalla scoperta della violazione.
          </p>
          <p>La notifica conterrà, nei limiti delle informazioni disponibili:</p>
          <ul>
            <li>la natura della violazione;</li>
            <li>le categorie e il numero approssimativo di interessati e di registrazioni coinvolti;</li>
            <li>le probabili conseguenze;</li>
            <li>le misure adottate o proposte per porre rimedio alla violazione.</li>
          </ul>
          <p>
            Il Cliente è responsabile della valutazione della necessità di notifica all'Autorità Garante e agli interessati, ai sensi degli artt. 33-34 GDPR.
          </p>
        </Section>

        <Section title="9. Trasferimenti Internazionali di Dati">
          <p>
            Eventuali trasferimenti di dati personali verso paesi terzi al di fuori dello Spazio Economico Europeo (SEE) avvengono esclusivamente tramite meccanismi di garanzia adeguati previsti dal GDPR (Capo V), in particolare:
          </p>
          <ul>
            <li>Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea;</li>
            <li>EU-US Data Privacy Framework per i trasferitori verso gli Stati Uniti che vi aderiscono.</li>
          </ul>
          <p>
            I sub-responsabili e i meccanismi di garanzia applicabili sono indicati nell'art. 6 del presente DPA.
          </p>
        </Section>

        <Section title="10. Durata e Cancellazione dei Dati">
          <p>
            Il presente DPA ha la stessa durata del contratto di servizio sottostante. Al termine del rapporto contrattuale:
          </p>
          <ul>
            <li>il Cliente avrà <strong>30 giorni</strong> per esportare i propri dati dalla piattaforma;</li>
            <li>trascorso tale termine, TaskDesk procederà alla cancellazione definitiva di tutti i dati del Cliente dai propri sistemi entro 30 giorni;</li>
            <li>TaskDesk fornirà, su richiesta del Cliente, attestazione scritta dell'avvenuta cancellazione.</li>
          </ul>
        </Section>

        <Section title="11. Audit e Verifiche">
          <p>
            Il Cliente ha il diritto di verificare il rispetto del presente DPA. TaskDesk si impegna a:
          </p>
          <ul>
            <li>fornire, su richiesta, tutta la documentazione necessaria a dimostrare la conformità al presente DPA;</li>
            <li>consentire audit da parte del Cliente o di un revisore da questi incaricato, con preavviso di almeno <strong>30 giorni</strong>, nel rispetto degli obblighi di riservatezza e senza pregiudicare la sicurezza dei dati di altri Clienti.</li>
          </ul>
        </Section>

        <Section title="12. Modifiche al DPA">
          <p>
            TaskDesk si riserva il diritto di modificare il presente DPA per adeguarsi a nuovi obblighi normativi o a decisioni delle autorità di controllo. Le modifiche sostanziali saranno comunicate al Cliente con almeno 30 giorni di preavviso. L'utilizzo continuato del Servizio dopo la data di efficacia costituisce accettazione delle modifiche.
          </p>
        </Section>

        <Section title="13. Legge Applicabile">
          <p>
            Il presente DPA è disciplinato dalle stesse leggi e dallo stesso foro competente indicati nei Termini di Servizio.
          </p>
        </Section>

        <Section title="14. Contatti DPO / Privacy">
          <p>
            Per qualsiasi questione relativa al presente DPA o al trattamento dei dati:
          </p>
          <ul>
            <li><strong>Email:</strong> privacy@taskdesk.it</li>
            <li><strong>Sito:</strong> <a href="https://www.taskdesk.it" style={{ color: "#2563eb" }}>www.taskdesk.it</a></li>
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "16px 20px", marginBottom: 32, color: "#1e40af", fontSize: 14, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#374151", fontSize: 13,
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px", color: "#374151", fontSize: 13, verticalAlign: "top",
};
