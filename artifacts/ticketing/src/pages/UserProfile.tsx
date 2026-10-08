import React from 'react';
import {
  Box, Card, Avatar, Typography, Chip, CircularProgress,
  Button, Divider, MenuItem, Stack, TextField, useMediaQuery, useTheme,
} from '@mui/material';
import { ArrowBack, Email, Place, Group, WorkOutline, ConfirmationNumber, AssignmentInd } from '@mui/icons-material';
import { useParams, useLocation, Link } from 'wouter';
import { useGetUser, useListTickets } from '@workspace/api-client-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getPriorityColor } from './Dashboard';
import { useTicketStatuses } from '../hooks/useTicketStatuses';

function TicketCard({ ticket, dateLocale, t, onNavigate }: { ticket: any; dateLocale: string; t: any; onNavigate: (id: number) => void }) {
  const { getLabelForKey, getColorForKey } = useTicketStatuses();
  const statusColor = getColorForKey(ticket.status);
  return (
    <Card
      variant="outlined"
      onClick={() => onNavigate(ticket.id)}
      sx={{
        p: 2,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.75}>
        <Typography variant="body2" fontWeight="bold" sx={{ flexShrink: 0, color: 'text.secondary', fontSize: '0.75rem' }}>
          #{ticket.ticketNumber ?? ticket.id}
        </Typography>
        <Box display="flex" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
          <Chip
            label={getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status}
            size="small"
            sx={statusColor ? { bgcolor: statusColor, color: '#fff' } : undefined}
          />
          <Chip label={t.priority[ticket.priority] ?? ticket.priority} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
        </Box>
      </Box>
      <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5, lineHeight: 1.3 }}>
        {ticket.title}
      </Typography>
      {ticket.category && (
        <Typography variant="caption" color="text.secondary">{ticket.category}</Typography>
      )}
      <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
        {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
      </Typography>
    </Card>
  );
}

function TicketSection({ title, icon, tickets, dateLocale, t, onNavigate }: {
  title: string;
  icon: React.ReactNode;
  tickets: any[];
  dateLocale: string;
  t: any;
  onNavigate: (id: number) => void;
}) {
  if (tickets.length === 0) return null;
  return (
    <Card sx={{ mb: 2 }}>
      <Box px={{ xs: 2, sm: 3 }} pt={2.5} pb={2}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {icon}
          <Typography variant="subtitle1" fontWeight="bold">
            {title} <Typography component="span" color="text.secondary" fontWeight="normal">({tickets.length})</Typography>
          </Typography>
        </Box>
        <Stack spacing={1.25}>
          {tickets.map((ticket: any) => (
            <TicketCard key={ticket.id} ticket={ticket} dateLocale={dateLocale} t={t} onNavigate={onNavigate} />
          ))}
        </Stack>
      </Box>
    </Card>
  );
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { t, lang } = useLanguage();
  const { user: currentUser } = useAuth();
  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';
  const theme = useTheme();
  const [ticketScope, setTicketScope] = React.useState<'all' | 'created' | 'assigned'>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'open' | 'closed'>('all');

  const { data: user, isLoading } = useGetUser(userId);
  const { data: createdTickets, isLoading: isLoadingCreated } = useListTickets({ createdBy: userId });
  const { data: assignedTickets, isLoading: isLoadingAssigned } = useListTickets({ assignedTo: userId });
  const { isClosedKey } = useTicketStatuses();

  if (isLoading) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  if (!user) {
    return (
      <Box textAlign="center" mt={10}>
        <Typography variant="h6" color="text.secondary">{t.userProfile.notFound}</Typography>
        <Button onClick={() => setLocation('/tickets')} sx={{ mt: 2 }}>{t.userProfile.back}</Button>
      </Box>
    );
  }

  const matchesStatus = (ticket: any) => (
    statusFilter === 'all' ||
    (statusFilter === 'closed' ? isClosedKey(ticket.status) : !isClosedKey(ticket.status))
  );
  const created = ticketScope === 'assigned'
    ? []
    : (createdTickets ?? []).filter(matchesStatus);
  const assignedCandidates = ticketScope === 'created'
    ? []
    : (assignedTickets ?? []).filter(matchesStatus);
  const createdIds = new Set(created.map((ticket: any) => ticket.id));
  const assigned = ticketScope === 'all'
    ? assignedCandidates.filter((ticket: any) => !createdIds.has(ticket.id))
    : assignedCandidates;
  const hasAnyTickets = (createdTickets?.length ?? 0) + (assignedTickets?.length ?? 0) > 0;
  const isLoadingTickets = isLoadingCreated || isLoadingAssigned;

  return (
    <Box maxWidth={700} mx="auto">
      <Button
        startIcon={<ArrowBack />}
        onClick={() => history.back()}
        sx={{ mb: 2 }}
        color="inherit"
        size="small"
      >
        {t.userProfile.back}
      </Button>

      {/* Profile card */}
      <Card sx={{ mb: 2 }}>
        <Box p={{ xs: 2, sm: 3 }}>
          <Box display="flex" gap={{ xs: 2, sm: 3 }} alignItems="flex-start">
            <Avatar
              src={(user as any).avatarUrl ?? undefined}
              sx={{
                width: { xs: 56, sm: 72 },
                height: { xs: 56, sm: 72 },
                fontSize: { xs: 24, sm: 30 },
                bgcolor: 'primary.main',
                flexShrink: 0,
              }}
            >
              {user.name?.charAt(0)}
            </Avatar>

            <Box flex={1} minWidth={0}>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={0.5}>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  {user.name}
                </Typography>
                <Chip
                  label={t.role[user.role] ?? user.role}
                  size="small"
                  color={user.role === 'admin' ? 'primary' : 'default'}
                  variant="outlined"
                />
                {!(user as any).isActive && (
                  <Chip label={t.users.inactive} size="small" color="error" variant="outlined" />
                )}
              </Box>

              <Stack spacing={0.5} mt={0.75}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <Email sx={{ fontSize: 15, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                    {user.email}
                  </Typography>
                </Box>
                {(user as any).mainLocation && (
                  <Box display="flex" alignItems="center" gap={0.75}>
                    <Place sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">{(user as any).mainLocation}</Typography>
                  </Box>
                )}
                {(user as any).group && (
                  <Box display="flex" alignItems="center" gap={0.75}>
                    <Group sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">{(user as any).group}</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>

          {currentUser?.role === 'admin' && (
            <>
              <Divider sx={{ my: 2 }} />
              <Button
                variant="outlined"
                size="small"
                onClick={() => setLocation('/users')}
                startIcon={<WorkOutline />}
                fullWidth={false}
              >
                {t.userProfile.manageUser}
              </Button>
            </>
          )}
        </Box>
      </Card>

      <Card sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} p={2}>
          <TextField
            select
            size="small"
            fullWidth
            label={t.userProfile.scopeFilter}
            value={ticketScope}
            onChange={(event) => setTicketScope(event.target.value as typeof ticketScope)}
          >
            <MenuItem value="all">{t.userProfile.scopeAll}</MenuItem>
            <MenuItem value="created">{t.userProfile.openTickets}</MenuItem>
            <MenuItem value="assigned">{t.userProfile.assignedTickets}</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            fullWidth
            label={t.userProfile.statusFilter}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <MenuItem value="all">{t.userProfile.statusAll}</MenuItem>
            <MenuItem value="open">{t.userProfile.statusOpen}</MenuItem>
            <MenuItem value="closed">{t.userProfile.statusClosed}</MenuItem>
          </TextField>
        </Stack>
      </Card>

      {/* Ticket creati */}
      <TicketSection
        title={t.userProfile.openTickets}
        icon={<ConfirmationNumber fontSize="small" color="action" />}
        tickets={created}
        dateLocale={dateLocale}
        t={t}
        onNavigate={(id) => setLocation(`/tickets/${id}`)}
      />

      {/* Ticket assegnati */}
      <TicketSection
        title={t.userProfile.assignedTickets}
        icon={<AssignmentInd fontSize="small" color="action" />}
        tickets={assigned}
        dateLocale={dateLocale}
        t={t}
        onNavigate={(id) => setLocation(`/tickets/${id}`)}
      />

      {isLoadingTickets ? (
        <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
      ) : created.length === 0 && assigned.length === 0 && (
        <Card>
          <Box p={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              {hasAnyTickets ? t.userProfile.noFilteredTickets : t.userProfile.noTickets}
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}
