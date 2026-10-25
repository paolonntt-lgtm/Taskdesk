import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Alert, Container, CircularProgress,
} from '@mui/material';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import InviteWelcome from '../components/InviteWelcome';
import { trackEvent } from '../lib/analytics';

interface InviteInfo {
  valid: boolean;
  adminName?: string;
  orgName?: string | null;
  expiresAt?: string;
  message?: string;
}

export default function InviteRegister({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const tr = t.inviteRegister;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data) => { setInfo(data); setLoading(false); })
      .catch(() => { setInfo({ valid: false, message: tr.networkError }); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError(tr.passwordTooShort); return; }
    if (password !== confirmPassword) { setError(tr.passwordMismatch); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || tr.registrationError); return; }
      trackEvent('invitation_registration_succeeded');
      setShowWelcome(true);
    } catch {
      setError(tr.networkRetry);
    } finally {
      setSubmitting(false);
    }
  };

  if (showWelcome) {
    return (
      <InviteWelcome
        orgName={info?.orgName ?? null}
        adminName={info?.adminName ?? 'Admin'}
        onStart={() => { window.location.href = '/app/'; }}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box component="img" src="/taskdesk-logo.svg" alt="TaskDesk" sx={{ height: 44, width: 'auto', mx: 'auto', display: 'block', mb: 1 }} />
          <Typography color="text.secondary">{tr.tagline}</Typography>
        </Box>

        <Card elevation={3}>
          <CardContent sx={{ p: 4 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !info?.valid ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {info?.message ?? tr.invalidLink}
              </Alert>
            ) : (
              <>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {tr.invitedBy} <Box component="span" sx={{ color: 'primary.main' }}>{info.adminName}</Box>
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  {tr.createAccountPrompt}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label={tr.fullName}
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
                    helperText={tr.passwordHint}
                    required
                    fullWidth
                  />
                  <TextField
                    label={tr.confirmPassword}
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
                    {submitting ? <CircularProgress size={22} color="inherit" /> : tr.createAccount}
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
