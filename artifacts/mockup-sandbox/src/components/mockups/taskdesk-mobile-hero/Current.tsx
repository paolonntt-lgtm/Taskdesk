import "./_group.css";
import { Activity, Sunrise } from "lucide-react";

export function Current() {
  return (
    <main className="td-mobile-hero-preview" style={{ minHeight: 270, padding: 18, background: "#eef4fb" }}>
      <section style={{
        minHeight: 138, padding: 18, borderRadius: 27, display: "flex",
        alignItems: "center", overflow: "hidden", position: "relative",
        color: "white", background: "linear-gradient(110deg, #0f62fe, #21a6a1)",
      }}>
        <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>Buongiorno</div>
          <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.2 }}>Giulia</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, opacity: .9 }}>
            <Activity size={13} /><span>La tua giornata</span>
          </div>
        </div>
        <div style={{
          width: 64, height: 64, marginLeft: 8, borderRadius: 40,
          display: "grid", placeItems: "center", fontSize: 32, position: "relative",
        }}>
          <div style={{ position: "absolute", width: 124, height: 124, right: -28, top: -30, borderRadius: 70, border: "1px solid rgba(255,255,255,.2)" }} />
          <div style={{ position: "absolute", width: 82, height: 82, right: 2, bottom: -34, borderRadius: 50, background: "rgba(255,255,255,.1)" }} />
          <Sunrise size={32} style={{ position: "relative" }} />
        </div>
      </section>
    </main>
  );
}
