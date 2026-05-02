import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
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
    setMode(m);
    setLocalError(null);
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 6) {
      setLocalError(t.login.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError(t.login.passwordMismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data.message || 'Errore durante la registrazione');
        return;
      }
      await login({ email, password });
    } catch {
      setLocalError('Errore di rete. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || (mode === 'login' ? error : null);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Box display="flex" justifyContent="flex-end" mb={1}>
          <Button
            size="small"
            onClick={() => setLang(lang === 'it' ? 'en' : 'it' as Lang)}
            variant="outlined"
            sx={{ minWidth: 0, px: 1.5, fontWeight: 'bold', fontSize: '0.75rem', letterSpacing: 1 }}
          >
            {lang === 'it' ? 'EN' : 'IT'}
          </Button>
        </Box>

        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Typography variant="h4" component="h1" fontWeight="bold" color="primary" gutterBottom>
                TaskDesk
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {mode === 'login' ? t.login.subtitle : t.login.registerSubtitle}
              </Typography>
            </Box>

            {displayError && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setLocalError(null)}>
                {displayError}
              </Alert>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin}>
                <TextField
                  label={t.login.email}
                  type="email"
                  fullWidth
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="email"
                />
                <TextField
                  label={t.login.password}
                  type="password"
                  fullWidth
                  margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="current-password"
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={isSubmitting}
                  sx={{ py: 1.5, fontWeight: 'bold' }}
                >
                  {isSubmitting ? t.login.submitting : t.login.submit}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <TextField
                  label={t.login.name}
                  type="text"
                  fullWidth
                  margin="normal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="name"
                  autoFocus
                />
                <TextField
                  label={t.login.email}
                  type="email"
                  fullWidth
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="email"
                />
                <TextField
                  label={t.login.password}
                  type="password"
                  fullWidth
                  margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="new-password"
                  helperText={t.login.passwordTooShort}
                />
                <TextField
                  label={t.login.confirmPassword}
                  type="password"
                  fullWidth
                  margin="normal"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  variant="outlined"
                  autoComplete="new-password"
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={confirmPassword.length > 0 && password !== confirmPassword ? t.login.passwordMismatch : ''}
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  disabled={isSubmitting}
                  sx={{ py: 1.5, fontWeight: 'bold' }}
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
                  <Typography
                    component="span"
                    variant="body2"
                    color="primary"
                    sx={{ cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => switchMode('register')}
                  >
                    {t.login.registerLink}
                  </Typography>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t.login.hasAccount}{' '}
                  <Typography
                    component="span"
                    variant="body2"
                    color="primary"
                    sx={{ cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => switchMode('login')}
                  >
                    {t.login.loginLink}
                  </Typography>
                </Typography>
              )}
            </Box>

            {mode === 'login' && (
              <Paper sx={{ mt: 3, p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }} elevation={0}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {t.login.demoCredentials}:
                </Typography>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Admin:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    admin@example.com / admin123
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">{t.login.userLabel}:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    utente@example.com / user123
                  </Typography>
                </Box>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
