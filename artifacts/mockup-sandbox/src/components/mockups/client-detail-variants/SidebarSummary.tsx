
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

const tickets = [
  { id: 128, title: "Accesso VPN non funziona dopo aggiornamento", status: "Aperto", priority: "Alta", assignee: "Laura B.", date: "21 lug 2026" },
  { id: 119, title: "Configurazione stampante reparto acquisti", status: "Risolto", priority: "Media", assignee: "Mario R.", date: "15 lug 2026" },
  { id: 107, title: "Backup server non completato — errore disco", status: "In attesa", priority: "Urgente", assignee: "Laura B.", date: "10 lug 2026" },
  { id: 94,  title: "Aggiornamento licenze Microsoft 365", status: "Chiuso", priority: "Bassa", assignee: "Admin", date: "02 lug 2026" },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Aperto":     { bg: "#e3f0fd", fg: "#0f62fe" },
  "In attesa":  { bg: "#fff3e0", fg: "#e65100" },
  "Risolto":    { bg: "#e8f5e9", fg: "#1b5e20" },
  "Chiuso":     { bg: "#f5f5f5", fg: "#757575" },
};

const PRIORITY_COLOR: Record<string, string> = {
  "Urgente": "#d32f2f",
  "Alta":    "#e65100",
  "Media":   "#0f62fe",
  "Bassa":   "#9e9e9e",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function Badge({ label }: { label: string }) {
  const s = STATUS_STYLE[label] ?? { bg: "#f5f5f5", fg: "#424242" };
  return (
    <span style={{ background: s.bg, color: s.fg, fontWeight: 700, fontSize: 11, padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function PriDot({ label }: { label: string }) {
  const c = PRIORITY_COLOR[label] ?? "#9e9e9e";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: c, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}

function ContactChip({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0f4ff", color: "#0f62fe", borderRadius: 20, padding: "3px 12px 3px 8px", fontSize: 12, fontWeight: 500 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {text}
    </span>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121", lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

export default function SidebarSummary() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f4f6fb", minHeight: "100vh", fontSize: 14 }}>

      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8eaf0", padding: "10px 24px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#9e9e9e", fontSize: 13, cursor: "pointer" }}>← Clienti</span>
        <span style={{ color: "#ddd" }}>›</span>
        <span style={{ color: "#1a1a1a", fontSize: 13, fontWeight: 600 }}>{client.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, cursor: "pointer", color: "#424242" }}>Modifica</button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 0, height: "calc(100vh - 45px)" }}>

        {/* LEFT SIDEBAR — profile + company info */}
        <div style={{
          width: 280, flexShrink: 0, background: "#fff",
          borderRight: "4px solid #0f62fe",
          boxShadow: "2px 0 12px rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
          padding: "28px 20px",
        }}>

          {/* Avatar + name */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, #0f62fe 0%, #0043ce 100%)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 700, margin: "0 auto 14px",
              boxShadow: "0 4px 16px rgba(15,98,254,0.30)",
            }}>
              {initials(client.name)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1a1a1a", lineHeight: 1.3, marginBottom: 4 }}>
              {client.name}
            </div>
            {client.alias && (
              <div style={{ fontSize: 12, color: "#9e9e9e", fontStyle: "italic" }}>"{client.alias}"</div>
            )}
          </div>

          {/* Contact chips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {client.email && <ContactChip icon="✉" text={client.email} />}
            {client.phone && <ContactChip icon="📞" text={client.phone} />}
            {client.pec && <ContactChip icon="🔒" text={client.pec} />}
          </div>

          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Dati Aziendali</div>
            <InfoField label="Partita IVA" value={client.vatNumber} />
            <InfoField label="Codice Fiscale" value={client.taxCode} />
            <InfoField label="Indirizzo" value={client.address} />
            <InfoField label="Referente" value={client.contactPerson} />
          </div>

          {/* Quick stats */}
          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: "#f0f4ff", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f62fe" }}>4</div>
                <div style={{ fontSize: 10, color: "#9e9e9e", marginTop: 2 }}>Ticket totali</div>
              </div>
              <div style={{ flex: 1, background: "#fff9f0", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#e65100" }}>2</div>
                <div style={{ fontSize: 10, color: "#9e9e9e", marginTop: 2 }}>Aperti</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — scrollable main content */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 28px" }}>

          {/* Note cliente */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Note Cliente</div>
            <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.7 }}>{client.notes}</div>
          </div>

          {/* Note Fisse */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Nota Fissa 1</div>
            <div style={{ fontSize: 13, color: "#757575", lineHeight: 1.7, fontStyle: "italic" }}>Nessuna nota fissa impostata.</div>
          </div>

          {/* Linked tickets table */}
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em" }}>Ticket Collegati</div>
              <span style={{ background: "#0f62fe", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 12, padding: "1px 9px" }}>{tickets.length}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {["#", "Titolo", "Stato", "Priorità", "Assegnato", "Data"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                    <td style={{ padding: "11px 16px", color: "#0f62fe", fontWeight: 700, fontSize: 13 }}>#{t.id}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#212121", maxWidth: 240 }}>{t.title}</td>
                    <td style={{ padding: "11px 16px" }}><Badge label={t.status} /></td>
                    <td style={{ padding: "11px 16px" }}><PriDot label={t.priority} /></td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#616161" }}>{t.assignee}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
