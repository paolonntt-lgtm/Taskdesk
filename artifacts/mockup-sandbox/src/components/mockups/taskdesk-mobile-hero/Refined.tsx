import "./_group.css";
import { Sun } from "lucide-react";

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
          <div className="td-hero-caption">Tutto quello che conta, in un solo posto.</div>
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
