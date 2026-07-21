import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  Box,
  TextField,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  ConfirmationNumber,
  Business,
  Person,
  Search,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useAuth } from '../contexts/AuthContext';

interface TicketResult {
  id: number;
  ticketNumber: number | null;
  title: string;
  status: string;
  priority: string;
}

interface ClientResult {
  id: number;
  name: string;
  email: string | null;
}

interface UserResult {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SearchResults {
  tickets: TicketResult[];
  clients: ClientResult[];
  users: UserResult[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type ResultItem =
  | { kind: 'ticket'; data: TicketResult }
  | { kind: 'client'; data: ClientResult }
  | { kind: 'user'; data: UserResult };

function statusChipColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'open': return 'info';
    case 'in_progress': return 'warning';
    case 'resolved': return 'success';
    case 'closed': return 'default';
    default: return 'default';
  }
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatItems = useCallback((): ResultItem[] => {
    if (!results) return [];
    const items: ResultItem[] = [];
    for (const t of results.tickets) items.push({ kind: 'ticket', data: t });
    for (const c of results.clients) items.push({ kind: 'client', data: c });
    for (const u of results.users) items.push({ kind: 'user', data: u });
    return items;
  }, [results]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=5`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data: SearchResults = await res.json();
          setResults(data);
          setActiveIndex(0);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const navigate = useCallback((item: ResultItem) => {
    if (item.kind === 'ticket') setLocation(`/tickets/${item.data.id}`);
    else if (item.kind === 'client') setLocation(`/clients/${item.data.id}`);
    else if (item.kind === 'user') setLocation('/settings?tab=users');
    onClose();
  }, [setLocation, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = flatItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) navigate(item);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flatItems, activeIndex, navigate, onClose]);

  const hasResults = results && (
    results.tickets.length > 0 || results.clients.length > 0 || results.users.length > 0
  );
  const noResults = results && !hasResults;

  const cp = t.commandPalette;

  let globalIdx = 0;

  const renderTicket = (ticket: TicketResult) => {
    const idx = globalIdx++;
    return (
      <ListItemButton
        key={`ticket-${ticket.id}`}
        selected={activeIndex === idx}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigate({ kind: 'ticket', data: ticket })}
        sx={{ borderRadius: '8px', py: 0.75, px: 1.5, mx: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'primary.main' }}>
          <ConfirmationNumber fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={ticket.title}
          secondary={ticket.ticketNumber ? `#${ticket.ticketNumber}` : `#${ticket.id}`}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem', fontWeight: 500 }}
          secondaryTypographyProps={{ fontSize: '0.75rem' }}
        />
        <Chip
          label={ticket.status}
          size="small"
          color={statusChipColor(ticket.status)}
          sx={{ fontSize: '0.65rem', height: 20, ml: 1 }}
        />
      </ListItemButton>
    );
  };

  const renderClient = (client: ClientResult) => {
    const idx = globalIdx++;
    return (
      <ListItemButton
        key={`client-${client.id}`}
        selected={activeIndex === idx}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigate({ kind: 'client', data: client })}
        sx={{ borderRadius: '8px', py: 0.75, px: 1.5, mx: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'secondary.main' }}>
          <Business fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={client.name}
          secondary={client.email ?? undefined}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem', fontWeight: 500 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
        />
      </ListItemButton>
    );
  };

  const renderUser = (u: UserResult) => {
    const idx = globalIdx++;
    return (
      <ListItemButton
        key={`user-${u.id}`}
        selected={activeIndex === idx}
        onMouseEnter={() => setActiveIndex(idx)}
        onClick={() => navigate({ kind: 'user', data: u })}
        sx={{ borderRadius: '8px', py: 0.75, px: 1.5, mx: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
          <Person fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={u.name}
          secondary={u.email}
          primaryTypographyProps={{ noWrap: true, fontSize: '0.875rem', fontWeight: 500 }}
          secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
        />
      </ListItemButton>
    );
  };

  const clientsEnabled = (user as any)?.clientsEnabled !== false;
  const isAdmin = user?.role === 'admin';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: '16px',
          mt: { xs: 4, sm: '10vh' },
          mx: { xs: 1, sm: 'auto' },
          alignSelf: 'flex-start',
          overflow: 'hidden',
        },
      }}
      sx={{ alignItems: 'flex-start' }}
    >
      <Box onKeyDown={handleKeyDown}>
        <Box sx={{ p: 1.5, pb: 0 }}>
          <TextField
            inputRef={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={cp?.placeholder ?? 'Search...'}
            fullWidth
            variant="outlined"
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? (
                    <CircularProgress size={18} />
                  ) : (
                    <Search sx={{ color: 'text.disabled' }} />
                  )}
                </InputAdornment>
              ),
              sx: {
                borderRadius: '10px',
                fontSize: '1rem',
              },
            }}
          />
        </Box>

        {query.trim() && !loading && noResults && (
          <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              {cp?.noResults ? cp.noResults(query.trim()) : `No results for "${query.trim()}"`}
            </Typography>
          </Box>
        )}

        {hasResults && (
          <Box sx={{ pb: 1, pt: 0.5, maxHeight: '60vh', overflowY: 'auto' }}>
            {results!.tickets.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 0.5, display: 'block', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}
                >
                  {cp?.groupTickets ?? entityTerm.plural}
                </Typography>
                <List dense disablePadding>
                  {results!.tickets.map(renderTicket)}
                </List>
              </>
            )}

            {clientsEnabled && results!.clients.length > 0 && (
              <>
                {results!.tickets.length > 0 && <Divider sx={{ my: 0.5, mx: 2 }} />}
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 0.5, display: 'block', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}
                >
                  {cp?.groupClients ?? 'Clients'}
                </Typography>
                <List dense disablePadding>
                  {results!.clients.map(renderClient)}
                </List>
              </>
            )}

            {isAdmin && results!.users.length > 0 && (
              <>
                {(results!.tickets.length > 0 || results!.clients.length > 0) && (
                  <Divider sx={{ my: 0.5, mx: 2 }} />
                )}
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 0.5, display: 'block', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}
                >
                  {cp?.groupUsers ?? 'Users'}
                </Typography>
                <List dense disablePadding>
                  {results!.users.map(renderUser)}
                </List>
              </>
            )}
          </Box>
        )}

        {!query.trim() && (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="caption" color="text.disabled">
              {cp?.hint ?? 'Type to search tickets, clients and users'}
            </Typography>
          </Box>
        )}

        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2 }}>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="kbd" sx={{ px: 0.5, py: 0.25, borderRadius: '4px', border: '1px solid', borderColor: 'divider', fontSize: '0.65rem', fontFamily: 'monospace' }}>↑↓</Box>
            {cp?.keyNav ?? 'navigate'}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="kbd" sx={{ px: 0.5, py: 0.25, borderRadius: '4px', border: '1px solid', borderColor: 'divider', fontSize: '0.65rem', fontFamily: 'monospace' }}>↵</Box>
            {cp?.keySelect ?? 'open'}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="kbd" sx={{ px: 0.5, py: 0.25, borderRadius: '4px', border: '1px solid', borderColor: 'divider', fontSize: '0.65rem', fontFamily: 'monospace' }}>Esc</Box>
            {cp?.keyClose ?? 'close'}
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
