import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Container, TextField, Typography,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface InviteInfo {
  valid: boolean;
  workspaceId?: number;
  workspaceName?: string;
  inviterName?: string;
  message?: string;
}

export default function WorkspaceInvite({ token }: { token: string }) {
  const { user, isLoading: authLoading, login, switchWorkspace } = useAuth();
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const it = lang === 'it';

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/workspace-invites/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || (it ? 'Link non valido o scaduto.' : 'This link is invalid or expired.'));
        if (!cancelled) setInfo(data);
      })
      .catch((reason) => {
        if (!cancelled) setInfo({ valid: false, message: reason.message });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, it]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login({ email, password });
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Accesso non riuscito.' : 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/workspace-invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || (it ? 'Impossibile unirsi allo spazio.' : 'Could not join the workspace.'));
      await switchWorkspace(data.workspace.id);
      setJoined(true);
      setLocation('/');
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Impossibile unirsi allo spazio.' : 'Could not join the workspace.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Container maxWidth="sm">
        <Card elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {loading || authLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : !info?.valid ? (
              <Alert severity="error">{info?.message || (it ? 'Link non valido o scaduto.' : 'This link is invalid or expired.')}</Alert>
            ) : (
              <>
                <Typography variant="overline" color="primary.main" fontWeight={700}>
                  {it ? 'Invito a uno spazio condiviso' : 'Shared workspace invitation'}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                  {info.workspaceName}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                  {it ? `${info.inviterName} ti invita a collaborare in questo spazio.` : `${info.inviterName} invited you to collaborate in this workspace.`}
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {user ? (
                  <>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {it ? `Accesso effettuato come ${user.email}.` : `Signed in as ${user.email}.`}
                    </Typography>
                    <Button fullWidth variant="contained" onClick={handleAccept} disabled={busy || joined}>
                      {busy ? <CircularProgress size={22} color="inherit" /> : (it ? 'Entra nello spazio' : 'Join workspace')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {it ? 'Accedi con il tuo account TaskDesk già attivo. Questo link non crea nuovi account.' : 'Sign in with your existing active TaskDesk account. This link does not create new accounts.'}
                    </Typography>
                    <Box component="form" onSubmit={handleLogin} sx={{ display: 'grid', gap: 2 }}>
                      <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required fullWidth />
                      <TextField label={it ? 'Password' : 'Password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required fullWidth />
                      <Button type="submit" variant="contained" disabled={busy}>
                        {busy ? <CircularProgress size={22} color="inherit" /> : (it ? 'Accedi per continuare' : 'Sign in to continue')}
                      </Button>
                    </Box>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
