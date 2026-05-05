import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Avatar, Divider,
  CircularProgress, Alert, TextField, InputAdornment, Tooltip,
} from '@mui/material';
import { Business, Search, Person, AdminPanelSettings } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

interface OrgUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string | null;
  avatarUrl: string | null;
}

interface Organization {
  id: number;
  name: string;
  createdAt: string | null;
  users: OrgUser[];
}

export default function Subscribers() {
  const { lang } = useLanguage();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const dateLocale = lang === 'it' ? 'it-IT' : 'en-GB';

  useEffect(() => {
    fetch('/api/superadmin/subscribers', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Accesso negato');
        return r.json();
      })
      .then((data) => { setOrgs(data.organizations); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = orgs.filter((org) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      org.name.toLowerCase().includes(q) ||
      org.users.some(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    );
  });

  const totalUsers = orgs.reduce((sum, o) => sum + o.users.length, 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3} display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Iscritti</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {orgs.length} organizzazioni · {totalUsers} utenti totali
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Cerca organizzazione o utente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
      </Box>

      {filtered.length === 0 && (
        <Alert severity="info">Nessun risultato trovato.</Alert>
      )}

      <Box display="flex" flexDirection="column" gap={2}>
        {filtered.map((org) => (
          <Card key={org.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              {/* Org header */}
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Box
                  sx={{
                    width: 38, height: 38, borderRadius: 1.5,
                    bgcolor: 'primary.main', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Business sx={{ color: '#fff', fontSize: 20 }} />
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography variant="subtitle1" fontWeight={700} noWrap>
                    {org.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {org.users.length} {org.users.length === 1 ? 'utente' : 'utenti'} ·{' '}
                    Registrata il{' '}
                    {org.createdAt
                      ? new Date(org.createdAt).toLocaleDateString(dateLocale)
                      : '—'}
                  </Typography>
                </Box>
                <Chip
                  label={`#${org.id}`}
                  size="small"
                  sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary' }}
                  variant="outlined"
                />
              </Box>

              {org.users.length > 0 && <Divider sx={{ mb: 1.5 }} />}

              {/* Users */}
              <Box display="flex" flexDirection="column" gap={1}>
                {org.users.map((u) => (
                  <Box
                    key={u.id}
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                    sx={{
                      py: 0.75, px: 1, borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Avatar
                      src={u.avatarUrl ?? undefined}
                      sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'secondary.main' }}
                    >
                      {u.name.charAt(0)}
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Box display="flex" alignItems="center" gap={0.75}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {u.name}
                        </Typography>
                        {u.role === 'admin' && (
                          <Tooltip title="Admin organizzazione">
                            <AdminPanelSettings sx={{ fontSize: 15, color: 'primary.main' }} />
                          </Tooltip>
                        )}
                        {!u.isActive && (
                          <Chip label="Inattivo" size="small" color="default" sx={{ height: 18, fontSize: 10 }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {u.email}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString(dateLocale)
                        : '—'}
                    </Typography>
                  </Box>
                ))}
                {org.users.length === 0 && (
                  <Box display="flex" alignItems="center" gap={1} sx={{ py: 0.5, px: 1, color: 'text.disabled' }}>
                    <Person fontSize="small" />
                    <Typography variant="caption">Nessun utente</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
