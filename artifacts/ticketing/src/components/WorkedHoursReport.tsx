import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AccessTime, DeleteOutline, EditOutlined, ReceiptLong, Search } from '@mui/icons-material';
import {
  getGetClientQueryKey,
  getListClientsQueryKey,
  useUpdateClientTicketBillingStatus,
  useUpdateClientTicketWorkedHours,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

type BillingFilter = 'all' | 'billed' | 'unbilled';

interface WorkedHoursReportProps {
  clientId: number;
  tickets: any[];
  isAdmin: boolean;
}

function formatDuration(totalMinutes: number, lang: string): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (lang === 'it') {
    if (hours === 0) return `${minutes} minuti`;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    return `${hours} ${hours === 1 ? 'ora' : 'ore'} e ${minutes} minuti`;
  }
  if (hours === 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function parseDateInput(value: string, endOfDay = false): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function formatClosedDate(value: string | Date, lang: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB');
}

export default function WorkedHoursReport({ clientId, tickets, isAdmin }: WorkedHoursReportProps) {
  const { t, lang } = useLanguage();
  const tc = t.clients;
  const queryClient = useQueryClient();
  const { data: organizationSettings } = useQuery<{ workedTimeEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    staleTime: 5 * 60_000,
  });
  const updateBillingStatus = useUpdateClientTicketBillingStatus();
  const updateWorkedHours = useUpdateClientTicketWorkedHours();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
  const [updatingTicketId, setUpdatingTicketId] = useState<number | null>(null);
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [editError, setEditError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (organizationSettings?.workedTimeEnabled === false) return null;

  const workedTickets = useMemo(
    () => tickets.filter((ticket) => {
      const minutes = ticket.workedMinutes;
      const closedAt = ticket.closedAt;
      return Number.isInteger(minutes) && minutes >= 0 && closedAt != null;
    }),
    [tickets],
  );

  const filteredTickets = useMemo(() => {
    const from = parseDateInput(dateFrom);
    const to = parseDateInput(dateTo, true);
    const query = search.trim().toLocaleLowerCase();

    return workedTickets
      .filter((ticket) => {
        const closedAt = new Date(ticket.closedAt).getTime();
        if (from != null && closedAt < from) return false;
        if (to != null && closedAt > to) return false;
        const status = ticket.workedBillingStatus === 'billed' ? 'billed' : 'unbilled';
        if (billingFilter !== 'all' && status !== billingFilter) return false;
        if (!query) return true;
        return [
          ticket.title,
          ticket.category,
          ticket.ticketNumber != null ? String(ticket.ticketNumber) : '',
        ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }, [billingFilter, dateFrom, dateTo, search, workedTickets]);

  const groupedTickets = useMemo(() => {
    const groups = new Map<string, { label: string; tickets: any[] }>();
    for (const ticket of filteredTickets) {
      const date = new Date(ticket.closedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(key)) {
        groups.set(key, {
          label: date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' }),
          tickets: [],
        });
      }
      groups.get(key)!.tickets.push(ticket);
    }
    return [...groups.values()];
  }, [filteredTickets, lang]);

  const totalMinutes = filteredTickets.reduce((total, ticket) => total + ticket.workedMinutes, 0);
  const allMinutes = workedTickets.reduce((total, ticket) => total + ticket.workedMinutes, 0);
  const hasFilters = Boolean(search.trim() || dateFrom || dateTo || billingFilter !== 'all');

  const handleBillingStatusChange = async (ticketId: number, status: BillingFilter) => {
    if (status === 'all') return;
    setUpdatingTicketId(ticketId);
    try {
      await updateBillingStatus.mutateAsync({
        id: clientId,
        ticketId,
        data: { status },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() }),
      ]);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const openWorkedHoursEditor = (ticket: any) => {
    setEditingTicket(ticket);
    setEditHours(String(Math.floor(ticket.workedMinutes / 60)));
    setEditMinutes(String(ticket.workedMinutes % 60));
    setEditError('');
    setConfirmRemove(false);
  };

  const closeWorkedHoursEditor = () => {
    if (updateWorkedHours.isPending) return;
    setEditingTicket(null);
    setEditError('');
    setConfirmRemove(false);
  };

  const saveWorkedHours = async (workedMinutes: number | null) => {
    if (!editingTicket) return;
    setEditError('');
    try {
      await updateWorkedHours.mutateAsync({
        id: clientId,
        ticketId: editingTicket.id,
        data: { workedMinutes },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) }),
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() }),
      ]);
      setEditingTicket(null);
      setConfirmRemove(false);
    } catch (error: any) {
      setEditError(error?.data?.message || error?.message || tc.workedHoursUpdateError);
    }
  };

  const handleSaveWorkedHours = async () => {
    const hours = editHours.trim() ? Number(editHours) : 0;
    const minutes = editMinutes.trim() ? Number(editMinutes) : 0;
    const totalMinutes = hours * 60 + minutes;
    if (
      !Number.isInteger(hours) || hours < 0 ||
      !Number.isInteger(minutes) || minutes < 0 || minutes > 59 ||
      !Number.isSafeInteger(totalMinutes) || totalMinutes > 2_147_483_647
    ) {
      setEditError(tc.workedHoursInvalid);
      return;
    }
    if (editingTicket?.workedMinutes === totalMinutes) {
      setEditingTicket(null);
      return;
    }
    await saveWorkedHours(totalMinutes);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <AccessTime fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>{tc.workedHoursTitle}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {tc.workedHoursSummary(totalMinutes, filteredTickets.length)}
        </Typography>

        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" mb={2}>
          <TextField
            size="small"
            label={tc.workedHoursSearch}
            placeholder={tc.workedHoursSearchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 0.75, color: 'text.secondary' }} /> }}
            sx={{ minWidth: { xs: '100%', sm: 220 }, flex: 1 }}
          />
          <TextField
            size="small"
            type="date"
            label={tc.workedHoursFrom}
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 150 } }}
          />
          <TextField
            size="small"
            type="date"
            label={tc.workedHoursTo}
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: 'calc(50% - 6px)', sm: 150 } }}
          />
          <Select
            size="small"
            value={billingFilter}
            onChange={(event) => setBillingFilter(event.target.value as BillingFilter)}
            aria-label={tc.workedHoursBillingFilter}
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
          >
            <MenuItem value="all">{tc.workedHoursAll}</MenuItem>
            <MenuItem value="unbilled">{tc.workedHoursUnbilled}</MenuItem>
            <MenuItem value="billed">{tc.workedHoursBilled}</MenuItem>
          </Select>
        </Box>

        {workedTickets.length === 0 ? (
          <Alert severity="info">{tc.workedHoursEmpty}</Alert>
        ) : filteredTickets.length === 0 ? (
          <Alert severity="info">{tc.workedHoursNoResults}</Alert>
        ) : (
          <Box>
            <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
              <Chip
                size="small"
                icon={<AccessTime />}
                label={`${hasFilters ? tc.workedHoursFiltered : tc.workedHoursTotal}: ${formatDuration(totalMinutes, lang)}`}
                color="primary"
                variant="outlined"
              />
              {hasFilters && (
                <Chip size="small" label={`${tc.workedHoursOverall}: ${formatDuration(allMinutes, lang)}`} variant="outlined" />
              )}
              <Chip
                size="small"
                label={`${filteredTickets.length} ${tc.workedHoursEntries}`}
                variant="outlined"
              />
            </Box>
            {groupedTickets.map((group) => (
              <Box key={group.label} mb={2.5}>
                <Typography variant="subtitle2" fontWeight={700} textTransform="capitalize" mb={0.75}>
                  {group.label}
                </Typography>
                <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small" sx={{ minWidth: isAdmin ? 730 : 650 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{tc.workedHoursTicket}</TableCell>
                        <TableCell>{tc.workedHoursClosedAt}</TableCell>
                        <TableCell>{tc.workedHoursDuration}</TableCell>
                        <TableCell>{tc.workedHoursBillingStatus}</TableCell>
                        {isAdmin && <TableCell align="right">{tc.workedHoursActions}</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.tickets.map((ticket) => {
                        const billed = ticket.workedBillingStatus === 'billed';
                        const isUpdating = updatingTicketId === ticket.id;
                        return (
                          <TableRow key={ticket.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                #{ticket.ticketNumber ?? ticket.id} · {ticket.title}
                              </Typography>
                              {ticket.category && (
                                <Typography variant="caption" color="text.secondary">{ticket.category}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {formatClosedDate(ticket.closedAt, lang)}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {formatDuration(ticket.workedMinutes, lang)}
                            </TableCell>
                            <TableCell>
                              {isAdmin ? (
                                <Select
                                  size="small"
                                  value={billed ? 'billed' : 'unbilled'}
                                  disabled={isUpdating}
                                  onChange={(event) => handleBillingStatusChange(ticket.id, event.target.value as BillingFilter)}
                                  sx={{ minWidth: 145 }}
                                  startAdornment={isUpdating ? <CircularProgress size={14} sx={{ mr: 1 }} /> : <ReceiptLong fontSize="small" sx={{ mr: 0.75, color: billed ? 'success.main' : 'warning.main' }} />}
                                >
                                  <MenuItem value="unbilled">{tc.workedHoursUnbilled}</MenuItem>
                                  <MenuItem value="billed">{tc.workedHoursBilled}</MenuItem>
                                </Select>
                              ) : (
                                <Chip
                                  size="small"
                                  icon={<ReceiptLong />}
                                  color={billed ? 'success' : 'warning'}
                                  label={billed ? tc.workedHoursBilled : tc.workedHoursUnbilled}
                                />
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                <Tooltip title={tc.workedHoursEdit}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      aria-label={tc.workedHoursEdit}
                                      disabled={isUpdating || updateWorkedHours.isPending}
                                      onClick={() => openWorkedHoursEditor(ticket)}
                                    >
                                      <EditOutlined fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
      <Dialog
        open={Boolean(editingTicket)}
        onClose={closeWorkedHoursEditor}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{confirmRemove ? tc.workedHoursRemoveTitle : tc.workedHoursEditTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {confirmRemove ? tc.workedHoursRemoveConfirmation : tc.workedHoursEditBillingNote}
          </Typography>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          {!confirmRemove && (
            <Box display="flex" gap={1.5}>
              <TextField
                autoFocus
                fullWidth
                type="number"
                size="small"
                label={tc.workedHoursHoursField}
                value={editHours}
                onChange={(event) => { setEditHours(event.target.value); setEditError(''); }}
                disabled={updateWorkedHours.isPending}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                fullWidth
                type="number"
                size="small"
                label={tc.workedHoursMinutesField}
                value={editMinutes}
                onChange={(event) => { setEditMinutes(event.target.value); setEditError(''); }}
                disabled={updateWorkedHours.isPending}
                inputProps={{ min: 0, max: 59, step: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap' }}>
          <Button
            onClick={() => confirmRemove ? setConfirmRemove(false) : closeWorkedHoursEditor()}
            disabled={updateWorkedHours.isPending}
          >
            {confirmRemove ? tc.workedHoursKeep : tc.workedHoursCancel}
          </Button>
          {confirmRemove ? (
            <Button
              variant="contained"
              color="error"
              startIcon={updateWorkedHours.isPending ? <CircularProgress size={16} /> : <DeleteOutline />}
              onClick={() => saveWorkedHours(null)}
              disabled={updateWorkedHours.isPending}
            >
              {updateWorkedHours.isPending ? tc.workedHoursSaving : tc.workedHoursRemove}
            </Button>
          ) : (
            <>
              <Button
                color="error"
                startIcon={<DeleteOutline />}
                onClick={() => { setConfirmRemove(true); setEditError(''); }}
                disabled={updateWorkedHours.isPending}
              >
                {tc.workedHoursRemove}
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveWorkedHours}
                disabled={updateWorkedHours.isPending}
              >
                {updateWorkedHours.isPending ? tc.workedHoursSaving : tc.workedHoursSave}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Card>
  );
}