import React from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CircularProgress,
  Chip, Button, Avatar,
} from '@mui/material';
import { useGetDashboardStats, useGetRecentTickets, useGetMyTickets } from '@workspace/api-client-react';
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
    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography color="text.secondary" gutterBottom variant="subtitle2" noWrap>
        {title}
      </Typography>
      <Typography
        component="div"
        sx={{ color, fontWeight: 'bold', fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }, lineHeight: 1 }}
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

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1}>
          <Typography variant="h6" fontWeight="bold">{title}</Typography>
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
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
                borderTop: idx === 0 ? '1px solid' : 'none',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: '0.75rem',
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  flexShrink: 0,
                }}
              >
                #{ticket.id}
              </Avatar>

              <Box flex={1} minWidth={0}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {ticket.title}
                </Typography>
                {ticket.category && (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {ticket.category}
                  </Typography>
                )}
              </Box>

              <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} flexShrink={0}>
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
            </Box>
          ))
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

  if (statsLoading || recentLoading || myLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={3}>
        {t.dashboard.title}
      </Typography>

      <Grid container spacing={2} mb={3}>
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

      <Grid container spacing={2}>
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
    </Box>
  );
}
