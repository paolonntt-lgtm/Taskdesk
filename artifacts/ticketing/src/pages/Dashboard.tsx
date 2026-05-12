import React from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Chip, Button, Avatar, useMediaQuery, useTheme,
} from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { useGetDashboardStats, useGetRecentTickets, useGetMyTickets, useGetDueSoonTickets } from '@workspace/api-client-react';
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
  color = 'primary.main',
  href,
}: {
  title: string;
  value: number;
  color?: string;
  href?: string;
}) {
  const inner = (
    <CardContent sx={{ p: { xs: 1, sm: 3 }, '&:last-child': { pb: { xs: 1, sm: 3 } } }}>
      <Typography color="text.secondary" gutterBottom variant="subtitle2" noWrap fontSize={{ xs: '0.65rem', sm: '0.875rem' }}>
        {title}
      </Typography>
      <Typography
        component="div"
        sx={{ color, fontWeight: 'bold', fontSize: { xs: '1.4rem', sm: '2.5rem', md: '3rem' }, lineHeight: 1 }}
      >
        {value}
      </Typography>
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

interface TicketItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  category?: string;
}

function TicketListCard({ title, tickets, emptyMsg, viewAllLabel, viewAllHref }: {
  title: string;
  tickets: TicketItem[];
  emptyMsg: string;
  viewAllLabel: string;
  viewAllHref?: string;
}) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" px={{ xs: 1.5, sm: 2 }} pt={{ xs: 1.5, sm: 2 }} pb={1}>
          <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.95rem', sm: '1.25rem' }}>{title}</Typography>
          <Button component={Link} href={viewAllHref || '/tickets'} size="small">{viewAllLabel}</Button>
        </Box>

        {tickets.length === 0 ? (
          <Box px={2} pb={2}>
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {emptyMsg}
            </Typography>
          </Box>
        ) : (
          tickets.map((ticket, idx) => (
            <Box
              key={ticket.id}
              component={Link}
              href={`/tickets/${ticket.id}`}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                px: { xs: 1.5, sm: 2 },
                py: { xs: 1, sm: 1.5 },
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
                borderTop: idx === 0 ? '1px solid' : 'none',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
                '&:last-child': { borderBottom: 'none' },
                overflow: 'hidden',
              }}
            >
              {!isMobile && (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.7rem',
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    flexShrink: 0,
                  }}
                >
                  #{(ticket as any).ticketNumber ?? ticket.id}
                </Avatar>
              )}

              <Box flex={1} minWidth={0}>
                <Typography variant="body2" fontWeight="medium" noWrap fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                  {isMobile && <Typography component="span" variant="caption" color="text.secondary" mr={0.5}>#{(ticket as any).ticketNumber ?? ticket.id}</Typography>}
                  {ticket.title}
                </Typography>
                {ticket.category && (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {ticket.category}
                  </Typography>
                )}
                {isMobile && (
                  <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                    <Chip
                      label={t.status[ticket.status] || ticket.status}
                      size="small"
                      color={getStatusColor(ticket.status) as any}
                      sx={{ fontSize: '0.65rem', height: 18 }}
                    />
                    <Chip
                      label={t.priority[ticket.priority] || ticket.priority}
                      size="small"
                      variant="outlined"
                      color={getPriorityColor(ticket.priority) as any}
                      sx={{ fontSize: '0.65rem', height: 18 }}
                    />
                  </Box>
                )}
              </Box>

              {!isMobile && (
                <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} flexShrink={0} maxWidth={120}>
                  <Chip
                    label={t.status[ticket.status] || ticket.status}
                    size="small"
                    color={getStatusColor(ticket.status) as any}
                  />
                  <Chip
                    label={t.priority[ticket.priority] || ticket.priority}
                    size="small"
                    variant="outlined"
                    color={getPriorityColor(ticket.priority) as any}
                  />
                </Box>
              )}
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function getDueBadge(dueAt: string, t: any): { label: string; color: 'error' | 'warning' | 'default' } {
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: t.dashboard.overdue, color: 'error' };
  if (diffDays === 0) return { label: t.dashboard.dueToday, color: 'error' };
  if (diffDays === 1) return { label: t.dashboard.dueTomorrow, color: 'warning' };
  return { label: `${diffDays} ${t.dashboard.dueInDays}`, color: 'warning' };
}

function DueSoonCard({ tickets }: { tickets: Array<{ id: number; title: string; status: string; priority: string; category?: string | null; dueAt?: string | null; ticketNumber?: number | null }> }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Card sx={{ height: '100%', borderLeft: 3, borderColor: tickets.length > 0 ? 'warning.main' : 'divider' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" px={{ xs: 1.5, sm: 2 }} pt={{ xs: 1.5, sm: 2 }} pb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <ScheduleIcon fontSize="small" color={tickets.length > 0 ? 'warning' : 'disabled'} />
            <Typography variant="h6" fontWeight="bold" fontSize={{ xs: '0.95rem', sm: '1.25rem' }}>
              {t.dashboard.dueSoon}
            </Typography>
            {tickets.length > 0 && (
              <Chip label={tickets.length} size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>
          <Button component={Link} href="/tickets" size="small">{t.dashboard.viewAll}</Button>
        </Box>

        {tickets.length === 0 ? (
          <Box px={2} pb={2}>
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              {t.dashboard.noDueSoon}
            </Typography>
          </Box>
        ) : (
          tickets.map((ticket, idx) => {
            const badge = ticket.dueAt ? getDueBadge(ticket.dueAt, t) : null;
            return (
              <Box
                key={ticket.id}
                component={Link}
                href={`/tickets/${ticket.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1, sm: 1.5 },
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  borderTop: idx === 0 ? '1px solid' : 'none',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:last-child': { borderBottom: 'none' },
                  overflow: 'hidden',
                }}
              >
                {!isMobile && (
                  <Avatar
                    sx={{
                      width: 32, height: 32, fontSize: '0.7rem',
                      bgcolor: badge?.color === 'error' ? 'error.light' : 'warning.light',
                      color: badge?.color === 'error' ? 'error.contrastText' : 'warning.contrastText',
                      flexShrink: 0,
                    }}
                  >
                    #{(ticket as any).ticketNumber ?? ticket.id}
                  </Avatar>
                )}

                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" fontWeight="medium" noWrap fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>
                    {isMobile && (
                      <Typography component="span" variant="caption" color="text.secondary" mr={0.5}>
                        #{(ticket as any).ticketNumber ?? ticket.id}
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

                <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} flexShrink={0}>
                  {badge && (
                    <Chip
                      label={badge.label}
                      size="small"
                      color={badge.color}
                      sx={{ fontSize: '0.65rem', height: 20, fontWeight: 'bold' }}
                    />
                  )}
                  {!isMobile && (
                    <Chip
                      label={t.status[ticket.status] || ticket.status}
                      size="small"
                      color={getStatusColor(ticket.status) as any}
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentTickets, isLoading: recentLoading } = useGetRecentTickets();
  const { data: myTickets, isLoading: myLoading } = useGetMyTickets();
  const { data: dueSoonTickets, isLoading: dueSoonLoading } = useGetDueSoonTickets();

  if (statsLoading || recentLoading || myLoading || dueSoonLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const dueSoon = dueSoonTickets || [];

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={{ xs: 1.5, sm: 3 }} fontSize={{ xs: '1.1rem', sm: '1.5rem' }}>
        {t.dashboard.title}
      </Typography>

      <Grid container spacing={{ xs: 1, sm: 2 }} mb={{ xs: 1.5, sm: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard
            title={t.dashboard.openTickets}
            value={stats?.openTickets || 0}
            color="primary.main"
            href="/tickets?status=open"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title={t.dashboard.inProgress}
            value={stats?.inProgressTickets || 0}
            color="warning.main"
            href="/tickets?status=in_progress"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title={t.dashboard.urgent}
            value={stats?.urgentTickets || 0}
            color="error.main"
            href="/tickets?priority=urgent"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title={t.dashboard.closed}
            value={stats?.closedTickets || 0}
            color="text.secondary"
            href="/tickets?status=closed"
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1, sm: 2 }} mb={{ xs: 1.5, sm: 2 }}>
        <Grid item xs={12} md={6}>
          <TicketListCard
            title={t.dashboard.myTickets}
            tickets={(myTickets || []).slice(0, 5)}
            emptyMsg={t.dashboard.noAssignedTickets}
            viewAllLabel={t.dashboard.viewAll}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TicketListCard
            title={t.dashboard.recentActivity}
            tickets={(recentTickets || []).slice(0, 5)}
            emptyMsg=""
            viewAllLabel={t.dashboard.viewAll}
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1, sm: 2 }}>
        <Grid item xs={12}>
          <DueSoonCard tickets={dueSoon.slice(0, 8)} />
        </Grid>
      </Grid>
    </Box>
  );
}
