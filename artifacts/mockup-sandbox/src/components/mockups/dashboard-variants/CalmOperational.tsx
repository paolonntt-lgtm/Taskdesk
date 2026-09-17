import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileBarChart,
  Filter,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import "./_group.css";

type TicketStatus = "In corso" | "Da assegnare" | "In attesa";

type Ticket = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: "urgent" | "high" | "medium";
  due: string;
  assignee: string;
  initials: string;
};

const tickets: Ticket[] = [
  {
    id: "#TK-184",
    title: "Stampante non stampa in ufficio contabilità",
    category: "Hardware",
    status: "Da assegnare",
    priority: "urgent",
    due: "Scade oggi",
    assignee: "Da assegnare",
    initials: "?",
  },
  {
    id: "#TK-181",
    title: "PC banco cassa lento all'avvio",
    category: "Software",
    status: "In corso",
    priority: "high",
    due: "Domani, 10:30",
    assignee: "Mario Rossi",
    initials: "MR",
  },
  {
    id: "#TK-179",
    title: "Problema connessione VPN da remoto",
    category: "Rete",
    status: "In corso",
    priority: "high",
    due: "Domani, 14:00",
    assignee: "Laura Bianchi",
    initials: "LB",
  },
  {
    id: "#TK-176",
    title: "Schermo intermittente in sala riunioni",
    category: "Hardware",
    status: "Da assegnare",
    priority: "medium",
    due: "Mercoledì",
    assignee: "Da assegnare",
    initials: "?",
  },
];

const navGroups = [
  {
    label: "Operazioni",
    items: [
      { label: "Panoramica", icon: LayoutDashboard, active: true },
      { label: "Ticket", icon: ClipboardList, count: "12" },
      { label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Controllo",
    items: [
      { label: "Report", icon: FileBarChart },
      { label: "Impostazioni", icon: Settings },
    ],
  },
];

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="taskdesk-calm__icon-button"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TicketRow({ ticket, onSelect }: { ticket: Ticket; onSelect: (ticket: Ticket) => void }) {
  const priorityClass = `taskdesk-calm__priority-dot--${ticket.priority}`;
  const statusClass = ticket.status === "In attesa" ? "taskdesk-calm__ticket-status--waiting" : "";
  const dueClass = ticket.priority === "urgent" ? "taskdesk-calm__due--urgent" : "";

  return (
    <button className="taskdesk-calm__ticket" onClick={() => onSelect(ticket)} type="button">
      <span className={`taskdesk-calm__priority-dot ${priorityClass}`} />
      <span className="taskdesk-calm__ticket-main">
        <span className="taskdesk-calm__ticket-id">{ticket.id}</span>
        <span className="taskdesk-calm__ticket-title">{ticket.title}</span>
        <span className="taskdesk-calm__ticket-meta">
          <span className={`taskdesk-calm__ticket-status ${statusClass}`}>{ticket.status}</span>
          <strong>{ticket.category}</strong>
          <span>•</span>
          <span>Ricevuto ieri, 16:42</span>
        </span>
      </span>
      <span className="taskdesk-calm__ticket-side">
        <span className={`taskdesk-calm__due ${dueClass}`}>{ticket.due}</span>
        <span className="taskdesk-calm__person">
          <span className="taskdesk-calm__person-avatar">{ticket.initials}</span>
          {ticket.assignee}
        </span>
      </span>
    </button>
  );
}

export function CalmOperational() {
  const [filter, setFilter] = useState<"Tutti" | TicketStatus>("Tutti");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const visibleTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesFilter = filter === "Tutti" || ticket.status === filter;
      const matchesSearch =
        !normalizedSearch ||
        `${ticket.title} ${ticket.id} ${ticket.category}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="taskdesk-calm">
      <div className="taskdesk-calm__app">
        <aside className="taskdesk-calm__sidebar">
          <div className="taskdesk-calm__brand" aria-label="TaskDesk">
            <span className="taskdesk-calm__brand-mark" />
            <span className="taskdesk-calm__brand-name">task<span>desk</span></span>
          </div>

          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="taskdesk-calm__nav-label">{group.label}</p>
              <nav className="taskdesk-calm__nav" aria-label={group.label}>
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      className={`taskdesk-calm__nav-button ${item.active ? "taskdesk-calm__nav-button--active" : ""}`}
                      key={item.label}
                      onClick={() => announce(`${item.label}: vista in preparazione`)}
                      type="button"
                    >
                      <ItemIcon className="taskdesk-calm__nav-icon" strokeWidth={1.8} />
                      <span>{item.label}</span>
                      {item.count ? <span className="taskdesk-calm__nav-count">{item.count}</span> : null}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="taskdesk-calm__sidebar-note">
            <strong>Turno mattutino</strong>
            <p>Il team è coperto fino alle 18:00. Nessun passaggio in sospeso.</p>
          </div>

          <div className="taskdesk-calm__profile">
            <span className="taskdesk-calm__avatar">CR</span>
            <span className="taskdesk-calm__profile-copy">
              <span className="taskdesk-calm__profile-name">Chiara Rinaldi</span>
              <span className="taskdesk-calm__profile-role">Amministratrice</span>
            </span>
          </div>
        </aside>

        <main className="taskdesk-calm__main">
          <header className="taskdesk-calm__topbar">
            <div className="taskdesk-calm__crumbs">
              <span>TaskDesk</span>
              <ChevronRight size={12} />
              <strong>Panoramica</strong>
            </div>
            <div className="taskdesk-calm__top-actions">
              <label className="taskdesk-calm__search">
                <Search size={14} />
                <input
                  aria-label="Cerca ticket"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca ticket"
                  value={search}
                />
              </label>
              <IconButton label="Notifiche" onClick={() => announce("Hai 3 notifiche da leggere")}>
                <Bell size={15} strokeWidth={1.8} />
                <span className="taskdesk-calm__notification-dot" />
              </IconButton>
              <IconButton label="Guida" onClick={() => announce("Guida TaskDesk aperta")}>
                <CircleHelp size={15} strokeWidth={1.8} />
              </IconButton>
            </div>
          </header>

          <section className="taskdesk-calm__hero" aria-labelledby="dashboard-title">
            <div className="taskdesk-calm__hero-copy">
              <p className="taskdesk-calm__eyebrow">Lunedì 22 luglio 2024 · Milano</p>
              <h1 className="taskdesk-calm__hero-title" id="dashboard-title">
                Buongiorno, Chiara.<br />
                <em>Mettiamo ordine</em> alla giornata.
              </h1>
              <p className="taskdesk-calm__hero-subtitle">
                Il team ha già chiuso 8 richieste. Qui trovi ciò che merita attenzione adesso.
              </p>
              <span className="taskdesk-calm__hero-meta">Ultimo aggiornamento 2 min fa</span>
            </div>

            <div className="taskdesk-calm__focus-card">
              <p className="taskdesk-calm__card-label">Ritmo di oggi</p>
              <div className="taskdesk-calm__focus-row">
                <span className="taskdesk-calm__focus-number">68%</span>
                <span className="taskdesk-calm__focus-caption">delle richieste è già in buone mani</span>
              </div>
              <div className="taskdesk-calm__focus-bar"><span /></div>
              <div className="taskdesk-calm__focus-foot">
                <span>17 gestite su 25</span>
                <strong>+12% vs. ieri</strong>
              </div>
            </div>
          </section>

          <section className="taskdesk-calm__metrics" aria-label="Riepilogo operativo">
            <div className="taskdesk-calm__metric">
              <span className="taskdesk-calm__metric-label">Ticket aperti</span>
              <span className="taskdesk-calm__metric-value">24</span>
              <span className="taskdesk-calm__metric-change taskdesk-calm__metric-change--warm">+3</span>
              <span className="taskdesk-calm__metric-note">rispetto a ieri</span>
            </div>
            <div className="taskdesk-calm__metric">
              <span className="taskdesk-calm__metric-label">In lavorazione</span>
              <span className="taskdesk-calm__metric-value">11</span>
              <span className="taskdesk-calm__metric-change">4 assegnati</span>
              <span className="taskdesk-calm__metric-note">sul tuo team</span>
            </div>
            <div className="taskdesk-calm__metric">
              <span className="taskdesk-calm__metric-label">Tempo medio</span>
              <span className="taskdesk-calm__metric-value">3h 18m</span>
              <span className="taskdesk-calm__metric-change">−24m</span>
              <span className="taskdesk-calm__metric-note">ultima settimana</span>
            </div>
            <div className="taskdesk-calm__metric">
              <span className="taskdesk-calm__metric-label">Soddisfazione</span>
              <span className="taskdesk-calm__metric-value">4,6</span>
              <span className="taskdesk-calm__metric-change">su 5</span>
              <span className="taskdesk-calm__metric-note">63 risposte recenti</span>
            </div>
          </section>

          <div className="taskdesk-calm__content-grid">
            <section aria-labelledby="attention-title">
              <div className="taskdesk-calm__section-head">
                <h2 className="taskdesk-calm__section-title" id="attention-title">
                  Da prendere in carico <span>4 richieste</span>
                </h2>
                <button className="taskdesk-calm__text-button" onClick={() => announce("Elenco completo dei ticket aperto")} type="button">
                  Vedi tutti
                </button>
              </div>
              <div className="taskdesk-calm__ticket-panel">
                <div className="taskdesk-calm__ticket-toolbar">
                  <div className="taskdesk-calm__filter">
                    <Filter size={13} />
                    <span>Mostra</span>
                    <select aria-label="Filtra ticket" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
                      <option>Tutti</option>
                      <option>Da assegnare</option>
                      <option>In corso</option>
                      <option>In attesa</option>
                    </select>
                  </div>
                  <button className="taskdesk-calm__text-button" onClick={() => announce("Nuovo ticket pronto per la compilazione")} type="button">
                    <Plus size={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                    Nuovo ticket
                  </button>
                </div>
                <div className="taskdesk-calm__ticket-list">
                  {visibleTickets.length ? visibleTickets.map((ticket) => (
                    <TicketRow key={ticket.id} onSelect={setSelectedTicket} ticket={ticket} />
                  )) : (
                    <div style={{ padding: "27px 18px", color: "var(--td-ink-soft)", fontSize: 12 }}>
                      Nessun ticket corrisponde alla ricerca.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="work-title">
              <div className="taskdesk-calm__section-head">
                <h2 className="taskdesk-calm__section-title" id="work-title">Distribuzione del lavoro</h2>
                <button className="taskdesk-calm__text-button" onClick={() => announce("Report del team aperto")} type="button">Report</button>
              </div>
              <div className="taskdesk-calm__work-panel">
                <div className="taskdesk-calm__work-total">
                  <div className="taskdesk-calm__donut">
                    <div className="taskdesk-calm__donut-copy"><strong>24</strong><span>ticket</span></div>
                  </div>
                  <div className="taskdesk-calm__work-summary">
                    <strong>Il carico è sotto controllo</strong>
                    <p>Solo 3 richieste attendono una prima risposta.</p>
                  </div>
                </div>
                <div className="taskdesk-calm__legend">
                  <div className="taskdesk-calm__legend-row"><i /><span>Da assegnare</span><strong>6</strong></div>
                  <div className="taskdesk-calm__legend-row"><i className="moss" /><span>In lavorazione</span><strong>11</strong></div>
                  <div className="taskdesk-calm__legend-row"><i className="blue" /><span>In attesa</span><strong>4</strong></div>
                  <div className="taskdesk-calm__legend-row"><i className="grey" /><span>Risolti oggi</span><strong>3</strong></div>
                </div>
              </div>
            </section>
          </div>

          <div className="taskdesk-calm__bottom-grid">
            <section className="taskdesk-calm__activity-panel" aria-labelledby="activity-title">
              <div className="taskdesk-calm__section-head">
                <h2 className="taskdesk-calm__section-title" id="activity-title">Attività recenti</h2>
                <button className="taskdesk-calm__text-button" onClick={() => announce("Cronologia attività aperta")} type="button">Cronologia</button>
              </div>
              <div className="taskdesk-calm__timeline">
                <div className="taskdesk-calm__timeline-item">
                  <span className="taskdesk-calm__timeline-dot" />
                  <span className="taskdesk-calm__timeline-copy"><strong>Mario Rossi</strong> ha risolto <strong>#TK-172</strong> · Accesso al gestionale</span>
                  <span className="taskdesk-calm__timeline-time">09:42</span>
                </div>
                <div className="taskdesk-calm__timeline-item">
                  <span className="taskdesk-calm__timeline-dot" />
                  <span className="taskdesk-calm__timeline-copy"><strong>Nuova richiesta</strong> da Officine Bianchi · Configurazione VPN</span>
                  <span className="taskdesk-calm__timeline-time">09:18</span>
                </div>
                <div className="taskdesk-calm__timeline-item">
                  <span className="taskdesk-calm__timeline-dot" />
                  <span className="taskdesk-calm__timeline-copy"><strong>Laura Bianchi</strong> ha risposto a <strong>#TK-179</strong> · Problema VPN</span>
                  <span className="taskdesk-calm__timeline-time">08:56</span>
                </div>
              </div>
            </section>

            <section className="taskdesk-calm__waiting-panel" aria-labelledby="waiting-title">
              <div className="taskdesk-calm__section-head">
                <h2 className="taskdesk-calm__section-title" id="waiting-title">In attesa</h2>
                <button className="taskdesk-calm__text-button" onClick={() => announce("Coda in attesa aperta")} type="button">Gestisci</button>
              </div>
              <div className="taskdesk-calm__waiting-list">
                <div className="taskdesk-calm__waiting-item">
                  <span className="taskdesk-calm__waiting-mark" />
                  <span className="taskdesk-calm__waiting-copy"><strong>Licenza Adobe scaduta</strong><span>Attende risposta cliente</span></span>
                  <span className="taskdesk-calm__waiting-time">2g</span>
                </div>
                <div className="taskdesk-calm__waiting-item">
                  <span className="taskdesk-calm__waiting-mark" />
                  <span className="taskdesk-calm__waiting-copy"><strong>Accesso area riservata</strong><span>Attende conferma IT</span></span>
                  <span className="taskdesk-calm__waiting-time">1g</span>
                </div>
                <div className="taskdesk-calm__waiting-item">
                  <span className="taskdesk-calm__waiting-mark" />
                  <span className="taskdesk-calm__waiting-copy"><strong>Nuova utenza per Giulia</strong><span>Attende dati dipendente</span></span>
                  <span className="taskdesk-calm__waiting-time">6h</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {selectedTicket ? (
        <div className="taskdesk-calm__toast" role="status">
          {selectedTicket.id} selezionato · {selectedTicket.title}
        </div>
      ) : null}
      {toast ? <div className="taskdesk-calm__toast" role="status">{toast}</div> : null}
    </div>
  );
}