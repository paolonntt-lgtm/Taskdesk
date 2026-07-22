
const PRIORITY_BAR: Record<string, string> = {
  Urgente: "#d32f2f",
  Alta: "#e65100",
  Media: "#1976d2",
  Bassa: "#9e9e9e",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Aperto: { bg: "#e3f0fd", fg: "#1565c0" },
  "In corso": { bg: "#fff3e0", fg: "#e65100" },
  Risolto: { bg: "#e8f5e9", fg: "#1b5e20" },
};

const comments = [
  {
    author: "Mario R.",
    initials: "MR",
    time: "22 lug · 09:32",
    text: "Ho verificato: la stampante è accesa ma non risponde al ping. Probabilmente problema di rete o IP cambiato.",
    color: "#1565c0",
  },
  {
    author: "Laura B.",
    initials: "LB",
    time: "22 lug · 10:05",
    text: "Controllato switch: la porta risulta attiva. Il problema potrebbe essere il driver o la coda bloccata.",
    color: "#2e7d32",
    isSolution: true,
  },
];

function Av({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 28 ? 10 : 12, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function CompactHeader() {
  const priority = "Urgente";
  const status = "Aperto";
  const barColor = PRIORITY_BAR[priority];
  const statusStyle = STATUS_STYLE[status];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f7f8fa", minHeight: "100vh" }}>
      {/* Header card with colored left bar */}
      <div style={{ background: "#fff", borderLeft: `5px solid ${barColor}`, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        {/* Breadcrumb */}
        <div style={{ padding: "10px 28px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#9e9e9e" }}>← Ticket</span>
          <span style={{ fontSize: 12, color: "#ccc" }}>›</span>
          <span style={{ fontSize: 12, color: "#616161" }}>#42</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fafafa", fontSize: 11, cursor: "pointer" }}>Modifica</button>
          </div>
        </div>

        {/* Title row */}
        <div style={{ padding: "12px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>#{42} Urgente</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>
                Stampante non stampa in ufficio contabilità
              </h1>
            </div>
            <span style={{ background: statusStyle.bg, color: statusStyle.fg, fontWeight: 700, fontSize: 12, padding: "4px 12px", borderRadius: 20, whiteSpace: "nowrap", marginTop: 4 }}>
              {status}
            </span>
          </div>
        </div>

        {/* Metadata grid — horizontal */}
        <div style={{ display: "flex", gap: 0, padding: "16px 28px 0", borderTop: "none" }}>
          {[
            { label: "Assegnato", value: "Laura B.", color: "#2e7d32" },
            { label: "Categoria", value: "Hardware" },
            { label: "Sede", value: "Sede Milano" },
            { label: "Scadenza", value: "⚠ 23 lug", urgent: true },
            { label: "Creato", value: "22 lug 09:14" },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "0 16px 16px 0",
                borderRight: i < 4 ? "1px solid #f0f0f0" : "none",
                paddingRight: 16,
                marginRight: 16,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: item.urgent ? "#d32f2f" : item.color || "#212121", display: "flex", alignItems: "center", gap: 6 }}>
                {i === 0 && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2e7d32", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>LB</div>
                )}
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>

        {/* Description */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Descrizione</h3>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "#424242", lineHeight: 1.65 }}>
            La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete. Problema iniziato stamane alle 9:00. Tutti i PC mostrano la stampante come offline.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#424242", lineHeight: 1.65 }}>
            Tentato riavvio coda di stampa senza risultati. Richiesto intervento urgente.
          </p>
        </div>

        {/* Tabs + comments */}
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #f0f0f0" }}>
            {["Commenti (2)", "Attività (3)", "Note"].map((tab, i) => (
              <div key={tab} style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: i === 0 ? "#1565c0" : "#9e9e9e", borderBottom: i === 0 ? "2px solid #1565c0" : "2px solid transparent", marginBottom: -1 }}>
                {tab}
              </div>
            ))}
          </div>

          <div style={{ padding: "0 24px" }}>
            {comments.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: i < comments.length - 1 ? "1px solid #f5f5f5" : "none", position: "relative" }}>
                {i < comments.length - 1 && (
                  <div style={{ position: "absolute", left: 15, top: 48, width: 1, bottom: -16, background: "#e8e8e8" }} />
                )}
                <Av initials={c.initials} color={c.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                    <span style={{ fontSize: 11, color: "#9e9e9e" }}>{c.time}</span>
                    {c.isSolution && (
                      <span style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>✓ Soluzione</span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9e9e9e", cursor: "pointer" }}>Rispondi</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.6, background: c.isSolution ? "#f1fbf3" : "#f8f9fa", padding: "10px 14px", borderRadius: 8, border: c.isSolution ? "1px solid #c8e6c9" : "1px solid #f0f0f0" }}>
                    {c.text}
                  </div>
                </div>
              </div>
            ))}

            {/* Compose */}
            <div style={{ padding: "14px 0 18px", display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Av initials="AD" color="#7b1fa2" size={28} />
              <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 14px", background: "#fafafa", fontSize: 13, color: "#9e9e9e" }}>
                Scrivi un commento…
              </div>
              <button style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
