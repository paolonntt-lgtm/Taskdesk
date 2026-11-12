import "./_group.css";
import { CalendarDays, Check, Clock3, MapPin } from "lucide-react";

export function DayPlanner() {
  return (
    <main className="td-mobile-hero-preview refined" style={{ minHeight: 270, padding: 18, background: "#eef4fb" }}>
      <section className="td-hero-card">
        <div className="td-hero-glow" />
        <div className="td-hero-orbit td-hero-orbit-one" />
        <div className="td-hero-orbit td-hero-orbit-two" />
        <div className="td-hero-copy">
          <div className="td-hero-eyebrow"><span className="td-hero-pulse" /> LA TUA GIORNATA</div>
          <div className="td-hero-greeting">Buongiorno,</div>
          <div className="td-hero-name">Giulia</div>
          <div className="td-hero-details">
            <div className="td-hero-date-time">
              <span><CalendarDays size={12} /> Mer 11 nov</span>
              <i />
              <span><Clock3 size={12} /> 10:24</span>
            </div>
            <button className="td-hero-location td-hero-gps" type="button">
              <MapPin size={12} /> Usa posizione GPS
            </button>
          </div>
        </div>
        <div className="td-hero-art">
          <div
            style={{
              width: 88,
              padding: "10px 9px 9px",
              borderRadius: 15,
              color: "#fff",
              background: "linear-gradient(155deg, rgba(255,255,255,.31), rgba(255,255,255,.13))",
              border: "1px solid rgba(255,255,255,.42)",
              boxShadow: "0 10px 24px rgba(1,30,77,.22), inset 0 1px 0 rgba(255,255,255,.34)",
              backdropFilter: "blur(5px)",
              transform: "rotate(3deg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <span style={{ width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 7, background: "rgba(112,228,213,.23)", color: "#9bf3e5" }}>
                <CalendarDays size={12} strokeWidth={2} />
              </span>
              <span style={{ fontSize: 7, lineHeight: 1, fontWeight: 800, letterSpacing: ".11em", color: "rgba(255,255,255,.8)" }}>PROSSIMO</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, lineHeight: 1, fontWeight: 800, letterSpacing: "-.04em" }}>
              <Clock3 size={11} color="#9bf3e5" strokeWidth={2.2} />
              10:45
            </div>
            <div style={{ height: 1, margin: "8px 0 7px", background: "rgba(255,255,255,.23)" }} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
              <span style={{ width: 3, height: 23, flex: "0 0 3px", borderRadius: 4, background: "#72e2d4" }} />
              <div>
                <div style={{ fontSize: 8, lineHeight: 1.2, fontWeight: 700 }}>Brief</div>
                <div style={{ marginTop: 2, fontSize: 7, lineHeight: 1.2, color: "rgba(255,255,255,.72)" }}>progetto</div>
              </div>
              <span style={{ marginLeft: "auto", width: 14, height: 14, display: "grid", placeItems: "center", borderRadius: "50%", background: "rgba(112,228,213,.2)", color: "#9bf3e5" }}>
                <Check size={9} strokeWidth={2.5} />
              </span>
            </div>
          </div>
          <div className="td-hero-spark td-hero-spark-one" />
          <div className="td-hero-spark td-hero-spark-two" />
        </div>
      </section>
    </main>
  );
}
