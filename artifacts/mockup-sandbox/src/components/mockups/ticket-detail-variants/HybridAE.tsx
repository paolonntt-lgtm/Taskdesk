
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

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid #f5f5f5" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121" }}>{children}</div>
    </div>
  );
}

export default function HybridAE() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#fafafa", minHeight: "100vh" }}>

      {/* Minimal nav — E style */}
      <div style={{ padding: "12px 32px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #efefef", background: "#fff" }}>
        <span style={{ fontSize: 13, color: "#9e9e9e", cursor: "pointer" }}>← Ticket</span>
        <span style={{ color: "#ddd" }}>/</span>
        <span style={{ fontSize: 13, color: "#1565c0", fontWeight: 600 }}>#42</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e8e8e8", background: "none", fontSize: 12, color: "#616161", cursor: "pointer" }}>Modifica</button>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#fde8e8", fontSize: 12, color: "#b71c1c", fontWeight: 600, cursor: "pointer" }}>Elimina</button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "flex", maxWidth: 1060, margin: "0 auto", padding: "28px 24px", gap: 28 }}>

        {/* LEFT: main content — E typography */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Status + priority — E style pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ background: "#e3f0fd", color: "#1565c0", fontWeight: 700, fontSize: 12, padding: "3px 11px", borderRadius: 20 }}>Aperto</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#d32f2f", fontWeight: 600, fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#d32f2f", display: "inline-block" }} />
              Urgente
            </span>
            <span style={{ color: "#e0e0e0" }}>·</span>
            <span style={{ fontSize: 12, color: "#9e9e9e" }}>Hardware</span>
            <span style={{ color: "#e0e0e0" }}>·</span>
            <span style={{ fontSize: 12, color: "#d32f2f", fontWeight: 600 }}>⚠ Scade 23 lug</span>
          </div>

          {/* Big title — E style */}
          <h1 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.25, letterSpacing: "-0.01em" }}>
            Stampante non stampa in ufficio contabilità
          </h1>

          {/* Description — flat, no card border */}
          <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #efefef" }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em" }}>Descrizione</p>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#424242", lineHeight: 1.7 }}>
              La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete. Problema iniziato alle 9:00. Tutti i PC mostrano la stampante come offline.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "#424242", lineHeight: 1.7 }}>
              Tentato riavvio coda di stampa senza risultati. Richiesto intervento urgente.
            </p>
          </div>

          {/* Tabs — E style */}
          <div style={{ display: "flex", gap: 24, marginBottom: 20, paddingBottom: 0, borderBottom: "1px solid #efefef" }}>
            {["Commenti (2)", "Attività (3)", "Note"].map((tab, i) => (
              <span key={tab} style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#111" : "#bbb", paddingBottom: 12, borderBottom: i === 0 ? "2px solid #111" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
                {tab}
              </span>
            ))}
          </div>

          {/* Comments — E style */}
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: "1px solid #f5f5f5" }}>
              <Av i={c.initials} c={c.color} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{c.author}</span>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{c.time}</span>
                  {c.isSolution && <span style={{ fontSize: 11, color: "#2e7d32", fontWeight: 700 }}>✓ Soluzione</span>}
                </div>
                <p style={{
                  margin: 0, fontSize: 14, color: "#424242", lineHeight: 1.65,
                  ...(c.isSolution ? { borderLeft: "3px solid #4caf50", paddingLeft: 12, color: "#1b5e20" } : {}),
                }}>
                  {c.text}
                </p>
              </div>
            </div>
          ))}

          {/* Activity — E style inline */}
          <div style={{ padding: "12px 0 4px" }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.highlight ? "#e65100" : "#ddd", flexShrink: 0, marginLeft: 14 }} />
                <span style={{ fontSize: 12, color: a.highlight ? "#e65100" : "#9e9e9e" }}>{a.text}</span>
                <span style={{ fontSize: 11, color: "#ccc", marginLeft: "auto" }}>{a.time}</span>
              </div>
            ))}
          </div>

          {/* Compose */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingTop: 20, marginTop: 8, borderTop: "1px solid #efefef" }}>
            <Av i="AD" c="#7b1fa2" size={32} />
            <div style={{ flex: 1 }}>
              <div style={{ border: "1px solid #e8e8e8", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#bbb", background: "#fff", marginBottom: 8 }}>
                Aggiungi un commento…
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Invia</button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: sidebar — A structure, E aesthetics (no heavy card) */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 24 }}>
            <SideRow label="Assegnato a">
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Av i="LB" c="#2e7d32" size={22} />
                <span style={{ fontWeight: 600 }}>Laura B.</span>
              </div>
            </SideRow>
            <SideRow label="Categoria">Hardware</SideRow>
            <SideRow label="Sede">Sede Milano</SideRow>
            <SideRow label="Scadenza">
              <span style={{ color: "#d32f2f", fontWeight: 600 }}>⚠ 23 lug 2026</span>
            </SideRow>
            <SideRow label="Creato il">
              <span style={{ color: "#616161" }}>22 lug 2026, 09:14</span>
            </SideRow>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em" }}>Azioni</p>
              {["Chiudi ticket", "Assegna a me", "Segna risolto"].map((a) => (
                <button key={a} style={{ display: "block", width: "100%", padding: "7px 10px", marginBottom: 6, borderRadius: 6, border: "1px solid #efefef", background: "#fff", fontSize: 12, cursor: "pointer", textAlign: "left", color: "#424242" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
