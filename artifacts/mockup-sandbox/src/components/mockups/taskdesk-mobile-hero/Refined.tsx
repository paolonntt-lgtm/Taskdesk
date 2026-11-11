import "./_group.css";
import { CalendarDays, Clock3, MapPin, Sun } from "lucide-react";

export function Refined() {
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
            <span className="td-hero-location"><MapPin size={12} /> Milano</span>
          </div>
        </div>
        <div className="td-hero-art">
          <div className="td-hero-disc"><Sun size={27} strokeWidth={1.8} /></div>
          <div className="td-hero-spark td-hero-spark-one" />
          <div className="td-hero-spark td-hero-spark-two" />
        </div>
      </section>
    </main>
  );
}
