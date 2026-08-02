import ReactMarkdown from 'react-markdown';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLocation } from 'wouter';

interface MarkdownContentProps {
  content: string;
}

// Matches descriptions/comments injected by the inbound email pipeline
const EMAIL_HEADER_RE = /^[\u{1F4E7}\u{1F510}]/u; // 📧 or 🔏
const EMAIL_SEPARATOR = '\n\n---\n\n';

/**
 * Split email-originated content into [header, body].
 * Returns null when the content was not created by the email pipeline.
 */
function splitEmailContent(text: string): { header: string; body: string } | null {
  if (!EMAIL_HEADER_RE.test(text)) return null;
  const sepIdx = text.indexOf(EMAIL_SEPARATOR);
  if (sepIdx === -1) return null;
  return {
    header: text.slice(0, sepIdx).trim(),
    body: text.slice(sepIdx + EMAIL_SEPARATOR.length),
  };
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
        sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline', wordBreak: 'break-word' }}
      >
        {children}
      </Box>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {children}
    </a>
  );
}

const mdComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <InternalLink href={href}>{children}</InternalLink>
  ),
};

const baseSx = {
  fontSize: '0.9375rem',
  lineHeight: 1.65,
  wordBreak: 'break-word' as const,
  overflowWrap: 'anywhere' as const,
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
  '& a': { color: 'primary.main', wordBreak: 'break-word', overflowWrap: 'anywhere' },
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
  '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 1.5 },
};

// Slightly more generous paragraph spacing for plain-text email bodies
const emailBodySx = {
  ...baseSx,
  '& p': { m: 0, mb: 1 },
  '& p:last-child': { mb: 0 },
};

export function MarkdownContent({ content }: MarkdownContentProps) {
  const emailParts = splitEmailContent(content);

  if (emailParts) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Styled callout for the email sender header */}
        <Box
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            px: 1.25,
            py: 0.875,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.07),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.18),
            fontSize: '0.82rem',
            color: theme.palette.primary.dark,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          })}
        >
          <Box sx={{ ...baseSx, fontSize: '0.82rem', '& p': { m: 0 }, '& strong': { fontWeight: 600 } }}>
            <ReactMarkdown components={mdComponents as any}>
              {preprocessContent(emailParts.header)}
            </ReactMarkdown>
          </Box>
        </Box>

        {/* Email body */}
        <Box sx={emailBodySx}>
          <ReactMarkdown components={mdComponents as any}>
            {preprocessContent(emailParts.body)}
          </ReactMarkdown>
        </Box>
      </Box>
    );
  }

  // Regular (non-email) content
  return (
    <Box sx={baseSx}>
      <ReactMarkdown components={mdComponents as any}>
        {preprocessContent(content)}
      </ReactMarkdown>
    </Box>
  );
}
