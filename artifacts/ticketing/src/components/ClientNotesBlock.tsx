import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  CircularProgress, Tooltip, Dialog, Avatar, Chip,
  LinearProgress, Collapse,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import { Delete, Add, NoteAdd } from '@mui/icons-material';
import {
  useListClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
  getListClientNotesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { parseHashtag } from '../lib/clientNoteHashtag';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  checkedByName?: string | null;
  checkedAt?: string | null;
}

interface ClientNotesBlockProps {
  clientId: number;
  isAdmin: boolean;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function monthKeyFromDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

export default function ClientNotesBlock({ clientId, isAdmin }: ClientNotesBlockProps) {
  const { t, lang } = useLanguage();
  const tc = (t as any).clientNotes;
  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useListClientNotes(clientId);

  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  const currentMonthKey = useMemo(() => monthKeyFromDate(new Date().toISOString()), []);

  const groupedNotes = useMemo(() => {
    const typedNotes = notes as any[];
    const groups: { key: string; notes: any[] }[] = [];
    const keyMap = new Map<string, any[]>();
    for (const note of typedNotes) {
      const key = note.monthOverride ?? monthKeyFromDate(note.createdAt);
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
        groups.push({ key, notes: keyMap.get(key)! });
      }
      keyMap.get(key)!.push(note);
    }
    groups.sort((a, b) => b.key.localeCompare(a.key));
    return groups;
  }, [notes]);

  const availableMonths = useMemo(
    () => groupedNotes.map(g => ({
      key: g.key,
      label: formatMonthShort(g.key, lang),
      count: g.notes.length,
    })),
    [groupedNotes, lang],
  );

  const defaultMonth = useMemo(
    () => availableMonths[0]?.key ?? currentMonthKey,
    [availableMonths, currentMonthKey],
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(() => defaultMonth);

  const effectiveMonth = availableMonths.some(m => m.key === selectedMonth)
    ? selectedMonth
    : (availableMonths[0]?.key ?? '');

  const visibleNotes = useMemo(
    () => groupedNotes.find(g => g.key === effectiveMonth)?.notes ?? [],
    [groupedNotes, effectiveMonth],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  });
  const showToast = (severity: 'success' | 'error', msg: string) =>
    setToast({ open: true, severity, msg });

  const handleBodyChange = (value: string) => {
    setBody(value);
    const result = parseHashtag(value);
    if (result && 'badMonth' in result) {
      setHashtagError(tc.invalidMonth(result.badMonth));
    } else {
      setHashtagError(null);
    }
  };

  const handleSave = async () => {
    if (!body.trim()) { showToast('error', tc.errorRequired); return; }
    if (hashtagError) return;

    const result = parseHashtag(body);
    let finalBody = body.trim();
    let monthOverride: string | null = null;

    if (result && 'monthOverride' in result) {
      finalBody = result.strippedBody;
      monthOverride = result.monthOverride;
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
        } as any,
      });
      setBody('');
      setHashtagError(null);
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      showToast('success', tc.saveNote);
    } catch {
      showToast('error', tc.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setBody('');
    setHashtagError(null);
    setFormOpen(false);
  };

  const handleToggleNoteChecklistItem = async (
    noteId: number,
    noteBody: string,
    noteChecklist: ChecklistItem[],
    itemId: string,
  ) => {
    const updated = noteChecklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    );
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId,
        data: { checklist: updated } as any,
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
    } catch {
      showToast('error', tc.errorSave);
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
      {availableMonths.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            pb: 0.5,
            mb: 2,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {availableMonths.map((m) => {
            const isSelected = m.key === effectiveMonth;
            const isCurrent = m.key === currentMonthKey;
            return (
              <Chip
                key={m.key}
                label={`${m.label} · ${m.count}`}
                size="small"
                onClick={() => setSelectedMonth(m.key)}
                variant={isSelected ? 'filled' : 'outlined'}
                color={isSelected ? 'primary' : 'default'}
                sx={{
                  flexShrink: 0,
                  fontWeight: isCurrent ? 700 : 400,
                  borderStyle: isCurrent && !isSelected ? 'dashed' : 'solid',
                  cursor: 'pointer',
                }}
              />
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
          <Typography variant="body2" color="text.secondary">{tc.noNotesForMonth}</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {visibleNotes.map((note: any) => {
            const noteChecklist: ChecklistItem[] = note.checklist ?? [];
            const completedCount = noteChecklist.filter((i: ChecklistItem) => i.checked).length;
            const progress = noteChecklist.length > 0 ? (completedCount / noteChecklist.length) * 100 : 0;

            return (
              <Box
                key={note.id}
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
                  {isAdmin && (
                    <Tooltip title={tc.deleteNote}>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteTarget(note.id)}
                        sx={{ color: 'error.main', flexShrink: 0, ml: 1 }}
                      >
                        <Delete sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Note body */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  {note.body ? (
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
                                  onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                                  disabled={!isAdmin}
                                  sx={{ p: 0.25 }}
                                />
                              </Tooltip>
                            ) : (
                              <Checkbox
                                size="small"
                                checked={item.checked}
                                onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                                disabled={!isAdmin}
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
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Collapsible add-note form (admin only) ────────────────── */}
      {isAdmin && (
        <Box>
          <Collapse in={formOpen} unmountOnExit>
            <Box
              sx={{
                mb: 1.5,
                p: 2,
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
                bgcolor: 'background.paper',
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={3}
                placeholder={tc.addNotePlaceholder}
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                size="small"
                sx={{ mb: 1 }}
                autoFocus
              />
              {hashtagError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
                  {hashtagError}
                </Typography>
              )}
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button size="small" onClick={handleCancel}>
                  {tc.deleteNoteCancel}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSave}
                  disabled={saving || !body.trim() || !!hashtagError}
                >
                  {saving ? tc.savingNote : tc.saveNote}
                </Button>
              </Box>
            </Box>
          </Collapse>

          {!formOpen && (
            <Button
              startIcon={<Add />}
              size="small"
              variant="outlined"
              onClick={() => setFormOpen(true)}
              sx={{ borderStyle: 'dashed' }}
            >
              {tc.addNoteBtn}
            </Button>
          )}
        </Box>
      )}

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      {isAdmin && (
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
      )}

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
