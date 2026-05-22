import React from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress,
} from '@mui/material';
import { ArrowBack, ConfirmationNumber } from '@mui/icons-material';
import { useGetClient } from '@workspace/api-client-react';
import { useLocation, useParams } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  open: 'info',
  waiting: 'warning',
  resolved: 'success',
  closed: 'default',
};

const PRIORITY_COLORS: Record<string, 'default' | 'warning' | 'error' | 'info'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

export default function ClientDetail() {
  const { t } = useLanguage();
  const tc = t.clients;
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id ?? '', 10);

  const { data, isLoading, isError } = useGetClient(clientId);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" pt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => setLocation('/clients')} sx={{ mb: 2 }}>
          {tc.backToClients}
        </Button>
        <Typography color="error">Client not found.</Typography>
      </Box>
    );
  }

  const client = data as any;
  const tickets: any[] = client.tickets ?? [];

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => setLocation('/clients')} sx={{ mb: 3 }}>
        {tc.backToClients}
      </Button>

      <Typography variant="h5" fontWeight="bold" mb={3}>
        {tc.detailTitle}: {client.name}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                {tc.name}
              </Typography>
              <Typography variant="body1" fontWeight={500} mb={2}>{client.name}</Typography>

              {client.email && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                    {tc.email}
                  </Typography>
                  <Typography variant="body2" mb={2}>{client.email}</Typography>
                </>
              )}

              {client.phone && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                    {tc.phone}
                  </Typography>
                  <Typography variant="body2" mb={2}>{client.phone}</Typography>
                </>
              )}

              {client.vatNumber && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                    {tc.vatNumber}
                  </Typography>
                  <Typography variant="body2" mb={2}>{client.vatNumber}</Typography>
                </>
              )}

              {client.notes && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                    {tc.notes}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{client.notes}</Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" fontWeight={600} mb={2} display="flex" alignItems="center" gap={1}>
            <ConfirmationNumber fontSize="small" />
            {tc.linkedTickets} ({tickets.length})
          </Typography>

          {tickets.length === 0 ? (
            <Typography color="text.secondary">{tc.noLinkedTickets}</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colTitle}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colStatus}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colPriority}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.ticketList.colAssignee}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setLocation(`/tickets/${ticket.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          #{ticket.ticketNumber ?? ticket.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{ticket.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(t.status as any)[ticket.status] ?? ticket.status}
                          color={STATUS_COLORS[ticket.status] ?? 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={(t.priority as any)[ticket.priority] ?? ticket.priority}
                          color={PRIORITY_COLORS[ticket.priority] ?? 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ticket.assignedToName ?? t.ticketDetail.unassigned}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
