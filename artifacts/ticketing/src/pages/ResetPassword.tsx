import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Container, CircularProgress,
} from '@mui/material';
import { LockReset, CheckCircle } from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const tr = t.resetPassword;
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    if (tok) {
      setToken(tok);
    } else {
      setTokenMissing(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(tr.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(tr.passwordMismatch);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tr.resetError);
        return;
      }
      setSuccess(true);
    } catch {
      setError(tr.networkRetry);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 40%, #fdf2f8 100%)',
      py: 4,
    }}>
      <Container maxWidth="xs">
        <Card elevation={0} sx={{
          border: '1px solid #f3f4f6',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(37,99,235,0.10), 0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Box component="img" src="/taskdesk-logo.svg" alt="TaskDesk"
                sx={{ height: 44, width: 'auto', mx: 'auto', mb: 2, display: 'block' }} />
              <Typography variant="h6" fontWeight={700} mb={0.5}>
                {tr.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tr.subtitle}
              </Typography>
            </Box>

            {tokenMissing ? (
              <Alert severity="error" sx={{ borderRadius: '12px' }}>
                {tr.invalidLink}
              </Alert>
            ) : success ? (
              <Box textAlign="center">
                <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" fontWeight={700} mb={1}>{tr.successTitle}</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  {tr.successSubtitle}
                </Typography>
                <Button
                  variant="contained" fullWidth size="large"
                  sx={{ py: 1.5, fontWeight: 700, borderRadius: '12px' }}
                  onClick={() => setLocation('/login')}
                >
                  {tr.goToLogin}
                </Button>
              </Box>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                <TextField
                  label={tr.newPassword} type="password" fullWidth margin="normal"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoFocus helperText={tr.passwordHint}
                  autoComplete="new-password"
                />
                <TextField
                  label={tr.confirmPassword} type="password" fullWidth margin="normal"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={confirmPassword.length > 0 && password !== confirmPassword ? tr.passwordMismatch : ''}
                  autoComplete="new-password"
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit" variant="contained" fullWidth size="large"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LockReset />}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: '0.95rem', borderRadius: '12px' }}
                >
                  {isSubmitting ? tr.updating : tr.submit}
                </Button>
                <Box mt={2} textAlign="center">
                  <Typography
                    variant="body2" sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => setLocation('/login')}
                  >
                    {tr.backToLogin}
                  </Typography>
                </Box>
              </form>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
