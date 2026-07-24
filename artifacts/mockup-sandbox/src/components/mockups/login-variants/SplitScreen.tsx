export function SplitScreen() {
  return (
    <div className="flex min-h-screen w-full" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div style={{ position: 'absolute', width: 600, height: 600, background: '#7c3aed', top: -150, right: -200, filter: 'blur(80px)', borderRadius: '50%', opacity: 0.12 }} />
          <div style={{ position: 'absolute', width: 400, height: 400, background: '#2563eb', bottom: 100, left: -100, filter: 'blur(60px)', borderRadius: '50%', opacity: 0.18 }} />
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>TaskDesk</span>
        </div>

        {/* Features */}
        <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '⚡', title: 'Risolvi più veloce', desc: 'Workflow ottimizzati per il tuo team di supporto' },
            { icon: '🔔', title: 'Notifiche in tempo reale', desc: 'Aggiornamenti istantanei su ogni ticket aperto' },
            { icon: '📊', title: 'Report dettagliati', desc: 'Analytics e trend in un colpo d\'occhio' },
          ].map((f) => (
            <div
              key={f.title}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{f.title}</div>
                <div style={{ color: '#bfdbfe', fontSize: 12, marginTop: 2, opacity: 0.85 }}>{f.desc}</div>
              </div>
            </div>
          ))}
          <p style={{ color: '#bfdbfe', fontSize: 12, marginTop: 4, opacity: 0.6 }}>
            Usato da oltre 200 aziende per gestire il supporto interno
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', background: '#ffffff' }}>
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Accedi al tuo account</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>Bentornato. Inserisci le tue credenziali.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Email</label>
              <input
                type="email"
                defaultValue="demo.admin@taskdesk.it"
                readOnly
                style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none', background: '#fafafa' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Password</label>
                <a href="#" style={{ fontSize: 12, fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}>Password dimenticata?</a>
              </div>
              <input
                type="password"
                defaultValue="Demo2024!"
                readOnly
                style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none', background: '#fafafa' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="remember" defaultChecked readOnly style={{ accentColor: '#2563eb' }} />
              <label htmlFor="remember" style={{ fontSize: 13, color: '#6b7280' }}>Ricordami per 30 giorni</label>
            </div>

            <button
              style={{ width: '100%', padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.35)', letterSpacing: '0.01em' }}
            >
              Accedi
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>oppure</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          <button
            style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#ffffff', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
              <path fill="#34A853" d="M24 48c6.5 0 12-2.2 16-5.8l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.5v6.2C6.5 42.5 14.7 48 24 48z"/>
              <path fill="#FBBC05" d="M10.6 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6V13.2H2.5C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l8.1-6.2z"/>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.9 2.2 30.4 0 24 0 14.7 0 6.5 5.5 2.5 13.2l8.1 6.2C12.5 13.7 17.8 9.5 24 9.5z"/>
            </svg>
            Accedi con Google
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0 }}>
            Non hai un account?{' '}
            <a href="#" style={{ fontWeight: 500, color: '#2563eb', textDecoration: 'none' }}>Contatta il tuo amministratore</a>
          </p>
        </div>
      </div>
    </div>
  );
}
