import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Avatar, IconButton, Tooltip, Switch, FormControlLabel, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
  ArrowBack, ConfirmationNumber, Edit, DragIndicator, Visibility, VisibilityOff,
  Email, Phone, Business, Save, Cancel,
} from '@mui/icons-material';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useGetClient, useUpdateClient, getListClientsQueryKey,
} from '@workspace/api-client-react';
import type { ClientInput } from '@workspace/api-client-react';
import ClientNotesBlock from '../components/ClientNotesBlock';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  open: 'info',
  waiting: 'warning',
  resolved: 'success',
  closed: 'default',
};

const PRIORITY_COLORS: Record<string, 'default' | 'warning' | 'error' | 'info'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const AVATAR_COLORS = [
  '#1565c0', '#6a1b9a', '#2e7d32', '#c62828', '#00838f',
  '#e65100', '#4527a0', '#558b2f', '#ad1457', '#00695c',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <>
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="body2" mb={2} sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </>
  );
}

const BLOCK_IDS = ['company-info', 'linked-tickets', 'client-notes'] as const;
type BlockId = typeof BLOCK_IDS[number];

interface BlockConfig {
  id: BlockId;
  visible: boolean;
}

const SHARED_LAYOUT_KEY = 'td_client_layout_v2_shared';

function loadLayout(): BlockConfig[] {
  try {
    const raw = localStorage.getItem(SHARED_LAYOUT_KEY);
    if (!raw) return defaultLayout();
    const parsed: BlockConfig[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultLayout();
    const valid = parsed.filter((b) => BLOCK_IDS.includes(b.id));
    if (valid.length !== BLOCK_IDS.length) return defaultLayout();
    return valid;
  } catch {
    return defaultLayout();
  }
}

function defaultLayout(): BlockConfig[] {
  return BLOCK_IDS.map((id) => ({ id, visible: true }));
}

function saveLayout(layout: BlockConfig[]) {
  try {
    localStorage.setItem(SHARED_LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

interface SortableBlockProps {
  id: string;
  editMode: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  title: string;
  visibleLabel: string;
  hiddenLabel: string;
  children: React.ReactNode;
}

function SortableBlock({
  id, editMode, visible, onToggleVisible, title, visibleLabel, hiddenLabel, children,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} mb={3}>
      {editMode && (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2, py: 1,
            bgcolor: 'primary.50',
            border: '2px dashed',
            borderColor: 'primary.200',
            borderBottom: 0,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              {...attributes}
              {...listeners}
              sx={{ cursor: 'grab', color: 'text.secondary', display: 'flex', alignItems: 'center' }}
            >
              <DragIndicator />
            </Box>
            <Typography variant="subtitle2" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          <Tooltip title={visible ? visibleLabel : hiddenLabel}>
            <Switch
              size="small"
              checked={visible}
              onChange={onToggleVisible}
            />
          </Tooltip>
        </Box>
      )}
      <Box
        sx={{
          opacity: editMode && !visible ? 0.4 : 1,
          transition: 'opacity 0.2s',
          ...(editMode ? {
            border: '2px dashed',
            borderColor: 'primary.200',
            borderTop: 0,
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          } : {}),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function ClientDetail() {
  const { t } = useLanguage();
  const tc = t.clients;
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? '', 10);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();

  const { data, isLoading, isError } = useGetClient(clientId);
  const updateClient = useUpdateClient();
  const [layout, setLayout] = useState<BlockConfig[]>(() => loadLayout());
  const [editMode, setEditMode] = useState(false);
  const [draftLayout, setDraftLayout] = useState<BlockConfig[]>([]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState<ClientInput & Record<string, any>>({
    name: '', email: null, phone: null, vatNumber: null,
    taxCode: null, address: null, pec: null, contactPerson: null, notes: null,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetch('/api/settings/client-layout', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.layout) || d.layout.length === 0) return;
        const valid = (d.layout as BlockConfig[]).filter((b) => BLOCK_IDS.includes(b.id as BlockId));
        if (valid.length !== BLOCK_IDS.length) return;
        setLayout(valid);
        saveLayout(valid);
      })
      .catch(() => {});
  }, []);

  const handleEnterEditMode = useCallback(() => {
    setDraftLayout([...layout]);
    setEditMode(true);
  }, [layout]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setDraftLayout([]);
  }, []);

  const handleSaveLayout = useCallback(async () => {
    setLayout(draftLayout);
    saveLayout(draftLayout);
    setEditMode(false);
    setDraftLayout([]);
    try {
      await fetch('/api/settings/client-layout', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: draftLayout }),
      });
    } catch {
    }
  }, [draftLayout]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraftLayout((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggleVisible = useCallback((id: BlockId) => {
    setDraftLayout((prev) =>
      prev.map((b) => b.id === id ? { ...b, visible: !b.visible } : b)
    );
  }, []);

  const openEditDialog = useCallback(() => {
    if (!data) return;
    const client = data as any;
    setForm({
      name: client.name ?? '',
      email: client.email ?? null,
      phone: client.phone ?? null,
      vatNumber: client.vatNumber ?? null,
      taxCode: client.taxCode ?? null,
      address: client.address ?? null,
      pec: client.pec ?? null,
      contactPerson: client.contactPerson ?? null,
      notes: client.notes ?? null,
    });
    setFormError('');
    setEditDialogOpen(true);
  }, [data]);

  const handleSaveClient = async () => {
    if (!form.name?.trim() || !form.vatNumber?.trim()) {
      setFormError(tc.errorRequired);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        vatNumber: form.vatNumber?.trim() || null,
        taxCode: form.taxCode?.trim() || null,
        address: form.address?.trim() || null,
        pec: form.pec?.trim() || null,
        contactPerson: form.contactPerson?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      await updateClient.mutateAsync({ id: clientId, data: payload });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setEditDialogOpen(false);
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.status === 409) {
        setFormError(tc.errorDuplicateVat);
      } else {
        setFormError(tc.errorSaving);
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" pt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => setLocation('/clients')} sx={{ mb: 2 }}>
          {tc.backToClients}
        </Button>
        <Typography color="error">Client not found.</Typography>
      </Box>
    );
  }

  const client = data as any;
  const tickets: any[] = client.tickets ?? [];
  const avatarColor = getAvatarColor(client.name ?? '');
  const initials = getInitials(client.name ?? '?');

  const activeLayout = editMode ? draftLayout : layout;

  const blockContent: Record<BlockId, React.ReactNode> = {
    'client-notes': (
      <Card variant="outlined" sx={{ borderRadius: editMode ? 0 : 2 }}>
        <CardContent>
          {isAdmin ? (
            <ClientNotesBlock clientId={clientId} />
          ) : (
            <Typography variant="body2" color="text.secondary">{(t as any).clientNotes?.noNotes}</Typography>
          )}
        </CardContent>
      </Card>
    ),
    'company-info': (
      <Card variant="outlined" sx={{ borderRadius: editMode ? 0 : 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <InfoRow label={tc.vatNumber} value={client.vatNumber} />
              <InfoRow label={tc.taxCode} value={client.taxCode} />
              <InfoRow label={tc.address} value={client.address} />
              <InfoRow label={tc.pec} value={client.pec} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <InfoRow label={tc.contactPerson} value={client.contactPerson} />
              <InfoRow label={tc.email} value={client.email} />
              <InfoRow label={tc.phone} value={client.phone} />
              <InfoRow label={tc.notes} value={client.notes} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    ),
    'linked-tickets': (
      <Card variant="outlined" sx={{ borderRadius: editMode ? 0 : 2 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Box display="flex" alignItems="center" gap={1} px={2} pt={2} pb={1.5}>
            <ConfirmationNumber fontSize="small" color="action" />
            <Typography variant="subtitle1" fontWeight={600}>
              {tc.linkedTickets} ({tickets.length})
            </Typography>
          </Box>
          {tickets.length === 0 ? (
            <Box px={2} pb={2}>
              <Typography color="text.secondary" variant="body2">{tc.noLinkedTickets}</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colTitle}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colStatus}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colPriority}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colAssignee}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setLocation(`/tickets/${ticket.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          #{ticket.ticketNumber ?? ticket.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{ticket.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(t.status as any)[ticket.status] ?? ticket.status}
                          color={STATUS_COLORS[ticket.status] ?? 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(t.priority as any)[ticket.priority] ?? ticket.priority}
                          color={PRIORITY_COLORS[ticket.priority] ?? 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ticket.assignedToName ?? t.ticketDetail.unassigned}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    ),
  };

  const blockTitles: Record<BlockId, string> = {
    'company-info': tc.blockCompanyInfo,
    'linked-tickets': tc.blockLinkedTickets,
    'client-notes': tc.blockNotes,
  };

  return (
    <Box>
      {/* Visual Identity Header */}
      <Box
        sx={{
          borderRadius: 3,
          mb: 4,
          p: { xs: 2.5, sm: 3.5 },
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 100%)`
              : `linear-gradient(135deg, #f0f4ff 0%, #e8eaf6 100%)`,
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background accent */}
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: '50%',
            bgcolor: avatarColor,
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        />

        {/* Back link */}
        <Button
          startIcon={<ArrowBack />}
          size="small"
          onClick={() => setLocation('/clients')}
          sx={{ mb: 2, opacity: 0.75, '&:hover': { opacity: 1 } }}
        >
          {tc.backToClients}
        </Button>

        <Box display="flex" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={3} flexWrap="wrap">
          {/* Initials avatar */}
          <Avatar
            sx={{
              width: { xs: 56, sm: 72 },
              height: { xs: 56, sm: 72 },
              bgcolor: avatarColor,
              fontSize: { xs: '1.4rem', sm: '1.8rem' },
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: 3,
            }}
          >
            {initials}
          </Avatar>

          {/* Name + contact chips */}
          <Box flex={1} minWidth={0}>
            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ fontSize: { xs: '1.4rem', sm: '1.75rem' }, mb: 0.5 }}
            >
              {client.name}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1} mt={0.5}>
              {client.email && (
                <Chip
                  icon={<Email fontSize="small" />}
                  label={client.email}
                  size="small"
                  variant="outlined"
                  sx={{ bgcolor: 'background.paper' }}
                />
              )}
              {client.phone && (
                <Chip
                  icon={<Phone fontSize="small" />}
                  label={client.phone}
                  size="small"
                  variant="outlined"
                  sx={{ bgcolor: 'background.paper' }}
                />
              )}
              {client.vatNumber && (
                <Chip
                  icon={<Business fontSize="small" />}
                  label={client.vatNumber}
                  size="small"
                  variant="outlined"
                  sx={{ bgcolor: 'background.paper' }}
                />
              )}
            </Box>
          </Box>

          {/* Action buttons */}
          <Box display="flex" flexShrink={0} gap={1} flexWrap="wrap">
            {isAdmin && !editMode && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  size="small"
                  onClick={openEditDialog}
                >
                  {tc.editClient}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleEnterEditMode}
                >
                  {tc.editLayout}
                </Button>
              </>
            )}
            {editMode && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Cancel />}
                  onClick={handleCancelEdit}
                >
                  {tc.cancelLayout}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Save />}
                  onClick={handleSaveLayout}
                >
                  {tc.saveLayout}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Edit mode hint */}
        {editMode && (
          <Alert severity="info" sx={{ mt: 2 }} icon={<DragIndicator />}>
            {tc.editLayoutHint}
          </Alert>
        )}
      </Box>

      {/* Block layout */}
      {editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={draftLayout.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {draftLayout.map((block) => (
              <SortableBlock
                key={block.id}
                id={block.id}
                editMode
                visible={block.visible}
                onToggleVisible={() => handleToggleVisible(block.id)}
                title={blockTitles[block.id]}
                visibleLabel={tc.blockVisible}
                hiddenLabel={tc.blockHidden}
              >
                {blockContent[block.id]}
              </SortableBlock>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        activeLayout
          .filter((b) => b.visible)
          .map((block) => (
            <Box key={block.id} mb={3}>
              {blockContent[block.id]}
            </Box>
          ))
      )}

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{tc.editClient}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={tc.name}
              required
              fullWidth
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label={tc.vatNumber}
              fullWidth
              value={form.vatNumber ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value || null }))}
            />
            <TextField
              label={tc.taxCode}
              fullWidth
              value={form.taxCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, taxCode: e.target.value || null }))}
            />
            <TextField
              label={tc.address}
              fullWidth
              value={form.address ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value || null }))}
            />
            <TextField
              label={tc.pec}
              fullWidth
              value={form.pec ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, pec: e.target.value || null }))}
            />
            <TextField
              label={tc.contactPerson}
              fullWidth
              value={form.contactPerson ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value || null }))}
            />
            <TextField
              label={tc.email}
              fullWidth
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
            />
            <TextField
              label={tc.phone}
              fullWidth
              value={form.phone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))}
            />
            <TextField
              label={tc.notes}
              fullWidth
              multiline
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>{tc.cancel}</Button>
          <Button variant="contained" onClick={handleSaveClient} disabled={saving}>
            {saving ? tc.saving : tc.save}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
