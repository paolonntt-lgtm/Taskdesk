import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Paper, CircularProgress,
  Avatar, IconButton, Tooltip, Switch, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  ArrowBack, ConfirmationNumber, Edit, Visibility, VisibilityOff,
  Email, Phone, Business, Save, Cancel, DriveFileRenameOutline, Close, Add,
  StickyNote2, Public,
} from '@mui/icons-material';
import ClientSectionEditor, { sanitizeSectionHtml } from '../components/ClientSectionEditor';
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
  useGetClient, useUpdateClient, getGetClientQueryKey, getListClientsQueryKey,
} from '@workspace/api-client-react';
import type { ClientInput } from '@workspace/api-client-react';
import ClientNotesBlock from '../components/ClientNotesBlock';
import ClientUnbilledWorkSection from '../components/ClientUnbilledWorkSection';
import FixedNotesBlock from '../components/FixedNotesBlock';
import WorkedHoursReport from '../components/WorkedHoursReport';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import PermissionGateButton from '../components/PermissionGateButton';
import { invalidateTicketDataAfterClientRename } from '../lib/clientNameCache';

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

type ClientTicketSortColumn = 'number' | 'title' | 'status' | 'priority' | 'assignee';
type SortDirection = 'asc' | 'desc';

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

const BUILT_IN_BLOCK_IDS = ['company-info', 'fixed-notes', 'fixed-notes-2', 'client-notes', 'linked-tickets'] as const;
type BuiltinBlockId = typeof BUILT_IN_BLOCK_IDS[number];

const BUILTIN_FIXED_ORDER: BuiltinBlockId[] = ['company-info', 'fixed-notes', 'fixed-notes-2', 'client-notes', 'linked-tickets'];

interface BlockConfig {
  id: string;
  instanceId: string;
  type?: string;
  visible: boolean;
  customName?: string;
  content?: string;
}

function defaultLayout(): BlockConfig[] {
  return BUILTIN_FIXED_ORDER.map((id) => ({ id, instanceId: id, visible: true }));
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
  children: React.ReactNode;
}

function SortableBlock({
  instanceId, editMode, visible, onToggleVisible, onRename, onDelete,
  title, visibleLabel, hiddenLabel, renameLabel, deleteLabel, children,
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
            bgcolor: 'warning.50',
            border: '2px dashed',
            borderColor: 'warning.300',
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
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
            {onDelete && (
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
            borderColor: 'warning.300',
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

interface BuiltinEditBarProps {
  block: BlockConfig;
  title: string;
  onRename: () => void;
  onToggleVisible: () => void;
  visibleLabel: string;
  hiddenLabel: string;
  renameLabel: string;
  children: React.ReactNode;
}

function BuiltinEditBar({
  block, title, onRename, onToggleVisible, visibleLabel, hiddenLabel, renameLabel, children,
}: BuiltinEditBarProps) {
  return (
    <Box mb={3}>
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
          <Typography variant="subtitle2" fontWeight={600}>
            {title}
          </Typography>
          <Tooltip title={renameLabel}>
            <IconButton size="small" onClick={onRename} sx={{ ml: 0.5 }}>
              <DriveFileRenameOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Tooltip title={block.visible ? visibleLabel : hiddenLabel}>
          <Switch
            size="small"
            checked={block.visible}
            onChange={onToggleVisible}
          />
        </Tooltip>
      </Box>
      <Box
        sx={{
          opacity: block.visible ? 1 : 0.4,
          transition: 'opacity 0.2s',
          border: '2px dashed',
          borderColor: 'primary.200',
          borderTop: 0,
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
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
  const { t, lang } = useLanguage();
  const tc = t.clients;
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? '', 10);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userGroupPerms: string[] = ((user as any)?.groupPermissions as string[] | undefined) ?? [];
  const canViewWorkedHours = isAdmin || userGroupPerms.includes('view_worked_hours');
  const canManageSections = isAdmin || userGroupPerms.includes('manage_client_sections');
  const canEditSectionContent = isAdmin || userGroupPerms.includes('edit_client_section_content');
  const qc = useQueryClient();

  const clientQuery = useGetClient(clientId);
  const { data, isLoading, isError } = clientQuery;
  const updateClient = useUpdateClient();
  const [layout, setLayout] = useState<BlockConfig[]>(() => loadClientLayoutCache(clientId));
  const [editMode, setEditMode] = useState(false);
  const [draftLayout, setDraftLayout] = useState<BlockConfig[]>([]);
  const [ticketSort, setTicketSort] = useState<{ column: ClientTicketSortColumn | null; direction: SortDirection }>({
    column: null,
    direction: 'asc',
  });

  const [orgLayout, setOrgLayout] = useState<BlockConfig[]>([]);
  const [orgBuiltinNames, setOrgBuiltinNames] = useState<Record<string, string>>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState<ClientInput & Record<string, any>>({
    name: '', email: null, phone: null, vatNumber: null,
    taxCode: null, address: null, pec: null, contactPerson: null, notes: null,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renamingIsBuiltin, setRenamingIsBuiltin] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

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

    const rawLayout = (data as any).layout;
    const perClientBlocks: any[] = Array.isArray(rawLayout)
      ? rawLayout
      : (rawLayout?.blocks ?? []);
    const savedOrder: string[] | null =
      !Array.isArray(rawLayout) && Array.isArray(rawLayout?.order) && rawLayout.order.length > 0
        ? rawLayout.order
        : null;

    const perClientMigrated: BlockConfig[] = perClientBlocks.map(migrateBlock);
    const hasPerClientBuiltins = perClientMigrated.some(
      (b) => BUILT_IN_BLOCK_IDS.includes(b.instanceId as BuiltinBlockId),
    );

    const perClientCustom = perClientMigrated.filter((b) => isCustomBlock(b));

    fetch('/api/settings/client-layout', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        let orgBuiltins: BlockConfig[];
        if (d?.layout && Array.isArray(d.layout)) {
          const migrated = (d.layout as any[]).map(migrateBlock)
            .filter((b: BlockConfig) => BUILT_IN_BLOCK_IDS.includes(b.instanceId as BuiltinBlockId));
          const storedIds = new Set<string>(migrated.map((b: BlockConfig) => b.instanceId));
          const missing = BUILT_IN_BLOCK_IDS
            .filter((id) => !storedIds.has(id))
            .map((id) => ({ id, instanceId: id, visible: true }));
          orgBuiltins = [...migrated, ...missing];
        } else {
          orgBuiltins = BUILTIN_FIXED_ORDER.map((id) => ({ id, instanceId: id, visible: true }));
        }

        const newOrgLayout = orgBuiltins;
        setOrgLayout(newOrgLayout);
        const names: Record<string, string> = {};
        for (const b of newOrgLayout) {
          if (b.customName) names[b.instanceId] = b.customName;
        }
        setOrgBuiltinNames(names);

        if (hasPerClientBuiltins) {
          const presentIds = new Set(perClientMigrated.map((b) => b.instanceId));
          const missingBuiltins = BUILT_IN_BLOCK_IDS
            .filter((id) => !presentIds.has(id))
            .map((id) => ({ id, instanceId: id, visible: true }));
          const combined = [...perClientMigrated, ...missingBuiltins];
          let ordered: BlockConfig[];
          if (savedOrder && savedOrder.length > 0) {
            const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
            ordered = [...combined].sort((a, b) => {
              const ia = orderMap.has(a.instanceId) ? orderMap.get(a.instanceId)! : Infinity;
              const ib = orderMap.has(b.instanceId) ? orderMap.get(b.instanceId)! : Infinity;
              return ia - ib;
            });
          } else {
            ordered = combined;
          }
          setLayout(ordered);
          saveClientLayoutCache(clientId, ordered);
        } else {
          const builtinVisibility = new Map<string, boolean>();
          for (const b of orgBuiltins) builtinVisibility.set(b.instanceId, b.visible);

          const builtinsWithVisibility = BUILTIN_FIXED_ORDER.map((id) => ({
            id,
            instanceId: id,
            visible: builtinVisibility.has(id) ? builtinVisibility.get(id)! : true,
          }));
          const combined = [...builtinsWithVisibility, ...perClientCustom];
          setLayout(combined);
          saveClientLayoutCache(clientId, combined);
        }
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
    setLayout(draftLayout);
    saveClientLayoutCache(clientId, draftLayout);
    setEditMode(false);
    setDraftLayout([]);

    try {
      const layoutForSave = draftLayout.map(b => ({
        ...b,
        customName: isCustomBlock(b) ? b.customName : undefined,
      }));
      await fetch(`/api/clients/${clientId}/layout`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: layoutForSave,
          order: draftLayout.map(b => b.instanceId),
        }),
      });
    } catch {}
  }, [draftLayout, clientId]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraftLayout((prev) => {
        const builtins = prev.filter(b => !isCustomBlock(b));
        const customs = prev.filter(b => isCustomBlock(b));
        const oldIndex = customs.findIndex((b) => b.instanceId === active.id);
        const newIndex = customs.findIndex((b) => b.instanceId === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const newCustoms = arrayMove(customs, oldIndex, newIndex);
        return [...builtins, ...newCustoms];
      });
    }
  }, []);

  const handleToggleVisible = useCallback((instanceId: string) => {
    setDraftLayout((prev) =>
      prev.map((b) => b.instanceId === instanceId ? { ...b, visible: !b.visible } : b)
    );
  }, []);

  const openRenameDialog = useCallback((instanceId: string, currentName: string) => {
    const builtin = BUILT_IN_BLOCK_IDS.includes(instanceId as BuiltinBlockId);
    setRenamingInstanceId(instanceId);
    setRenamingIsBuiltin(builtin);
    setRenameValue(currentName);
    setRenameError('');
    setRenameDialogOpen(true);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingInstanceId) return;
    const trimmed = renameValue.trim();

    if (renamingIsBuiltin) {
      setRenameSaving(true);
      setRenameError('');
      try {
        const updatedOrgLayout = orgLayout.map(b =>
          b.instanceId === renamingInstanceId
            ? { ...b, customName: trimmed || undefined }
            : b
        );
        const layoutToSend = updatedOrgLayout.map(b => ({
          id: b.id,
          instanceId: b.instanceId,
          visible: b.visible,
          ...(b.type ? { type: b.type } : {}),
          ...(b.customName ? { customName: b.customName } : {}),
        }));
        const res = await fetch('/api/settings/client-layout', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: layoutToSend }),
        });
        if (!res.ok) {
          setRenameError(tc.errorSaving);
          setRenameSaving(false);
          return;
        }
        setOrgLayout(updatedOrgLayout);
        const newNames = { ...orgBuiltinNames };
        if (trimmed) {
          newNames[renamingInstanceId] = trimmed;
        } else {
          delete newNames[renamingInstanceId];
        }
        setOrgBuiltinNames(newNames);
      } catch {
        setRenameError(tc.errorSaving);
        setRenameSaving(false);
        return;
      }
      setRenameSaving(false);
    } else {
      setDraftLayout((prev) =>
        prev.map((b) =>
          b.instanceId === renamingInstanceId
            ? { ...b, customName: trimmed || undefined }
            : b
        )
      );
    }

    setRenameDialogOpen(false);
    setRenamingInstanceId(null);
    setRenamingIsBuiltin(false);
    setRenameValue('');
  }, [renamingInstanceId, renamingIsBuiltin, renameValue, orgLayout, orgBuiltinNames]);

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
      qc.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
      if (data?.name !== payload.name) {
        await invalidateTicketDataAfterClientRename(qc);
      }
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

  if (!data) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => setLocation('/clients')} sx={{ mb: 2 }}>
          {tc.backToClients}
        </Button>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => clientQuery.refetch()}>
              {lang === 'it' ? 'Riprova' : 'Try again'}
            </Button>
          }
        >
          {lang === 'it' ? 'Impossibile caricare i dati del cliente.' : 'Could not load customer details.'}
        </Alert>
      </Box>
    );
  }

  const client = data as any;
  const tickets: any[] = client.tickets ?? [];
  const sortedTickets = ticketSort.column
    ? [...tickets].sort((a, b) => {
        const { column, direction } = ticketSort;
        const directionFactor = direction === 'asc' ? 1 : -1;
        if (column === 'number') {
          return ((a.ticketNumber ?? a.id) - (b.ticketNumber ?? b.id)) * directionFactor;
        }

        const getValue = (ticket: any): string => {
          if (column === 'title') return ticket.title ?? '';
          if (column === 'status') return (t.status as any)[ticket.status] ?? ticket.status;
          if (column === 'priority') return (t.priority as any)[ticket.priority] ?? ticket.priority;
          return ticket.assignedToName ?? t.ticketDetail.unassigned;
        };
        return getValue(a).localeCompare(getValue(b), undefined, { numeric: true, sensitivity: 'base' }) * directionFactor;
      })
    : tickets;
  const handleTicketSort = (column: ClientTicketSortColumn) => {
    setTicketSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const ticketSortHeader = (column: ClientTicketSortColumn, label: string) => (
    <TableCell
      sortDirection={ticketSort.column === column ? ticketSort.direction : false}
      sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      <TableSortLabel
        active={ticketSort.column === column}
        direction={ticketSort.column === column ? ticketSort.direction : 'asc'}
        onClick={() => handleTicketSort(column)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
  const initials = getInitials(client.name ?? '?');

  const openTickets = tickets.filter((t: any) => ['open', 'waiting', 'in_progress'].includes(t.status)).length;
  const resolvedTickets = tickets.filter((t: any) => ['resolved', 'closed'].includes(t.status)).length;
  const lastTicketDate = tickets.length > 0
    ? new Date(Math.max(...tickets.map((t: any) => new Date((t.updatedAt ?? t.createdAt) as string).getTime())))
    : null;
  const heroKpis = [
    { value: tickets.length, label: tc.kpiTotalTickets },
    { value: openTickets, label: tc.kpiOpenTickets },
    { value: resolvedTickets, label: tc.kpiResolvedTickets },
    { value: lastTicketDate ? lastTicketDate.toLocaleDateString() : tc.kpiNever, label: tc.kpiLastActivity },
  ];

  const builtinDefaultTitles: Record<BuiltinBlockId, string> = {
    'company-info': tc.blockCompanyInfo,
    'linked-tickets': tc.blockLinkedTickets,
    'client-notes': tc.blockNotes,
    'fixed-notes': tc.blockFixedNotes,
    'fixed-notes-2': tc.blockFixedNotes2,
  };

  function getBlockTitle(block: BlockConfig): string {
    if (BUILT_IN_BLOCK_IDS.includes(block.instanceId as BuiltinBlockId)) {
      const orgName = orgBuiltinNames[block.instanceId];
      if (orgName) return orgName;
      return builtinDefaultTitles[block.instanceId as BuiltinBlockId];
    }
    if (block.customName) return block.customName;
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
              fieldName="notes"
            />
          </CardContent>
        </Card>
      );
    }

    if (block.instanceId === 'fixed-notes-2') {
      return (
        <Card variant="outlined" sx={{ borderRadius: radius }}>
          <CardContent>
            <FixedNotesBlock
              clientId={clientId}
              initialNotes={(client as any).notes2 ?? null}
              isAdmin={isAdmin}
              canEditFixed={userGroupPerms.includes('edit_fixed_notes')}
              title={resolvedTitle}
              fieldName="notes2"
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
              <PermissionGateButton
                permission="edit_client_notes"
                sectionLabel={`${resolvedTitle} — ${t.groups.permEditClientNotes}`}
              />
              <PermissionGateButton
                permission="delete_client_notes"
                sectionLabel={`${resolvedTitle} — ${t.groups.permDeleteClientNotes}`}
              />
            </Box>
            <ClientNotesBlock
              clientId={clientId}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              canEditClientNotes={userGroupPerms.includes('edit_client_notes')}
              canDeleteClientNotes={userGroupPerms.includes('delete_client_notes')}
            />
            <ClientUnbilledWorkSection clientId={clientId} tickets={client.tickets ?? []} isAdmin={isAdmin} />
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
                      {ticketSortHeader('number', '#')}
                      {ticketSortHeader('title', t.ticketList.colTitle)}
                      {ticketSortHeader('status', t.ticketList.colStatus)}
                      {ticketSortHeader('priority', t.ticketList.colPriority)}
                      {ticketSortHeader('assignee', t.ticketList.colAssignee)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedTickets.map((ticket) => (
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
            <PermissionGateButton
              permission="edit_client_section_content"
              sectionLabel={resolvedTitle}
            />
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
              <ClientSectionEditor
                value={contentDraft}
                onChange={setContentDraft}
                placeholder={tc.blockCustomContentPlaceholder}
              />
              <Box display="flex" gap={1} mt={1}>
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
            block.content.trimStart().startsWith('<') ? (
              <Box
                sx={{
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: 'text.primary',
                  '& p': { mt: 0, mb: 0.5 },
                  '& ul, & ol': { pl: 2.5, mt: 0, mb: 0.5 },
                  '& strong': { fontWeight: 700 },
                  '& em': { fontStyle: 'italic' },
                  '& s': { textDecoration: 'line-through' },
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeSectionHtml(block.content) }}
              />
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {block.content}
              </Typography>
            )
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              {tc.blockCustomNotePlaceholder}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  const customBlocks = layout.filter(b => isCustomBlock(b));
  const customDraftBlocks = draftLayout.filter(b => isCustomBlock(b));

  return (
    <Box>
      {isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => clientQuery.refetch()}>
              {lang === 'it' ? 'Riprova' : 'Try again'}
            </Button>
          }
        >
          {lang === 'it'
            ? 'Impossibile aggiornare i dati del cliente. Sono mostrati gli ultimi dati disponibili.'
            : 'Could not refresh customer details. Showing the last available data.'}
        </Alert>
      )}
      {/* HeroKPI Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0043ce 0%, #0f62fe 55%, #1e3a5f 100%)',
          borderRadius: 3,
          mb: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Geometric decorations */}
        <Box sx={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', top: 30, right: 100, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Breadcrumb + actions row */}
        <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
          <Button
            startIcon={<ArrowBack />}
            size="small"
            onClick={() => setLocation('/clients')}
            sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, fontSize: 13, minWidth: 0 }}
          >
            {tc.backToClients}
          </Button>
          <Box component="span" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>›</Box>
          <Typography component="span" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{client.name}</Typography>

          <Box display="flex" flexShrink={0} gap={1} flexWrap="wrap" ml="auto">
            {!editMode && (isAdmin || canManageSections) && (
              <>
                {isAdmin && (
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    size="small"
                    onClick={openEditDialog}
                    sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                  >
                    {tc.editClient}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleEnterEditMode}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  {tc.editLayout}
                </Button>
                <PermissionGateButton
                  permission="manage_client_sections"
                  sectionLabel={tc.editLayout}
                />
              </>
            )}
            {editMode && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setAddSectionOpen(true)}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  {tc.addSection}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Cancel />}
                  onClick={handleCancelEdit}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  {tc.cancelLayout}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Save />}
                  onClick={handleSaveLayout}
                  sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' }, boxShadow: 'none' }}
                >
                  {tc.saveLayout}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Avatar + name block */}
        <Box display="flex" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={3} sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 3, flexWrap: 'wrap' }}>
          <Avatar
            sx={{
              width: { xs: 64, sm: 80 },
              height: { xs: 64, sm: 80 },
              bgcolor: 'rgba(255,255,255,0.15)',
              border: '3px solid rgba(255,255,255,0.4)',
              fontSize: { xs: '1.5rem', sm: '1.9rem' },
              fontWeight: 800,
              flexShrink: 0,
              color: '#fff',
            }}
          >
            {initials}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ color: '#fff', fontSize: { xs: '1.4rem', sm: '1.75rem' }, letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              {client.name}
            </Typography>
            {client.alias && (
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize: 14, mt: 0.25 }}>
                {client.alias}
              </Typography>
            )}
            <Box display="flex" flexWrap="wrap" gap={1.5} mt={1}>
              {client.email && (
                <Box display="flex" alignItems="center" gap={0.5} sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  <Email sx={{ fontSize: 14 }} />{client.email}
                </Box>
              )}
              {client.phone && (
                <Box display="flex" alignItems="center" gap={0.5} sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  <Phone sx={{ fontSize: 14 }} />{client.phone}
                </Box>
              )}
              {client.vatNumber && (
                <Box display="flex" alignItems="center" gap={0.5} sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  <Business sx={{ fontSize: 14 }} />{client.vatNumber}
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* KPI strip */}
        <Box display="flex" sx={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {heroKpis.map((kpi, i) => (
            <Box
              key={i}
              flex={1}
              sx={{
                px: { xs: 1.5, sm: 3 },
                py: 2,
                borderRight: i < heroKpis.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              }}
            >
              <Typography sx={{ fontSize: { xs: 20, sm: 26 }, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {kpi.value}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', mt: 0.5 }}>
                {kpi.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {editMode && (
          <Alert
            severity="info"
            sx={{
              mx: { xs: 2, sm: 3 },
              mb: 2,
              mt: 1,
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              '& .MuiAlert-icon': { color: '#7ecfd6' },
              '& .MuiAlert-message': { color: '#fff' },
            }}
          >
            {tc.editLayoutHint}
          </Alert>
        )}
      </Box>

      {/* Block layout */}
      {editMode ? (
        <>
          {/* Built-in blocks — fixed order, no drag */}
          {BUILTIN_FIXED_ORDER.map((builtinId) => {
            const block = draftLayout.find(b => b.instanceId === builtinId)
              ?? { id: builtinId, instanceId: builtinId, visible: true };
            return (
              <BuiltinEditBar
                key={builtinId}
                block={block}
                title={getBlockTitle(block)}
                onRename={() => openRenameDialog(builtinId, getBlockTitle(block))}
                onToggleVisible={() => handleToggleVisible(builtinId)}
                visibleLabel={tc.blockVisible}
                hiddenLabel={tc.blockHidden}
                renameLabel={tc.blockRename}
              >
                {renderBlockContent(block)}
              </BuiltinEditBar>
            );
          })}

          {/* Custom blocks — draggable */}
          {customDraftBlocks.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={customDraftBlocks.map((b) => b.instanceId)}
                strategy={verticalListSortingStrategy}
              >
                {customDraftBlocks.map((block) => (
                  <SortableBlock
                    key={block.instanceId}
                    instanceId={block.instanceId}
                    editMode
                    visible={block.visible}
                    onToggleVisible={() => handleToggleVisible(block.instanceId)}
                    onRename={() => openRenameDialog(block.instanceId, block.customName || getBlockTitle(block))}
                    onDelete={() => handleDeleteBlock(block.instanceId)}
                    title={getBlockTitle(block)}
                    visibleLabel={tc.blockVisible}
                    hiddenLabel={tc.blockHidden}
                    renameLabel={tc.blockRename}
                    deleteLabel={tc.blockDelete}
                  >
                    {renderBlockContent(block)}
                  </SortableBlock>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </>
      ) : (
        <>
          {/* Built-in blocks — always in fixed order */}
          {BUILTIN_FIXED_ORDER.map((builtinId) => {
            const block = layout.find(b => b.instanceId === builtinId)
              ?? { id: builtinId, instanceId: builtinId, visible: true };
            if (!block.visible) return null;
            return (
              <Box key={builtinId} mb={3}>
                {renderBlockContent(block)}
              </Box>
            );
          })}

          {/* Custom blocks */}
          {customBlocks.filter(b => b.visible).map((block) => (
            <Box key={block.instanceId} mb={3}>
              {renderBlockContent(block)}
            </Box>
          ))}
        </>
      )}

      <Box mb={3}>
        {canViewWorkedHours && (
          <WorkedHoursReport clientId={clientId} tickets={tickets} isAdmin={isAdmin} />
        )}
      </Box>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.renameBlockTitle}</DialogTitle>
        <DialogContent>
          {renamingIsBuiltin && (
            <Alert
              severity="warning"
              icon={<Public fontSize="small" />}
              sx={{ mb: 2, mt: 1 }}
            >
              {tc.renameBuiltinWarning}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            label={tc.renameBlockLabel}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); }}
            sx={{ mt: renamingIsBuiltin ? 0 : 1 }}
          />
          {renameError && (
            <Alert severity="error" sx={{ mt: 2 }}>{renameError}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameDialogOpen(false)} disabled={renameSaving}>
            {tc.cancelLayout}
          </Button>
          <Button variant="contained" onClick={handleRenameConfirm} disabled={renameSaving}>
            {renameSaving ? '...' : tc.renameBlockSave}
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
