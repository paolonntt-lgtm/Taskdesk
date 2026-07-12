import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid,
  Tooltip, TableSortLabel, Collapse, IconButton, Checkbox, Toolbar, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
  Select, FormControl, InputLabel, OutlinedInput, ListItemText,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, CheckCircle, FilterList, FilterListOff, Delete as DeleteIcon, Email as EmailIcon } from '@mui/icons-material';
import { useListTickets, useListUsers, useListClients, useDeleteTicket, getListTicketsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearch, useLocation } from 'wouter';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useDebounce } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useTicketStatuses } from '../hooks/useTicketStatuses';
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { open: 0, waiting: 1, resolved: 2, closed: 3 };

type SortCol = 'id' | 'title' | 'category' | 'status' | 'priority' | 'assignee' | 'location' | 'createdAt' | 'client';
type SortDir = 'asc' | 'desc';

export default function TicketList() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const entityTerm = useEntityTerm();
  const isAdmin = user?.role === 'admin';
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const queryClient = useQueryClient();

  // ── Derive ALL filter values from the URL query string ──────────────────
  const { statuses: orgStatuses, getLabelForKey, getColorForKey } = useTicketStatuses();

  const urlParams = new URLSearchParams(searchStr);
  const validStatuses = orgStatuses.map((s) => s.key);

  // These must be declared before the useMemo hooks that normalise against them
  const [configuredLocations, setConfiguredLocations] = useState<string[]>([]);
  const [configuredCategories, setConfiguredCategories] = useState<string[]>([]);

  // Multi-value params — each is an array of selected values (empty = no filter = "all")
  // "all options selected" is normalised to empty (same as no filter)
  const statusValues: string[] = useMemo(() => {
    const raw = urlParams.get('status') ?? '';
    if (!raw) return [];
    const parts = raw.split(',').map((v) => v.trim()).filter(Boolean);
    const filtered = validStatuses.length === 0 ? parts : parts.filter((v) => validStatuses.includes(v));
    if (validStatuses.length > 0 && validStatuses.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, validStatuses.join(',')]);

  const priorityValues: string[] = useMemo(() => {
    const raw = urlParams.get('priority') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter((v) => VALID_PRIORITIES.includes(v));
    if (VALID_PRIORITIES.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

  const locationValues: string[] = useMemo(() => {
    const raw = urlParams.get('location') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter(Boolean);
    if (configuredLocations.length > 1 && configuredLocations.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, configuredLocations.join(',')]);

  const categoryValues: string[] = useMemo(() => {
    const raw = urlParams.get('category') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter(Boolean);
    if (configuredCategories.length > 0 && configuredCategories.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, configuredCategories.join(',')]);
  const dateFrom = urlParams.get('dateFrom') ?? '';
  const dateTo   = urlParams.get('dateTo') ?? '';
  const userFilter     = urlParams.get('userFilter') ?? 'all';
  const userFilterType = (urlParams.get('userFilterType') as 'assignedTo' | 'createdBy') || 'assignedTo';
  const emailOrigin    = urlParams.get('emailOrigin') === 'true';
  const clientIdFilter = urlParams.get('clientId') ?? 'all';
  const overdueFilter  = urlParams.get('overdue') === 'true';
  const sortCol  = (urlParams.get('sortCol') as SortCol) || 'id';
  const sortDir  = (urlParams.get('sortDir') as SortDir) || 'desc';

  const [searchInput, setSearchInput] = useState(urlParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: users } = useListUsers();
  const { data: clients } = useListClients();

  // ── Bulk selection state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const deleteTicket = useDeleteTicket();

  const hasExtraFilters = locationValues.length > 0 || categoryValues.length > 0 || !!dateFrom || !!dateTo || userFilter !== 'all' || emailOrigin || clientIdFilter !== 'all' || overdueFilter;
  const [showExtraManual, setShowExtraManual] = useState(false);
  const showExtra = showExtraManual || hasExtraFilters;

  const setParam = useCallback((key: string, value: string, empty = 'all') => {
    const next = new URLSearchParams(searchStr);
    if (!value || value === empty) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  }, [searchStr, navigate]);

  const setMultiParam = useCallback((key: string, values: string[], allOptions?: string[]) => {
    const next = new URLSearchParams(searchStr);
    // Treat "all options selected" the same as "nothing selected" — no filter applied
    const isAll = allOptions && allOptions.length > 0 && allOptions.every((v) => values.includes(v));
    if (values.length === 0 || isAll) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  }, [searchStr, navigate]);

  useEffect(() => {
    const next = new URLSearchParams(searchStr);
    if (debouncedSearch) {
      next.set('search', debouncedSearch);
    } else {
      next.delete('search');
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clearExtra = () => {
    const next = new URLSearchParams(searchStr);
    ['location', 'category', 'dateFrom', 'dateTo', 'userFilter', 'userFilterType', 'emailOrigin', 'clientId', 'overdue'].forEach((k) => next.delete(k));
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
    setShowExtraManual(false);
  };

  const handleSort = (col: SortCol) => {
    const next = new URLSearchParams(searchStr);
    if (sortCol === col) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc';
      newDir === 'desc' ? next.delete('sortDir') : next.set('sortDir', newDir);
    } else {
      next.set('sortCol', col);
      next.delete('sortDir');
    }
    if (col === 'id') next.delete('sortCol');
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  };

  useEffect(() => {
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setConfiguredLocations(d.value ?? []))
      .catch(() => {});
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setConfiguredCategories(d.value ?? []))
      .catch(() => {});
  }, []);

  const { data: tickets, isLoading } = useListTickets({
    search: debouncedSearch || undefined,
    status:   statusValues.length   > 0 ? statusValues.join(',')   : undefined,
    priority: priorityValues.length > 0 ? priorityValues.join(',') : undefined,
    location: locationValues.length > 0 ? locationValues.join(',') : undefined,
    category: categoryValues.length > 0 ? categoryValues.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    assignedTo: userFilter !== 'all' && userFilterType === 'assignedTo' ? parseInt(userFilter, 10) : undefined,
    createdBy:  userFilter !== 'all' && userFilterType === 'createdBy'  ? parseInt(userFilter, 10) : undefined,
    emailOrigin: emailOrigin || undefined,
    clientId: clientIdFilter !== 'all' ? parseInt(clientIdFilter, 10) : undefined,
    ...(overdueFilter ? { overdue: 'true' } : {}),
  } as any, { query: { refetchInterval: 30_000, refetchIntervalInBackground: false } as any });

  // Clear selection when tickets change (e.g. after delete or filter)
  useEffect(() => { setSelectedIds(new Set()); }, [tickets]);

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';
  const showLocation = configuredLocations.length !== 1;
  const showClient = (user as any)?.clientsEnabled !== false;

  const sortedTickets = useMemo(() => {
    if (!tickets) return [];
    return [...tickets].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'id':        cmp = a.id - b.id; break;
        case 'title':     cmp = a.title.localeCompare(b.title); break;
        case 'category':  cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'status':    cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99); break;
        case 'priority':  cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
        case 'assignee':  cmp = (a.assignee?.name || '').localeCompare(b.assignee?.name || ''); break;
        case 'location':  cmp = ((a as any).location || '').localeCompare((b as any).location || ''); break;
        case 'client':    cmp = ((a as any).client?.name || '').localeCompare((b as any).client?.name || ''); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tickets, sortCol, sortDir]);

  // ── Selection helpers ────────────────────────────────────────────────────
  const allVisibleIds = sortedTickets.map((t) => t.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteTicket.mutateAsync({ id });
      } catch {
        failed++;
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
    setDeleting(false);
    const succeeded = ids.length - failed;
    if (failed === 0) {
      setBulkFeedback({ type: 'success', msg: t.ticketList.bulkDeleteSuccess(succeeded) });
    } else if (succeeded > 0) {
      setBulkFeedback({ type: 'error', msg: t.ticketList.bulkDeletePartial(succeeded, failed) });
    } else {
      setBulkFeedback({ type: 'error', msg: t.ticketList.bulkDeleteError });
    }
    setTimeout(() => setBulkFeedback(null), 5000);
  };

  const col = (id: SortCol, label: string, sx?: object) => (
    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', ...sx }}>
      <TableSortLabel
        active={sortCol === id}
        direction={sortCol === id ? sortDir : 'asc'}
        onClick={() => handleSort(id)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const colSpanTotal = (showLocation ? 8 : 7) + (isAdmin ? 1 : 0);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1.5, sm: 3 }}>
        <Typography variant="h5" fontWeight="bold">{entityTerm.navAll}</Typography>
        <Button
          component={Link}
          href="/tickets/new"
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          size="small"
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{entityTerm.navNew}</Box>
        </Button>
      </Box>

      {/* Overdue filter banner */}
      {overdueFilter && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setParam('overdue', '', 'true')}>
              {lang === 'it' ? 'Rimuovi filtro' : 'Clear filter'}
            </Button>
          }
        >
          {lang === 'it' ? 'Filtro attivo: ticket scaduti (con scadenza passata, non risolti)' : 'Active filter: overdue tickets (past due date, not resolved)'}
        </Alert>
      )}

      {/* Bulk feedback */}
      {bulkFeedback && (
        <Alert severity={bulkFeedback.type} sx={{ mb: 2 }} onClose={() => setBulkFeedback(null)}>
          {bulkFeedback.msg}
        </Alert>
      )}

      <Card sx={{ mb: { xs: 1.5, sm: 3 }, p: { xs: 1.5, sm: 2 } }}>
        {/* Row 1: search + stato + priorità + toggle */}
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder={lang === 'it' ? `Cerca ${entityTerm.pluralLower}...` : `Search ${entityTerm.pluralLower}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel shrink={statusValues.length > 0}>{t.ticketList.statusFilter}</InputLabel>
              <Select
                multiple
                displayEmpty
                value={statusValues}
                onChange={(e) => setMultiParam('status', e.target.value as string[], orgStatuses.map((s) => s.key))}
                input={<OutlinedInput notched={statusValues.length > 0} label={t.ticketList.statusFilter} />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allStatuses}</Box>;
                  return (
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                      {selected.map((v) => {
                        const customColor = getColorForKey(v);
                        const label = getLabelForKey(v) || v;
                        return (
                          <Chip
                            key={v}
                            label={label}
                            size="small"
                            onDelete={() => setMultiParam('status', statusValues.filter((s) => s !== v), orgStatuses.map((s) => s.key))}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={customColor ? { bgcolor: customColor, color: 'white', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } } : undefined}
                          />
                        );
                      })}
                    </Box>
                  );
                }}
              >
                {orgStatuses.map((s) => (
                  <MenuItem key={s.key} value={s.key} dense>
                    <Checkbox size="small" checked={statusValues.includes(s.key)} sx={{ py: 0 }} />
                    <ListItemText primary={s.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel shrink={priorityValues.length > 0}>{t.ticketList.priorityFilter}</InputLabel>
              <Select
                multiple
                displayEmpty
                value={priorityValues}
                onChange={(e) => setMultiParam('priority', e.target.value as string[], VALID_PRIORITIES)}
                input={<OutlinedInput notched={priorityValues.length > 0} label={t.ticketList.priorityFilter} />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allPriorities}</Box>;
                  return (
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                      {selected.map((v) => (
                        <Chip
                          key={v}
                          label={t.priority[v as keyof typeof t.priority] || v}
                          size="small"
                          onDelete={() => setMultiParam('priority', priorityValues.filter((p) => p !== v), VALID_PRIORITIES)}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ))}
                    </Box>
                  );
                }}
              >
                {VALID_PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p} dense>
                    <Checkbox size="small" checked={priorityValues.includes(p)} sx={{ py: 0 }} />
                    <ListItemText primary={t.priority[p as keyof typeof t.priority] || p} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm="auto" md={2}>
            <Button
              fullWidth size="small"
              variant={hasExtraFilters ? 'contained' : 'outlined'}
              color={hasExtraFilters ? 'primary' : 'inherit'}
              startIcon={<FilterList />}
              onClick={() => setShowExtraManual((v) => !v)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t.ticketList.moreFilters}
              {hasExtraFilters && ` (${[locationValues.length > 0, categoryValues.length > 0, !!dateFrom, !!dateTo, userFilter !== 'all', emailOrigin, clientIdFilter !== 'all', overdueFilter].filter(Boolean).length})`}
            </Button>
          </Grid>
        </Grid>

        {/* Row 2: advanced filters */}
        <Collapse in={showExtra}>
          <Grid container spacing={1.5} mt={0.25}>
            {configuredLocations.length > 1 && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink={locationValues.length > 0}>{t.ticketList.locationFilter}</InputLabel>
                  <Select
                    multiple
                    displayEmpty
                    value={locationValues}
                    onChange={(e) => setMultiParam('location', e.target.value as string[], configuredLocations)}
                    input={<OutlinedInput notched={locationValues.length > 0} label={t.ticketList.locationFilter} />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allLocations}</Box>;
                      return (
                        <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                          {selected.map((v) => (
                            <Chip
                              key={v}
                              label={v}
                              size="small"
                              onDelete={() => setMultiParam('location', locationValues.filter((l) => l !== v), configuredLocations)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      );
                    }}
                  >
                    {configuredLocations.map((loc) => (
                      <MenuItem key={loc} value={loc} dense>
                        <Checkbox size="small" checked={locationValues.includes(loc)} sx={{ py: 0 }} />
                        <ListItemText primary={loc} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {configuredCategories.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink={categoryValues.length > 0}>{t.ticketList.categoryFilter}</InputLabel>
                  <Select
                    multiple
                    displayEmpty
                    value={categoryValues}
                    onChange={(e) => setMultiParam('category', e.target.value as string[], configuredCategories)}
                    input={<OutlinedInput notched={categoryValues.length > 0} label={t.ticketList.categoryFilter} />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allCategories}</Box>;
                      return (
                        <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                          {selected.map((v) => (
                            <Chip
                              key={v}
                              label={v}
                              size="small"
                              onDelete={() => setMultiParam('category', categoryValues.filter((c) => c !== v), configuredCategories)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      );
                    }}
                  >
                    {configuredCategories.map((cat) => (
                      <MenuItem key={cat} value={cat} dense>
                        <Checkbox size="small" checked={categoryValues.includes(cat)} sx={{ py: 0 }} />
                        <ListItemText primary={cat} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {users && users.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={userFilterType === 'assignedTo' ? t.ticketList.userFilterAssigned : t.ticketList.userFilterCreated}
                  value={userFilter}
                  onChange={(e) => setParam('userFilter', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allUsers}</MenuItem>
                  {users.map((u: any) => (
                    <MenuItem key={u.id} value={String(u.id)}>{u.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {users && users.length > 0 && (
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.userFilterType}
                  value={userFilterType}
                  onChange={(e) => setParam('userFilterType', e.target.value, 'assignedTo')}
                >
                  <MenuItem value="assignedTo">{t.ticketList.userFilterAssigned}</MenuItem>
                  <MenuItem value="createdBy">{t.ticketList.userFilterCreated}</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small"
                label={t.ticketList.dateFrom}
                type="date"
                value={dateFrom}
                onChange={(e) => setParam('dateFrom', e.target.value, '')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small"
                label={t.ticketList.dateTo}
                type="date"
                value={dateTo}
                onChange={(e) => setParam('dateTo', e.target.value, '')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small"
                label={t.ticketList.originFilter}
                value={emailOrigin ? 'email' : 'all'}
                onChange={(e) => setParam('emailOrigin', e.target.value === 'email' ? 'true' : '', 'all')}
              >
                <MenuItem value="all">{t.ticketList.allOrigins}</MenuItem>
                <MenuItem value="email">{t.ticketList.emailOriginFilter}</MenuItem>
              </TextField>
            </Grid>
            {showClient && clients && clients.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.clientFilter}
                  value={clientIdFilter}
                  onChange={(e) => setParam('clientId', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allClients}</MenuItem>
                  {clients.map((c: any) => (
                    <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {hasExtraFilters && (
              <Grid item xs={12} sm="auto">
                <Button
                  size="small" color="inherit"
                  startIcon={<FilterListOff />}
                  onClick={clearExtra}
                >
                  {t.ticketList.clearFilters}
                </Button>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Card>

      <Card>
        {/* Bulk action toolbar — visible only when items are selected */}
        {isAdmin && selectedIds.size > 0 && (
          <Toolbar
            sx={{
              pl: 2, pr: 1,
              bgcolor: 'primary.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              minHeight: '48px !important',
              gap: 1,
            }}
          >
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
              {t.ticketList.bulkSelected(selectedIds.size)}
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t.ticketList.bulkDelete}
            </Button>
          </Toolbar>
        )}

        <Box sx={{ width: '100%' }}>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                {isAdmin && (
                  <TableCell padding="none" sx={{ width: 20, pl: 0.25, pr: 0 }}>
                    <Checkbox
                      size="small"
                      indeterminate={someSelected}
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={sortedTickets.length === 0}
                      sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 12 } }}
                    />
                  </TableCell>
                )}
                {col('id', t.ticketList.colId, { width: { xs: 28, sm: 48 }, px: { xs: 0.25, sm: 1 } })}
                {col('title', t.ticketList.colTitle, { px: { xs: 1.1, sm: 1 } })}
                {col('category', t.ticketList.colCategory, { display: { xs: 'none', md: 'table-cell' }, width: 110 })}
                {col('status', t.ticketList.colStatus, { width: { xs: 70, sm: 90 }, px: { xs: 0.25, sm: 1 } })}
                {col('priority', t.ticketList.colPriority, { display: { xs: 'none', sm: 'table-cell' }, width: 80 })}
                {col('assignee', t.ticketList.colAssignee, { display: { xs: 'none', lg: 'table-cell' }, width: 110 })}
                {showLocation && col('location', t.ticketList.colLocation, { display: { xs: 'none', md: 'table-cell' }, width: 90 })}
                {col('createdAt', t.ticketList.colCreated, { display: { xs: 'none', md: 'table-cell' }, width: 76 })}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpanTotal} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : sortedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpanTotal} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {lang === 'it'
                      ? `Nessun${entityTerm.articleIndef === 'una' ? 'a' : ''} ${entityTerm.singularLower} trovato${entityTerm.articleIndef === 'una' ? 'a' : ''} con i filtri selezionati.`
                      : `No ${entityTerm.pluralLower} found matching your criteria.`}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTickets.map((ticket) => {
                  const isSelected = selectedIds.has(ticket.id);
                  return (
                    <TableRow
                      key={ticket.id}
                      hover
                      selected={isSelected}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    >
                      {isAdmin && (
                        <TableCell padding="none" onClick={(e) => toggleSelectOne(ticket.id, e)} sx={{ width: 20, pl: 0.25, pr: 0 }}>
                          <Checkbox size="small" checked={isSelected} sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 12 } }} />
                        </TableCell>
                      )}
                      <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: { xs: 28, sm: 48 }, px: { xs: 0.25, sm: 1 }, fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>#{(ticket as any).ticketNumber ?? ticket.id}</TableCell>
                      <TableCell sx={{ px: { xs: 1.1, sm: 1 } }}>
                        <Box display="flex" alignItems="flex-start" gap={0.5}>
                          {((ticket as any).hasSolution || (ticket as any).resolutionNote) && (
                            <Tooltip title={(ticket as any).resolutionNote || 'Soluzione trovata'} placement="top" arrow>
                              <CheckCircle sx={{ fontSize: 14, color: 'success.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          {ticket.inboundChannelId && (
                            <Tooltip title={t.ticketList.emailBadgeTooltip} placement="top" arrow>
                              <EmailIcon sx={{ fontSize: 14, color: 'info.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.3 }}>{ticket.title}</Box>
                          {(ticket as any).checklistCount > 0 && (
                            <Tooltip title={t.ticketList.checklistProgressTooltip((ticket as any).checklistChecked, (ticket as any).checklistTotal)} placement="top" arrow>
                              <Chip
                                label={`✓ ${(ticket as any).checklistChecked}/${(ticket as any).checklistTotal}`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, flexShrink: 0, cursor: 'inherit', borderColor: 'text.disabled', color: 'text.secondary' }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{ticket.category}</TableCell>
                      <TableCell sx={{ px: { xs: 0.25, sm: 1 }, overflow: 'hidden' }}>
                        {(() => {
                          const customColor = getColorForKey(ticket.status);
                          const muiColor = getStatusColor(ticket.status);
                          const label = getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status;
                          return (
                            <Chip
                              label={label}
                              size="small"
                              {...(customColor
                                ? { sx: { bgcolor: customColor, color: 'white', fontWeight: 500, fontSize: { xs: '0.55rem', sm: '0.75rem' }, height: { xs: 16, sm: 24 }, '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } } }
                                : { color: muiColor as any, sx: { fontSize: { xs: '0.55rem', sm: '0.75rem' }, height: { xs: 16, sm: 24 }, '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } } })}
                            />
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Chip label={t.priority[ticket.priority] || ticket.priority} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, whiteSpace: 'nowrap' }}>
                        {ticket.assignee?.name || '—'}
                      </TableCell>
                      {showLocation && (
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                          {(ticket as any).location || '—'}
                        </TableCell>
                      )}
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                        <Box>
                          <Typography variant="body2" component="span">
                            {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
                          </Typography>
                          <Typography variant="caption" component="div" color="text.secondary">
                            {new Date(ticket.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => { if (!deleting) setDeleteDialogOpen(false); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t.ticketList.bulkDeleteConfirmTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t.ticketList.bulkDeleteConfirmText(selectedIds.size)}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            {t.ticketList.bulkDeleteCancel}
          </Button>
          <Button
            onClick={handleBulkDelete}
            disabled={deleting}
            variant="contained"
            color="error"
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {deleting ? '...' : t.ticketList.bulkDeleteConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
