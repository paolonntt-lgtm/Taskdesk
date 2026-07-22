import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
export default function TermsOfService() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const canonicalUrl = `https://taskdesk.it/it/terms`;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Helmet>
        <title>Termini di Servizio — TaskDesk</title>
        <meta name="description" content="Termini e condizioni di utilizzo del software di ticketing TaskDesk. Leggili prima di iniziare la prova gratuita di 7 giorni." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>
      <header style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <img src="/taskdesk-logo.png" alt="TaskDesk" style={{ height: 32, width: "auto", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>/ Termini di Servizio</span>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Termini di Servizio
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <InfoBox>
          I presenti Termini di Servizio ("Termini") disciplinano l'accesso e l'utilizzo della piattaforma TaskDesk. Leggili attentamente prima di utilizzare il servizio. Utilizzando TaskDesk, accetti integralmente i presenti Termini.
        </InfoBox>

        <Section title="1. Definizioni">
          <p>Ai fini dei presenti Termini si intende per:</p>
          <ul>
            <li><strong>"TaskDesk" / "Fornitore":</strong> il servizio software di gestione ticket erogato tramite la piattaforma web e mobile accessibile su www.taskdesk.it.</li>
            <li><strong>"Cliente":</strong> la persona fisica o giuridica che sottoscrive un piano di abbonamento TaskDesk e utilizza il servizio per la propria organizzazione.</li>
            <li><strong>"Utente":</strong> qualsiasi persona fisica che accede alla piattaforma con le credenziali fornite dal Cliente.</li>
            <li><strong>"Servizio":</strong> la piattaforma SaaS TaskDesk nella sua interezza, inclusi applicazione web, applicazione mobile e API.</li>
            <li><strong>"Dati":</strong> tutti i contenuti, le informazioni e i dati personali inseriti dagli Utenti nella piattaforma.</li>
            <li><strong>"Piano":</strong> il livello di abbonamento scelto dal Cliente (gratuito o a pagamento).</li>
          </ul>
        </Section>

        <Section title="2. Accettazione dei Termini">
          <p>
            L'utilizzo del Servizio è condizionato all'accettazione integrale dei presenti Termini. Registrandosi su TaskDesk o utilizzando il Servizio, il Cliente dichiara:
          </p>
          <ul>
            <li>di aver letto e compreso i presenti Termini e la Privacy Policy;</li>
            <li>di avere il potere di accettare i Termini per conto della propria organizzazione (se persona giuridica);</li>
            <li>di avere almeno 18 anni di età.</li>
          </ul>
          <p>
            Se non accetti i presenti Termini, non puoi utilizzare il Servizio.
          </p>
        </Section>

        <Section title="3. Descrizione del Servizio">
          <p>
            TaskDesk è una piattaforma SaaS (Software as a Service) di gestione ticket e richieste di assistenza interna, accessibile tramite browser web e applicazione mobile. Il Servizio consente alle organizzazioni di:
          </p>
          <ul>
            <li>creare, gestire e tracciare ticket di assistenza tecnica;</li>
            <li>assegnare ticket a tecnici e gruppi di lavoro;</li>
            <li>comunicare tramite commenti e note interne;</li>
            <li>gestire gli utenti della propria organizzazione;</li>
            <li>visualizzare statistiche e report sull'attività.</li>
          </ul>
          <p>
            Il Servizio viene erogato "as is" e "as available". Ci riserviamo il diritto di modificare, aggiornare o interrompere funzionalità del Servizio con ragionevole preavviso.
          </p>
        </Section>

        <Section title="4. Registrazione e Account">
          <p>
            Per utilizzare TaskDesk è necessario creare un account. Il Cliente è responsabile di:
          </p>
          <ul>
            <li>fornire informazioni accurate, complete e aggiornate al momento della registrazione;</li>
            <li>mantenere la riservatezza delle credenziali di accesso;</li>
            <li>tutte le attività svolte tramite il proprio account;</li>
            <li>notificare tempestivamente eventuali accessi non autorizzati all'indirizzo support@taskdesk.it.</li>
          </ul>
          <p>
            Un account può essere condiviso tra più Utenti solo tramite il sistema di invito della piattaforma. È vietata la condivisione di credenziali personali tra più persone. Ciascuna organizzazione ha accesso esclusivamente ai propri Dati (isolamento multi-tenant).
          </p>
        </Section>

        <Section title="5. Piani e Pagamenti">
          <p><strong>Piani gratuiti:</strong> TaskDesk può offrire un piano gratuito con funzionalità e/o limiti di utilizzo definiti sulla pagina dei prezzi. I piani gratuiti possono essere modificati o cessati con 30 giorni di preavviso.</p>
          <p><strong>Piani a pagamento:</strong> I piani a pagamento prevedono:</p>
          <ul>
            <li>addebito ricorrente (mensile o annuale) tramite carta di credito/debito, gestito da Stripe Inc.;</li>
            <li>rinnovo automatico alla scadenza del periodo di abbonamento;</li>
            <li>emissione di fattura elettronica ai sensi della normativa vigente.</li>
          </ul>
          <p><strong>Modifiche di prezzo:</strong> Ci riserviamo il diritto di modificare i prezzi dei piani con un preavviso di almeno 30 giorni via email. Il nuovo prezzo si applicherà dal rinnovo successivo alla comunicazione.</p>
          <p><strong>Rimborsi:</strong> I pagamenti non sono rimborsabili, salvo quanto previsto dalla normativa applicabile o da specifica pattuizione scritta. In caso di addebito errato, contattare support@taskdesk.it entro 30 giorni.</p>
          <p><strong>Sospensione per mancato pagamento:</strong> In caso di mancato pagamento, il Servizio potrà essere sospeso dopo 7 giorni di inadempimento, e terminato dopo 30 giorni, con conservazione dei Dati per ulteriori 30 giorni.</p>
        </Section>

        <Section title="6. Obblighi del Cliente">
          <p>Il Cliente si impegna a:</p>
          <ul>
            <li>utilizzare il Servizio in conformità con i presenti Termini e con la normativa applicabile;</li>
            <li>non utilizzare il Servizio per finalità illegali, fraudolente o lesive di diritti di terzi;</li>
            <li>non tentare di accedere a Dati di altre organizzazioni o a sistemi non autorizzati;</li>
            <li>non caricare sulla piattaforma contenuti che violino diritti di proprietà intellettuale, contengano malware, o che siano illeciti;</li>
            <li>non effettuare reverse engineering, decompilazione o tentativi di estrarre il codice sorgente del Servizio;</li>
            <li>non rivendere o sublicenziare il Servizio a terzi senza autorizzazione scritta;</li>
            <li>rispettare i limiti del proprio Piano (es. numero di utenti).</li>
          </ul>
        </Section>

        <Section title="7. Proprietà Intellettuale">
          <p>
            <strong>Proprietà di TaskDesk:</strong> Il Servizio, incluso il software, il design, i marchi, i loghi e la documentazione, è di proprietà esclusiva di TaskDesk ed è protetto dalle leggi sulla proprietà intellettuale. I presenti Termini non trasferiscono alcun diritto di proprietà intellettuale al Cliente.
          </p>
          <p>
            <strong>Licenza d'uso:</strong> TaskDesk concede al Cliente una licenza limitata, non esclusiva, non trasferibile e revocabile per utilizzare il Servizio nel rispetto dei presenti Termini, per la durata dell'abbonamento attivo.
          </p>
          <p>
            <strong>Dati del Cliente:</strong> Il Cliente mantiene la piena proprietà dei propri Dati. TaskDesk non rivendica alcun diritto di proprietà sui Dati inseriti dal Cliente, e li utilizza esclusivamente per erogare il Servizio.
          </p>
        </Section>

        <Section title="8. Disponibilità del Servizio e SLA">
          <p>
            TaskDesk si impegna a garantire la disponibilità del Servizio al meglio delle proprie possibilità. Non viene garantito un uptime specifico contrattuale per i piani gratuiti.
          </p>
          <p>
            Per i piani a pagamento, ci impegniamo a garantire una disponibilità target del <strong>99,5%</strong> mensile, escluse le manutenzioni programmate (comunicate con almeno 24 ore di anticipo) e le cause di forza maggiore.
          </p>
          <p>
            In caso di interruzioni significative del Servizio non pianificate, ci impegniamo a comunicare lo stato tramite email e/o avviso sulla piattaforma nel più breve tempo possibile.
          </p>
        </Section>

        <Section title="9. Limitazione di Responsabilità">
          <p>
            Nei limiti massimi consentiti dalla legge applicabile:
          </p>
          <ul>
            <li>TaskDesk non sarà responsabile per danni indiretti, incidentali, speciali, punitivi o consequenziali derivanti dall'uso o dall'impossibilità di utilizzare il Servizio;</li>
            <li>la responsabilità totale di TaskDesk verso il Cliente per qualsiasi causa non potrà eccedere l'importo pagato dal Cliente per il Servizio nei 3 mesi precedenti all'evento che ha causato il danno;</li>
            <li>TaskDesk non è responsabile per la perdita di Dati causata da azioni del Cliente o di suoi Utenti, o da eventi al di fuori del ragionevole controllo di TaskDesk.</li>
          </ul>
          <p>
            Nulla di quanto previsto dai presenti Termini limita o esclude la responsabilità di TaskDesk per dolo o colpa grave, lesioni personali, o qualsiasi altra responsabilità che non può essere esclusa per legge.
          </p>
        </Section>

        <Section title="10. Durata e Risoluzione">
          <p>
            <strong>Durata:</strong> I presenti Termini rimangono in vigore per tutta la durata dell'abbonamento attivo.
          </p>
          <p>
            <strong>Recesso del Cliente:</strong> Il Cliente può recedere in qualsiasi momento cancellando il proprio account dalla piattaforma. Il recesso avrà effetto al termine del periodo di fatturazione in corso.
          </p>
          <p>
            <strong>Risoluzione da parte di TaskDesk:</strong> TaskDesk può risolvere il contratto con effetto immediato in caso di violazione grave dei presenti Termini da parte del Cliente, previa notifica via email.
          </p>
          <p>
            <strong>Effetti della risoluzione:</strong> Al termine del rapporto contrattuale, il Cliente avrà 30 giorni per esportare i propri Dati. Trascorso tale termine, i Dati saranno eliminati definitivamente dai server.
          </p>
        </Section>

        <Section title="11. Modifiche ai Termini">
          <p>
            Ci riserviamo il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche sostanziali saranno comunicate via email con almeno <strong>30 giorni di preavviso</strong>. Il proseguimento nell'utilizzo del Servizio dopo la data di efficacia delle modifiche costituisce accettazione dei nuovi Termini.
          </p>
        </Section>

        <Section title="12. Legge Applicabile e Foro Competente">
          <p>
            I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia relativa all'interpretazione, validità o esecuzione dei presenti Termini, le parti concordano di ricorrere in prima istanza a una procedura di mediazione ai sensi del D.Lgs. 28/2010. In caso di mancato accordo in mediazione, sarà competente in via esclusiva il Foro di <strong>Pescara</strong>.
          </p>
        </Section>

        <Section title="13. Disposizioni Generali">
          <ul>
            <li><strong>Intero accordo:</strong> i presenti Termini, unitamente alla Privacy Policy e al DPA, costituiscono l'intero accordo tra le parti in relazione al Servizio.</li>
            <li><strong>Separabilità:</strong> qualora una disposizione dei presenti Termini risulti invalida o inapplicabile, le restanti disposizioni rimarranno pienamente in vigore.</li>
            <li><strong>Rinuncia:</strong> il mancato esercizio di un diritto da parte di TaskDesk non costituisce rinuncia a tale diritto.</li>
            <li><strong>Cessione:</strong> il Cliente non può cedere i propri diritti o obblighi derivanti dai presenti Termini senza il previo consenso scritto di TaskDesk.</li>
          </ul>
        </Section>

        <Section title="14. Contatti">
          <p>Per qualsiasi domanda relativa ai presenti Termini:</p>
          <ul>
            <li><strong>Email:</strong> support@taskdesk.it</li>
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "16px 20px", marginBottom: 32, color: "#1e40af", fontSize: 14, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}
