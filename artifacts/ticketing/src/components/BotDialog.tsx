import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Button,
  Avatar, CircularProgress, Divider, Paper, Tooltip, Badge,
} from '@mui/material';
import {
  Send, SmartToy, Close, ConfirmationNumber,
  KeyboardArrowDown, KeyboardArrowUp, DeleteOutline,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useTheme } from '@mui/material/styles';

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
  unreadCount?: number;
  onClose: () => void;
  onExpand?: () => void;
  onBotMessage?: () => void;
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
              bgcolor: isUser ? 'primary.main' : 'action.hover',
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
                  borderRadius: 3,
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  py: 0.4,
                  px: 1.25,
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

const BOT_SESSION_KEY = 'td_bot_session';

export function clearBotSession() {
  try { sessionStorage.removeItem(BOT_SESSION_KEY); } catch { /* ignore */ }
}

function loadSession(): { messages: Message[]; pendingAction: BotAction | null } | null {
  try {
    const raw = sessionStorage.getItem(BOT_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { messages: Message[]; pendingAction: BotAction | null };
  } catch { return null; }
}

function saveSession(messages: Message[], pendingAction: BotAction | null) {
  try {
    sessionStorage.setItem(BOT_SESSION_KEY, JSON.stringify({ messages, pendingAction }));
  } catch { /* ignore */ }
}

export default function BotDialog({ open, unreadCount = 0, onClose, onExpand, onBotMessage, onCreateTicket, onViewTicket }: BotDialogProps) {
  const { t, lang } = useLanguage();
  const entityTerm = useEntityTerm();
  const theme = useTheme();

  const botWelcome = lang === 'it'
    ? `Ciao! Sono TaskBot, il tuo assistente. Descrivi il problema che stai riscontrando e cercherò di aiutarti a risolverlo prima di aprire ${entityTerm.articleIndef} ${entityTerm.singularLower}.`
    : `Hi! I'm TaskBot, your assistant. Describe the issue you're experiencing and I'll try to help you resolve it before opening ${entityTerm.articleIndef} ${entityTerm.singularLower}.`;

  const botFallback = lang === 'it'
    ? `Ho preparato ${entityTerm.articleIndef} ${entityTerm.singularLower} basato${entityTerm.articleIndef === 'una' ? 'a' : ''} sul tuo problema.`
    : `I've prepared ${entityTerm.articleIndef} ${entityTerm.singularLower} based on your issue.`;

  // Restore from sessionStorage on first mount; fall back to empty
  const [messages, setMessages] = useState<Message[]>(() => loadSession()?.messages ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<BotAction | null>(() => loadSession()?.pendingAction ?? null);
  const [minimized, setMinimized] = useState(false);
  const minimizedRef = useRef(false); // kept in sync; safe to read inside async closures
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // welcome already shown if we restored a session
  const welcomeShownRef = useRef(messages.length > 0);

  // Persist to sessionStorage whenever messages or pendingAction change
  useEffect(() => {
    saveSession(messages, pendingAction);
  }, [messages, pendingAction]);

  // Show welcome message only on the very first open (no saved session)
  useEffect(() => {
    if (open && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      setMessages([{ role: 'assistant', content: botWelcome }]);
    }
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Expand automatically when reopened after being minimized
  useEffect(() => {
    if (open && minimized) {
      setMinimized(false);
      onExpand?.();
    }
  }, [open]);

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, minimized]);

  const clearChat = () => {
    welcomeShownRef.current = true;
    const welcome = [{ role: 'assistant' as const, content: botWelcome }];
    setMessages(welcome);
    setPendingAction(null);
    saveSession(welcome, null);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Keep ref in sync so async closures always read the current value
  useEffect(() => { minimizedRef.current = minimized; }, [minimized]);

  const handleExpand = () => {
    setMinimized(false);
    minimizedRef.current = false;
    onExpand?.();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

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
        if (minimizedRef.current) onBotMessage?.();
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
      if (minimizedRef.current) onBotMessage?.();
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t.bot.errorNetwork }]);
      if (minimizedRef.current) onBotMessage?.();
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

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
        width: { xs: 'calc(100vw - 32px)', sm: 380 },
        zIndex: theme.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        // subtle entrance animation
        animation: 'botSlideIn 0.2s ease-out',
        '@keyframes botSlideIn': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Paper
        elevation={12}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: minimized ? 'auto' : { xs: '70vh', sm: 520 },
          maxHeight: minimized ? 'auto' : { xs: '70vh', sm: 520 },
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* ── Header ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.25,
            borderBottom: minimized ? 'none' : '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => {
            if (minimized) {
              handleExpand();
            } else {
              setMinimized(true);
              minimizedRef.current = true;
            }
          }}
        >
          <Badge
            badgeContent={minimized ? unreadCount : 0}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
          >
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, flexShrink: 0 }}>
              <SmartToy sx={{ fontSize: 18 }} />
            </Avatar>
          </Badge>
          <Box flex={1} minWidth={0}>
            <Typography fontWeight={700} fontSize="0.9rem" lineHeight={1.2}>TaskBot</Typography>
            {minimized && unreadCount > 0 ? (
              <Typography variant="caption" color="primary.main" fontWeight={600} noWrap display="block">
                {unreadCount === 1
                  ? (lang === 'it' ? '1 nuovo messaggio' : '1 new message')
                  : (lang === 'it' ? `${unreadCount} nuovi messaggi` : `${unreadCount} new messages`)}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {lang === 'it' ? `Assistente per apertura ${entityTerm.singularLower}` : `${entityTerm.singular} assistant`}
              </Typography>
            )}
          </Box>
          {/* header actions — stop click propagation so they don't toggle minimize */}
          <Box display="flex" alignItems="center" gap={0.25} onClick={(e) => e.stopPropagation()}>
            {!minimized && (
              <Tooltip title={lang === 'it' ? 'Nuova conversazione' : 'New conversation'}>
                <IconButton size="small" onClick={clearChat} sx={{ color: 'text.secondary' }}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={minimized ? (lang === 'it' ? 'Espandi' : 'Expand') : (lang === 'it' ? 'Riduci' : 'Minimize')}>
              <IconButton
                size="small"
                onClick={() => {
                  if (minimized) {
                    handleExpand();
                  } else {
                    setMinimized(true);
                    minimizedRef.current = true;
                  }
                }}
                sx={{ color: 'text.secondary' }}
              >
                {minimized ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={lang === 'it' ? 'Chiudi' : 'Close'}>
              <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── Body (hidden when minimized) ── */}
        {!minimized && (
          <>
            <Box sx={{ flex: 1, overflowY: 'auto', py: 2, px: 2 }}>
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
                  <Box sx={{ px: 1.75, py: 1.25, borderRadius: '4px 18px 18px 18px', bgcolor: 'action.hover' }}>
                    <CircularProgress size={14} />
                  </Box>
                </Box>
              )}
              {pendingAction?.action === 'create_ticket' && (
                <Box
                  sx={{
                    mt: 1, mb: 1.5, p: 2, borderRadius: 2,
                    border: '2px solid', borderColor: 'primary.main',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.1)' : 'primary.50',
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
                    <Button variant="contained" size="small" startIcon={<ConfirmationNumber />}
                      onClick={handleCreateTicket} sx={{ borderRadius: 2 }}>
                      {lang === 'it' ? `Crea ${entityTerm.singularLower}` : `Create ${entityTerm.singularLower}`}
                    </Button>
                    <Button variant="outlined" size="small" color="inherit"
                      onClick={() => setPendingAction(null)} sx={{ borderRadius: 2 }}>
                      {t.bot.continueChat}
                    </Button>
                  </Box>
                </Box>
              )}
              {pendingAction?.action === 'view_ticket' && (
                <Box
                  sx={{
                    mt: 1, mb: 1.5, p: 2, borderRadius: 2,
                    border: '2px solid', borderColor: 'warning.main',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(245,158,11,0.1)' : 'warning.50',
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
                    <Button variant="contained" size="small" color="warning"
                      startIcon={<ConfirmationNumber />} onClick={handleViewTicket} sx={{ borderRadius: 2 }}>
                      {lang === 'it' ? `Vai al ${entityTerm.singularLower}` : `Go to ${entityTerm.singularLower}`}
                    </Button>
                    <Button variant="outlined" size="small" color="inherit"
                      onClick={() => setPendingAction(null)} sx={{ borderRadius: 2 }}>
                      {t.bot.continueChat}
                    </Button>
                  </Box>
                </Box>
              )}
              <div ref={bottomRef} />
            </Box>

            <Divider />
            <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <IconButton
                color="primary"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                sx={{
                  bgcolor: 'primary.main', color: 'white', flexShrink: 0,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                  borderRadius: 2,
                }}
              >
                <Send sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
