import React, { useRef, useState, useCallback } from 'react';
import {
  Box, IconButton, Tooltip, Divider, LinearProgress, Chip,
  Typography, Paper,
} from '@mui/material';
import {
  FormatBold, FormatItalic, FormatListBulleted, FormatListNumbered,
  Code, AttachFile, InsertLink, Close, InsertDriveFile, Image as ImageIcon,
} from '@mui/icons-material';

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
  const start = textarea.selectionStart;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const alreadyHas = value.slice(lineStart).startsWith(prefix);
  const newValue = alreadyHas
    ? value.slice(0, lineStart) + value.slice(lineStart + prefix.length)
    : value.slice(0, lineStart) + prefix + value.slice(lineStart);
  onChange(newValue);
  setTimeout(() => {
    textarea.focus();
    const offset = alreadyHas ? -prefix.length : prefix.length;
    textarea.setSelectionRange(start + offset, start + offset);
  }, 0);
}

async function requestPresignedUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
  });
  if (!res.ok) throw new Error('Errore nel richiedere URL di upload');
  return res.json();
}

async function uploadToPresignedUrl(file: File, url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) throw new Error('Errore nel caricamento del file');
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

export function RichCommentEditor({
  value,
  onChange,
  placeholder,
  onAttachmentsChange,
  minRows = 3,
}: RichCommentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const action = useCallback((fn: (ta: HTMLTextAreaElement) => void) => {
    if (textareaRef.current) fn(textareaRef.current);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setUploadError(null);
    const errors: string[] = [];
    const toUpload: File[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: tipo file non supportato`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: supera il limite di ${MAX_SIZE_MB} MB`);
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
        const { uploadURL, objectPath } = await requestPresignedUrl(file);
        await uploadToPresignedUrl(file, uploadURL);
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

  return (
    <Box>
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
          <Tooltip title="Grassetto (Ctrl+B)">
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '**', '**', 'testo', onChange)); }}>
              <FormatBold fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Corsivo (Ctrl+I)">
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '*', '*', 'testo', onChange)); }}>
              <FormatItalic fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Codice inline">
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => wrapSelection(ta, '`', '`', 'codice', onChange)); }}>
              <Code fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Elenco puntato">
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => insertLinePrefix(ta, '- ', onChange)); }}>
              <FormatListBulleted fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Elenco numerato">
            <IconButton size="small" onMouseDown={e => { e.preventDefault(); action(ta => insertLinePrefix(ta, '1. ', onChange)); }}>
              <FormatListNumbered fontSize="small" />
            </IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Allega file">
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
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
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
              e.preventDefault();
              action(ta => wrapSelection(ta, '**', '**', 'testo', onChange));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
              e.preventDefault();
              action(ta => wrapSelection(ta, '*', '*', 'testo', onChange));
            }
          }}
        />
      </Paper>

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
}
