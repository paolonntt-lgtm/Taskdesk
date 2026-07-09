import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Checkbox,
  Divider, CircularProgress, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
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

// All keys are stored without diacritics — normalize() strips accents at lookup time.
// Each unique (deduplicated) string is listed once.
const MONTH_MAP: Record<string, number> = {
  // January
  gennaio: 1, january: 1, janvier: 1, enero: 1, januar: 1, janeiro: 1,
  // February
  febbraio: 2, february: 2, fevrier: 2, febrero: 2, februar: 2, fevereiro: 2,
  // March — marzo shared by IT+ES; marz=DE; mars=FR; marco=PT
  marzo: 3, march: 3, mars: 3, marz: 3, marco: 3,
  // April — abril shared by ES+PT
  aprile: 4, april: 4, avril: 4, abril: 4,
  // May — mai shared by FR+DE; maio=PT
  maggio: 5, may: 5, mai: 5, mayo: 5, maio: 5,
  // June
  giugno: 6, june: 6, juin: 6, junio: 6, juni: 6, junho: 6,
  // July
  luglio: 7, july: 7, juillet: 7, julio: 7, juli: 7, julho: 7,
  // August — agosto shared by IT+ES+PT; august shared by EN+DE
  agosto: 8, august: 8, aout: 8,
  // September
  settembre: 9, september: 9, septembre: 9, septiembre: 9, setembro: 9,
  // October
  ottobre: 10, october: 10, octobre: 10, octubre: 10, oktober: 10, outubro: 10,
  // November — novembre shared by IT+FR; november shared by EN+DE
  novembre: 11, november: 11, noviembre: 11, novembro: 11,
  // December
  dicembre: 12, december: 12, decembre: 12, diciembre: 12, dezember: 12, dezembro: 12,
  // Common abbreviations
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  gen: 1, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, dic: 12,
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fuzzyMatchMonth(raw: string): number | null {
  const key = normalize(raw);

  // Exact match first (on normalized form)
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (normalize(name) === key) return num;
  }

  // Find closest candidate within edit distance threshold
  const unique = new Map<string, number>();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    unique.set(normalize(name), num);
  }

  let best: number | null = null;
  let bestDist = Infinity;
  const threshold = Math.max(2, Math.floor(key.length / 3));

  for (const [name, num] of unique) {
    if (Math.abs(name.length - key.length) > threshold + 1) continue;
    const d = levenshtein(key, name);
    if (d < bestDist) {
      bestDist = d;
      best = num;
    }
  }

  return bestDist <= threshold ? best : null;
}

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

  const monthRaw = match[1];
  const yearRaw = match[2];

  const monthNum = fuzzyMatchMonth(monthRaw);
  if (!monthNum) {
    return { badMonth: monthRaw };
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
                          <Checkbox
                            size="small"
                            checked={item.checked}
                            onChange={() => handleToggleNoteChecklistItem(note.id, note.body, noteChecklist, item.id)}
                            disabled={!isAdmin}
                          />
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
