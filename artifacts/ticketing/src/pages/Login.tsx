import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Container,
  Divider,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../i18n/translations';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, error } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m); setLocalError(null);
    setEmail(''); setPassword(''); setName(''); setConfirmPassword('');
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
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLocalError(data.message || 'Errore durante la registrazione'); return; }
      await login({ email, password });
    } catch { setLocalError('Errore di rete. Riprova.'); }
    finally { setIsSubmitting(false); }
  };

  const displayError = localError || (mode === 'login' ? error : null);

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 40%, #fdf2f8 100%)',
      py: 4, position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <Box sx={{ position: 'absolute', top: -60, right: -60, width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(37,99,235,0.12)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', top: 40, right: 40, width: 260, height: 260, borderRadius: '50%', border: '1px solid rgba(124,58,237,0.10)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -40, left: -40, width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(219,39,119,0.08)', pointerEvents: 'none' }} />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Language toggle */}
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button
            size="small"
            onClick={() => setLang(lang === 'it' ? 'en' : 'it' as Lang)}
            sx={{
              minWidth: 0, px: 1.5, fontWeight: 700, fontSize: '0.7rem',
              border: '1.5px solid #e5e7eb', borderRadius: '8px', letterSpacing: '0.05em',
              color: '#6b7280',
              '&:hover': { borderColor: '#2563eb', color: '#2563eb', bgcolor: 'transparent' },
            }}
          >
            {lang === 'it' ? 'EN' : 'IT'}
          </Button>
        </Box>

        <Card elevation={0} sx={{
          border: '1px solid #f3f4f6',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(37,99,235,0.10), 0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            {/* Logo */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Box sx={{
                width: 52, height: 52, borderRadius: '14px',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2,
                boxShadow: '0 8px 24px rgba(37,99,235,0.30)',
              }}>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>T</Typography>
              </Box>
              <Typography variant="h5" fontWeight={800} letterSpacing="-0.01em" gutterBottom>
                TaskDesk
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mode === 'login' ? t.login.subtitle : t.login.registerSubtitle}
              </Typography>
            </Box>

            {displayError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setLocalError(null)}>
                {displayError}
              </Alert>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin}>
                <TextField
                  label={t.login.email} type="email" fullWidth margin="normal"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required variant="outlined" autoComplete="email"
                />
                <TextField
                  label={t.login.password} type="password" fullWidth margin="normal"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required variant="outlined" autoComplete="current-password"
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit" variant="contained" color="primary"
                  fullWidth size="large" disabled={isSubmitting}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: '0.95rem', borderRadius: '12px' }}
                >
                  {isSubmitting ? t.login.submitting : t.login.submit}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <TextField
                  label={t.login.name} type="text" fullWidth margin="normal"
                  value={name} onChange={(e) => setName(e.target.value)}
                  required variant="outlined" autoComplete="name" autoFocus
                />
                <TextField
                  label={t.login.email} type="email" fullWidth margin="normal"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required variant="outlined" autoComplete="email"
                />
                <TextField
                  label={t.login.password} type="password" fullWidth margin="normal"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required variant="outlined" autoComplete="new-password"
                  helperText={t.login.passwordTooShort}
                />
                <TextField
                  label={t.login.confirmPassword} type="password" fullWidth margin="normal"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required variant="outlined" autoComplete="new-password"
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={confirmPassword.length > 0 && password !== confirmPassword ? t.login.passwordMismatch : ''}
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit" variant="contained" color="primary"
                  fullWidth size="large" disabled={isSubmitting}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: '0.95rem', borderRadius: '12px' }}
                >
                  {isSubmitting ? t.login.registering : t.login.registerSubmit}
                </Button>
              </form>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: 'center' }}>
              {mode === 'login' ? (
                <Typography variant="body2" color="text.secondary">
                  {t.login.noAccount}{' '}
                  <Typography component="span" variant="body2"
                    sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => switchMode('register')}>
                    {t.login.registerLink}
                  </Typography>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t.login.hasAccount}{' '}
                  <Typography component="span" variant="body2"
                    sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => switchMode('login')}>
                    {t.login.loginLink}
                  </Typography>
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
