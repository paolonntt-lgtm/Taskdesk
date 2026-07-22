import { useState } from 'react';

const STEPS = ['Descrizione', 'Dettagli', 'Assegna'];

const categories = ['Hardware', 'Software', 'Rete', 'Accessi', 'Altro'];
const priorities = [
  { value: 'low', label: 'Bassa', color: '#43a047' },
  { value: 'medium', label: 'Media', color: '#fb8c00' },
  { value: 'high', label: 'Alta', color: '#e53935' },
  { value: 'urgent', label: 'Urgente', color: '#b71c1c' },
];
const users = ['Laura B.', 'Mario R.', 'Anna V.', 'Paolo M.'];

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        background: done ? '#1565c0' : active ? '#fff' : '#f0f4ff',
        color: done ? '#fff' : active ? '#1565c0' : '#9e9e9e',
        border: active ? '2px solid #1565c0' : done ? 'none' : '2px solid #e0e0e0',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? '#1565c0' : done ? '#212121' : '#9e9e9e' }}>
        {STEPS[n - 1]}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ flex: 1, height: 1, background: '#e0e0e0', margin: '0 8px' }} />;
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#616161', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{required && <span style={{ color: '#e53935', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0',
  fontSize: 14, color: '#212121', background: '#fff', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
};

export default function WizardSteps() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('medium');
  const [location, setLocation] = useState('Sede Milano');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');

  const canNext1 = title.trim().length > 0 && description.trim().length > 0;
  const canNext2 = !!category;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fafafa', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#9e9e9e', marginBottom: 6 }}>← Torna ai ticket</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.01em' }}>Apri nuovo ticket</h1>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, background: '#fff', border: '1px solid #efefef', borderRadius: 12, padding: '14px 20px' }}>
          <StepDot n={1} active={step === 1} done={step > 1} />
          <Divider />
          <StepDot n={2} active={step === 2} done={step > 2} />
          <Divider />
          <StepDot n={3} active={step === 3} done={step > 3} />
        </div>

        {/* Step content */}
        <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 12, padding: '28px 28px 24px' }}>

          {step === 1 && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9e9e' }}>Passo 1 di 3 — Spiega il problema che stai riscontrando.</p>
              <Field label="Oggetto" required>
                <input
                  style={inputStyle}
                  placeholder="Es. Stampante offline al secondo piano"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </Field>
              <Field label="Descrizione" required>
                <textarea
                  style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                  placeholder="Descrivi il problema in dettaglio…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9e9e' }}>Passo 2 di 3 — Classifica il problema per smistarlo correttamente.</p>
              <Field label="Categoria" required>
                <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Priorità">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {priorities.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      style={{
                        padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${priority === p.value ? p.color : '#e0e0e0'}`,
                        background: priority === p.value ? p.color : '#fff',
                        color: priority === p.value ? '#fff' : '#616161',
                        fontSize: 13, fontWeight: priority === p.value ? 700 : 400, cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Sede">
                <select style={inputStyle} value={location} onChange={e => setLocation(e.target.value)}>
                  {['Sede Milano', 'Sede Roma', 'Sede Torino'].map(l => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Scadenza">
                <input type="datetime-local" style={inputStyle} value={dueAt} onChange={e => setDueAt(e.target.value)} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9e9e9e' }}>Passo 3 di 3 — Assegna il ticket a un operatore (opzionale).</p>
              <Field label="Assegna a">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {users.map(u => (
                    <div
                      key={u}
                      onClick={() => setAssignee(assignee === u ? '' : u)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
                        border: `1.5px solid ${assignee === u ? '#1565c0' : '#e0e0e0'}`,
                        background: assignee === u ? '#e3f0fd' : '#fff', cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1565c0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {u.charAt(0)}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: assignee === u ? 700 : 400, color: assignee === u ? '#1565c0' : '#212121' }}>{u}</span>
                      {assignee === u && <span style={{ marginLeft: 'auto', color: '#1565c0', fontSize: 12 }}>✓</span>}
                    </div>
                  ))}
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: step > 1 ? 'space-between' : 'flex-end', marginTop: 20, gap: 12 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 24px', borderRadius: 8, border: '1.5px solid #e0e0e0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#616161' }}>
              ← Indietro
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !canNext1 : !canNext2}
              style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: (step === 1 ? !canNext1 : !canNext2) ? '#e0e0e0' : '#1565c0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (step === 1 ? !canNext1 : !canNext2) ? 'not-allowed' : 'pointer' }}
            >
              Avanti →
            </button>
          ) : (
            <button style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#1565c0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Apri ticket
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
