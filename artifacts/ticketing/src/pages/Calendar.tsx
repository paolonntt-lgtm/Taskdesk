import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box, Typography, IconButton, Paper, Chip, Divider, CircularProgress,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, Tooltip,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, AccessTime as TimeIcon, EventNote as EventIcon,
  ConfirmationNumber as TicketIcon, Today as TodayIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useListUsers } from '@workspace/api-client-react';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useTicketStatuses } from '../hooks/useTicketStatuses';

type CalendarItem = {
  type: 'ticket' | 'appointment';
  date: string;
  id: number;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string | null;
  priority: string | null;
  assignee: { id: number; name: string; avatarUrl?: string | null } | null;
  description: string | null;
  createdBy: number | null;
  ticketNumber?: number | null;
};

type Appointment = {
  id: number;
  organizationId: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: number;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
  creator: { id: number; name: string; email: string } | null;
  assignee: { id: number; name: string; email: string } | null;
};

function formatTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDatetimeStr(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Appointment Form Dialog ────────────────────────────────────────────────

interface AppointmentFormDialogProps {
  open: boolean;
  appointment?: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
  defaultDate?: string | null;
}

function AppointmentFormDialog({ open, appointment, onClose, onSaved, defaultDate }: AppointmentFormDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useListUsers({
    query: { enabled: isAdmin && open, staleTime: 60000 } as any,
  });

  React.useEffect(() => {
    if (open) {
      if (appointment) {
        setTitle(appointment.title);
        setDescription(appointment.description ?? '');
        setStartsAt(toLocalDatetimeStr(appointment.startsAt));
        setEndsAt(toLocalDatetimeStr(appointment.endsAt));
        setAssignedTo(appointment.assignedTo ?? '');
      } else {
        setTitle('');
        setDescription('');
        const base = defaultDate ? `${defaultDate}T09:00` : toLocalDatetimeStr(new Date().toISOString());
        setStartsAt(base);
        setEndsAt('');
        setAssignedTo('');
      }
      setError(null);
    }
  }, [open, appointment, defaultDate]);

  const handleSave = async () => {
    if (!title.trim() || !startsAt) {
      setError(t.calendar.errorSave);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        assignedTo: assignedTo !== '' ? assignedTo : null,
      };
      const url = appointment ? `/api/appointments/${appointment.id}` : '/api/appointments';
      const method = appointment ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      onSaved();
      onClose();
    } catch {
      setError(t.calendar.errorSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {appointment ? t.calendar.editAppointment : t.calendar.addAppointment}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label={t.calendar.titleField}
          placeholder={t.calendar.titlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2 }}
        />
        <TextField
          label={t.calendar.descriptionField}
          placeholder={t.calendar.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={3}
          sx={{ mb: 2 }}
        />
        <TextField
          label={t.calendar.startsAtField}
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        <TextField
          label={t.calendar.endsAtField}
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2 }}
        />
        {isAdmin && (
          <FormControl fullWidth sx={{ mb: 1 }}>
            <InputLabel>{t.calendar.assignedToField}</InputLabel>
            <Select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value as number | '')}
              label={t.calendar.assignedToField}
            >
              <MenuItem value="">{t.calendar.unassigned}</MenuItem>
              {(users as any[]).filter((u: any) => u.isActive !== false).map((u: any) => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>{t.calendar.cancel}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? t.calendar.saving : t.calendar.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Appointment Detail Modal ───────────────────────────────────────────────

interface AppointmentDetailModalProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

function AppointmentDetailModal({ open, appointment, onClose, onEdit, onDelete, canEdit }: AppointmentDetailModalProps) {
  const { t } = useLanguage();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!appointment) return;
    setDeleting(true);
    try {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      onDelete();
      onClose();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <EventIcon color="primary" />
        {appointment.title}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {appointment.description && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {appointment.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimeIcon fontSize="small" color="action" />
            <Typography variant="body2">
              <strong>{t.calendar.start}:</strong> {formatDateTime(appointment.startsAt)}
              {appointment.endsAt && (
                <> &nbsp;→&nbsp; <strong>{t.calendar.end}:</strong> {formatDateTime(appointment.endsAt)}</>
              )}
            </Typography>
          </Box>
          {appointment.creator && (
            <Typography variant="body2" color="text.secondary">
              {t.calendar.createdBy}: {appointment.creator.name}
            </Typography>
          )}
          {appointment.assignee && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                {appointment.assignee.name.charAt(0)}
              </Avatar>
              <Typography variant="body2">{appointment.assignee.name}</Typography>
            </Box>
          )}
        </Box>
        {confirmDelete && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t.calendar.deleteConfirm}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="contained" color="error" disabled={deleting} onClick={handleDelete}>
                {t.calendar.deleteAction}
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}>{t.calendar.cancel}</Button>
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {canEdit && !confirmDelete && (
          <>
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              onClick={() => setConfirmDelete(true)}
            >
              {t.calendar.deleteAppointment}
            </Button>
            <Button startIcon={<EditIcon />} onClick={onEdit}>{t.calendar.editAppointment}</Button>
          </>
        )}
        <Button onClick={onClose}>{t.calendar.cancel}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Calendar Page ─────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const groupPermissions: string[] = ((user as any)?.groupPermissions as string[] | undefined) ?? [];
  const canCreateAppointment = isAdmin || groupPermissions.includes('create_appointments');

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { getLabelForKey, getColorForKey } = useTicketStatuses();

  const calendarKey = ['/api/calendar', year, month];
  const { data: items = [], isLoading, error } = useQuery<CalendarItem[]>({
    queryKey: calendarKey,
    queryFn: () =>
      fetch(`/api/calendar?year=${year}&month=${month}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: 30000,
  });

  const invalidateCalendar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: calendarKey });
  }, [queryClient, year, month]);

  // Build a map: date string -> items
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
    }
    return map;
  }, [items]);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDate(null);
  };

  const selectedItems = selectedDate ? (itemsByDate.get(selectedDate) ?? []) : [];
  const selectedTickets = selectedItems.filter(i => i.type === 'ticket');
  const selectedAppointments = selectedItems.filter(i => i.type === 'appointment');

  const handleAppointmentClick = async (item: CalendarItem) => {
    const res = await fetch(`/api/appointments/${item.id}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setDetailAppointment(data);
    setDetailOpen(true);
  };

  const canEditAppointment = (appt: Appointment | null) => {
    if (!appt) return false;
    return isAdmin || appt.createdBy === (user as any)?.id;
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Right-panel: all dates in the month that have items, sorted
  const monthDates = useMemo(() => [...itemsByDate.keys()].sort(), [itemsByDate]);

  // Scroll right panel to selected date
  const dateRefs = useRef<Map<string, HTMLElement>>(new Map());
  useEffect(() => {
    if (selectedDate) {
      const el = dateRefs.current.get(selectedDate);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDate]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Typography variant="h5" fontWeight={700} mb={3}>
        {t.calendar.title}
      </Typography>

      {/* Two-column grid: calendar left, agenda right */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
        gap: 3,
        alignItems: 'start',
      }}>
        {/* ── LEFT: Calendar card ── */}
        <Box>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 2 }}>
            {/* Month navigation header */}
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 3, py: 2, bgcolor: 'primary.main', color: 'primary.contrastText',
            }}>
              <IconButton onClick={prevMonth} size="small" sx={{ color: 'primary.contrastText' }}>
                <ChevronLeft />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>
                  {t.calendar.monthsLong[month - 1]} {year}
                </Typography>
                <Tooltip title={t.calendar.today}>
                  <IconButton size="small" sx={{ color: 'primary.contrastText', opacity: 0.7 }} onClick={goToday}>
                    <TodayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {canCreateAppointment && (
                  <Tooltip title={t.calendar.addAppointment} placement="left">
                    <IconButton
                      size="small"
                      onClick={() => { setEditingAppointment(null); setFormOpen(true); }}
                      sx={{
                        color: 'primary.contrastText',
                        bgcolor: 'rgba(255,255,255,0.15)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
                        width: 32, height: 32,
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton onClick={nextMonth} size="small" sx={{ color: 'primary.contrastText' }}>
                  <ChevronRight />
                </IconButton>
              </Box>
            </Box>

            {/* Day of week header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: 'divider' }}>
              {t.calendar.daysShort.map((d) => (
                <Box key={d} sx={{ textAlign: 'center', py: 1, px: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} fontSize="0.7rem">
                    {d}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Calendar grid */}
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const dayNum = idx - startDow + 1;
                  const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  const dateStr = isValid
                    ? `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    : null;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const dayItems = dateStr ? (itemsByDate.get(dateStr) ?? []) : [];
                  const hasTickets = dayItems.some(i => i.type === 'ticket');
                  const hasAppointments = dayItems.some(i => i.type === 'appointment');

                  return (
                    <Box
                      key={idx}
                      onClick={() => isValid && dateStr && setSelectedDate(prev => prev === dateStr ? null : dateStr)}
                      sx={{
                        minHeight: { xs: 46, sm: 0 },
                        aspectRatio: { sm: '1' },
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid' : 'none',
                        borderBottom: idx < totalCells - 7 ? '1px solid' : 'none',
                        borderColor: 'divider',
                        p: { xs: 0.5, sm: 1 },
                        cursor: isValid ? 'pointer' : 'default',
                        bgcolor: isSelected
                          ? 'primary.50'
                          : isToday
                          ? 'action.selected'
                          : !isValid
                          ? 'action.disabledBackground'
                          : 'transparent',
                        transition: 'background-color 0.1s',
                        '&:hover': isValid ? { bgcolor: isSelected ? 'primary.100' : 'action.hover' } : {},
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        position: 'relative',
                      }}
                    >
                      {isValid && (
                        <>
                          <Box
                            sx={{
                              width: { xs: 24, sm: 28 }, height: { xs: 24, sm: 28 },
                              borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: isToday ? 'primary.main' : 'transparent',
                              color: isToday ? 'primary.contrastText' : 'text.primary',
                            }}
                          >
                            <Typography variant="body2" fontWeight={isToday ? 700 : 400} fontSize={{ xs: '0.75rem', sm: '0.875rem' }}>
                              {dayNum}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {hasTickets && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'warning.main' }} />}
                            {hasAppointments && <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'secondary.main' }} />}
                          </Box>
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
              <Typography variant="caption" color="text.secondary">{t.calendar.ticketsDue}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
              <Typography variant="caption" color="text.secondary">{t.calendar.appointments}</Typography>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{t.calendar.errorLoad}</Alert>}
        </Box>

        {/* ── RIGHT: Month agenda ── */}
        <Paper sx={{
          borderRadius: 3, overflow: 'hidden',
          position: { md: 'sticky' }, top: { md: 76 },
          display: 'flex', flexDirection: 'column',
          maxHeight: { md: 'calc(100vh - 108px)' },
        }}>
          {/* Panel header */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {t.calendar.monthsLong[month - 1]} {year}
            </Typography>
          </Box>

          {/* Scrollable list */}
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : monthDates.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <EventIcon sx={{ fontSize: 32, opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }} />
                <Typography variant="body2">{t.calendar.noItemsMonth}</Typography>
              </Box>
            ) : (
              monthDates.map((dateStr) => {
                const dayItems = itemsByDate.get(dateStr) ?? [];
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const tickets = dayItems.filter(i => i.type === 'ticket');
                const appointments = dayItems.filter(i => i.type === 'appointment');
                return (
                  <Box
                    key={dateStr}
                    ref={(el) => {
                      if (el) dateRefs.current.set(dateStr, el as HTMLElement);
                      else dateRefs.current.delete(dateStr);
                    }}
                    sx={{
                      borderBottom: '1px solid', borderColor: 'divider',
                      bgcolor: isSelected ? 'primary.50' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {/* Date row */}
                    <Box
                      onClick={() => setSelectedDate(prev => prev === dateStr ? null : dateStr)}
                      sx={{
                        px: 1.5, py: 0.75, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        bgcolor: isToday ? 'primary.main' : 'transparent',
                        color: isToday ? 'primary.contrastText' : 'text.primary',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="caption" fontWeight={700} fontSize="0.72rem">
                          {new Date(dateStr + 'T12:00').getDate()}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={isToday ? 700 : 500} color={isToday ? 'primary.main' : 'text.primary'} sx={{ flexGrow: 1, fontSize: '0.8rem' }}>
                        {new Date(dateStr + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        {tickets.length > 0 && (
                          <Chip label={tickets.length} size="small" color="warning" sx={{ height: 16, fontSize: '0.58rem', '& .MuiChip-label': { px: 0.6 } }} />
                        )}
                        {appointments.length > 0 && (
                          <Chip label={appointments.length} size="small" color="secondary" sx={{ height: 16, fontSize: '0.58rem', '& .MuiChip-label': { px: 0.6 } }} />
                        )}
                      </Box>
                    </Box>

                    {/* Items */}
                    <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {tickets.map((item) => (
                        <Box
                          key={`t-${item.id}`}
                          onClick={() => setLocation(`/tickets/${item.id}`)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75,
                            px: 1, py: 0.6, borderRadius: 1.5,
                            border: '1px solid', borderColor: 'warning.light',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'warning.50', borderColor: 'warning.main' },
                            transition: 'all 0.12s',
                          }}
                        >
                          <TicketIcon sx={{ color: 'warning.main', flexShrink: 0, fontSize: 13 }} />
                          <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                            {item.ticketNumber ? `#${item.ticketNumber} ` : ''}{item.title}
                          </Typography>
                          {item.assignee && (
                            <Avatar src={item.assignee.avatarUrl ?? undefined} sx={{ width: 16, height: 16, fontSize: '0.5rem', flexShrink: 0 }}>
                              {item.assignee.name.charAt(0)}
                            </Avatar>
                          )}
                        </Box>
                      ))}
                      {appointments.map((item) => (
                        <Box
                          key={`a-${item.id}`}
                          onClick={() => handleAppointmentClick(item)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75,
                            px: 1, py: 0.6, borderRadius: 1.5,
                            border: '1px solid', borderColor: 'secondary.light',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'secondary.50', borderColor: 'secondary.main' },
                            transition: 'all 0.12s',
                          }}
                        >
                          <EventIcon sx={{ color: 'secondary.main', flexShrink: 0, fontSize: 13 }} />
                          <Box flex={1} minWidth={0}>
                            <Typography variant="caption" fontWeight={600} noWrap display="block">{item.title}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block" fontSize="0.65rem">
                              {formatTime(item.startsAt)}{item.endsAt && ` – ${formatTime(item.endsAt)}`}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>
      </Box>

      {/* Form dialog */}
      <AppointmentFormDialog
        open={formOpen}
        appointment={editingAppointment}
        onClose={() => { setFormOpen(false); setEditingAppointment(null); }}
        onSaved={invalidateCalendar}
        defaultDate={selectedDate}
      />

      {/* Detail modal */}
      <AppointmentDetailModal
        open={detailOpen}
        appointment={detailAppointment}
        onClose={() => { setDetailOpen(false); setDetailAppointment(null); }}
        onEdit={() => {
          setDetailOpen(false);
          setEditingAppointment(detailAppointment);
          setFormOpen(true);
        }}
        onDelete={invalidateCalendar}
        canEdit={canEditAppointment(detailAppointment)}
      />
    </Box>
  );
}
