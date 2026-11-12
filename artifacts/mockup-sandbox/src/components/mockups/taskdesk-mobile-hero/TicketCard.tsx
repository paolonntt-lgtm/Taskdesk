import "./_group.css";
import { CalendarDays, Check, Clock3, MapPin } from "lucide-react";

export function TicketCard() {
  return (
    <main className="td-mobile-hero-preview refined" style={{ minHeight: 270, padding: 18, background: "#eef4fb" }}>
      <style>{`
        .td-ticket-art {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }
        .td-ticket-back {
          position: absolute;
          width: 56px;
          height: 72px;
          border-radius: 9px;
          transform: translate(5px, 4px) rotate(8deg);
          background: rgba(7, 43, 105, .28);
          border: 1px solid rgba(255,255,255,.2);
        }
        .td-ticket-slip {
          position: relative;
          width: 59px;
          height: 77px;
          padding: 9px 8px 8px;
          color: #174578;
          border-radius: 8px;
          transform: rotate(-6deg);
          background: linear-gradient(145deg, #fff 0%, #e8f7f6 100%);
          border: 1px solid rgba(255,255,255,.88);
          box-shadow: 0 9px 20px rgba(2, 35, 91, .3), inset 0 1px 0 #fff;
        }
        .td-ticket-slip:before,
        .td-ticket-slip:after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          border-top: 1px dashed rgba(31, 99, 145, .24);
        }
        .td-ticket-slip:before { top: 23px; }
        .td-ticket-slip:after { bottom: 17px; }
        .td-ticket-kicker {
          font: 800 6px/1 "Inter", sans-serif;
          letter-spacing: .12em;
          color: #239a9a;
        }
        .td-ticket-number {
          margin-top: 5px;
          font: 700 8px/1 "Inter", sans-serif;
          letter-spacing: .01em;
        }
        .td-ticket-lines {
          display: grid;
          gap: 4px;
          margin-top: 11px;
        }
        .td-ticket-lines i {
          display: block;
          height: 3px;
          border-radius: 4px;
          background: rgba(35, 103, 153, .22);
        }
        .td-ticket-lines i:first-child { width: 37px; }
        .td-ticket-lines i:last-child { width: 27px; }
        .td-ticket-status {
          position: absolute;
          right: -11px;
          bottom: 7px;
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          color: #075b73;
          border: 2px solid rgba(255,255,255,.95);
          border-radius: 50%;
          background: #8ee4d4;
          box-shadow: 0 4px 10px rgba(1, 41, 83, .25);
        }
      `}</style>
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
          <div className="td-ticket-art" aria-hidden="true">
            <div className="td-ticket-back" />
            <div className="td-ticket-slip">
              <div className="td-ticket-kicker">TASKDESK</div>
              <div className="td-ticket-number">#2481</div>
              <div className="td-ticket-lines"><i /><i /></div>
              <div className="td-ticket-status"><Check size={12} strokeWidth={3} /></div>
            </div>
          </div>
          <div className="td-hero-spark td-hero-spark-one" />
          <div className="td-hero-spark td-hero-spark-two" />
        </div>
      </section>
    </main>
  );
}
