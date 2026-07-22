import { useState } from 'react';

const categories = ['Hardware', 'Software', 'Rete', 'Accessi', 'Altro'];
const priorities = ['Bassa', 'Media', 'Alta', 'Urgente'];
const priorityColors: Record<string, string> = { Bassa: '#43a047', Media: '#fb8c00', Alta: '#e53935', Urgente: '#b71c1c' };
const users = ['Laura B.', 'Mario R.', 'Anna V.', 'Paolo M.'];

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', padding: '10px 0',
  borderBottom: '1px solid #f0f0f0',
};
const labelStyle: React.CSSProperties = {
  width: 130, flexShrink: 0, fontSize: 12, color: '#9e9e9e', fontWeight: 600,
  paddingTop: 9, lineHeight: 1,
};
const inputStyle: React.CSSProperties = {
  flex: 1, padding: '7px 10px', border: '1.5px solid #e8e8e8', borderRadius: 6,
  fontSize: 13, color: '#212121', background: '#fff', outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
};

export default function CompactPower() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('Media');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');
  const [resource, setResource] = useState('');
  const [client, setClient] = useState('');

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fafafa', minHeight: '100vh' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #efefef', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9e9e9e', cursor: 'pointer' }}>← Ticket</span>
          <span style={{ color: '#e0e0e0' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#212121' }}>Nuovo ticket</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fff', fontSize: 12, color: '#616161', cursor: 'pointer' }}>Annulla</button>
          <button style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: '#1565c0', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Apri ticket</button>
        </div>
      </div>

      {/* Form body */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 24px' }}>

        {/* Section: Contenuto */}
        <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contenuto</span>
          </div>
          <div style={{ padding: '0 16px' }}>

            <div style={rowStyle}>
              <span style={{ ...labelStyle }}>Oggetto <span style={{ color: '#e53935' }}>*</span></span>
              <input style={inputStyle} placeholder="Descrizione breve del problema" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
              <span style={{ ...labelStyle, paddingTop: 9 }}>Descrizione <span style={{ color: '#e53935' }}>*</span></span>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
                placeholder="Dettagli aggiuntivi…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Risorsa / Dispositivo</span>
              <input style={inputStyle} placeholder="Es. PC-MR-042, Stampante HP 507" value={resource} onChange={e => setResource(e.target.value)} />
            </div>

          </div>
        </div>

        {/* Section: Classificazione */}
        <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Classificazione</span>
          </div>
          <div style={{ padding: '0 16px' }}>

            <div style={rowStyle}>
              <span style={labelStyle}>Categoria <span style={{ color: '#e53935' }}>*</span></span>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={rowStyle}>
              <span style={{ ...labelStyle, paddingTop: 8 }}>Priorità</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
                {priorities.map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      padding: '5px 13px', borderRadius: 14, cursor: 'pointer', fontSize: 12, fontWeight: priority === p ? 700 : 400,
                      border: `1.5px solid ${priority === p ? priorityColors[p] : '#e8e8e8'}`,
                      background: priority === p ? priorityColors[p] + '18' : '#fff',
                      color: priority === p ? priorityColors[p] : '#757575',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={rowStyle}>
              <span style={labelStyle}>Sede</span>
              <select style={inputStyle} value={location} onChange={e => setLocation(e.target.value)}>
                {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Cliente</span>
              <input style={inputStyle} placeholder="Cerca cliente…" value={client} onChange={e => setClient(e.target.value)} />
            </div>

          </div>
        </div>

        {/* Section: Assegnazione */}
        <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assegnazione</span>
          </div>
          <div style={{ padding: '0 16px' }}>

            <div style={rowStyle}>
              <span style={labelStyle}>Assegna a</span>
              <select style={inputStyle} value={assignee} onChange={e => setAssignee(e.target.value)}>
                <option value="">— Nessuno —</option>
                {users.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>

            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={labelStyle}>Scadenza</span>
              <input type="datetime-local" style={inputStyle} value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
