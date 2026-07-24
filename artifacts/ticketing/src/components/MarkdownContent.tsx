import ReactMarkdown from 'react-markdown';
import { Box } from '@mui/material';
import { useLocation } from 'wouter';

interface MarkdownContentProps {
  content: string;
}

function preprocessContent(text: string): string {
  // Convert @[Name Surname] mentions to links — encode the href so spaces don't break markdown link syntax
  let result = text.replace(/@\[([^\]]+)\]/g, (_, name: string) => `[@${name}](#mention-${encodeURIComponent(name)})`);
  // Convert #123 ticket references to markdown links, but not inside existing links or code
  result = result.replace(/(?<!\[)(?<!\()#(\d+)\b/g, '[#$1](/tickets/$1)');
  // Auto-link bare URLs that are not already inside a markdown link or code span
  // Matches http(s):// URLs not preceded by ]( (already a link) or ` (code)
  result = result.replace(/(?<![`\](\[])https?:\/\/[^\s<>"'`)\]]+/g, (url) => {
    // Trim trailing punctuation that is likely not part of the URL
    const trimmed = url.replace(/[.,;:!?]+$/, '');
    return `[${trimmed}](${trimmed})`;
  });
  return result;
}

function InternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const [, setLocation] = useLocation();
  if (href?.startsWith('#mention-')) {
    return (
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          bgcolor: 'primary.50',
          color: 'primary.700',
          fontWeight: 600,
          fontSize: '0.82rem',
          px: 0.6,
          py: 0.1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.200',
          lineHeight: 1.4,
        }}
      >
        {children}
      </Box>
    );
  }
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
        fontSize: '1rem',
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
        '& ul': { pl: 2.5, my: 0.5, listStyleType: 'disc' },
        '& ol': { pl: 2.5, my: 0.5, listStyleType: 'decimal' },
        '& ul ul': { listStyleType: 'circle' },
        '& ul ul ul': { listStyleType: 'square' },
        '& li': { mb: 0.25, display: 'list-item' },
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
