import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, MenuItem, Button, Chip,
  Tooltip, IconButton, CircularProgress, Divider, Paper,
} from '@mui/material';
import { History, OpenInNew, Search, Clear } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'wouter';
import {
  useListAllClientNotes,
  useListUsers,
} from '@workspace/api-client-react';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}
function Section({ title, icon, children }: SectionProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        {icon}
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}

export default function ConsoleHistoryTab() {
  const { t, lang } = useLanguage();
  const ts = t.settings as Record<string, any>;
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState('');
  const [authorId, setAuthorId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const hasFilters = !!(search || authorId || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch('');
    setAuthorId('');
    setDateFrom('');
    setDateTo('');
    setDebouncedSearch('');
  };

  const { data: users = [] } = useListUsers();
  const { data: rawNotes = [], isLoading } = useListAllClientNotes({
    search: debouncedSearch || undefined,
    authorId: authorId ? Number(authorId) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
  });

  const notes = rawNotes as any[];
  const activeUsers = (users as any[]).filter((u) => u.active !== false);

  return (
    <Section title={ts.consoleHistoryTitle} icon={<History color="primary" />}>
      {/* Filters */}
      <Box display="flex" gap={1.5} mb={2.5} flexWrap="wrap" alignItems="flex-end">
        <TextField
          size="small"
          placeholder={ts.consoleHistorySearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ fontSize: 18, mr: 0.5, color: 'text.disabled' }} />,
          }}
          sx={{ minWidth: 200, flex: '1 1 200px' }}
        />

        <TextField
          select
          size="small"
          label={ts.consoleHistoryAuthor}
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          sx={{ minWidth: 180, flex: '0 0 auto' }}
        >
          <MenuItem value="">{ts.consoleHistoryAllAuthors}</MenuItem>
          {activeUsers.map((u: any) => (
            <MenuItem key={u.id} value={String(u.id)}>{u.name}</MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          type="date"
          label={ts.consoleHistoryDateFrom}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140, flex: '0 0 auto' }}
        />

        <TextField
          size="small"
          type="date"
          label={ts.consoleHistoryDateTo}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140, flex: '0 0 auto' }}
        />

        {hasFilters && (
          <Button
            size="small"
            startIcon={<Clear fontSize="small" />}
            onClick={clearFilters}
            variant="outlined"
            color="inherit"
            sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
          >
            {ts.consoleHistoryClear}
          </Button>
        )}
      </Box>

      {/* Results */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : notes.length === 0 ? (
        <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
          {ts.consoleHistoryEmpty}
        </Typography>
      ) : (
        <Box>
          {notes.map((note: any) => (
            <Box
              key={note.id}
              sx={{
                mb: 1,
                px: 1.75,
                py: 1.25,
                borderRadius: 2,
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box flex={1} minWidth={0}>
                  {/* Header row: client chip + author + date */}
                  <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap" mb={0.5}>
                    {note.clientName && (
                      <Chip
                        label={`@${note.clientSlug ?? note.clientName}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontSize: '0.7rem', height: 20, cursor: 'pointer' }}
                        onClick={() => note.clientId && setLocation(`/clients/${note.clientId}`)}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                      {note.authorName && (
                        <Box component="span" fontWeight={600}>{note.authorName}</Box>
                      )}
                      {note.authorName && ' · '}
                      {new Date(note.createdAt).toLocaleString(
                        lang === 'en' ? 'en-US' : 'it-IT',
                        { dateStyle: 'medium', timeStyle: 'short' },
                      )}
                      {note.monthOverride && (
                        <Box component="span" color="text.disabled"> · {note.monthOverride}</Box>
                      )}
                    </Typography>
                  </Box>

                  {/* Note body */}
                  <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}
                  >
                    {note.body}
                  </Typography>
                </Box>

                {/* Open client link */}
                {note.clientId && (
                  <Tooltip title={note.clientName ?? ''}>
                    <IconButton
                      size="small"
                      sx={{ flexShrink: 0, p: 0.5, mt: 0.25 }}
                      onClick={() => setLocation(`/clients/${note.clientId}`)}
                    >
                      <OpenInNew sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          ))}

          {/* Load more */}
          {notes.length >= limit && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Button size="small" onClick={() => setLimit((l) => l + 50)}>
                {ts.consoleHistoryLoadMore}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Section>
  );
}
