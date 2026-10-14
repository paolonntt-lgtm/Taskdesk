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
  Avatar,
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
  DeleteForever,
  PersonAddAlt1,
  ContentCopy,
  Check,
  Close,
  SecurityOutlined,
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
  mainLocation: string;
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  mainLocation: '',
};

type GroupMembership = { id: number; name: string; permissions: string[] };

const PERMISSION_KEYS = ['change_status', 'add_notes', 'edit_fixed_notes', 'edit_client_notes', 'delete_client_notes', 'manage_client_sections', 'edit_client_section_content', 'create_appointments', 'view_worked_hours'] as const;

function getEffectivePermissions(memberships: GroupMembership[], resolved?: string[]): string[] {
  if (resolved) return resolved;
  const set = new Set<string>();
  for (const g of memberships) {
    for (const p of g.permissions ?? []) {
      set.add(p);
    }
  }
  return PERMISSION_KEYS.filter((k) => set.has(k));
}

function UserPermissionsTooltip({
  user,
  children,
}: {
  user: User;
  children: React.ReactElement;
}) {
  const { t } = useLanguage();
  const ut = t.users;
  const tg = t.groups;

  const permLabels: Record<string, string> = {
    change_status: tg.permChangeStatus,
    add_notes: tg.permAddNotes,
    edit_fixed_notes: tg.permEditFixedNotes,
    edit_client_notes: tg.permEditClientNotes,
    delete_client_notes: tg.permDeleteClientNotes,
    manage_client_sections: tg.permManageClientSections,
    edit_client_section_content: tg.permEditClientSectionContent,
    create_appointments: tg.permCreateAppointments,
  };

  const isAdmin = user.role === 'admin';
  const memberships = ((user as any).groupMemberships as GroupMembership[] | undefined) ?? [];
  const effectivePerms = getEffectivePermissions(memberships, (user as any).effectivePermissions);

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
        {ut.effectivePermissions}
      </Typography>
      {isAdmin ? (
        <Typography variant="caption" display="block">{ut.adminAllPermissions}</Typography>
      ) : effectivePerms.length === 0 ? (
        <Typography variant="caption" display="block" color="text.secondary">{ut.noSpecialPermissions}</Typography>
      ) : (
        effectivePerms.map((p) => (
          <Typography key={p} variant="caption" display="block">• {permLabels[p]}</Typography>
        ))
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} arrow placement="top" enterDelay={200}>
      {children}
    </Tooltip>
  );
}

function UserAvatar({ user, size = 36, onClick }: { user: User; size?: number; onClick?: () => void }) {
  const avatarUrl = (user as any).avatarUrl;
  return (
    <Avatar
      src={avatarUrl ?? undefined}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        bgcolor: 'primary.main',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'transform 0.15s',
        '&:hover': onClick ? { transform: 'scale(1.08)' } : {},
      }}
      onClick={onClick}
    >
      {!avatarUrl && (user.name?.charAt(0) ?? '?').toUpperCase()}
    </Avatar>
  );
}

export default function Users() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const ut = t.users;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [seatUsage, setSeatUsage] = useState<{
    usedSeats: number;
    planSeats: number | null;
    planName: string;
    unlimited: boolean;
    available: number | null;
    limitReached: boolean;
    hasActiveSubscription: boolean;
  } | null>(null);

  const [zoomUser, setZoomUser] = useState<User | null>(null);

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
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [permissionTarget, setPermissionTarget] = useState<User | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<Record<string, 'inherit' | 'grant' | 'deny'>>({});
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const activeCount = users.filter((u) => u.isActive !== false).length;

  const refreshSeatUsage = () => {
    fetch('/api/stripe/seat-usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSeatUsage(d); })
      .catch(() => {});
  };

  useEffect(() => {
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
    }

    try {
      if (editTarget) {
        const body: UpdateUserBody = {
          name: form.name,
          email: form.email,
          role: form.role,
          mainLocation: form.mainLocation || null,
        } as any;
        await updateUser.mutateAsync({ id: editTarget.id, data: body });
      } else {
        const body: CreateUserBody = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
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
    await updateUser.mutateAsync({ id: deactivateConfirm.id, data: { isActive: false } as any });
    setDeactivateConfirm(null);
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteError(null);
    try {
      await deleteUser.mutateAsync({ id: deleteConfirm.id });
      setDeleteConfirm(null);
    } catch (err: any) {
      setDeleteError(err?.data?.error || err?.data?.message || err?.message || t.users.deleteError);
    }
  };

  const generateInviteLink = async () => {
    setInviteLoading(true);
    setInviteError('');
    setInviteLink('');
    setInviteCopied(false);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteError(data.message || ut.inviteError);
        return;
      }
      const { token } = await res.json();
      const base = window.location.origin;
      const appBase = (import.meta as any).env?.BASE_URL?.replace(/\/$/, '') ?? '/app';
      setInviteLink(`${base}${appBase}/invite/${token}`);
      setInviteOpen(true);
    } catch {
      setInviteError(ut.inviteError);
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    });
  };

  const isSaving = createUser.isPending || updateUser.isPending;
  const openPermissionSettings = (target: User) => {
    const current = (target as any).permissionOverrides ?? {};
    setPermissionDraft(Object.fromEntries(PERMISSION_KEYS.map((key) => [key, current[key] ?? 'inherit'])));
    setPermissionError(null);
    setPermissionTarget(target);
  };
  const savePermissionSettings = async () => {
    if (!permissionTarget) return;
    try {
      await updateUser.mutateAsync({
        id: permissionTarget.id,
        data: { permissionOverrides: permissionDraft } as any,
      });
      setPermissionTarget(null);
    } catch (error: any) {
      setPermissionError(error?.data?.message || error?.data?.error || ut.errorSaving);
    }
  };

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
            <Chip
              icon={<Group sx={{ fontSize: 14 }} />}
              label={`${activeCount} ${activeCount === 1 ? ut.activeUser : ut.activeUsers} · ${users.length} ${ut.totalUsers}`}
              color="default"
              size="small"
              variant="outlined"
            />
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
            ) : null}
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
            <Tooltip title={isFull ? ut.errorSeatLimit : ut.inviteUser}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={inviteLoading ? <CircularProgress size={16} /> : <PersonAddAlt1 />}
                  onClick={generateInviteLink}
                  disabled={isFull || inviteLoading}
                  size={isMobile ? 'small' : 'medium'}
                >
                  {isMobile ? '' : ut.inviteUser}
                </Button>
              </span>
            </Tooltip>
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
              {seatUsage.available ?? 0} {ut.seatsAvailableLabel}
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
          {users.filter((u) => u.id !== currentUser?.id).length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={1.5} py={5}>
              <Typography variant="body1" fontWeight={600} color="text.secondary">{ut.noUsers}</Typography>
              <Typography variant="body2" color="text.secondary">{ut.noUsersDesc}</Typography>
              {currentUser?.role === 'admin' && (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<PersonAdd fontSize="small" />}
                  onClick={generateInviteLink}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? ut.inviteGenerating : ut.inviteUser}
                </Button>
              )}
            </Box>
          ) : (
            users.map((u) => {
              const isActive = u.isActive !== false;
              const isCurrentUser = u.id === currentUser?.id;
              const hasAvatar = !!(u as any).avatarUrl;
              return (
                <Card key={u.id} elevation={1} sx={{ opacity: isActive ? 1 : 0.6 }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={0.75}>
                      <UserAvatar
                        user={u}
                        size={40}
                        onClick={hasAvatar ? () => setZoomUser(u) : undefined}
                      />
                      <Box flex={1} minWidth={0}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" fontWeight={700} noWrap>
                            {u.name}
                          </Typography>
                          <Chip
                            label={isActive ? ut.active : ut.inactive}
                            size="small"
                            color={isActive ? 'success' : 'default'}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {u.email}
                        </Typography>
                      </Box>
                    </Box>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      <Chip
                        label={u.role === 'admin' ? t.role.admin : t.role.user}
                        size="small"
                        color={u.role === 'admin' ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        label={u.isAvailable !== false ? t.availability.available : t.availability.unavailable}
                        size="small"
                        variant="outlined"
                        color={u.isAvailable !== false ? 'success' : 'default'}
                      />
                      {((u as any).groupMemberships as GroupMembership[] | undefined)?.map((g) => (
                        <Chip key={g.id} label={g.name} size="small" variant="outlined" />
                      ))}
                      {(u as any).mainLocation && (
                        <Chip label={(u as any).mainLocation} size="small" variant="outlined" />
                      )}
                    </Box>
                    {/* Effective permissions row */}
                    {(() => {
                      const isAdmin = u.role === 'admin';
                      const memberships = ((u as any).groupMemberships as GroupMembership[] | undefined) ?? [];
                      const effectivePerms = getEffectivePermissions(memberships, (u as any).effectivePermissions);
                      const permLabels: Record<string, string> = {
                        change_status: t.groups.permChangeStatus,
                        add_notes: t.groups.permAddNotes,
                        edit_fixed_notes: t.groups.permEditFixedNotes,
                        edit_client_notes: t.groups.permEditClientNotes,
                        delete_client_notes: t.groups.permDeleteClientNotes,
                        manage_client_sections: t.groups.permManageClientSections,
                        edit_client_section_content: t.groups.permEditClientSectionContent,
                        create_appointments: t.groups.permCreateAppointments,
                      };
                      if (!isAdmin && effectivePerms.length === 0) return null;
                      return (
                        <Box display="flex" alignItems="flex-start" gap={0.5} mt={0.75} flexWrap="wrap">
                          <SecurityOutlined sx={{ fontSize: 14, mt: 0.25, color: isAdmin ? 'secondary.main' : 'primary.main', flexShrink: 0 }} />
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {isAdmin ? (
                              <Typography variant="caption" color="text.secondary">{ut.adminAllPermissions}</Typography>
                            ) : (
                              effectivePerms.map((p) => (
                                <Chip key={p} label={permLabels[p]} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />
                              ))
                            )}
                          </Box>
                        </Box>
                      );
                    })()}
                  </CardContent>
                  {currentUser?.role === 'admin' && (
                    <CardActions sx={{ pt: 0, px: 2, pb: 1.5, gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" startIcon={<Edit fontSize="small" />} onClick={() => openEdit(u)}>
                        {ut.editUser}
                      </Button>
                      <Button size="small" startIcon={<SecurityOutlined fontSize="small" />} onClick={() => openPermissionSettings(u)}>
                        {ut.managePermissions}
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
                      {!isCurrentUser && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteForever fontSize="small" />}
                          onClick={() => { setDeleteError(null); setDeleteConfirm(u); }}
                        >
                          {ut.deleteUser}
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
                <TableCell><strong>{t.availability.available}</strong></TableCell>
                <TableCell><strong>{ut.createdAt}</strong></TableCell>
                <TableCell align="right"><strong>{ut.actions}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.filter((u) => u.id !== currentUser?.id).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                      <Typography variant="body1" fontWeight={600} color="text.secondary">{ut.noUsers}</Typography>
                      <Typography variant="body2" color="text.secondary">{ut.noUsersDesc}</Typography>
                      {currentUser?.role === 'admin' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<PersonAdd fontSize="small" />}
                          onClick={generateInviteLink}
                          disabled={inviteLoading}
                        >
                          {inviteLoading ? ut.inviteGenerating : ut.inviteUser}
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isActive = u.isActive !== false;
                  const isCurrentUser = u.id === currentUser?.id;
                  const hasAvatar = !!(u as any).avatarUrl;
                  return (
                    <TableRow
                      key={u.id}
                      sx={{ opacity: isActive ? 1 : 0.55, '&:last-child td': { border: 0 } }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <Tooltip title={hasAvatar ? 'Vedi foto' : ''} disableHoverListener={!hasAvatar}>
                            <span>
                              <UserAvatar
                                user={u}
                                size={32}
                                onClick={hasAvatar ? () => setZoomUser(u) : undefined}
                              />
                            </span>
                          </Tooltip>
                          <Typography variant="body2" fontWeight={500}>{u.name}</Typography>
                        </Box>
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
                        <UserPermissionsTooltip user={u}>
                          <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap" sx={{ cursor: 'default' }}>
                            {((u as any).groupMemberships as GroupMembership[] | undefined)?.length
                              ? ((u as any).groupMemberships as GroupMembership[]).map((g) => (
                                  <Chip key={g.id} label={g.name} size="small" variant="outlined" />
                                ))
                              : <Typography variant="body2" color="text.secondary">—</Typography>}
                            <SecurityOutlined
                              sx={{
                                fontSize: 16,
                                ml: 0.25,
                                color: (() => {
                                  if (u.role === 'admin') return 'secondary.main';
                                  const perms = getEffectivePermissions(((u as any).groupMemberships as GroupMembership[] | undefined) ?? [], (u as any).effectivePermissions);
                                  return perms.length > 0 ? 'primary.main' : 'action.disabled';
                                })(),
                              }}
                            />
                          </Box>
                        </UserPermissionsTooltip>
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
                        <Chip
                          label={u.isAvailable !== false ? t.availability.available : t.availability.unavailable}
                          size="small"
                          variant="outlined"
                          color={u.isAvailable !== false ? 'success' : 'default'}
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
                            <Tooltip title={ut.managePermissions}>
                              <IconButton size="small" onClick={() => openPermissionSettings(u)}>
                                <SecurityOutlined fontSize="small" />
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
                            {!isCurrentUser && (
                              <Tooltip title={ut.deleteUser}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => { setDeleteError(null); setDeleteConfirm(u); }}
                                >
                                  <DeleteForever fontSize="small" />
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

      {/* Avatar zoom dialog */}
      <Dialog
        open={!!zoomUser}
        onClose={() => setZoomUser(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', bgcolor: '#000' } }}
      >
        <Box position="relative">
          <IconButton
            onClick={() => setZoomUser(null)}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', zIndex: 1, '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' } }}
          >
            <Close fontSize="small" />
          </IconButton>
          {zoomUser && (
            <Box>
              <Box
                component="img"
                src={(zoomUser as any).avatarUrl}
                alt={zoomUser.name}
                sx={{ width: '100%', display: 'block', maxHeight: '70vh', objectFit: 'contain' }}
              />
              <Box px={2} py={1.5} bgcolor="background.paper">
                <Typography variant="subtitle1" fontWeight={700}>{zoomUser.name}</Typography>
                <Typography variant="body2" color="text.secondary">{zoomUser.email}</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={!!permissionTarget} onClose={() => setPermissionTarget(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{ut.managePermissions}: {permissionTarget?.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {permissionError && <Alert severity="error" sx={{ mb: 2 }}>{permissionError}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {ut.permissionOverrideHelp}
          </Typography>
          {permissionTarget?.role === 'admin' && (
            <Alert severity="info" sx={{ mb: 2 }}>{ut.adminOverrideNote}</Alert>
          )}
          {PERMISSION_KEYS.map((key) => {
            const labels: Record<string, string> = {
              change_status: t.groups.permChangeStatus,
              add_notes: t.groups.permAddNotes,
              edit_fixed_notes: t.groups.permEditFixedNotes,
              edit_client_notes: t.groups.permEditClientNotes,
              delete_client_notes: t.groups.permDeleteClientNotes,
              manage_client_sections: t.groups.permManageClientSections,
              edit_client_section_content: t.groups.permEditClientSectionContent,
              create_appointments: t.groups.permCreateAppointments,
              view_worked_hours: t.groups.permViewWorkedHours,
            };
            const inherited = ((permissionTarget as any)?.inheritedGroupPermissions ?? []).includes(key);
            const effective = ((permissionTarget as any)?.effectivePermissions ?? []).includes(key);
            return (
              <Box key={key} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 150px' }, gap: 1, alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{labels[key]}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ut.inherited}: {inherited ? ut.granted : ut.notGranted} · {ut.effective}: {effective ? ut.granted : ut.denied}
                  </Typography>
                </Box>
                <FormControl size="small" fullWidth>
                  <InputLabel>{ut.override}</InputLabel>
                  <Select
                    value={permissionDraft[key] ?? 'inherit'}
                    label={ut.override}
                    disabled={permissionTarget?.role === 'admin'}
                    onChange={(event) => setPermissionDraft((draft) => ({ ...draft, [key]: event.target.value as 'inherit' | 'grant' | 'deny' }))}
                  >
                    <MenuItem value="inherit">{ut.inheritGroups}</MenuItem>
                    <MenuItem value="grant">{ut.grant}</MenuItem>
                    <MenuItem value="deny">{ut.deny}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPermissionTarget(null)}>{ut.cancel}</Button>
          <Button variant="contained" onClick={savePermissionSettings} disabled={updateUser.isPending || permissionTarget?.role === 'admin'}>
            {updateUser.isPending ? <CircularProgress size={16} /> : ut.save}
          </Button>
        </DialogActions>
      </Dialog>

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
            {!editTarget && (
              <TextField
                label={ut.password}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                fullWidth
              />
            )}
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
            <TextField
              label={ut.location}
              value={form.mainLocation}
              onChange={(e) => setForm((f) => ({ ...f, mainLocation: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleClose}>{ut.cancel}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          >
            {editTarget ? ut.save : ut.createUser}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate confirm dialog */}
      <Dialog open={!!deactivateConfirm} onClose={() => setDeactivateConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{ut.deactivate}</DialogTitle>
        <DialogContent>
          <Typography>{ut.deactivateConfirm}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateConfirm(null)}>{ut.cancel}</Button>
          <Button color="error" variant="contained" onClick={confirmDeactivate}>{ut.deactivate}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{ut.deleteUser}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
          <Typography>{ut.deleteUserConfirm}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>{ut.cancel}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>{ut.deleteUser}</Button>
        </DialogActions>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{ut.inviteLinkTitle}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          {inviteError && <Alert severity="error" sx={{ mb: 2 }}>{inviteError}</Alert>}
          <Typography variant="body2" color="text.secondary" mb={2}>{ut.inviteLinkDesc}</Typography>
          <TextField
            fullWidth
            value={inviteLink}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton onClick={copyInviteLink} edge="end">
                  {inviteCopied ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>{ut.cancel}</Button>
          <Button variant="contained" onClick={copyInviteLink} startIcon={inviteCopied ? <Check /> : <ContentCopy />}>
            {inviteCopied ? ut.inviteLinkCopied : ut.inviteLinkCopy}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
