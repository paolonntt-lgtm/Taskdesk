import React, { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Box, IconButton, Tooltip, Divider, LinearProgress, Chip,
  Typography, Paper, List, ListItemButton, ListItemText, ListItemAvatar, Avatar,
} from '@mui/material';
import {
  FormatBold, FormatItalic, FormatListBulleted, FormatListNumbered,
  Code, AttachFile, Close, InsertDriveFile, Image as ImageIcon,
  AlternateEmail, Tag,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

export interface PendingAttachment {
  objectPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface RichCommentEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  ticketId: number;
  onAttachmentsChange?: (attachments: PendingAttachment[]) => void;
  minRows?: number;
}

interface AutocompleteUser { id: number; name: string; avatarUrl?: string | null; }
interface AutocompleteTicket { id: number; title: string; }
type AutocompleteState =
  | { type: 'mention'; query: string; startIndex: number; results: AutocompleteUser[]; selectedIdx: number }
  | { type: 'ticket'; query: string; startIndex: number; results: AutocompleteTicket[]; selectedIdx: number }
  | null;

function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string,
  defaultText: string,
  onChange: (val: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || defaultText;
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  onChange(newValue);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  }, 0);
}

function insertLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string,
  onChange: (val: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;

  // Find the start of the first selected line
  const firstLineStart = value.lastIndexOf('\n', start - 1) + 1;
  // Find the end of the last selected line
  const lastLineEnd = value.indexOf('\n', end);
  const blockEnd = lastLineEnd === -1 ? value.length : lastLineEnd;

  const block = value.slice(firstLineStart, blockEnd);
  const lines = block.split('\n');

  const isNumbered = /^\d+\.\s/.test(prefix);

  // Detect whether all lines already have a list prefix (bullet or numbered)
  const allHavePrefix = lines.every((l) =>
    isNumbered ? /^\d+\.\s/.test(l) : l.startsWith(prefix),
  );

  let newBlock: string;
  if (allHavePrefix) {
    // Toggle off — strip the prefix from every line
    newBlock = lines
      .map((l) => (isNumbered ? l.replace(/^\d+\.\s/, '') : l.slice(prefix.length)))
      .join('\n');
  } else {
    // Add prefix to every line, with auto-numbering for ordered lists
    let counter = 1;
    newBlock = lines
      .map((l) => {
        const stripped = isNumbered ? l.replace(/^\d+\.\s/, '') : l.startsWith(prefix) ? l.slice(prefix.length) : l;
        return isNumbered ? `${counter++}. ${stripped}` : prefix + stripped;
      })
      .join('\n');
  }

  const newValue = value.slice(0, firstLineStart) + newBlock + value.slice(blockEnd);
  onChange(newValue);

  // Restore / adjust selection
  const lengthDiff = newBlock.length - block.length;
  setTimeout(() => {
    textarea.focus();
    const newStart = Math.max(firstLineStart, start + (allHavePrefix ? -prefix.length : prefix.length));
    const newEnd = end + lengthDiff;
    textarea.setSelectionRange(newStart, Math.max(newStart, newEnd));
  }, 0);
}

async function requestPresignedUrl(file: File, uploadRequestError: string): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
  });
  if (!res.ok) throw new Error(uploadRequestError);
  return res.json();
}

async function uploadToPresignedUrl(file: File, url: string, uploadFileError: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(uploadFileError);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];
const MAX_SIZE_MB = 20;

export interface RichCommentEditorHandle {
  focus: () => void;
  focusEnd: () => void;
}

export const RichCommentEditor = forwardRef<RichCommentEditorHandle, RichCommentEditorProps>(function RichCommentEditor({
  value,
  onChange,
  placeholder,
  onAttachmentsChange,
  minRows = 3,
  ticketId,
}: RichCommentEditorProps, ref) {
  const { t } = useLanguage();
  const tr = t.richEditor;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    focusEnd: () => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(null);
  const [allUsers, setAllUsers] = useState<AutocompleteUser[]>([]);

  // Load users once
  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((users: any[]) => setAllUsers(users.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))))
      .catch(() => {});
  }, []);

  const action = useCallback((fn: (ta: HTMLTextAreaElement) => void) => {
    if (textareaRef.current) fn(textareaRef.current);
  }, []);

  const closeAutocomplete = useCallback(() => setAutocomplete(null), []);

  const insertMention = useCallback((user: AutocompleteUser) => {
    if (!autocomplete || autocomplete.type !== 'mention') return;
    const ta = textareaRef.current;
    if (!ta) return;
    const before = value.slice(0, autocomplete.startIndex);
    const after = value.slice(ta.selectionStart);
    const tag = `@[${user.name}]`;
    const newVal = before + tag + ' ' + after;
    onChange(newVal);
    closeAutocomplete();
    setTimeout(() => {
      ta.focus();
      const pos = autocomplete.startIndex + tag.length + 1;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [autocomplete, value, onChange, closeAutocomplete]);

  const insertTicketRef = useCallback((ticket: AutocompleteTicket) => {
    if (!autocomplete || autocomplete.type !== 'ticket') return;
    const ta = textareaRef.current;
    if (!ta) return;
    const before = value.slice(0, autocomplete.startIndex);
    const after = value.slice(ta.selectionStart);
    const tag = `[#${(ticket as any).ticketNumber ?? ticket.id} ${ticket.title}](/tickets/${ticket.id})`;
    const newVal = before + tag + ' ' + after;
    onChange(newVal);
    closeAutocomplete();
    setTimeout(() => {
      ta.focus();
      const pos = autocomplete.startIndex + tag.length + 1;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [autocomplete, value, onChange, closeAutocomplete]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    const cursor = e.target.selectionStart;

    // Find trigger character before cursor
    const textBefore = newVal.slice(0, cursor);

    // Check for @mention
    const mentionMatch = textBefore.match(/@([^\s@#]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const startIndex = cursor - mentionMatch[0].length;
      const results = allUsers
        .filter((u) => u.name.toLowerCase().includes(query))
        .slice(0, 6);
      setAutocomplete({ type: 'mention', query, startIndex, results, selectedIdx: 0 });
      return;
    }

    // Check for #ticket
    const ticketMatch = textBefore.match(/#(\d*)$/);
    if (ticketMatch) {
      const query = ticketMatch[1];
      const startIndex = cursor - ticketMatch[0].length;
      // Fetch ticket suggestions — search by ID when numeric, by title otherwise
      const searchParam = query ? `search=${encodeURIComponent(query)}&` : '';
      fetch(`/api/tickets?${searchParam}limit=6`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data: any) => {
          const all: AutocompleteTicket[] = (data.tickets ?? data ?? [])
            .map((t: any) => ({ id: t.id, title: t.title }));
          // When query is numeric, sort exact ID match first
          const sorted = query && /^\d+$/.test(query)
            ? [...all].sort((a, b) => {
                const aMatch = a.id === parseInt(query, 10) ? -1 : 0;
                const bMatch = b.id === parseInt(query, 10) ? 1 : 0;
                return aMatch + bMatch;
              })
            : all;
          setAutocomplete({ type: 'ticket', query, startIndex, results: sorted.slice(0, 6), selectedIdx: 0 });
        })
        .catch(() => closeAutocomplete());
      return;
    }

    closeAutocomplete();
  }, [onChange, allUsers, closeAutocomplete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete((a) => a ? { ...a, selectedIdx: Math.min(a.selectedIdx + 1, a.results.length - 1) } : null);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete((a) => a ? { ...a, selectedIdx: Math.max(a.selectedIdx - 1, 0) } : null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (autocomplete.type === 'mention') {
          const user = (autocomplete.results as AutocompleteUser[])[autocomplete.selectedIdx];
          if (user) insertMention(user);
        } else {
          const ticket = (autocomplete.results as AutocompleteTicket[])[autocomplete.selectedIdx];
          if (ticket) insertTicketRef(ticket);
        }
        return;
      }
      if (e.key === 'Escape') {
        closeAutocomplete();
        return;
      }
    }

    // Auto-continue lists on Enter
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      const ta = textareaRef.current;
      if (ta) {
        const cursor = ta.selectionStart;
        const textBefore = ta.value.slice(0, cursor);
        const lineStart = textBefore.lastIndexOf('\n') + 1;
        const currentLine = textBefore.slice(lineStart);

        const numberedMatch = currentLine.match(/^(\d+)\. (.*)/);
        const bulletMatch = currentLine.match(/^([-*]) (.*)/);

        if (numberedMatch) {
          e.preventDefault();
          const lineContent = numberedMatch[2];
          if (lineContent.trim() === '') {
            // Empty list item → exit list: remove the prefix
            const newVal = ta.value.slice(0, lineStart) + '\n' + ta.value.slice(cursor);
            onChange(newVal);
            setTimeout(() => {
              const pos = lineStart + 1;
              ta.setSelectionRange(pos, pos);
            }, 0);
          } else {
            const nextNum = parseInt(numberedMatch[1], 10) + 1;
            const insert = `\n${nextNum}. `;
            const newVal = ta.value.slice(0, cursor) + insert + ta.value.slice(ta.selectionEnd);
            onChange(newVal);
            setTimeout(() => {
              const pos = cursor + insert.length;
              ta.setSelectionRange(pos, pos);
            }, 0);
          }
          return;
        }

        if (bulletMatch) {
          e.preventDefault();
          const lineContent = bulletMatch[2];
          if (lineContent.trim() === '') {
            // Empty list item → exit list: remove the prefix
            const newVal = ta.value.slice(0, lineStart) + '\n' + ta.value.slice(cursor);
            onChange(newVal);
            setTimeout(() => {
              const pos = lineStart + 1;
              ta.setSelectionRange(pos, pos);
            }, 0);
          } else {
            const marker = bulletMatch[1];
            const insert = `\n${marker} `;
            const newVal = ta.value.slice(0, cursor) + insert + ta.value.slice(ta.selectionEnd);
            onChange(newVal);
            setTimeout(() => {
              const pos = cursor + insert.length;
              ta.setSelectionRange(pos, pos);
            }, 0);
          }
          return;
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      action(ta => wrapSelection(ta, '**', '**', 'testo', onChange));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      action(ta => wrapSelection(ta, '*', '*', 'testo', onChange));
    }
  }, [autocomplete, insertMention, insertTicketRef, closeAutocomplete, action, onChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setUploadError(null);
    const errors: string[] = [];
    const toUpload: File[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: ${tr.uploadTypeError}`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: ${tr.uploadSizeError.replace('{max}', String(MAX_SIZE_MB))}`);
        continue;
      }
      toUpload.push(file);
    }

    if (errors.length) { setUploadError(errors.join('; ')); }
    if (!toUpload.length) return;

    setUploading(true);
    const uploaded: PendingAttachment[] = [];

    for (const file of toUpload) {
      try {
        const { uploadURL, objectPath } = await requestPresignedUrl(file, tr.uploadRequestError);
        await uploadToPresignedUrl(file, uploadURL, tr.uploadFileError);
        uploaded.push({ objectPath, fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream' });
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (errors.length) setUploadError(errors.join('; '));

    const next = [...pendingAttachments, ...uploaded];
    setPendingAttachments(next);
    onAttachmentsChange?.(next);
    setUploading(false);
  };

  const removeAttachment = (idx: number) => {
    const next = pendingAttachments.filter((_, i) => i !== idx);
    setPendingAttachments(next);
    onAttachmentsChange?.(next);
  };

  const isImage = (mime: string) => mime.startsWith('image/');

  const hasResults = autocomplete && autocomplete.results.length > 0;

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 1,
            py: 0.5,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexWrap: 'wrap',
          }}
        >
          <Tooltip title={tr.bold}>
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '**', '**', 'testo', onChange)); }}>
              <FormatBold fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={tr.italic}>
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '*', '*', 'testo', onChange)); }}>
              <FormatItalic fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={tr.code}>
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '`', '`', 'codice', onChange)); }}>
              <Code fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title={tr.bulletList}>
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => insertLinePrefix(ta, '- ', onChange)); }}>
              <FormatListBulleted fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={tr.numberedList}>
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => insertLinePrefix(ta, '1. ', onChange)); }}>
              <FormatListNumbered fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title={tr.attach}>
            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <AttachFile fontSize="small" />
            </IconButton>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </Box>

        {/* Tagging hint bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 1.5,
            py: 0.75,
            bgcolor: 'primary.50',
            borderBottom: '1px solid',
            borderColor: 'primary.100',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <AlternateEmail sx={{ fontSize: 14, color: 'primary.600' }} />
            <Typography variant="caption" sx={{ color: 'primary.700', fontWeight: 600, fontSize: '0.75rem' }}>
              @Nome
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              — {tr.mentionHint}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'primary.200' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Tag sx={{ fontSize: 14, color: 'primary.600' }} />
            <Typography variant="caption" sx={{ color: 'primary.700', fontWeight: 600, fontSize: '0.75rem' }}>
              #42
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              — {tr.ticketHint}
            </Typography>
          </Box>
        </Box>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={minRows}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            padding: '12px',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            boxSizing: 'border-box',
            background: 'transparent',
            minHeight: `${minRows * 1.6 * 14 + 24}px`,
          }}
        />
      </Paper>

      {/* Autocomplete dropdown */}
      {hasResults && (
        <Paper
          ref={dropdownRef}
          elevation={4}
          sx={{
            position: 'absolute',
            left: 0,
            bottom: '100%',
            mb: 0.5,
            zIndex: 1400,
            minWidth: 220,
            maxWidth: 340,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {autocomplete!.type === 'mention' ? tr.mentionDropdownTitle : tr.ticketDropdownTitle}
            </Typography>
          </Box>
          <List dense disablePadding>
            {autocomplete!.type === 'mention'
              ? (autocomplete!.results as AutocompleteUser[]).map((user, idx) => (
                <ListItemButton
                  key={user.id}
                  selected={idx === autocomplete!.selectedIdx}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(user); }}
                  sx={{ py: 0.75 }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 26, height: 26, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                      {user.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={user.name} primaryTypographyProps={{ fontSize: '0.85rem' }} />
                </ListItemButton>
              ))
              : (autocomplete!.results as AutocompleteTicket[]).map((ticket, idx) => (
                <ListItemButton
                  key={ticket.id}
                  selected={idx === autocomplete!.selectedIdx}
                  onMouseDown={(e) => { e.preventDefault(); insertTicketRef(ticket); }}
                  sx={{ py: 0.75 }}
                >
                  <ListItemText
                    primary={<><Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>#{(ticket as any).ticketNumber ?? ticket.id}</Box> {ticket.title}</>}
                    primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                  />
                </ListItemButton>
              ))
            }
          </List>
        </Paper>
      )}

      {uploading && <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />}

      {uploadError && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
          {uploadError}
        </Typography>
      )}

      {pendingAttachments.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {pendingAttachments.map((a, idx) => (
            <Chip
              key={idx}
              icon={isImage(a.mimeType) ? <ImageIcon fontSize="small" /> : <InsertDriveFile fontSize="small" />}
              label={`${a.fileName} (${formatBytes(a.fileSize)})`}
              size="small"
              variant="outlined"
              onDelete={() => removeAttachment(idx)}
              deleteIcon={<Close />}
              sx={{ maxWidth: 280 }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
});
