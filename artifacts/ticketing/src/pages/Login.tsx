import React, { useState, useEffect } from 'react';
import { Alert, CircularProgress } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../i18n/translations';
import { trackEvent } from '../lib/analytics';
import { hasConfirmedTrialRegistration, parseProfessionalTrialAttribution } from '../lib/professionalTrialAttribution';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    overflow: 'hidden',
    background: '#eef2ff',
    fontFamily: 'Inter, sans-serif',
    padding: '32px 16px',
    boxSizing: 'border-box' as const,
  },
  blob1: { position: 'absolute' as const, width: 700, height: 700, background: 'radial-gradient(circle, #c7d7fe 0%, transparent 70%)', top: -200, left: -100, opacity: 0.9 },
  blob2: { position: 'absolute' as const, width: 500, height: 500, background: 'radial-gradient(circle, #ddd6fe 0%, transparent 70%)', bottom: -100, right: -100, opacity: 0.8 },
  blob3: { position: 'absolute' as const, width: 300, height: 300, background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)', top: '40%', right: '22%', opacity: 0.6 },
  card: {
    position: 'relative' as const,
    zIndex: 10,
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: '36px 36px',
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.9)',
    boxShadow: '0 8px 40px rgba(37,99,235,0.12), 0 1px 0 rgba(255,255,255,0.7) inset',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 22,
    boxSizing: 'border-box' as const,
  },
  label: { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 5 },
  inputWrap: { position: 'relative' as const },
  inputIcon: { position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' as const, display: 'flex' },
  input: { width: '100%', paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none', background: 'rgba(255,255,255,0.8)', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s' },
  inputPlain: { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none', background: 'rgba(255,255,255,0.8)', boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif' },
  btnPrimary: { width: '100%', padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', color: 'white', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(37,99,235,0.35)', letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSecondary: { width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.09)', background: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  btnOutline: { width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'transparent', fontSize: 13, fontWeight: 500, color: '#2563eb', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  divider: { display: 'flex', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' },
  link: { fontWeight: 600, color: '#2563eb', textDecoration: 'none' as const, cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
};

export default function Login() {
  const initialReferralCode = new URLSearchParams(window.location.search).get('ref') ?? '';
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialReferralCode ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, error } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const professionalAttribution = parseProfessionalTrialAttribution(window.location.search);
  const googleParams = new URLSearchParams();
  if (professionalAttribution) {
    googleParams.set('trial_profession', professionalAttribution.profession);
    googleParams.set('trial_language', professionalAttribution.language);
  }
  if (initialReferralCode) googleParams.set('ref', initialReferralCode);
  const googleRegistrationUrl = `/api/auth/google${googleParams.size ? `?${googleParams}` : ''}`;

  useEffect(() => {
    if (initialReferralCode) sessionStorage.setItem('td_referral_code', initialReferralCode);
  }, [initialReferralCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('oauth_error');
    if (err) {
      const messages: Record<string, string> = {
        cancelled: t.login.oauthCancelled,
        token_exchange: t.login.oauthTokenError,
        userinfo: t.login.oauthUserinfoError,
        disabled: t.login.oauthDisabled,
        server_error: t.login.oauthServerError,
      };
      setOauthError(messages[err] ?? t.login.oauthGenericError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const switchMode = (m: 'login' | 'register' | 'forgot') => {
    trackEvent('auth_mode_changed', { mode: m });
    setMode(m); setLocalError(null); setForgotSent(false);
    setEmail(''); setPassword(''); setName(''); setConfirmPassword(''); setOrganizationName('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    try { await login({ email, password }); }
    catch { }
    finally { setIsSubmitting(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 6) { setLocalError(t.login.passwordTooShort); return; }
    if (password !== confirmPassword) { setLocalError(t.login.passwordMismatch); return; }
    if (!organizationName.trim()) { setLocalError(t.login.orgNameRequired); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
           const base: Record<string, string> = { name, email, password, organizationName: organizationName.trim() };
           const referralCode = initialReferralCode || sessionStorage.getItem('td_referral_code');
           if (referralCode) base.referralCode = referralCode;
          try {
            const raw = sessionStorage.getItem('td_utm');
            if (raw) {
              const utm = JSON.parse(raw) as Record<string, string>;
              if (utm.utm_source) base.utmSource = utm.utm_source;
              if (utm.utm_medium) base.utmMedium = utm.utm_medium;
              if (utm.utm_campaign) base.utmCampaign = utm.utm_campaign;
            }
          } catch {}
          return base;
        })()),
      });
      const data = await res.json();
      if (!res.ok) { setLocalError(data.message || t.login.registerError); return; }
      sessionStorage.removeItem('td_referral_code');
      trackEvent('registration_succeeded', { method: 'password' });
      if (professionalAttribution && hasConfirmedTrialRegistration(res.status, data?.user)) {
        trackEvent('professional_trial_started', {
          profession: professionalAttribution.profession,
          language: professionalAttribution.language,
        });
      }
      await login({ email, password });
    } catch { setLocalError(t.login.networkError); }
    finally { setIsSubmitting(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) trackEvent('password_reset_requested');
      setForgotSent(true);
    } catch { setLocalError(t.login.networkError); }
    finally { setIsSubmitting(false); }
  };

  const displayError = oauthError || localError || (mode === 'login' ? error : null);

  return (
    <div style={s.root}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={s.blob1} />
        <div style={s.blob2} />
        <div style={s.blob3} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="td-grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#2563eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#td-grid)" />
        </svg>
      </div>

      {/* Language toggle */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => setLang(lang === 'it' ? 'en' : 'it' as Lang)}
          style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#6b7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}
        >
          {lang === 'it' ? 'EN' : 'IT'}
        </button>
      </div>

      {/* Logo */}
      <div style={{ position: 'relative', zIndex: 10, marginBottom: 24 }}>
        <img src="/taskdesk-logo.png" alt="TaskDesk" style={{ height: 46, width: 'auto', display: 'block' }} />
      </div>

      {/* Glass card */}
      <div style={s.card}>

        {/* Error */}
        {displayError && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: 13 }} onClose={() => { setLocalError(null); setOauthError(null); }}>
            {displayError}
          </Alert>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            {mode === 'login' ? t.login.title : mode === 'register' ? t.login.registerTitle : t.login.forgotTitle}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6, marginBottom: 0 }}>
            {mode === 'login' ? t.login.subtitle : mode === 'register' ? t.login.registerSubtitle : t.login.forgotSubtitle}
          </p>
        </div>

        {/* ── LOGIN MODE ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={s.label}>{t.login.email}</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.login.emailPlaceholder || 'nome@azienda.it'} style={s.input} />
              </div>
            </div>

            <div>
              <div style={s.row}>
                <label style={{ ...s.label, marginBottom: 0 }}>{t.login.password}</label>
                <span style={{ ...s.link, fontSize: 12 }} onClick={() => switchMode('forgot')}>{t.login.forgotLink}</span>
              </div>
              <div style={{ ...s.inputWrap, marginTop: 5 }}>
                <span style={s.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </span>
                <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={s.input} />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} style={s.btnPrimary}>
              {isSubmitting ? <><CircularProgress size={15} color="inherit" /> {t.login.submitting}</> : <>{t.login.submit} →</>}
            </button>

            <div style={s.divider}>
              <div style={s.dividerLine} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{t.login.or}</span>
              <div style={s.dividerLine} />
            </div>

            <button type="button" onClick={() => { trackEvent('oauth_started', { mode: 'login', provider: 'google' }); window.location.href = '/api/auth/google'; }} style={s.btnSecondary}>
              <GoogleLogo />
              {t.login.continueWithGoogle}
            </button>
          </form>
        )}

        {/* ── REGISTER MODE ── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={s.label}>{t.login.orgName}</label>
              <input type="text" required autoFocus value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder={t.login.orgNameHelper} style={s.inputPlain} />
            </div>
            <div>
              <label style={s.label}>{t.login.name}</label>
              <input type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} style={s.inputPlain} />
            </div>
            <div>
              <label style={s.label}>{t.login.email}</label>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={s.inputPlain} />
            </div>
            <div>
              <label style={s.label}>{t.login.password}</label>
              <input type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={s.inputPlain} />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{t.login.passwordTooShort}</p>
            </div>
            <div>
              <label style={s.label}>{t.login.confirmPassword}</label>
              <input
                type="password" required autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                style={{ ...s.inputPlain, borderColor: confirmPassword.length > 0 && password !== confirmPassword ? '#ef4444' : '#e5e7eb' }}
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0' }}>{t.login.passwordMismatch}</p>
              )}
            </div>
            <button type="submit" disabled={isSubmitting} style={s.btnPrimary}>
              {isSubmitting ? <><CircularProgress size={15} color="inherit" /> {t.login.registering}</> : t.login.registerSubmit}
            </button>
            <div style={s.divider}>
              <div style={s.dividerLine} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{t.login.or}</span>
              <div style={s.dividerLine} />
            </div>
            <button type="button" onClick={() => { trackEvent('oauth_started', { mode: 'register', provider: 'google' }); window.location.href = googleRegistrationUrl; }} style={s.btnSecondary}>
              <GoogleLogo />
              {t.login.registerWithGoogle}
            </button>
          </form>
        )}

        {/* ── FORGOT MODE ── */}
        {mode === 'forgot' && (
          forgotSent ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <CheckCircle style={{ fontSize: 52, color: '#10b981', marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: '0 0 8px' }}>{t.login.forgotSentTitle}</p>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
                {t.login.forgotSentPrefix} <strong>{email}</strong> {t.login.forgotSentMessage}
              </p>
              <button onClick={() => switchMode('login')} style={s.btnOutline}>{t.login.backToLogin}</button>
            </div>
          ) : (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={s.label}>{t.login.email}</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} style={s.btnPrimary}>
                {isSubmitting ? <><CircularProgress size={15} color="inherit" /> {t.login.forgotSubmitting}</> : t.login.forgotSubmit}
              </button>
              <div style={{ textAlign: 'center' }}>
                <span style={{ ...s.link, fontSize: 13 }} onClick={() => switchMode('login')}>← {t.login.backToLogin}</span>
              </div>
            </form>
          )
        )}

        {/* Footer links */}
        {mode !== 'forgot' && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0 }}>
            {mode === 'login' ? (
              <>{t.login.noAccount}{' '}<span style={s.link} onClick={() => switchMode('register')}>{t.login.registerLink}</span></>
            ) : (
              <>{t.login.hasAccount}{' '}<span style={s.link} onClick={() => switchMode('login')}>{t.login.loginLink}</span></>
            )}
          </p>
        )}
      </div>

      {/* Bottom badge */}
      <p style={{ position: 'relative', zIndex: 10, marginTop: 20, fontSize: 11, color: '#9ca3af' }}>
        🔒 {t.login.secureConnection || 'Connessione sicura e cifrata'}
      </p>
    </div>
  );
}
