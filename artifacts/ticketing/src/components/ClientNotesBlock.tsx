import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  Divider, CircularProgress, Alert, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import {
  Add, Delete, CheckBoxOutlineBlank, CheckBox, AddTask,
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

  const [body, setBody] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: genId(), text: newChecklistText.trim(), checked: false },
    ]);
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSave = async () => {
    if (!body.trim()) { setError(tc.errorRequired); return; }
    setError(null);
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
    } catch {
      setError(tc.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNoteChecklistItem = async (
    noteId: number,
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
        data: { body: notes.find((n: any) => n.id === noteId)?.body ?? '', checklist: updated },
      });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await deleteNote.mutateAsync({ id: clientId, noteId: deleteTarget });
      qc.invalidateQueries({ queryKey: getListClientNotesQueryKey(clientId) });
    } catch {
      // silent
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
      {/* Add note form */}
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
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
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
                  onChange={() => handleToggleChecklistItem(item.id)}
                />
                <Typography variant="body2" sx={{ flex: 1, textDecoration: item.checked ? 'line-through' : 'none' }}>
                  {item.text}
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveChecklistItem(item.id)}>
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

      {/* Notes list */}
      {notes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {tc.noNotes}
        </Typography>
      ) : (
        notes.map((note: any) => (
          <Box
            key={note.id}
            sx={{
              mb: 1.5,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '12px',
              bgcolor: 'background.paper',
              position: 'relative',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {note.authorName && `${tc.noteBy} ${note.authorName} · `}
                  {new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </Typography>
              </Box>
              <Tooltip title={tc.deleteNote}>
                <IconButton size="small" onClick={() => setDeleteTarget(note.id)} sx={{ color: 'error.main' }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: note.checklist?.length ? 1 : 0 }}>
              {note.body}
            </Typography>

            {note.checklist && note.checklist.length > 0 && (
              <Box mt={1}>
                <Divider sx={{ mb: 1 }} />
                {(note.checklist as ChecklistItem[]).map((item) => (
                  <Box key={item.id} display="flex" alignItems="center" gap={0.5}>
                    <Checkbox
                      size="small"
                      checked={item.checked}
                      onChange={() => handleToggleNoteChecklistItem(note.id, note.checklist, item.id)}
                    />
                    <Typography
                      variant="body2"
                      sx={{ textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'text.disabled' : 'text.primary' }}
                    >
                      {item.text}
                    </Typography>
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {(note.checklist as ChecklistItem[]).filter((i) => i.checked).length}/{note.checklist.length}
                </Typography>
              </Box>
            )}
          </Box>
        ))
      )}

      {/* Delete confirmation */}
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
    </Box>
  );
}
