import React from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Chip, Table, TableBody, TableCell, TableHead, TableRow, Button } from '@mui/material';
import { useGetDashboardStats, useGetRecentTickets, useGetMyTickets } from '@workspace/api-client-react';
import { Link } from 'wouter';

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

export function getStatusLabel(status: string) {
  switch (status) {
    case 'open': return 'Aperto';
    case 'in_progress': return 'In lavorazione';
    case 'waiting': return 'In attesa';
    case 'resolved': return 'Risolto';
    case 'closed': return 'Chiuso';
    default: return status;
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

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case 'low': return 'Bassa';
    case 'medium': return 'Media';
    case 'high': return 'Alta';
    case 'urgent': return 'Urgente';
    default: return priority;
  }
}

function StatCard({ title, value, color = 'primary.main' }: { title: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent>
        <Typography color="text.secondary" gutterBottom variant="subtitle2">
          {title}
        </Typography>
        <Typography variant="h3" component="div" sx={{ color, fontWeight: 'bold' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
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
      <Typography variant="h4" fontWeight="bold" gutterBottom mb={3}>
        Dashboard
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Ticket Aperti" value={stats?.openTickets || 0} color="primary.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="In Lavorazione" value={stats?.inProgressTickets || 0} color="warning.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Urgenti" value={stats?.urgentTickets || 0} color="error.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Chiusi" value={stats?.closedTickets || 0} color="text.secondary" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">I Miei Ticket</Typography>
                <Button component={Link} href="/tickets" size="small">Vedi tutti</Button>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Titolo</TableCell>
                      <TableCell>Stato</TableCell>
                      <TableCell>Priorità</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(myTickets || []).slice(0, 5).map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        hover
                        sx={{ cursor: 'pointer', textDecoration: 'none' }}
                        component={Link}
                        href={`/tickets/${ticket.id}`}
                      >
                        <TableCell>#{ticket.id}</TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ticket.title}
                        </TableCell>
                        <TableCell>
                          <Chip label={getStatusLabel(ticket.status)} size="small" color={getStatusColor(ticket.status) as any} />
                        </TableCell>
                        <TableCell>
                          <Chip label={getPriorityLabel(ticket.priority)} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!myTickets || myTickets.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          Nessun ticket assegnato.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">Attività Recente</Typography>
                <Button component={Link} href="/tickets" size="small">Vedi tutti</Button>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Titolo</TableCell>
                      <TableCell>Stato</TableCell>
                      <TableCell>Priorità</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(recentTickets || []).slice(0, 5).map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        hover
                        sx={{ cursor: 'pointer', textDecoration: 'none' }}
                        component={Link}
                        href={`/tickets/${ticket.id}`}
                      >
                        <TableCell>#{ticket.id}</TableCell>
                        <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ticket.title}
                        </TableCell>
                        <TableCell>
                          <Chip label={getStatusLabel(ticket.status)} size="small" color={getStatusColor(ticket.status) as any} />
                        </TableCell>
                        <TableCell>
                          <Chip label={getPriorityLabel(ticket.priority)} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
