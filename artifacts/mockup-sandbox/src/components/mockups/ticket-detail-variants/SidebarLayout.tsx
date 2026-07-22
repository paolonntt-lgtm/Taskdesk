
const ticket = {
  number: 42,
  title: "Stampante non stampa in ufficio contabilità",
  status: "Aperto",
  priority: "Urgente",
  assignee: "Laura B.",
  category: "Hardware",
  location: "Sede Milano",
  created: "22 lug 2026, 09:14",
  dueAt: "23 lug 2026",
  description:
    "La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC della rete. Problema iniziato stamane alle 9:00. Tutti i PC mostrano la stampante come offline.\n\nTentato riavvio coda di stampa senza risultati. Richiesto intervento urgente.",
};

const comments = [
  {
    author: "Mario R.",
    initials: "MR",
    time: "09:32",
    text: "Ho verificato: la stampante è accesa ma non risponde al ping. Probabilmente problema di rete o IP cambiato.",
    color: "#1565c0",
  },
  {
    author: "Laura B.",
    initials: "LB",
    time: "10:05",
    text: "Controllato switch: la porta risulta attiva. Il problema potrebbe essere il driver o la coda bloccata.",
    color: "#2e7d32",
    isSolution: true,
  },
];

const activity = [
  { text: "Laura B. ha preso in carico il ticket", time: "09:20" },
  { text: "Priorità cambiata a Urgente da Mario R.", time: "09:18" },
  { text: "Ticket creato da Admin", time: "09:14" },
];

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size < 28 ? 10 : 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    Aperto: { bg: "#e3f0fd", fg: "#1565c0" },
    "In corso": { bg: "#fff3e0", fg: "#e65100" },
    Risolto: { bg: "#e8f5e9", fg: "#1b5e20" },
  };
  const s = map[label] || { bg: "#f5f5f5", fg: "#616161" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontWeight: 600,
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 20,
      }}
    >
      {label}
    </span>
  );
}

function PriorityDot({ label }: { label: string }) {
  const colors: Record<string, string> = {
    Urgente: "#d32f2f",
    Alta: "#e65100",
    Media: "#1976d2",
    Bassa: "#9e9e9e",
  };
  const c = colors[label] || "#9e9e9e";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: c, fontWeight: 600, fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
      {label}
    </span>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ fontSize: 13, color: "#212121" }}>{children}</div>
    </div>
  );
}

export default function SidebarLayout() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#f7f8fa", minHeight: "100vh", padding: 0 }}>
      {/* Top bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "10px 24px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#9e9e9e", fontSize: 13 }}>Ticket</span>
        <span style={{ color: "#ccc" }}>›</span>
        <span style={{ color: "#212121", fontSize: 13, fontWeight: 600 }}>#{ticket.number} — {ticket.title}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e0e0e0", background: "#fff", fontSize: 12, cursor: "pointer", color: "#424242" }}>Modifica</button>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#d32f2f", fontSize: 12, cursor: "pointer", color: "#fff" }}>Elimina</button>
        </div>
      </div>

      {/* Main layout: content + sidebar */}
      <div style={{ display: "flex", gap: 0, maxWidth: 1100, margin: "0 auto", padding: "24px 24px 0" }}>

        {/* LEFT: main content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, paddingRight: 20 }}>

          {/* Title card */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: "#1565c0", fontSize: 14 }}>#{ticket.number}</span>
              <StatusBadge label={ticket.status} />
              <PriorityDot label={ticket.priority} />
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#9e9e9e" }}>Creato il {ticket.created}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{ticket.title}</h1>
          </div>

          {/* Description */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#616161", textTransform: "uppercase", letterSpacing: "0.06em" }}>Descrizione</h3>
            {ticket.description.split("\n\n").map((p, i) => (
              <p key={i} style={{ margin: "0 0 10px", fontSize: 14, color: "#424242", lineHeight: 1.65 }}>{p}</p>
            ))}
          </div>

          {/* Comments */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16, borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
              {["Commenti (2)", "Attività (3)", "Note"].map((tab, i) => (
                <span
                  key={tab}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: i === 0 ? "#1565c0" : "#9e9e9e",
                    paddingBottom: 12,
                    marginBottom: -13,
                    borderBottom: i === 0 ? "2px solid #1565c0" : "none",
                    cursor: "pointer",
                  }}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {comments.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: i < comments.length - 1 ? "1px solid #f5f5f5" : "none", position: "relative" }}>
                  {i < comments.length - 1 && (
                    <div style={{ position: "absolute", left: 15, top: 44, width: 1, bottom: -14, background: "#e8e8e8" }} />
                  )}
                  <Avatar initials={c.initials} color={c.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                      <span style={{ fontSize: 11, color: "#9e9e9e" }}>{c.time}</span>
                      {c.isSolution && (
                        <span style={{ background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20 }}>✓ Soluzione</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#424242", lineHeight: 1.6, background: c.isSolution ? "#f1fbf3" : "#f8f8f8", padding: "10px 14px", borderRadius: 8 }}>
                      {c.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* compose */}
            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Avatar initials="AD" color="#7b1fa2" size={28} />
              <div style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fafafa", padding: "8px 12px", fontSize: 13, color: "#9e9e9e" }}>
                Scrivi un commento…
              </div>
              <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Invia</button>
            </div>
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <MetaRow label="Assegnato a">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar initials="LB" color="#2e7d32" size={24} />
                <span>{ticket.assignee}</span>
              </div>
            </MetaRow>
            <MetaRow label="Categoria">{ticket.category}</MetaRow>
            <MetaRow label="Sede">{ticket.location}</MetaRow>
            <MetaRow label="Scadenza">
              <span style={{ color: "#d32f2f", fontWeight: 600 }}>⚠ {ticket.dueAt}</span>
            </MetaRow>
            <MetaRow label="Creato il">{ticket.created}</MetaRow>
          </div>

          <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#9e9e9e", textTransform: "uppercase", letterSpacing: "0.06em" }}>Azioni rapide</p>
            {["Chiudi ticket", "Assegna a me", "Segna risolto"].map((a) => (
              <button key={a} style={{ display: "block", width: "100%", padding: "8px 12px", marginBottom: 6, borderRadius: 6, border: "1px solid #e0e0e0", background: "#fafafa", fontSize: 12, cursor: "pointer", textAlign: "left", color: "#424242" }}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
