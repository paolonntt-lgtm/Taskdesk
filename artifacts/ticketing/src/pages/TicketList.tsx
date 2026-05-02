import React, { useState } from 'react';
import { Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useListTickets } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { getStatusColor, getPriorityColor, getStatusLabel, getPriorityLabel } from './Dashboard';
import { useDebounce } from '../lib/utils';

export default function TicketList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');

  const { data: tickets, isLoading } = useListTickets({
    search: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
    priority: priority !== 'all' ? priority : undefined,
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">Tutti i Ticket</Typography>
        <Button component={Link} href="/tickets/new" variant="contained" color="primary">
          Nuovo Ticket
        </Button>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Cerca ticket per titolo, descrizione, commenti..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Stato"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">Tutti gli stati</MenuItem>
              <MenuItem value="open">Aperto</MenuItem>
              <MenuItem value="in_progress">In lavorazione</MenuItem>
              <MenuItem value="waiting">In attesa</MenuItem>
              <MenuItem value="resolved">Risolto</MenuItem>
              <MenuItem value="closed">Chiuso</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Priorità"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <MenuItem value="all">Tutte le priorità</MenuItem>
              <MenuItem value="low">Bassa</MenuItem>
              <MenuItem value="medium">Media</MenuItem>
              <MenuItem value="high">Alta</MenuItem>
              <MenuItem value="urgent">Urgente</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Titolo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Categoria</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Stato</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Priorità</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Assegnato a</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Creato il</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : tickets?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Nessun ticket trovato con i filtri selezionati.
                  </TableCell>
                </TableRow>
              ) : (
                tickets?.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    hover
                    sx={{ cursor: 'pointer', textDecoration: 'none' }}
                    component={Link}
                    href={`/tickets/${ticket.id}`}
                  >
                    <TableCell sx={{ fontWeight: 'bold' }}>#{ticket.id}</TableCell>
                    <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ticket.title}
                    </TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(ticket.status)}
                        size="small"
                        color={getStatusColor(ticket.status) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPriorityLabel(ticket.priority)}
                        size="small"
                        variant="outlined"
                        color={getPriorityColor(ticket.priority) as any}
                      />
                    </TableCell>
                    <TableCell>{ticket.assignee?.name || 'Non assegnato'}</TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleDateString('it-IT')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}
