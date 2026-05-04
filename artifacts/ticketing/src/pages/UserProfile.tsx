import React from 'react';
import {
  Box, Card, Avatar, Typography, Chip, Divider, CircularProgress,
  Button, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper,
} from '@mui/material';
import { ArrowBack, Email, Place, Group, WorkOutline } from '@mui/icons-material';
import { useParams, useLocation, Link } from 'wouter';
import { useGetUser, useListTickets } from '@workspace/api-client-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getStatusColor, getPriorityColor } from './Dashboard';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { t, lang } = useLanguage();
  const { user: currentUser } = useAuth();
  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  const { data: user, isLoading } = useGetUser(userId);
  const { data: createdTickets } = useListTickets({ createdBy: String(userId) });
  const { data: assignedTickets } = useListTickets({ assignedTo: String(userId) });

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

  const open = (createdTickets ?? []).filter((t: any) => t.status !== 'resolved' && t.status !== 'closed');
  const assigned = (assignedTickets ?? []).filter((t: any) => t.status !== 'resolved' && t.status !== 'closed');

  return (
    <Box maxWidth={800} mx="auto">
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
      <Card sx={{ mb: 3 }}>
        <Box p={3} display="flex" gap={3} alignItems="flex-start" flexWrap="wrap">
          <Avatar
            src={(user as any).avatarUrl ?? undefined}
            sx={{ width: 80, height: 80, fontSize: 32, bgcolor: 'primary.main', flexShrink: 0 }}
          >
            {user.name?.charAt(0)}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" mb={0.5}>
              <Typography variant="h5" fontWeight="bold">{user.name}</Typography>
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

            <Box display="flex" flexDirection="column" gap={0.75} mt={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <Email fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              </Box>
              {(user as any).mainLocation && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Place fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">{(user as any).mainLocation}</Typography>
                </Box>
              )}
              {(user as any).group && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Group fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">{(user as any).group}</Typography>
                </Box>
              )}
            </Box>
          </Box>

          {currentUser?.role === 'admin' && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setLocation('/users')}
              startIcon={<WorkOutline />}
            >
              {t.userProfile.manageUser}
            </Button>
          )}
        </Box>
      </Card>

      {/* Open tickets created by this user */}
      {open.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <Box px={3} pt={2.5} pb={1}>
            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
              {t.userProfile.openTickets} ({open.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>{t.ticketList.colTitle}</TableCell>
                    <TableCell>{t.ticketList.colStatus}</TableCell>
                    <TableCell>{t.ticketList.colPriority}</TableCell>
                    <TableCell>{t.ticketList.colCreated}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {open.map((ticket: any) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setLocation(`/tickets/${ticket.id}`)}
                    >
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" noWrap>{ticket.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={t.status[ticket.status] ?? ticket.status} size="small" color={getStatusColor(ticket.status) as any} />
                      </TableCell>
                      <TableCell>
                        <Chip label={t.priority[ticket.priority] ?? ticket.priority} size="small" color={getPriorityColor(ticket.priority) as any} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box px={3} py={1.5} />
        </Card>
      )}

      {/* Tickets assigned to this user */}
      {assigned.length > 0 && (
        <Card>
          <Box px={3} pt={2.5} pb={1}>
            <Typography variant="subtitle1" fontWeight="bold" mb={2}>
              {t.userProfile.assignedTickets} ({assigned.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>{t.ticketList.colTitle}</TableCell>
                    <TableCell>{t.ticketList.colStatus}</TableCell>
                    <TableCell>{t.ticketList.colPriority}</TableCell>
                    <TableCell>{t.ticketList.colCreated}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assigned.map((ticket: any) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setLocation(`/tickets/${ticket.id}`)}
                    >
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" noWrap>{ticket.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={t.status[ticket.status] ?? ticket.status} size="small" color={getStatusColor(ticket.status) as any} />
                      </TableCell>
                      <TableCell>
                        <Chip label={t.priority[ticket.priority] ?? ticket.priority} size="small" color={getPriorityColor(ticket.priority) as any} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box px={3} py={1.5} />
        </Card>
      )}

      {open.length === 0 && assigned.length === 0 && (
        <Card>
          <Box p={4} textAlign="center">
            <Typography variant="body2" color="text.secondary">{t.userProfile.noTickets}</Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}
