import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
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
import "./EditorialDesk.css";

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
    <button aria-label={label} className="taskdesk-editorial__icon-button" onClick={onClick} type="button">
      {children}
    </button>
  );
}

function TicketRow({ ticket, onSelect }: { ticket: Ticket; onSelect: (ticket: Ticket) => void }) {
  return (
    <button
      className={`taskdesk-editorial__ticket taskdesk-editorial__ticket--${ticket.priority}`}
      onClick={() => onSelect(ticket)}
      type="button"
    >
      <span className="taskdesk-editorial__ticket-rule" />
      <span className="taskdesk-editorial__ticket-main">
        <span className="taskdesk-editorial__ticket-kicker">
          <span>{ticket.id}</span>
          <span className={`taskdesk-editorial__ticket-status taskdesk-editorial__ticket-status--${ticket.status === "In attesa" ? "waiting" : "active"}`}>
            {ticket.status}
          </span>
          <span>{ticket.category}</span>
        </span>
        <span className="taskdesk-editorial__ticket-title">{ticket.title}</span>
        <span className="taskdesk-editorial__ticket-meta">Ricevuto ieri, 16:42</span>
      </span>
      <span className="taskdesk-editorial__ticket-side">
        <span className={`taskdesk-editorial__due ${ticket.priority === "urgent" ? "taskdesk-editorial__due--urgent" : ""}`}>
          {ticket.due}
        </span>
        <span className="taskdesk-editorial__person">
          <span className="taskdesk-editorial__person-avatar">{ticket.initials}</span>
          {ticket.assignee}
        </span>
        <ChevronRight className="taskdesk-editorial__ticket-arrow" size={15} />
      </span>
    </button>
  );
}

export function EditorialDesk() {
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

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    announce(`${ticket.id} selezionato · ${ticket.title}`);
  };

  return (
    <div className="taskdesk-editorial">
      <div className="taskdesk-editorial__frame">
        <aside className="taskdesk-editorial__rail">
          <div className="taskdesk-editorial__brand" aria-label="TaskDesk">
            <span className="taskdesk-editorial__brand-mark">
              <span />
              <span />
            </span>
            <span className="taskdesk-editorial__brand-word">task<span>desk</span></span>
          </div>

          <div className="taskdesk-editorial__rail-rule" />
          <span className="taskdesk-editorial__rail-caption">Il tuo desk</span>
          {navGroups.map((group) => (
            <div className="taskdesk-editorial__nav-group" key={group.label}>
              <span className="taskdesk-editorial__nav-label">{group.label}</span>
              <nav aria-label={group.label} className="taskdesk-editorial__nav">
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      className={`taskdesk-editorial__nav-button ${item.active ? "taskdesk-editorial__nav-button--active" : ""}`}
                      key={item.label}
                      onClick={() => announce(`${item.label}: vista in preparazione`)}
                      type="button"
                    >
                      <ItemIcon size={15} strokeWidth={1.7} />
                      <span>{item.label}</span>
                      {item.count ? <small>{item.count}</small> : null}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="taskdesk-editorial__rail-foot">
            <div className="taskdesk-editorial__rail-note">
              <BookOpen size={15} strokeWidth={1.6} />
              <span>Edizione<br /><strong>22 / 07 / 24</strong></span>
            </div>
            <button className="taskdesk-editorial__profile" onClick={() => announce("Profilo di Chiara Rinaldi")} type="button">
              <span className="taskdesk-editorial__profile-avatar">CR</span>
              <span>
                <strong>Chiara Rinaldi</strong>
                <small>Amministratrice</small>
              </span>
            </button>
          </div>
        </aside>

        <main className="taskdesk-editorial__main">
          <header className="taskdesk-editorial__topbar">
            <div className="taskdesk-editorial__breadcrumb">
              <span>TaskDesk</span>
              <ChevronRight size={12} />
              <strong>Panoramica</strong>
            </div>
            <div className="taskdesk-editorial__top-actions">
              <label className="taskdesk-editorial__search">
                <Search size={14} strokeWidth={1.8} />
                <input
                  aria-label="Cerca ticket"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca nel desk"
                  value={search}
                />
              </label>
              <IconButton label="Notifiche" onClick={() => announce("Hai 3 notifiche da leggere")}>
                <Bell size={16} strokeWidth={1.7} />
                <span className="taskdesk-editorial__notification-dot" />
              </IconButton>
              <IconButton label="Guida" onClick={() => announce("Guida TaskDesk aperta")}>
                <CircleHelp size={16} strokeWidth={1.7} />
              </IconButton>
            </div>
          </header>

          <section className="taskdesk-editorial__opening" aria-labelledby="editorial-title">
            <div className="taskdesk-editorial__opening-copy">
              <p className="taskdesk-editorial__overline">Lunedì 22 luglio 2024 <span>·</span> Milano</p>
              <h1 id="editorial-title">
                Buongiorno, Chiara<span>.</span><br />
                <em>Facciamo spazio</em> a ciò che conta.
              </h1>
              <p className="taskdesk-editorial__intro">
                Il team ha già chiuso 8 richieste. Questa è la selezione del desk per iniziare bene il turno.
              </p>
              <span className="taskdesk-editorial__updated">Ultimo aggiornamento 2 min fa</span>
            </div>
            <aside className="taskdesk-editorial__editor-note">
              <span className="taskdesk-editorial__note-index">Nota di regia <strong>01 / 04</strong></span>
              <div className="taskdesk-editorial__note-mark">“</div>
              <p>La prima risposta cambia il ritmo della giornata.</p>
              <span className="taskdesk-editorial__note-sign">Il desk operativo</span>
            </aside>
          </section>

          <section className="taskdesk-editorial__signal-strip" aria-label="Riepilogo operativo">
            <div className="taskdesk-editorial__signal-intro">
              <span className="taskdesk-editorial__section-index">A / 04</span>
              <strong>In breve</strong>
              <span>Il polso del turno</span>
            </div>
            <div className="taskdesk-editorial__signal">
              <span>Ticket aperti</span>
              <strong>24</strong>
              <em>+3 <small>rispetto a ieri</small></em>
            </div>
            <div className="taskdesk-editorial__signal">
              <span>In lavorazione</span>
              <strong>11</strong>
              <em className="is-steady">4 assegnati <small>sul tuo team</small></em>
            </div>
            <div className="taskdesk-editorial__signal">
              <span>Tempo medio</span>
              <strong>3h 18m</strong>
              <em className="is-good">−24m <small>ultima settimana</small></em>
            </div>
            <div className="taskdesk-editorial__signal">
              <span>Soddisfazione</span>
              <strong>4,6</strong>
              <em className="is-steady">su 5 <small>63 risposte recenti</small></em>
            </div>
          </section>

          <section className="taskdesk-editorial__desk-grid">
            <section className="taskdesk-editorial__queue" aria-labelledby="attention-title">
              <div className="taskdesk-editorial__section-head">
                <div>
                  <span className="taskdesk-editorial__section-index">B / 04</span>
                  <h2 id="attention-title">Da prendere in carico <small>4 richieste</small></h2>
                  <p>Le richieste che meritano una decisione prima di mezzogiorno.</p>
                </div>
                <button className="taskdesk-editorial__link-button" onClick={() => announce("Elenco completo dei ticket aperto")} type="button">
                  Vedi tutti <ArrowMark />
                </button>
              </div>

              <div className="taskdesk-editorial__queue-panel">
                <div className="taskdesk-editorial__queue-toolbar">
                  <label className="taskdesk-editorial__filter">
                    <Filter size={13} strokeWidth={1.8} />
                    <span>Seleziona</span>
                    <select aria-label="Filtra ticket" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
                      <option>Tutti</option>
                      <option>Da assegnare</option>
                      <option>In corso</option>
                      <option>In attesa</option>
                    </select>
                  </label>
                  <button className="taskdesk-editorial__new-button" onClick={() => announce("Nuovo ticket pronto per la compilazione")} type="button">
                    <Plus size={13} strokeWidth={2} />
                    Nuovo ticket
                  </button>
                </div>
                <div className="taskdesk-editorial__ticket-list">
                  {visibleTickets.length ? visibleTickets.map((ticket) => (
                    <TicketRow key={ticket.id} onSelect={handleTicketSelect} ticket={ticket} />
                  )) : (
                    <div className="taskdesk-editorial__empty">Nessun ticket corrisponde alla ricerca.</div>
                  )}
                </div>
              </div>
            </section>

            <aside className="taskdesk-editorial__side-column">
              <section className="taskdesk-editorial__rhythm" aria-labelledby="rhythm-title">
                <div className="taskdesk-editorial__side-head">
                  <div>
                    <span className="taskdesk-editorial__section-index">C / 04</span>
                    <h2 id="rhythm-title">Ritmo di oggi</h2>
                  </div>
                  <button className="taskdesk-editorial__link-button" onClick={() => announce("Report del team aperto")} type="button">Report <ArrowMark /></button>
                </div>
                <div className="taskdesk-editorial__rhythm-number">
                  <strong>68<sup>%</sup></strong>
                  <span>delle richieste<br />è già in buone mani</span>
                </div>
                <div className="taskdesk-editorial__rhythm-bar"><span /></div>
                <div className="taskdesk-editorial__rhythm-foot">
                  <span>17 gestite su 25</span>
                  <strong>+12% vs. ieri</strong>
                </div>
                <div className="taskdesk-editorial__rhythm-rule" />
                <p>Solo 3 richieste attendono una prima risposta.</p>
              </section>

              <section className="taskdesk-editorial__shift" aria-label="Stato del turno">
                <div className="taskdesk-editorial__shift-pin" />
                <div>
                  <span className="taskdesk-editorial__section-index">Passaggio di turno</span>
                  <strong>Coperti fino alle 18:00</strong>
                  <p>Nessun passaggio in sospeso.</p>
                </div>
              </section>
            </aside>
          </section>

          <section className="taskdesk-editorial__lower-grid">
            <section className="taskdesk-editorial__ledger" aria-labelledby="activity-title">
              <div className="taskdesk-editorial__section-head">
                <div>
                  <span className="taskdesk-editorial__section-index">D / 04</span>
                  <h2 id="activity-title">Il desk si è mosso</h2>
                </div>
                <button className="taskdesk-editorial__link-button" onClick={() => announce("Cronologia attività aperta")} type="button">Cronologia <ArrowMark /></button>
              </div>
              <div className="taskdesk-editorial__ledger-list">
                <div className="taskdesk-editorial__ledger-item">
                  <span className="taskdesk-editorial__ledger-time">09:42</span>
                  <span className="taskdesk-editorial__ledger-dot" />
                  <p><strong>Mario Rossi</strong> ha risolto <strong>#TK-172</strong><br /><span>Accesso al gestionale</span></p>
                </div>
                <div className="taskdesk-editorial__ledger-item">
                  <span className="taskdesk-editorial__ledger-time">09:18</span>
                  <span className="taskdesk-editorial__ledger-dot ledger-dot--warm" />
                  <p><strong>Nuova richiesta</strong> da Officine Bianchi<br /><span>Configurazione VPN</span></p>
                </div>
                <div className="taskdesk-editorial__ledger-item">
                  <span className="taskdesk-editorial__ledger-time">08:56</span>
                  <span className="taskdesk-editorial__ledger-dot ledger-dot--plum" />
                  <p><strong>Laura Bianchi</strong> ha risposto a <strong>#TK-179</strong><br /><span>Problema VPN</span></p>
                </div>
              </div>
            </section>

            <section className="taskdesk-editorial__waiting" aria-labelledby="waiting-title">
              <div className="taskdesk-editorial__section-head">
                <div>
                  <span className="taskdesk-editorial__section-index">E / 04</span>
                  <h2 id="waiting-title">In attesa</h2>
                </div>
                <button className="taskdesk-editorial__link-button" onClick={() => announce("Coda in attesa aperta")} type="button">Gestisci <ArrowMark /></button>
              </div>
              <div className="taskdesk-editorial__waiting-list">
                <div className="taskdesk-editorial__waiting-item">
                  <span className="taskdesk-editorial__waiting-mark" />
                  <span><strong>Licenza Adobe scaduta</strong><small>Attende risposta cliente</small></span>
                  <time>2g</time>
                </div>
                <div className="taskdesk-editorial__waiting-item">
                  <span className="taskdesk-editorial__waiting-mark" />
                  <span><strong>Accesso area riservata</strong><small>Attende conferma IT</small></span>
                  <time>1g</time>
                </div>
                <div className="taskdesk-editorial__waiting-item">
                  <span className="taskdesk-editorial__waiting-mark" />
                  <span><strong>Nuova utenza per Giulia</strong><small>Attende dati dipendente</small></span>
                  <time>6h</time>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>

      {selectedTicket || toast ? (
        <div className="taskdesk-editorial__toast" role="status">
          {toast || `${selectedTicket?.id} selezionato`}
        </div>
      ) : null}
    </div>
  );
}

function ArrowMark() {
  return <span aria-hidden="true" className="taskdesk-editorial__arrow-mark">↗</span>;
}