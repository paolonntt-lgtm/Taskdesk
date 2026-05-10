import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Avatar, Divider,
  CircularProgress, Alert, TextField, InputAdornment, Tooltip,
} from '@mui/material';
import { Business, Search, AdminPanelSettings, Person, AccessTime, ConfirmationNumber } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

interface OrgUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

interface Organization {
  id: number;
  name: string;
  createdAt: string | null;
  totalTickets: number;
  users: OrgUser[];
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale);
}

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return 'Mai';
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export default function SuperAdmin() {
  const { lang } = useLanguage();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const dateLocale = lang === 'it' ? 'it-IT' : 'en-GB';

  useEffect(() => {
    fetch('/api/superadmin', { credentials: 'include' })
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
  const totalTickets = orgs.reduce((sum, o) => sum + o.totalTickets, 0);

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
            {orgs.length} organizzazioni · {totalUsers} utenti attivi · {totalTickets} ticket totali
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
                    {org.users.length} {org.users.length === 1 ? 'utente' : 'utenti'} attivi ·{' '}
                    Registrata il {formatDate(org.createdAt, dateLocale)}
                  </Typography>
                </Box>
                {org.totalTickets > 0 && (
                  <Tooltip title="Ticket totali">
                    <Chip
                      icon={<ConfirmationNumber sx={{ fontSize: '14px !important' }} />}
                      label={org.totalTickets}
                      size="small"
                      color="primary"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                  </Tooltip>
                )}
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
                    sx={{ py: 0.75, px: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}
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
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {u.email}
                      </Typography>
                    </Box>
                    <Box textAlign="right" sx={{ flexShrink: 0 }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Iscritto {formatDate(u.createdAt, dateLocale)}
                      </Typography>
                      <Tooltip title="Ultimo login">
                        <Box display="flex" alignItems="center" gap={0.5} justifyContent="flex-end">
                          <AccessTime sx={{ fontSize: 11, color: u.lastLoginAt ? 'success.main' : 'text.disabled' }} />
                          <Typography
                            variant="caption"
                            sx={{ color: u.lastLoginAt ? 'success.main' : 'text.disabled' }}
                          >
                            {formatDateTime(u.lastLoginAt, dateLocale)}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
                {org.users.length === 0 && (
                  <Box display="flex" alignItems="center" gap={1} sx={{ py: 0.5, px: 1, color: 'text.disabled' }}>
                    <Person fontSize="small" />
                    <Typography variant="caption">Nessun utente attivo</Typography>
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
