import { useState } from 'react';

const CATEGORIES = [
  { id: 'hardware', label: 'Hardware', icon: '🖥️', desc: 'PC, stampanti, periferiche' },
  { id: 'software', label: 'Software', icon: '💿', desc: 'App, licenze, aggiornamenti' },
  { id: 'rete', label: 'Rete', icon: '📡', desc: 'Connettività, VPN, WiFi' },
  { id: 'accessi', label: 'Accessi', icon: '🔑', desc: 'Account, password, permessi' },
  { id: 'altro', label: 'Altro', icon: '📋', desc: 'Richieste generiche' },
];

const PRIORITIES = [
  { value: 'low', label: 'Bassa', color: '#43a047', bg: '#f1f8f1', desc: 'Entro la settimana' },
  { value: 'medium', label: 'Media', color: '#fb8c00', bg: '#fff8f0', desc: 'Entro 2-3 giorni' },
  { value: 'high', label: 'Alta', color: '#e53935', bg: '#fff0f0', desc: 'Entro oggi' },
  { value: 'urgent', label: 'Urgente', color: '#b71c1c', bg: '#fce4ec', desc: 'Subito' },
];

const USERS = [
  { name: 'Laura B.', open: 3, color: '#1565c0' },
  { name: 'Mario R.', open: 5, color: '#6a1b9a' },
  { name: 'Anna V.', open: 1, color: '#00695c' },
  { name: 'Paolo M.', open: 7, color: '#e65100' },
];

type Step = 'content' | 'classify' | 'assign';

export default function VisualChips() {
  const [step, setStep] = useState<Step>('content');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');

  const steps: Step[] = ['content', 'classify', 'assign'];
  const stepIdx = steps.indexOf(step);

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, border: '2px solid #efefef',
    fontSize: 14, color: '#212121', background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#f8faff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top progress bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #efefef', padding: '14px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 600, margin: '0 auto' }}>
          {(['content', 'classify', 'assign'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { content: 'Scrivi', classify: 'Classifica', assign: 'Assegna' };
            const done = steps.indexOf(step) > i;
            const active = step === s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: done ? 'pointer' : 'default' }} onClick={() => done && setStep(s)}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: done ? '#1565c0' : active ? '#e8f0fe' : '#f5f5f5',
                    color: done ? '#fff' : active ? '#1565c0' : '#bdbdbd',
                    border: active ? '2px solid #1565c0' : 'none',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#1565c0' : done ? '#616161' : '#bdbdbd' }}>
                    {labels[s]}
                  </span>
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: done ? '#1565c0' : '#efefef', margin: '0 10px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 580 }}>

          {step === 'content' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111' }}>Di cosa hai bisogno?</h2>
              <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9e9e9e' }}>Descrivi brevemente il problema o la richiesta.</p>
              <div style={{ marginBottom: 16 }}>
                <input
                  style={{ ...inputBase, fontSize: 15, fontWeight: 500 }}
                  placeholder="Es. Stampante non risponde al secondo piano…"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div>
                <textarea
                  style={{ ...inputBase, minHeight: 130, resize: 'vertical', lineHeight: 1.7 }}
                  placeholder="Aggiungi dettagli: da quando, quali dispositivi, cosa hai già provato…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <button
                onClick={() => setStep('classify')}
                disabled={!title.trim()}
                style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: title.trim() ? '#1565c0' : '#e0e0e0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: title.trim() ? 'pointer' : 'not-allowed' }}
              >
                Continua →
              </button>
            </>
          )}

          {step === 'classify' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111' }}>Di che tipo si tratta?</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9e9e' }}>Seleziona la categoria e la priorità.</p>

              {/* Category cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {CATEGORIES.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${category === c.id ? '#1565c0' : '#e8e8e8'}`,
                      background: category === c.id ? '#e8f0fe' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: category === c.id ? '#1565c0' : '#212121', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: '#9e9e9e', lineHeight: 1.4 }}>{c.desc}</div>
                  </div>
                ))}
              </div>

              {/* Priority */}
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Urgenza</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {PRIORITIES.map(p => (
                  <div
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    style={{
                      padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `2px solid ${priority === p.value ? p.color : '#e8e8e8'}`,
                      background: priority === p.value ? p.bg : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: priority === p.value ? p.color : '#212121', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: '#9e9e9e' }}>{p.desc}</div>
                  </div>
                ))}
              </div>

              {/* Location */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sede</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => (
                    <button
                      key={l}
                      onClick={() => setLocation(l)}
                      style={{
                        padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: location === l ? 700 : 400,
                        border: `1.5px solid ${location === l ? '#1565c0' : '#e8e8e8'}`,
                        background: location === l ? '#e8f0fe' : '#fff',
                        color: location === l ? '#1565c0' : '#616161',
                      }}
                    >
                      {l.replace('Sede ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('content')} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #efefef', background: '#fff', fontSize: 13, color: '#616161', cursor: 'pointer' }}>← Indietro</button>
                <button
                  onClick={() => setStep('assign')}
                  disabled={!category || !priority}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: category && priority ? '#1565c0' : '#e0e0e0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: category && priority ? 'pointer' : 'not-allowed' }}
                >
                  Continua →
                </button>
              </div>
            </>
          )}

          {step === 'assign' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111' }}>A chi lo assegniamo?</h2>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9e9e' }}>Puoi anche lasciare non assegnato e farlo dopo.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {USERS.map(u => (
                  <div
                    key={u.name}
                    onClick={() => setAssignee(assignee === u.name ? '' : u.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${assignee === u.name ? u.color : '#efefef'}`,
                      background: assignee === u.name ? u.color + '12' : '#fff',
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {u.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: assignee === u.name ? 700 : 500, color: assignee === u.name ? u.color : '#212121' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#9e9e9e', marginTop: 1 }}>{u.open} ticket aperti</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${assignee === u.name ? u.color : '#e0e0e0'}`, background: assignee === u.name ? u.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {assignee === u.name && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Due date */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scadenza (opzionale)</p>
                <input type="date" style={{ ...inputBase }} value={dueAt} onChange={e => setDueAt(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('classify')} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #efefef', background: '#fff', fontSize: 13, color: '#616161', cursor: 'pointer' }}>← Indietro</button>
                <button style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Apri ticket ✓
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
