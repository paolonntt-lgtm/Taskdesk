import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  FormatBold, FormatItalic, FormatStrikethrough,
  FormatListBulleted, FormatListNumbered,
} from '@mui/icons-material';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';

export function sanitizeSectionHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

function ToolbarBtn({
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
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
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

interface ClientSectionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function ClientSectionEditor({ value, onChange, placeholder }: ClientSectionEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
    editorProps: {
      attributes: {
        'data-placeholder': placeholder ?? '',
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  React.useEffect(() => {
    if (editor) setTimeout(() => editor.commands.focus(), 50);
  }, [editor]);

  return (
    <Box>
      <Box
        display="flex"
        flexWrap="wrap"
        gap={0.5}
        p={0.75}
        sx={{
          bgcolor: 'grey.50',
          border: '1px solid',
          borderColor: 'divider',
          borderBottom: 0,
          borderRadius: '8px 8px 0 0',
        }}
      >
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')}
          title="Grassetto"
        >
          <FormatBold fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')}
          title="Corsivo"
        >
          <FormatItalic fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive('strike')}
          title="Barrato"
        >
          <FormatStrikethrough fontSize="small" />
        </ToolbarBtn>
        <Box component="span" sx={{ width: '1px', bgcolor: 'divider', mx: 0.25, alignSelf: 'stretch' }} />
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')}
          title="Elenco puntato"
        >
          <FormatListBulleted fontSize="small" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')}
          title="Elenco numerato"
        >
          <FormatListNumbered fontSize="small" />
        </ToolbarBtn>
      </Box>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: '0 0 8px 8px',
          p: 1.5,
          minHeight: 100,
          '& .ProseMirror': {
            outline: 'none',
            minHeight: 80,
            fontSize: '0.875rem',
            lineHeight: 1.6,
            '& p': { mt: 0, mb: 0.5 },
            '& ul, & ol': { pl: 2.5, mt: 0, mb: 0.5 },
            '& s': { textDecoration: 'line-through' },
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
    </Box>
  );
}
