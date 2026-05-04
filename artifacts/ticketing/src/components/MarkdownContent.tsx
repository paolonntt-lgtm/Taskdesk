import ReactMarkdown from 'react-markdown';
import { Box } from '@mui/material';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <Box
      sx={{
        fontSize: '0.875rem',
        lineHeight: 1.6,
        '& p': { m: 0, mb: 0.5 },
        '& p:last-child': { mb: 0 },
        '& strong': { fontWeight: 700 },
        '& em': { fontStyle: 'italic' },
        '& code': {
          fontFamily: 'monospace',
          bgcolor: 'grey.100',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          fontSize: '0.8rem',
        },
        '& ul, & ol': { pl: 2.5, my: 0.5 },
        '& li': { mb: 0.25 },
        '& a': { color: 'primary.main' },
        '& pre': {
          bgcolor: 'grey.100',
          p: 1,
          borderRadius: 1,
          overflowX: 'auto',
          my: 0.5,
          '& code': { bgcolor: 'transparent', px: 0, py: 0 },
        },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'grey.300',
          pl: 1.5,
          ml: 0,
          color: 'text.secondary',
        },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
}
