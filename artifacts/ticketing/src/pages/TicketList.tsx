import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid,
  Tooltip, TableSortLabel, Collapse, IconButton,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, CheckCircle, FilterList, FilterListOff } from '@mui/icons-material';
import { useListTickets } from '@workspace/api-client-react';
import { Link, useSearch, useLocation } from 'wouter';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useDebounce } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

const VALID_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, waiting: 2, resolved: 3, closed: 4 };

type SortCol = 'id' | 'title' | 'category' | 'status' | 'priority' | 'assignee' | 'location' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function TicketList() {
  const { t, lang } = useLanguage();
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialStatus = VALID_STATUSES.includes(params.get('status') ?? '') ? params.get('status')! : 'all';
  const initialPriority = VALID_PRIORITIES.includes(params.get('priority') ?? '') ? params.get('priority')! : 'all';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [location, setLocation] = useState('all');
  const [category, setCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showExtra, setShowExtra] = useState(false);

  const [configuredLocations, setConfiguredLocations] = useState<string[]>([]);
  const [configuredCategories, setConfiguredCategories] = useState<string[]>([]);

  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const hasExtraFilters = location !== 'all' || category !== 'all' || dateFrom !== '' || dateTo !== '';

  const { data: tickets, isLoading } = useListTickets({
    search: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
    priority: priority !== 'all' ? priority : undefined,
    location: location !== 'all' ? location : undefined,
    category: category !== 'all' ? category : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';
  const showLocation = configuredLocations.length !== 1;

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedTickets = useMemo(() => {
    if (!tickets) return [];
    return [...tickets].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'id': cmp = a.id - b.id; break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'status': cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99); break;
        case 'priority': cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
        case 'assignee': cmp = (a.assignee?.name || '').localeCompare(b.assignee?.name || ''); break;
        case 'location': cmp = ((a as any).location || '').localeCompare((b as any).location || ''); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tickets, sortCol, sortDir]);

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

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1.5, sm: 3 }}>
        <Typography variant="h5" fontWeight="bold">{t.ticketList.title}</Typography>
        <Button
          component={Link}
          href="/tickets/new"
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          size="small"
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{t.ticketList.newTicket}</Box>
        </Button>
      </Box>

      <Card sx={{ mb: { xs: 1.5, sm: 3 }, p: { xs: 1.5, sm: 2 } }}>
        {/* Row 1: search + stato + priorità + toggle */}
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder={t.ticketList.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              select
              fullWidth
              size="small"
              label={t.ticketList.statusFilter}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">{t.ticketList.allStatuses}</MenuItem>
              <MenuItem value="open">{t.status.open}</MenuItem>
              <MenuItem value="in_progress">{t.status.in_progress}</MenuItem>
              <MenuItem value="waiting">{t.status.waiting}</MenuItem>
              <MenuItem value="resolved">{t.status.resolved}</MenuItem>
              <MenuItem value="closed">{t.status.closed}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <TextField
              select
              fullWidth
              size="small"
              label={t.ticketList.priorityFilter}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
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
              fullWidth
              size="small"
              variant={hasExtraFilters ? 'contained' : 'outlined'}
              color={hasExtraFilters ? 'primary' : 'inherit'}
              startIcon={hasExtraFilters ? <FilterList /> : <FilterList />}
              onClick={() => setShowExtra((v) => !v)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t.ticketList.moreFilters}
              {hasExtraFilters && ` (${[location !== 'all', category !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length})`}
            </Button>
          </Grid>
        </Grid>

        {/* Row 2: advanced filters */}
        <Collapse in={showExtra || hasExtraFilters}>
          <Grid container spacing={1.5} mt={0.25}>
            {configuredLocations.length > 1 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label={t.ticketList.locationFilter}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
                  select
                  fullWidth
                  size="small"
                  label={t.ticketList.categoryFilter}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allCategories}</MenuItem>
                  {configuredCategories.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={6} sm={3} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label={t.ticketList.dateFrom}
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label={t.ticketList.dateTo}
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {hasExtraFilters && (
              <Grid item xs={12} sm="auto">
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<FilterListOff />}
                  onClick={() => { setLocation('all'); setCategory('all'); setDateFrom(''); setDateTo(''); }}
                >
                  {t.ticketList.clearFilters}
                </Button>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Card>

      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {col('id', t.ticketList.colId)}
                {col('title', t.ticketList.colTitle)}
                {col('category', t.ticketList.colCategory, { display: { xs: 'none', md: 'table-cell' } })}
                {col('status', t.ticketList.colStatus)}
                {col('priority', t.ticketList.colPriority, { display: { xs: 'none', sm: 'table-cell' } })}
                {col('assignee', t.ticketList.colAssignee, { display: { xs: 'none', lg: 'table-cell' } })}
                {showLocation && col('location', t.ticketList.colLocation, { display: { xs: 'none', md: 'table-cell' } })}
                {col('createdAt', t.ticketList.colCreated, { display: { xs: 'none', md: 'table-cell' } })}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={showLocation ? 8 : 7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : sortedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showLocation ? 8 : 7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t.ticketList.noResults}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>#{(ticket as any).ticketNumber ?? ticket.id}</TableCell>
                    <TableCell sx={{ maxWidth: { xs: 140, sm: 250, md: 320 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Box display="flex" alignItems="center" gap={0.75}>
                        {((ticket as any).hasSolution || (ticket as any).resolutionNote) && (
                          <Tooltip title={(ticket as any).resolutionNote || 'Soluzione trovata'} placement="top" arrow>
                            <CheckCircle sx={{ fontSize: 15, color: 'success.main', flexShrink: 0 }} />
                          </Tooltip>
                        )}
                        {ticket.title}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{ticket.category}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip label={t.status[ticket.status] || ticket.status} size="small" color={getStatusColor(ticket.status) as any} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Chip label={t.priority[ticket.priority] || ticket.priority} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, whiteSpace: 'nowrap' }}>
                      {ticket.assignee?.name || t.ticketList.unassigned}
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
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}
