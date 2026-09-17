import { useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import "./_group.css";
import "./current.css";

type Ticket = {
  id: number;
  title: string;
  category: string;
  status: "Aperto" | "In attesa" | "Risolto";
  priority: "Urgente" | "Alta" | "Media";
  due?: string;
};

const tickets: Ticket[] = [
  { id: 42, title: "Stampante non stampa in ufficio contabilità", category: "Hardware", status: "Aperto", priority: "Urgente", due: "Scade oggi" },
  { id: 38, title: "PC banco cassa lento all'avvio", category: "Software", status: "Aperto", priority: "Alta", due: "Domani" },
  { id: 35, title: "Problema connessione VPN da remoto", category: "Rete", status: "In attesa", priority: "Media" },
  { id: 31, title: "Aggiornamento antivirus su postazioni", category: "Sicurezza", status: "Risolto", priority: "Media" },
  { id: 29, title: "Schermo intermittente sala riunioni", category: "Hardware", status: "Aperto", priority: "Media" },
];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Tutti i ticket", icon: ClipboardList },
  { label: "Nuovo ticket", icon: Plus },
  { label: "Report", icon: BarChart3 },
  { label: "Calendario", icon: CalendarDays },
  { label: "Clienti", icon: Users },
];

function StatusPill({ children, kind }: { children: string; kind: "open" | "waiting" | "resolved" | "urgent" | "high" | "medium" }) {
  return <span className={`taskdesk-current__pill taskdesk-current__pill--${kind}`}>{children}</span>;
}

function TicketList({ title, icon, items, due = false }: { title: string; icon: React.ReactNode; items: Ticket[]; due?: boolean }) {
  return (
    <section className="taskdesk-current__card taskdesk-current__feed">
      <div className="taskdesk-current__card-heading">
        <div className="taskdesk-current__heading-title">
          {icon}
          <strong>{title}</strong>
          <span className="taskdesk-current__count">{items.length}</span>
        </div>
        <button className="taskdesk-current__link" type="button">Vedi tutti</button>
      </div>
      <div className="taskdesk-current__divider" />
      {items.map((ticket) => (
        <button className="taskdesk-current__ticket" type="button" key={ticket.id}>
          <span className={`taskdesk-current__number taskdesk-current__number--${ticket.status === "Risolto" ? "resolved" : ticket.status === "In attesa" ? "waiting" : "open"}`}>#{ticket.id}</span>
          <span className="taskdesk-current__ticket-copy">
            <span className="taskdesk-current__ticket-title">{ticket.title}</span>
            <span className="taskdesk-current__ticket-category">{ticket.category}</span>
          </span>
          <span className="taskdesk-current__ticket-labels">
            {due && ticket.due && <StatusPill kind={ticket.priority === "Urgente" ? "urgent" : "high"}>{ticket.due}</StatusPill>}
            <StatusPill kind={ticket.status === "Risolto" ? "resolved" : ticket.status === "In attesa" ? "waiting" : "open"}>{ticket.status}</StatusPill>
            {!due && <StatusPill kind={ticket.priority === "Urgente" ? "urgent" : ticket.priority === "Alta" ? "high" : "medium"}>{ticket.priority}</StatusPill>}
          </span>
        </button>
      ))}
    </section>
  );
}

export function CurrentDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  return (
    <div className="taskdesk-current">
      <aside className={`taskdesk-current__sidebar ${sidebarOpen ? "" : "taskdesk-current__sidebar--collapsed"}`}>
        <div className="taskdesk-current__brand">
          <div className="taskdesk-current__brand-mark">T</div>
          {sidebarOpen && <span>TaskDesk</span>}
          {sidebarOpen && <button className="taskdesk-current__collapse" type="button" onClick={() => setSidebarOpen(false)} aria-label="Riduci menu"><ChevronLeft size={16} /></button>}
        </div>
        {!sidebarOpen && <button className="taskdesk-current__expand" type="button" onClick={() => setSidebarOpen(true)} aria-label="Espandi menu"><ChevronRight size={16} /></button>}
        <nav className="taskdesk-current__nav">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button className={`taskdesk-current__nav-item ${active ? "taskdesk-current__nav-item--active" : ""}`} type="button" key={label} onClick={() => notify(`${label} selezionato`)}>
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="taskdesk-current__sidebar-bottom">
            <button className="taskdesk-current__nav-item" type="button"><Settings size={18} /><span>Impostazioni</span></button>
            <button className="taskdesk-current__nav-item" type="button"><CircleHelp size={18} /><span>Aiuto</span></button>
            <div className="taskdesk-current__profile">
              <span className="taskdesk-current__profile-avatar">AD</span>
              <span><strong>Alessandro De Luca</strong><small>Amministratore</small></span>
            </div>
          </div>
        )}
      </aside>

      <main className="taskdesk-current__main">
        <header className="taskdesk-current__topbar">
          <button className="taskdesk-current__mobile-menu" type="button" aria-label="Apri menu"><Menu size={19} /></button>
          <div>
            <div className="taskdesk-current__eyebrow">Panoramica</div>
            <h1>Dashboard</h1>
          </div>
          <div className="taskdesk-current__actions">
            <button className="taskdesk-current__icon-button" type="button" onClick={() => notify("Nessuna nuova notifica")} aria-label="Notifiche"><Bell size={18} /></button>
            <button className="taskdesk-current__edit-button" type="button" onClick={() => { setEditMode((value) => !value); notify(editMode ? "Modifica completata" : "Modalità modifica attiva"); }}>
              <SlidersHorizontal size={16} /> {editMode ? "Fine modifica" : "Modifica layout"}
            </button>
          </div>
        </header>

        <div className="taskdesk-current__content">
          <div className="taskdesk-current__stats">
            {[
              { label: "Ticket aperti", value: "24", accent: "blue", icon: <ClipboardList size={19} /> },
              { label: "In attesa", value: "8", accent: "violet", icon: <CalendarDays size={19} /> },
              { label: "Risolti", value: "126", accent: "green", icon: <span className="taskdesk-current__check">✓</span> },
              { label: "Urgenti", value: "3", accent: "red", icon: <span className="taskdesk-current__exclamation">!</span> },
            ].map((stat) => (
              <button className="taskdesk-current__stat taskdesk-current__card" type="button" key={stat.label} onClick={() => notify(`${stat.label}: ${stat.value}`)}>
                <span className={`taskdesk-current__stat-icon taskdesk-current__stat-icon--${stat.accent}`}>{stat.icon}</span>
                <span className="taskdesk-current__stat-copy"><small>{stat.label}</small><strong>{stat.value}</strong></span>
              </button>
            ))}
          </div>

          <div className="taskdesk-current__grid">
            <TicketList title="Scadenze imminenti" icon={<CalendarDays size={18} className="taskdesk-current__icon taskdesk-current__icon--orange" />} items={tickets.slice(0, 3)} due />
            <TicketList title="I miei ticket" icon={<ClipboardList size={18} className="taskdesk-current__icon taskdesk-current__icon--blue" />} items={tickets.slice(1, 4)} />
            <section className="taskdesk-current__card taskdesk-current__chart">
              <div className="taskdesk-current__card-heading">
                <div className="taskdesk-current__heading-title"><BarChart3 size={18} className="taskdesk-current__icon taskdesk-current__icon--violet" /><strong>Volume ticket</strong></div>
                <span className="taskdesk-current__period">Ultimi 30 giorni <ChevronRight size={14} /></span>
              </div>
              <div className="taskdesk-current__chart-area">
                <div className="taskdesk-current__chart-y"><span>30</span><span>20</span><span>10</span><span>0</span></div>
                <svg viewBox="0 0 460 146" preserveAspectRatio="none" aria-label="Grafico volume ticket">
                  <path d="M0 122 C35 108, 52 118, 82 96 S124 110, 152 74 S196 96, 222 63 S263 86, 289 50 S333 64, 356 77 S395 44, 422 52 S446 28, 460 34" fill="none" stroke="#1976d2" strokeWidth="3" />
                  <path d="M0 122 C35 108, 52 118, 82 96 S124 110, 152 74 S196 96, 222 63 S263 86, 289 50 S333 64, 356 77 S395 44, 422 52 S446 28, 460 34 L460 146 L0 146Z" fill="url(#currentChartFill)" opacity="0.3" />
                  <defs><linearGradient id="currentChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1976d2" /><stop offset="1" stopColor="#1976d2" stopOpacity="0" /></linearGradient></defs>
                </svg>
              </div>
              <div className="taskdesk-current__chart-x"><span>1 ago</span><span>10 ago</span><span>20 ago</span><span>Oggi</span></div>
            </section>
            <section className="taskdesk-current__card taskdesk-current__recent">
              <div className="taskdesk-current__card-heading">
                <div className="taskdesk-current__heading-title"><ClipboardList size={18} className="taskdesk-current__icon taskdesk-current__icon--green" /><strong>Ticket recenti</strong><span className="taskdesk-current__count">5</span></div>
                <button className="taskdesk-current__link" type="button">Vedi tutti</button>
              </div>
              <div className="taskdesk-current__recent-list">
                {tickets.map((ticket) => <div className="taskdesk-current__recent-row" key={ticket.id}><span className="taskdesk-current__recent-id">#{ticket.id}</span><span>{ticket.title}</span><small>Oggi, 10:{ticket.id}</small></div>)}
              </div>
            </section>
          </div>
        </div>
      </main>
      {toast && <div className="taskdesk-current__toast">{toast}</div>}
    </div>
  );
}

export default CurrentDashboard;