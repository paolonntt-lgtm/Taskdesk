import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid,
  Tooltip, TableSortLabel, Collapse, IconButton, Checkbox, Toolbar, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
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
  const statusParam = urlParams.get('status') ?? '';
  const validStatuses = orgStatuses.map((s) => s.key);
  const status = (statusParam && (validStatuses.includes(statusParam) || validStatuses.length === 0)) ? statusParam : 'all';
  const priority = VALID_PRIORITIES.includes(urlParams.get('priority') ?? '') ? urlParams.get('priority')! : 'all';
  const location = urlParams.get('location') ?? 'all';
  const category = urlParams.get('category') ?? 'all';
  const dateFrom = urlParams.get('dateFrom') ?? '';
  const dateTo   = urlParams.get('dateTo') ?? '';
  const userFilter     = urlParams.get('userFilter') ?? 'all';
  const userFilterType = (urlParams.get('userFilterType') as 'assignedTo' | 'createdBy') || 'assignedTo';
  const emailOrigin    = urlParams.get('emailOrigin') === 'true';
  const clientIdFilter = urlParams.get('clientId') ?? 'all';
  const sortCol  = (urlParams.get('sortCol') as SortCol) || 'id';
  const sortDir  = (urlParams.get('sortDir') as SortDir) || 'desc';

  const [searchInput, setSearchInput] = useState(urlParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  const [configuredLocations, setConfiguredLocations] = useState<string[]>([]);
  const [configuredCategories, setConfiguredCategories] = useState<string[]>([]);
  const { data: users } = useListUsers();
  const { data: clients } = useListClients();

  // ── Bulk selection state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const deleteTicket = useDeleteTicket();

  const hasExtraFilters = location !== 'all' || category !== 'all' || !!dateFrom || !!dateTo || userFilter !== 'all' || emailOrigin || clientIdFilter !== 'all';
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
    ['location', 'category', 'dateFrom', 'dateTo', 'userFilter', 'userFilterType', 'emailOrigin', 'clientId'].forEach((k) => next.delete(k));
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
    status:   status   !== 'all' ? status   : undefined,
    priority: priority !== 'all' ? priority : undefined,
    location: location !== 'all' ? location : undefined,
    category: category !== 'all' ? category : undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    assignedTo: userFilter !== 'all' && userFilterType === 'assignedTo' ? parseInt(userFilter, 10) : undefined,
    createdBy:  userFilter !== 'all' && userFilterType === 'createdBy'  ? parseInt(userFilter, 10) : undefined,
    emailOrigin: emailOrigin || undefined,
    clientId: clientIdFilter !== 'all' ? parseInt(clientIdFilter, 10) : undefined,
  }, { query: { refetchInterval: 30_000, refetchIntervalInBackground: false } as any });

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
            <TextField
              select fullWidth size="small"
              label={t.ticketList.statusFilter}
              value={status}
              onChange={(e) => setParam('status', e.target.value)}
            >
              <MenuItem value="all">{t.ticketList.allStatuses}</MenuItem>
              {orgStatuses.map((s) => (
                <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              select fullWidth size="small"
              label={t.ticketList.priorityFilter}
              value={priority}
              onChange={(e) => setParam('priority', e.target.value)}
            >
              <MenuItem value="all">{t.ticketList.allPriorities}</MenuItem>
              <MenuItem value="low">{t.priority.low}</MenuItem>
              <MenuItem value="medium">{t.priority.medium}</MenuItem>
              <MenuItem value="high">{t.priority.high}</MenuItem>
              <MenuItem value="urgent">{t.priority.urgent}</MenuItem>
            </TextField>
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
              {hasExtraFilters && ` (${[location !== 'all', category !== 'all', !!dateFrom, !!dateTo, userFilter !== 'all', emailOrigin, clientIdFilter !== 'all'].filter(Boolean).length})`}
            </Button>
          </Grid>
        </Grid>

        {/* Row 2: advanced filters */}
        <Collapse in={showExtra}>
          <Grid container spacing={1.5} mt={0.25}>
            {configuredLocations.length > 1 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.locationFilter}
                  value={location}
                  onChange={(e) => setParam('location', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allLocations}</MenuItem>
                  {configuredLocations.map((loc) => (
                    <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {configuredCategories.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.categoryFilter}
                  value={category}
                  onChange={(e) => setParam('category', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allCategories}</MenuItem>
                  {configuredCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </TextField>
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

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {isAdmin && (
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      size="small"
                      indeterminate={someSelected}
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={sortedTickets.length === 0}
                    />
                  </TableCell>
                )}
                {col('id', t.ticketList.colId, { width: 48 })}
                {col('title', t.ticketList.colTitle)}
                {col('category', t.ticketList.colCategory, { display: { xs: 'none', md: 'table-cell' }, width: 110 })}
                {col('status', t.ticketList.colStatus, { width: 90 })}
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
                        <TableCell padding="checkbox" onClick={(e) => toggleSelectOne(ticket.id, e)}>
                          <Checkbox size="small" checked={isSelected} />
                        </TableCell>
                      )}
                      <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: 48 }}>#{(ticket as any).ticketNumber ?? ticket.id}</TableCell>
                      <TableCell sx={{ maxWidth: { xs: 180, sm: 340, md: 500 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Box display="flex" alignItems="center" gap={0.75}>
                          {((ticket as any).hasSolution || (ticket as any).resolutionNote) && (
                            <Tooltip title={(ticket as any).resolutionNote || 'Soluzione trovata'} placement="top" arrow>
                              <CheckCircle sx={{ fontSize: 15, color: 'success.main', flexShrink: 0 }} />
                            </Tooltip>
                          )}
                          {ticket.inboundChannelId && (
                            <Tooltip title={t.ticketList.emailBadgeTooltip} placement="top" arrow>
                              <EmailIcon sx={{ fontSize: 15, color: 'info.main', flexShrink: 0 }} />
                            </Tooltip>
                          )}
                          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>{ticket.title}</Box>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          const customColor = getColorForKey(ticket.status);
                          return (
                            <Chip
                              label={getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status}
                              size="small"
                              {...(customColor
                                ? { sx: { bgcolor: customColor, color: 'white', fontWeight: 500 } }
                                : { color: getStatusColor(ticket.status) as any })}
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
