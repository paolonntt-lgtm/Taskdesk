import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Alert, Paper, Container } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      // L'errore è gestito nel contesto
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="sm">
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Typography variant="h4" component="h1" fontWeight="bold" color="primary" gutterBottom>
                Ticket Manager
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Accedi per gestire i ticket IT e operativi
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label="Indirizzo Email"
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
                label="Password"
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
                {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </form>

            <Paper sx={{ mt: 4, p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }} elevation={0}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Credenziali Demo:
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Admin:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>admin@example.com / admin123</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Utente:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>utente@example.com / user123</Typography>
              </Box>
            </Paper>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
