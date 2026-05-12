import React from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Chip, Button, Avatar, useMediaQuery, useTheme, Divider,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  FolderOpen as OpenIcon,
  CheckCircle as ResolvedIcon,
  PriorityHigh as UrgentIcon,
  Warning as OverdueIcon,
} from '@mui/icons-material';
import { useGetDashboardStats, useGetMyTickets, useGetDueSoonTickets } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

export function getStatusColor(status: string) {
  switch (status) {
    case 'open': return 'primary';
    case 'in_progress': return 'warning';
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

function StatCard({
  title,
  value,
  color,
  bgColor,
  icon,
  href,
}: {
  title: string;
  value: number;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography
            color="text.secondary"
            variant="caption"
            display="block"
            fontWeight={500}
            mb={0.5}
            fontSize={{ xs: '0.65rem', sm: '0.75rem' }}
            textTransform="uppercase"
            letterSpacing={0.5}
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
        <Box
          sx={{
            width: { xs: 36, sm: 44 },
            height: { xs: 36, sm: 44 },
            borderRadius: 2,
            bgcolor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  );

  if (href) {
    return (
      <Card
        component={Link}
        href={href}
        sx={{
          height: '100%',
          display: 'block',
          textDecoration: 'none',
          transition: 'box-shadow 0.15s, transform 0.15s',
          cursor: 'pointer',
          '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
        }}
      >
        {inner}
      </Card>
    );
  }
  return <Card sx={{ height: '100%' }}>{inner}</Card>;
}

type TicketRow = {
  id: number;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  dueAt?: string | null;
  ticketNumber?: number | null;
};

function getDueBadge(dueAt: string, t: any): { label: string; color: 'error' | 'warning' } {
  const diffDays = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return { label: t.dashboard.overdueLabel, color: 'error' };
  if (diffDays === 0) return { label: t.dashboard.dueToday, color: 'error' };
  if (diffDays === 1) return { label: t.dashboard.dueTomorrow, color: 'warning' };
  return { label: `${diffDays} ${t.dashboard.dueInDays}`, color: 'warning' };
}

function TicketRow({ ticket, showDueBadge = false }: { ticket: TicketRow; showDueBadge?: boolean }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dueBadge = showDueBadge && ticket.dueAt ? getDueBadge(ticket.dueAt, t) : null;

  return (
    <Box
      component={Link}
      href={`/tickets/${ticket.id}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1, sm: 1.25 },
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        overflow: 'hidden',
      }}
    >
      {!isMobile && (
        <Avatar
          sx={{
            width: 30, height: 30, fontSize: '0.65rem', flexShrink: 0,
            bgcolor: ticket.status === 'open' ? 'primary.light'
              : ticket.status === 'in_progress' ? 'warning.light'
              : ticket.status === 'waiting' ? 'secondary.light'
              : ticket.status === 'resolved' ? 'success.light'
              : ticket.status === 'closed' ? 'action.selected'
              : 'primary.light',
            color: ticket.status === 'open' ? 'primary.contrastText'
              : ticket.status === 'in_progress' ? 'warning.contrastText'
              : ticket.status === 'waiting' ? 'secondary.contrastText'
              : ticket.status === 'resolved' ? 'success.contrastText'
              : 'text.secondary',
          }}
        >
          #{ticket.ticketNumber ?? ticket.id}
        </Avatar>
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
        <Chip
          label={t.status[ticket.status] || ticket.status}
          size="small"
          color={getStatusColor(ticket.status) as any}
          sx={{ fontSize: '0.62rem', height: 20 }}
        />
        {!isMobile && (
          <Chip
            label={t.priority[ticket.priority] || ticket.priority}
            size="small"
            variant="outlined"
            color={getPriorityColor(ticket.priority) as any}
            sx={{ fontSize: '0.62rem', height: 20 }}
          />
        )}
      </Box>
    </Box>
  );
}

function FeedCard({
  title,
  icon,
  tickets,
  emptyMsg,
  viewAllHref,
  showDueBadge = false,
  accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  tickets: TicketRow[];
  emptyMsg: string;
  viewAllHref?: string;
  showDueBadge?: boolean;
  accentColor?: string;
}) {
  const { t } = useLanguage();
  return (
    <Card sx={{ height: '100%', ...(accentColor ? { borderTop: 3, borderColor: accentColor } : {}) }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center"
          px={{ xs: 1.5, sm: 2 }} pt={{ xs: 1.5, sm: 2 }} pb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {icon}
            <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.9rem', sm: '1.1rem' }}>
              {title}
            </Typography>
            {tickets.length > 0 && (
              <Chip label={tickets.length} size="small"
                color={accentColor ? 'warning' : 'default'}
                sx={{ height: 18, fontSize: '0.65rem' }} />
            )}
          </Box>
          <Button component={Link} href={viewAllHref || '/tickets'} size="small" sx={{ fontSize: '0.75rem' }}>
            {t.dashboard.viewAll}
          </Button>
        </Box>

        <Divider />

        {tickets.length === 0 ? (
          <Box px={2} py={3}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {emptyMsg}
            </Typography>
          </Box>
        ) : (
          tickets.map((ticket, idx) => (
            <React.Fragment key={ticket.id}>
              <TicketRow ticket={ticket} showDueBadge={showDueBadge} />
              {idx < tickets.length - 1 && <Divider sx={{ mx: 2 }} />}
            </React.Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const theme = useTheme();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: myTickets, isLoading: myLoading } = useGetMyTickets();
  const { data: dueSoonTickets, isLoading: dueSoonLoading } = useGetDueSoonTickets();

  if (statsLoading || myLoading || dueSoonLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const dueSoon = (dueSoonTickets || []).slice(0, 8);
  const myOpen = (myTickets || []).filter((t) => !['resolved', 'closed'].includes(t.status)).slice(0, 8);

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Typography variant="h5" fontWeight="bold" mb={{ xs: 1.5, sm: 3 }} fontSize={{ xs: '1.1rem', sm: '1.4rem' }}>
        {t.dashboard.title}
      </Typography>

      <Grid container spacing={{ xs: 1, sm: 2 }} mb={{ xs: 2, sm: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title={t.dashboard.openTickets}
            value={stats?.openTickets || 0}
            color={theme.palette.primary.main}
            bgColor={theme.palette.mode === 'dark' ? 'rgba(25,118,210,0.15)' : '#e3f2fd'}
            icon={<OpenIcon fontSize="small" />}
            href="/tickets?status=open"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title={t.dashboard.resolved}
            value={stats?.resolvedTickets || 0}
            color={theme.palette.success.main}
            bgColor={theme.palette.mode === 'dark' ? 'rgba(46,125,50,0.15)' : '#e8f5e9'}
            icon={<ResolvedIcon fontSize="small" />}
            href="/tickets?status=resolved"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title={t.dashboard.urgent}
            value={stats?.urgentTickets || 0}
            color={theme.palette.error.main}
            bgColor={theme.palette.mode === 'dark' ? 'rgba(211,47,47,0.15)' : '#ffebee'}
            icon={<UrgentIcon fontSize="small" />}
            href="/tickets?priority=urgent"
          />
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <StatCard
            title={t.dashboard.overdue}
            value={(stats as any)?.overdueTickets || 0}
            color={theme.palette.warning.dark}
            bgColor={theme.palette.mode === 'dark' ? 'rgba(230,81,0,0.15)' : '#fff3e0'}
            icon={<OverdueIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={12} md={6}>
          <FeedCard
            title={t.dashboard.myTickets}
            icon={<Avatar sx={{ width: 22, height: 22, bgcolor: 'primary.main', fontSize: '0.6rem' }}>IO</Avatar>}
            tickets={myOpen}
            emptyMsg={t.dashboard.noAssignedTickets}
            viewAllHref="/tickets"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FeedCard
            title={t.dashboard.dueSoon}
            icon={<ScheduleIcon fontSize="small" color={dueSoon.length > 0 ? 'warning' : 'disabled'} />}
            tickets={dueSoon}
            emptyMsg={t.dashboard.noDueSoon}
            viewAllHref="/tickets"
            showDueBadge
            accentColor={dueSoon.length > 0 ? 'warning.main' : undefined}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
