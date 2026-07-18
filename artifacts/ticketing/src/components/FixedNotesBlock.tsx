import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Edit, Save, Cancel, FormatBold, FormatItalic, FormatUnderlined,
  FormatListBulleted, FormatListNumbered, Title, StickyNote2,
} from '@mui/icons-material';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import DOMPurify from 'dompurify';
import { useLanguage } from '../contexts/LanguageContext';
import PermissionGateButton from './PermissionGateButton';

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h3', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

interface FixedNotesBlockProps {
  clientId: number;
  initialNotes: string | null | undefined;
  isAdmin: boolean;
  canEditFixed?: boolean;
  title?: string;
  fieldName?: 'notes' | 'notes2';
}

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          borderRadius: 1,
          p: 0.5,
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'primary.50' : 'transparent',
          '&:hover': { bgcolor: active ? 'primary.100' : 'action.hover' },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

export default function FixedNotesBlock({ clientId, initialNotes, isAdmin, canEditFixed, title, fieldName = 'notes' }: FixedNotesBlockProps) {
  const { t } = useLanguage();
  const tc = t.clients;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedHtml, setSavedHtml] = useState<string>(initialNotes ?? '');

  useEffect(() => {
    setSavedHtml(initialNotes ?? '');
  }, [initialNotes]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: savedHtml || '',
    editable: editing,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editing);
    if (editing) {
      editor.commands.setContent(savedHtml || '');
      setTimeout(() => editor.commands.focus(), 50);
    }
  }, [editing, editor]);

  const handleEdit = useCallback(() => {
    setEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setEditing(false);
    if (editor) editor.commands.setContent(savedHtml || '');
  }, [editor, savedHtml]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const html = editor.getHTML();
    const isEmpty = editor.isEmpty;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: isEmpty ? null : html }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedHtml(isEmpty ? '' : html);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [editor, clientId]);

  const isEmpty = !savedHtml || savedHtml === '<p></p>';

  return (
    <Box>
      {/* Block header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={editing ? 1.5 : 1}>
        <Box display="flex" alignItems="center" gap={1}>
          <StickyNote2 fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={600}>
            {title ?? tc.blockFixedNotes}
          </Typography>
          <PermissionGateButton
            permission="edit_fixed_notes"
            sectionLabel={title ?? tc.blockFixedNotes}
          />
        </Box>
        {(isAdmin || canEditFixed) && !editing && (
          <Tooltip title={tc.fixedNotesEdit}>
            <IconButton size="small" onClick={handleEdit}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {editing ? (
        <Box>
          {/* Toolbar */}
          <Box
            display="flex"
            flexWrap="wrap"
            gap={0.5}
            p={0.75}
            mb={0}
            sx={{
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderBottom: 0,
              borderRadius: '8px 8px 0 0',
            }}
          >
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
              title="Bold"
            >
              <FormatBold fontSize="small" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
              title="Italic"
            >
              <FormatItalic fontSize="small" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive('underline')}
              title="Underline"
            >
              <FormatUnderlined fontSize="small" />
            </ToolbarButton>
            <Box
              component="span"
              sx={{ width: '1px', bgcolor: 'divider', mx: 0.25, alignSelf: 'stretch' }}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor?.isActive('heading', { level: 3 })}
              title="Heading"
            >
              <Title fontSize="small" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              title="Bullet list"
            >
              <FormatListBulleted fontSize="small" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              title="Numbered list"
            >
              <FormatListNumbered fontSize="small" />
            </ToolbarButton>
          </Box>

          {/* Editor area */}
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: '0 0 8px 8px',
              p: 1.5,
              minHeight: 120,
              '& .ProseMirror': {
                outline: 'none',
                minHeight: 100,
                fontSize: '0.875rem',
                lineHeight: 1.6,
                '& p': { mt: 0, mb: 0.5 },
                '& ul, & ol': { pl: 2.5, mt: 0, mb: 0.5 },
                '& h3': { fontSize: '1rem', fontWeight: 600, mt: 1, mb: 0.5 },
                '& p.is-editor-empty:first-child::before': {
                  content: 'attr(data-placeholder)',
                  color: 'text.disabled',
                  pointerEvents: 'none',
                  height: 0,
                  float: 'left',
                },
              },
            }}
          >
            <EditorContent editor={editor} />
          </Box>

          {/* Save / Cancel */}
          <Box display="flex" gap={1} mt={1.5} justifyContent="flex-end">
            <Button
              size="small"
              variant="outlined"
              startIcon={<Cancel />}
              onClick={handleCancel}
              disabled={saving}
            >
              {tc.fixedNotesCancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? tc.fixedNotesSaving : tc.fixedNotesSave}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          {isEmpty ? (
            <Typography
              variant="body2"
              color="text.disabled"
              fontStyle="italic"
              sx={{ py: 1 }}
            >
              {(isAdmin || canEditFixed) ? tc.fixedNotesPlaceholderAdmin : tc.fixedNotesPlaceholderView}
            </Typography>
          ) : (
            <Box
              sx={{
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'text.primary',
                '& p': { mt: 0, mb: 0.5 },
                '& ul, & ol': { pl: 2.5, mt: 0, mb: 0.5 },
                '& h3': { fontSize: '1rem', fontWeight: 600, mt: 1, mb: 0.5 },
                '& strong': { fontWeight: 700 },
                '& em': { fontStyle: 'italic' },
                '& u': { textDecoration: 'underline' },
              }}
              dangerouslySetInnerHTML={{ __html: sanitize(savedHtml) }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
