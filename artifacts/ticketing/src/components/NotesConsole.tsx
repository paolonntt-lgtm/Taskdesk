import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, IconButton, Paper, Tooltip,
  Popper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Chip, Collapse, ClickAwayListener,
} from '@mui/material';
import {
  EditNote, Close, Send, ExpandLess, KeyboardArrowDown,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useListClients, useCreateClientNote } from '@workspace/api-client-react';

interface NotesConsoleProps {
  prefilledClientId?: number;
  prefilledClientSlug?: string;
  prefilledClientName?: string;
}

export default function NotesConsole({
  prefilledClientId,
  prefilledClientSlug,
  prefilledClientName,
}: NotesConsoleProps) {
  const { t } = useLanguage();
  const tc = (t as any).clientNotes;

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(prefilledClientId ?? null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(prefilledClientName ?? null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const { data: clients = [] } = useListClients(
    { search: mentionSearch || undefined }
  );

  const createNote = useCreateClientNote();

  useEffect(() => {
    if (prefilledClientId !== undefined) {
      setSelectedClientId(prefilledClientId);
      setSelectedClientName(prefilledClientName ?? null);
      setOpen(true);
    }
  }, [prefilledClientId, prefilledClientName]);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1 && atIdx >= val.length - 40) {
      const search = val.slice(atIdx + 1);
      if (!search.includes(' ') || search.length < 30) {
        setMentionSearch(search);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
  };

  const handleSelectClient = (clientId: number, clientName: string) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setMentionOpen(false);
    const atIdx = body.lastIndexOf('@');
    if (atIdx !== -1) {
      setBody(body.slice(0, atIdx));
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClearClient = () => {
    setSelectedClientId(null);
    setSelectedClientName(null);
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !body.trim()) return;
    setSaving(true);
    try {
      await createNote.mutateAsync({
        id: selectedClientId,
        data: { body: body.trim(), checklist: null },
      });
      setBody('');
      setSelectedClientId(prefilledClientId ?? null);
      setSelectedClientName(prefilledClientName ?? null);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 2000);
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setMentionOpen(false);
    }
  };

  const filteredClients = (clients as any[]).slice(0, 8);

  return (
    <Box ref={anchorRef}>
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1.5,
          px: 1.5,
          pb: open ? 1 : 1.5,
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer', mb: open ? 1 : 0 }}
          onClick={() => setOpen((v) => !v)}
        >
          <Box display="flex" alignItems="center" gap={0.75}>
            <EditNote fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ letterSpacing: '0.03em' }}>
              {tc.consoleTitle}
            </Typography>
            {successMsg && (
              <Typography variant="caption" color="success.main" fontWeight={600}>✓</Typography>
            )}
          </Box>
          <IconButton size="small" sx={{ p: 0.25 }}>
            {open ? <ExpandLess fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={open} timeout="auto">
          <Box>
            {selectedClientName ? (
              <Chip
                label={`@${selectedClientName}`}
                size="small"
                color="primary"
                variant="outlined"
                onDelete={handleClearClient}
                sx={{ mb: 1, fontSize: '0.75rem', height: 22 }}
              />
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                {tc.consoleHint}
              </Typography>
            )}

            <Box position="relative">
              <TextField
                inputRef={inputRef}
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                size="small"
                placeholder={tc.consolePlaceholder}
                value={body}
                onChange={handleBodyChange}
                onKeyDown={handleKeyDown}
                InputProps={{ sx: { fontSize: '0.82rem', borderRadius: '10px' } }}
              />

              <Popper
                open={mentionOpen && filteredClients.length > 0}
                anchorEl={anchorRef.current}
                placement="top-start"
                style={{ zIndex: 1500, width: anchorRef.current?.offsetWidth }}
              >
                <ClickAwayListener onClickAway={() => setMentionOpen(false)}>
                  <Paper elevation={8} sx={{ borderRadius: '12px', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                    <List dense disablePadding>
                      {filteredClients.map((c: any) => (
                        <ListItem key={c.id} disablePadding>
                          <ListItemButton
                            onClick={() => handleSelectClient(c.id, c.name)}
                            sx={{ py: 0.75, px: 1.5 }}
                          >
                            <ListItemText
                              primary={c.name}
                              secondary={c.slug ? `@${c.slug}` : undefined}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </ClickAwayListener>
              </Popper>
            </Box>

            <Box display="flex" justifyContent="flex-end" mt={0.75}>
              <Tooltip title="Ctrl+Enter">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={saving || !selectedClientId || !body.trim()}
                  >
                    {saving ? <CircularProgress size={16} /> : <Send fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}
