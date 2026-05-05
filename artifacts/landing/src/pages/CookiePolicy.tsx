import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

export default function CookiePolicy() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Helmet>
        <title>Cookie Policy — TaskDesk</title>
        <meta name="description" content="Informativa sull'uso dei cookie sul sito taskdesk.it ai sensi del D.Lgs. 196/2003 e della Direttiva ePrivacy." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://taskdesk.it/cookie-policy" />
      </Helmet>
      <header style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/">
            <img src="/taskdesk-logo.png" alt="TaskDesk" style={{ height: 32, width: "auto", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>/ Cookie Policy</span>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
          Cookie Policy
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <InfoBox>
          TaskDesk utilizza esclusivamente cookie tecnici strettamente necessari al funzionamento del servizio. Non utilizziamo cookie di profilazione, pubblicitari o di tracciamento comportamentale. Per questo motivo, <strong>non è richiesto il tuo consenso</strong> ai cookie ai sensi della normativa vigente (art. 122 Codice Privacy, Provvedimento Garante n. 231/2014).
        </InfoBox>

        <Section title="1. Cosa sono i cookie">
          <p>
            I cookie sono piccoli file di testo che i siti web salvano sul dispositivo dell'utente (computer, smartphone, tablet) durante la navigazione. Vengono utilizzati per far funzionare i siti correttamente, ricordare le preferenze degli utenti e raccogliere informazioni su come il sito viene utilizzato.
          </p>
          <p>
            I cookie possono essere classificati in base alla loro durata:
          </p>
          <ul>
            <li><strong>Cookie di sessione:</strong> vengono eliminati automaticamente alla chiusura del browser.</li>
            <li><strong>Cookie persistenti:</strong> rimangono sul dispositivo per un periodo definito o finché non vengono eliminati manualmente.</li>
          </ul>
        </Section>

        <Section title="2. Cookie utilizzati da TaskDesk">
          <p>TaskDesk utilizza un solo cookie, strettamente tecnico e necessario:</p>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Durata</th>
                <th style={thStyle}>Finalità</th>
                <th style={thStyle}>Terze parti</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={tdStyle}><code style={{ backgroundColor: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>session_id</code></td>
                <td style={tdStyle}>Tecnico / Sessione</td>
                <td style={tdStyle}>24 ore</td>
                <td style={tdStyle}>Mantiene l'utente autenticato durante la navigazione. Senza questo cookie non è possibile accedere all'applicazione.</td>
                <td style={tdStyle}>No</td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 16 }}>
            Il cookie <code style={{ backgroundColor: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>session_id</code> è impostato con i flag <strong>HttpOnly</strong> (non accessibile da JavaScript) e <strong>SameSite=Lax</strong> (protezione da attacchi CSRF), e viene trasmesso esclusivamente su connessioni HTTPS sicure.
          </p>
        </Section>

        <Section title="3. Cookie di terze parti">
          <p>
            TaskDesk <strong>non installa cookie di terze parti</strong> sul dispositivo dell'utente. Non utilizziamo:
          </p>
          <ul>
            <li>cookie di Google Analytics o altri strumenti di web analytics;</li>
            <li>cookie di social media (Facebook Pixel, LinkedIn Insight, ecc.);</li>
            <li>cookie pubblicitari o di retargeting;</li>
            <li>cookie di tracciamento comportamentale.</li>
          </ul>
          <p>
            Il fornitore di pagamenti Stripe potrebbe impostare cookie propri durante il processo di checkout, esclusivamente nelle pagine di pagamento. Questi cookie sono soggetti alla <a href="https://stripe.com/it/cookie-settings" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Cookie Policy di Stripe</a>.
          </p>
        </Section>

        <Section title="4. Perché non è richiesto il consenso">
          <p>
            Ai sensi dell'art. 122 del D.Lgs. 196/2003 (Codice Privacy) e del Provvedimento del Garante per la protezione dei dati personali n. 231 del 10 giugno 2021, i cookie tecnici strettamente necessari al funzionamento di un servizio esplicitamente richiesto dall'utente <strong>non richiedono il consenso preventivo</strong>.
          </p>
          <p>
            Il cookie <code style={{ backgroundColor: "#f3f4f6", padding: "2px 4px", borderRadius: 4 }}>session_id</code> rientra in questa categoria, in quanto è indispensabile per permettere l'accesso autenticato alla piattaforma. Non viene utilizzato per alcuna finalità diversa dall'autenticazione.
          </p>
        </Section>

        <Section title="5. Come gestire i cookie">
          <p>
            Sebbene non sia richiesto il consenso per i cookie tecnici, puoi sempre gestire o eliminare i cookie tramite le impostazioni del tuo browser. Tieni presente che la disabilitazione del cookie di sessione di TaskDesk renderà <strong>impossibile accedere</strong> alla piattaforma.
          </p>
          <p>Istruzioni per i principali browser:</p>
          <ul>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Safari (Mac)</a></li>
            <li><a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Microsoft Edge</a></li>
          </ul>
        </Section>

        <Section title="6. Modifiche alla Cookie Policy">
          <p>
            La presente Cookie Policy può essere aggiornata per riflettere modifiche tecniche, normative o operative. Qualsiasi modifica sostanziale sarà comunicata tramite avviso sulla piattaforma o via email. La data in cima al documento indica l'ultima versione in vigore.
          </p>
        </Section>

        <Section title="7. Contatti">
          <p>
            Per qualsiasi domanda relativa all'utilizzo dei cookie da parte di TaskDesk:
          </p>
          <ul>
            <li><strong>Email:</strong> privacy@taskdesk.it</li>
            <li><strong>Privacy Policy:</strong> <a href="/privacy-policy" style={{ color: "#2563eb" }}>www.taskdesk.it/privacy-policy</a></li>
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
    <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "16px 20px", marginBottom: 32, color: "#166534", fontSize: 14, lineHeight: 1.6 }}>
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
