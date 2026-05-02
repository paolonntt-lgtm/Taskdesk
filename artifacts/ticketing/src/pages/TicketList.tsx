import React, { useState } from 'react';
import {
  Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon } from '@mui/icons-material';
import { useListTickets } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useDebounce } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

export default function TicketList() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');

  const { data: tickets, isLoading } = useListTickets({
    search: debouncedSearch || undefined,
    status: status !== 'all' ? status : undefined,
    priority: priority !== 'all' ? priority : undefined,
  });

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">{t.ticketList.title}</Typography>
        <Button
          component={Link}
          href="/tickets/new"
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          size="small"
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{t.ticketList.newTicket}</Box>
        </Button>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder={t.ticketList.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label={t.ticketList.statusFilter}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">{t.ticketList.allStatuses}</MenuItem>
              <MenuItem value="open">{t.status.open}</MenuItem>
              <MenuItem value="in_progress">{t.status.in_progress}</MenuItem>
              <MenuItem value="waiting">{t.status.waiting}</MenuItem>
              <MenuItem value="resolved">{t.status.resolved}</MenuItem>
              <MenuItem value="closed">{t.status.closed}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label={t.ticketList.priorityFilter}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <MenuItem value="all">{t.ticketList.allPriorities}</MenuItem>
              <MenuItem value="low">{t.priority.low}</MenuItem>
              <MenuItem value="medium">{t.priority.medium}</MenuItem>
              <MenuItem value="high">{t.priority.high}</MenuItem>
              <MenuItem value="urgent">{t.priority.urgent}</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{t.ticketList.colId}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{t.ticketList.colTitle}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }}>{t.ticketList.colCategory}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{t.ticketList.colStatus}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap' }}>{t.ticketList.colPriority}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', lg: 'table-cell' } }}>{t.ticketList.colAssignee}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>{t.ticketList.colCreated}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : tickets?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t.ticketList.noResults}
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
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>#{ticket.id}</TableCell>
                    <TableCell sx={{ maxWidth: { xs: 140, sm: 250, md: 320 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ticket.title}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{ticket.category}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip label={t.status[ticket.status] || ticket.status} size="small" color={getStatusColor(ticket.status) as any} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Chip label={t.priority[ticket.priority] || ticket.priority} size="small" variant="outlined" color={getPriorityColor(ticket.priority) as any} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, whiteSpace: 'nowrap' }}>
                      {ticket.assignee?.name || t.ticketList.unassigned}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>
                      {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
                    </TableCell>
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
