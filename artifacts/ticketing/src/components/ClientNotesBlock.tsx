import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  Divider, CircularProgress, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
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

function formatMonthHeading(yyyyMM: string, locale: string): string {
  const [year, month] = yyyyMM.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'it-IT', { month: 'long', year: 'numeric' });
}

function bodyToChecklist(text: string): ChecklistItem[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({ id: genId(), text: line, checked: false }));
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
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

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
    noteBody: string,
    noteChecklist: ChecklistItem[],
    itemId: string
  ) => {
    const updated = noteChecklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
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
    () => groupedNotes.map(g => ({ key: g.key, label: formatMonthHeading(g.key, lang) })),
    [groupedNotes, lang]
  );

  const effectiveMonth = availableMonths.some(m => m.key === selectedMonth) ? selectedMonth : '';

  const visibleGroups = effectiveMonth
    ? groupedNotes.filter(g => g.key === effectiveMonth)
    : groupedNotes;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {isAdmin && (
        <Box
          sx={{
            mb: 2, p: 2, border: '1px solid', borderColor: 'divider',
            borderRadius: '12px', bgcolor: 'background.paper',
          }}
        >
          <TextField
            fullWidth multiline minRows={2}
            placeholder={tc.addNotePlaceholder}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            size="small" sx={{ mb: 1 }}
          />

          {hashtagError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
              {hashtagError}
            </Typography>
          )}

          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="contained" size="small"
              onClick={handleSave}
              disabled={saving || !body.trim() || !!hashtagError}
            >
              {saving ? tc.savingNote : tc.saveNote}
            </Button>
          </Box>
        </Box>
      )}

      {availableMonths.length > 1 && (
        <Box mb={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{tc.allMonths}</InputLabel>
            <Select
              label={tc.allMonths}
              value={effectiveMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <MenuItem value=""><em>{tc.allMonths}</em></MenuItem>
              {availableMonths.map(m => (
                <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {notes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {tc.noNotes}
        </Typography>
      ) : (
        visibleGroups.map(({ key, notes: groupNotes }) => (
          <Box key={key}>
            <Box display="flex" alignItems="center" gap={1} mb={1.5}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatMonthHeading(key, lang)}
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>

            {groupNotes.map((note) => {
              const noteChecklist: ChecklistItem[] = note.checklist ?? [];
              const completedCount = noteChecklist.filter((i: ChecklistItem) => i.checked).length;

              return (
                <Box
                  key={note.id}
                  sx={{
                    mb: 1.5, p: 2, border: '1px solid', borderColor: 'divider',
                    borderRadius: '12px', bgcolor: 'background.paper',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="caption" color="text.secondary">
                      {note.authorName && `${tc.noteBy} ${note.authorName} · `}
                      {new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', {
                        dateStyle: 'short', timeStyle: 'short',
                      })}
                    </Typography>
                    {isAdmin && (
                      <Tooltip title={tc.deleteNote}>
                        <IconButton size="small" onClick={() => setDeleteTarget(note.id)} sx={{ color: 'error.main' }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {note.body ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: noteChecklist.length ? 1 : 0 }}>
                      {note.body}
                    </Typography>
                  ) : null}

                  {noteChecklist.length > 0 && (
                    <Box mt={note.body ? 1 : 0}>
                      {note.body ? <Divider sx={{ mb: 1 }} /> : null}
                      {noteChecklist.map((item: ChecklistItem) => (
                        <Box key={item.id} display="flex" alignItems="center" gap={0.5}>
                          {item.checked && item.checkedByName ? (
                            <Tooltip
                              title={t.checklist.checkedBy(
                                item.checkedByName,
                                item.checkedAt
                                  ? new Date(item.checkedAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', { dateStyle: 'short', timeStyle: 'short' })
                                  : ''
                              )}
                              arrow
                            >
                              <Checkbox
                                size="small"
                                checked={item.checked}
                                onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                                disabled={!isAdmin}
                              />
                            </Tooltip>
                          ) : (
                            <Checkbox
                              size="small"
                              checked={item.checked}
                              onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                              disabled={!isAdmin}
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
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {completedCount}/{noteChecklist.length}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ))
      )}

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
