
import { useState } from "react";

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
  notes: "Cliente strategico — contratto annuale rinnovato. Preferisce comunicazioni via PEC per questioni amministrative.",
};

const tickets = [
  { id: 128, title: "Accesso VPN non funziona dopo aggiornamento", status: "Aperto", priority: "Alta", assignee: "Laura B.", date: "21 lug 2026" },
  { id: 119, title: "Configurazione stampante reparto acquisti", status: "Risolto", priority: "Media", assignee: "Mario R.", date: "15 lug 2026" },
  { id: 107, title: "Backup server non completato — errore disco", status: "In attesa", priority: "Urgente", assignee: "Laura B.", date: "10 lug 2026" },
  { id: 94,  title: "Aggiornamento licenze Microsoft 365", status: "Chiuso", priority: "Bassa", assignee: "Admin", date: "02 lug 2026" },
];

const activity = [
  { text: "Ticket #128 aperto da Admin", time: "21 lug 2026, 09:14", dot: "#0f62fe" },
  { text: "Laura B. ha preso in carico il ticket #107", time: "10 lug 2026, 11:32", dot: "#2e7d32" },
  { text: "Ticket #119 risolto da Mario R.", time: "15 lug 2026, 16:45", dot: "#2e7d32" },
  { text: "Dati cliente aggiornati da Admin", time: "01 lug 2026, 10:00", dot: "#9e9e9e" },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Aperto":    { bg: "#e3f0fd", fg: "#0f62fe" },
  "In attesa": { bg: "#fff3e0", fg: "#e65100" },
  "Risolto":   { bg: "#e8f5e9", fg: "#1b5e20" },
  "Chiuso":    { bg: "#f5f5f5", fg: "#757575" },
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
    <span style={{ background: s.bg, color: s.fg, fontWeight: 700, fontSize: 11, padding: "2px 10px", borderRadius: 20 }}>
      {label}
    </span>
  );
}

function PriDot({ label }: { label: string }) {
  const c = PRIORITY_COLOR[label] ?? "#9e9e9e";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: c, fontWeight: 600, fontSize: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: "20px 22px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#212121", marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid #f5f5f5" }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: "#9e9e9e", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121" }}>{value}</div>
    </div>
  );
}

const TABS = ["Panoramica", "Note", "Ticket", "Cronologia"] as const;
type Tab = typeof TABS[number];

export default function TabNav() {
  const [activeTab, setActiveTab] = useState<Tab>("Panoramica");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f7f8fa", minHeight: "100vh", fontSize: 14 }}>

      {/* Slim header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ padding: "10px 28px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#9e9e9e", fontSize: 13, cursor: "pointer" }}>← Clienti</span>
          <span style={{ color: "#ddd" }}>›</span>

          {/* Small avatar + name inline */}
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#0f62fe",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>
            {initials(client.name)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", lineHeight: 1.2 }}>{client.name}</div>
            {client.alias && <div style={{ fontSize: 11, color: "#9e9e9e" }}>{client.alias}</div>}
          </div>

          {/* Contact chips */}
          <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
            {client.email && (
              <span style={{ background: "#f0f4ff", color: "#0f62fe", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
                ✉ {client.email}
              </span>
            )}
            {client.phone && (
              <span style={{ background: "#f5f5f5", color: "#424242", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
                {client.phone}
              </span>
            )}
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, cursor: "pointer", color: "#424242" }}>Modifica</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, paddingLeft: 28, borderTop: "1px solid #f0f0f0" }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #0f62fe" : "2px solid transparent",
                fontSize: 13,
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? "#0f62fe" : "#757575",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: "28px 28px", maxWidth: 960, margin: "0 auto" }}>

        {activeTab === "Panoramica" && (
          <div>
            {/* KPI 2x2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <KPICard label="Ticket aperti" value="2" sub="1 urgente" accent="#0f62fe" />
              <KPICard label="Ticket risolti" value="12" sub="ultimi 90 giorni" accent="#2e7d32" />
              <KPICard label="Ultima attività" value="21 lug" sub="2 giorni fa" accent="#e65100" />
              <KPICard label="SLA rispettato" value="94%" sub="sopra la media" accent="#7b1fa2" />
            </div>

            {/* Company info card */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Dati Aziendali</div>
              <DataRow label="Partita IVA" value={client.vatNumber} />
              <DataRow label="Codice Fiscale" value={client.taxCode} />
              <DataRow label="Indirizzo" value={client.address} />
              <DataRow label="PEC" value={client.pec} />
              <DataRow label="Referente" value={client.contactPerson} />
            </div>
          </div>
        )}

        {activeTab === "Note" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Note Cliente</div>
              <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.8 }}>{client.notes}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Nota Fissa 1</div>
              <div style={{ fontSize: 13, color: "#9e9e9e", fontStyle: "italic" }}>Nessuna nota fissa impostata.</div>
            </div>
          </div>
        )}

        {activeTab === "Ticket" && (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em" }}>Ticket Collegati</div>
              <span style={{ background: "#0f62fe", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 12, padding: "1px 9px" }}>{tickets.length}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {["#", "Titolo", "Stato", "Priorità", "Assegnato", "Data"].map(h => (
                    <th key={h} style={{ padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                    <td style={{ padding: "11px 18px", color: "#0f62fe", fontWeight: 700, fontSize: 13 }}>#{t.id}</td>
                    <td style={{ padding: "11px 18px", fontSize: 13, color: "#212121" }}>{t.title}</td>
                    <td style={{ padding: "11px 18px" }}><Badge label={t.status} /></td>
                    <td style={{ padding: "11px 18px" }}><PriDot label={t.priority} /></td>
                    <td style={{ padding: "11px 18px", fontSize: 13, color: "#616161" }}>{t.assignee}</td>
                    <td style={{ padding: "11px 18px", fontSize: 12, color: "#9e9e9e", whiteSpace: "nowrap" }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Cronologia" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f62fe", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Cronologia Attività</div>
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 1, background: "#e8e8e8" }} />
              {activity.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 16, marginBottom: 24, position: "relative" }}>
                  <div style={{
                    position: "absolute", left: -24, top: 4,
                    width: 14, height: 14, borderRadius: "50%",
                    background: a.dot, border: "2px solid #fff",
                    boxShadow: "0 0 0 2px " + a.dot + "33",
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#212121", fontWeight: 500 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: "#9e9e9e", marginTop: 3 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
