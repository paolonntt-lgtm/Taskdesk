
const client = {
  name: "Acme Solutions S.r.l.",
  alias: "Acme",
  vatNumber: "IT12345678901",
  taxCode: "12345678901",
  address: "Via Roma 42, 20121 Milano (MI)",
  pec: "acme@pec.it",
  contactPerson: "Marco Rossi",
  email: "info@acme-solutions.it",
  phone: "+39 02 1234567",
  notes: "Cliente strategico — contratto annuale rinnovato. Preferisce comunicazioni via PEC per questioni amministrative. Referente tecnico: Luca Ferrari (luca@acme-solutions.it).",
};

const ACCENT = "#7c3aed";
const ACCENT_DARK = "#4c1d95";
const ACCENT_LIGHT = "#ddd6fe";

const kpis = [
  { label: "Ticket aperti", value: "2", sub: "1 urgente", color: ACCENT_LIGHT, bg: "rgba(255,255,255,0.18)" },
  { label: "Ticket risolti", value: "12", sub: "ultimi 90 giorni", color: "#fff", bg: "rgba(255,255,255,0.12)" },
  { label: "Ultima attività", value: "21 lug", sub: "2 giorni fa", color: "#fff", bg: "rgba(255,255,255,0.12)" },
  { label: "SLA rispettato", value: "94%", sub: "sopra la media", color: "#c8f7c5", bg: "rgba(255,255,255,0.12)" },
];

const tickets = [
  { id: 128, title: "Accesso VPN non funziona dopo aggiornamento", status: "Aperto", priority: "Alta", assignee: "Laura B.", date: "21 lug 2026" },
  { id: 119, title: "Configurazione stampante reparto acquisti", status: "Risolto", priority: "Media", assignee: "Mario R.", date: "15 lug 2026" },
  { id: 107, title: "Backup server non completato — errore disco", status: "In attesa", priority: "Urgente", assignee: "Laura B.", date: "10 lug 2026" },
  { id: 94,  title: "Aggiornamento licenze Microsoft 365", status: "Chiuso", priority: "Bassa", assignee: "Admin", date: "02 lug 2026" },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Aperto":    { bg: "#ede9fe", fg: ACCENT },
  "In attesa": { bg: "#fff3e0", fg: "#e65100" },
  "Risolto":   { bg: "#e8f5e9", fg: "#1b5e20" },
  "Chiuso":    { bg: "#f5f5f5", fg: "#757575" },
};

const PRIORITY_COLOR: Record<string, string> = {
  "Urgente": "#d32f2f", "Alta": "#e65100", "Media": ACCENT, "Bassa": "#9e9e9e",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function Badge({ label }: { label: string }) {
  const s = STATUS_STYLE[label] ?? { bg: "#f5f5f5", fg: "#424242" };
  return <span style={{ background: s.bg, color: s.fg, fontWeight: 700, fontSize: 11, padding: "2px 9px", borderRadius: 20 }}>{label}</span>;
}

function PriDot({ label }: { label: string }) {
  const c = PRIORITY_COLOR[label] ?? "#9e9e9e";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: c, fontWeight: 600, fontSize: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />{label}
    </span>
  );
}

function InfoBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 16, padding: "12px 0", borderBottom: "1px solid #f0f0f0", alignItems: "flex-start" }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.07em", paddingTop: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

export default function HeroKPI_Violet() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#faf5ff", minHeight: "100vh", fontSize: 14 }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT_DARK} 0%, ${ACCENT} 55%, #9333ea 100%)`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 30, right: 100, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ padding: "12px 32px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>← Clienti</span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>›</span>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{client.name}</span>
          <div style={{ marginLeft: "auto" }}>
            <button style={{ padding: "5px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)", fontSize: 12, cursor: "pointer", color: "#fff" }}>Modifica</button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "24px 32px 28px" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "3px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {initials(client.name)}
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{client.name}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>✉ {client.email}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>📞 {client.phone}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          {kpis.map((kpi, i) => (
            <div key={i} style={{ flex: 1, padding: "16px 24px", borderRight: i < kpis.length - 1 ? "1px solid rgba(255,255,255,0.12)" : "none", background: kpi.bg }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 28px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Informazioni Aziendali</div>
          <InfoBlock label="Partita IVA" value={client.vatNumber} />
          <InfoBlock label="Codice Fiscale" value={client.taxCode} />
          <InfoBlock label="Indirizzo" value={client.address} />
          <InfoBlock label="PEC" value={client.pec} />
          <InfoBlock label="Referente" value={client.contactPerson} />
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 28px", marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Note Cliente</div>
          <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.75 }}>{client.notes}</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ padding: "16px 28px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ticket Collegati</div>
            <span style={{ background: ACCENT, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 12, padding: "1px 9px" }}>{tickets.length}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                {["#", "Titolo", "Stato", "Priorità", "Assegnato", "Data"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr key={t.id} style={{ borderTop: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fbf8ff" }}>
                  <td style={{ padding: "12px 20px", color: ACCENT, fontWeight: 700, fontSize: 13 }}>#{t.id}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#212121" }}>{t.title}</td>
                  <td style={{ padding: "12px 20px" }}><Badge label={t.status} /></td>
                  <td style={{ padding: "12px 20px" }}><PriDot label={t.priority} /></td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: "#616161" }}>{t.assignee}</td>
                  <td style={{ padding: "12px 20px", fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
