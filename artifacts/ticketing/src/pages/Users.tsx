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
} from '@mui/material';
import {
  Add,
  Edit,
  PersonOff,
  PersonAdd,
  InfoOutlined,
} from '@mui/icons-material';
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
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  group: '',
};

export default function Users() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const ut = t.users;

  const [groups, setGroups] = useState<string[]>([]);

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

  useEffect(() => {
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
  }, []);

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
        };
        if (form.password) body.password = form.password;
        await updateUser.mutateAsync({ id: editTarget.id, data: body });
      } else {
        const body: CreateUserBody = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          group: form.group || null,
        };
        await createUser.mutateAsync({ data: body });
      }
      setDialogOpen(false);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const serverMsg: string =
        err?.data?.message || err?.data?.error || err?.message || '';

      if (status === 409 || serverMsg.toLowerCase().includes('email')) {
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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {ut.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={`${activeCount} ${ut.subtitle}`} color="primary" size="small" />
            <Tooltip title={ut.billingNote}>
              <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
            </Tooltip>
          </Box>
        </Box>
        {currentUser?.role === 'admin' && (
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            {ut.addUser}
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 3 }} icon={<InfoOutlined />}>
        {ut.billingNote}
      </Alert>

      <TableContainer component={Paper} elevation={1}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>{ut.name}</strong></TableCell>
              <TableCell><strong>{ut.email}</strong></TableCell>
              <TableCell><strong>{ut.role}</strong></TableCell>
              <TableCell><strong>{ut.group}</strong></TableCell>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
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
