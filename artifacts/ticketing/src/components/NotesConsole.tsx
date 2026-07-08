import React, { useState, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton, Paper, Tooltip,
  Popper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Chip, Collapse, ClickAwayListener,
  Snackbar, Alert, Link, Divider,
} from '@mui/material';
import {
  EditNote, Send, ExpandLess, KeyboardArrowDown, OpenInNew,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useListClients,
  useCreateClientNote,
  useListAllClientNotes,
  resolveClientBySlug,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';

export default function NotesConsole() {
  const { t, lang } = useLanguage();
  const tc = (t as any).clientNotes;
  const [, setLocation] = useLocation();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  });
  const showToast = (severity: 'success' | 'error', msg: string) =>
    setToast({ open: true, severity, msg });

  const anchorRef = useRef<HTMLDivElement>(null);

  const { data: clients = [] } = useListClients({ search: mentionSearch || undefined });
  const { data: recentNotes = [] } = useListAllClientNotes({ limit: 8 } as any);

  const createNote = useCreateClientNote();

  // Parse @slug from body text — returns { slug, cleanBody } or null
  const parseMention = (text: string): { slug: string; cleanBody: string } | null => {
    const match = text.match(/@([\w.\-]+)/);
    if (!match) return null;
    return {
      slug: match[1],
      cleanBody: text.replace(match[0], '').trim(),
    };
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1) {
      const afterAt = val.slice(atIdx + 1);
      if (!afterAt.includes(' ') || afterAt.length < 30) {
        setMentionSearch(afterAt);
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
    // Strip the @... text typed so far
    const atIdx = body.lastIndexOf('@');
    if (atIdx !== -1) {
      setBody(body.slice(0, atIdx));
    }
  };

  const handleClearClient = () => {
    setSelectedClientId(null);
    setSelectedClientName(null);
  };

  const handleSubmit = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) { showToast('error', tc.errorRequired); return; }

    let clientId = selectedClientId;
    let noteBody = trimmedBody;

    // If no client selected via autocomplete, try to resolve @slug from body text
    if (!clientId) {
      const mentioned = parseMention(trimmedBody);
      if (mentioned) {
        try {
          const resolved = await resolveClientBySlug(mentioned.slug);
          clientId = (resolved as any).id;
          noteBody = mentioned.cleanBody || trimmedBody;
        } catch {
          showToast('error', tc.consoleNoClient);
          return;
        }
      } else {
        showToast('error', tc.errorRequired);
        return;
      }
    }

    if (!noteBody) { showToast('error', tc.errorRequired); return; }

    setSaving(true);
    try {
      await createNote.mutateAsync({
        id: clientId!,
        data: { body: noteBody, checklist: null },
      });
      setBody('');
      setSelectedClientId(null);
      setSelectedClientName(null);
      showToast('success', tc.consoleSubmit);
    } catch {
      showToast('error', tc.errorSave);
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
        {/* Console header toggle */}
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
          </Box>
          <IconButton size="small" sx={{ p: 0.25 }}>
            {open ? <ExpandLess fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box>
            {/* Selected client chip */}
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

            {/* Input box with mention popper */}
            <Box position="relative">
              <TextField
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

            {/* Submit button */}
            <Box display="flex" justifyContent="flex-end" mt={0.75}>
              <Tooltip title="Ctrl+Enter">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={saving || !body.trim()}
                  >
                    {saving ? <CircularProgress size={16} /> : <Send fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* History panel */}
            {(recentNotes as any[]).length > 0 && (
              <Box mt={1}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                  {tc.historyTitle}
                </Typography>
                {(recentNotes as any[]).map((note: any) => (
                  <Box
                    key={note.id}
                    sx={{
                      mb: 0.75,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: '8px',
                      bgcolor: 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                          {note.clientName && (
                            <Chip
                              label={`@${note.clientName}`}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ fontSize: '0.65rem', height: 18, cursor: 'pointer' }}
                              onClick={() => note.clientId && setLocation(`/clients/${note.clientId}`)}
                            />
                          )}
                          <Typography variant="caption" color="text.disabled" noWrap>
                            {new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </Typography>
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            mt: 0.25,
                          }}
                        >
                          {note.body}
                        </Typography>
                      </Box>
                      {note.clientId && (
                        <Tooltip title={note.clientName ?? ''}>
                          <IconButton
                            size="small"
                            sx={{ ml: 0.5, p: 0.25, flexShrink: 0 }}
                            onClick={() => setLocation(`/clients/${note.clientId}`)}
                          >
                            <OpenInNew sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((p) => ({ ...p, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
