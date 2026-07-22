import { useState } from 'react';

const categories = ['Hardware', 'Software', 'Rete', 'Accessi', 'Altro'];
const priorities = [
  { value: 'low', label: 'Bassa', color: '#43a047', bg: '#f1f8f1' },
  { value: 'medium', label: 'Media', color: '#fb8c00', bg: '#fff8f0' },
  { value: 'high', label: 'Alta', color: '#e53935', bg: '#fff0f0' },
  { value: 'urgent', label: 'Urgente', color: '#b71c1c', bg: '#fce4ec' },
];
const users = ['Laura B.', 'Mario R.', 'Anna V.', 'Paolo M.'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e8e8e8',
  fontSize: 14, color: '#212121', background: '#fff', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
};

function Section({ number, title, subtitle, open, onToggle, children }: {
  number: number; title: string; subtitle: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: open ? '#1565c0' : '#f0f4ff', color: open ? '#fff' : '#1565c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {number}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: open ? '#1565c0' : '#212121' }}>{title}</div>
          {!open && <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 1 }}>{subtitle}</div>}
        </div>
        <span style={{ color: '#bbb', fontSize: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f5f5f5' }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {text}{required && <span style={{ color: '#e53935' }}> *</span>}
    </label>
  );
}

export default function CardSections() {
  const [openSection, setOpenSection] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('medium');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');

  const toggle = (n: number) => setOpenSection(openSection === n ? 0 : n);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fafafa', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#9e9e9e', marginBottom: 8 }}>← Torna ai ticket</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.01em' }}>Apri nuovo ticket</h1>
        </div>

        {/* Section 1: Description */}
        <Section
          number={1}
          title="Descrivi il problema"
          subtitle={title || 'Oggetto e descrizione del problema'}
          open={openSection === 1}
          onToggle={() => toggle(1)}
        >
          <div style={{ marginBottom: 16 }}>
            <Label text="Oggetto" required />
            <input style={inputStyle} placeholder="Es. Stampante offline al secondo piano" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label text="Descrizione" required />
            <textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.65 }} placeholder="Descrivi il problema in dettaglio…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => toggle(2)}
              disabled={!title.trim()}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: title.trim() ? '#1565c0' : '#e0e0e0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'not-allowed' }}
            >
              Avanti →
            </button>
          </div>
        </Section>

        {/* Section 2: Classify */}
        <Section
          number={2}
          title="Classifica"
          subtitle={`${category} · ${priorities.find(p => p.value === priority)?.label ?? ''}`}
          open={openSection === 2}
          onToggle={() => toggle(2)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <Label text="Categoria" required />
              <select style={{ ...inputStyle }} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label text="Sede" />
              <select style={inputStyle} value={location} onChange={e => setLocation(e.target.value)}>
                {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label text="Priorità" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {priorities.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: priority === p.value ? 700 : 400,
                    border: `1.5px solid ${priority === p.value ? p.color : '#e8e8e8'}`,
                    background: priority === p.value ? p.bg : '#fff',
                    color: priority === p.value ? p.color : '#616161',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label text="Scadenza" />
            <input type="datetime-local" style={inputStyle} value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => toggle(3)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Avanti →
            </button>
          </div>
        </Section>

        {/* Section 3: Assign */}
        <Section
          number={3}
          title="Assegna"
          subtitle={assignee || 'Nessun operatore selezionato'}
          open={openSection === 3}
          onToggle={() => toggle(3)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {users.map(u => (
              <div
                key={u}
                onClick={() => setAssignee(assignee === u ? '' : u)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${assignee === u ? '#1565c0' : '#efefef'}`, background: assignee === u ? '#f0f4ff' : '#fafafa', cursor: 'pointer' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1565c0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{u.charAt(0)}</div>
                <span style={{ fontSize: 14, fontWeight: assignee === u ? 700 : 400, color: assignee === u ? '#1565c0' : '#212121' }}>{u}</span>
                {assignee === u && <span style={{ marginLeft: 'auto', color: '#1565c0' }}>✓</span>}
              </div>
            ))}
          </div>
        </Section>

        {/* Submit */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#1565c0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Apri ticket
          </button>
          <button style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #efefef', background: '#fff', color: '#757575', fontSize: 14, cursor: 'pointer' }}>
            Annulla
          </button>
        </div>

      </div>
    </div>
  );
}
