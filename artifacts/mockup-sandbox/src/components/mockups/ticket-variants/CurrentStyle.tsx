const tickets = [
  { id: 1, num: 42, title: 'Stampante non stampa in ufficio contabilità', category: 'Hardware', status: 'open', priority: 'urgent', assignee: 'Laura B.', date: '22/07', dueAt: null },
  { id: 2, num: 38, title: 'PC banco cassa lento all\'avvio', category: 'Software', status: 'in_progress', priority: 'high', assignee: 'Mario R.', date: '21/07', dueAt: '25/07' },
  { id: 3, num: 35, title: 'Problema connessione VPN da remoto', category: 'Rete', status: 'waiting', priority: 'medium', assignee: 'Laura B.', date: '20/07', dueAt: null },
  { id: 4, num: 31, title: 'Aggiornamento antivirus su postazioni', category: 'Sicurezza', status: 'resolved', priority: 'low', assignee: 'Mario R.', date: '18/07', dueAt: null },
  { id: 5, num: 29, title: 'Schermo flickering monitor sala riunioni', category: 'Hardware', status: 'open', priority: 'medium', assignee: null, date: '17/07', dueAt: null },
];

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Aperto',      bg: '#1976d2', color: '#fff' },
  in_progress: { label: 'In corso',   bg: '#ed6c02', color: '#fff' },
  waiting:     { label: 'In attesa',  bg: '#9c27b0', color: '#fff' },
  resolved:    { label: 'Risolto',    bg: '#2e7d32', color: '#fff' },
  closed:      { label: 'Chiuso',     bg: '#616161', color: '#fff' },
};

const priorityMap: Record<string, { label: string; border: string; color: string }> = {
  urgent: { label: 'Urgente', border: '#d32f2f', color: '#d32f2f' },
  high:   { label: 'Alta',    border: '#ed6c02', color: '#ed6c02' },
  medium: { label: 'Media',   border: '#1976d2', color: '#1976d2' },
  low:    { label: 'Bassa',   border: '#757575', color: '#757575' },
};

function Avatar({ name }: { name: string }) {
  const colors = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c62828','#00838f'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const bg = colors[Math.abs(h) % colors.length];
  const initials = name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  return (
    <span style={{ width:24, height:24, borderRadius:'50%', background:bg, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', fontWeight:700, flexShrink:0 }}>
      {initials}
    </span>
  );
}

export function CurrentStyle() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>#</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>TITOLO</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>CATEGORIA</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>STATO</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>PRIORITÀ</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>ASSEGNATO</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#616161', fontSize:'0.75rem', letterSpacing:'0.02em' }}>DATA</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t, i) => {
              const s = statusMap[t.status];
              const p = priorityMap[t.priority];
              return (
                <tr key={t.id} style={{ borderBottom: i < tickets.length-1 ? '1px solid #f0f0f0' : 'none', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px', color:'#616161', fontWeight:700, fontSize:'0.8rem', whiteSpace:'nowrap' }}>#{t.num}</td>
                  <td style={{ padding: '8px', maxWidth:220 }}>
                    <span style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35 }}>{t.title}</span>
                  </td>
                  <td style={{ padding: '8px', color:'#424242', whiteSpace:'nowrap' }}>{t.category}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ background:s.bg, color:s.color, borderRadius:12, padding:'2px 8px', fontSize:'0.72rem', fontWeight:500, whiteSpace:'nowrap' }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ border:`1px solid ${p.border}`, color:p.color, borderRadius:12, padding:'2px 8px', fontSize:'0.72rem', fontWeight:500, background:'transparent', whiteSpace:'nowrap' }}>{p.label}</span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {t.assignee
                      ? <span style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar name={t.assignee} /><span style={{ fontSize:'0.8rem', color:'#424242' }}>{t.assignee}</span></span>
                      : <span style={{ color:'#bdbdbd' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px', color:'#9e9e9e', fontSize:'0.8rem', whiteSpace:'nowrap' }}>{t.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
