import React, { useState, useCallback, useEffect } from 'react';
import { ReactGridLayout as GridLayout, WidthProvider } from 'react-grid-layout/legacy';
import type { LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Box, Card, CardContent, Typography, CircularProgress,
  Chip, Button, Avatar, useMediaQuery, useTheme, Divider,
  IconButton, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Checkbox, ListItemText, TextField, Alert,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  FolderOpen as OpenIcon,
  CheckCircle as ResolvedIcon,
  PriorityHigh as UrgentIcon,
  Warning as OverdueIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Close as CloseIcon,
  DragIndicator as DragIcon,
  RestartAlt as ResetIcon,
  Email as EmailIcon,
  AssignmentInd as AssignedIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  ErrorOutline as OverdueListIcon,
  FolderOpen as AllOpenIcon,
  BarChart as WorkloadIcon,
  NoteAlt as ClientNotesIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Category as CategoryIcon,
  FilterList as FilterListIcon,
  PeopleAlt as PeopleAltIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useGetDashboardStats, useGetMyTickets, useGetDueSoonTickets,
  useGetRecentTickets, useGetStatsByStatus, useGetStatsByCategory,
  useGetStatsByLocation, useGetStatsByPriority, useGetStatsByAssignee,
  useGetTicketTrend, useListAllClientNotes,
} from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTicketStatuses } from '../hooks/useTicketStatuses';
import { useEntityTerm } from '../hooks/useEntityTerm';

const ReactGridLayout = WidthProvider(GridLayout);

const CHART_COLORS = ['#1976d2', '#ed6c02', '#2e7d32', '#9c27b0', '#d32f2f', '#0288d1'];
const POLL_MS = 120_000;
const CHART_OPTS = { query: { staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false } as any };

// ── WIDGET SETTINGS STORAGE ────────────────────────────────────────────────

const SETTINGS_KEY = 'td_dashboard_settings_v1';

type AllWidgetSettings = Record<string, Record<string, unknown>>;

const WidgetSettingsContext = React.createContext<{
  all: AllWidgetSettings;
  set: (widgetId: string, s: Record<string, unknown>) => void;
}>({ all: {}, set: () => {} });

function WidgetSettingsProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = React.useState<AllWidgetSettings>(() => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as AllWidgetSettings; }
    catch { return {}; }
  });
  const set = React.useCallback((widgetId: string, s: Record<string, unknown>) => {
    setAll((prev) => {
      const next = { ...prev, [widgetId]: s };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return (
    <WidgetSettingsContext.Provider value={{ all, set }}>
      {children}
    </WidgetSettingsContext.Provider>
  );
}

function useWidgetSettings<T extends Record<string, unknown>>(widgetId: string, defaults: T): [T, (s: T) => void] {
  const ctx = React.useContext(WidgetSettingsContext);
  const saved = ctx.all[widgetId];
  const settings = (saved ? { ...defaults, ...saved } : defaults) as T;
  const setFn = React.useCallback((s: T) => ctx.set(widgetId, s as Record<string, unknown>), [ctx, widgetId]);
  return [settings, setFn];
}

const WidgetCustomNameContext = React.createContext('');

// ── TRIAL BANNER ──────────────────────────────────────────────────────────

function TrialBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user || user.role !== 'admin' || !user.trialEndsAt || user.stripeSubscriptionId) {
    return null;
  }

  const now = new Date();
  const trialEnd = new Date(user.trialEndsAt);
  const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  let severity: 'info' | 'warning' | 'error' = 'info';
  let message: string;

  if (daysLeft <= 0) {
    // Defensive fallback: normally expired-trial admins are redirected to /billing before reaching dashboard
    severity = 'error';
    message = t.trialBanner.trialExpired;
  } else if (daysLeft <= 3) {
    severity = 'warning';
    const isToday = now.toDateString() === trialEnd.toDateString();
    message = isToday ? t.trialBanner.trialExpiresToday : t.trialBanner.trialDays(daysLeft);
  } else {
    severity = 'info';
    message = t.trialBanner.trialDays(daysLeft);
  }

  return (
    <Alert
      severity={severity}
      sx={{ mb: 2, borderRadius: 2 }}
      action={
        <Button
          component={Link}
          href="/billing"
          color="inherit"
          size="small"
          variant="outlined"
          sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.75rem' }}
        >
          {t.trialBanner.ctaBilling}
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

const FEED_SETTINGS_DEFAULTS = {
  statusFilter: [] as string[],
  priorityFilter: [] as string[],
  categoryFilter: [] as string[],
  colorByStatus: false,
  maxItems: '10',
};
type FeedSettings = typeof FEED_SETTINGS_DEFAULTS;

const CHART_SETTINGS_DEFAULTS = { days: '30' };
type ChartSettings = typeof CHART_SETTINGS_DEFAULTS;

// ── EXPORTS used by other pages ───────────────────────────────────────────

export function getStatusColor(status: string) {
  switch (status) {
    case 'open': return 'primary';
    case 'waiting': return 'secondary';
    case 'resolved': return 'success';
    case 'closed': return 'default';
    default: return 'default';
  }
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'low': return 'info';
    case 'medium': return 'warning';
    case 'high': return 'error';
    case 'urgent': return 'error';
    default: return 'default';
  }
}

// ── STAT CARD ─────────────────────────────────────────────────────────────

function StatCard({
  title, value, color, bgColor, icon, href,
}: {
  title: string; value: number; color: string; bgColor: string;
  icon: React.ReactNode; href?: string;
}) {
  const inner = (
    <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography
            color="text.secondary" variant="caption" display="block"
            fontWeight={500} mb={0.5} fontSize={{ xs: '0.65rem', sm: '0.75rem' }}
            textTransform="uppercase" letterSpacing={0.5}
          >
            {title}
          </Typography>
          <Typography
            component="div"
            sx={{ color, fontWeight: 'bold', fontSize: { xs: '1.8rem', sm: '2.8rem' }, lineHeight: 1 }}
          >
            {value}
          </Typography>
        </Box>
        <Box sx={{
          width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 },
          borderRadius: 2, bgcolor: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color,
        }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  );
  if (href) {
    return (
      <Card component={Link} href={href} sx={{
        height: '100%', display: 'block', textDecoration: 'none',
        transition: 'box-shadow 0.15s, transform 0.15s', cursor: 'pointer',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}>
        {inner}
      </Card>
    );
  }
  return <Card sx={{ height: '100%' }}>{inner}</Card>;
}

// ── TICKET ROW ────────────────────────────────────────────────────────────

type TicketRow = {
  id: number; title: string; status: string; priority: string;
  category?: string | null; dueAt?: string | null; ticketNumber?: number | null;
  inboundChannelId?: number | null;
  checklistCount?: number | null; checklistTotal?: number | null; checklistChecked?: number | null;
};

function getDueBadge(dueAt: string, t: any): { label: string; color: 'error' | 'warning' } {
  const due = new Date(dueAt);
  const now = new Date();
  // Use local calendar days to avoid UTC-boundary artefacts (e.g. midnight UTC ≠ midnight local)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((dueDay - todayDay) / 86400000);
  if (diffDays < 0) return { label: t.dashboard.overdueLabel, color: 'error' };
  if (diffDays === 0) return { label: t.dashboard.dueToday, color: 'error' };
  if (diffDays === 1) return { label: t.dashboard.dueTomorrow, color: 'warning' };
  return { label: `${diffDays} ${t.dashboard.dueInDays}`, color: 'warning' };
}

function TicketRowItem({ ticket, showDueBadge = false, colorByStatus = false }: { ticket: TicketRow; showDueBadge?: boolean; colorByStatus?: boolean }) {
  const { t, lang } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dueBadge = showDueBadge && ticket.dueAt ? getDueBadge(ticket.dueAt, t) : null;

  const dueAvatarContent: { line1: string; line2: string | null } | null = (() => {
    if (!showDueBadge || !ticket.dueAt) return null;
    const due = new Date(ticket.dueAt);
    const now = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((dueDay - todayDay) / 86400000);
    const isMidnight = due.getHours() === 0 && due.getMinutes() === 0;
    const locale = lang === 'it' ? 'it-IT' : 'en-US';
    const dayAbbr = due.toLocaleDateString(locale, { weekday: 'short' });
    const timeStr = due.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isMidnight) return { line1: dayAbbr, line2: null };
    if (diffDays === 0) return { line1: timeStr, line2: null };
    return { line1: dayAbbr, line2: timeStr };
  })();

  const dueAvatarColors = dueBadge?.color === 'error'
    ? { bg: '#fee2e2', color: '#dc2626' }
    : dueBadge?.color === 'warning'
    ? { bg: '#ffedd5', color: '#ea580c' }
    : null;
  const { getLabelForKey, getColorForKey } = useTicketStatuses();

  const rowBg = colorByStatus
    ? ticket.status === 'open' ? (theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.05)')
      : ticket.status === 'waiting' ? (theme.palette.mode === 'dark' ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)')
      : ticket.status === 'resolved' ? (theme.palette.mode === 'dark' ? 'rgba(5,150,105,0.08)' : 'rgba(5,150,105,0.05)')
      : undefined
    : undefined;

  return (
    <Box component={Link} href={`/tickets/${ticket.id}?from=dashboard`} sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: { xs: 1.5, sm: 2 }, py: { xs: 1, sm: 1.25 },
      textDecoration: 'none', color: 'inherit', cursor: 'pointer',
      '&:hover': { bgcolor: 'action.hover' }, overflow: 'hidden',
      ...(rowBg ? { bgcolor: rowBg } : {}),
    }}>
      {!isMobile && (
        dueAvatarContent ? (
          <Avatar sx={{
            width: 30, height: 30, flexShrink: 0,
            background: dueAvatarColors?.bg ?? '#f3f4f6',
            color: dueAvatarColors?.color ?? '#6b7280',
            flexDirection: 'column',
            lineHeight: 1,
          }}>
            <Typography sx={{ fontSize: dueAvatarContent.line2 ? '0.5rem' : '0.58rem', fontWeight: 700, lineHeight: 1, letterSpacing: 0 }}>
              {dueAvatarContent.line1}
            </Typography>
            {dueAvatarContent.line2 && (
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, lineHeight: 1, mt: '1px' }}>
                {dueAvatarContent.line2}
              </Typography>
            )}
          </Avatar>
        ) : ticket.inboundChannelId ? (
          <Box sx={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            bgcolor: 'info.main', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EmailIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.25)', position: 'absolute' }} />
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1, lineHeight: 1 }}>
              #{ticket.ticketNumber ?? ticket.id}
            </Typography>
          </Box>
        ) : (
          <Avatar sx={{
            width: 30, height: 30, fontSize: '0.65rem', flexShrink: 0,
            bgcolor: ticket.status === 'open' ? `${theme.palette.primary.main}26`
              : ticket.status === 'waiting' ? `${theme.palette.secondary.main}26`
              : ticket.status === 'resolved' ? `${theme.palette.success.main}26`
              : `${theme.palette.text.secondary}1a`,
            color: ticket.status === 'open' ? theme.palette.primary.main
              : ticket.status === 'waiting' ? theme.palette.secondary.main
              : ticket.status === 'resolved' ? theme.palette.success.main
              : theme.palette.text.secondary,
          }}>
            #{ticket.ticketNumber ?? ticket.id}
          </Avatar>
        )
      )}
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={500} noWrap fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
          {isMobile && (
            <Typography component="span" variant="caption" color="text.secondary" mr={0.5}>
              #{ticket.ticketNumber ?? ticket.id}
            </Typography>
          )}
          {ticket.title}
        </Typography>
        {ticket.category && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {ticket.category}
          </Typography>
        )}
      </Box>
      <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
        {dueBadge && (
          <Chip label={dueBadge.label} size="small" color={dueBadge.color}
            sx={{ fontSize: '0.62rem', height: 20, fontWeight: 'bold' }} />
        )}
        {!isMobile && (ticket.checklistCount ?? 0) > 0 && (
          <Tooltip title={t.ticketList.checklistProgressTooltip(ticket.checklistChecked ?? 0, ticket.checklistTotal ?? 0)} placement="top" arrow>
            <Chip
              label={`✓ ${ticket.checklistChecked ?? 0}/${ticket.checklistTotal}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.62rem', height: 20, fontWeight: 600, cursor: 'inherit', borderColor: 'text.disabled', color: 'text.secondary' }}
            />
          </Tooltip>
        )}
        <Chip
          label={getLabelForKey(ticket.status) || t.status[ticket.status as keyof typeof t.status] || ticket.status}
          size="small"
          sx={{
            fontSize: '0.62rem', height: 20,
            bgcolor: getColorForKey(ticket.status) ?? undefined,
            color: getColorForKey(ticket.status) ? '#fff' : undefined,
          }}
          color={getColorForKey(ticket.status) ? undefined : (getStatusColor(ticket.status) as any)}
        />
        {!isMobile && (
          <Chip label={t.priority[ticket.priority] || ticket.priority} size="small"
            variant="outlined" color={getPriorityColor(ticket.priority) as any}
            sx={{ fontSize: '0.62rem', height: 20 }} />
        )}
      </Box>
    </Box>
  );
}

// ── FEED CARD ─────────────────────────────────────────────────────────────

function FeedCard({
  title, icon, tickets, emptyMsg, viewAllHref, showDueBadge = false, accentColor, colorByStatus = false,
}: {
  title: string; icon: React.ReactNode; tickets: TicketRow[];
  emptyMsg: string; viewAllHref?: string; showDueBadge?: boolean; accentColor?: string; colorByStatus?: boolean;
}) {
  const { t } = useLanguage();
  const customName = React.useContext(WidgetCustomNameContext);
  const displayTitle = customName || title;
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...(accentColor ? { borderTop: 3, borderColor: accentColor } : {}) }}>
      <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center"
          px={{ xs: 1.5, sm: 2 }} pt={{ xs: 1.5, sm: 2 }} pb={1} flexShrink={0}>
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.1rem' }}>
              {displayTitle}
            </Typography>
            {tickets.length > 0 && (
              <Chip label={tickets.length} size="small" color={accentColor ? 'warning' : 'default'}
                sx={{ height: 18, fontSize: '0.65rem' }} />
            )}
          </Box>
          <Button component={Link} href={viewAllHref || '/tickets'} size="small" sx={{ fontSize: '0.75rem' }}>
            {t.dashboard.viewAll}
          </Button>
        </Box>
        <Divider sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {tickets.length === 0 ? (
            <Box px={2} py={3}>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {emptyMsg}
              </Typography>
            </Box>
          ) : (
            tickets.map((ticket, idx) => (
              <React.Fragment key={ticket.id}>
                <TicketRowItem ticket={ticket} showDueBadge={showDueBadge} colorByStatus={colorByStatus} />
                {idx < tickets.length - 1 && <Divider sx={{ mx: 2 }} />}
              </React.Fragment>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── CHART WIDGETS (self-contained) ────────────────────────────────────────

function ChartLoader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
      <CircularProgress size={28} />
    </Box>
  );
}

function ChartTrendWidget() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-trend', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['ticket-trend', days],
    queryFn: () => fetch(`/api/stats/trend?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.volume}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
                <Line type="monotone" dataKey="count" stroke={theme.palette.primary.main}
                  strokeWidth={2} dot={{ r: 3 }} name={t.reports.ticketCount} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartStatusWidget() {
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-status', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['stats-by-status', days],
    queryFn: () => fetch(`/api/stats/by-status?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.byStatus}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%"
                  labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius="70%" dataKey="count">
                  {data?.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartCategoryWidget() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-category', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['stats-by-category', days],
    queryFn: () => fetch(`/api/stats/by-category?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.byCategory}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
                <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} name={t.reports.ticketCount} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartPriorityWidget() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-priority', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['stats-by-priority', days],
    queryFn: () => fetch(`/api/stats/by-priority?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.byPriority}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
                <Bar dataKey="count" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} name={t.reports.ticketCount} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartLocationWidget() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-location', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['stats-by-location', days],
    queryFn: () => fetch(`/api/stats/by-location?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.byLocation}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
                <Bar dataKey="count" fill={theme.palette.info.main} radius={[4, 4, 0, 0]} name={t.reports.ticketCount} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function ChartAssigneeWidget() {
  const theme = useTheme();
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<ChartSettings>('chart-assignee', CHART_SETTINGS_DEFAULTS);
  const days = parseInt(settings.days) || 30;
  const { data, isLoading } = useQuery<{ name: string; count: number }[]>({
    queryKey: ['stats-by-assignee', days],
    queryFn: () => fetch(`/api/stats/by-assignee?days=${days}`, { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false,
  });
  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', pb: '16px !important' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize="0.95rem">{t.reports.byAssignee}</Typography>
          {!isLoading && total > 0 && <Chip label={total} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
        </Box>
        <Box flex={1} minHeight={0}>
          {isLoading ? <ChartLoader /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                <RechartTooltip formatter={(v) => [v, t.reports.ticketCount]} />
                <Bar dataKey="count" fill={theme.palette.success.main} radius={[0, 4, 4, 0]} name={t.reports.ticketCount} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── FEED SETTINGS HELPER ──────────────────────────────────────────────────

function applyFeedSettings(tickets: TicketRow[], settings: FeedSettings, defaultExcludeResolved = false): TicketRow[] {
  let result = tickets;
  if (settings.statusFilter.length > 0) {
    result = result.filter((tk) => settings.statusFilter.includes(tk.status));
  } else if (defaultExcludeResolved) {
    result = result.filter((tk) => !['resolved', 'closed'].includes(tk.status));
  }
  if (settings.priorityFilter.length > 0) {
    result = result.filter((tk) => settings.priorityFilter.includes(tk.priority));
  }
  if (settings.categoryFilter.length > 0) {
    result = result.filter((tk) => tk.category != null && settings.categoryFilter.includes(tk.category));
  }
  const max = parseInt(settings.maxItems) || 10;
  return max === 0 ? result : result.slice(0, max);
}

// ── FEED WIDGET WRAPPERS (self-contained) ─────────────────────────────────

function FeedMyWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<FeedSettings>('feed-my', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useGetMyTickets({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  const tickets = applyFeedSettings(data as TicketRow[], settings, true);
  return (
    <FeedCard
      title={t.dashboard.myTickets(entityTerm.plural)}
      icon={<Avatar sx={{ width: 22, height: 22, bgcolor: 'primary.main', fontSize: '0.6rem' }}>IO</Avatar>}
      tickets={tickets}
      emptyMsg={t.dashboard.noAssignedTickets(entityTerm.singular)}
      viewAllHref="/tickets"
      colorByStatus={settings.colorByStatus}
    />
  );
}

function FeedDueWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<FeedSettings>('feed-due', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useGetDueSoonTickets({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  const tickets = applyFeedSettings(data as TicketRow[], settings)
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  return (
    <FeedCard
      title={t.dashboard.dueSoon}
      icon={<ScheduleIcon fontSize="small" color={tickets.length > 0 ? 'warning' : 'disabled'} />}
      tickets={tickets}
      emptyMsg={t.dashboard.noDueSoon(entityTerm.singular)}
      viewAllHref="/tickets?status=open"
      showDueBadge
      accentColor={tickets.length > 0 ? 'warning.main' : undefined}
      colorByStatus={settings.colorByStatus}
    />
  );
}

function FeedRecentWidget() {
  const { t } = useLanguage();
  const [settings] = useWidgetSettings<FeedSettings>('feed-recent', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useGetRecentTickets({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  const tickets = applyFeedSettings(data as TicketRow[], settings);
  return (
    <FeedCard
      title={t.dashboard.recentActivity}
      icon={<HistoryIcon fontSize="small" color="action" />}
      tickets={tickets}
      emptyMsg=""
      viewAllHref="/tickets"
      colorByStatus={settings.colorByStatus}
    />
  );
}

function FeedAssignedWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<FeedSettings>('feed-assigned', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['assigned-to-me'],
    queryFn: () => fetch('/api/stats/assigned-to-me', { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const tickets = applyFeedSettings(data, settings, true);
  return (
    <FeedCard
      title={t.dashboard.widgetFeedAssigned}
      icon={<AssignedIcon fontSize="small" color="primary" />}
      tickets={tickets}
      emptyMsg={t.dashboard.noAssignedToMe(entityTerm.singular)}
      viewAllHref="/tickets"
      colorByStatus={settings.colorByStatus}
    />
  );
}

// ── OPEN TICKETS FEED ─────────────────────────────────────────────────────

function FeedOpenWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<FeedSettings>('feed-open', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['all-open-tickets'],
    queryFn: () => fetch('/api/tickets?status=open', { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const tickets = applyFeedSettings(data, settings);
  return (
    <FeedCard
      title={t.dashboard.widgetFeedOpen(entityTerm.plural)}
      icon={<AllOpenIcon fontSize="small" color="primary" />}
      tickets={tickets}
      emptyMsg={t.dashboard.noOpenTickets(entityTerm.singular)}
      viewAllHref="/tickets?status=open"
      colorByStatus={settings.colorByStatus}
    />
  );
}

// ── OVERDUE TICKETS FEED ───────────────────────────────────────────────────

function FeedOverdueWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const theme = useTheme();
  const [settings] = useWidgetSettings<FeedSettings>('feed-overdue', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['overdue-tickets-feed'],
    queryFn: () => fetch('/api/stats/overdue-tickets', { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const tickets = applyFeedSettings(data, settings);
  return (
    <FeedCard
      title={t.dashboard.widgetFeedOverdue(entityTerm.plural)}
      icon={<OverdueListIcon fontSize="small" color="warning" />}
      tickets={tickets}
      emptyMsg={t.dashboard.noOverdueTickets(entityTerm.singular)}
      viewAllHref="/tickets"
      showDueBadge
      accentColor={tickets.length > 0 ? theme.palette.warning.main : undefined}
      colorByStatus={settings.colorByStatus}
    />
  );
}

// ── WORKLOAD WIDGET ────────────────────────────────────────────────────────

interface WorkloadRow { id: number; name: string; email: string; open: number; total: number; }

function WorkloadWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<WorkloadSettings>('workload', WORKLOAD_SETTINGS_DEFAULTS);
  const { data = [], isLoading } = useQuery<WorkloadRow[]>({
    queryKey: ['assignee-workload'],
    queryFn: () => fetch('/api/stats/assignee-workload', { credentials: 'include' }).then((r) => r.json()),
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const maxItems = parseInt(settings.maxItems) || 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
        <Box display="flex" alignItems="center" gap={1} px={2} pt={2} pb={1} flexShrink={0}>
          <WorkloadIcon fontSize="small" color="action" />
          <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
            {React.useContext(WidgetCustomNameContext) || t.dashboard.widgetWorkload}
          </Typography>
          {!isLoading && data.length > 0 && (
            <Chip
              label={data.reduce((s, r) => s + r.open, 0)}
              size="small"
              color="primary"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}
        </Box>
        <Divider sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
          ) : data.length === 0 ? (
            <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.widgetWorkloadEmpty(entityTerm.plural)}</Typography></Box>
          ) : (
            <>
              <Box display="grid" gridTemplateColumns="1fr auto auto" gap={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} px={2} py={0.75}>Operatore</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} px={1.5} py={0.75} textAlign="center">{t.dashboard.workloadOpen}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} px={1.5} py={0.75} textAlign="center">{t.dashboard.workloadTotal}</Typography>
              </Box>
              {(maxItems > 0 ? data.slice(0, maxItems) : data).map((row, idx) => (
                <Box key={row.id}
                  component={Link} href={`/tickets?assignedTo=${row.id}`}
                  display="grid" gridTemplateColumns="1fr auto auto"
                  sx={{
                    textDecoration: 'none', color: 'inherit',
                    '&:hover': { bgcolor: 'action.hover' },
                    borderBottom: idx < data.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Box px={2} py={1} display="flex" alignItems="center" gap={1} minWidth={0}>
                    <Avatar sx={{ width: 22, height: 22, fontSize: '0.6rem', bgcolor: 'primary.main', flexShrink: 0 }}>
                      {row.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" noWrap fontSize="0.8rem">{row.name}</Typography>
                  </Box>
                  <Box px={1.5} py={1} display="flex" alignItems="center" justifyContent="center">
                    <Chip label={row.open} size="small" color={row.open > 0 ? 'primary' : 'default'}
                      sx={{ minWidth: 32, height: 20, fontSize: '0.7rem' }} />
                  </Box>
                  <Box px={1.5} py={1} display="flex" alignItems="center" justifyContent="center">
                    <Typography variant="caption" color="text.secondary">{row.total}</Typography>
                  </Box>
                </Box>
              ))}
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── CLIENT NOTES THIS MONTH ───────────────────────────────────────────────

function formatWidgetMonth(yyyyMM: string, lang: string): string {
  const [year, month] = yyyyMM.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', { month: 'long', year: 'numeric' });
}

function isClientNoteOpen(note: any): boolean {
  const cl = note.checklist;
  if (!cl || !Array.isArray(cl) || cl.length === 0) {
    // Nota solo testo: aperta se ha del contenuto
    return !!(note.body && note.body.trim());
  }
  // Nota con checklist: aperta se almeno un item non è spuntato
  return cl.some((item: any) => !item.checked);
}

function ClientNotesWidget() {
  const { t, lang } = useLanguage();
  const [settings] = useWidgetSettings<ClientNotesSettings>('client-notes', CLIENT_NOTES_SETTINGS_DEFAULTS);
  const { data: allNotes = [], isLoading } = useListAllClientNotes();

  const currentMonth = React.useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = React.useState<string>(currentMonth);

  const availableMonths = React.useMemo(() => {
    const monthSet = new Set<string>();
    for (const note of allNotes) {
      if (!note.clientId) continue;
      const noteMonth = note.monthOverride ?? note.createdAt.slice(0, 7);
      monthSet.add(noteMonth);
    }
    return Array.from(monthSet).sort();
  }, [allNotes]);

  const effectiveMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : (availableMonths[availableMonths.length - 1] ?? currentMonth);

  const rows = React.useMemo(() => {
    const map = new Map<number, { name: string; slug: string | null; count: number }>();
    for (const note of allNotes) {
      const noteMonth = note.monthOverride ?? note.createdAt.slice(0, 7);
      if (noteMonth !== effectiveMonth) continue;
      if (!note.clientId) continue;
      const existing = map.get(note.clientId);
      if (existing) {
        if (isClientNoteOpen(note)) existing.count += 1;
      } else {
        map.set(note.clientId, { name: note.clientName ?? String(note.clientId), slug: note.clientSlug ?? null, count: isClientNoteOpen(note) ? 1 : 0 });
      }
    }
    const sorted = Array.from(map.entries())
      .map(([id, { name, slug, count }]) => ({ id, name, slug, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const maxItems = parseInt(settings.maxItems, 10);
    return maxItems > 0 ? sorted.slice(0, maxItems) : sorted;
  }, [allNotes, effectiveMonth, settings.maxItems]);

  const monthLabel = React.useMemo(
    () => formatWidgetMonth(effectiveMonth, lang),
    [effectiveMonth, lang],
  );

  const monthIdx = availableMonths.indexOf(effectiveMonth);
  const hasPrev = monthIdx > 0;
  const hasNext = monthIdx >= 0 && monthIdx < availableMonths.length - 1;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
        <Box display="flex" alignItems="center" gap={1} px={2} pt={2} pb={1} flexShrink={0}>
          <ClientNotesIcon fontSize="small" color="action" />
          <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
            {React.useContext(WidgetCustomNameContext) || t.dashboard.widgetClientNotes}
          </Typography>
          {!isLoading && availableMonths.length > 0 && (
            <Box display="flex" alignItems="center" gap={0.25} sx={{ ml: 0.5 }}>
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                disabled={!hasPrev}
                onClick={() => setSelectedMonth(availableMonths[monthIdx - 1])}
              >
                <ChevronLeftIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <Select
                size="small"
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                sx={{
                  fontSize: '0.72rem',
                  '& .MuiSelect-select': { py: 0.25, px: 1 },
                  '& fieldset': { border: 'none' },
                  minWidth: 110,
                }}
              >
                {availableMonths.map((m) => (
                  <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>
                    {formatWidgetMonth(m, lang)}
                  </MenuItem>
                ))}
              </Select>
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                disabled={!hasNext}
                onClick={() => setSelectedMonth(availableMonths[monthIdx + 1])}
              >
                <ChevronRightIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )}
          {!isLoading && rows.some(r => r.count > 0) && (
            <Chip
              label={rows.reduce((sum, r) => sum + r.count, 0)}
              size="small"
              color="primary"
              sx={{ height: 18, fontSize: '0.65rem', ml: 'auto' }}
            />
          )}
        </Box>
        <Divider sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
          ) : rows.length === 0 ? (
            <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.widgetClientNotesEmpty}</Typography></Box>
          ) : (
            rows.map((row, idx) => (
              <Box
                key={row.id}
                component={Link}
                href={`/clients/${row.id}`}
                display="flex"
                alignItems="center"
                gap={1}
                px={2}
                py={1}
                sx={{
                  textDecoration: 'none',
                  color: 'inherit',
                  bgcolor: settings.colorByStatus
                    ? row.count >= 5
                      ? 'warning.light'
                      : row.count >= 2
                        ? 'info.light'
                        : 'success.light'
                    : undefined,
                  opacity: settings.colorByStatus ? 0.92 : 1,
                  '&:hover': { bgcolor: 'action.hover' },
                  borderBottom: idx < rows.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Avatar sx={{ width: 22, height: 22, fontSize: '0.6rem', bgcolor: 'primary.main', flexShrink: 0 }}>
                  {row.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="body2" noWrap fontSize="0.8rem" sx={{ flex: 1 }}>{row.name}</Typography>
                <Chip
                  label={row.count}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ minWidth: 32, height: 20, fontSize: '0.7rem' }}
                />
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── TICKETS BY PERSON (configurable) ──────────────────────────────────────

const PERSON_WIDGET_KEY = 'td_widget_person_id';

function FeedPersonWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const v = localStorage.getItem(PERSON_WIDGET_KEY);
    return v ? parseInt(v, 10) : null;
  });
  const [tempId, setTempId] = useState<number | ''>(selectedId ?? '');

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['widget-users-list'],
    queryFn: () => fetch('/api/users', { credentials: 'include' }).then((r) => r.json()).then((d) => Array.isArray(d) ? d : (d.users ?? [])),
    staleTime: 60_000,
  });

  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['tickets-for-person', selectedId],
    queryFn: () => selectedId
      ? fetch(`/api/tickets?assignedTo=${selectedId}&status=open`, { credentials: 'include' }).then((r) => r.json())
      : Promise.resolve([]),
    enabled: selectedId != null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const selectedUser = users.find((u) => u.id === selectedId);
  const [settings] = useWidgetSettings<FeedSettings>('feed-person', FEED_SETTINGS_DEFAULTS);

  const handleSave = () => {
    const id = typeof tempId === 'number' ? tempId : null;
    setSelectedId(id);
    if (id != null) localStorage.setItem(PERSON_WIDGET_KEY, String(id));
    else localStorage.removeItem(PERSON_WIDGET_KEY);
    setConfigOpen(false);
  };

  const displayTickets = applyFeedSettings(data, settings);

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1} flexShrink={0}>
            <Box display="flex" alignItems="center" gap={1}>
              <PersonIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
                {React.useContext(WidgetCustomNameContext) || (selectedUser ? selectedUser.name : t.dashboard.widgetFeedPerson(entityTerm.plural))}
              </Typography>
              {selectedId && displayTickets.length > 0 && (
                <Chip label={displayTickets.length} size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Tooltip title={t.dashboard.configureWidget}>
              <IconButton size="small" onClick={() => { setTempId(selectedId ?? ''); setConfigOpen(true); }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!selectedId ? (
              <Box px={2} py={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">{t.dashboard.noAgentSelected}</Typography>
                <Button size="small" startIcon={<SettingsIcon />} sx={{ mt: 1 }} onClick={() => setConfigOpen(true)}>
                  {t.dashboard.configureWidget}
                </Button>
              </Box>
            ) : displayTickets.length === 0 ? (
              <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.noOpenTickets(entityTerm.singular)}</Typography></Box>
            ) : (
              displayTickets.map((ticket, idx) => (
                <React.Fragment key={ticket.id}>
                  <TicketRowItem ticket={ticket} colorByStatus={settings.colorByStatus} />
                  {idx < displayTickets.length - 1 && <Divider sx={{ mx: 2 }} />}
                </React.Fragment>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.dashboard.selectAgent}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>{t.dashboard.selectAgent}</InputLabel>
            <Select label={t.dashboard.selectAgent} value={tempId} onChange={(e) => setTempId(e.target.value === '' ? '' : Number(e.target.value))}>
              <MenuItem value="">{t.settings?.imapRoutingNone || 'Nessuno'}</MenuItem>
              {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button onClick={() => setConfigOpen(false)}>Annulla</Button>
            <Button variant="contained" onClick={handleSave}>OK</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── TICKETS BY GROUP (configurable) ───────────────────────────────────────

const GROUP_WIDGET_KEY = 'td_widget_group_name';

function FeedGroupWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>(() => localStorage.getItem(GROUP_WIDGET_KEY) ?? '');
  const [tempGroup, setTempGroup] = useState<string>(selectedGroup);

  const { data: groups = [] } = useQuery<string[]>({
    queryKey: ['widget-groups-list'],
    queryFn: () => fetch('/api/settings/groups', { credentials: 'include' }).then((r) => r.json()).then((d) => d.value ?? []),
    staleTime: 60_000,
  });

  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['tickets-for-group', selectedGroup],
    queryFn: () => selectedGroup
      ? fetch(`/api/tickets?assignedToGroup=${encodeURIComponent(selectedGroup)}&status=open`, { credentials: 'include' }).then((r) => r.json())
      : Promise.resolve([]),
    enabled: !!selectedGroup,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const [settings] = useWidgetSettings<FeedSettings>('feed-group', FEED_SETTINGS_DEFAULTS);

  const handleSave = () => {
    setSelectedGroup(tempGroup);
    if (tempGroup) localStorage.setItem(GROUP_WIDGET_KEY, tempGroup);
    else localStorage.removeItem(GROUP_WIDGET_KEY);
    setConfigOpen(false);
  };

  const displayTickets = applyFeedSettings(data, settings);

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1} flexShrink={0}>
            <Box display="flex" alignItems="center" gap={1}>
              <GroupIcon fontSize="small" color="secondary" />
              <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
                {React.useContext(WidgetCustomNameContext) || selectedGroup || t.dashboard.widgetFeedGroup(entityTerm.plural)}
              </Typography>
              {selectedGroup && displayTickets.length > 0 && (
                <Chip label={displayTickets.length} size="small" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Tooltip title={t.dashboard.configureWidget}>
              <IconButton size="small" onClick={() => { setTempGroup(selectedGroup); setConfigOpen(true); }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!selectedGroup ? (
              <Box px={2} py={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">{t.dashboard.noGroupSelected}</Typography>
                <Button size="small" startIcon={<SettingsIcon />} sx={{ mt: 1 }} onClick={() => setConfigOpen(true)}>
                  {t.dashboard.configureWidget}
                </Button>
              </Box>
            ) : groups.length === 0 ? (
              <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.noGroupsAvailable}</Typography></Box>
            ) : displayTickets.length === 0 ? (
              <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.noOpenTickets(entityTerm.singular)}</Typography></Box>
            ) : (
              displayTickets.map((ticket, idx) => (
                <React.Fragment key={ticket.id}>
                  <TicketRowItem ticket={ticket} colorByStatus={settings.colorByStatus} />
                  {idx < displayTickets.length - 1 && <Divider sx={{ mx: 2 }} />}
                </React.Fragment>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.dashboard.selectGroup}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>{t.dashboard.selectGroup}</InputLabel>
            <Select label={t.dashboard.selectGroup} value={tempGroup} onChange={(e) => setTempGroup(e.target.value)}>
              <MenuItem value="">{t.settings?.imapRoutingNone || 'Nessuno'}</MenuItem>
              {groups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button onClick={() => setConfigOpen(false)}>Annulla</Button>
            <Button variant="contained" onClick={handleSave}>OK</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── STAT WIDGET WRAPPERS (self-contained) ─────────────────────────────────

function StatOpenWidget() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { data: stats } = useGetDashboardStats({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  return (
    <StatCard
      title={t.dashboard.openTickets}
      value={stats?.openTickets || 0}
      color={theme.palette.primary.main}
      bgColor={theme.palette.mode === 'dark' ? 'rgba(25,118,210,0.15)' : '#e3f2fd'}
      icon={<OpenIcon fontSize="small" />}
      href="/tickets?status=open"
    />
  );
}

function StatResolvedWidget() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { data: stats } = useGetDashboardStats({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  return (
    <StatCard
      title={t.dashboard.resolved}
      value={stats?.resolvedTickets || 0}
      color={theme.palette.success.main}
      bgColor={theme.palette.mode === 'dark' ? 'rgba(46,125,50,0.15)' : '#e8f5e9'}
      icon={<ResolvedIcon fontSize="small" />}
      href="/tickets?status=resolved"
    />
  );
}

function StatUrgentWidget() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { data: stats } = useGetDashboardStats({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  return (
    <StatCard
      title={t.dashboard.urgent}
      value={stats?.urgentTickets || 0}
      color={theme.palette.error.main}
      bgColor={theme.palette.mode === 'dark' ? 'rgba(211,47,47,0.15)' : '#ffebee'}
      icon={<UrgentIcon fontSize="small" />}
      href="/tickets?priority=urgent&status=open"
    />
  );
}

function StatOverdueWidget() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { data: stats } = useGetDashboardStats({ query: { refetchInterval: POLL_MS, refetchIntervalInBackground: false } as any });
  return (
    <StatCard
      title={t.dashboard.overdue}
      value={stats?.overdueTickets || 0}
      color={theme.palette.warning.dark}
      bgColor={theme.palette.mode === 'dark' ? 'rgba(230,81,0,0.15)' : '#fff3e0'}
      icon={<OverdueIcon fontSize="small" />}
      href="/tickets?overdue=true"
    />
  );
}

// ── TICKETS BY CATEGORY (configurable) ────────────────────────────────────

const CATEGORY_WIDGET_KEY = 'td_widget_category';

function FeedCategoryWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [configOpen, setConfigOpen] = useState(false);
  const [selected, setSelected] = useState<string>(() => localStorage.getItem(CATEGORY_WIDGET_KEY) ?? '');
  const [temp, setTemp] = useState<string>(selected);

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['widget-categories-list'],
    queryFn: () => fetch('/api/settings/categories', { credentials: 'include' }).then((r) => r.json()).then((d) => d.value ?? []),
    staleTime: 60_000,
  });

  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['tickets-for-category', selected],
    queryFn: () => selected
      ? fetch(`/api/tickets?category=${encodeURIComponent(selected)}`, { credentials: 'include' }).then((r) => r.json())
      : Promise.resolve([]),
    enabled: !!selected,
    staleTime: 30_000,
  });

  const handleSave = () => {
    setSelected(temp);
    if (temp) localStorage.setItem(CATEGORY_WIDGET_KEY, temp);
    else localStorage.removeItem(CATEGORY_WIDGET_KEY);
    setConfigOpen(false);
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1} flexShrink={0}>
            <Box display="flex" alignItems="center" gap={1}>
              <CategoryIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
                {React.useContext(WidgetCustomNameContext) || selected || t.dashboard.widgetFeedCategory(entityTerm.plural)}
              </Typography>
              {selected && data.length > 0 && (
                <Chip label={data.length} size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Tooltip title={t.dashboard.configureWidget}>
              <IconButton size="small" onClick={() => { setTemp(selected); setConfigOpen(true); }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!selected ? (
              <Box px={2} py={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">{t.dashboard.noCategorySelected}</Typography>
                <Button size="small" startIcon={<SettingsIcon />} sx={{ mt: 1 }} onClick={() => setConfigOpen(true)}>
                  {t.dashboard.configureWidget}
                </Button>
              </Box>
            ) : data.length === 0 ? (
              <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.noTicketsForCategory(entityTerm.singular)}</Typography></Box>
            ) : (
              data.slice(0, 15).map((ticket, idx) => (
                <React.Fragment key={ticket.id}>
                  <TicketRowItem ticket={ticket} />
                  {idx < data.length - 1 && <Divider sx={{ mx: 2 }} />}
                </React.Fragment>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.dashboard.selectCategory}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>{t.dashboard.selectCategory}</InputLabel>
            <Select label={t.dashboard.selectCategory} value={temp} onChange={(e) => setTemp(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button onClick={() => setConfigOpen(false)}>Annulla</Button>
            <Button variant="contained" onClick={handleSave}>OK</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── TICKETS BY STATUS (configurable) ──────────────────────────────────────

const STATUS_WIDGET_KEY = 'td_widget_status';

function FeedStatusWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [configOpen, setConfigOpen] = useState(false);
  const [selected, setSelected] = useState<string>(() => localStorage.getItem(STATUS_WIDGET_KEY) ?? '');
  const [temp, setTemp] = useState<string>(selected);

  const { statuses } = useTicketStatuses();

  const { data = [] } = useQuery<TicketRow[]>({
    queryKey: ['tickets-for-status', selected],
    queryFn: () => selected
      ? fetch(`/api/tickets?status=${encodeURIComponent(selected)}`, { credentials: 'include' }).then((r) => r.json())
      : Promise.resolve([]),
    enabled: !!selected,
    staleTime: 30_000,
  });

  const selectedLabel = statuses.find((s) => s.key === selected)?.label ?? selected;

  const handleSave = () => {
    setSelected(temp);
    if (temp) localStorage.setItem(STATUS_WIDGET_KEY, temp);
    else localStorage.removeItem(STATUS_WIDGET_KEY);
    setConfigOpen(false);
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', '&:last-child': { pb: 0 } }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1} flexShrink={0}>
            <Box display="flex" alignItems="center" gap={1}>
              <FilterListIcon fontSize="small" color="primary" />
              <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.05rem' }}>
                {React.useContext(WidgetCustomNameContext) || (selected ? selectedLabel : t.dashboard.widgetFeedStatus(entityTerm.plural))}
              </Typography>
              {selected && data.length > 0 && (
                <Chip label={data.length} size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            <Tooltip title={t.dashboard.configureWidget}>
              <IconButton size="small" onClick={() => { setTemp(selected); setConfigOpen(true); }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ flexShrink: 0 }} />
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {!selected ? (
              <Box px={2} py={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">{t.dashboard.noStatusSelected}</Typography>
                <Button size="small" startIcon={<SettingsIcon />} sx={{ mt: 1 }} onClick={() => setConfigOpen(true)}>
                  {t.dashboard.configureWidget}
                </Button>
              </Box>
            ) : data.length === 0 ? (
              <Box px={2} py={3}><Typography variant="body2" color="text.secondary" textAlign="center">{t.dashboard.noTicketsForStatus(entityTerm.singular)}</Typography></Box>
            ) : (
              data.slice(0, 15).map((ticket, idx) => (
                <React.Fragment key={ticket.id}>
                  <TicketRowItem ticket={ticket} />
                  {idx < data.length - 1 && <Divider sx={{ mx: 2 }} />}
                </React.Fragment>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.dashboard.selectStatus}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>{t.dashboard.selectStatus}</InputLabel>
            <Select label={t.dashboard.selectStatus} value={temp} onChange={(e) => setTemp(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {statuses.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
            <Button onClick={() => setConfigOpen(false)}>Annulla</Button>
            <Button variant="contained" onClick={handleSave}>OK</Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── ALL ASSIGNED TICKETS ───────────────────────────────────────────────────

function FeedAllAssignedWidget() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const [settings] = useWidgetSettings<FeedSettings>('feed-all-assigned', FEED_SETTINGS_DEFAULTS);
  const { data = [] } = useQuery<(TicketRow & { assignedTo?: number | null })[]>({
    queryKey: ['all-assigned-open-tickets'],
    queryFn: () => fetch('/api/tickets', { credentials: 'include' }).then((r) => r.json()),
    staleTime: 30_000,
  });
  const assigned = data.filter((tk) => tk.assignedTo != null);
  const tickets = applyFeedSettings(assigned as TicketRow[], settings, true);
  return (
    <FeedCard
      title={t.dashboard.widgetFeedAllAssigned(entityTerm.plural)}
      icon={<PeopleAltIcon fontSize="small" color="primary" />}
      tickets={tickets}
      emptyMsg={t.dashboard.noAssignedTickets(entityTerm.singular)}
      viewAllHref="/tickets"
      colorByStatus={settings.colorByStatus}
    />
  );
}

// ── WIDGET REGISTRY ───────────────────────────────────────────────────────

interface WidgetSettingOption {
  value: string;
  labelKey: string;
}

interface WidgetSettingField {
  key: string;
  labelKey: string;
  type: 'multiselect' | 'select' | 'toggle';
  options?: WidgetSettingOption[];
  defaultValue: unknown;
}

interface WidgetMeta {
  requireClients?: boolean;
  id: string;
  labelKey: string;
  defaultLayout: Omit<LayoutItem, 'i'>;
  component: React.FC;
  requireAdmin?: boolean;
  settingsSchema?: WidgetSettingField[];
}

const FEED_SETTINGS_SCHEMA: WidgetSettingField[] = [
  { key: 'statusFilter', labelKey: 'wsStatusFilter', type: 'multiselect', defaultValue: [] },
  {
    key: 'priorityFilter', labelKey: 'wsPriorityFilter', type: 'multiselect',
    options: [
      { value: 'low', labelKey: 'wsPriorityLow' },
      { value: 'medium', labelKey: 'wsPriorityMedium' },
      { value: 'high', labelKey: 'wsPriorityHigh' },
      { value: 'urgent', labelKey: 'wsPriorityUrgent' },
    ],
    defaultValue: [],
  },
  { key: 'categoryFilter', labelKey: 'wsCategoryFilter', type: 'multiselect', defaultValue: [] },
  { key: 'colorByStatus', labelKey: 'wsColorByStatus', type: 'toggle', defaultValue: false },
  {
    key: 'maxItems', labelKey: 'wsMaxItems', type: 'select',
    options: [
      { value: '5', labelKey: 'wsMaxItems5' },
      { value: '10', labelKey: 'wsMaxItems10' },
      { value: '20', labelKey: 'wsMaxItems20' },
      { value: '0', labelKey: 'wsMaxItemsAll' },
    ],
    defaultValue: '10',
  },
];


const WORKLOAD_SETTINGS_DEFAULTS = { maxItems: '0' as string };
type WorkloadSettings = typeof WORKLOAD_SETTINGS_DEFAULTS;

const WORKLOAD_SETTINGS_SCHEMA: WidgetSettingField[] = [
  {
    key: 'maxItems', labelKey: 'wsMaxItems', type: 'select',
    options: [
      { value: '5', labelKey: 'wsMaxItems5' },
      { value: '10', labelKey: 'wsMaxItems10' },
      { value: '20', labelKey: 'wsMaxItems20' },
      { value: '0', labelKey: 'wsMaxItemsAll' },
    ],
    defaultValue: '0',
  },
];

const CLIENT_NOTES_SETTINGS_DEFAULTS = { maxItems: '10' as string, colorByStatus: false as boolean };
type ClientNotesSettings = typeof CLIENT_NOTES_SETTINGS_DEFAULTS;

const CLIENT_NOTES_SETTINGS_SCHEMA: WidgetSettingField[] = [
  { key: 'colorByStatus', labelKey: 'wsColorByStatus', type: 'toggle', defaultValue: false },
  {
    key: 'maxItems', labelKey: 'wsMaxItems', type: 'select',
    options: [
      { value: '5', labelKey: 'wsMaxItems5' },
      { value: '10', labelKey: 'wsMaxItems10' },
      { value: '20', labelKey: 'wsMaxItems20' },
      { value: '0', labelKey: 'wsMaxItemsAll' },
    ],
    defaultValue: '10',
  },
];

const CHART_SETTINGS_SCHEMA: WidgetSettingField[] = [
  {
    key: 'days', labelKey: 'wsTimeWindow', type: 'select',
    options: [
      { value: '7', labelKey: 'wsDays7' },
      { value: '30', labelKey: 'wsDays30' },
      { value: '90', labelKey: 'wsDays90' },
    ],
    defaultValue: '30',
  },
];

function AcquisitionWidget() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSuperAdmin = !!(user as unknown as Record<string, unknown>)?.isSuperAdmin;
  const { data, isLoading } = useQuery<{
    signupsByDay: { date: string; count: number }[];
    bySource: { source: string | null; count: number }[];
  }>({
    queryKey: ['acquisition-stats'],
    queryFn: () => fetch('/api/stats/acquisition', { credentials: 'include' }).then((r) => r.json()),
    staleTime: 60_000,
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  if (isLoading || !data) {
    return (
      <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t.dashboard.widgetAcquisition}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={0.5}>
          {t.dashboard.acquisitionSignupsByDay}
        </Typography>
        <Box sx={{ flex: 1, minHeight: 120 }}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.signupsByDay} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RechartTooltip />
              <Bar dataKey="count" fill="#1976d2" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mt={1} mb={0.5}>
          {t.dashboard.acquisitionBySource}
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {data.bySource.length === 0 && (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
          {data.bySource.map(({ source, count }) => (
            <Chip key={source ?? 'direct'} size="small" label={`${source ?? 'direct'}: ${count}`} variant="outlined" />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

const WIDGET_REGISTRY: WidgetMeta[] = [
  { id: 'stat-open',      labelKey: 'widgetStatOpen',      defaultLayout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, component: StatOpenWidget },
  { id: 'stat-resolved',  labelKey: 'widgetStatResolved',  defaultLayout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, component: StatResolvedWidget },
  { id: 'stat-urgent',    labelKey: 'widgetStatUrgent',    defaultLayout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, component: StatUrgentWidget },
  { id: 'stat-overdue',   labelKey: 'widgetStatOverdue',   defaultLayout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 }, component: StatOverdueWidget },
  { id: 'feed-my',        labelKey: 'widgetFeedMy',        defaultLayout: { x: 0, y: 2, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedMyWidget,        settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-due',       labelKey: 'widgetFeedDue',       defaultLayout: { x: 4, y: 2, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedDueWidget,       settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-recent',    labelKey: 'widgetFeedRecent',    defaultLayout: { x: 8, y: 2, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedRecentWidget,    settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-assigned',  labelKey: 'widgetFeedAssigned',  defaultLayout: { x: 0, y: 9,  w: 4, h: 7, minW: 2, minH: 3 }, component: FeedAssignedWidget,  settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-open',      labelKey: 'widgetFeedOpen',       defaultLayout: { x: 4, y: 9,  w: 4, h: 7, minW: 2, minH: 3 }, component: FeedOpenWidget,      settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-overdue',   labelKey: 'widgetFeedOverdue',    defaultLayout: { x: 8, y: 9,  w: 4, h: 7, minW: 2, minH: 3 }, component: FeedOverdueWidget,   settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-person',    labelKey: 'widgetFeedPerson',     defaultLayout: { x: 0, y: 16, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedPersonWidget,    settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'feed-group',     labelKey: 'widgetFeedGroup',      defaultLayout: { x: 4, y: 16, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedGroupWidget,     settingsSchema: FEED_SETTINGS_SCHEMA },
  { id: 'client-notes',   labelKey: 'widgetClientNotes',   defaultLayout: { x: 8, y: 16, w: 4, h: 7, minW: 2, minH: 3 }, component: ClientNotesWidget,   settingsSchema: CLIENT_NOTES_SETTINGS_SCHEMA, requireClients: true },
  { id: 'chart-trend',    labelKey: 'widgetChartTrend',    defaultLayout: { x: 0, y: 23, w: 8, h: 6, minW: 4, minH: 4 }, component: ChartTrendWidget,    settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'chart-status',   labelKey: 'widgetChartStatus',   defaultLayout: { x: 8, y: 23, w: 4, h: 6, minW: 3, minH: 4 }, component: ChartStatusWidget,   settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'chart-category', labelKey: 'widgetChartCategory', defaultLayout: { x: 0, y: 29, w: 6, h: 6, minW: 3, minH: 4 }, component: ChartCategoryWidget, settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'chart-priority', labelKey: 'widgetChartPriority', defaultLayout: { x: 6, y: 29, w: 6, h: 6, minW: 3, minH: 4 }, component: ChartPriorityWidget, settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'chart-location', labelKey: 'widgetChartLocation', defaultLayout: { x: 0, y: 35, w: 6, h: 6, minW: 3, minH: 4 }, component: ChartLocationWidget, settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'chart-assignee', labelKey: 'widgetChartAssignee', defaultLayout: { x: 6, y: 35, w: 6, h: 6, minW: 3, minH: 4 }, component: ChartAssigneeWidget, settingsSchema: CHART_SETTINGS_SCHEMA },
  { id: 'workload',       labelKey: 'widgetWorkload',       defaultLayout: { x: 0, y: 41, w: 6, h: 8, minW: 3, minH: 4 }, component: WorkloadWidget,      settingsSchema: WORKLOAD_SETTINGS_SCHEMA },
  { id: 'acquisition',    labelKey: 'widgetAcquisition',   defaultLayout: { x: 0, y: 50, w: 12, h: 9, minW: 4, minH: 5 }, component: AcquisitionWidget },
  { id: 'feed-category',  labelKey: 'widgetFeedCategory',  defaultLayout: { x: 0, y: 60, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedCategoryWidget },
  { id: 'feed-status',    labelKey: 'widgetFeedStatus',    defaultLayout: { x: 4, y: 60, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedStatusWidget },
  { id: 'feed-all-assigned', labelKey: 'widgetFeedAllAssigned', defaultLayout: { x: 8, y: 60, w: 4, h: 7, minW: 2, minH: 3 }, component: FeedAllAssignedWidget, settingsSchema: FEED_SETTINGS_SCHEMA },
];

const DEFAULT_VISIBLE_IDS = ['stat-open', 'stat-resolved', 'stat-urgent', 'stat-overdue', 'feed-my', 'feed-due', 'feed-recent'];

const DEFAULT_LAYOUT: LayoutItem[] = WIDGET_REGISTRY
  .filter((w) => DEFAULT_VISIBLE_IDS.includes(w.id))
  .map((w) => ({ i: w.id, ...w.defaultLayout }));

const LAYOUT_KEY = 'td_dashboard_layout_v4';
const VISIBLE_KEY = 'td_dashboard_visible_v4';

// ── WIDGET SHELL (drag handle + remove + settings gear) ──────────────────

function WidgetShell({
  editMode, label, onRemove, onOpenSettings, children,
}: {
  editMode: boolean; label: string; onRemove: () => void;
  onOpenSettings?: () => void; children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const hasSettings = !!onOpenSettings;

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      borderRadius: 2, overflow: 'hidden',
      outline: editMode ? '2px dashed' : 'none',
      outlineColor: 'primary.main',
      outlineOffset: -1,
    }}>
      {editMode ? (
        <Paper
          elevation={0}
          className="drag-handle"
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: { xs: 1.5, sm: 1 }, py: { xs: 1.25, sm: 0.5 }, flexShrink: 0,
            bgcolor: 'primary.main', color: 'primary.contrastText',
            borderRadius: 0, cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIcon sx={{ fontSize: { xs: 20, sm: 16 }, opacity: 0.8 }} />
          <Typography variant="caption" fontWeight={600} flex={1} noWrap fontSize={{ xs: '0.82rem', sm: '0.72rem' }}>
            {label}
          </Typography>
          {hasSettings && (
            <Tooltip title={t.dashboard.wsTitle}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpenSettings!(); }}
                sx={{ color: 'primary.contrastText', p: { xs: 0.75, sm: 0.25 } }}>
                <SettingsIcon sx={{ fontSize: { xs: 20, sm: 14 } }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t.dashboard.removeWidget}>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(); }}
              sx={{ color: 'primary.contrastText', p: { xs: 0.75, sm: 0.25 } }}>
              <DeleteIcon sx={{ fontSize: { xs: 20, sm: 14 } }} />
            </IconButton>
          </Tooltip>
        </Paper>
      ) : hasSettings ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, py: 0.25, flexShrink: 0 }}>
          <Tooltip title={t.dashboard.wsTitle}>
            <IconButton size="small" onClick={onOpenSettings} sx={{ opacity: 0.35, '&:hover': { opacity: 1 } }}>
              <SettingsIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

// ── WIDGET SETTINGS DIALOG ────────────────────────────────────────────────

function WidgetSettingsDialog({
  open, onClose, widgetId, meta, customName, onCustomNameChange,
}: {
  open: boolean; onClose: () => void; widgetId: string; meta: WidgetMeta | null;
  customName: string; onCustomNameChange: (name: string) => void;
}) {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const { statuses } = useTicketStatuses();
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['widget-settings-categories'],
    queryFn: () => fetch('/api/settings/categories', { credentials: 'include' }).then((r) => r.json()).then((d) => d.value ?? []),
    staleTime: 60_000,
    enabled: open,
  });
  const schema = meta?.settingsSchema ?? [];

  const schemaDefaults = React.useMemo(() => {
    const d: Record<string, unknown> = {};
    for (const f of schema) d[f.key] = f.defaultValue;
    return d;
  }, [schema]);

  const [saved, setSaved] = useWidgetSettings<Record<string, unknown>>(widgetId, schemaDefaults);
  const [draft, setDraft] = React.useState<Record<string, unknown>>(saved);
  const [draftName, setDraftName] = React.useState(customName);

  React.useEffect(() => {
    if (open) {
      setDraft({ ...schemaDefaults, ...saved });
      setDraftName(customName);
    }
  }, [open]);

  const handleSave = () => {
    setSaved(draft);
    onCustomNameChange(draftName);
    onClose();
  };

  const td = t.dashboard as unknown as Record<string, string>;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        {td.wsTitle}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box display="flex" flexDirection="column" gap={2.5}>
          <TextField
            size="small"
            fullWidth
            label={td.wsCustomName ?? 'Widget name'}
            placeholder={meta ? (() => { const v = (t.dashboard as Record<string, unknown>)[meta.labelKey]; return typeof v === 'function' ? (v as (p: string) => string)(entityTerm.plural) : ((v as string) || meta.id); })() : ''}
            value={draftName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftName(e.target.value)}
            InputProps={{ endAdornment: draftName ? (
              <IconButton size="small" edge="end" onClick={() => setDraftName('')}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
            ) : undefined }}
          />
          {schema.length > 0 && <Divider />}
          {schema.map((field) => {
            const value = draft[field.key] ?? field.defaultValue;

            if (field.type === 'toggle') {
              return (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Switch
                      checked={!!value}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                    />
                  }
                  label={<Typography variant="body2">{td[field.labelKey] ?? field.labelKey}</Typography>}
                />
              );
            }

            if (field.type === 'select') {
              const opts = field.options ?? [];
              return (
                <FormControl key={field.key} fullWidth size="small">
                  <InputLabel>{td[field.labelKey] ?? field.labelKey}</InputLabel>
                  <Select
                    label={td[field.labelKey] ?? field.labelKey}
                    value={value as string}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  >
                    {opts.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{td[o.labelKey] ?? o.value}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            if (field.type === 'multiselect') {
              const selected = (value as string[]) || [];
              const opts = field.key === 'statusFilter'
                ? statuses.map((s) => ({ value: s.key, label: s.label }))
                : field.key === 'categoryFilter'
                ? categories.map((c) => ({ value: c, label: c }))
                : (field.options ?? []).map((o) => ({ value: o.value, label: td[o.labelKey] ?? o.value }));

              return (
                <FormControl key={field.key} fullWidth size="small">
                  <InputLabel>{td[field.labelKey] ?? field.labelKey}</InputLabel>
                  <Select
                    label={td[field.labelKey] ?? field.labelKey}
                    multiple
                    value={selected}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value as string[] }))}
                    renderValue={(sel) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(sel as string[]).map((v) => (
                          <Chip key={v} size="small" label={opts.find((o) => o.value === v)?.label ?? v} sx={{ height: 20 }} />
                        ))}
                      </Box>
                    )}
                  >
                    {opts.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        <Checkbox size="small" checked={selected.includes(o.value)} sx={{ p: 0.5 }} />
                        <ListItemText primary={o.label} primaryTypographyProps={{ variant: 'body2' }} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            return null;
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{td.wsCancel}</Button>
        <Button variant="contained" onClick={handleSave}>{td.wsSave}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── ADD WIDGET DIALOG ─────────────────────────────────────────────────────

function AddWidgetDialog({
  open, onClose, allWidgets, visibleIds, onAdd, t,
}: {
  open: boolean; onClose: () => void;
  allWidgets: WidgetMeta[]; visibleIds: string[]; onAdd: (id: string) => void; t: any;
}) {
  const entityTerm = useEntityTerm();
  const resolveLabel = (key: string): string => {
    const val = t.dashboard[key];
    return typeof val === 'function' ? val(entityTerm.plural) : (val || key);
  };
  const getBaseId = (id: string) => id.split('__')[0];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t.dashboard.addWidget}
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={0.5}>
          {(() => {
            const groups: { label: string; ids: string[] }[] = [
              { label: t.dashboard.wgStat   ?? 'Statistiche', ids: ['stat-open', 'stat-resolved', 'stat-urgent', 'stat-overdue'] },
              { label: t.dashboard.wgFeed   ?? 'Liste',       ids: ['feed-my', 'feed-due', 'feed-recent', 'feed-assigned', 'feed-open', 'feed-overdue', 'feed-person', 'feed-group', 'feed-category', 'feed-status', 'feed-all-assigned'] },
              { label: t.dashboard.wgOther  ?? 'Altro',       ids: ['workload', 'client-notes', 'acquisition'] },
              { label: t.dashboard.wgChart  ?? 'Grafici',     ids: ['chart-trend', 'chart-status', 'chart-category', 'chart-priority', 'chart-location', 'chart-assignee'] },
            ];
            return groups.map((group) => {
              const groupWidgets = group.ids
                .map((id) => allWidgets.find((w) => w.id === id))
                .filter((w): w is WidgetMeta => !!w);
              if (groupWidgets.length === 0) return null;
              return (
                <Box key={group.label}>
                  <Typography variant="overline" color="text.secondary" fontWeight={700} fontSize="0.68rem" lineHeight={1.8} display="block" mb={0.5}>
                    {group.label}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {groupWidgets.map((w) => {
                      const count = visibleIds.filter((id) => getBaseId(id) === w.id).length;
                      return (
                        <Chip
                          key={w.id}
                          label={count > 0 ? `${resolveLabel(w.labelKey)} (${count})` : resolveLabel(w.labelKey)}
                          onClick={() => onAdd(w.id)}
                          icon={<AddIcon />}
                          variant={count > 0 ? 'filled' : 'outlined'}
                          clickable
                          color="primary"
                        />
                      );
                    })}
                  </Box>
                </Box>
              );
            });
          })()}
          <Typography variant="caption" color="text.secondary">
            {t.dashboard.wsConfigureNote}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────

const CUSTOM_NAMES_KEY = 'td_widget_custom_names';
function useWidgetCustomNames() {
  const [names, setNames] = React.useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_NAMES_KEY) ?? '{}'); } catch { return {}; }
  });
  const setName = React.useCallback((id: string, name: string) => {
    setNames((prev) => {
      const next = { ...prev };
      if (name.trim()) next[id] = name.trim(); else delete next[id];
      localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { names, setName };
}

function Dashboard() {
  const { t } = useLanguage();
  const entityTerm = useEntityTerm();
  const resolveWidgetLabel = (key: string): string => {
    const val = (t.dashboard as Record<string, unknown>)[key];
    return typeof val === 'function' ? (val as (p: string) => string)(entityTerm.plural) : ((val as string) || key);
  };
  const { user } = useAuth();
  const isSuperAdmin = !!(user as unknown as Record<string, unknown>)?.isSuperAdmin;
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const clientsEnabled = (user as any)?.clientsEnabled !== false;

  const { data: dashStats } = useGetDashboardStats({ query: { staleTime: 30_000, refetchInterval: POLL_MS * 2, refetchIntervalInBackground: false } as any });
  const hasNoTickets = !!dashStats && dashStats.totalTickets === 0;

  const effectiveRegistry = WIDGET_REGISTRY.filter(
    (w) => (w.id !== 'acquisition' || isSuperAdmin) && (!w.requireAdmin || isAdmin) && (!w.requireClients || clientsEnabled),
  );
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { names: customNames, setName: setCustomName } = useWidgetCustomNames();

  const [editMode, setEditMode] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);

  const superadminDefaultLayout = (): LayoutItem[] => {
    if (!isSuperAdmin) return DEFAULT_LAYOUT;
    const acqMeta = WIDGET_REGISTRY.find((w) => w.id === 'acquisition');
    return acqMeta ? [...DEFAULT_LAYOUT, { i: 'acquisition', ...acqMeta.defaultLayout }] : DEFAULT_LAYOUT;
  };
  const superadminDefaultVisibleIds = (): string[] =>
    isSuperAdmin ? [...DEFAULT_VISIBLE_IDS, 'acquisition'] : DEFAULT_VISIBLE_IDS;

  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      return saved ? JSON.parse(saved) as LayoutItem[] : superadminDefaultLayout();
    } catch { return superadminDefaultLayout(); }
  });

  const [visibleIds, setVisibleIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(VISIBLE_KEY);
      return saved ? JSON.parse(saved) as string[] : superadminDefaultVisibleIds();
    } catch { return superadminDefaultVisibleIds(); }
  });

  // Load layout from server on mount (overrides localStorage if server has a saved layout)
  useEffect(() => {
    fetch('/api/dashboard-layout', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data || !data.layout || !data.visibleIds) return;
        setLayout(data.layout as LayoutItem[]);
        setVisibleIds(data.visibleIds as string[]);
        try {
          localStorage.setItem(LAYOUT_KEY, JSON.stringify(data.layout));
          localStorage.setItem(VISIBLE_KEY, JSON.stringify(data.visibleIds));
        } catch {}
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save to server
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToServer = React.useCallback((l: LayoutItem[], v: string[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch('/api/dashboard-layout', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: l, visibleIds: v }),
      }).catch(() => {});
    }, 1500);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
    saveToServer(layout, visibleIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_KEY, JSON.stringify(visibleIds)); } catch {}
    saveToServer(layout, visibleIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  useEffect(() => {
    if (!clientsEnabled) {
      setVisibleIds((prev) => {
        const filtered = prev.filter((id) => {
          const meta = WIDGET_REGISTRY.find((w) => w.id === id.split('__')[0]);
          return !meta?.requireClients;
        });
        return filtered.length !== prev.length ? filtered : prev;
      });
    }
  }, [clientsEnabled]);

  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    setLayout((prev) => {
      const prevIds = new Set(prev.map((item) => item.i));
      const merged = prev.map((item) => {
        const updated = newLayout.find((l) => l.i === item.i);
        return updated ? { ...item, ...updated } : item;
      });
      // Add items the grid placed that weren't in prev (e.g. newly added widgets)
      const added = newLayout.filter((l) => !prevIds.has(l.i));
      return added.length > 0 ? [...merged, ...added] : merged;
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
  }, []);

  const getBaseId = useCallback((id: string) => id.split('__')[0], []);

  const addWidget = useCallback((baseId: string) => {
    const meta = effectiveRegistry.find((w) => w.id === baseId);
    if (!meta) return;
    setVisibleIds((prev) => {
      const alreadyHasBase = prev.some((id) => getBaseId(id) === baseId);
      const instanceId = alreadyHasBase ? `${baseId}__${Date.now()}` : baseId;
      setLayout((prevLayout) => {
        const newItem: LayoutItem = { i: instanceId, ...meta.defaultLayout, y: Infinity };
        return [...prevLayout, newItem];
      });
      return [...prev, instanceId];
    });
    setAddDialogOpen(false);
  }, [effectiveRegistry, getBaseId]);

  const resetLayout = useCallback(() => {
    setLayout(superadminDefaultLayout());
    setVisibleIds(superadminDefaultVisibleIds());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const hiddenWidgets = effectiveRegistry.filter((w) => !visibleIds.includes(w.id));

  const activeLayout: LayoutItem[] = layout.filter((l) => visibleIds.includes(l.i));

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <TrialBanner />
      {hasNoTickets && isAdmin && (
        <Box
          sx={{
            textAlign: 'center',
            py: 5,
            px: 2,
            mb: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <OpenIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {t.dashboard.emptyStateTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            {t.dashboard.emptyStateDesc}
          </Typography>
          <Button
            component={Link}
            to="/tickets/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            {t.dashboard.emptyStateCta}
          </Button>
        </Box>
      )}
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between"
        mb={{ xs: 1.5, sm: 3 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight="bold" fontSize={{ xs: '1.1rem', sm: '1.4rem' }}>
          {t.dashboard.title}
        </Typography>

        {!isMobile && (
          <Box display="flex" alignItems="center" gap={1}>
            {editMode && (
              <>
                <Tooltip title={t.dashboard.resetLayout}>
                  <IconButton size="small" onClick={resetLayout} color="default">
                    <ResetIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                  disabled={hiddenWidgets.length === 0}
                >
                  {t.dashboard.addWidget}
                </Button>
              </>
            )}
            <Button
              size="small"
              variant={editMode ? 'contained' : 'outlined'}
              startIcon={editMode ? <CheckIcon /> : <EditIcon />}
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? t.dashboard.doneEditing : t.dashboard.editLayout}
            </Button>
          </Box>
        )}
      </Box>

      {/* Mobile edit bar */}
      {isMobile && (
        <Box display="flex" gap={1} mb={1.5}>
          <Button
            size="small" fullWidth
            variant={editMode ? 'contained' : 'outlined'}
            startIcon={editMode ? <CheckIcon /> : <EditIcon />}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? t.dashboard.doneEditing : t.dashboard.editLayout}
          </Button>
          {editMode && (
            <Button size="small" variant="outlined" onClick={() => setAddDialogOpen(true)}
              disabled={hiddenWidgets.length === 0}>
              <AddIcon fontSize="small" />
            </Button>
          )}
        </Box>
      )}

      {/* Edit mode hint */}
      {editMode && (
        <Paper variant="outlined" sx={{ px: 2, py: 1, mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2 }}>
          <Typography fontSize="0.8rem">
            {t.dashboard.editHint}
          </Typography>
        </Paper>
      )}

      {/* Grid — desktop drag/resize layout */}
      {!isMobile && (
        <ReactGridLayout
          layout={activeLayout}
          cols={12}
          rowHeight={60}
          margin={[12, 12]}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          compactType="vertical"
          onLayoutChange={handleLayoutChange}
          style={{ minHeight: 200 }}
        >
          {visibleIds.map((id) => {
            const meta = effectiveRegistry.find((w) => w.id === getBaseId(id));
            if (!meta) return null;
            const Cmp = meta.component;
            return (
              <div key={id}>
                <WidgetShell
                  editMode={editMode}
                  label={customNames[id] || resolveWidgetLabel(meta.labelKey)}
                  onRemove={() => removeWidget(id)}
                  onOpenSettings={() => setSettingsWidgetId(id)}
                >
                  <WidgetCustomNameContext.Provider value={customNames[id] || ''}>
                    <Cmp />
                  </WidgetCustomNameContext.Provider>
                </WidgetShell>
              </div>
            );
          })}
        </ReactGridLayout>
      )}

      {/* Mobile stacked layout — stat cards 2×2, other widgets full width */}
      {isMobile && (() => {
        const statIds   = visibleIds.filter((id) => getBaseId(id).startsWith('stat-'));
        const otherIds  = visibleIds.filter((id) => !getBaseId(id).startsWith('stat-'));
        const renderWidget = (id: string, height: number) => {
          const meta = effectiveRegistry.find((w) => w.id === getBaseId(id));
          if (!meta) return null;
          const Cmp = meta.component;
          return (
            <Box key={id} sx={{ height }}>
              <WidgetShell
                editMode={editMode}
                label={customNames[id] || resolveWidgetLabel(meta.labelKey)}
                onRemove={() => removeWidget(id)}
                onOpenSettings={() => setSettingsWidgetId(id)}
              >
                <WidgetCustomNameContext.Provider value={customNames[id] || ''}>
                  <Cmp />
                </WidgetCustomNameContext.Provider>
              </WidgetShell>
            </Box>
          );
        };
        return (
          <Box display="flex" flexDirection="column" gap={1.5}>
            {statIds.length > 0 && (
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
                {statIds.map((id) => renderWidget(id, 110))}
              </Box>
            )}
            {otherIds.map((id) => renderWidget(id, 380))}
          </Box>
        );
      })()}

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        allWidgets={effectiveRegistry}
        visibleIds={visibleIds}
        onAdd={addWidget}
        t={t}
      />

      {/* Widget Settings Dialog */}
      <WidgetSettingsDialog
        open={settingsWidgetId !== null}
        onClose={() => setSettingsWidgetId(null)}
        widgetId={settingsWidgetId ?? ''}
        meta={settingsWidgetId ? (effectiveRegistry.find((w) => w.id === getBaseId(settingsWidgetId)) ?? null) : null}
        customName={settingsWidgetId ? (customNames[settingsWidgetId] ?? '') : ''}
        onCustomNameChange={(name) => settingsWidgetId && setCustomName(settingsWidgetId, name)}
      />
    </Box>
  );
}

function DashboardWithProvider() {
  return (
    <WidgetSettingsProvider>
      <Dashboard />
    </WidgetSettingsProvider>
  );
}

export { DashboardWithProvider as default };
