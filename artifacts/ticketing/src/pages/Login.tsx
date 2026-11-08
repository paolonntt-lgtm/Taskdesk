import React, { useState, useEffect } from 'react';
import { Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select } from '@mui/material';
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

type ProfessionVisual = { path: string; color: string; background: string };

function ProfessionMark({ visual, size }: { visual: ProfessionVisual; size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        flex: `0 0 ${size}px`,
        width: size,
        height: size,
        borderRadius: size === 36 ? 11 : 10,
        background: visual.background,
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill={visual.color} aria-hidden="true">
        <path d={visual.path} />
      </svg>
    </span>
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

const professionVisuals: Record<OnboardingProfileId, ProfessionVisual> = {
  commercialisti: { path: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41zm-6.78.66h5v1.5h-5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2zm6.5 1.25h-5v-1.5h5zm0-2.5h-5v-1.5h5z', color: '#2563eb', background: '#eff6ff' },
  avvocati: { path: 'm5.2494 8.0688 2.83-2.8269 14.1343 14.15-2.83 2.8269zm4.2363-4.2415 2.828-2.8289 5.6577 5.656-2.828 2.8289zM.9989 12.3147l2.8284-2.8285 5.6569 5.6569-2.8285 2.8284zM1 21h12v2H1z', color: '#7c3aed', background: '#f5f3ff' },
  'consulenti-del-lavoro': { path: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91M4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29M20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3', color: '#0891b2', background: '#ecfeff' },
  notai: { path: 'm18.85 10.39 1.06-1.06c.78-.78.78-2.05 0-2.83L18.5 5.09c-.78-.78-2.05-.78-2.83 0l-1.06 1.06zm-5.66-2.83L4 16.76V21h4.24l9.19-9.19zM19 17.5c0 2.19-2.54 3.5-5 3.5-.55 0-1-.45-1-1s.45-1 1-1c1.54 0 3-.73 3-1.5 0-.47-.48-.87-1.23-1.2l1.48-1.48c1.07.63 1.75 1.47 1.75 2.68M4.58 13.35C3.61 12.79 3 12.06 3 11c0-1.8 1.89-2.63 3.56-3.36C7.59 7.18 9 6.56 9 6c0-.41-.78-1-2-1-1.26 0-1.8.61-1.83.64-.35.41-.98.46-1.4.12-.41-.34-.49-.95-.15-1.38C3.73 4.24 4.76 3 7 3s4 1.32 4 3c0 1.87-1.93 2.72-3.64 3.47C6.42 9.88 5 10.5 5 11c0 .31.43.6 1.07.86z', color: '#be123c', background: '#fff1f2' },
  commercio: { path: 'm21.9 8.89-1.05-4.37c-.22-.9-1-1.52-1.91-1.52H5.05c-.9 0-1.69.63-1.9 1.52L2.1 8.89c-.24 1.02-.02 2.06.62 2.88.08.11.19.19.28.29V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.94c.09-.09.2-.18.28-.28.64-.82.87-1.87.62-2.89m-2.99-3.9 1.05 4.37c.1.42.01.84-.25 1.17-.14.18-.44.47-.94.47-.61 0-1.14-.49-1.21-1.14L16.98 5zM13 5h1.96l.54 4.52c.05.39-.07.78-.33 1.07-.22.26-.54.41-.95.41-.67 0-1.22-.59-1.22-1.31zM8.49 9.52 9.04 5H11v4.69c0 .72-.55 1.31-1.29 1.31-.34 0-.65-.15-.89-.41-.25-.29-.37-.68-.33-1.07m-4.45-.16L5.05 5h1.97l-.58 4.86c-.08.65-.6 1.14-1.21 1.14-.49 0-.8-.29-.93-.47-.27-.32-.37-.75-.26-1.17M5 19v-6.03c.08.01.15.03.23.03.87 0 1.66-.36 2.24-.95.6.6 1.4.95 2.31.95.87 0 1.65-.36 2.23-.93.59.57 1.39.93 2.29.93.84 0 1.64-.35 2.24-.95.58.59 1.37.95 2.24.95.08 0 .15-.02.23-.03V19z', color: '#15803d', background: '#f0fdf4' },
  agenzie: { path: 'M18 11v2h4v-2zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61M20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4-.4.53-.8 1.07-1.2 1.6.96-.72 2.21-1.65 3.2-2.4M4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34', color: '#c2410c', background: '#fff7ed' },
  palestre: { path: 'M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z', color: '#d97706', background: '#fffbeb' },
  it_support: { path: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h4v1h-7v2h6c1.66 0 3-1.34 3-3V10c0-4.97-4.03-9-9-9', color: '#4f46e5', background: '#eef2ff' },
  other: { path: 'M4 8h4V4H4zm6 12h4v-4h-4zm-6 0h4v-4H4zm0-6h4v-4H4zm6 0h4v-4h-4zm6-10v4h4V4zm-6 4h4V4h-4zm6 6h4v-4h-4zm0 6h4v-4h-4z', color: '#64748b', background: '#f1f5f9' },
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
  const registrationSteps = [t.login.stepProfessionShort, t.login.stepOrganizationShort, t.login.stepAccountShort];
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
          sx={{
            '& .MuiDialog-container': {
              alignItems: { xs: 'flex-start', sm: 'center' },
              pt: { xs: 2, sm: 0 },
              pb: { xs: '200px', sm: 0 },
            },
          }}
          aria-labelledby="registration-dialog-title"
          BackdropProps={{ sx: { backdropFilter: 'blur(7px)', backgroundColor: 'rgba(19, 31, 54, .52)' } }}
          PaperProps={{ sx: {
            position: 'relative',
            maxHeight: { xs: 'calc(100dvh - 232px)', sm: 'calc(100dvh - 28px)' },
            borderRadius: { xs: 3, sm: 4 },
            overflow: 'hidden',
            background: '#fff',
            backgroundImage: 'none',
            border: '1px solid rgba(215,225,241,.9)',
            boxShadow: '0 30px 90px rgba(28,50,91,.2), 0 5px 20px rgba(28,50,91,.08)',
            '&::before': {
              content: '""',
              position: 'absolute',
              zIndex: 1,
              top: 0,
              left: { xs: 20, sm: 36 },
              right: { xs: 20, sm: 36 },
              height: 3,
              borderRadius: '0 0 6px 6px',
              background: 'linear-gradient(90deg,#2474ed 0%,#6d5dfc 65%,#aa72f4 100%)',
            },
          } }}
        >
          <form onSubmit={handleRegister}>
            <DialogTitle id="registration-dialog-title" sx={{ px: { xs: 2.5, sm: 4 }, pt: 3.5, pb: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4167b3', fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f74ef', boxShadow: '0 0 0 4px #eef3ff' }} />
                    {t.login.registrationEyebrow}
                  </div>
                  <div style={{ color: '#172033', fontSize: 24, fontWeight: 750, letterSpacing: '-0.04em', marginTop: 10, lineHeight: 1.22 }}>
                    {t.login.registrationHeading}
                  </div>
                  <p style={{ color: '#718096', fontSize: 13, fontWeight: 400, lineHeight: 1.5, margin: '8px 0 0' }}>
                    {registerStep === 0 ? t.login.registrationSubtitle : registerStep === 1 ? t.login.stepOrganizationHelp : t.login.stepAccountHelp}
                  </p>
                </div>
                <button type="button" aria-label={t.login.closeRegistration} onClick={closeRegistration} style={{ flex: '0 0 36px', border: '1px solid #e6ebf3', background: '#fff', color: '#74829b', borderRadius: 12, width: 36, height: 36, cursor: 'pointer', fontSize: 20, lineHeight: 1, transition: 'all .16s ease' }}>
                  ×
                </button>
              </div>
              <div style={{ marginTop: 25 }} aria-label={`${t.login.stepLabel} ${registerStep + 1} ${t.login.ofLabel} 3`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {registrationSteps.map((label, index) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, color: index === registerStep ? '#345db3' : '#a0aabe', fontSize: 10, fontWeight: index === registerStep ? 700 : 600, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, flex: '0 0 22px', borderRadius: '50%', border: `1px solid ${index <= registerStep ? '#356de1' : '#e0e6f0'}`, color: index < registerStep ? '#356de1' : index === registerStep ? '#fff' : '#9aa6ba', background: index === registerStep ? '#356de1' : index < registerStep ? '#eef4ff' : '#fff', fontSize: 9, fontWeight: 800 }}>
                        {index < registerStep ? '✓' : `0${index + 1}`}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 3, marginTop: 11, borderRadius: 10, overflow: 'hidden', background: '#edf1f7' }}>
                  <div style={{ width: `${((registerStep + 1) / 3) * 100}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg,#2474ed,#765ff5)', transition: 'width .2s ease' }} />
                </div>
              </div>
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, pt: '20px !important', maxHeight: 'min(58vh, 480px)', overflowY: 'auto' }}>
              {registrationError && (
                <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }} onClose={() => { setLocalError(null); setOauthErrorCode(null); }}>
                  {registrationError}
                </Alert>
              )}
              {registerStep === 0 && (
                <div style={{ paddingTop: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <label style={{ ...s.label, marginBottom: 0, color: '#26344b', fontSize: 13, letterSpacing: 0, textTransform: 'none' }}>{t.login.professionQuestion}</label>
                    <span style={{ color: '#98a3b5', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{t.login.stepLabel.toUpperCase()} 1 / 3</span>
                  </div>
                  <p style={{ margin: '5px 0 12px', color: '#8591a4', fontSize: 12 }}>{t.login.professionHelp}</p>
                  <Select
                    fullWidth
                    required
                    autoFocus
                    displayEmpty
                    value={profession}
                    onChange={e => setProfession(isOnboardingProfileId(e.target.value) ? e.target.value : '')}
                    inputProps={{ 'aria-label': t.login.profession }}
                    data-testid="registration-profession"
                    renderValue={(selected) => {
                      if (!selected) return <span style={{ color: '#8b96a8', fontSize: 13 }}>{t.login.professionPlaceholder}</span>;
                      const visual = professionVisuals[selected];
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <ProfessionMark visual={visual} size={36} />
                          <span style={{ color: '#25344c', fontSize: 13, fontWeight: 700 }}>{t.onboarding.types[selected].label}</span>
                        </span>
                      );
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          mt: 0.75,
                          maxHeight: 330,
                          border: '1px solid #e3eaf4',
                          borderRadius: 3,
                          boxShadow: '0 18px 46px rgba(31,53,92,.16)',
                          '& .MuiList-root': { p: 0.75 },
                        },
                      },
                    }}
                    sx={{
                      minHeight: 60,
                      borderRadius: '14px',
                      background: '#fbfdff',
                      boxShadow: '0 0 0 3px rgba(63,115,225,.06)',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d5dfef' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9ab2df' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#6192ed', borderWidth: 1 },
                      '& .MuiSelect-select': { display: 'flex', alignItems: 'center', minHeight: '44px !important', py: '7px', px: '12px' },
                    }}
                  >
                    {ONBOARDING_PROFILE_IDS.map((value) => {
                      const visual = professionVisuals[value];
                      const selected = profession === value;
                      return (
                        <MenuItem
                          key={value}
                          value={value}
                          selected={selected}
                          sx={{
                            display: 'flex',
                            gap: 1.25,
                            minHeight: 58,
                            my: 0.25,
                            px: 1.25,
                            border: '1px solid transparent',
                            borderRadius: 2,
                            '&.Mui-selected': { borderColor: '#dce7fb', backgroundColor: '#f3f7ff' },
                            '&.Mui-selected:hover': { backgroundColor: '#edf4ff' },
                            '&:hover': { backgroundColor: '#f6f8fc' },
                          }}
                        >
                          <ProfessionMark visual={visual} size={34} />
                          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 3 }}>
                            <span style={{ color: '#25344c', fontSize: 13, fontWeight: 700 }}>{t.onboarding.types[value].label}</span>
                            <span style={{ color: '#8793a6', fontSize: 10, lineHeight: 1.35, whiteSpace: 'normal' }}>{t.onboarding.types[value].description}</span>
                          </span>
                          {selected && <span aria-hidden="true" style={{ color: '#3269d7', fontSize: 15, fontWeight: 800 }}>✓</span>}
                        </MenuItem>
                      );
                    })}
                  </Select>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '13px 0 0', color: '#8995a9', fontSize: 11 }}>
                    <span style={{ color: '#617fe1' }}>✦</span> {t.login.professionChangeLater}
                  </p>
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
            <DialogActions sx={{ px: { xs: 2.5, sm: 4 }, pb: { xs: 2.5, sm: 3 }, pt: 2, gap: 1, borderTop: '1px solid #eef1f6', mx: { xs: 2.5, sm: 4 }, mt: 1 }}>
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
