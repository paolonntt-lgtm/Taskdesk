import { useState } from 'react';
import './_group.css';

const professions = [
  { name: 'Commercialista', detail: 'Pratiche, scadenze e clienti dello studio', icon: 'C', color: '#2563eb', background: '#eff6ff' },
  { name: 'Avvocato', detail: 'Attività e richieste dello studio legale', icon: '§', color: '#7c3aed', background: '#f5f3ff' },
  { name: 'Consulente del lavoro', detail: 'Documenti e richieste ricorrenti', icon: 'L', color: '#0891b2', background: '#ecfeff' },
  { name: 'Notaio', detail: 'Pratiche, scadenze e coordinamento', icon: 'N', color: '#be123c', background: '#fff1f2' },
  { name: 'Commercio', detail: 'Richieste clienti e attività operative', icon: 'B', color: '#15803d', background: '#f0fdf4' },
  { name: 'Agenzia', detail: 'Progetti, assegnazioni e consegne', icon: 'A', color: '#c2410c', background: '#fff7ed' },
];

export function Refined() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(professions[2]);

  return (
    <main className="taskdesk-registration refined-registration">
      <div className="refined-grid" />
      <div className="refined-orb refined-orb-one" />
      <div className="refined-orb refined-orb-two" />
      <section className="refined-login-underlay">
        <div className="refined-brand-mark">T</div>
        <h2>Bentornato</h2>
        <p>Accedi per gestire le richieste della tua organizzazione</p>
        <div className="ghost-input" />
        <div className="ghost-input" />
        <div className="ghost-button" />
      </section>

      <section className="refined-modal">
        <div className="modal-topline" />
        <header className="refined-header">
          <div className="header-content">
            <div className="eyebrow"><span className="eyebrow-dot" /> NUOVO WORKSPACE</div>
            <h1>Costruiamo il tuo spazio di lavoro</h1>
            <p>Partiamo dalla professione: TaskDesk si adatterà al modo in cui lavori.</p>
          </div>
          <button className="close-button" aria-label="Chiudi registrazione">×</button>
        </header>

        <div className="stepper" aria-label="Passaggio 1 di 3">
          {['Attività', 'Organizzazione', 'Account'].map((label, index) => (
            <div className={`step ${index === 0 ? 'active' : ''}`} key={label}>
              <span className="step-index">{index === 0 ? '✓' : `0${index + 1}`}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="progress-track"><div className="progress-value" /></div>

        <div className="refined-field">
          <div className="field-heading">
            <label htmlFor="profession-menu">Che tipo di attività gestisci?</label>
            <span>PASSAGGIO 1 / 3</span>
          </div>
          <p className="field-hint">Scegli la professione più vicina al tuo lavoro.</p>
          <div className="profession-select-wrap">
            <button
              id="profession-menu"
              className={`profession-trigger ${open ? 'is-open' : ''}`}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-haspopup="listbox"
            >
              <span className="selected-icon" style={{ color: selected.color, background: selected.background }}>{selected.icon}</span>
              <span className="selected-copy"><strong>{selected.name}</strong><small>Seleziona la tua professione</small></span>
              <span className={`chevron ${open ? 'up' : ''}`} />
            </button>
            {open && (
              <div className="profession-menu" role="listbox" aria-label="Professioni">
                {professions.map((profession) => (
                  <button
                    key={profession.name}
                    className={`profession-option ${selected.name === profession.name ? 'selected' : ''}`}
                    role="option"
                    aria-selected={selected.name === profession.name}
                    onClick={() => { setSelected(profession); setOpen(false); }}
                  >
                    <span className="option-icon" style={{ color: profession.color, background: profession.background }}>{profession.icon}</span>
                    <span className="option-copy"><strong>{profession.name}</strong><small>{profession.detail}</small></span>
                    <span className="option-check">{selected.name === profession.name ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="privacy-note"><span>✦</span> Potrai modificare questa scelta in seguito.</div>
        </div>

        <footer className="refined-actions">
          <button className="back-button">Annulla</button>
          <button className="next-button">Continua <span>→</span></button>
        </footer>
      </section>

      <style>{`
        .refined-registration { min-height: 100vh; display: grid; place-items: center; position: relative; overflow: hidden; padding: 30px; color: #172033; background: #f2f6fc; }
        .refined-grid { position: absolute; inset: 0; opacity: .35; background-image: linear-gradient(rgba(63,91,142,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(63,91,142,.05) 1px, transparent 1px); background-size: 40px 40px; mask-image: linear-gradient(to bottom, black, transparent 85%); }
        .refined-orb { position: absolute; width: 430px; height: 430px; border-radius: 50%; filter: blur(2px); pointer-events: none; }
        .refined-orb-one { top: -210px; left: -100px; background: radial-gradient(circle, rgba(147,197,253,.48), transparent 72%); }
        .refined-orb-two { right: -180px; bottom: -200px; background: radial-gradient(circle, rgba(196,181,253,.44), transparent 72%); }
        .refined-login-underlay { position: absolute; width: min(560px, calc(100% - 50px)); padding: 38px; border: 1px solid white; border-radius: 26px; background: rgba(255,255,255,.6); box-shadow: 0 16px 45px rgba(40,67,115,.08); text-align: center; opacity: .28; filter: blur(1.6px); }
        .refined-brand-mark { margin: 0 auto 16px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; color: white; background: linear-gradient(135deg,#2563eb,#6d5dfc); font-size: 22px; font-weight: 800; }
        .refined-login-underlay h2 { margin: 0; font-size: 22px; }
        .refined-login-underlay p { color: #64748b; font-size: 13px; }
        .ghost-input { height: 42px; margin-top: 12px; border: 1px solid #dbe2ef; border-radius: 12px; background: white; }
        .ghost-button { height: 42px; margin-top: 20px; border-radius: 12px; background: #4f6df5; }
        .refined-modal { position: relative; width: min(620px, 100%); padding: 32px 36px 26px; border: 1px solid rgba(215,225,241,.9); border-radius: 26px; background: #fff; box-shadow: 0 30px 90px rgba(28,50,91,.2), 0 5px 20px rgba(28,50,91,.08); }
        .modal-topline { position: absolute; top: 0; left: 36px; right: 36px; height: 3px; border-radius: 0 0 6px 6px; background: linear-gradient(90deg,#2474ed 0%,#6d5dfc 65%,#aa72f4 100%); }
        .refined-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
        .header-content { min-width: 0; }
        .eyebrow { display: flex; align-items: center; gap: 7px; color: #4167b3; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
        .eyebrow-dot { width: 7px; height: 7px; border-radius: 50%; background: #4f74ef; box-shadow: 0 0 0 4px #eef3ff; }
        .refined-header h1 { margin: 11px 0 0; color: #172033; font-size: 25px; line-height: 1.25; letter-spacing: -.04em; font-weight: 750; }
        .refined-header p { margin: 8px 0 0; color: #718096; font-size: 13px; line-height: 1.55; }
        .close-button { flex: 0 0 36px; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid #e6ebf3; border-radius: 12px; color: #74829b; background: #fff; font: 400 23px Inter,sans-serif; cursor: pointer; transition: .16s ease; }
        .close-button:hover { color: #263b63; background: #f5f8fd; border-color: #d5dfef; }
        .stepper { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 28px; }
        .step { display: flex; align-items: center; gap: 8px; color: #a0aabe; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .step.active { color: #345db3; }
        .step-index { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid #e0e6f0; border-radius: 50%; color: #9aa6ba; background: #fff; font-size: 10px; font-weight: 700; }
        .step.active .step-index { border-color: #356de1; color: white; background: #356de1; box-shadow: 0 3px 8px rgba(53,109,225,.2); }
        .progress-track { height: 3px; margin-top: 12px; overflow: hidden; border-radius: 10px; background: #edf1f7; }
        .progress-value { width: 34%; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#2474ed,#765ff5); }
        .refined-field { margin-top: 28px; }
        .field-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .field-heading label { color: #26344b; font-size: 14px; font-weight: 700; }
        .field-heading span { color: #98a3b5; font-size: 9px; font-weight: 800; letter-spacing: .1em; }
        .field-hint { margin: 5px 0 12px; color: #8591a4; font-size: 12px; }
        .profession-select-wrap { position: relative; z-index: 3; }
        .profession-trigger { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 9px 14px; border: 1px solid #b9ccef; border-radius: 14px; background: #fbfdff; box-shadow: 0 0 0 3px rgba(63,115,225,.08); text-align: left; cursor: pointer; transition: .18s ease; }
        .profession-trigger:hover { border-color: #8ca9e3; background: white; }
        .selected-icon,.option-icon { flex: 0 0 38px; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; font-size: 15px; font-weight: 800; }
        .selected-copy,.option-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
        .selected-copy strong,.option-copy strong { color: #25344c; font-size: 13px; font-weight: 700; }
        .selected-copy small,.option-copy small { color: #8793a6; font-size: 10px; line-height: 1.35; }
        .chevron { width: 9px; height: 9px; margin: 0 3px 4px 8px; border-right: 1.7px solid #6d7d95; border-bottom: 1.7px solid #6d7d95; transform: rotate(45deg); transition: transform .18s ease; }
        .chevron.up { margin-bottom: -4px; transform: rotate(225deg); }
        .profession-menu { position: absolute; top: calc(100% + 7px); left: 0; right: 0; max-height: 246px; overflow-y: auto; overscroll-behavior: contain; padding: 6px; border: 1px solid #e3eaf4; border-radius: 16px; background: #fff; box-shadow: 0 18px 46px rgba(31,53,92,.16); animation: menu-in .16s ease-out; scrollbar-width: thin; scrollbar-color: #cbd6e8 transparent; }
        .profession-option { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 52px; padding: 7px 9px; border: 1px solid transparent; border-radius: 11px; background: transparent; text-align: left; cursor: pointer; transition: background .14s ease,border-color .14s ease; }
        .profession-option:hover { background: #f6f8fc; }
        .profession-option.selected { border-color: #dce7fb; background: #f3f7ff; }
        .option-icon { flex-basis: 34px; width: 34px; height: 34px; border-radius: 10px; font-size: 13px; }
        .option-check { width: 18px; color: #3269d7; font-size: 14px; font-weight: 800; text-align: center; }
        .privacy-note { display: flex; align-items: center; gap: 7px; margin-top: 13px; color: #8995a9; font-size: 11px; }
        .privacy-note span { color: #617fe1; }
        .refined-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 30px; padding-top: 18px; border-top: 1px solid #eef1f6; }
        .back-button,.next-button { min-height: 42px; padding: 0 18px; border-radius: 12px; font: 650 12px Inter,sans-serif; cursor: pointer; transition: .16s ease; }
        .back-button { border: 1px solid #e2e7ef; color: #68768d; background: white; }
        .back-button:hover { border-color: #cbd5e4; background: #f8faff; }
        .next-button { display: flex; align-items: center; gap: 14px; border: 0; color: white; background: linear-gradient(105deg,#2b6fe8,#7256ec); box-shadow: 0 7px 16px rgba(60,91,206,.22); }
        .next-button:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(60,91,206,.28); }
        .next-button span { font-size: 16px; font-weight: 400; }
        @keyframes menu-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 560px) {
          .refined-registration { padding: 14px; }
          .refined-modal { padding: 28px 20px 20px; border-radius: 22px; }
          .modal-topline { left: 20px; right: 20px; }
          .refined-header h1 { font-size: 21px; }
          .refined-header p { max-width: 300px; }
          .stepper { gap: 4px; margin-top: 23px; }
          .step { gap: 5px; font-size: 10px; }
          .step-index { width: 20px; height: 20px; }
          .refined-field { margin-top: 22px; }
          .profession-option { min-height: 49px; }
          .option-copy small { font-size: 9px; }
        }
      `}</style>
    </main>
  );
}
