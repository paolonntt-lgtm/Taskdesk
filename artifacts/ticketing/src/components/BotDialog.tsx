import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Button,
  Avatar, CircularProgress, Divider, Paper, Tooltip, Badge,
} from '@mui/material';
import {
  Send, Close, ConfirmationNumber,
  KeyboardArrowDown, KeyboardArrowUp, DeleteOutline, Fullscreen, FullscreenExit,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useTheme } from '@mui/material/styles';
import { trackEvent } from '../lib/analytics';
import { MarkdownContent } from './MarkdownContent';
import { AlbertAvatarIcon } from './AlbertAvatarIcon';

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

interface SubmitDailyReportAction {
  action: 'submit_daily_report';
  content: string;
}

type BotAction = CreateTicketAction | ViewTicketAction | SubmitDailyReportAction;

interface TeamReportItem {
  id: number;
  date: string;
  authorId: number;
  authorName: string;
  isOwn: boolean;
  location?: string | null;
  isRead: boolean;
}

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
          if (obj.action === 'create_ticket' || obj.action === 'view_ticket' || obj.action === 'submit_daily_report') return obj as BotAction;
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
  botName,
  fallbackActionText,
  onOptionClick,
  onOpenTicket,
  onViewTicket,
  openTicketLabel,
}: {
  msg: Message;
  botName: string;
  fallbackActionText?: string;
  onOptionClick?: (value: string) => void;
  onOpenTicket?: () => void;
  onViewTicket?: (ticketId: number) => void;
  openTicketLabel?: string;
}) {
  const isUser = msg.role === 'user';
  const action = !isUser ? parseActionFromText(msg.content) : null;
  const assistantText = msg.content.replace(/\bTaskBot\b/gi, botName);
  const rawDisplay = action ? stripActionJson(msg.content) : (isUser ? msg.content : assistantText);
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
          <AlbertAvatarIcon size={25} />
        </Avatar>
      )}
      <Box maxWidth="80%">
        {!isUser && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, mb: 0.25, display: 'block' }}>
            {botName}
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
            {isUser ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                {cleanText}
              </Typography>
            ) : (
              <MarkdownContent content={cleanText} onTicketClick={onViewTicket} forceUnorderedLists />
            )}
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
    const session = JSON.parse(raw) as { messages: Message[]; pendingAction: BotAction | null };
    return {
      ...session,
      messages: session.messages.map((message) => message.role === 'assistant'
        ? {
            ...message,
            content: message.content
              .replace(/\bThe Grandpa\b/gi, 'Albert')
              .replace(/\bIl Nonno\b/gi, 'Albert'),
          }
        : message),
    };
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
  const botName = 'Albert';

  const botWelcome = t.bot.welcome;

  const botFallback = lang === 'it'
    ? `Ho preparato ${entityTerm.articleIndef} ${entityTerm.singularLower} basato${entityTerm.articleIndef === 'una' ? 'a' : ''} sul tuo problema.`
    : `I've prepared ${entityTerm.articleIndef} ${entityTerm.singularLower} based on your issue.`;

  // Restore from sessionStorage on first mount; fall back to empty
  const [messages, setMessages] = useState<Message[]>(() => loadSession()?.messages ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<BotAction | null>(() => loadSession()?.pendingAction ?? null);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const minimizedRef = useRef(false); // kept in sync; safe to read inside async closures
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // welcome already shown if we restored a session
  const welcomeShownRef = useRef(messages.length > 0);

  // Daily report state
  const [todayReportSubmitted, setTodayReportSubmitted] = useState<boolean | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  // Report wizard active flag — persisted across turns; server fetches activity on every turn
  const [reportWizardActive, setReportWizardActive] = useState(false);
  const reportWizardActiveRef = useRef(false); // mirror for async closures
  // Location picker for report wizard: populated from org settings on open
  const [orgLocations, setOrgLocations] = useState<string[]>([]);
  const [reportWizardLocation, setReportWizardLocation] = useState<string | null>(null);
  const reportWizardLocationRef = useRef<string | null>(null);
  // Transitional state: user clicked "Fai il report" but still needs to pick a sede
  const [pickingLocation, setPickingLocation] = useState(false);

  // Team reports panel: list of recent colleague reports with read status
  const [teamReports, setTeamReports] = useState<TeamReportItem[] | null>(null);
  const [showTeamReports, setShowTeamReports] = useState(false);
  const [teamReportsLoading, setTeamReportsLoading] = useState(false);

  // Persist to sessionStorage whenever messages or pendingAction change
  useEffect(() => {
    saveSession(messages, pendingAction);
  }, [messages, pendingAction]);

  // ── Core streaming helper ─────────────────────────────────────────────────
  // Streams a bot response for the given fetch body. If `userMsg` is provided,
  // it is prepended to the chat (visible). If null, only the bot reply appears.
  // `onSuccess` is called only after the stream delivers [DONE] successfully.
  const streamBotResponse = async (
    fetchBody: object,
    userMsg: Message | null = null,
    onSuccess?: () => void,
  ): Promise<void> => {
    if (userMsg) setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setPendingAction(null);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    let fullContent = '';
    let streamComplete = false;
    try {
      const res = await fetch('/api/bot/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fetchBody),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: t.bot.errorBot }; return c; });
        if (minimizedRef.current) onBotMessage?.();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { streamComplete = true; break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: fullContent }; return c; });
            }
            if (parsed.error) {
              setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: parsed.error }; return c; });
            }
          } catch {}
        }
      }

      const action = parseActionFromText(fullContent);
      if (action) setPendingAction(action);
      if (minimizedRef.current) onBotMessage?.();
      // Call success callback only when briefing fully delivered
      if (streamComplete) {
        trackEvent('bot_response_received', {
          mode: 'reportMode' in fetchBody && fetchBody.reportMode ? 'daily_report' : 'chat',
        });
        onSuccess?.();
      }
    } catch {
      setMessages((prev) => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: t.bot.errorNetwork }; return c; });
      if (minimizedRef.current) onBotMessage?.();
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Fetch recent organization reports (including the current user's) ─────
  const fetchAndShowTeamReports = async () => {
    setTeamReportsLoading(true);
    try {
      const res = await fetch('/api/daily-reports/recent', { credentials: 'include' });
      const { reports } = await res.json();
      setTeamReports((reports as TeamReportItem[]) ?? []);
      setShowTeamReports(true);
    } catch {
      setTeamReports([]);
      setShowTeamReports(true);
    } finally {
      setTeamReportsLoading(false);
    }
  };

  // ── Single-report briefing: user chose a recent report to read ─────────────
  const sendSingleReportBriefing = async (reportId: number, authorName: string) => {
    if (loading) return;
    setShowTeamReports(false);
    const userMsg: Message = {
      role: 'user',
      content: lang === 'it' ? `📖 Leggi il report di ${authorName}` : `📖 Read ${authorName}'s report`,
    };
    await streamBotResponse(
      { message: '__briefing_single__', history: [], lang, briefingMode: true, briefingReportId: reportId },
      userMsg,
      () => {
        // Mark the selected report read locally for instant UI feedback.
        setTeamReports((prev) => prev ? prev.map((r) => r.id === reportId ? { ...r, isRead: true } : r) : prev);
      },
    );
  };

  // ── Report mode: kick off EOD report wizard ───────────────────────────────
  // Server fetches today's activity; client only sends the reportMode flag +
  // optionally the selected location (validated server-side against org locations).
  const sendReportMode = async (location: string | null) => {
    if (loading) return;
    setPickingLocation(false); // always collapse picker when wizard actually starts
    setReportWizardActive(true);
    reportWizardActiveRef.current = true;
    setReportWizardLocation(location);
    reportWizardLocationRef.current = location;
    const locationLabel = location ? ` — ${location}` : '';
    const userIntroMsg: Message = {
      role: 'user',
      content: lang === 'it'
        ? `📋 Voglio fare il report di oggi${locationLabel}`
        : `📋 I want to submit today's report${locationLabel}`,
    };
    await streamBotResponse(
      { message: '📋 Avvia modalità report', history: [], lang, reportMode: true, ...(location ? { reportLocation: location } : {}) },
      userIntroMsg,
    );
  };

  // Exit report wizard (called on submit or clearChat)
  const exitReportWizard = () => {
    setReportWizardActive(false);
    reportWizardActiveRef.current = false;
    setReportWizardLocation(null);
    reportWizardLocationRef.current = null;
    setPickingLocation(false);
  };

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

  // Reset transient state each time the dialog closes.
  useEffect(() => {
    if (!open) {
      setPickingLocation(false);
    }
  }, [open]);

  // Re-fetch today's report status + org locations every time the dialog opens.
  useEffect(() => {
    if (open) {
      fetch('/api/daily-reports/today-mine', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setTodayReportSubmitted(!!d.submitted))
        .catch(() => setTodayReportSubmitted(false));
      fetch('/api/settings/locations', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setOrgLocations(Array.isArray(d?.value) ? d.value : []))
        .catch(() => setOrgLocations([]));
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
    exitReportWizard();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Keep refs in sync so async closures always read the current value
  useEffect(() => { minimizedRef.current = minimized; }, [minimized]);
  useEffect(() => { reportWizardActiveRef.current = reportWizardActive; }, [reportWizardActive]);
  useEffect(() => { reportWizardLocationRef.current = reportWizardLocation; }, [reportWizardLocation]);

  const handleExpand = () => {
    setMinimized(false);
    minimizedRef.current = false;
    onExpand?.();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendWithText = async (text: string) => {
    if (!text || loading) return;
    const history = messages.map((m) => ({
      role: m.role,
      content: m.role === 'assistant' ? stripActionJson(m.content) : m.content,
    }));
    setInput('');
    // If an EOD report wizard is active, carry forward reportMode + location on every turn
    // so the server re-fetches activity filtered by the chosen sede.
    const loc = reportWizardLocationRef.current;
    const extraBody = reportWizardActiveRef.current
      ? { reportMode: true, ...(loc ? { reportLocation: loc } : {}) }
      : {};
    await streamBotResponse(
      { message: text, history, lang, ...extraBody },
      { role: 'user', content: text },
    );
  };

  const handleSubmitReport = async () => {
    if (pendingAction?.action !== 'submit_daily_report') return;
    const { content } = pendingAction as SubmitDailyReportAction;
    setReportSubmitting(true);
    try {
      const res = await fetch('/api/daily-reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, location: reportWizardLocationRef.current ?? undefined }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        trackEvent('daily_report_submitted', {
          has_location: Boolean(reportWizardLocationRef.current),
        });
        setTodayReportSubmitted(true);
        setPendingAction(null);
        exitReportWizard(); // wizard complete — exit report mode
        const notificationCount = typeof result.notificationCount === 'number'
          ? result.notificationCount
          : 0;
        const confMsg = result.notificationError
          ? (lang === 'it'
            ? '✅ Report pubblicato, ma non è stato possibile creare la notifica in-app. I colleghi possono comunque consultarlo da “Report del team”.'
            : '✅ Report published, but the in-app notification could not be created. Colleagues can still find it under “Team reports”.')
          : notificationCount > 0
            ? (lang === 'it'
              ? `✅ Report pubblicato. Notifica in-app creata per ${notificationCount} ${notificationCount === 1 ? 'collega' : 'colleghi'}.`
              : `✅ Report published. In-app notification created for ${notificationCount} ${notificationCount === 1 ? 'colleague' : 'colleagues'}.`)
            : (lang === 'it'
              ? '✅ Report pubblicato. Nessun altro collaboratore attivo ha le notifiche in-app abilitate; il report resta disponibile in “Report del team”.'
              : '✅ Report published. No other active collaborator has in-app notifications enabled; the report remains available under “Team reports”.');
        setMessages((prev) => [...prev, { role: 'assistant', content: confMsg }]);
      } else {
        const err = lang === 'it' ? 'Errore nel salvataggio del report.' : 'Error saving the report.';
        setMessages((prev) => [...prev, { role: 'assistant', content: err }]);
      }
    } catch {
      const err = lang === 'it' ? 'Errore di rete.' : 'Network error.';
      setMessages((prev) => [...prev, { role: 'assistant', content: err }]);
    } finally {
      setReportSubmitting(false);
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
      trackEvent('bot_ticket_action', { action: 'create' });
      onClose();
    }
  };

  const handleViewTicket = () => {
    if (pendingAction?.action === 'view_ticket') {
      onViewTicket?.(pendingAction.id);
      trackEvent('bot_ticket_action', { action: 'view' });
      onClose();
    }
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        ...(expanded && !minimized
          ? {
              top: { xs: 0, sm: 24 },
              right: { xs: 0, sm: 24 },
              bottom: { xs: 0, sm: 24 },
              left: { xs: 0, sm: 'auto' },
              width: { xs: '100vw', sm: 'min(840px, calc(100vw - 48px))' },
            }
          : {
              bottom: { xs: 12, sm: 24 },
              right: { xs: 12, sm: 24 },
              width: { xs: 'calc(100vw - 24px)', sm: 520 },
            }),
        zIndex: theme.zIndex.modal,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 180ms ease, top 180ms ease, right 180ms ease, bottom 180ms ease, left 180ms ease',
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
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: minimized
            ? 'auto'
            : expanded
              ? { xs: '100dvh', sm: '100%' }
              : { xs: '82dvh', sm: 'min(82dvh, 720px)' },
          maxHeight: minimized
            ? 'none'
            : expanded
              ? { xs: '100dvh', sm: 'none' }
              : { xs: '82dvh', sm: 'min(82dvh, 720px)' },
          borderRadius: expanded && !minimized ? { xs: 0, sm: 3 } : 3,
          transition: 'height 180ms ease, max-height 180ms ease, border-radius 180ms ease',
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
              <AlbertAvatarIcon size={25} />
            </Avatar>
          </Badge>
          <Box flex={1} minWidth={0}>
            <Typography fontWeight={700} fontSize="0.9rem" lineHeight={1.2}>{botName}</Typography>
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
            {!minimized && (
              <Tooltip title={expanded
                ? (lang === 'it' ? 'Riduci finestra' : 'Restore window size')
                : (lang === 'it' ? 'Espandi finestra' : 'Expand window')}>
                <IconButton
                  size="small"
                  aria-label={expanded
                    ? (lang === 'it' ? 'Riduci finestra' : 'Restore window size')
                    : (lang === 'it' ? 'Espandi finestra' : 'Expand window')}
                  data-testid="button-toggle-bot-size"
                  onClick={() => setExpanded((current) => !current)}
                  sx={{ color: 'text.secondary' }}
                >
                  {expanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
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
                    botName={botName}
                    fallbackActionText={botFallback}
                    onOptionClick={isLastAssistant ? (val) => sendWithText(val) : undefined}
                    onOpenTicket={isLastAssistant && !isWelcome && pendingAction?.action !== 'view_ticket' ? () => sendWithText(lang === 'en' ? `open ${entityTerm.articleIndef} ${entityTerm.singularLower}` : `apri ${entityTerm.singularLower}`) : undefined}
                    onViewTicket={onViewTicket}
                    openTicketLabel={lang === 'it' ? `Apri ${entityTerm.singularLower}` : `Open ${entityTerm.articleIndef} ${entityTerm.singularLower}`}
                  />
                );
              })}
              {loading && (
                <Box display="flex" gap={1} alignItems="center" mb={1.5}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}>
                    <AlbertAvatarIcon size={25} />
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

            {/* ── Team reports panel (shown when user clicks "Report del team" or auto-triggered by unread) ── */}
            {showTeamReports && teamReports !== null && (
              <Box sx={{ mx: 2, mt: 1, mb: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 1.5, py: 0.7,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.50',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.67rem' }}>
                    {lang === 'it' ? 'Report recenti' : 'Recent reports'}
                  </Typography>
                  <IconButton size="small" onClick={() => setShowTeamReports(false)} sx={{ p: 0.25 }}>
                    <Close sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                {teamReports.length === 0 ? (
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="caption" color="text.disabled">
                      {lang === 'it' ? 'Nessun report negli ultimi 7 giorni.' : 'No reports in the last 7 days.'}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 168, overflowY: 'auto' }}>
                    {teamReports.map((report) => {
                      const authorLabel = report.isOwn
                        ? (lang === 'it' ? 'Il tuo report' : 'Your report')
                        : report.authorName;
                      const initials = report.isOwn
                        ? (lang === 'it' ? 'TU' : 'YO')
                        : report.authorName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
                      const palette = ['#7C3AED','#0891B2','#059669','#D97706','#DC2626','#9333EA','#0284C7'];
                      const bgColor = palette[Math.abs(report.authorId ?? 0) % palette.length];
                      const dateObj = new Date(report.date);
                      const todayStr = new Date().toDateString();
                      const yestStr = new Date(Date.now() - 86400000).toDateString();
                      const dateLabel = dateObj.toDateString() === todayStr
                        ? (lang === 'it' ? 'Oggi' : 'Today')
                        : dateObj.toDateString() === yestStr
                          ? (lang === 'it' ? 'Ieri' : 'Yesterday')
                          : dateObj.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                      return (
                        <Box
                          key={report.id}
                          component="button"
                          disabled={loading}
                          onClick={() => sendSingleReportBriefing(report.id, report.authorName)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.25,
                            width: '100%', textAlign: 'left', px: 1.5, py: 0.85,
                            border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                            borderBottom: '1px solid', borderColor: 'divider',
                            transition: 'background 0.12s',
                            '&:last-child': { borderBottom: 'none' },
                            '&:hover:not(:disabled)': { bgcolor: 'action.hover' },
                            '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                          }}
                        >
                          <Avatar sx={{ width: 26, height: 26, bgcolor: bgColor, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>
                            {initials}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" fontWeight={700} display="block" noWrap sx={{ fontSize: '0.78rem' }}>
                              {authorLabel}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.67rem' }}>
                              {dateLabel}{report.location ? ` · ${report.location}` : ''}
                            </Typography>
                          </Box>
                          {!report.isRead
                            ? <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                            : <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', flexShrink: 0 }}>✓</Typography>
                          }
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}

            {/* ── Daily report quick-action button ── */}
            {todayReportSubmitted === false && (
              <Box sx={{ px: 2, pt: 1.25, pb: 0 }}>
                {pickingLocation ? (
                  /* Post-click sede picker: shown instead of the button after the user clicks it */
                  <Box>
                    <Box sx={{ fontSize: '0.7rem', color: 'text.disabled', mb: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {lang === 'it' ? 'Per quale sede?' : 'Which location?'}
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {orgLocations.map((loc) => (
                        <Box
                          key={loc}
                          component="button"
                          disabled={loading}
                          onClick={() => { void sendReportMode(loc); }}
                          sx={{
                            px: 1.5, py: 0.5, borderRadius: 10, border: '1px solid', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                            borderColor: 'primary.main', bgcolor: 'transparent', color: 'primary.main',
                            '&:hover:not(:disabled)': { bgcolor: 'primary.main', color: 'white' },
                            '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                          }}
                        >
                          {loc}
                        </Box>
                      ))}
                      <Box
                        component="button"
                        onClick={() => setPickingLocation(false)}
                        sx={{
                          px: 1.5, py: 0.5, borderRadius: 10, border: '1px solid', cursor: 'pointer',
                          fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.15s',
                          borderColor: 'divider', bgcolor: 'transparent', color: 'text.disabled',
                          '&:hover': { borderColor: 'text.secondary', color: 'text.secondary' },
                        }}
                      >
                        ✕
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  /* Normal state: single button, always clickable */
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    disabled={loading}
                    onClick={() => {
                      if (orgLocations.length > 1) {
                        setPickingLocation(true);
                      } else {
                        void sendReportMode(null);
                      }
                    }}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '0.8rem',
                      justifyContent: 'flex-start',
                      gap: 1,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'primary.50' },
                    }}
                  >
                    📋 {lang === 'it' ? 'Fai il report di oggi' : 'Submit today\'s report'}
                  </Button>
                )}
              </Box>
            )}
            {todayReportSubmitted === true && (
              <Box sx={{ px: 2, pt: 1.25, pb: 0 }}>
                <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  ✅ {lang === 'it' ? 'Report già inviato oggi' : 'Report already submitted today'}
                </Typography>
              </Box>
            )}

            {/* ── Report del team button (always visible when not in report wizard) ── */}
            {!reportWizardActive && (
              <Box sx={{ px: 2, pt: 0.75, pb: 0 }}>
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  disabled={loading || teamReportsLoading}
                  onClick={async () => {
                    if (showTeamReports) setShowTeamReports(false);
                    else await fetchAndShowTeamReports();
                  }}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    justifyContent: 'flex-start',
                    gap: 1,
                    color: 'text.secondary',
                    '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                  }}
                >
                  👥 {lang === 'it' ? 'Report recenti' : 'Recent reports'}
                  {teamReportsLoading && (
                    <CircularProgress size={10} sx={{ ml: 'auto' }} />
                  )}
                </Button>
              </Box>
            )}

            {/* ── Submit daily report pending action card ── */}
            {pendingAction?.action === 'submit_daily_report' && (
              <Box
                sx={{
                  mx: 2, mt: 1, mb: 0.5, p: 2, borderRadius: 2,
                  border: '2px solid', borderColor: 'success.main',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.1)' : 'success.50',
                }}
              >
                <Typography variant="body2" fontWeight={600} mb={0.5} color="success.dark">
                  {lang === 'it' ? 'Pronto per la pubblicazione' : 'Ready to publish'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                  {lang === 'it'
                    ? 'Vuoi pubblicare questo report? I colleghi riceveranno una notifica.'
                    : 'Publish this report? Your colleagues will receive a notification.'}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    disabled={reportSubmitting}
                    onClick={handleSubmitReport}
                    sx={{ borderRadius: 2 }}
                  >
                    {reportSubmitting
                      ? (lang === 'it' ? 'Invio...' : 'Sending...')
                      : (lang === 'it' ? 'Pubblica report' : 'Publish report')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="inherit"
                    onClick={() => { setPendingAction(null); /* Keep wizard active — user may want to continue refining */ }}
                    sx={{ borderRadius: 2 }}
                  >
                    {lang === 'it' ? 'Modifica' : 'Edit'}
                  </Button>
                </Box>
              </Box>
            )}

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
