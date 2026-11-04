import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, Paper, TextField, Typography } from '@mui/material';
import { Add, Delete, Save } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientNoteDeclaratives, type ClientNoteDeclarative } from '../hooks/useClientNoteDeclaratives';

export default function ClientNoteDeclarativesSettings() {
  const { t } = useLanguage();
  const copy = (t.settings as any).clientNoteDeclaratives;
  const queryClient = useQueryClient();
  const { declaratives, isLoading, isError, queryKey } = useClientNoteDeclaratives();
  const [draft, setDraft] = useState<ClientNoteDeclarative[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => setDraft(declaratives), [declaratives]);

  const update = (id: string, key: 'name' | 'alias', value: string) =>
    setDraft((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/client-note-declaratives', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ declaratives: draft.map((item) => ({ ...item, name: item.name.trim(), alias: item.alias.trim().startsWith('#') ? item.alias.trim() : `#${item.alias.trim()}` })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.error);
      queryClient.setQueryData(queryKey, data.declaratives);
      setMessage({ severity: 'success', text: copy.saved });
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : copy.error });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>;
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>{copy.description}</Typography>
      {isError && <Alert severity="error" sx={{ mb: 2 }}>{copy.loadError}</Alert>}
      {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Box display="flex" flexDirection="column" gap={1.5}>
        {draft.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField size="small" fullWidth label={copy.name} value={item.name} onChange={(event) => update(item.id, 'name', event.target.value)} />
            <TextField size="small" fullWidth label={copy.alias} value={item.alias} onChange={(event) => update(item.id, 'alias', event.target.value)} placeholder="#CU" />
            <IconButton aria-label={copy.remove} onClick={() => setDraft((items) => items.filter((entry) => entry.id !== item.id))}><Delete /></IconButton>
          </Paper>
        ))}
      </Box>
      <Box display="flex" gap={1} mt={2}>
        <Button startIcon={<Add />} onClick={() => setDraft((items) => [...items, { id: crypto.randomUUID(), name: '', alias: '#' }])}>{copy.add}</Button>
        <Button variant="contained" startIcon={<Save />} onClick={() => void save()} disabled={saving || draft.some((item) => !item.name.trim() || item.alias.trim() === '#')}>
          {saving ? copy.saving : copy.save}
        </Button>
      </Box>
    </Box>
  );
}
