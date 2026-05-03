import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add,
  Edit,
  PersonOff,
  PersonAdd,
  InfoOutlined,
  TrendingUp,
  Group,
  AllInclusive,
} from '@mui/icons-material';
import { Link as WLink } from 'wouter';
import { LinearProgress } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from '@workspace/api-client-react';
import type { User, CreateUserBody, UpdateUserBody } from '@workspace/api-client-react';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  group: string;
  mainLocation: string;
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  group: '',
  mainLocation: '',
};

export default function Users() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const ut = t.users;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [groups, setGroups] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [seatUsage, setSeatUsage] = useState<{
    usedSeats: number;
    planSeats: number | null;
    planName: string;
    unlimited: boolean;
    available: number | null;
    limitReached: boolean;
    hasActiveSubscription: boolean;
  } | null>(null);

  const qc = useQueryClient();
  const invalidateUsers = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const { data: users = [], isLoading } = useListUsers();
  const createUser = useCreateUser({ mutation: { onSuccess: invalidateUsers } });
  const updateUser = useUpdateUser({ mutation: { onSuccess: invalidateUsers } });
  const deleteUser = useDeleteUser({ mutation: { onSuccess: invalidateUsers } });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState<User | null>(null);

  const activeCount = users.filter((u) => u.isActive !== false).length;

  const refreshSeatUsage = () => {
    fetch('/api/stripe/seat-usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSeatUsage(d); })
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLocations(d.value ?? []))
      .catch(() => {});
    refreshSeatUsage();
  }, []);

  useEffect(() => {
    refreshSeatUsage();
  }, [users.length]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role as 'admin' | 'user',
      group: (u as any).group ?? '',
      mainLocation: (u as any).mainLocation ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setFormError(ut.errorRequired);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setFormError(ut.errorInvalidEmail);
      return;
    }

    if (!editTarget) {
      if (!form.password) {
        setFormError(ut.errorRequired);
        return;
      }
      if (form.password.length < 6) {
        setFormError(ut.errorPasswordTooShort);
        return;
      }
    } else if (form.password && form.password.length < 6) {
      setFormError(ut.errorPasswordTooShort);
      return;
    }

    try {
      if (editTarget) {
        const body: UpdateUserBody = {
          name: form.name,
          email: form.email,
          role: form.role,
          group: form.group || null,
          mainLocation: form.mainLocation || null,
        } as any;
        if (form.password) (body as any).password = form.password;
        await updateUser.mutateAsync({ id: editTarget.id, data: body });
      } else {
        const body: CreateUserBody = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          group: form.group || null,
          mainLocation: form.mainLocation || null,
        } as any;
        await createUser.mutateAsync({ data: body });
      }
      setDialogOpen(false);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const serverMsg: string =
        err?.data?.message || err?.data?.error || err?.message || '';

      if (status === 402 || err?.data?.error === 'SEAT_LIMIT_REACHED') {
        setFormError(ut.errorSeatLimit);
        refreshSeatUsage();
      } else if (status === 409 || serverMsg.toLowerCase().includes('email')) {
        setFormError(ut.errorEmailExists);
      } else {
        setFormError(serverMsg || ut.errorSaving);
      }
    }
  };

  const handleToggleActive = async (u: User) => {
    if (u.isActive !== false) {
      setDeactivateConfirm(u);
    } else {
      await updateUser.mutateAsync({ id: u.id, data: { isActive: true } });
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateConfirm) return;
    await deleteUser.mutateAsync({ id: deactivateConfirm.id });
    setDeactivateConfirm(null);
  };

  const isSaving = createUser.isPending || updateUser.isPending;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const seatPct = seatUsage && !seatUsage.unlimited && seatUsage.planSeats
    ? Math.min(100, (seatUsage.usedSeats / seatUsage.planSeats) * 100) : 0;
  const seatColor: 'primary' | 'warning' | 'error' = seatPct >= 100 ? 'error' : seatPct >= 80 ? 'warning' : 'primary';
  const isFull = seatUsage?.limitReached ?? false;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom letterSpacing="-0.01em" fontSize={{ xs: '1.4rem', sm: '2.125rem' }}>
            {ut.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {seatUsage ? (
              seatUsage.unlimited ? (
                <Chip icon={<AllInclusive sx={{ fontSize: 14 }} />} label={ut.seatsUnlimited} color="success" size="small" variant="outlined" />
              ) : (
                <Chip
                  icon={<Group sx={{ fontSize: 14 }} />}
                  label={`${seatUsage.usedSeats} / ${seatUsage.planSeats} ${ut.seatsUsedLabel}`}
                  color={seatColor}
                  size="small"
                />
              )
            ) : (
              <Chip label={`${activeCount} ${ut.subtitle}`} color="primary" size="small" />
            )}
            {seatUsage?.hasActiveSubscription && (
              <Chip label={seatUsage.planName} size="small" variant="outlined" />
            )}
            {seatPct >= 80 && seatPct < 100 && (
              <Chip label={ut.seatsAlmostFull} color="warning" size="small" />
            )}
            {isFull && (
              <Chip label={ut.seatsFull} color="error" size="small" />
            )}
          </Box>
        </Box>
        {currentUser?.role === 'admin' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {isFull && (
              <Button variant="outlined" color="primary" component={WLink as any} href="/billing" startIcon={<TrendingUp />} size={isMobile ? 'small' : 'medium'}>
                {ut.upgradeCta}
              </Button>
            )}
            <Tooltip title={isFull ? ut.errorSeatLimit : ''}>
              <span>
                <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={isFull} size={isMobile ? 'small' : 'medium'}>
                  {ut.addUser}
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Seat usage progress bar */}
      {seatUsage && !seatUsage.unlimited && seatUsage.planSeats && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <LinearProgress
            variant="determinate"
            value={seatPct}
            color={seatColor}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {seatUsage.usedSeats} / {seatUsage.planSeats} {ut.seatsUsedLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {seatUsage.available ?? 0} disponibili
            </Typography>
          </Box>
        </Box>
      )}

      {isFull ? (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: '12px' }}
          action={
            <Button color="inherit" size="small" component={WLink as any} href="/billing" startIcon={<TrendingUp />}>
              {ut.upgradeCta}
            </Button>
          }
        >
          {ut.errorSeatLimit}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }} icon={<InfoOutlined />}>
          {ut.billingNote}
        </Alert>
      )}

      {/* Mobile: card layout */}
      {isMobile ? (
        <Stack spacing={1.5}>
          {users.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
              {ut.noUsers}
            </Typography>
          ) : (
            users.map((u) => {
              const isActive = u.isActive !== false;
              const isCurrentUser = u.id === currentUser?.id;
              return (
                <Card key={u.id} elevation={1} sx={{ opacity: isActive ? 1 : 0.6 }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap flex={1} mr={1}>
                        {u.name}
                      </Typography>
                      <Chip
                        label={isActive ? ut.active : ut.inactive}
                        size="small"
                        color={isActive ? 'success' : 'default'}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap mb={1}>
                      {u.email}
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      <Chip
                        label={u.role === 'admin' ? t.role.admin : t.role.user}
                        size="small"
                        color={u.role === 'admin' ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                      {(u as any).group && (
                        <Chip label={(u as any).group} size="small" variant="outlined" />
                      )}
                      {(u as any).mainLocation && (
                        <Chip label={(u as any).mainLocation} size="small" variant="outlined" />
                      )}
                    </Box>
                  </CardContent>
                  {currentUser?.role === 'admin' && (
                    <CardActions sx={{ pt: 0, px: 2, pb: 1.5, gap: 1 }}>
                      <Button size="small" startIcon={<Edit fontSize="small" />} onClick={() => openEdit(u)}>
                        {ut.editUser}
                      </Button>
                      {!isCurrentUser && (
                        <Button
                          size="small"
                          color={isActive ? 'error' : 'success'}
                          startIcon={isActive ? <PersonOff fontSize="small" /> : <PersonAdd fontSize="small" />}
                          onClick={() => handleToggleActive(u)}
                        >
                          {isActive ? ut.deactivate : ut.activate}
                        </Button>
                      )}
                    </CardActions>
                  )}
                </Card>
              );
            })
          )}
        </Stack>
      ) : (
        /* Desktop: table layout */
        <TableContainer component={Paper} elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>{ut.name}</strong></TableCell>
                <TableCell><strong>{ut.email}</strong></TableCell>
                <TableCell><strong>{ut.role}</strong></TableCell>
                <TableCell><strong>{ut.group}</strong></TableCell>
                <TableCell><strong>{ut.location}</strong></TableCell>
                <TableCell><strong>{ut.status}</strong></TableCell>
                <TableCell><strong>{ut.createdAt}</strong></TableCell>
                <TableCell align="right"><strong>{ut.actions}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {ut.noUsers}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isActive = u.isActive !== false;
                  const isCurrentUser = u.id === currentUser?.id;
                  return (
                    <TableRow
                      key={u.id}
                      sx={{ opacity: isActive ? 1 : 0.55, '&:last-child td': { border: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{u.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.role === 'admin' ? t.role.admin : t.role.user}
                          size="small"
                          color={u.role === 'admin' ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(u as any).group || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(u as any).mainLocation || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={isActive ? ut.active : ut.inactive}
                          size="small"
                          color={isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {u.createdAt
                            ? new Date(u.createdAt).toLocaleDateString('it-IT')
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {currentUser?.role === 'admin' && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title={ut.editUser}>
                              <IconButton size="small" onClick={() => openEdit(u)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {!isCurrentUser && (
                              <Tooltip title={isActive ? ut.deactivate : ut.activate}>
                                <IconButton
                                  size="small"
                                  color={isActive ? 'error' : 'success'}
                                  onClick={() => handleToggleActive(u)}
                                >
                                  {isActive ? <PersonOff fontSize="small" /> : <PersonAdd fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editTarget ? ut.editUser : ut.createUser}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={ut.name}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label={ut.email}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label={ut.password}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              fullWidth
              placeholder={editTarget ? ut.passwordPlaceholder : undefined}
              required={!editTarget}
              helperText={editTarget ? ut.passwordPlaceholder : undefined}
            />
            <FormControl fullWidth>
              <InputLabel>{ut.role}</InputLabel>
              <Select
                value={form.role}
                label={ut.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
              >
                <MenuItem value="user">{t.role.user}</MenuItem>
                <MenuItem value="admin">{t.role.admin}</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{ut.group}</InputLabel>
              <Select
                value={form.group}
                label={ut.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
              >
                <MenuItem value=""><em>— {ut.groupPlaceholder} —</em></MenuItem>
                {groups.map((g) => (
                  <MenuItem key={g} value={g}>{g}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {locations.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>{ut.location}</InputLabel>
                <Select
                  value={form.mainLocation}
                  label={ut.location}
                  onChange={(e) => setForm((f) => ({ ...f, mainLocation: e.target.value }))}
                >
                  <MenuItem value=""><em>— {ut.locationPlaceholder} —</em></MenuItem>
                  {locations.map((loc) => (
                    <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSaving}>{ut.cancel}</Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            {isSaving ? ut.saving : ut.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog open={!!deactivateConfirm} onClose={() => setDeactivateConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{ut.deactivate}</DialogTitle>
        <DialogContent>
          <Typography>{ut.deactivateConfirm}</Typography>
          {deactivateConfirm && (
            <Typography fontWeight="bold" sx={{ mt: 1 }}>{deactivateConfirm.name}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateConfirm(null)}>{ut.cancel}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeactivate}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? ut.saving : ut.deactivate}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
