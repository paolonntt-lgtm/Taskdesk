import React, { useState } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Divider, Grid, Chip, Button,
  TextField, MenuItem, CircularProgress, Avatar,
} from '@mui/material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketActivity, useListUsers,
  getGetTicketQueryKey, getListTicketCommentsQueryKey,
} from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getStatusColor, getPriorityColor } from './Dashboard';
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
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [tabValue, setTabValue] = useState(0);
  const [newComment, setNewComment] = useState('');

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId } });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId } });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId } });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60 * 1000 } });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  if (isLoading || !ticket) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  const handleStatusChange = async (newStatus: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus as any } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
  };

  const handlePriorityChange = async (newPriority: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { priority: newPriority as any } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    const comment = await addComment.mutateAsync({ id: ticketId, data: { commentText: newComment } });
    setNewComment('');
    queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);
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
        {t.ticketDetail.backToList}
      </Button>

      <Box mb={3}>
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ wordBreak: 'break-word' }}>
          #{ticket.id} — {ticket.title}
        </Typography>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Chip label={t.status[ticket.status] || ticket.status} color={getStatusColor(ticket.status) as any} size="small" />
          <Chip label={t.priority[ticket.priority] || ticket.priority} variant="outlined" color={getPriorityColor(ticket.priority) as any} size="small" />
          <Typography variant="caption" color="text.secondary">
            {t.ticketDetail.openedOn} {new Date(ticket.createdAt).toLocaleString(dateLocale)}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <Box p={3}>
              <Typography variant="overline" color="text.secondary">{t.ticketDetail.descriptionLabel}</Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {ticket.description}
              </Typography>
            </Box>
          </Card>

          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                sx={{ px: { xs: 0, sm: 2 } }}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                <Tab label={`${t.ticketDetail.tabComments} (${comments?.length ?? 0})`} />
                <Tab label={t.ticketDetail.tabActivity} />
              </Tabs>
            </Box>
            <Box p={3}>
              <TabPanel value={tabValue} index={0}>
                <Box display="flex" flexDirection="column" gap={3}>
                  {comments?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      {t.ticketDetail.noComments}
                    </Typography>
                  )}
                  {comments?.map((c) => (
                    <Box key={c.id} display="flex" gap={2}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{c.author?.name?.charAt(0)}</Avatar>
                      <Box flex={1} bgcolor="background.default" p={2} borderRadius={1}>
                        <Box display="flex" justifyContent="space-between" mb={1} flexWrap="wrap" gap={0.5}>
                          <Typography variant="subtitle2" fontWeight="bold">{c.author?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(c.createdAt).toLocaleString(dateLocale)}
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
                        placeholder={t.ticketDetail.addCommentPlaceholder}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <Button
                        variant="contained"
                        sx={{ alignSelf: 'flex-end' }}
                        onClick={submitComment}
                        disabled={!newComment.trim() || addComment.isPending}
                      >
                        {addComment.isPending ? t.ticketDetail.sending : t.ticketDetail.sendComment}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {activities?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      {t.ticketDetail.noActivity}
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
                          {new Date(a.createdAt).toLocaleString(dateLocale)}
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
              <Typography variant="h6" fontWeight="bold">{t.ticketDetail.detailsTitle}</Typography>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.assignedTo}
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
                    <MenuItem value=""><em>{t.ticketDetail.unassigned}</em></MenuItem>
                    {users?.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                  </TextField>
                ) : (
                  <Typography variant="body1">{ticket.assignee?.name || t.ticketDetail.unassigned}</Typography>
                )}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.statusLabel}
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
                    <MenuItem value="open">{t.status.open}</MenuItem>
                    <MenuItem value="in_progress">{t.status.in_progress}</MenuItem>
                    <MenuItem value="waiting">{t.status.waiting}</MenuItem>
                    <MenuItem value="resolved">{t.status.resolved}</MenuItem>
                    <MenuItem value="closed">{t.status.closed}</MenuItem>
                  </TextField>
                ) : (
                  <Chip label={t.status[ticket.status] || ticket.status} color={getStatusColor(ticket.status) as any} size="small" />
                )}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.priorityLabel}
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
                    <MenuItem value="low">{t.priority.low}</MenuItem>
                    <MenuItem value="medium">{t.priority.medium}</MenuItem>
                    <MenuItem value="high">{t.priority.high}</MenuItem>
                    <MenuItem value="urgent">{t.priority.urgent}</MenuItem>
                  </TextField>
                ) : (
                  <Chip label={t.priority[ticket.priority] || ticket.priority} variant="outlined" color={getPriorityColor(ticket.priority) as any} size="small" />
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t.ticketDetail.categoryLabel}</Typography>
                <Typography variant="body1">{ticket.category}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t.ticketDetail.locationLabel}</Typography>
                <Typography variant="body1">{ticket.location}</Typography>
              </Box>

              {ticket.resource && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t.ticketDetail.resourceLabel}</Typography>
                  <Typography variant="body1">{ticket.resource}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t.ticketDetail.createdBy}</Typography>
                <Typography variant="body1">{ticket.creator?.name}</Typography>
              </Box>

              {ticket.closedAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t.ticketDetail.closedOn}</Typography>
                  <Typography variant="body1">{new Date(ticket.closedAt).toLocaleDateString(dateLocale)}</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
