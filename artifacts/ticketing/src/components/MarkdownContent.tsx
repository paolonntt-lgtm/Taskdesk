import ReactMarkdown from 'react-markdown';
import { Box } from '@mui/material';
import { useLocation } from 'wouter';

interface MarkdownContentProps {
  content: string;
}

function preprocessContent(text: string): string {
  // Convert #123 ticket references to markdown links, but not inside existing links or code
  // Uses a negative lookbehind to avoid double-converting
  return text.replace(/(?<!\[)(?<!\()#(\d+)\b/g, '[#$1](/tickets/$1)');
}

function InternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const [, setLocation] = useLocation();
  if (href?.startsWith('/tickets/')) {
    return (
      <Box
        component="a"
        href={href}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          setLocation(href);
        }}
        sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }}
      >
        {children}
      </Box>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
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
      <ReactMarkdown
        components={{
          a: ({ href, children }) => <InternalLink href={href}>{children}</InternalLink>,
        }}
      >
        {preprocessContent(content)}
      </ReactMarkdown>
    </Box>
  );
}
