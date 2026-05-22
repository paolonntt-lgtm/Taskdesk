import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, InputAdornment, Chip, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, Search, OpenInNew } from '@mui/icons-material';
import { useListClients, useCreateClient, useUpdateClient, useDeleteClient, getListClientsQueryKey } from '@workspace/api-client-react';
import type { Client, ClientInput } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

const emptyForm: ClientInput = { name: '', email: null, phone: null, vatNumber: null, notes: null };

export default function Clients() {
  const { t } = useLanguage();
  const tc = t.clients;
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading } = useListClients({ search: search || undefined });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const openCreate = useCallback(() => {
    setEditingClient(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email ?? null,
      phone: client.phone ?? null,
      vatNumber: client.vatNumber ?? null,
      notes: client.notes ?? null,
    });
    setFormError('');
    setDialogOpen(true);
  }, []);

  const handleSave = async () => {
    if (!form.name?.trim()) { setFormError(tc.errorRequired); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        vatNumber: form.vatNumber?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, data: payload });
      } else {
        await createClient.mutateAsync({ data: payload });
      }
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setDialogOpen(false);
    } catch {
      setFormError(tc.errorSaving);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteError('');
    try {
      await deleteClient.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setConfirmDeleteId(null);
    } catch {
      setDeleteError(tc.errorDeleting);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">{tc.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {clients.length} {tc.subtitle}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          {tc.addClient}
        </Button>
      </Box>

      <Box mb={2}>
        <TextField
          size="small"
          placeholder={tc.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 260 }}
        />
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colName}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colEmail}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colPhone}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tc.colVat}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">{tc.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {tc.noClients}
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => setLocation(`/clients/${client.id}`)}
                    >
                      {client.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{client.email ?? '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{client.phone ?? '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{client.vatNumber ?? '—'}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={tc.detailTitle}>
                    <IconButton size="small" onClick={() => setLocation(`/clients/${client.id}`)}>
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tc.editClient}>
                    <IconButton size="small" onClick={() => openEdit(client)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={tc.deleteClient}>
                    <IconButton size="small" color="error" onClick={() => setConfirmDeleteId(client.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClient ? tc.editClient : tc.createClient}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={tc.name}
              required
              fullWidth
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label={tc.email}
              fullWidth
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value || null }))}
            />
            <TextField
              label={tc.phone}
              fullWidth
              value={form.phone ?? ''}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value || null }))}
            />
            <TextField
              label={tc.vatNumber}
              fullWidth
              value={form.vatNumber ?? ''}
              onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value || null }))}
            />
            <TextField
              label={tc.notes}
              fullWidth
              multiline
              rows={3}
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{tc.cancel}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? tc.saving : tc.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.deleteClient}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
          <Typography>{tc.deleteClientConfirm}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDeleteId(null)}>{tc.cancel}</Button>
          <Button variant="contained" color="error" onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}>
            {tc.deleteClient}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
