import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, IconButton, Button,
  Avatar, CircularProgress, Divider,
} from '@mui/material';
import {
  Send, SmartToy, Close, ConfirmationNumber,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CreateTicketAction {
  action: 'create_ticket';
  title: string;
  description: string;
  category?: string;
  resource?: string;
  location?: string;
}

interface ViewTicketAction {
  action: 'view_ticket';
  id: number;
  title: string;
  date?: string;
}

type BotAction = CreateTicketAction | ViewTicketAction;

interface ParsedOption {
  label: string;
  value: string;
}

interface BotDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateTicket: (title: string, description: string, category?: string, resource?: string, location?: string) => void;
  onViewTicket?: (id: number) => void;
}

function parseActionFromText(text: string): BotAction | null {
  const start = text.indexOf('{"action"');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1));
          if (obj.action === 'create_ticket' || obj.action === 'view_ticket') return obj as BotAction;
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function stripActionJson(text: string): string {
  const start = text.indexOf('{"action"');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return (text.slice(0, start) + text.slice(i + 1)).trim();
      }
    }
  }
  return text;
}

// Detect lines like "1 - Apri ticket  2 - Ho bisogno di altro  3 - Risolto ✓"
// or              "1 - No  2 - Già provato  3 - Risolto ✓"
const OPTIONS_RE = /\b1\s*-\s*(.+?)\s{2,}2\s*-\s*(.+?)\s{2,}3\s*-\s*(.+?)(?:\s*)(?:\n|$)/m;

function parseOptions(text: string): ParsedOption[] | null {
  const match = text.match(OPTIONS_RE);
  if (!match) return null;
  return [
    { label: match[1].trim(), value: '1' },
    { label: match[2].trim(), value: '2' },
    { label: match[3].trim(), value: '3' },
  ];
}

function stripOptions(text: string): string {
  return text.replace(OPTIONS_RE, '').trim();
}

function MessageBubble({
  msg,
  fallbackActionText,
  onOptionClick,
  onOpenTicket,
  openTicketLabel,
}: {
  msg: Message;
  fallbackActionText?: string;
  onOptionClick?: (value: string) => void;
  onOpenTicket?: () => void;
  openTicketLabel?: string;
}) {
  const isUser = msg.role === 'user';
  const action = !isUser ? parseActionFromText(msg.content) : null;
  const rawDisplay = action ? stripActionJson(msg.content) : msg.content;
  const displayText = rawDisplay || (action ? (fallbackActionText ?? '') : '');

  const options = !isUser && onOptionClick ? parseOptions(displayText) : null;
  const cleanText = options ? stripOptions(displayText) : displayText;

  return (
    <Box
      display="flex"
      flexDirection={isUser ? 'row-reverse' : 'row'}
      gap={1}
      mb={1.5}
      alignItems="flex-end"
    >
      {!isUser && (
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0, mb: 0.5 }}>
          <SmartToy sx={{ fontSize: 18 }} />
        </Avatar>
      )}
      <Box maxWidth="80%">
        {!isUser && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, mb: 0.25, display: 'block' }}>
            TaskBot
          </Typography>
        )}
        {cleanText ? (
          <Box
            sx={{
              px: 1.75,
              py: 1.25,
              borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              bgcolor: isUser ? 'primary.main' : 'grey.100',
              color: isUser ? 'primary.contrastText' : 'text.primary',
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
              {cleanText}
            </Typography>
          </Box>
        ) : null}
        {(options || onOpenTicket) && (
          <Box display="flex" gap={1} flexWrap="wrap" mt={1} ml={0.5} alignItems="center">
            {options && onOptionClick && options.map((opt) => (
              <Button
                key={opt.value}
                variant="outlined"
                size="small"
                onClick={() => onOptionClick(opt.value)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  py: 0.5,
                  px: 1.5,
                  borderColor: 'divider',
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'primary.50' },
                }}
              >
                {opt.label}
              </Button>
            ))}
            {onOpenTicket && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ConfirmationNumber sx={{ fontSize: '0.9rem !important' }} />}
                onClick={onOpenTicket}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  py: 0.5,
                  px: 1.5,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  bgcolor: 'primary.50',
                  '&:hover': { bgcolor: 'primary.100', borderColor: 'primary.dark' },
                }}
              >
                {openTicketLabel}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function BotDialog({ open, onClose, onCreateTicket, onViewTicket }: BotDialogProps) {
  const { t, lang } = useLanguage();
  const entityTerm = useEntityTerm();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<BotAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const botWelcome = lang === 'it'
    ? `Ciao! Sono TaskBot, il tuo assistente. Descrivi il problema che stai riscontrando e cercherò di aiutarti a risolverlo prima di aprire ${entityTerm.articleIndef} ${entityTerm.singularLower}.`
    : `Hi! I'm TaskBot, your assistant. Describe the issue you're experiencing and I'll try to help you resolve it before opening ${entityTerm.articleIndef} ${entityTerm.singularLower}.`;

  const botFallback = lang === 'it'
    ? `Ho preparato ${entityTerm.articleIndef} ${entityTerm.singularLower} basato${entityTerm.articleIndef === 'una' ? 'a' : ''} sul tuo problema.`
    : `I've prepared ${entityTerm.articleIndef} ${entityTerm.singularLower} based on your issue.`;

  useEffect(() => {
    if (open) {
      setMessages([{
        role: 'assistant',
        content: botWelcome,
      }]);
      setPendingAction(null);
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendWithText = async (text: string) => {
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = messages.map((m) => ({
      role: m.role,
      content: m.role === 'assistant' ? stripActionJson(m.content) : m.content,
    }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPendingAction(null);


    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, lang }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: 'assistant', content: t.bot.errorBot }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: fullContent };
                return copy;
              });
            }
            if (parsed.error) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: parsed.error };
                return copy;
              });
            }
          } catch {}
        }
      }

      const action = parseActionFromText(fullContent);
      if (action) setPendingAction(action);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t.bot.errorNetwork }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (text) sendWithText(text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCreateTicket = () => {
    if (pendingAction?.action === 'create_ticket') {
      onCreateTicket(pendingAction.title, pendingAction.description, pendingAction.category, pendingAction.resource, pendingAction.location);
      onClose();
    }
  };

  const handleViewTicket = () => {
    if (pendingAction?.action === 'view_ticket') {
      onViewTicket?.(pendingAction.id);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: { xs: '90vh', sm: 580 }, display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <SmartToy sx={{ fontSize: 20 }} />
        </Avatar>
        <Box flex={1}>
          <Typography fontWeight={700} lineHeight={1.2}>TaskBot</Typography>
          <Typography variant="caption" color="text.secondary">
            {lang === 'it' ? `Assistente per apertura ${entityTerm.singularLower}` : `${entityTerm.singular} assistant`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, overflowY: 'auto', py: 2, px: 2 }}>
        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant' && !loading && pendingAction?.action !== 'create_ticket';
          const isWelcome = i === 0;
          return (
            <MessageBubble
              key={i}
              msg={msg}
              fallbackActionText={botFallback}
              onOptionClick={isLastAssistant ? (val) => sendWithText(val) : undefined}
              onOpenTicket={isLastAssistant && !isWelcome && pendingAction?.action !== 'view_ticket' ? () => sendWithText(lang === 'en' ? `open ${entityTerm.articleIndef} ${entityTerm.singularLower}` : `apri ${entityTerm.singularLower}`) : undefined}
              openTicketLabel={lang === 'it' ? `Apri ${entityTerm.singularLower}` : `Open ${entityTerm.articleIndef} ${entityTerm.singularLower}`}
            />
          );
        })}
        {loading && (
          <Box display="flex" gap={1} alignItems="center" mb={1.5}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}>
              <SmartToy sx={{ fontSize: 18 }} />
            </Avatar>
            <Box sx={{ px: 1.75, py: 1.25, borderRadius: '4px 18px 18px 18px', bgcolor: 'grey.100' }}>
              <CircularProgress size={14} />
            </Box>
          </Box>
        )}
        {pendingAction?.action === 'create_ticket' && (
          <Box
            sx={{
              mt: 1,
              mb: 1.5,
              p: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: 'primary.main',
              bgcolor: 'primary.50',
            }}
          >
            <Typography variant="body2" fontWeight={600} mb={0.5} color="primary.main">
              {lang === 'it'
                ? `Vuoi creare ${entityTerm.articleIndef} ${entityTerm.singularLower} per questo problema?`
                : `Would you like to create ${entityTerm.articleIndef} ${entityTerm.singularLower} for this issue?`}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              {lang === 'it'
                ? `Il/La ${entityTerm.singularLower} verrà pre-compilato/a con le informazioni della chat.`
                : `The ${entityTerm.singularLower} will be pre-filled with information from this chat.`}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                startIcon={<ConfirmationNumber />}
                onClick={handleCreateTicket}
                sx={{ borderRadius: 2 }}
              >
                {lang === 'it' ? `Crea ${entityTerm.singularLower}` : `Create ${entityTerm.singularLower}`}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                onClick={() => setPendingAction(null)}
                sx={{ borderRadius: 2 }}
              >
                {t.bot.continueChat}
              </Button>
            </Box>
          </Box>
        )}
        {pendingAction?.action === 'view_ticket' && (
          <Box
            sx={{
              mt: 1,
              mb: 1.5,
              p: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: 'warning.main',
              bgcolor: 'warning.50',
            }}
          >
            <Typography variant="body2" fontWeight={600} mb={0.25} color="warning.dark">
              {lang === 'it'
                ? `Esiste già ${entityTerm.articleIndef} ${entityTerm.singularLower} aperto/a su questo problema:`
                : `There is already an open ${entityTerm.singularLower} for this issue:`}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              «{pendingAction.title}»{pendingAction.date ? ` — ${pendingAction.date}` : ''}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                color="warning"
                startIcon={<ConfirmationNumber />}
                onClick={handleViewTicket}
                sx={{ borderRadius: 2 }}
              >
                {lang === 'it' ? `Vai al ${entityTerm.singularLower}` : `Go to ${entityTerm.singularLower}`}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                onClick={() => setPendingAction(null)}
                sx={{ borderRadius: 2 }}
              >
                {t.bot.continueChat}
              </Button>
            </Box>
          </Box>
        )}
        <div ref={bottomRef} />
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          multiline
          maxRows={3}
          placeholder={t.bot.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 3 },
          }}
        />
        <IconButton
          color="primary"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'grey.200', color: 'grey.400' }, borderRadius: 2, flexShrink: 0 }}
        >
          <Send sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogActions>
    </Dialog>
  );
}
