import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Avatar, IconButton, Tooltip, Switch, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  ArrowBack, ConfirmationNumber, Edit, DragIndicator, Visibility, VisibilityOff,
  Email, Phone, Business, Save, Cancel, DriveFileRenameOutline, Close, Add,
  StickyNote2,
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
import FixedNotesBlock from '../components/FixedNotesBlock';
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

const BUILT_IN_BLOCK_IDS = ['company-info', 'fixed-notes', 'client-notes', 'linked-tickets'] as const;
type BuiltinBlockId = typeof BUILT_IN_BLOCK_IDS[number];

interface BlockConfig {
  id: string;
  instanceId: string;
  type?: string;
  visible: boolean;
  customName?: string;
  content?: string;
}

function defaultLayout(): BlockConfig[] {
  return BUILT_IN_BLOCK_IDS.map((id) => ({ id, instanceId: id, visible: true }));
}

function migrateBlock(b: any): BlockConfig {
  return {
    id: b.id ?? b.instanceId ?? '',
    instanceId: b.instanceId ?? b.id ?? '',
    type: b.type ?? undefined,
    visible: b.visible !== false,
    customName: b.customName ?? undefined,
    content: typeof b.content === 'string' ? b.content : undefined,
  };
}

function clientLayoutCacheKey(clientId: number): string {
  return `td_client_layout_${clientId}`;
}

function loadClientLayoutCache(clientId: number): BlockConfig[] {
  try {
    const raw = localStorage.getItem(clientLayoutCacheKey(clientId));
    if (!raw) return defaultLayout();
    const parsed: any[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultLayout();
    const migrated = parsed.map(migrateBlock).filter((b) => b.instanceId);
    return migrated.length > 0 ? migrated : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

function saveClientLayoutCache(clientId: number, layout: BlockConfig[]) {
  try {
    localStorage.setItem(clientLayoutCacheKey(clientId), JSON.stringify(layout));
  } catch {}
}

function isCustomBlock(block: BlockConfig): boolean {
  return !BUILT_IN_BLOCK_IDS.includes(block.instanceId as BuiltinBlockId);
}

interface SortableBlockProps {
  instanceId: string;
  editMode: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  onRename: () => void;
  onDelete?: () => void;
  title: string;
  visibleLabel: string;
  hiddenLabel: string;
  renameLabel: string;
  deleteLabel: string;
  isCustom: boolean;
  children: React.ReactNode;
}

function SortableBlock({
  instanceId, editMode, visible, onToggleVisible, onRename, onDelete,
  title, visibleLabel, hiddenLabel, renameLabel, deleteLabel, isCustom, children,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: instanceId });

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
            <Tooltip title={renameLabel}>
              <IconButton size="small" onClick={onRename} sx={{ ml: 0.5 }}>
                <DriveFileRenameOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            {isCustom && onDelete && (
              <Tooltip title={deleteLabel}>
                <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main' }}>
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={visible ? visibleLabel : hiddenLabel}>
              <Switch
                size="small"
                checked={visible}
                onChange={onToggleVisible}
              />
            </Tooltip>
          </Box>
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

const ADDABLE_BLOCK_TYPES = [
  { type: 'custom-note', icon: <StickyNote2 fontSize="small" /> },
] as const;

export default function ClientDetail() {
  const { t } = useLanguage();
  const tc = t.clients;
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? '', 10);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userGroupPerms: string[] = ((user as any)?.groupPermissions as string[] | undefined) ?? [];
  const canManageSections = isAdmin || userGroupPerms.includes('manage_client_sections');
  const canEditSectionContent = isAdmin || userGroupPerms.includes('edit_client_section_content');
  const qc = useQueryClient();

  const { data, isLoading, isError } = useGetClient(clientId);
  const updateClient = useUpdateClient();
  const [layout, setLayout] = useState<BlockConfig[]>(() => loadClientLayoutCache(clientId));
  const [editMode, setEditMode] = useState(false);
  const [draftLayout, setDraftLayout] = useState<BlockConfig[]>([]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState<ClientInput & Record<string, any>>({
    name: '', email: null, phone: null, vatNumber: null,
    taxCode: null, address: null, pec: null, contactPerson: null, notes: null,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [addSectionOpen, setAddSectionOpen] = useState(false);

  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentDraft, setContentDraft] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!data) return;

    const perClientCustom: BlockConfig[] = (() => {
      const raw = (data as any).layout;
      if (!Array.isArray(raw)) return [];
      return (raw as any[]).map(migrateBlock).filter((b: BlockConfig) => isCustomBlock(b));
    })();

    fetch('/api/settings/client-layout', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        let builtins: BlockConfig[];
        if (d?.layout && Array.isArray(d.layout)) {
          const migrated = (d.layout as any[]).map(migrateBlock)
            .filter((b: BlockConfig) => BUILT_IN_BLOCK_IDS.includes(b.instanceId as BuiltinBlockId));
          const storedIds = new Set<string>(migrated.map((b: BlockConfig) => b.instanceId));
          const missing = BUILT_IN_BLOCK_IDS
            .filter((id) => !storedIds.has(id))
            .map((id) => ({ id, instanceId: id, visible: true }));
          builtins = [...migrated, ...missing];
        } else {
          builtins = defaultLayout();
        }
        const combined = [...builtins, ...perClientCustom];
        setLayout(combined);
        saveClientLayoutCache(clientId, combined);
      })
      .catch(() => {
        setLayout([...defaultLayout(), ...perClientCustom]);
      });
  }, [data, clientId]);

  const handleEnterEditMode = useCallback(() => {
    setDraftLayout([...layout]);
    setEditMode(true);
  }, [layout]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setDraftLayout([]);
  }, []);

  const handleSaveLayout = useCallback(async () => {
    const builtins = draftLayout.filter((b) => BUILT_IN_BLOCK_IDS.includes(b.instanceId as BuiltinBlockId));
    const custom = draftLayout.filter((b) => isCustomBlock(b));

    setLayout(draftLayout);
    saveClientLayoutCache(clientId, draftLayout);
    setEditMode(false);
    setDraftLayout([]);

    try {
      await Promise.all([
        fetch('/api/settings/client-layout', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: builtins }),
        }),
        fetch(`/api/clients/${clientId}/layout`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: custom }),
        }),
      ]);
    } catch {}
  }, [draftLayout, clientId]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraftLayout((prev) => {
        const oldIndex = prev.findIndex((b) => b.instanceId === active.id);
        const newIndex = prev.findIndex((b) => b.instanceId === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggleVisible = useCallback((instanceId: string) => {
    setDraftLayout((prev) =>
      prev.map((b) => b.instanceId === instanceId ? { ...b, visible: !b.visible } : b)
    );
  }, []);

  const openRenameDialog = useCallback((instanceId: string, currentName: string) => {
    setRenamingInstanceId(instanceId);
    setRenameValue(currentName);
    setRenameDialogOpen(true);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (!renamingInstanceId) return;
    const trimmed = renameValue.trim();
    setDraftLayout((prev) =>
      prev.map((b) =>
        b.instanceId === renamingInstanceId
          ? { ...b, customName: trimmed || undefined }
          : b
      )
    );
    setRenameDialogOpen(false);
    setRenamingInstanceId(null);
    setRenameValue('');
  }, [renamingInstanceId, renameValue]);

  const handleDeleteBlock = useCallback((instanceId: string) => {
    setDraftLayout((prev) => prev.filter((b) => b.instanceId !== instanceId));
  }, []);

  const handleStartEditContent = useCallback((block: BlockConfig) => {
    setEditingContentId(block.instanceId);
    setContentDraft(block.content ?? '');
  }, []);

  const handleCancelEditContent = useCallback(() => {
    setEditingContentId(null);
    setContentDraft('');
  }, []);

  const handleSaveContent = useCallback(async (instanceId: string) => {
    const trimmed = contentDraft.trim();
    const newLayout = layout.map((b) =>
      b.instanceId === instanceId ? { ...b, content: trimmed || undefined } : b
    );
    setLayout(newLayout);
    saveClientLayoutCache(clientId, newLayout);
    setEditingContentId(null);
    setContentDraft('');
    setSavingContent(true);
    const custom = newLayout.filter((b) => isCustomBlock(b));
    try {
      await fetch(`/api/clients/${clientId}/layout`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: custom }),
      });
    } catch {}
    setSavingContent(false);
  }, [contentDraft, layout, clientId]);

  const handleAddSection = useCallback((type: string) => {
    const instanceId = `${type}-${Date.now()}`;
    const newBlock: BlockConfig = {
      id: type,
      instanceId,
      type,
      visible: true,
    };
    setDraftLayout((prev) => [...prev, newBlock]);
    setAddSectionOpen(false);
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

  const builtinDefaultTitles: Record<BuiltinBlockId, string> = {
    'company-info': tc.blockCompanyInfo,
    'linked-tickets': tc.blockLinkedTickets,
    'client-notes': tc.blockNotes,
    'fixed-notes': tc.blockFixedNotes,
  };

  function getBlockTitle(block: BlockConfig): string {
    if (block.customName) return block.customName;
    if (BUILT_IN_BLOCK_IDS.includes(block.instanceId as BuiltinBlockId)) {
      return builtinDefaultTitles[block.instanceId as BuiltinBlockId];
    }
    return tc.blockCustomNote;
  }

  function renderBlockContent(block: BlockConfig): React.ReactNode {
    const resolvedTitle = getBlockTitle(block);
    const radius = editMode ? 0 : 2;

    if (block.instanceId === 'fixed-notes') {
      return (
        <Card variant="outlined" sx={{ borderRadius: radius }}>
          <CardContent>
            <FixedNotesBlock
              clientId={clientId}
              initialNotes={(client as any).notes ?? null}
              isAdmin={isAdmin}
              canEditFixed={userGroupPerms.includes('edit_fixed_notes')}
              title={resolvedTitle}
            />
          </CardContent>
        </Card>
      );
    }

    if (block.instanceId === 'client-notes') {
      return (
        <Card variant="outlined" sx={{ borderRadius: radius }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <StickyNote2 fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                {resolvedTitle}
              </Typography>
            </Box>
            <ClientNotesBlock
              clientId={clientId}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              canEditClientNotes={userGroupPerms.includes('edit_client_notes')}
              canDeleteClientNotes={userGroupPerms.includes('delete_client_notes')}
            />
          </CardContent>
        </Card>
      );
    }

    if (block.instanceId === 'company-info') {
      return (
        <Card variant="outlined" sx={{ borderRadius: radius }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Business fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                {resolvedTitle}
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoRow label={tc.alias} value={client.alias} />
                <InfoRow label={tc.vatNumber} value={client.vatNumber} />
                <InfoRow label={tc.taxCode} value={client.taxCode} />
                <InfoRow label={tc.address} value={client.address} />
                <InfoRow label={tc.pec} value={client.pec} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow label={tc.contactPerson} value={client.contactPerson} />
                <InfoRow label={tc.email} value={client.email} />
                <InfoRow label={tc.phone} value={client.phone} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      );
    }

    if (block.instanceId === 'linked-tickets') {
      return (
        <Card variant="outlined" sx={{ borderRadius: radius }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <Box display="flex" alignItems="center" gap={1} px={2} pt={2} pb={1.5}>
              <ConfirmationNumber fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={600}>
                {resolvedTitle} ({tickets.length})
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
      );
    }

    const isEditingThis = editingContentId === block.instanceId;

    return (
      <Card variant="outlined" sx={{ borderRadius: radius }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <StickyNote2 fontSize="small" color="action" />
            <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
              {resolvedTitle}
            </Typography>
            {!editMode && canEditSectionContent && !isEditingThis && (
              <Button
                size="small"
                variant="text"
                startIcon={<Edit sx={{ fontSize: 14 }} />}
                onClick={() => handleStartEditContent(block)}
                sx={{ fontSize: 12, py: 0.25, px: 0.75, minWidth: 0, color: 'text.secondary' }}
              >
                {tc.blockCustomEditContent}
              </Button>
            )}
          </Box>

          {isEditingThis ? (
            <Box>
              <TextField
                multiline
                minRows={3}
                maxRows={12}
                fullWidth
                autoFocus
                size="small"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder={tc.blockCustomContentPlaceholder}
                sx={{ mb: 1 }}
              />
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={savingContent}
                  onClick={() => handleSaveContent(block.instanceId)}
                >
                  {tc.blockCustomSaveContent}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={handleCancelEditContent}
                >
                  {tc.blockCustomCancelContent}
                </Button>
              </Box>
            </Box>
          ) : block.content ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {block.content}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              {tc.blockCustomNotePlaceholder}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

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
              sx={{ fontSize: { xs: '1.4rem', sm: '1.75rem' }, mb: client.alias ? 0 : 0.5 }}
            >
              {client.name}
            </Typography>
            {client.alias && (
              <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic', mb: 0.5 }}>
                {client.alias}
              </Typography>
            )}
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
            {!editMode && (isAdmin || canManageSections) && (
              <>
                {isAdmin && (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    size="small"
                    onClick={openEditDialog}
                  >
                    {tc.editClient}
                  </Button>
                )}
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
                  startIcon={<Add />}
                  onClick={() => setAddSectionOpen(true)}
                >
                  {tc.addSection}
                </Button>
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
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={draftLayout.map((b) => b.instanceId)}
              strategy={verticalListSortingStrategy}
            >
              {draftLayout.map((block) => (
                <SortableBlock
                  key={block.instanceId}
                  instanceId={block.instanceId}
                  editMode
                  visible={block.visible}
                  onToggleVisible={() => handleToggleVisible(block.instanceId)}
                  onRename={() => openRenameDialog(block.instanceId, block.customName || getBlockTitle(block))}
                  onDelete={isCustomBlock(block) ? () => handleDeleteBlock(block.instanceId) : undefined}
                  title={getBlockTitle(block)}
                  visibleLabel={tc.blockVisible}
                  hiddenLabel={tc.blockHidden}
                  renameLabel={tc.blockRename}
                  deleteLabel={tc.blockDelete}
                  isCustom={isCustomBlock(block)}
                >
                  {renderBlockContent(block)}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>

        </>
      ) : (
        activeLayout
          .filter((b) => b.visible)
          .map((block) => (
            <Box key={block.instanceId} mb={3}>
              {renderBlockContent(block)}
            </Box>
          ))
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.renameBlockTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={tc.renameBlockLabel}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameDialogOpen(false)}>{tc.cancelLayout}</Button>
          <Button variant="contained" onClick={handleRenameConfirm}>
            {tc.renameBlockSave}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Section Picker Dialog */}
      <Dialog open={addSectionOpen} onClose={() => setAddSectionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.addSectionTitle}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <List disablePadding>
            {ADDABLE_BLOCK_TYPES.map(({ type, icon }) => (
              <ListItemButton
                key={type}
                onClick={() => handleAddSection(type)}
                sx={{ borderRadius: 1, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
                <ListItemText primary={tc.blockCustomNote} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddSectionOpen(false)}>{tc.cancelLayout}</Button>
        </DialogActions>
      </Dialog>

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
