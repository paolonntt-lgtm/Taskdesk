
const events = [
  {
    type: "comment",
    author: "Mario R.",
    initials: "MR",
    color: "#1565c0",
    time: "09:32",
    date: "22 lug",
    text: "Ho verificato: la stampante è accesa ma non risponde al ping. Probabilmente problema di rete o IP cambiato.",
  },
  {
    type: "activity",
    author: "Sistema",
    initials: "S",
    color: "#9e9e9e",
    time: "09:20",
    date: "22 lug",
    text: "Laura B. ha preso in carico il ticket.",
  },
  {
    type: "activity",
    author: "Sistema",
    initials: "S",
    color: "#9e9e9e",
    time: "09:18",
    date: "22 lug",
    text: "Priorità cambiata a Urgente da Mario R.",
    highlight: true,
  },
  {
    type: "comment",
    author: "Laura B.",
    initials: "LB",
    color: "#2e7d32",
    time: "10:05",
    date: "22 lug",
    text: "Controllato switch: la porta risulta attiva. Il problema potrebbe essere il driver o la coda bloccata.",
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

export default function TimelineView() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f0f2f5", minHeight: "100vh" }}>

      {/* Top header: full-width gradient band */}
      <div style={{ background: "linear-gradient(135deg, #1a237e 0%, #1565c0 100%)", padding: "0 0 0 0", color: "#fff" }}>
        {/* Breadcrumb */}
        <div style={{ padding: "12px 28px 0", display: "flex", alignItems: "center", gap: 6, opacity: 0.8 }}>
          <span style={{ fontSize: 12 }}>← Ticket</span>
          <span>›</span>
          <span style={{ fontSize: 12 }}>#42</span>
        </div>

        <div style={{ padding: "14px 28px 0", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
                🔴 URGENTE
              </span>
              <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                APERTO
              </span>
              <span style={{ marginLeft: "auto", opacity: 0.7, fontSize: 12 }}>⚠ Scade 23 lug</span>
            </div>
            <h1 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
              Stampante non stampa in ufficio contabilità
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, cursor: "pointer" }}>Modifica</button>
          </div>
        </div>

        {/* Meta strip */}
        <div style={{ display: "flex", gap: 0, padding: "0 28px", background: "rgba(0,0,0,0.15)" }}>
          {[
            { label: "Assegnato", value: "Laura B." },
            { label: "Categoria", value: "Hardware" },
            { label: "Sede", value: "Sede Milano" },
            { label: "Creato", value: "22 lug 09:14" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "10px 20px 10px 0", marginRight: 20, borderRight: i < 3 ? "1px solid rgba(255,255,255,0.15)" : "none", paddingRight: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two column body */}
      <div style={{ display: "flex", gap: 16, maxWidth: 960, margin: "0 auto", padding: "20px 20px" }}>

        {/* LEFT: description */}
        <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Descrizione</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#424242", lineHeight: 1.65 }}>
              La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#424242", lineHeight: 1.65 }}>
              Problema iniziato stamane alle 9:00. Tentato riavvio coda di stampa senza risultati.
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Dettagli</h3>
            {[
              { k: "Stato", v: "Aperto", chip: true, bg: "#e3f0fd", fg: "#1565c0" },
              { k: "Priorità", v: "🔴 Urgente", red: true },
              { k: "Assegnato a", v: "Laura B." },
              { k: "Categoria", v: "Hardware" },
              { k: "Scadenza", v: "23 lug 2026", red: true },
            ].map(({ k, v, chip, bg, fg, red }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
                <span style={{ color: "#9e9e9e", fontWeight: 600 }}>{k}</span>
                {chip ? (
                  <span style={{ background: bg, color: fg, fontWeight: 700, fontSize: 11, padding: "1px 8px", borderRadius: 20 }}>{v}</span>
                ) : (
                  <span style={{ color: red ? "#d32f2f" : "#212121", fontWeight: 600 }}>{v}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: unified timeline */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Timeline</span>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {["Tutto", "Commenti", "Attività"].map((f, i) => (
                  <span key={f} style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, background: i === 0 ? "#e3f0fd" : "#f5f5f5", color: i === 0 ? "#1565c0" : "#9e9e9e", cursor: "pointer" }}>{f}</span>
                ))}
              </div>
            </div>

            <div style={{ padding: "0 20px", position: "relative" }}>
              <div style={{ position: "absolute", left: 36, top: 0, bottom: 80, width: 1, background: "#e8e8e8" }} />
              {events.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px 0", position: "relative" }}>
                  <Av initials={ev.initials} color={ev.type === "activity" ? "#e0e0e0" : ev.color} size={ev.type === "activity" ? 24 : 32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ev.type === "comment" ? 6 : 0 }}>
                      {ev.type === "comment" && <span style={{ fontWeight: 700, fontSize: 13 }}>{ev.author}</span>}
                      <span style={{ fontSize: 11, color: "#9e9e9e" }}>{ev.date} · {ev.time}</span>
                      {ev.isSolution && <span style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20 }}>✓ Soluzione</span>}
                    </div>
                    {ev.type === "comment" ? (
                      <div style={{ fontSize: 13, color: "#424242", lineHeight: 1.6, background: ev.isSolution ? "#f1fbf3" : "#f8f9fa", padding: "10px 14px", borderRadius: 8, border: ev.isSolution ? "1px solid #c8e6c9" : "1px solid #f0f0f0" }}>
                        {ev.text}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: ev.highlight ? "#e65100" : "#9e9e9e", fontStyle: "italic" }}>{ev.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Compose */}
            <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Av initials="AD" color="#7b1fa2" size={28} />
              <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 14px", background: "#fafafa", fontSize: 13, color: "#9e9e9e" }}>Scrivi un commento…</div>
              <button style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
