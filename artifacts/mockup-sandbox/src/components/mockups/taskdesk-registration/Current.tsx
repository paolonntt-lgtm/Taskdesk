import './_group.css';

const professions = [
  'Commercialista',
  'Avvocato',
  'Consulente del lavoro',
  'Notaio',
  'Commercio',
  'Agenzia',
];

export function Current() {
  return (
    <main className="taskdesk-registration current-registration" style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
      position: 'relative', overflow: 'hidden', color: '#111827',
      background: 'radial-gradient(circle at 16% 10%, #dbeafe 0, transparent 34%), radial-gradient(circle at 88% 90%, #ede9fe 0, transparent 36%), #eef2ff',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(37,99,235,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,.025) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      <section style={{
        position: 'relative', width: 'min(620px, 100%)', minHeight: 510, padding: 32,
        borderRadius: 24, background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.9)',
        boxShadow: '0 18px 50px rgba(37,99,235,.12)', filter: 'blur(1px)', opacity: .56,
      }}>
        <h2 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 23 }}>Bentornato</h2>
        <div style={{ height: 42, border: '1px solid #e5e7eb', borderRadius: 12, marginTop: 28 }} />
        <div style={{ height: 42, border: '1px solid #e5e7eb', borderRadius: 12, marginTop: 16 }} />
        <button style={{ width: '100%', marginTop: 24, padding: 14, border: 0, borderRadius: 12, color: 'white', background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>Accedi</button>
      </section>

      <section style={{
        position: 'absolute', width: 'min(600px, calc(100% - 28px))', padding: '32px',
        borderRadius: 32, background: 'linear-gradient(145deg,#fff 0%,#f8faff 100%)',
        boxShadow: '0 24px 80px rgba(30,64,175,.22)', border: '1px solid rgba(255,255,255,.9)',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ color: '#2563eb', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>Crea un account</div>
            <h1 style={{ color: '#111827', fontSize: 23, lineHeight: 1.2, margin: '6px 0 0' }}>La tua attività</h1>
            <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}>Scegli la professione per personalizzare TaskDesk.</p>
          </div>
          <button aria-label="Chiudi registrazione" style={{ width: 36, height: 36, border: 0, borderRadius: 12, color: '#64748b', background: '#eff4ff', fontSize: 20 }}>×</button>
        </header>
        <div style={{ display: 'flex', gap: 7, marginTop: 24 }}>
          {['La tua attività', 'La tua organizzazione', 'Il tuo account'].map((label, index) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 99, background: index === 0 ? 'linear-gradient(90deg,#2563eb,#7c3aed)' : '#e5e7eb' }} />
              <span style={{ display: 'block', marginTop: 7, color: index === 0 ? '#475569' : '#9ca3af', fontSize: 10, fontWeight: index === 0 ? 700 : 500 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28 }}>
          <label style={{ display: 'block', marginBottom: 6, color: '#6b7280', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Professione</label>
          <select defaultValue="" style={{
            width: '100%', height: 46, padding: '0 14px', border: '1.5px solid #e5e7eb',
            borderRadius: 12, background: 'rgba(255,255,255,.8)', color: '#111827',
            font: '14px Inter, sans-serif', outline: 'none',
          }}>
            <option value="" disabled>Seleziona la professione</option>
            {professions.map((profession) => <option key={profession}>{profession}</option>)}
          </select>
        </div>
        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 34 }}>
          <button style={{ padding: '11px 18px', border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#2563eb', background: 'transparent', font: '500 13px Inter, sans-serif' }}>Annulla</button>
          <button style={{ padding: '11px 22px', border: 0, borderRadius: 12, color: 'white', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', boxShadow: '0 6px 20px rgba(37,99,235,.35)', font: '600 14px Inter, sans-serif' }}>Continua →</button>
        </footer>
      </section>
    </main>
  );
}
