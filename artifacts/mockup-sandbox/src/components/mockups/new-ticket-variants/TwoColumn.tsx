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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e8e8e8',
  fontSize: 14, color: '#212121', background: '#fff', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
};

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

export default function TwoColumn() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('medium');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fafafa', minHeight: '100vh' }}>

      {/* Minimal top bar */}
      <div style={{ padding: '11px 28px', borderBottom: '1px solid #efefef', background: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#9e9e9e' }}>← Ticket</span>
        <span style={{ color: '#e0e0e0' }}>/</span>
        <span style={{ fontSize: 13, color: '#212121', fontWeight: 600 }}>Nuovo ticket</span>
      </div>

      <div style={{ display: 'flex', maxWidth: 960, margin: '0 auto', padding: '24px 20px', gap: 28, alignItems: 'flex-start' }}>

        {/* LEFT: main fields */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Oggetto *</label>
            <input
              style={{ ...inputStyle, fontSize: 16, fontWeight: 600, padding: '12px 14px' }}
              placeholder="Es. Stampante offline al secondo piano…"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* AI suggest hint */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, height: 22 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>✦ Scrivi la descrizione per suggerire automaticamente il titolo</span>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Descrizione *</label>
            <textarea
              style={{ ...inputStyle, minHeight: 180, resize: 'vertical', lineHeight: 1.7 }}
              placeholder="Descrivi il problema in dettaglio: quando è iniziato, quali dispositivi coinvolge, cosa hai già provato…"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            {/* Toolbar mock */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {['B', 'I', 'U', '🔗', '📎'].map(b => (
                <button key={b} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #efefef', background: '#fff', fontSize: 12, color: '#757575', cursor: 'pointer' }}>{b}</button>
              ))}
            </div>
          </div>

          {/* Checklist hint */}
          <div style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px dashed #e0e0e0', color: '#9e9e9e', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>☑</span> Aggiungi checklist al ticket
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 20, background: '#fff', border: '1px solid #efefef', borderRadius: 12, padding: '16px 16px 8px' }}>
            <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Dettagli ticket</p>

            <SideField label="Categoria">
              <select style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </SideField>

            <SideField label="Priorità">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {priorities.map(p => (
                  <div
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: priority === p.value ? '#f0f4ff' : 'transparent' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: priority === p.value ? 700 : 400, color: priority === p.value ? '#1565c0' : '#424242' }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </SideField>

            <SideField label="Sede">
              <select style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }} value={location} onChange={e => setLocation(e.target.value)}>
                {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => <option key={l}>{l}</option>)}
              </select>
            </SideField>

            <SideField label="Scadenza">
              <input type="date" style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }} value={dueAt.slice(0, 10)} onChange={e => setDueAt(e.target.value)} />
            </SideField>

            <SideField label="Assegna a">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {users.map(u => (
                  <div
                    key={u.name}
                    onClick={() => setAssignee(assignee === u.name ? '' : u.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', background: assignee === u.name ? '#f0f4ff' : 'transparent' }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1565c0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                      {u.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: 12, flex: 1, color: assignee === u.name ? '#1565c0' : '#424242', fontWeight: assignee === u.name ? 700 : 400 }}>{u.name}</span>
                    <span style={{ fontSize: 10, color: '#bbb' }}>{u.open}</span>
                  </div>
                ))}
              </div>
            </SideField>

            <div style={{ marginTop: 4, paddingTop: 4 }}>
              <button
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Apri ticket
              </button>
              <button style={{ width: '100%', marginTop: 6, padding: '8px', borderRadius: 8, border: '1px solid #efefef', background: '#fff', color: '#757575', fontSize: 12, cursor: 'pointer' }}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
