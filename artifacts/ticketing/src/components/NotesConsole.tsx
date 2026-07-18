import React, { useState, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton, Paper, Tooltip,
  Popper, List, ListItem, ListItemButton, ListItemText,
  CircularProgress, Chip, ClickAwayListener, Collapse,
  Snackbar, Alert, Divider, Button,
} from '@mui/material';
import {
  EditNote, Send, OpenInNew, ExpandLess, ExpandMore,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useListClients,
  useCreateClientNote,
  useListAllClientNotes,
  resolveClientBySlug,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { parseHashtag } from '../lib/clientNoteHashtag';

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function bodyToChecklist(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({ id: genId(), text: line, checked: false }));
}

export default function NotesConsole() {
  const { t, lang } = useLanguage();
  const tc = (t as any).clientNotes;
  const [, setLocation] = useLocation();

  const [body, setBody] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [selectedClientSlug, setSelectedClientSlug] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [toast, setToast] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  });
  const showToast = (severity: 'success' | 'error', msg: string) =>
    setToast({ open: true, severity, msg });

  const anchorRef = useRef<HTMLDivElement>(null);

  const { data: clients = [] } = useListClients({ search: mentionSearch || undefined });
  const { data: allRecentNotes = [] } = useListAllClientNotes();

  const createNote = useCreateClientNote();

  // Parse @slug from body text — returns { slug, cleanBody } or null
  const parseMention = (text: string): { slug: string; cleanBody: string } | null => {
    const match = text.match(/@([\w.\-]+)/);
    if (!match) return null;
    return { slug: match[1], cleanBody: text.replace(match[0], '').trim() };
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);

    const hashResult = parseHashtag(val);
    if (hashResult && 'badMonth' in hashResult) {
      setHashtagError(tc.invalidMonth(hashResult.badMonth));
    } else {
      setHashtagError(null);
    }

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

  const handleSelectClient = (clientId: number, clientName: string, clientSlug: string | null) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setSelectedClientSlug(clientSlug);
    setMentionOpen(false);
    // Replace the typed @... fragment with @slug token in the body
    const atIdx = body.lastIndexOf('@');
    if (atIdx !== -1) {
      const slugToken = clientSlug ? `@${clientSlug} ` : `@${clientName} `;
      setBody(body.slice(0, atIdx) + slugToken);
    }
  };

  const handleClearClient = () => {
    setSelectedClientId(null);
    setSelectedClientName(null);
    setSelectedClientSlug(null);
  };

  const handleSubmit = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) { showToast('error', tc.errorRequired); return; }
    if (hashtagError) return;

    let clientId = selectedClientId;
    let noteBody = trimmedBody;

    // If no client pre-selected via chip, try to resolve @slug from body text
    if (!clientId) {
      const mentioned = parseMention(trimmedBody);
      if (mentioned) {
        try {
          const resolved = await resolveClientBySlug(mentioned.slug);
          clientId = (resolved as any).id;
          // Remove the @slug token from the note body
          noteBody = mentioned.cleanBody || trimmedBody;
        } catch {
          showToast('error', tc.consoleNoClient);
          return;
        }
      } else {
        showToast('error', tc.errorRequired);
        return;
      }
    } else {
      // Strip @slug token from body text when client was pre-selected via autocomplete
      const slug = selectedClientSlug;
      if (slug && noteBody.includes(`@${slug}`)) {
        noteBody = noteBody.replace(`@${slug}`, '').trim();
      }
    }

    if (!noteBody) { showToast('error', tc.errorRequired); return; }

    // Extract monthOverride from hashtag shortcut
    const hashResult = parseHashtag(noteBody);
    let monthOverride: string | null = null;
    if (hashResult && 'monthOverride' in hashResult) {
      monthOverride = hashResult.monthOverride;
      noteBody = hashResult.strippedBody;
    }

    if (!noteBody) { showToast('error', tc.errorRequired); return; }

    setSaving(true);
    try {
      const checklist = bodyToChecklist(noteBody);
      await createNote.mutateAsync({
        id: clientId!,
        data: {
          body: '',
          checklist: checklist.length > 0 ? checklist : null,
          monthOverride,
        } as any,
      });
      setBody('');
      setHashtagError(null);
      setSelectedClientId(null);
      setSelectedClientName(null);
      setSelectedClientSlug(null);
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

  const filteredClients = (clients as any[]).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })).slice(0, 8);
  const recentNotes = (allRecentNotes as any[]).slice(0, historyLimit);
  const hasMore = (allRecentNotes as any[]).length > historyLimit;

  return (
    <Box ref={anchorRef}>
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1.5, px: 1.5,
          pb: 1,
        }}
      >
        {/* Console header */}
        <Box
          display="flex"
          alignItems="center"
          gap={0.75}
          mb={1}
        >
          <EditNote fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ letterSpacing: '0.03em' }}>
            {tc.consoleTitle}
          </Typography>
        </Box>

        <Box>
            {/* Selected client chip */}
            {selectedClientName ? (
              <Chip
                label={`@${selectedClientSlug ?? selectedClientName}`}
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

            {/* Input with @mention popper */}
            <Box position="relative">
              <TextField
                fullWidth multiline minRows={2} maxRows={5} size="small"
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
                            onClick={() => handleSelectClient(c.id, c.name, c.slug ?? null)}
                            sx={{ py: 0.75, px: 1.5 }}
                          >
                            <ListItemText
                              primary={c.name}
                              secondary={c.slug ? `@${c.slug}` : c.vatNumber ?? undefined}
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

            {/* Hashtag error / hint */}
            {hashtagError ? (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, fontSize: '0.72rem' }}>
                {hashtagError}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                {tc.monthHashtagHint}
              </Typography>
            )}

            {/* Submit */}
            <Box display="flex" justifyContent="flex-end" mt={0.75}>
              <Tooltip title="Ctrl+Enter">
                <span>
                  <IconButton
                    size="small" color="primary"
                    onClick={handleSubmit}
                    disabled={saving || !body.trim() || !!hashtagError}
                  >
                    {saving ? <CircularProgress size={16} /> : <Send fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* History panel — collapsible */}
            {recentNotes.length > 0 && (
              <Box mt={1}>
                <Divider sx={{ mb: 0.5 }} />
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ cursor: 'pointer', py: 0.5 }}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {tc.historyTitle}
                    {!historyOpen && (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.75 }}>
                        ({recentNotes.length}{hasMore ? '+' : ''})
                      </Typography>
                    )}
                  </Typography>
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    {historyOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </IconButton>
                </Box>
                <Collapse in={historyOpen} timeout="auto" unmountOnExit>
                  <Box>
                    {recentNotes.map((note: any) => (
                      <Box
                        key={note.id}
                        sx={{
                          mb: 0.75, px: 1.25, py: 0.75, borderRadius: '8px',
                          bgcolor: 'action.hover',
                          '&:hover': { bgcolor: 'action.selected' },
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                              {note.clientName && (
                                <Chip
                                  label={`@${note.clientSlug ?? note.clientName}`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontSize: '0.65rem', height: 18, cursor: 'pointer' }}
                                  onClick={() => note.clientId && setLocation(`/clients/${note.clientId}`)}
                                />
                              )}
                              <Typography variant="caption" color="text.disabled" noWrap>
                                {new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', {
                                  dateStyle: 'short', timeStyle: 'short',
                                })}
                                {note.authorName && ` · ${note.authorName}`}
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
                    {hasMore && (
                      <Button
                        size="small"
                        sx={{ mt: 0.5, fontSize: '0.72rem' }}
                        onClick={() => setHistoryLimit((l) => l + 10)}
                      >
                        {lang === 'en' ? 'Load more' : 'Carica altri'}
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Box>
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
