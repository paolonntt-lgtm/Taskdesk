
const comments = [
  { author: "Mario R.", initials: "MR", color: "#1565c0", time: "22 lug · 09:32", text: "Stampante accesa ma non risponde al ping. Probabile problema di rete o IP cambiato." },
  { author: "Laura B.", initials: "LB", color: "#2e7d32", time: "22 lug · 10:05", text: "Switch OK. Potrebbe essere il driver o la coda bloccata.", isSolution: true },
];

const activity = [
  { text: "Laura B. ha preso in carico il ticket", time: "09:20" },
  { text: "Priorità cambiata a Urgente", time: "09:18", highlight: true },
  { text: "Ticket creato da Admin", time: "09:14" },
];

function Av({ i, c, size = 32 }: { i: string; c: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 26 ? 9 : 12, fontWeight: 700, flexShrink: 0 }}>
      {i}
    </div>
  );
}

function Meta({ icon, label, value, urgent }: { icon: string; label: string; value: string; urgent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, color: "#9e9e9e" }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: urgent ? "#d32f2f" : "#212121" }}>{value}</span>
    </div>
  );
}

export default function MinimalClean() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#fff", minHeight: "100vh" }}>

      {/* Minimal top nav */}
      <div style={{ padding: "14px 40px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0" }}>
        <span style={{ fontSize: 13, color: "#9e9e9e", cursor: "pointer" }}>← Ticket</span>
        <span style={{ color: "#e0e0e0" }}>/</span>
        <span style={{ fontSize: 13, color: "#1565c0", fontWeight: 600 }}>#42</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e8e8e8", background: "none", fontSize: 12, color: "#616161", cursor: "pointer" }}>Modifica</button>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#f5f5f5", fontSize: 12, color: "#212121", cursor: "pointer" }}>···</button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 40px" }}>

        {/* Status + priority inline */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ background: "#e3f0fd", color: "#1565c0", fontWeight: 700, fontSize: 12, padding: "3px 12px", borderRadius: 20 }}>Aperto</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#d32f2f", fontWeight: 600, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d32f2f", display: "inline-block" }} />
            Urgente
          </span>
          <span style={{ color: "#e0e0e0" }}>·</span>
          <span style={{ fontSize: 12, color: "#9e9e9e" }}>Hardware</span>
          <span style={{ color: "#e0e0e0" }}>·</span>
          <span style={{ fontSize: 12, color: "#d32f2f", fontWeight: 600 }}>⚠ Scade 23 lug</span>
        </div>

        {/* Big title */}
        <h1 style={{ margin: "0 0 20px", fontSize: 26, fontWeight: 800, color: "#111", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
          Stampante non stampa in ufficio contabilità
        </h1>

        {/* Meta row */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #f0f0f0" }}>
          <Meta icon="👤" label="Assegnato a" value="Laura B." />
          <Meta icon="📍" label="Sede" value="Sede Milano" />
          <Meta icon="📅" label="Creato" value="22 lug 2026" />
          <Meta icon="⚠" label="Scadenza" value="23 lug 2026" urgent />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 32, paddingBottom: 28, borderBottom: "1px solid #f0f0f0" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#424242", lineHeight: 1.7 }}>
            La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete. Problema iniziato stamane alle 9:00. Tutti i PC mostrano la stampante come offline.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#424242", lineHeight: 1.7 }}>
            Tentato riavvio coda di stampa senza risultati. Richiesto intervento urgente.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 24, marginBottom: 24, borderBottom: "1px solid #f0f0f0", paddingBottom: 0 }}>
          {["Commenti (2)", "Attività (3)", "Note"].map((tab, i) => (
            <span key={tab} style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#111" : "#9e9e9e", paddingBottom: 12, borderBottom: i === 0 ? "2px solid #111" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
              {tab}
            </span>
          ))}
        </div>

        {/* Comments — very minimal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "18px 0", borderBottom: "1px solid #f8f8f8" }}>
              <Av i={c.initials} c={c.color} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{c.author}</span>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{c.time}</span>
                  {c.isSolution && (
                    <span style={{ fontSize: 11, color: "#2e7d32", fontWeight: 700 }}>✓ Soluzione</span>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#424242",
                  lineHeight: 1.65,
                  ...(c.isSolution ? { borderLeft: "3px solid #4caf50", paddingLeft: 14, color: "#1b5e20" } : {}),
                }}>
                  {c.text}
                </p>
              </div>
            </div>
          ))}

          {/* Activity inline */}
          <div style={{ padding: "16px 0" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.highlight ? "#e65100" : "#ddd", flexShrink: 0, marginLeft: 15 }} />
                <span style={{ fontSize: 12, color: a.highlight ? "#e65100" : "#9e9e9e" }}>{a.text}</span>
                <span style={{ fontSize: 11, color: "#ccc", marginLeft: "auto" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compose */}
        <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
          <Av i="AD" c="#7b1fa2" size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ border: "1px solid #e8e8e8", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#9e9e9e", background: "#fafafa", marginBottom: 8 }}>
              Aggiungi un commento…
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Invia commento
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
