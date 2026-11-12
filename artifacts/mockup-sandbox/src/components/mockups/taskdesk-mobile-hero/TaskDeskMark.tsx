import "./_group.css";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

export function TaskDeskMark() {
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
            aria-hidden="true"
            style={{
              width: 78,
              height: 78,
              display: "grid",
              placeItems: "center",
              borderRadius: 25,
              background: "linear-gradient(145deg, rgba(255,255,255,.23), rgba(255,255,255,.07))",
              border: "1px solid rgba(255,255,255,.34)",
              boxShadow: "0 12px 26px rgba(1,30,77,.22), inset 0 1px 0 rgba(255,255,255,.3)",
              backdropFilter: "blur(5px)",
              transform: "rotate(-8deg)",
            }}
          >
            <svg width="58" height="58" viewBox="0 0 58 58" fill="none">
              <path
                d="M12 16.2C12 12.8 14.8 10 18.2 10H34.8C38.2 10 41 12.8 41 16.2V20.5H25.4C22.2 20.5 19.6 23.1 19.6 26.3V42H18.2C14.8 42 12 39.2 12 35.8V16.2Z"
                fill="url(#mark-blue)"
              />
              <path
                d="M46 41.8C46 45.2 43.2 48 39.8 48H23.2C19.8 48 17 45.2 17 41.8V37.5H32.6C35.8 37.5 38.4 34.9 38.4 31.7V16H39.8C43.2 16 46 18.8 46 22.2V41.8Z"
                fill="url(#mark-teal)"
              />
              <path
                d="M22 28.8C22 25.6 24.6 23 27.8 23H35.8V30.2C35.8 33.4 33.2 36 30 36H22V28.8Z"
                fill="rgba(224,255,251,.93)"
              />
              <path
                d="M12.8 14.2C14.1 11.7 16 10.5 18.7 10.5H34.8C38 10.5 40.5 13 40.5 16.2"
                stroke="rgba(255,255,255,.72)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="mark-blue" x1="12" y1="10" x2="39" y2="43" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#C8F2FF" />
                  <stop offset="1" stopColor="#4DAEFF" />
                </linearGradient>
                <linearGradient id="mark-teal" x1="46" y1="48" x2="18" y2="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38D5C0" />
                  <stop offset="1" stopColor="#91F1DE" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="td-hero-spark td-hero-spark-one" />
          <div className="td-hero-spark td-hero-spark-two" />
        </div>
      </section>
    </main>
  );
}
