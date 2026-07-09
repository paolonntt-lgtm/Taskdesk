import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  Divider, CircularProgress, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import { Add, Delete, AddTask } from '@mui/icons-material';
import {
  useListClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
  getListClientNotesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ClientNotesBlockProps {
  clientId: number;
  isAdmin: boolean;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MONTH_MAP: Record<string, number> = {
  gennaio: 1,
  january: 1,
  febbraio: 2,
  february: 2,
  marzo: 3,
  march: 3,
  aprile: 4,
  april: 4,
  maggio: 5,
  may: 5,
  giugno: 6,
  june: 6,
  luglio: 7,
  july: 7,
  agosto: 8,
  august: 8,
  settembre: 9,
  september: 9,
  ottobre: 10,
  october: 10,
  novembre: 11,
  november: 11,
  dicembre: 12,
  december: 12,
};

const HASHTAG_REGEX = /#([a-zA-Z\u00C0-\u024F]+)(\d{2,4})/i;

interface HashtagParseResult {
  monthOverride: string;
  strippedBody: string;
}

interface HashtagParseError {
  badMonth: string;
}

function parseHashtag(text: string): HashtagParseResult | HashtagParseError | null {
  const match = HASHTAG_REGEX.exec(text);
  if (!match) return null;

  const monthRaw = match[1].toLowerCase();
  const yearRaw = match[2];

  const monthNum = MONTH_MAP[monthRaw];
  if (!monthNum) {
    return { badMonth: match[1] };
  }

  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const monthStr = String(monthNum).padStart(2, '0');
  const monthOverride = `${year}-${monthStr}`;

  const strippedBody = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
  return { monthOverride, strippedBody };
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

export default function ClientNotesBlock({ clientId, isAdmin }: ClientNotesBlockProps) {
  const { t, lang } = useLanguage();
  const tc = (t as any).clientNotes;
  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useListClientNotes(clientId);

  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  const [body, setBody] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);

  const [addingToNote, setAddingToNote] = useState<number | null>(null);
  const [inlineChecklistText, setInlineChecklistText] = useState('');

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

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist((prev) => [...prev, { id: genId(), text: newChecklistText.trim(), checked: false }]);
    setNewChecklistText('');
  };

  const handleToggleNewChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item)
    );
  };

  const handleRemoveNewChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
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

    setSaving(true);
    try {
      await createNote.mutateAsync({
        id: clientId,
        data: {
          body: finalBody,
          checklist: checklist.length > 0 ? checklist : null,
          monthOverride,
        } as any,
      });
      setBody('');
      setChecklist([]);
      setShowChecklist(false);
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

  const handleAddInlineChecklistItem = async (
    noteId: number,
    noteBody: string,
    noteChecklist: ChecklistItem[]
  ) => {
    if (!inlineChecklistText.trim()) return;
    const updated = [...noteChecklist, { id: genId(), text: inlineChecklistText.trim(), checked: false }];
    try {
      await updateNote.mutateAsync({
        id: clientId,
        noteId,
        data: { body: noteBody, checklist: updated },
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      setInlineChecklistText('');
      setAddingToNote(null);
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

          {showChecklist && (
            <Box sx={{ mb: 1.5 }}>
              {checklist.map((item) => (
                <Box key={item.id} display="flex" alignItems="center" gap={0.5} mb={0.5}>
                  <Checkbox size="small" checked={item.checked} onChange={() => handleToggleNewChecklistItem(item.id)} />
                  <Typography variant="body2" sx={{ flex: 1, textDecoration: item.checked ? 'line-through' : 'none' }}>
                    {item.text}
                  </Typography>
                  <IconButton size="small" onClick={() => handleRemoveNewChecklistItem(item.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Box display="flex" gap={1} mt={0.5}>
                <TextField
                  size="small" placeholder={tc.checklistItemPlaceholder}
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }}
                  sx={{ flex: 1 }}
                />
                <IconButton size="small" onClick={handleAddChecklistItem} disabled={!newChecklistText.trim()}>
                  <Add fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Tooltip title={tc.addChecklistItem}>
              <IconButton size="small" onClick={() => setShowChecklist((v) => !v)} color={showChecklist ? 'primary' : 'default'}>
                <AddTask fontSize="small" />
              </IconButton>
            </Tooltip>
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

      {notes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {tc.noNotes}
        </Typography>
      ) : (
        groupedNotes.map(({ key, notes: groupNotes }) => (
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

                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: noteChecklist.length ? 1 : 0 }}>
                    {note.body}
                  </Typography>

                  {noteChecklist.length > 0 && (
                    <Box mt={1}>
                      <Divider sx={{ mb: 1 }} />
                      {noteChecklist.map((item: ChecklistItem) => (
                        <Box key={item.id} display="flex" alignItems="center" gap={0.5}>
                          <Checkbox
                            size="small"
                            checked={item.checked}
                            onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                          />
                          <Typography
                            variant="body2"
                            sx={{
                              textDecoration: item.checked ? 'line-through' : 'none',
                              color: item.checked ? 'text.disabled' : 'text.primary',
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

                  {isAdmin && (
                    addingToNote === note.id ? (
                      <Box display="flex" gap={1} mt={1}>
                        <TextField
                          size="small" autoFocus
                          placeholder={tc.checklistItemPlaceholder}
                          value={inlineChecklistText}
                          onChange={(e) => setInlineChecklistText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleAddInlineChecklistItem(note.id, note.body, noteChecklist); }
                            if (e.key === 'Escape') { setAddingToNote(null); setInlineChecklistText(''); }
                          }}
                          sx={{ flex: 1 }}
                        />
                        <IconButton
                          size="small" color="primary"
                          onClick={() => handleAddInlineChecklistItem(note.id, note.body, noteChecklist)}
                          disabled={!inlineChecklistText.trim()}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Tooltip title={tc.addChecklistItem}>
                        <IconButton
                          size="small"
                          sx={{ mt: 0.5, color: 'text.disabled' }}
                          onClick={() => { setAddingToNote(note.id); setInlineChecklistText(''); }}
                        >
                          <AddTask fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )
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
