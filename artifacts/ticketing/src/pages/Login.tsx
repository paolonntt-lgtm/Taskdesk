import React, { useState, useEffect } from 'react';
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../i18n/translations';
import { trackEvent } from '../lib/analytics';
import { hasConfirmedTrialRegistration, parseProfessionalTrialAttribution } from '../lib/professionalTrialAttribution';
import { getInitialLoginMode } from '../lib/loginMode';
import { isOnboardingProfileId, ONBOARDING_PROFILE_IDS, type OnboardingProfileId } from '../lib/onboardingDashboardPresets';

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
  const initialMode = getInitialLoginMode(window.location.search);
  const [mode, setMode] = useState<'login' | 'forgot'>(() => initialMode === 'forgot' ? 'forgot' : 'login');
  const [registerOpen, setRegisterOpen] = useState(() => initialMode === 'register');
  const [registerStep, setRegisterStep] = useState(0);
  const [registrationMethod, setRegistrationMethod] = useState<'password' | 'google'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [profession, setProfession] = useState<OnboardingProfileId | ''>(() => {
    const attributed = parseProfessionalTrialAttribution(window.location.search)?.profession;
    if (isOnboardingProfileId(attributed)) return attributed;
    try {
      const saved = sessionStorage.getItem('td_onboarding_profession');
      return isOnboardingProfileId(saved) ? saved : '';
    } catch {
      return '';
    }
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, error } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const professionalAttribution = parseProfessionalTrialAttribution(window.location.search);
  const googleParams = new URLSearchParams();
  googleParams.set('mode', 'register');
  if (profession) googleParams.set('profession', profession);
  if (organizationName.trim()) googleParams.set('organizationName', organizationName.trim());
  if (professionalAttribution) {
    googleParams.set('trial_profession', professionalAttribution.profession);
    googleParams.set('trial_language', professionalAttribution.language);
  }
  if (initialReferralCode) googleParams.set('ref', initialReferralCode);
  try {
    const utm = JSON.parse(sessionStorage.getItem('td_utm') ?? '{}') as Record<string, unknown>;
    for (const [key, queryKey] of [
      ['utm_source', 'utm_source'],
      ['utm_medium', 'utm_medium'],
      ['utm_campaign', 'utm_campaign'],
    ] as const) {
      if (typeof utm[key] === 'string' && utm[key]) googleParams.set(queryKey, utm[key] as string);
    }
  } catch {}
  const googleRegistrationUrl = `/api/auth/google${googleParams.size ? `?${googleParams}` : ''}`;

  useEffect(() => {
    const registrationLanguage = professionalAttribution?.language;
    if (registrationLanguage && registrationLanguage !== lang) {
      setLang(registrationLanguage);
    }
  }, [professionalAttribution?.language, lang, setLang]);

  useEffect(() => {
    if (initialReferralCode) {
      try {
        sessionStorage.setItem('td_referral_code', initialReferralCode);
      } catch {}
    }
  }, [initialReferralCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('oauth_error');
    if (err) {
      setOauthErrorCode(err);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const switchMode = (m: 'login' | 'register' | 'forgot') => {
    trackEvent('auth_mode_changed', { mode: m });
    setLocalError(null);
    setForgotSent(false);
    if (m === 'register') {
      setMode('login');
      setRegisterStep(0);
      setRegistrationMethod('password');
      setRegisterOpen(true);
      return;
    }
    setRegisterOpen(false);
    setMode(m);
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setOrganizationName('');
  };

  const closeRegistration = () => {
    if (isSubmitting) return;
    setRegisterOpen(false);
    setRegisterStep(0);
    setLocalError(null);
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
    if (registerStep !== 2 || registrationMethod !== 'password') return;
    if (!name.trim() || !email.trim()) { setLocalError(t.login.identityRequired); return; }
    if (password.length < 6) { setLocalError(t.login.passwordTooShort); return; }
    if (password !== confirmPassword) { setLocalError(t.login.passwordMismatch); return; }
    if (!organizationName.trim()) { setLocalError(t.login.orgNameRequired); return; }
    if (!isOnboardingProfileId(profession)) { setLocalError(t.login.professionRequired); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
            const base: Record<string, string> = { name, email, password, organizationName: organizationName.trim(), profession };
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
      if (hasConfirmedTrialRegistration(res.status, data?.user)) {
        try {
          sessionStorage.setItem('td_onboarding_profession', profession);
        } catch {}
      }
      if (professionalAttribution && hasConfirmedTrialRegistration(res.status, data?.user)) {
        trackEvent('professional_trial_started', {
          profession: professionalAttribution.profession,
          language: professionalAttribution.language,
        });
      }
      setRegisterOpen(false);
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

  const oauthErrorMessages: Record<string, string> = {
    cancelled: t.login.oauthCancelled,
    denied: t.login.oauthDenied,
    invalid_state: t.login.oauthInvalidState,
    token_exchange: t.login.oauthTokenError,
    userinfo: t.login.oauthUserinfoError,
    disabled: t.login.oauthDisabled,
    server_error: t.login.oauthServerError,
    oauth_configuration: t.login.oauthConfiguration,
    oauth_temporary: t.login.oauthTemporary,
    provider_error: t.login.oauthProviderError,
    profession_required: t.login.professionRequired,
  };
  const oauthError = oauthErrorCode
    ? oauthErrorMessages[oauthErrorCode] ?? t.login.oauthGenericError
    : null;
  const displayError = registerOpen ? null : oauthError || localError || (mode === 'login' ? error : null);
  const registrationSteps = [t.login.stepProfession, t.login.stepOrganization, t.login.stepAccount];
  const registrationError = oauthError || localError;

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
        <img src="/taskdesk-logo.svg" alt="TaskDesk" style={{ height: 46, width: 'auto', display: 'block' }} />
      </div>

      {/* Glass card */}
      <div style={s.card}>

        {/* Error */}
        {displayError && (
          <Alert severity="error" sx={{ borderRadius: '12px', fontSize: 13 }} onClose={() => { setLocalError(null); setOauthErrorCode(null); }}>
            {displayError}
          </Alert>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            {mode === 'login' ? t.login.title : t.login.forgotTitle}
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6, marginBottom: 0 }}>
            {mode === 'login' ? t.login.subtitle : t.login.forgotSubtitle}
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

        <Dialog
          open={registerOpen}
          onClose={closeRegistration}
          fullWidth
          maxWidth="sm"
          aria-labelledby="registration-dialog-title"
          PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)', boxShadow: '0 24px 80px rgba(30, 64, 175, 0.22)' } }}
        >
          <form onSubmit={handleRegister}>
            <DialogTitle id="registration-dialog-title" sx={{ px: { xs: 2.5, sm: 4 }, pt: 3.5, pb: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ color: '#2563eb', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {t.login.registerTitle}
                  </div>
                  <div style={{ color: '#111827', fontSize: 23, fontWeight: 750, marginTop: 5, lineHeight: 1.2 }}>
                    {registrationSteps[registerStep]}
                  </div>
                  <p style={{ color: '#6b7280', fontSize: 13, fontWeight: 400, margin: '8px 0 0' }}>
                    {registerStep === 0 ? t.login.stepProfessionHelp : registerStep === 1 ? t.login.stepOrganizationHelp : t.login.stepAccountHelp}
                  </p>
                </div>
                <button type="button" aria-label={t.login.closeRegistration} onClick={closeRegistration} style={{ border: 0, background: '#eff4ff', color: '#64748b', borderRadius: 12, width: 36, height: 36, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 22 }} aria-label={`${t.login.stepLabel} ${registerStep + 1} ${t.login.ofLabel} 3`}>
                {registrationSteps.map((label, index) => (
                  <div key={label} style={{ flex: 1 }}>
                    <div style={{ height: 4, borderRadius: 99, background: index <= registerStep ? 'linear-gradient(90deg, #2563eb, #7c3aed)' : '#e5e7eb' }} />
                    <span style={{ display: 'block', marginTop: 6, fontSize: 10, fontWeight: index === registerStep ? 700 : 500, color: index <= registerStep ? '#475569' : '#9ca3af' }}>{label}</span>
                  </div>
                ))}
              </div>
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, pt: '20px !important', minHeight: 190 }}>
              {registrationError && (
                <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }} onClose={() => { setLocalError(null); setOauthErrorCode(null); }}>
                  {registrationError}
                </Alert>
              )}
              {registerStep === 0 && (
                <div>
                  <label style={s.label}>{t.login.profession}</label>
                  <select required autoFocus value={profession} onChange={e => setProfession(isOnboardingProfileId(e.target.value) ? e.target.value : '')} style={s.inputPlain} data-testid="registration-profession">
                    <option value="">{t.login.professionPlaceholder}</option>
                    {ONBOARDING_PROFILE_IDS.map(value => <option key={value} value={value}>{t.onboarding.types[value].label}</option>)}
                  </select>
                </div>
              )}
              {registerStep === 1 && (
                <div>
                  <label style={s.label}>{t.login.orgName}</label>
                  <input type="text" required autoFocus minLength={2} maxLength={160} value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder={t.login.orgNameHelper} style={s.inputPlain} data-testid="registration-organization" />
                  <p style={{ fontSize: 12, color: '#64748b', margin: '9px 0 0' }}>{t.login.orgNameHelper}</p>
                </div>
              )}
              {registerStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 4, borderRadius: 14, background: '#eef2ff' }}>
                    <button type="button" onClick={() => setRegistrationMethod('password')} aria-pressed={registrationMethod === 'password'} style={{ border: 0, borderRadius: 11, padding: '10px 8px', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: registrationMethod === 'password' ? '#1d4ed8' : '#64748b', background: registrationMethod === 'password' ? '#fff' : 'transparent', boxShadow: registrationMethod === 'password' ? '0 2px 8px rgba(15,23,42,.08)' : 'none' }}>{t.login.emailMethod}</button>
                    <button type="button" onClick={() => setRegistrationMethod('google')} aria-pressed={registrationMethod === 'google'} style={{ border: 0, borderRadius: 11, padding: '10px 8px', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: registrationMethod === 'google' ? '#1d4ed8' : '#64748b', background: registrationMethod === 'google' ? '#fff' : 'transparent', boxShadow: registrationMethod === 'google' ? '0 2px 8px rgba(15,23,42,.08)' : 'none' }}>{t.login.googleMethod}</button>
                  </div>
                  {registrationMethod === 'password' ? (
                    <>
                      <div>
                        <label style={s.label}>{t.login.name}</label>
                        <input type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} style={s.inputPlain} data-testid="registration-name" />
                      </div>
                      <div>
                        <label style={s.label}>{t.login.email}</label>
                        <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={s.inputPlain} data-testid="registration-email" />
                      </div>
                      <div>
                        <label style={s.label}>{t.login.password}</label>
                        <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={s.inputPlain} />
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{t.login.passwordTooShort}</p>
                      </div>
                      <div>
                        <label style={s.label}>{t.login.confirmPassword}</label>
                        <input type="password" required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ ...s.inputPlain, borderColor: confirmPassword.length > 0 && password !== confirmPassword ? '#ef4444' : '#e5e7eb' }} />
                        {confirmPassword.length > 0 && password !== confirmPassword && <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0' }}>{t.login.passwordMismatch}</p>}
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 18, border: '1px solid #dbeafe', borderRadius: 16, background: 'linear-gradient(135deg, #eff6ff, #faf5ff)' }}>
                      <p style={{ color: '#1e293b', fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>{t.login.googleIdentityTitle}</p>
                      <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.55, margin: 0 }}>{t.login.googleIdentityHelp}</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2.5, sm: 4 }, pb: 3.5, pt: 1, gap: 1 }}>
              <button type="button" onClick={() => registerStep === 0 ? closeRegistration() : setRegisterStep(registerStep - 1)} style={{ ...s.btnOutline, width: 'auto', padding: '11px 18px', marginRight: 'auto' }}>
                {registerStep === 0 ? t.login.cancel : `← ${t.login.back}`}
              </button>
              {registerStep < 2 ? (
                <button type="button" disabled={registerStep === 0 ? !isOnboardingProfileId(profession) : organizationName.trim().length < 2} onClick={() => { setLocalError(null); setRegisterStep(registerStep + 1); }} style={{ ...s.btnPrimary, width: 'auto', padding: '11px 22px', opacity: registerStep === 0 ? (isOnboardingProfileId(profession) ? 1 : 0.5) : (organizationName.trim().length >= 2 ? 1 : 0.5) }}>
                  {t.login.next} →
                </button>
              ) : registrationMethod === 'password' ? (
                <button type="submit" disabled={isSubmitting} style={{ ...s.btnPrimary, width: 'auto', padding: '11px 22px' }}>
                  {isSubmitting ? <><CircularProgress size={15} color="inherit" /> {t.login.registering}</> : t.login.registerSubmit}
                </button>
              ) : (
                <button type="button" onClick={() => { trackEvent('oauth_started', { mode: 'register', provider: 'google' }); window.location.href = googleRegistrationUrl; }} style={{ ...s.btnSecondary, width: 'auto', padding: '10px 16px' }}>
                  <GoogleLogo /> {t.login.registerWithGoogle}
                </button>
              )}
            </DialogActions>
          </form>
        </Dialog>

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
          <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0 }}>{t.login.noAccount}{' '}<span style={s.link} onClick={() => switchMode('register')}>{t.login.registerLink}</span></p>
            <button
              type="button"
              onClick={() => { setMode('login'); setRegisterStep(0); setRegistrationMethod('google'); setRegisterOpen(true); setLocalError(null); }}
              style={{ alignSelf: 'center', border: 0, background: 'transparent', color: '#2563eb', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 650, cursor: 'pointer', padding: 2 }}
            >
              {t.login.registerWithGoogle}
            </button>
          </div>
        )}
      </div>

      {/* Bottom badge */}
      <p style={{ position: 'relative', zIndex: 10, marginTop: 20, fontSize: 11, color: '#9ca3af' }}>
        🔒 {t.login.secureConnection || 'Connessione sicura e cifrata'}
      </p>
    </div>
  );
}
