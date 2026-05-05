import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Container, CircularProgress,
} from '@mui/material';
import { LockReset, CheckCircle } from '@mui/icons-material';
import { useLocation } from 'wouter';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    } else {
      setTokenMissing(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono');
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
        setError(data.message || 'Errore durante il reset');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Errore di rete. Riprova.');
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
              <Box component="img" src="/taskdesk-logo.png" alt="TaskDesk"
                sx={{ height: 44, width: 'auto', mx: 'auto', mb: 2, display: 'block' }} />
              <Typography variant="h6" fontWeight={700} mb={0.5}>
                Reimposta password
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scegli una nuova password per il tuo account
              </Typography>
            </Box>

            {tokenMissing ? (
              <Alert severity="error" sx={{ borderRadius: '12px' }}>
                Link non valido. Richiedi un nuovo link di reset dalla pagina di accesso.
              </Alert>
            ) : success ? (
              <Box textAlign="center">
                <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" fontWeight={700} mb={1}>Password aggiornata!</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Puoi ora accedere con la tua nuova password.
                </Typography>
                <Button
                  variant="contained" fullWidth size="large"
                  sx={{ py: 1.5, fontWeight: 700, borderRadius: '12px' }}
                  onClick={() => setLocation('/login')}
                >
                  Vai al login
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
                  label="Nuova password" type="password" fullWidth margin="normal"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoFocus helperText="Almeno 6 caratteri"
                  autoComplete="new-password"
                />
                <TextField
                  label="Conferma password" type="password" fullWidth margin="normal"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  error={confirmPassword.length > 0 && password !== confirmPassword}
                  helperText={confirmPassword.length > 0 && password !== confirmPassword ? 'Le password non coincidono' : ''}
                  autoComplete="new-password"
                  sx={{ mb: 3 }}
                />
                <Button
                  type="submit" variant="contained" fullWidth size="large"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LockReset />}
                  sx={{ py: 1.5, fontWeight: 700, fontSize: '0.95rem', borderRadius: '12px' }}
                >
                  {isSubmitting ? 'Aggiornamento…' : 'Reimposta password'}
                </Button>
                <Box mt={2} textAlign="center">
                  <Typography
                    variant="body2" sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => setLocation('/login')}
                  >
                    ← Torna al login
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
