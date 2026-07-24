const tickets = [
  { id: 1, num: 42, title: 'Stampante non stampa in ufficio contabilità', category: 'Hardware', status: 'open', priority: 'urgent', assignee: 'Laura B.', date: '22/07', dueAt: '23/07' },
  { id: 2, num: 38, title: 'PC banco cassa lento all\'avvio', category: 'Software', status: 'in_progress', priority: 'high', assignee: 'Mario R.', date: '21/07', dueAt: '25/07' },
  { id: 3, num: 35, title: 'Problema connessione VPN da remoto', category: 'Rete', status: 'waiting', priority: 'medium', assignee: 'Laura B.', date: '20/07', dueAt: null },
  { id: 4, num: 31, title: 'Aggiornamento antivirus su postazioni', category: 'Sicurezza', status: 'resolved', priority: 'low', assignee: 'Mario R.', date: '18/07', dueAt: null },
  { id: 5, num: 29, title: 'Schermo flickering monitor sala riunioni', category: 'Hardware', status: 'open', priority: 'medium', assignee: null, date: '17/07', dueAt: null },
];

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Aperto',     bg: '#e3f0fd', color: '#1565c0' },
  in_progress: { label: 'In corso',  bg: '#fff3e0', color: '#e65100' },
  waiting:     { label: 'In attesa', bg: '#f3e5f5', color: '#6a1b9a' },
  resolved:    { label: 'Risolto',   bg: '#e8f5e9', color: '#1b5e20' },
  closed:      { label: 'Chiuso',    bg: '#f5f5f5', color: '#424242' },
};

const priorityMeta: Record<string, { label: string; bar: string; dot: string; rowBg?: string }> = {
  urgent: { label: 'Urgente', bar: '#d32f2f', dot: '#d32f2f', rowBg: 'rgba(211,47,47,0.04)' },
  high:   { label: 'Alta',    bar: '#e64a19', dot: '#e64a19' },
  medium: { label: 'Media',   bar: '#1976d2', dot: '#1976d2' },
  low:    { label: 'Bassa',   bar: '#9e9e9e', dot: '#9e9e9e' },
};

function Avatar({ name }: { name: string }) {
  const colors = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c62828','#00838f'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const bg = colors[Math.abs(h) % colors.length];
  const initials = name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  return (
    <span style={{ width:26, height:26, borderRadius:'50%', background:bg, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, flexShrink:0 }}>
      {initials}
    </span>
  );
}

export function PriorityBar() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eeeeee', background: '#fafafa' }}>
              <th style={{ width:4 }} />
              <th style={{ padding: '10px 6px 10px 12px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>#</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Titolo</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Categoria</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Stato</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Priorità</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Assegnato</th>
              <th style={{ padding: '10px 12px 10px 8px', textAlign: 'left', fontWeight: 600, color: '#9e9e9e', fontSize:'0.68rem', letterSpacing:'0.06em', textTransform:'uppercase' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t, i) => {
              const s = statusMap[t.status];
              const p = priorityMeta[t.priority];
              const isUrgent = t.priority === 'urgent';
              return (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: i < tickets.length-1 ? '1px solid #f5f5f5' : 'none',
                    cursor: 'pointer',
                    background: p.rowBg ?? 'transparent',
                    transition: 'box-shadow 0.15s, background 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
                    e.currentTarget.style.background = isUrgent ? 'rgba(211,47,47,0.07)' : '#f9f9f9';
                    e.currentTarget.style.zIndex = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = p.rowBg ?? 'transparent';
                    e.currentTarget.style.zIndex = 'auto';
                  }}
                >
                  {/* Priority bar */}
                  <td style={{ width: 4, padding: 0 }}>
                    <div style={{ width: 4, height: '100%', minHeight: 44, background: p.bar, borderRadius: '0 0 0 0' }} />
                  </td>
                  <td style={{ padding: '10px 6px 10px 12px', color:'#9e9e9e', fontWeight:700, fontSize:'0.75rem', whiteSpace:'nowrap' }}>#{t.num}</td>
                  <td style={{ padding: '10px 8px', maxWidth: 230 }}>
                    <span style={{
                      display: 'block',
                      fontWeight: isUrgent ? 600 : 500,
                      fontSize: '0.9rem',
                      color: '#212121',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{t.title}</span>
                    {isUrgent && (
                      <span style={{ fontSize: '0.7rem', color: '#d32f2f', fontWeight: 600 }}>⚠ Scadenza: {t.dueAt}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', color:'#616161', fontSize:'0.82rem', whiteSpace:'nowrap' }}>{t.category}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ background:s.bg, color:s.color, borderRadius:6, padding:'3px 10px', fontSize:'0.72rem', fontWeight:600, whiteSpace:'nowrap' }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:p.dot, fontSize:'0.8rem', fontWeight:600 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:p.dot, flexShrink:0 }} />
                      {p.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {t.assignee
                      ? <span style={{ display:'flex', alignItems:'center', gap:7 }}><Avatar name={t.assignee} /><span style={{ fontSize:'0.8rem', color:'#424242' }}>{t.assignee}</span></span>
                      : <span style={{ color:'#bdbdbd' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px 10px 8px', color:'#9e9e9e', fontSize:'0.78rem', whiteSpace:'nowrap' }}>{t.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
