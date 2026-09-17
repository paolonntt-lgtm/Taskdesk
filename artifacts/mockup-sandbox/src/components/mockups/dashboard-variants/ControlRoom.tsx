import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Filter,
  Gauge,
  LayoutDashboard,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import "./ControlRoom.css";

type TicketStatus = "In corso" | "Da assegnare" | "In attesa";
type TicketPriority = "urgent" | "high" | "medium";

type Ticket = {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  due: string;
  assignee: string;
  initials: string;
  received: string;
};

const initialTickets: Ticket[] = [
  {
    id: "#TK-184",
    title: "Stampante non stampa in ufficio contabilità",
    category: "Hardware",
    status: "Da assegnare",
    priority: "urgent",
    due: "Scade oggi",
    assignee: "Da assegnare",
    initials: "?",
    received: "16:42",
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
    received: "15:08",
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
    received: "14:51",
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
    received: "13:29",
  },
  {
    id: "#TK-173",
    title: "Ripristino permessi cartella progetti",
    category: "Accessi",
    status: "In attesa",
    priority: "medium",
    due: "Giovedì",
    assignee: "Giulia Conti",
    initials: "GC",
    received: "11:04",
  },
];

const navItems = [
  { label: "Panoramica", icon: LayoutDashboard, active: true },
  { label: "Ticket", icon: ClipboardList, count: "12" },
  { label: "Clienti", icon: Users },
  { label: "Report", icon: Activity },
];

const operators = [
  { initials: "MR", name: "Mario Rossi", role: "Supporto IT", load: 82, color: "cyan" },
  { initials: "LB", name: "Laura Bianchi", role: "Supporto IT", load: 66, color: "amber" },
  { initials: "GC", name: "Giulia Conti", role: "Amministrazione", load: 48, color: "violet" },
  { initials: "AF", name: "Andrea Ferri", role: "Supporto IT", load: 31, color: "teal" },
];

function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`taskdesk-control__icon-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const statusClass =
    status === "In corso"
      ? "is-progress"
      : status === "Da assegnare"
        ? "is-unassigned"
        : "is-waiting";

  return <span className={`taskdesk-control__status ${statusClass}`}>{status}</span>;
}

function PriorityMark({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`taskdesk-control__priority taskdesk-control__priority--${priority}`}>
      <span />
      <span />
      <span />
    </span>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <div className={`taskdesk-control__metric ${tone ? `is-${tone}` : ""}`}>
      <span className="taskdesk-control__metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="taskdesk-control__metric-detail">{detail}</span>
    </div>
  );
}

export function ControlRoom() {
  const [tickets, setTickets] = useState(initialTickets);
  const [filter, setFilter] = useState<"Tutti" | TicketStatus>("Tutti");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const announce = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const visibleTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesFilter = filter === "Tutti" || ticket.status === filter;
      const matchesSearch =
        !normalizedSearch ||
        `${ticket.title} ${ticket.id} ${ticket.category} ${ticket.assignee}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tickets]);

  const takeOwnership = (ticket: Ticket) => {
    setTickets((current) =>
      current.map((item) =>
        item.id === ticket.id
          ? { ...item, status: "In corso", assignee: "Chiara Rinaldi", initials: "CR" }
          : item,
      ),
    );
    announce(`${ticket.id} preso in carico da Chiara Rinaldi`);
  };

  return (
    <div className="taskdesk-control">
      <div className="taskdesk-control__shell">
        <aside className="taskdesk-control__rail">
          <div className="taskdesk-control__brand" aria-label="TaskDesk">
            <span className="taskdesk-control__brand-mark">
              <span />
              <span />
            </span>
            <span className="taskdesk-control__brand-name">task<span>desk</span></span>
          </div>

          <div className="taskdesk-control__shift">
            <span className="taskdesk-control__live-dot" />
            <span>
              <strong>Turno attivo</strong>
              <small>09:00 — 18:00</small>
            </span>
            <ChevronDown size={13} />
          </div>

          <nav className="taskdesk-control__nav" aria-label="Navigazione principale">
            <span className="taskdesk-control__nav-caption">Workspace</span>
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  className={`taskdesk-control__nav-item ${item.active ? "is-active" : ""}`}
                  key={item.label}
                  onClick={() => announce(`${item.label}: vista in preparazione`)}
                  type="button"
                >
                  <ItemIcon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.count ? <b>{item.count}</b> : null}
                </button>
              );
            })}
            <span className="taskdesk-control__nav-caption taskdesk-control__nav-caption--lower">Sistema</span>
            <button className="taskdesk-control__nav-item" onClick={() => announce("Impostazioni aperte")} type="button">
              <Settings size={16} strokeWidth={1.8} />
              <span>Impostazioni</span>
            </button>
          </nav>

          <div className="taskdesk-control__rail-footer">
            <div className="taskdesk-control__coverage">
              <div className="taskdesk-control__coverage-head">
                <span>Copertura team</span>
                <strong>4 / 4</strong>
              </div>
              <div className="taskdesk-control__coverage-bar"><span /></div>
              <small>Nessun passaggio in sospeso</small>
            </div>
            <button className="taskdesk-control__profile" onClick={() => announce("Profilo di Chiara Rinaldi")} type="button">
              <span className="taskdesk-control__avatar">CR</span>
              <span>
                <strong>Chiara Rinaldi</strong>
                <small>Amministratrice</small>
              </span>
              <MoreHorizontal size={15} />
            </button>
          </div>
        </aside>

        <main className="taskdesk-control__main">
          <header className="taskdesk-control__topbar">
            <div className="taskdesk-control__crumbs">
              <span>TaskDesk</span>
              <ChevronRight size={13} />
              <strong>Centro di controllo</strong>
              <span className="taskdesk-control__status-line"><i /> Sistema operativo</span>
            </div>
            <div className="taskdesk-control__top-actions">
              <span className="taskdesk-control__date">Lun 22 lug 2024 <b>·</b> Milano</span>
              <label className="taskdesk-control__search">
                <Search size={14} />
                <input
                  aria-label="Cerca nella coda"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cerca nella coda"
                  value={search}
                />
                <kbd>⌘ K</kbd>
              </label>
              <IconButton label="Notifiche" onClick={() => announce("Hai 3 notifiche da leggere")} active>
                <Bell size={15} strokeWidth={1.8} />
                <span className="taskdesk-control__notification-dot" />
              </IconButton>
              <IconButton label="Guida" onClick={() => announce("Guida TaskDesk aperta")}>
                <CircleHelp size={15} strokeWidth={1.8} />
              </IconButton>
            </div>
          </header>

          <section className="taskdesk-control__command-header" aria-labelledby="control-title">
            <div>
              <p className="taskdesk-control__overline"><span /> LIVE OPERATIONS / 02</p>
              <h1 id="control-title">Turno live. <em>Occhi sulla coda.</em></h1>
              <p className="taskdesk-control__intro">Le richieste che richiedono una decisione adesso, prima del resto.</p>
            </div>
            <div className="taskdesk-control__command-actions">
              <span className="taskdesk-control__sync"><Activity size={13} /> Aggiornato 2 min fa</span>
              <button className="taskdesk-control__pause" onClick={() => { setIsPaused((value) => !value); announce(isPaused ? "Aggiornamenti automatici riattivati" : "Aggiornamenti automatici in pausa"); }} type="button">
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                {isPaused ? "Riprendi flusso" : "Metti in pausa"}
              </button>
            </div>
          </section>

          <section className="taskdesk-control__alert-grid" aria-label="Priorità del turno">
            <button className="taskdesk-control__alert-card" onClick={() => { setFilter("Da assegnare"); announce("Filtro: richieste da assegnare"); }} type="button">
              <span className="taskdesk-control__alert-icon"><AlertTriangle size={17} /></span>
              <span className="taskdesk-control__alert-copy">
                <small>Richiede attenzione</small>
                <strong>1 ticket oltre la soglia</strong>
                <span>#TK-184 · Stampante contabilità</span>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <div className="taskdesk-control__signal">
              <div className="taskdesk-control__signal-label"><span>Stato coda</span><strong>STABILE</strong></div>
              <div className="taskdesk-control__signal-track"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="taskdesk-control__signal-foot"><span>Ultime 2 ore</span><span>Picco alle 10:20</span></div>
            </div>
            <div className="taskdesk-control__response">
              <span className="taskdesk-control__metric-label">Prima risposta media</span>
              <strong>42 <small>min</small></strong>
              <span className="taskdesk-control__response-trend"><ArrowUpRight size={12} /> −8 min questa settimana</span>
            </div>
          </section>

          <section className="taskdesk-control__metric-strip" aria-label="Metriche operative">
            <Metric label="Ticket aperti" value="24" detail="+3 rispetto a ieri" tone="warm" />
            <Metric label="Da assegnare" value="6" detail="1 oltre soglia" tone="danger" />
            <Metric label="In lavorazione" value="11" detail="4 sul tuo team" />
            <Metric label="Risolti oggi" value="17" detail="+12% vs. ieri" tone="good" />
            <Metric label="Soddisfazione" value="4,6" detail="su 5 · 63 risposte" />
          </section>

          <div className="taskdesk-control__workspace">
            <section className="taskdesk-control__queue" aria-labelledby="queue-title">
              <div className="taskdesk-control__section-head">
                <div>
                  <div className="taskdesk-control__section-kicker"><span className="taskdesk-control__section-pulse" /> QUEUE MONITOR</div>
                  <h2 id="queue-title">Coda attiva <span>{visibleTickets.length} visibili</span></h2>
                </div>
                <div className="taskdesk-control__section-actions">
                  <button className="taskdesk-control__secondary-button" onClick={() => announce("Filtri avanzati aperti")} type="button"><SlidersHorizontal size={13} /> Filtri</button>
                  <button className="taskdesk-control__primary-button" onClick={() => announce("Nuovo ticket pronto per la compilazione")} type="button"><Plus size={14} /> Nuovo ticket</button>
                </div>
              </div>
              <div className="taskdesk-control__queue-panel">
                <div className="taskdesk-control__queue-toolbar">
                  <div className="taskdesk-control__tabs" role="tablist" aria-label="Filtra coda">
                    {(["Tutti", "Da assegnare", "In corso", "In attesa"] as const).map((item) => (
                      <button
                        aria-selected={filter === item}
                        className={filter === item ? "is-active" : ""}
                        key={item}
                        onClick={() => setFilter(item)}
                        role="tab"
                        type="button"
                      >
                        {item}
                        {item === "Da assegnare" ? <b>6</b> : null}
                      </button>
                    ))}
                  </div>
                  <button className="taskdesk-control__sort-button" onClick={() => announce("Ordinamento: priorità e scadenza")} type="button">
                    <Filter size={13} /> Priorità <ChevronDown size={13} />
                  </button>
                </div>
                <div className="taskdesk-control__queue-head">
                  <span>Priorità / richiesta</span><span>Stato</span><span>Scadenza</span><span>Owner</span><span aria-hidden="true" />
                </div>
                <div className="taskdesk-control__ticket-list">
                  {visibleTickets.length ? visibleTickets.map((ticket) => (
                    <article
                      className={`taskdesk-control__ticket-row ${selectedTicket?.id === ticket.id ? "is-selected" : ""}`}
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      onKeyDown={(event) => { if (event.key === "Enter") setSelectedTicket(ticket); }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="taskdesk-control__ticket-request">
                        <PriorityMark priority={ticket.priority} />
                        <div>
                          <div className="taskdesk-control__ticket-line">
                            <span className="taskdesk-control__ticket-id">{ticket.id}</span>
                            <strong>{ticket.title}</strong>
                          </div>
                          <span className="taskdesk-control__ticket-meta">{ticket.category} <i /> Ricevuto oggi, {ticket.received}</span>
                        </div>
                      </div>
                      <div><StatusPill status={ticket.status} /></div>
                      <div className={`taskdesk-control__due ${ticket.priority === "urgent" ? "is-urgent" : ""}`}><Clock3 size={13} /> {ticket.due}</div>
                      <div className="taskdesk-control__owner">
                        <span className={`taskdesk-control__mini-avatar ${ticket.assignee === "Da assegnare" ? "is-empty" : ""}`}>{ticket.initials}</span>
                        <span>{ticket.assignee}</span>
                      </div>
                      <div className="taskdesk-control__row-action">
                        {ticket.assignee === "Da assegnare" ? (
                          <button onClick={(event) => { event.stopPropagation(); takeOwnership(ticket); }} type="button">Prendi</button>
                        ) : (
                          <button aria-label={`Apri ${ticket.id}`} onClick={(event) => { event.stopPropagation(); setSelectedTicket(ticket); announce(`${ticket.id} aperto`); }} type="button"><ChevronRight size={15} /></button>
                        )}
                      </div>
                    </article>
                  )) : (
                    <div className="taskdesk-control__empty">
                      <Search size={18} />
                      <strong>Nessun ticket in questa vista</strong>
                      <span>Prova a rimuovere il filtro o cambiare la ricerca.</span>
                      <button onClick={() => { setFilter("Tutti"); setSearch(""); }} type="button">Azzera filtri</button>
                    </div>
                  )}
                </div>
                <div className="taskdesk-control__queue-foot">
                  <span><ShieldCheck size={13} /> SLA monitorato su 24 ticket</span>
                  <button onClick={() => announce("Elenco completo dei ticket aperto")} type="button">Vedi coda completa <ArrowUpRight size={13} /></button>
                </div>
              </div>
            </section>

            <aside className="taskdesk-control__load-panel" aria-labelledby="load-title">
              <div className="taskdesk-control__section-head">
                <div>
                  <div className="taskdesk-control__section-kicker"><Gauge size={13} /> CAPACITÀ LIVE</div>
                  <h2 id="load-title">Carico del team</h2>
                </div>
                <button className="taskdesk-control__dots" aria-label="Altre opzioni" onClick={() => announce("Opzioni carico aperte")} type="button"><MoreHorizontal size={16} /></button>
              </div>
              <div className="taskdesk-control__load-summary">
                <div className="taskdesk-control__load-dial"><strong>68</strong><span>% utilizzato</span></div>
                <div><strong>Il margine è stretto</strong><p>2 operatori sopra il 70% del carico.</p></div>
              </div>
              <div className="taskdesk-control__operators">
                {operators.map((operator) => (
                  <button className="taskdesk-control__operator" key={operator.name} onClick={() => announce(`Carico di ${operator.name}: ${operator.load}%`)} type="button">
                    <span className={`taskdesk-control__mini-avatar taskdesk-control__mini-avatar--${operator.color}`}>{operator.initials}</span>
                    <span className="taskdesk-control__operator-copy"><strong>{operator.name}</strong><small>{operator.role}</small></span>
                    <span className="taskdesk-control__operator-load"><b>{operator.load}%</b><span className="taskdesk-control__load-bar"><i className={`is-${operator.color}`} style={{ width: `${operator.load}%` }} /></span></span>
                  </button>
                ))}
              </div>
              <button className="taskdesk-control__load-link" onClick={() => announce("Distribuzione del lavoro aperta")} type="button">Ridistribuisci lavoro <ArrowUpRight size={13} /></button>
            </aside>
          </div>

          <div className="taskdesk-control__bottom-grid">
            <section className="taskdesk-control__activity-panel" aria-labelledby="activity-title">
              <div className="taskdesk-control__section-head">
                <div>
                  <div className="taskdesk-control__section-kicker"><Activity size={13} /> ACTIVITY LOG</div>
                  <h2 id="activity-title">Movimenti recenti</h2>
                </div>
                <button className="taskdesk-control__text-button" onClick={() => announce("Cronologia completa aperta")} type="button">Cronologia</button>
              </div>
              <div className="taskdesk-control__activity-list">
                <div><span className="taskdesk-control__activity-mark is-green"><CheckCircle2 size={13} /></span><p><strong>Mario Rossi</strong> ha risolto <b>#TK-172</b><small>Accesso al gestionale</small></p><time>09:42</time></div>
                <div><span className="taskdesk-control__activity-mark is-amber"><Plus size={13} /></span><p><strong>Nuova richiesta</strong> da Officine Bianchi<small>Configurazione VPN</small></p><time>09:18</time></div>
                <div><span className="taskdesk-control__activity-mark is-blue"><ArrowUpRight size={13} /></span><p><strong>Laura Bianchi</strong> ha risposto a <b>#TK-179</b><small>Problema connessione VPN</small></p><time>08:56</time></div>
              </div>
            </section>
            <section className="taskdesk-control__waiting-panel" aria-labelledby="waiting-title">
              <div className="taskdesk-control__section-head">
                <div>
                  <div className="taskdesk-control__section-kicker"><Clock3 size={13} /> WAITING ROOM</div>
                  <h2 id="waiting-title">In attesa <span>3</span></h2>
                </div>
                <button className="taskdesk-control__text-button" onClick={() => announce("Coda in attesa aperta")} type="button">Gestisci</button>
              </div>
              <div className="taskdesk-control__waiting-list">
                <button onClick={() => announce("Licenza Adobe scaduta selezionata")} type="button"><span className="is-old" /><span><strong>Licenza Adobe scaduta</strong><small>Attende risposta cliente</small></span><b>2g</b></button>
                <button onClick={() => announce("Accesso area riservata selezionato")} type="button"><span /><span><strong>Accesso area riservata</strong><small>Attende conferma IT</small></span><b>1g</b></button>
                <button onClick={() => announce("Nuova utenza per Giulia selezionata")} type="button"><span /><span><strong>Nuova utenza per Giulia</strong><small>Attende dati dipendente</small></span><b>6h</b></button>
              </div>
            </section>
          </div>
        </main>
      </div>

      {selectedTicket ? (
        <div className="taskdesk-control__ticket-drawer" role="status">
          <div><span className="taskdesk-control__drawer-kicker">TICKET SELEZIONATO</span><strong>{selectedTicket.id}</strong><p>{selectedTicket.title}</p></div>
          <button aria-label="Chiudi selezione" onClick={() => setSelectedTicket(null)} type="button"><X size={16} /></button>
        </div>
      ) : null}
      {toast ? <div className="taskdesk-control__toast" role="status">{toast}</div> : null}
    </div>
  );
}
