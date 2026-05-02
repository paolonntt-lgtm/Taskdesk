import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Alert, Paper, Container } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lang } from '../i18n/translations';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

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
                Ticket Manager
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t.login.subtitle}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
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

            <Paper sx={{ mt: 4, p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }} elevation={0}>
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
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
