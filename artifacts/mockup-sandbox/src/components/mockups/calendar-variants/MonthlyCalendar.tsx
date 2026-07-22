const TODAY = 22; // July 22 2026

// July 2026: starts on Wednesday (index 2, Mon=0)
const MONTH_START_DOW = 2;
const MONTH_DAYS = 31;

const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

interface Ticket {
  num: number;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assignee: string | null;
  dueDay: number | null;
}

const TICKETS: Ticket[] = [
  { num: 25, title: 'Aggiornamento firmware router',  priority: 'low',    assignee: 'Paolo M.', dueDay: 3  },
  { num: 30, title: 'Rete lenta reparto magazzino',   priority: 'urgent', assignee: 'Laura B.', dueDay: 8  },
  { num: 28, title: 'Licenza software scaduta',       priority: 'high',   assignee: 'Mario R.', dueDay: 11 },
  { num: 27, title: 'Backup dati mensile',            priority: 'medium', assignee: 'Anna V.',  dueDay: 14 },
  { num: 36, title: 'Reset password utenti reparto',  priority: 'low',    assignee: 'Anna V.',  dueDay: 15 },
  { num: 33, title: 'Monitor guasto sala meeting',    priority: 'high',   assignee: 'Paolo M.', dueDay: 18 },
  { num: 44, title: 'Server backup notturno fallito', priority: 'urgent', assignee: 'Anna V.',  dueDay: 22 },
  { num: 42, title: 'Stampante non stampa contab.',   priority: 'urgent', assignee: 'Laura B.', dueDay: 23 },
  { num: 37, title: 'Email spam — filtro da rivedere',priority: 'high',   assignee: 'Mario R.', dueDay: 24 },
  { num: 38, title: 'PC banco cassa lento avvio',     priority: 'high',   assignee: 'Mario R.', dueDay: 25 },
  { num: 41, title: 'Aggiornamento Windows postaz.',  priority: 'medium', assignee: 'Paolo M.', dueDay: 28 },
  { num: 39, title: 'Nuova postazione reparto HR',    priority: 'low',    assignee: 'Laura B.', dueDay: 30 },
  // No due date
  { num: 35, title: 'Problema connessione VPN remoto', priority: 'medium', assignee: 'Laura B.', dueDay: null },
  { num: 31, title: 'Aggiornamento antivirus postaz.',  priority: 'low',    assignee: 'Mario R.', dueDay: null },
  { num: 29, title: 'Schermo flickering sala riunioni', priority: 'medium', assignee: null,       dueDay: null },
  { num: 26, title: 'Accesso CRM negato a 3 utenti',   priority: 'high',   assignee: 'Anna V.',  dueDay: null },
  { num: 23, title: 'Cavo rete danneggiato piano 3',   priority: 'low',    assignee: 'Mario R.', dueDay: null },
];

const PRIORITY_CHIP: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  urgent: { bg: '#fde8e8', color: '#b71c1c', dot: '#ef5350', label: 'Urgente' },
  high:   { bg: '#fff3e0', color: '#bf360c', dot: '#ff7043', label: 'Alta'    },
  medium: { bg: '#e3f2fd', color: '#0d47a1', dot: '#1e88e5', label: 'Media'   },
  low:    { bg: '#f5f5f5', color: '#424242', dot: '#bdbdbd', label: 'Bassa'   },
};

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarBg(name: string) {
  const palette = ['#1565c0','#2e7d32','#f57c00','#7b1fa2','#c62828','#00838f','#ad1457'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function TicketChip({ t }: { t: Ticket }) {
  const p = PRIORITY_CHIP[t.priority];
  return (
    <div style={{
      background: p.bg, borderRadius: 5, padding: '3px 6px 3px 5px',
      marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 10, lineHeight: 1.3, overflow: 'hidden',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
      <span style={{ color: '#555', fontWeight: 700, flexShrink: 0 }}>#{t.num}</span>
      <span style={{ color: p.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
        {t.title}
      </span>
      {t.assignee && (
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          background: avatarBg(t.assignee), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 800, flexShrink: 0,
        }}>
          {initials(t.assignee)}
        </span>
      )}
    </div>
  );
}

function buildCalendarGrid(): (number | null)[][] {
  const cells: (number | null)[] = [];
  for (let i = 0; i < MONTH_START_DOW; i++) cells.push(null);
  for (let d = 1; d <= MONTH_DAYS; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function MonthlyCalendar() {
  const weeks = buildCalendarGrid();
  const byDay: Record<number, Ticket[]> = {};
  const noDue: Ticket[] = [];
  for (const t of TICKETS) {
    if (t.dueDay) {
      if (!byDay[t.dueDay]) byDay[t.dueDay] = [];
      byDay[t.dueDay].push(t);
    } else {
      noDue.push(t);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#f8faff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#0f62fe', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', flex: 1 }}>
          Luglio 2026
        </h1>
        <button style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
          {(['urgent','high','medium','low'] as const).map(p => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: 11, opacity: 0.9 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_CHIP[p].dot, display: 'inline-block' }} />
              {PRIORITY_CHIP[p].label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Body: calendar + sidebar ── */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>

        {/* Calendar grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '0 0 12px 0' }}>

          {/* Day-of-week header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fff', borderBottom: '1px solid #e8eaed' }}>
            {DAYS_IT.map((d, i) => (
              <div key={d} style={{
                padding: '8px 0', textAlign: 'center',
                fontSize: 11, fontWeight: 700, color: i >= 5 ? '#0f62fe' : '#616161',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                borderRight: i < 6 ? '1px solid #f0f0f0' : 'none',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                flex: 1, borderBottom: wi < weeks.length - 1 ? '1px solid #e8eaed' : 'none',
              }}>
                {week.map((day, di) => {
                  const tickets = day ? (byDay[day] ?? []) : [];
                  const isToday = day === TODAY;
                  const isPast = day !== null && day < TODAY;
                  const isWeekend = di >= 5;
                  return (
                    <div key={di} style={{
                      borderRight: di < 6 ? '1px solid #e8eaed' : 'none',
                      background: !day ? '#fafafa' : isWeekend ? '#fafcff' : '#fff',
                      padding: '6px 5px 5px',
                      minHeight: 100,
                      display: 'flex', flexDirection: 'column',
                      opacity: !day ? 0.4 : 1,
                    }}>
                      {day && (
                        <>
                          {/* Day number */}
                          <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: isToday ? '#0f62fe' : 'transparent',
                              color: isToday ? '#fff' : isPast ? '#bdbdbd' : '#212121',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: isToday ? 800 : 600,
                            }}>
                              {day}
                            </span>
                            {tickets.length > 0 && (
                              <span style={{ fontSize: 9, color: '#9e9e9e', fontWeight: 600 }}>
                                {tickets.length} tk
                              </span>
                            )}
                          </div>
                          {/* Ticket chips */}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            {tickets.slice(0, 3).map(t => <TicketChip key={t.num} t={t} />)}
                            {tickets.length > 3 && (
                              <div style={{ fontSize: 9, color: '#9e9e9e', fontWeight: 600, paddingLeft: 4 }}>
                                +{tickets.length - 3} altro
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Senza scadenza sidebar */}
        <div style={{ width: 200, flexShrink: 0, borderLeft: '1px solid #e8eaed', background: '#fff', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Senza scadenza
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#bdbdbd' }}>{noDue.length} ticket</p>
          </div>
          <div style={{ padding: '8px 8px' }}>
            {noDue.map(t => {
              const p = PRIORITY_CHIP[t.priority];
              return (
                <div key={t.num} style={{
                  background: p.bg, borderRadius: 6, padding: '6px 8px',
                  marginBottom: 6, borderLeft: `3px solid ${p.dot}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9e9e' }}>#{t.num}</span>
                    <span style={{ fontSize: 9, color: p.color, fontWeight: 700, background: '#fff', borderRadius: 10, padding: '0 5px' }}>
                      {p.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: p.color, fontWeight: 500, lineHeight: 1.4 }}>
                    {t.title}
                  </p>
                  {t.assignee && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: avatarBg(t.assignee), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 6, fontWeight: 800, flexShrink: 0,
                      }}>
                        {initials(t.assignee)}
                      </span>
                      <span style={{ fontSize: 9, color: '#757575' }}>{t.assignee}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
