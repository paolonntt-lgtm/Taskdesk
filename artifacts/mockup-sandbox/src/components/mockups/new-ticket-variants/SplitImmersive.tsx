import { useState } from 'react';

const categories = ['Hardware', 'Software', 'Rete', 'Accessi', 'Altro'];
const priorities = [
  { value: 'low', label: 'Bassa', dot: '#43a047' },
  { value: 'medium', label: 'Media', dot: '#fb8c00' },
  { value: 'high', label: 'Alta', dot: '#e53935' },
  { value: 'urgent', label: 'Urgente', dot: '#b71c1c' },
];
const users = [
  { name: 'Laura B.', open: 3 },
  { name: 'Mario R.', open: 5 },
  { name: 'Anna V.', open: 1 },
  { name: 'Paolo M.', open: 7 },
];

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

export default function SplitImmersive() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('medium');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');
  const [focusDesc, setFocusDesc] = useState(false);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', height: '100vh', background: '#0f172a', color: '#e2e8f0' }}>

      {/* LEFT — immersive writing panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 36px', minWidth: 0, borderRight: '1px solid #1e293b' }}>

        {/* Back link */}
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 28, cursor: 'pointer' }}>← Torna ai ticket</div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titolo del ticket…"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 20,
            fontFamily: 'Inter, system-ui, sans-serif', width: '100%',
          }}
        />

        {/* Divider */}
        <div style={{ height: 1, background: '#1e293b', marginBottom: 20 }} />

        {/* Description — full area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setFocusDesc(true)}
            onBlur={() => setFocusDesc(false)}
            placeholder="Descrivi il problema in dettaglio. Puoi usare markdown per formattare il testo…"
            style={{
              width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              fontSize: 14, lineHeight: 1.8, color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          {!description && !focusDesc && (
            <div style={{ position: 'absolute', bottom: 12, left: 0, display: 'flex', gap: 6, pointerEvents: 'none' }}>
              {['B', 'I', '`', '—', '🔗'].map(t => (
                <span key={t} style={{ fontSize: 11, color: '#334155', background: '#1e293b', borderRadius: 4, padding: '2px 7px' }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Attachments bar */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#475569' }}>📎 Allega file</span>
          <span style={{ fontSize: 11, color: '#334155' }}>·</span>
          <span style={{ fontSize: 11, color: '#475569' }}>☑ Aggiungi checklist</span>
        </div>
      </div>

      {/* RIGHT — metadata sidebar */}
      <div style={{ width: 230, flexShrink: 0, padding: '32px 20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        <p style={{ margin: '0 0 24px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' }}>
          Proprietà
        </p>

        <MetaRow label="Categoria">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }}
          >
            {categories.map(c => <option key={c} style={{ background: '#1e293b' }}>{c}</option>)}
          </select>
        </MetaRow>

        <MetaRow label="Priorità">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {priorities.map(p => (
              <div
                key={p.value}
                onClick={() => setPriority(p.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: priority === p.value ? '#1e293b' : 'transparent' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.dot, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: priority === p.value ? '#f1f5f9' : '#64748b', fontWeight: priority === p.value ? 600 : 400 }}>{p.label}</span>
                {priority === p.value && <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 11 }}>✓</span>}
              </div>
            ))}
          </div>
        </MetaRow>

        <MetaRow label="Sede">
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%' }}
          >
            {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => <option key={l} style={{ background: '#1e293b' }}>{l}</option>)}
          </select>
        </MetaRow>

        <MetaRow label="Scadenza">
          <input
            type="date"
            value={dueAt}
            onChange={e => setDueAt(e.target.value)}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: dueAt ? '#e2e8f0' : '#475569', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        </MetaRow>

        <MetaRow label="Assegna a">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {users.map(u => (
              <div
                key={u.name}
                onClick={() => setAssignee(assignee === u.name ? '' : u.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: assignee === u.name ? '#1e293b' : 'transparent' }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1d4ed8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                  {u.name.charAt(0)}
                </div>
                <span style={{ fontSize: 12, flex: 1, color: assignee === u.name ? '#f1f5f9' : '#64748b', fontWeight: assignee === u.name ? 600 : 400 }}>{u.name}</span>
                <span style={{ fontSize: 10, color: '#334155' }}>{u.open}</span>
              </div>
            ))}
          </div>
        </MetaRow>

        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <button style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
            Apri ticket
          </button>
          <button style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #1e293b', background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer' }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
