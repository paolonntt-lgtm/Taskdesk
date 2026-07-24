const tickets = [
  { id: 1, num: 42, title: 'Stampante non stampa in ufficio contabilità', desc: 'La stampante HP sul secondo piano non risponde ai comandi di stampa da nessun PC.', category: 'Hardware', status: 'open', priority: 'urgent', assignee: 'Laura B.', date: '22 lug', dueAt: '23 lug' },
  { id: 2, num: 38, title: 'PC banco cassa lento all\'avvio', desc: 'Avvio richiede oltre 5 minuti, disco quasi pieno, Windows Update bloccato.', category: 'Software', status: 'in_progress', priority: 'high', assignee: 'Mario R.', date: '21 lug', dueAt: '25 lug' },
  { id: 3, num: 35, title: 'Problema connessione VPN da remoto', desc: 'Tre utenti non riescono a connettersi alla VPN aziendale da casa.', category: 'Rete', status: 'waiting', priority: 'medium', assignee: 'Laura B.', date: '20 lug', dueAt: null },
  { id: 4, num: 31, title: 'Aggiornamento antivirus su postazioni', desc: 'Pianificare aggiornamento firme antivirus su 12 postazioni reparto.', category: 'Sicurezza', status: 'resolved', priority: 'low', assignee: 'Mario R.', date: '18 lug', dueAt: null },
  { id: 5, num: 29, title: 'Schermo flickering monitor sala riunioni', desc: 'Il monitor principale della sala riunioni presenta sfarfallio intermittente.', category: 'Hardware', status: 'open', priority: 'medium', assignee: null, date: '17 lug', dueAt: null },
];

const statusMap: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  open:        { label: 'Aperto',     bg: '#e3f0fd', color: '#1565c0', dot: '#1976d2' },
  in_progress: { label: 'In corso',  bg: '#fff3e0', color: '#e65100', dot: '#f57c00' },
  waiting:     { label: 'In attesa', bg: '#f3e5f5', color: '#6a1b9a', dot: '#9c27b0' },
  resolved:    { label: 'Risolto',   bg: '#e8f5e9', color: '#1b5e20', dot: '#388e3c' },
  closed:      { label: 'Chiuso',    bg: '#f5f5f5', color: '#424242', dot: '#757575' },
};

const priorityMeta: Record<string, { label: string; bar: string; dot: string; urgentBg?: string }> = {
  urgent: { label: 'Urgente', bar: '#d32f2f', dot: '#d32f2f', urgentBg: 'rgba(211,47,47,0.05)' },
  high:   { label: 'Alta',    bar: '#e64a19', dot: '#e64a19' },
  medium: { label: 'Media',   bar: '#1976d2', dot: '#1976d2' },
  low:    { label: 'Bassa',   bar: '#9e9e9e', dot: '#bdbdbd' },
};

function Avatar({ name }: { name: string }) {
  const colors = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c62828','#00838f'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const bg = colors[Math.abs(h) % colors.length];
  const initials = name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  return (
    <span style={{ width:28, height:28, borderRadius:'50%', background:bg, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700, flexShrink:0 }}>
      {initials}
    </span>
  );
}

export function RichCards() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', background: '#f0f2f5', minHeight: '100vh', padding: '20px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tickets.map((t) => {
          const s = statusMap[t.status];
          const p = priorityMeta[t.priority];
          const isUrgent = t.priority === 'urgent';
          return (
            <div
              key={t.id}
              style={{
                background: p.urgentBg ?? '#ffffff',
                borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                borderLeft: `4px solid ${p.bar}`,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, transform 0.1s',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Top row: number + title + category badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#9e9e9e', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0, marginTop: 2 }}>#{t.num}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: '#1a1a2e',
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{t.title}</span>
                  <span style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    color: '#757575',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{t.desc}</span>
                </div>
                <span style={{ background:'#f5f5f5', color:'#616161', borderRadius:6, padding:'2px 8px', fontSize:'0.68rem', fontWeight:500, flexShrink:0, whiteSpace:'nowrap' }}>{t.category}</span>
              </div>

              {/* Bottom row: status | priority dot | due date | assignee */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* Status pill */}
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, borderRadius:20, padding:'3px 10px', fontSize:'0.72rem', fontWeight:600 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, flexShrink:0 }} />
                  {s.label}
                </span>

                {/* Priority dot */}
                <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:p.dot, fontSize:'0.78rem', fontWeight:600 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:p.dot, flexShrink:0 }} />
                  {p.label}
                </span>

                {/* Due date */}
                {t.dueAt && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, color: isUrgent ? '#d32f2f' : '#757575', fontSize:'0.75rem', fontWeight: isUrgent ? 600 : 400 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {t.dueAt}
                  </span>
                )}

                {/* Spacer */}
                <span style={{ flex: 1 }} />

                {/* Assignee */}
                {t.assignee ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'#616161', fontSize:'0.8rem' }}>
                    <Avatar name={t.assignee} />
                    {t.assignee}
                  </span>
                ) : (
                  <span style={{ color:'#bdbdbd', fontSize:'0.78rem', fontStyle:'italic' }}>Non assegnato</span>
                )}

                {/* Date */}
                <span style={{ color:'#bdbdbd', fontSize:'0.75rem', whiteSpace:'nowrap' }}>{t.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
