import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox, FormControlLabel,
  CircularProgress, Tooltip, Dialog, Avatar, Chip, Badge,
  LinearProgress,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import { Delete, Add, NoteAdd, Edit, ArrowForward } from '@mui/icons-material';
import {
  useListClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
  getListClientNotesQueryKey,
  getListAllClientNotesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { hasUnavailableBuiltInClientNoteTag, parseClientNoteTags } from '../lib/clientNoteHashtag';
import { clientNoteMonthKeyFromDate } from '../lib/clientNoteMonth';
import { useClientNoteDeclaratives } from '../hooks/useClientNoteDeclaratives';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  checkedByName?: string | null;
  checkedAt?: string | null;
}

function countNoteOpenItems(note: any): number {
  const cl = note.checklist;
  if (!cl || !Array.isArray(cl) || cl.length === 0) {
    return (note.body && note.body.trim()) ? 1 : 0;
  }
  return cl.filter((item: any) => !item.checked).length;
}

interface ClientNotesBlockProps {
  clientId: number;
  isAdmin: boolean;
  currentUserId?: number;
  canEditClientNotes?: boolean;
  canDeleteClientNotes?: boolean;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nextMonthKey(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-').map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthShort(yyyyMM: string, locale: string): string {
  const [year, month] = yyyyMM.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  const short = d.toLocaleDateString(locale === 'en' ? 'en-US' : 'it-IT', { month: 'short', year: '2-digit' });
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function bodyToChecklist(text: string): ChecklistItem[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({ id: genId(), text: line, checked: false }));
}

const AVATAR_PALETTE = [
  '#1565c0', '#6a1b9a', '#2e7d32', '#c62828',
  '#00838f', '#e65100', '#4527a0', '#ad1457',
];

function authorAvatarColor(name: string | null | undefined): string {
  if (!name) return '#9e9e9e';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function authorInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getClientNoteCategoryOptions(
  note: any,
  declaratives: Array<{ id: string; name: string; alias: string }>,
  canUseBuiltIns: boolean,
) {
  const years = new Set<string>();
  const categories: string[] = Array.isArray(note.categories) ? note.categories : [];
  for (const category of categories) {
    const match = /^(?:770|CU)(\d{2}|\d{4})$/i.exec(category);
    if (match) years.add(match[1].slice(-2));
    const custom = /^declarative:[0-9a-f-]{36}:(\d{2})$/i.exec(category);
    if (custom) years.add(custom[1]);
  }

  if (years.size === 0) {
    const month = note.monthOverride ?? clientNoteMonthKeyFromDate(note.createdAt);
    years.add(month.slice(2, 4));
  }
  const referenceYears = [...years].sort();

  return [
    ...(canUseBuiltIns ? referenceYears.flatMap((year) => [
      { value: `770${year}`, label: `770 ${2000 + Number(year)}` },
      { value: `CU${year}`, label: `CU ${2000 + Number(year)}` },
    ]) : []),
    ...declaratives.filter((item) => !canUseBuiltIns || !/^#(?:CU|770)$/i.test(item.alias))
      .flatMap((item) => referenceYears.map((year) => ({
      value: `declarative:${item.id}:${year}`,
      label: `${item.name} ${2000 + Number(year)} (${item.alias})`,
      }))),
  ];
}

export default function ClientNotesBlock({ clientId, isAdmin, currentUserId, canEditClientNotes, canDeleteClientNotes }: ClientNotesBlockProps) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const canCategorize = user?.profession === 'consulenti-del-lavoro';
  const { declaratives, isLoading: declarativesLoading } = useClientNoteDeclaratives();
  const tc = (t as any).clientNotes;
  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useListClientNotes(clientId, {
    query: { refetchInterval: 120_000, refetchIntervalInBackground: false } as any,
  });

  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  const currentMonthKey = useMemo(() => clientNoteMonthKeyFromDate(new Date()), []);

  const groupedNotes = useMemo(() => {
    const typedNotes = notes as any[];
    const monthGroups = new Map<string, any[]>();
    const categoryGroups = new Map<string, any[]>();

    const addToGroup = (groupMap: Map<string, any[]>, key: string, note: any) => {
      const group = groupMap.get(key) ?? [];
      group.push(note);
      groupMap.set(key, group);
    };

    for (const note of typedNotes) {
      const categories: string[] = Array.isArray(note.categories) ? note.categories : [];
      const monthOverrides: Array<string | null> = note.monthOverrides?.length
        ? note.monthOverrides
        : note.monthOverride ? [note.monthOverride] : categories.length === 0 ? [null] : [];
      for (const monthOverride of monthOverrides) {
        const monthKey = monthOverride ?? clientNoteMonthKeyFromDate(note.createdAt);
        addToGroup(monthGroups, monthKey, note);
      }
      for (const category of categories) {
        addToGroup(categoryGroups, category, note);
      }
    }

    const groups = [
      ...[...monthGroups.entries()]
        .map(([key, grouped]) => ({ key, type: 'month' as const, notes: grouped })),
      ...[...categoryGroups.entries()]
        .map(([category, grouped]) => ({ key: `category:${category}`, type: 'category' as const, notes: grouped })),
    ];

    const timelineOrder = (group: typeof groups[number]): number => {
      if (group.type === 'month') {
        const [year, month] = group.key.split('-').map(Number);
        return year * 1000 + month * 10;
      }

      const category = group.key.slice('category:'.length);
      const fixed = /^(CU|770)(\d{2})$/.exec(category);
      const custom = /^declarative:[0-9a-f-]{36}:(\d{2})$/i.exec(category);
      const yearPart = fixed?.[2] ?? custom?.[1];
      const year = yearPart ? 2000 + Number(yearPart) : new Date().getFullYear();
      const categoryOrder = fixed ? (fixed[1] === 'CU' ? 1 : 2) : 3;
      return year * 1000 + 12 * 10 + categoryOrder;
    };

    return groups.sort((a, b) => timelineOrder(a) - timelineOrder(b));
  }, [notes]);

  const availableGroups = useMemo(
    () => groupedNotes.map(group => ({
      ...group,
      label: group.type === 'month'
        ? formatMonthShort(group.key, lang)
        : (() => {
            const category = group.key.slice('category:'.length);
            const custom = /^declarative:([0-9a-f-]{36})(?::(\d{2}))?$/i.exec(category);
            if (custom) {
              const year = custom[2] ? 2000 + Number(custom[2]) : new Date().getFullYear();
              return `${declaratives.find((item) => item.id === custom[1])?.name ?? 'Dichiarativo'} ${year}`;
            }
            const fixed = /^(CU|770)(\d{2})$/.exec(category);
            return fixed ? `${fixed[1]} ${2000 + Number(fixed[2])}` : category;
          })(),
      count: group.notes.length,
      openCount: group.notes.reduce((sum, note) => sum + countNoteOpenItems(note), 0),
    })),
    [groupedNotes, lang, declaratives],
  );

  const defaultGroupKey = useMemo(() => {
    const monthGroups = availableGroups.filter(group => group.type === 'month');
    return monthGroups[monthGroups.length - 1]?.key
      ?? availableGroups.find(group => group.type === 'category')?.key
      ?? currentMonthKey;
  }, [availableGroups, currentMonthKey]);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(() => currentMonthKey);

  const effectiveGroupKey = availableGroups.some(group => group.key === selectedGroupKey)
    ? selectedGroupKey
    : defaultGroupKey;

  const visibleNotes = useMemo(
    () => groupedNotes.find(group => group.key === effectiveGroupKey)?.notes ?? [],
    [groupedNotes, effectiveGroupKey],
  );

  const [body, setBody] = useState('');
  const activeHashtag = /(?:^|\s)#([\p{L}\p{N}_-]*)$/u.exec(body)?.[1] ?? null;
  const hashtagSuggestions = activeHashtag === null ? [] : [
    ...(canCategorize ? [{ name: '770', alias: '#770' }, { name: 'CU', alias: '#CU' }] : []),
    ...declaratives.filter((item) => !canCategorize || !/^#?(?:CU|770)$/i.test(item.alias)),
  ].filter((item) => `${item.alias} ${item.name}`.toLowerCase().includes(activeHashtag.toLowerCase()));
  const [saving, setSaving] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editMonth, setEditMonth] = useState('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = (note: any): boolean => isAdmin || canEditClientNotes || (currentUserId != null && note.authorId === currentUserId);
  const canDelete = (note: any): boolean => isAdmin || canDeleteClientNotes || (currentUserId != null && note.authorId === currentUserId);

  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  });
  const showToast = (severity: 'success' | 'error', msg: string) =>
    setToast({ open: true, severity, msg });

  const handleBodyChange = (value: string) => {
    setBody(value);
    if (hasUnavailableBuiltInClientNoteTag(value, canCategorize, declaratives)) {
      setHashtagError(tc.categoryProfessionRequired);
      return;
    }
    const result = parseClientNoteTags(value, declaratives, canCategorize);
    if (result && 'badMonth' in result) {
      setHashtagError(tc.invalidMonth(result.badMonth));
    } else {
      setHashtagError(null);
    }
  };

  const handleSave = async () => {
    if (declarativesLoading) return;
    if (!body.trim()) { showToast('error', tc.errorRequired); return; }
    if (hasUnavailableBuiltInClientNoteTag(body, canCategorize, declaratives)) {
      setHashtagError(tc.categoryProfessionRequired);
      showToast('error', tc.categoryProfessionRequired);
      return;
    }
    if (hashtagError) return;

    const result = parseClientNoteTags(body, declaratives, canCategorize);
    let finalBody = body.trim();
    let monthOverride: string | null = null;
    let monthOverrides: string[] = [];
    let categories: string[] = [];

    if (result && 'strippedBody' in result) {
      finalBody = result.strippedBody;
      monthOverride = result.monthOverride;
      monthOverrides = result.monthOverrides;
      if ('categories' in result) categories = result.categories;
    }

    const checklist = bodyToChecklist(finalBody);

    setSaving(true);
    try {
      await createNote.mutateAsync({
        id: clientId,
        data: {
          body: '',
          checklist: checklist.length > 0 ? checklist : null,
          monthOverride,
          monthOverrides,
          categories,
        } as any,
      });
      setBody('');
      setHashtagError(null);
      if (categories.length > 0 && !monthOverride) {
        setSelectedGroupKey(`category:${categories[0]}`);
      }
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      showToast('success', tc.saveNote);
    } catch {
      showToast('error', tc.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNoteChecklistItem = async (
    noteId: number,
    noteChecklist: ChecklistItem[],
    itemId: string,
    clearBody?: boolean,
  ) => {
    const updated = noteChecklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    );
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId,
        data: { checklist: updated, ...(clearBody ? { body: '' } : {}) } as any,
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
    } catch {
      showToast('error', tc.errorSave);
    }
  };

  const noteToEditableText = (note: any): string => {
    const checklist: ChecklistItem[] = note.checklist ?? [];
    if (checklist.length > 0) {
      return checklist.map((item: ChecklistItem) => item.text).join('\n');
    }
    return note.body ?? '';
  };

  const openEditNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditBody(noteToEditableText(note));
    setEditMonth(note.monthOverride ?? (note.categories?.length ? '' : clientNoteMonthKeyFromDate(note.createdAt)));
    const referenceYear = (note.monthOverride ?? clientNoteMonthKeyFromDate(note.createdAt)).slice(2, 4);
    setEditCategories(Array.isArray(note.categories)
      ? note.categories.map((category: string) =>
          /^declarative:([0-9a-f-]{36})$/i.test(category) ? `${category}:${referenceYear}` : category,
        )
      : []);
  };

  const handleEditCancel = () => {
    setEditingNoteId(null);
    setEditBody('');
    setEditMonth('');
    setEditCategories([]);
  };

  const handleEditSave = async (note: any) => {
    if (!editBody.trim()) { showToast('error', tc.errorRequired); return; }
    const categoryOnlyNote = !note.monthOverride && note.categories?.length > 0;
    if (!editMonth && !categoryOnlyNote) { showToast('error', tc.editMonthRequired); return; }
    const contentChanged = editBody.trim() !== noteToEditableText(note).trim();
    const initialMonth = note.monthOverride ?? (note.categories?.length ? '' : clientNoteMonthKeyFromDate(note.createdAt));
    const updateData: Record<string, unknown> = {};
    if (editMonth !== initialMonth) updateData.monthOverride = editMonth || null;
    if (contentChanged) {
      const checklist = bodyToChecklist(editBody);
      updateData.body = '';
      updateData.checklist = checklist.length > 0 ? checklist : null;
    }
    const originalCategories: string[] = Array.isArray(note.categories) ? note.categories : [];
    const normalizeCategories = (categories: string[]) => [...categories].sort();
    if ((canCategorize || declaratives.length > 0)
      && JSON.stringify(normalizeCategories(editCategories)) !== JSON.stringify(normalizeCategories(originalCategories))) {
      updateData.categories = editCategories;
    }
    setEditSaving(true);
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId: note.id,
        data: updateData as any,
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      qc.invalidateQueries({ queryKey: getListAllClientNotesQueryKey() });
      setEditingNoteId(null);
      setEditBody('');
      setEditMonth('');
      setEditCategories([]);
      showToast('success', tc.editNoteSave);
    } catch {
      showToast('error', tc.errorEdit);
    } finally {
      setEditSaving(false);
    }
  };

  const handleMoveToNextMonth = async (note: any) => {
    const currentMonth = note.monthOverride ?? clientNoteMonthKeyFromDate(note.createdAt);
    const nextMonth = nextMonthKey(currentMonth);
    setMovingNoteId(note.id);
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId: note.id,
        data: { monthOverride: nextMonth } as any,
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      qc.invalidateQueries({ queryKey: getListAllClientNotesQueryKey() });
      showToast('success', tc.moveNoteSuccess);
    } catch {
      showToast('error', tc.errorEdit);
    } finally {
      setMovingNoteId(null);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await deleteNote.mutateAsync({ id: clientId, noteId: deleteTarget });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      showToast('success', tc.deleteNote);
    } catch {
      showToast('error', tc.errorDelete);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const localeStr = lang === 'en' ? 'en-US' : 'it-IT';

  return (
    <Box>
      {/* ── Month chip navigation ─────────────────────────────────── */}
      {availableGroups.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            pt: 2,
            pb: 1,
            pl: 2,
            mb: 1,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.2) transparent',
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.2)', borderRadius: 2 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
          }}
        >
          {availableGroups.map((group) => {
            if (group.type === 'month') {
              const isSelected = group.key === effectiveGroupKey;
              const isCurrent = group.key === currentMonthKey;
              return (
                <Badge
                  key={group.key}
                  badgeContent={group.openCount}
                  invisible={group.openCount === 0}
                  color="primary"
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  sx={{
                    flexShrink: 0,
                    '& .MuiBadge-badge': {
                      fontSize: '0.55rem',
                      height: 14,
                      minWidth: 14,
                      padding: '0 3px',
                    },
                  }}
                >
                  <Chip
                    label={group.label}
                    size="small"
                    onClick={() => setSelectedGroupKey(group.key)}
                    data-testid={`client-note-month-${group.key}`}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color={isSelected ? 'primary' : 'default'}
                    sx={{
                      fontWeight: isCurrent ? 700 : 400,
                      borderStyle: isCurrent && !isSelected ? 'dashed' : 'solid',
                      cursor: 'pointer',
                      ml: '6px',
                      '& .MuiChip-label': { px: 0.5, whiteSpace: 'nowrap' },
                    }}
                  />
                </Badge>
              );
            }

            return (
              <Badge
                key={group.key}
                badgeContent={group.count}
                showZero
                color="secondary"
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                sx={{
                  flexShrink: 0,
                  ml: 0.5,
                  '& .MuiBadge-badge': {
                    fontSize: '0.55rem',
                    height: 14,
                    minWidth: 14,
                    padding: '0 3px',
                  },
                }}
              >
                <Button
                  variant={group.key === effectiveGroupKey ? 'contained' : 'outlined'}
                  color="secondary"
                  size="small"
                  onClick={() => setSelectedGroupKey(group.key)}
                  data-testid={`client-note-category-${group.key.slice('category:'.length)}`}
                  sx={{
                    flexShrink: 0,
                    width: 'auto',
                    minWidth: 0,
                    height: 24,
                    minHeight: 24,
                    px: 1.5,
                    py: 0,
                    borderRadius: 2,
                    textTransform: 'none',
                  }}
                >
                  <Typography component="span" variant="caption" fontWeight={700}>
                    {group.label}
                  </Typography>
                </Button>
              </Badge>
            );
          })}
        </Box>
      )}

      {/* ── Note list ────────────────────────────────────────────── */}
      {notes.length === 0 ? (
        <Box py={4} textAlign="center">
          <NoteAdd sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">{tc.noNotes}</Typography>
        </Box>
      ) : visibleNotes.length === 0 ? (
        <Box py={4} textAlign="center">
          <NoteAdd sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {availableGroups.find(group => group.key === effectiveGroupKey)?.type === 'category'
              ? tc.noNotesForCategory
              : tc.noNotesForMonth}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {visibleNotes.map((note: any) => {
            const rawChecklist: ChecklistItem[] = note.checklist ?? [];
            // Legacy notes have body text but no checklist — synthesize items on-the-fly
            const isLegacyNote = rawChecklist.length === 0 && !!note.body;
            const noteChecklist: ChecklistItem[] = isLegacyNote
              ? bodyToChecklist(note.body)
              : rawChecklist;
            const completedCount = noteChecklist.filter((i: ChecklistItem) => i.checked).length;
            const progress = noteChecklist.length > 0 ? (completedCount / noteChecklist.length) * 100 : 0;

            return (
              <Box
                key={note.id}
                data-testid={`client-note-${note.id}`}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                {/* Note header */}
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}
                >
                  <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                    <Avatar
                      sx={{
                        width: 26,
                        height: 26,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: authorAvatarColor(note.authorName),
                        flexShrink: 0,
                      }}
                    >
                      {authorInitials(note.authorName)}
                    </Avatar>
                    <Typography variant="caption" fontWeight={600} noWrap>
                      {note.authorName ?? '—'}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">·</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {new Date(note.createdAt).toLocaleString(localeStr, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </Typography>
                  </Box>
                  {(canEdit(note) || canDelete(note)) && (
                    <Box display="flex" alignItems="center" gap={0.5} flexShrink={0} ml={1}>
                      {canEdit(note) && (
                        <Tooltip title={tc.editNote}>
                          <IconButton
                            size="small"
                            onClick={() => openEditNote(note)}
                            disabled={editingNoteId === note.id}
                            data-testid={`client-note-edit-${note.id}`}
                            sx={{ color: 'primary.main' }}
                          >
                            <Edit sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEdit(note) && (
                        <Tooltip title={tc.moveNoteNextMonth}>
                          <IconButton
                            size="small"
                            aria-label={tc.moveNoteNextMonth}
                            onClick={() => handleMoveToNextMonth(note)}
                            disabled={editingNoteId === note.id || movingNoteId === note.id}
                            sx={{ color: 'primary.main' }}
                          >
                            {movingNoteId === note.id
                              ? <CircularProgress size={14} />
                              : <ArrowForward sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete(note) && (
                        <Tooltip title={tc.deleteNote}>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteTarget(note.id)}
                            sx={{ color: 'error.main' }}
                          >
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Note body */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  {editingNoteId === note.id ? (
                    <Box>
                      <TextField
                        fullWidth
                        type="month"
                        label={tc.editNoteMonth}
                        value={editMonth}
                        onChange={(e) => setEditMonth(e.target.value)}
                        inputProps={{ 'data-testid': `client-note-edit-month-${note.id}` }}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 1 }}
                      />
                      {(canCategorize || declaratives.length > 0) && (
                        <Box sx={{ mb: 1 }} data-testid={`client-note-edit-categories-${note.id}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {tc.editNoteCategories}
                          </Typography>
                          <Box display="flex" alignItems="center" flexWrap="wrap" columnGap={1}>
                            {getClientNoteCategoryOptions(note, declaratives, canCategorize).map((category) => (
                              <FormControlLabel
                                key={category.value}
                                data-testid={`client-note-edit-category-${category.value.toLowerCase()}-${note.id}`}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={editCategories.includes(category.value)}
                                    onChange={(event) => {
                                      setEditCategories((current) =>
                                        event.target.checked
                                          ? [...current, category.value]
                                          : current.filter((value) => value !== category.value),
                                      );
                                    }}
                                  />
                                }
                                label={category.label}
                                sx={{ ml: 0, mr: 1 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        size="small"
                        sx={{ mb: 1 }}
                        autoFocus
                      />
                      <Box display="flex" justifyContent="flex-end" gap={1}>
                        <Button size="small" onClick={handleEditCancel} disabled={editSaving}>
                          {tc.editNoteCancel}
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleEditSave(note)}
                          data-testid={`client-note-save-${note.id}`}
                          disabled={editSaving || !editBody.trim() || (!editMonth && !note.categories?.length)}
                        >
                          {editSaving ? tc.editNoteSaving : tc.editNoteSave}
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <>
                      {note.body && !isLegacyNote ? (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: noteChecklist.length ? 1.5 : 0 }}>
                          {note.body}
                        </Typography>
                      ) : null}

                      {noteChecklist.length > 0 && (
                        <Box>
                          {/* Progress bar */}
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                              sx={{ flex: 1, height: 6, borderRadius: 3 }}
                              color={progress === 100 ? 'success' : 'primary'}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {t.checklist.progress(completedCount, noteChecklist.length)}
                            </Typography>
                          </Box>

                          {/* Checklist items */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            {noteChecklist.map((item: ChecklistItem) => (
                              <Box key={item.id} display="flex" alignItems="center" gap={0.5}>
                                {item.checked && item.checkedByName ? (
                                  <Tooltip
                                    title={t.checklist.checkedBy(
                                      item.checkedByName,
                                      item.checkedAt
                                        ? new Date(item.checkedAt).toLocaleString(localeStr, { dateStyle: 'short', timeStyle: 'short' })
                                        : '',
                                    )}
                                    arrow
                                  >
                                    <Checkbox
                                      size="small"
                                      checked={item.checked}
                                      onChange={() => handleToggleNoteChecklistItem(note.id, noteChecklist, item.id, isLegacyNote)}
                                      sx={{ p: 0.25 }}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Checkbox
                                    size="small"
                                    checked={item.checked}
                                    onChange={() => handleToggleNoteChecklistItem(note.id, noteChecklist, item.id, isLegacyNote)}
                                    sx={{ p: 0.25 }}
                                  />
                                )}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    textDecoration: item.checked ? 'line-through' : 'none',
                                    color: item.checked ? 'text.disabled' : 'text.primary',
                                    flex: 1,
                                  }}
                                >
                                  {item.text}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Add-note form ────────────────────────────────────────── */}
      <Box
        sx={{
          mt: 1,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder={tc.addNotePlaceholder}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            helperText={canCategorize ? tc.categoryAndMonthHashtagHint : tc.monthHashtagHint}
            size="small"
            sx={{ mb: 1 }}
          />
          {hashtagSuggestions.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }} data-testid="client-note-hashtag-suggestions">
              {hashtagSuggestions.map((item) => (
                <Button
                  key={item.alias}
                  size="small"
                  variant="outlined"
                  onClick={() => handleBodyChange(body.replace(/(?:^|\s)#[\p{L}\p{N}_-]*$/u, (match) => `${match.startsWith(' ') ? ' ' : ''}${item.alias} `))}
                >
                  {item.name} {item.alias}
                </Button>
              ))}
            </Box>
          )}
          {hashtagError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
              {hashtagError}
            </Typography>
          )}
          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={saving || declarativesLoading || !body.trim() || !!hashtagError}
            >
              {saving ? tc.savingNote : tc.saveNote}
            </Button>
          </Box>
      </Box>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <Dialog open={deleteTarget != null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{tc.deleteNote}</DialogTitle>
        <DialogContent>
          <Typography>{tc.deleteNoteConfirm}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{tc.deleteNoteCancel}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {tc.deleteNoteAction}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((p) => ({ ...p, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
