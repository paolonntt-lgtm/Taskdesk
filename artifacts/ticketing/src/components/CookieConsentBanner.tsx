import { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { useLanguage } from '../contexts/LanguageContext';

const CONSENT_KEY = 'td_cookie_consent_v1';
const GOOGLE_ANALYTICS_ID = 'G-TW2H7Y4P9T';

type CookieConsent = 'accepted' | 'rejected' | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function setAnalyticsDisabled(disabled: boolean) {
  const windowWithAnalyticsFlag = window as unknown as Window & Record<string, unknown>;
  windowWithAnalyticsFlag[`ga-disable-${GOOGLE_ANALYTICS_ID}`] = disabled;
}

function loadGoogleAnalytics() {
  if (document.querySelector('script[data-taskdesk-google-analytics]')) return;

  setAnalyticsDisabled(false);
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_ID, { anonymize_ip: true });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  script.dataset.taskdeskGoogleAnalytics = 'true';
  document.head.appendChild(script);
}

function removeGoogleAnalytics() {
  setAnalyticsDisabled(true);
  document.querySelector('script[data-taskdesk-google-analytics]')?.remove();

  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.trim().split('=')[0];
    if (!name || (name !== '_ga' && !name.startsWith('_ga_'))) return;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
  });
}

export default function CookieConsentBanner() {
  const { lang } = useLanguage();
  const [consent, setConsent] = useState<CookieConsent>(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);
      return saved === 'accepted' || saved === 'rejected' ? saved : null;
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState(consent === null);

  useEffect(() => {
    if (consent === 'accepted') loadGoogleAnalytics();
  }, [consent]);

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener('td-open-cookie-settings', openSettings);
    return () => window.removeEventListener('td-open-cookie-settings', openSettings);
  }, []);

  const saveConsent = (value: Exclude<CookieConsent, null>) => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* continue for restricted browsers */ }
    if (value === 'accepted') loadGoogleAnalytics();
    else removeGoogleAnalytics();
    setConsent(value);
    setOpen(false);
  };

  if (!open) return null;

  const privacyHref = `${window.location.origin}/it/privacy-policy`;
  const cookieHref = `${window.location.origin}/it/cookie-policy`;
  const isItalian = lang === 'it';

  return (
    <Paper
      role="dialog"
      aria-label={isItalian ? 'Preferenze cookie' : 'Cookie preferences'}
      elevation={10}
      sx={{
        position: 'fixed',
        left: { xs: 12, sm: 24 },
        right: { xs: 12, sm: 24 },
        bottom: { xs: 12, sm: 24 },
        zIndex: 1600,
        p: { xs: 2, sm: 2.5 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        maxWidth: 960,
        mx: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            {isItalian ? 'Preferenze cookie' : 'Cookie preferences'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
            {isItalian
              ? 'Usiamo il cookie tecnico di sessione per mantenere il login. Con il tuo consenso possiamo usare Google Analytics per capire come viene utilizzata la piattaforma.'
              : 'We use a technical session cookie to keep you signed in. With your consent, we may use Google Analytics to understand how the platform is used.'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            <a href={privacyHref}>{isItalian ? 'Privacy policy' : 'Privacy policy'}</a>
            {' · '}
            <a href={cookieHref}>{isItalian ? 'Cookie policy' : 'Cookie policy'}</a>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: { xs: 'flex-end', sm: 'initial' } }}>
          <Button size="small" variant="outlined" onClick={() => saveConsent('rejected')}>
            {isItalian ? 'Rifiuta' : 'Reject'}
          </Button>
          <Button size="small" variant="contained" onClick={() => saveConsent('accepted')}>
            {isItalian ? 'Accetta' : 'Accept'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}