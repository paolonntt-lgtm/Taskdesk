
const comments = [
  { author: "Mario R.", initials: "MR", color: "#1565c0", time: "09:32", text: "Stampante accesa ma non risponde al ping. Probabile problema di rete." },
  { author: "Laura B.", initials: "LB", color: "#2e7d32", time: "10:05", text: "Switch OK. Potrebbe essere il driver o la coda bloccata.", isSolution: true },
];

function Av({ i, c, size = 30 }: { i: string; c: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 26 ? 9 : 11, fontWeight: 700, flexShrink: 0 }}>
      {i}
    </div>
  );
}

export default function DashboardCard() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f2f5", minHeight: "100vh" }}>

      {/* Urgency banner */}
      <div style={{ background: "linear-gradient(90deg, #b71c1c, #d32f2f)", padding: "10px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 800, fontSize: 11, padding: "2px 10px", borderRadius: 4, letterSpacing: "0.08em" }}>URGENTE</span>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600 }}>⚠ Scade 23 lug — intervento richiesto</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ padding: "4px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, cursor: "pointer" }}>Modifica</button>
          <button style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: "#fff", color: "#b71c1c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Chiudi ticket</button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "8px 24px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#9e9e9e", cursor: "pointer" }}>Ticket</span>
        <span style={{ color: "#ccc" }}>›</span>
        <span style={{ fontSize: 12, color: "#1565c0", fontWeight: 600 }}>#42</span>
        <span style={{ color: "#ccc" }}>›</span>
        <span style={{ fontSize: 12, color: "#424242" }}>Stampante non stampa in ufficio contabilità</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 20px" }}>
        {/* Title card */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 12, border: "1px solid #e8e8e8" }}>
          <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#1a1a1a" }}>
            Stampante non stampa in ufficio contabilità
          </h1>

          {/* Pill row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Aperto", bg: "#e3f0fd", fg: "#1565c0" },
              { label: "🔴 Urgente", bg: "#fde8e8", fg: "#b71c1c" },
              { label: "Hardware", bg: "#f3e5f5", fg: "#6a1b9a" },
              { label: "Sede Milano", bg: "#e8f5e9", fg: "#2e7d32" },
            ].map(p => (
              <span key={p.label} style={{ background: p.bg, color: p.fg, fontWeight: 600, fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>{p.label}</span>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <Av i="LB" c="#2e7d32" size={22} />
              <span style={{ fontSize: 12, color: "#424242", fontWeight: 600 }}>Laura B.</span>
              <span style={{ fontSize: 11, color: "#9e9e9e" }}>· Assegnatario</span>
            </div>
          </div>
        </div>

        {/* Two-column: description + meta */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {/* Description */}
          <div style={{ flex: 2, background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e8e8e8" }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Descrizione</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#424242", lineHeight: 1.65 }}>
              La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete. Problema iniziato alle 9:00.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#424242", lineHeight: 1.65 }}>
              Tentato riavvio coda di stampa senza risultati. Richiesto intervento urgente.
            </p>
          </div>

          {/* Meta grid */}
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e8e8e8" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dettagli</p>
            {[
              { k: "Stato", v: "Aperto" },
              { k: "Priorità", v: "Urgente", red: true },
              { k: "Assegnato a", v: "Laura B." },
              { k: "Categoria", v: "Hardware" },
              { k: "Sede", v: "Sede Milano" },
              { k: "Scadenza", v: "23 lug 2026", red: true },
              { k: "Creato", v: "22 lug 09:14" },
            ].map(({ k, v, red }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
                <span style={{ color: "#9e9e9e" }}>{k}</span>
                <span style={{ color: red ? "#b71c1c" : "#212121", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0" }}>
            {["💬 Commenti (2)", "📋 Attività (3)", "📝 Note"].map((tab, i) => (
              <div key={tab} style={{ padding: "11px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: i === 0 ? "#1565c0" : "#9e9e9e", borderBottom: i === 0 ? "2px solid #1565c0" : "2px solid transparent", marginBottom: -1 }}>
                {tab}
              </div>
            ))}
          </div>

          <div style={{ padding: "0 20px" }}>
            {comments.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "14px 0", borderBottom: i < comments.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <Av i={c.initials} c={c.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                    <span style={{ fontSize: 11, color: "#9e9e9e" }}>{c.time}</span>
                    {c.isSolution && <span style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20 }}>✓ Soluzione</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.6, background: c.isSolution ? "#f1fbf3" : "#f8f9fa", padding: "9px 12px", borderRadius: 7, border: c.isSolution ? "1px solid #c8e6c9" : "1px solid #f0f0f0" }}>
                    {c.text}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: "12px 0 16px", display: "flex", gap: 10 }}>
              <Av i="AD" c="#7b1fa2" size={28} />
              <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 8, padding: "9px 12px", background: "#fafafa", fontSize: 13, color: "#9e9e9e" }}>Scrivi un commento…</div>
              <button style={{ padding: "0 18px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Invia</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
