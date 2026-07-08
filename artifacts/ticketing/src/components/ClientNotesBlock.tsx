import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  Divider, CircularProgress, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import {
  Add, Delete, AddTask,
} from '@mui/icons-material';
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
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function ClientNotesBlock({ clientId }: ClientNotesBlockProps) {
  const { t, lang } = useLanguage();
  const tc = (t as any).clientNotes;
  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useListClientNotes(clientId);

  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  // New note form state
  const [body, setBody] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline add-checklist-item state per-note
  const [addingToNote, setAddingToNote] = useState<number | null>(null);
  const [inlineChecklistText, setInlineChecklistText] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  });
  const showToast = (severity: 'success' | 'error', msg: string) =>
    setToast({ open: true, severity, msg });

  // ── New note form handlers ──────────────────────────────────────────────
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: genId(), text: newChecklistText.trim(), checked: false },
    ]);
    setNewChecklistText('');
  };

  const handleToggleNewChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleRemoveNewChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSave = async () => {
    if (!body.trim()) { showToast('error', tc.errorRequired); return; }
    setSaving(true);
    try {
      await createNote.mutateAsync({
        id: clientId,
        data: {
          body: body.trim(),
          checklist: checklist.length > 0 ? checklist : null,
        },
      });
      setBody('');
      setChecklist([]);
      setShowChecklist(false);
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
      showToast('success', tc.saveNote);
    } catch {
      showToast('error', tc.errorSave);
    } finally {
      setSaving(false);
    }
  };

  // ── Existing note checklist toggle ──────────────────────────────────────
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
        data: { body: noteBody, checklist: updated },
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
    } catch {
      showToast('error', tc.errorSave);
    }
  };

  // ── Inline add checklist item to existing note ──────────────────────────
  const handleAddInlineChecklistItem = async (
    noteId: number,
    noteBody: string,
    noteChecklist: ChecklistItem[]
  ) => {
    if (!inlineChecklistText.trim()) return;
    const updated = [
      ...noteChecklist,
      { id: genId(), text: inlineChecklistText.trim(), checked: false },
    ];
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

  // ── Delete note ─────────────────────────────────────────────────────────
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

  return (
    <Box>
      {/* New note form */}
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '12px',
          bgcolor: 'background.paper',
        }}
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          placeholder={tc.addNotePlaceholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          size="small"
          sx={{ mb: 1 }}
        />

        {showChecklist && (
          <Box sx={{ mb: 1.5 }}>
            {checklist.map((item) => (
              <Box key={item.id} display="flex" alignItems="center" gap={0.5} mb={0.5}>
                <Checkbox
                  size="small"
                  checked={item.checked}
                  onChange={() => handleToggleNewChecklistItem(item.id)}
                />
                <Typography
                  variant="body2"
                  sx={{ flex: 1, textDecoration: item.checked ? 'line-through' : 'none' }}
                >
                  {item.text}
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveNewChecklistItem(item.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Box display="flex" gap={1} mt={0.5}>
              <TextField
                size="small"
                placeholder={tc.checklistItemPlaceholder}
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
            <IconButton
              size="small"
              onClick={() => setShowChecklist((v) => !v)}
              color={showChecklist ? 'primary' : 'default'}
            >
              <AddTask fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving || !body.trim()}
          >
            {saving ? tc.savingNote : tc.saveNote}
          </Button>
        </Box>
      </Box>

      {/* Existing notes */}
      {notes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {tc.noNotes}
        </Typography>
      ) : (
        (notes as any[]).map((note) => {
          const noteChecklist: ChecklistItem[] = note.checklist ?? [];
          const completedCount = noteChecklist.filter((i) => i.checked).length;
          return (
            <Box
              key={note.id}
              sx={{
                mb: 1.5,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '12px',
                bgcolor: 'background.paper',
              }}
            >
              {/* Header */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                <Typography variant="caption" color="text.secondary">
                  {note.authorName && `${tc.noteBy} ${note.authorName} · `}
                  {new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </Typography>
                <Tooltip title={tc.deleteNote}>
                  <IconButton size="small" onClick={() => setDeleteTarget(note.id)} sx={{ color: 'error.main' }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Body */}
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: noteChecklist.length ? 1 : 0 }}>
                {note.body}
              </Typography>

              {/* Checklist items */}
              {noteChecklist.length > 0 && (
                <Box mt={1}>
                  <Divider sx={{ mb: 1 }} />
                  {noteChecklist.map((item) => (
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

              {/* Inline add checklist item */}
              {addingToNote === note.id ? (
                <Box display="flex" gap={1} mt={1}>
                  <TextField
                    size="small"
                    autoFocus
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
                    size="small"
                    color="primary"
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
              )}
            </Box>
          );
        })
      )}

      {/* Delete confirmation dialog */}
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

      {/* Toast */}
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
