import React, { useState } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Divider, Grid, Chip, Button,
  TextField, MenuItem, CircularProgress, Avatar,
} from '@mui/material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketNotes, useAddTicketNote, useListTicketActivity, useListUsers,
  getGetTicketQueryKey, getListTicketCommentsQueryKey, getListTicketNotesQueryKey,
} from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { getStatusColor, getPriorityColor, getStatusLabel, getPriorityLabel } from './Dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowBack } from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const ticketId = parseInt(id || '0');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [tabValue, setTabValue] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [newNote, setNewNote] = useState('');

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId } });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId } });
  const { data: notes } = useListTicketNotes(ticketId, { query: { enabled: !!ticketId && currentUser?.role === 'admin' } });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId } });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin' } });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();
  const addNote = useAddTicketNote();

  if (isLoading || !ticket) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  const handleStatusChange = async (newStatus: string) => {
    await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus as any } });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
  };

  const handlePriorityChange = async (newPriority: string) => {
    await updateTicket.mutateAsync({ id: ticketId, data: { priority: newPriority as any } });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({ id: ticketId, data: { commentText: newComment } });
    setNewComment('');
    queryClient.invalidateQueries({ queryKey: getListTicketCommentsQueryKey(ticketId) });
  };

  const submitNote = async () => {
    if (!newNote.trim()) return;
    await addNote.mutateAsync({ id: ticketId, data: { noteText: newNote } });
    setNewNote('');
    queryClient.invalidateQueries({ queryKey: getListTicketNotesQueryKey(ticketId) });
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => setLocation('/tickets')}
        sx={{ mb: 2 }}
        color="inherit"
      >
        Tutti i ticket
      </Button>

      <Box mb={3}>
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ wordBreak: 'break-word' }}>
          #{ticket.id} — {ticket.title}
        </Typography>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Chip label={getStatusLabel(ticket.status)} color={getStatusColor(ticket.status) as any} size="small" />
          <Chip label={getPriorityLabel(ticket.priority)} variant="outlined" color={getPriorityColor(ticket.priority) as any} size="small" />
          <Typography variant="caption" color="text.secondary">
            Aperto il {new Date(ticket.createdAt).toLocaleString('it-IT')}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <Box p={3}>
              <Typography variant="overline" color="text.secondary">Descrizione</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {ticket.description}
              </Typography>
            </Box>
          </Card>

          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: { xs: 0, sm: 2 } }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                <Tab label={`Commenti (${comments?.length ?? 0})`} />
                {isAdmin && <Tab label={`Note interne (${notes?.length ?? 0})`} />}
                <Tab label="Cronologia" />
              </Tabs>
            </Box>
            <Box p={3}>
              <TabPanel value={tabValue} index={0}>
                <Box display="flex" flexDirection="column" gap={3}>
                  {comments?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      Nessun commento ancora. Scrivi il primo!
                    </Typography>
                  )}
                  {comments?.map((c) => (
                    <Box key={c.id} display="flex" gap={2}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{c.author?.name?.charAt(0)}</Avatar>
                      <Box flex={1} bgcolor="background.default" p={2} borderRadius={1}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="subtitle2" fontWeight="bold">{c.author?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(c.createdAt).toLocaleString('it-IT')}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.commentText}</Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box display="flex" gap={2} mt={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>{currentUser?.name?.charAt(0)}</Avatar>
                    <Box flex={1} display="flex" flexDirection="column" gap={1}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Aggiungi un commento..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <Button
                        variant="contained"
                        sx={{ alignSelf: 'flex-end' }}
                        onClick={submitComment}
                        disabled={!newComment.trim() || addComment.isPending}
                      >
                        {addComment.isPending ? 'Invio...' : 'Invia Commento'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </TabPanel>

              {isAdmin && (
                <TabPanel value={tabValue} index={1}>
                  <Box display="flex" flexDirection="column" gap={3}>
                    <Typography variant="body2" color="warning.main" fontWeight="bold">
                      🔒 Note visibili solo agli amministratori
                    </Typography>
                    {notes?.length === 0 && (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                        Nessuna nota interna.
                      </Typography>
                    )}
                    {notes?.map((n) => (
                      <Box key={n.id} display="flex" gap={2}>
                        <Avatar sx={{ bgcolor: 'warning.main' }}>{n.author?.name?.charAt(0)}</Avatar>
                        <Box flex={1} bgcolor="warning.light" color="warning.contrastText" p={2} borderRadius={1}>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle2" fontWeight="bold">{n.author?.name}</Typography>
                            <Typography variant="caption">
                              {new Date(n.createdAt).toLocaleString('it-IT')}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{n.noteText}</Typography>
                        </Box>
                      </Box>
                    ))}
                    <Box display="flex" gap={2} mt={2}>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>{currentUser?.name?.charAt(0)}</Avatar>
                      <Box flex={1} display="flex" flexDirection="column" gap={1}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          placeholder="Aggiungi una nota interna (visibile solo agli admin)..."
                          value={newNote}
                          onChange={e => setNewNote(e.target.value)}
                        />
                        <Button
                          variant="contained"
                          color="warning"
                          sx={{ alignSelf: 'flex-end' }}
                          onClick={submitNote}
                          disabled={!newNote.trim() || addNote.isPending}
                        >
                          {addNote.isPending ? 'Invio...' : 'Salva Nota'}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </TabPanel>
              )}

              <TabPanel value={tabValue} index={isAdmin ? 2 : 1}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {activities?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      Nessuna attività registrata.
                    </Typography>
                  )}
                  {activities?.map((a) => (
                    <Box key={a.id} display="flex" alignItems="flex-start" gap={2}>
                      <Box width={8} height={8} borderRadius="50%" bgcolor="primary.main" mt={0.8} flexShrink={0} />
                      <Box flex={1}>
                        <Typography variant="body2">
                          <strong>{a.user?.name}</strong> — {a.actionDescription}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(a.createdAt).toLocaleString('it-IT')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </TabPanel>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <Box p={3} display="flex" flexDirection="column" gap={3}>
              <Typography variant="h6" fontWeight="bold">Dettagli</Typography>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Assegnato a
                </Typography>
                {isAdmin ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={ticket.assignedTo ?? ''}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    disabled={updateTicket.isPending}
                  >
                    <MenuItem value=""><em>Non assegnato</em></MenuItem>
                    {users?.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                  </TextField>
                ) : (
                  <Typography variant="body1">{ticket.assignee?.name || 'Non assegnato'}</Typography>
                )}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Stato
                </Typography>
                {isAdmin ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updateTicket.isPending}
                  >
                    <MenuItem value="open">Aperto</MenuItem>
                    <MenuItem value="in_progress">In lavorazione</MenuItem>
                    <MenuItem value="waiting">In attesa</MenuItem>
                    <MenuItem value="resolved">Risolto</MenuItem>
                    <MenuItem value="closed">Chiuso</MenuItem>
                  </TextField>
                ) : (
                  <Chip label={getStatusLabel(ticket.status)} color={getStatusColor(ticket.status) as any} size="small" />
                )}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  Priorità
                </Typography>
                {isAdmin ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={ticket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    disabled={updateTicket.isPending}
                  >
                    <MenuItem value="low">Bassa</MenuItem>
                    <MenuItem value="medium">Media</MenuItem>
                    <MenuItem value="high">Alta</MenuItem>
                    <MenuItem value="urgent">Urgente</MenuItem>
                  </TextField>
                ) : (
                  <Chip label={getPriorityLabel(ticket.priority)} variant="outlined" color={getPriorityColor(ticket.priority) as any} size="small" />
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Categoria</Typography>
                <Typography variant="body1">{ticket.category}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Sede</Typography>
                <Typography variant="body1">{ticket.location}</Typography>
              </Box>

              {ticket.resource && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Risorsa</Typography>
                  <Typography variant="body1">{ticket.resource}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Creato da</Typography>
                <Typography variant="body1">{ticket.creator?.name}</Typography>
              </Box>

              {ticket.closedAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Chiuso il</Typography>
                  <Typography variant="body1">{new Date(ticket.closedAt).toLocaleDateString('it-IT')}</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
