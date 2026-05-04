import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Container, CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useLocation } from 'wouter';

interface InviteInfo {
  valid: boolean;
  adminName?: string;
  expiresAt?: string;
  message?: string;
}

export default function InviteRegister({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data) => { setInfo(data); setLoading(false); })
      .catch(() => { setInfo({ valid: false, message: 'Errore di rete' }); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('La password deve essere di almeno 6 caratteri'); return; }
    if (password !== confirmPassword) { setError('Le password non coincidono'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Errore durante la registrazione'); return; }
      setDone(true);
      setTimeout(() => { window.location.href = '/app/'; }, 2500);
    } catch {
      setError('Errore di rete. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box component="img" src="/taskdesk-logo.png" alt="TaskDesk" sx={{ height: 44, width: 'auto', mb: 1 }} />
          <Typography color="text.secondary">Sistema di ticketing aziendale</Typography>
        </Box>

        <Card elevation={3}>
          <CardContent sx={{ p: 4 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !info?.valid ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {info?.message ?? 'Link di invito non valido o scaduto.'}
              </Alert>
            ) : done ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Registrazione completata!
                </Typography>
                <Typography color="text.secondary">
                  Accesso in corso...
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Sei stato invitato da <Box component="span" sx={{ color: 'primary.main' }}>{info.adminName}</Box>
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Crea il tuo account per accedere al sistema di ticketing.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Nome e cognome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    fullWidth
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    helperText="Minimo 6 caratteri"
                    required
                    fullWidth
                  />
                  <TextField
                    label="Conferma password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={submitting}
                    sx={{ mt: 1 }}
                  >
                    {submitting ? <CircularProgress size={22} color="inherit" /> : 'Crea account'}
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
