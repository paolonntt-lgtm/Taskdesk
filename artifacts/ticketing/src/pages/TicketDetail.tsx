import React, { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Divider, Chip, Button,
  TextField, MenuItem, CircularProgress, Avatar, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  IconButton, Popover,
} from '@mui/material';
import { CheckCircleOutline, ArrowBack, Person, Group, EditOutlined, InsertDriveFile, Image as ImageIcon, Download } from '@mui/icons-material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketActivity, useListUsers, useListTicketAttachments, useSaveTicketAttachment,
  getGetTicketQueryKey, getListTicketCommentsQueryKey, getListTicketAttachmentsQueryKey,
} from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { RichCommentEditor, type PendingAttachment } from '../components/RichCommentEditor';
import { MarkdownContent } from '../components/MarkdownContent';
import { UserLink } from '../components/UserLink';

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

const STATUS_OPTIONS = ['open', 'waiting', 'resolved', 'closed'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

export default function TicketDetail() {
  const { id } = useParams();
  const ticketId = parseInt(id || '0');
  const { user: currentUser } = useAuth();
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [tabValue, setTabValue] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');
  const [resolutionDialog, setResolutionDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const [assignAnchor, setAssignAnchor] = useState<null | HTMLElement>(null);

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId } as any });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId, staleTime: 30_000 } as any });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: attachments } = useListTicketAttachments(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();
  const saveAttachment = useSaveTicketAttachment();

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
  }, [currentUser?.role]);

  useEffect(() => {
    if (ticket) {
      setAssignMode((ticket as any).assignedToGroup ? 'group' : 'user');
    }
  }, [ticket]);

  if (isLoading || !ticket) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === ticket.status) return;
    if (newStatus === 'resolved') {
      setResolutionNote('');
      setResolutionDialog(true);
      return;
    }
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus as any } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
  };

  const confirmResolved = async (note: string) => {
    const updated = await updateTicket.mutateAsync({
      id: ticketId,
      data: { status: 'resolved' as any, resolutionNote: note || null } as any,
    });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    setResolutionDialog(false);
    setResolutionNote('');
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === ticket.priority) return;
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { priority: newPriority as any } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    setAssignAnchor(null);
  };

  const handleGroupChange = async (val: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { assignedToGroup: val || null } as any });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    setAssignAnchor(null);
  };

  const submitComment = async () => {
    if (!newComment.trim() && pendingAttachments.length === 0) return;
    const commentText = newComment.trim() || '📎 Allegato';
    const comment = await addComment.mutateAsync({ id: ticketId, data: { commentText } });
    setNewComment('');
    queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);

    for (const att of pendingAttachments) {
      await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: comment.id } });
    }
    if (pendingAttachments.length > 0) {
      queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
      setPendingAttachments([]);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const creator = (ticket as any).creator;
  const assignee = (ticket as any).assignee;
  const assignedGroup = (ticket as any).assignedToGroup;
  const closerActivity = [...(activities ?? [])].reverse().find(
    (a: any) => a.actionType === 'status_changed' &&
      (a.actionDescription?.includes('Risolto') || a.actionDescription?.includes('Chiuso'))
  );

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => setLocation('/tickets')}
        sx={{ mb: 2 }}
        color="inherit"
        size="small"
      >
        {t.ticketDetail.backToList}
      </Button>

      {/* ── Compact header card ── */}
      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <Box px={3} pt={2.5} pb={2}>
          {/* Row 1: author + date */}
          <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
            <Avatar
              src={creator?.avatarUrl ?? undefined}
              sx={{ width: 42, height: 42, bgcolor: 'primary.main', fontSize: 18, flexShrink: 0 }}
            >
              {creator?.name?.charAt(0)}
            </Avatar>
            <Box minWidth={0}>
              <UserLink
                userId={(creator as any)?.id}
                name={creator?.name}
                typographyProps={{ variant: 'subtitle2', fontWeight: 'bold', noWrap: true }}
              />
              
              <Typography variant="caption" color="text.secondary">
                {t.ticketDetail.openedOn} {new Date(ticket.createdAt).toLocaleString(dateLocale)}
              </Typography>
            </Box>
          </Box>

          {/* Row 2: ticket title */}
          <Typography variant="h6" fontWeight="bold" sx={{ wordBreak: 'break-word', mb: 1.5, lineHeight: 1.3 }}>
            #{ticket.id} — {ticket.title}
          </Typography>

          {/* Row 3: status chips */}
          {isAdmin ? (
            <Box mb={1}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.statusLabel}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {STATUS_OPTIONS.map((s) => (
                  <Chip
                    key={s}
                    label={t.status[s] || s}
                    size="small"
                    color={ticket.status === s ? (getStatusColor(s) as any) : 'default'}
                    variant={ticket.status === s ? 'filled' : 'outlined'}
                    onClick={() => handleStatusChange(s)}
                    disabled={updateTicket.isPending}
                    sx={{ cursor: 'pointer', fontWeight: ticket.status === s ? 700 : 400 }}
                  />
                ))}
              </Box>
            </Box>
          ) : (
            <Box display="flex" gap={1} mb={1}>
              <Chip label={t.status[ticket.status] || ticket.status} color={getStatusColor(ticket.status) as any} size="small" />
            </Box>
          )}

          {/* Row 4: priority chips */}
          {isAdmin ? (
            <Box mb={1}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.priorityLabel}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {PRIORITY_OPTIONS.map((p) => (
                  <Chip
                    key={p}
                    label={t.priority[p] || p}
                    size="small"
                    color={ticket.priority === p ? (getPriorityColor(p) as any) : 'default'}
                    variant={ticket.priority === p ? 'filled' : 'outlined'}
                    onClick={() => handlePriorityChange(p)}
                    disabled={updateTicket.isPending}
                    sx={{ cursor: 'pointer', fontWeight: ticket.priority === p ? 700 : 400 }}
                  />
                ))}
              </Box>
            </Box>
          ) : (
            <Box mb={1}>
              <Chip label={t.priority[ticket.priority] || ticket.priority} variant="outlined" color={getPriorityColor(ticket.priority) as any} size="small" />
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Row 5: assignee + category */}
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="flex-start" pt={0.5}>
            {/* Assignee */}
            <Box minWidth={140}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.assignedTo}
              </Typography>
              {isAdmin ? (
                <>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{ cursor: 'pointer' }}
                    onClick={(e) => setAssignAnchor(e.currentTarget)}
                  >
                    {assignedGroup ? (
                      <Chip
                        icon={<Group fontSize="small" />}
                        label={assignedGroup}
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={(e) => { e.stopPropagation(); setAssignAnchor(e.currentTarget); }}
                      />
                    ) : assignee ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar
                          src={assignee.avatarUrl ?? undefined}
                          sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'secondary.main' }}
                        >
                          {assignee.name?.charAt(0)}
                        </Avatar>
                        <Typography variant="body2">{assignee.name}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">{t.ticketDetail.unassigned}</Typography>
                    )}
                    <IconButton size="small">
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </Box>

                  <Popover
                    open={Boolean(assignAnchor)}
                    anchorEl={assignAnchor}
                    onClose={() => setAssignAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  >
                    <Box p={2} minWidth={220}>
                      <ToggleButtonGroup
                        value={assignMode}
                        exclusive
                        size="small"
                        fullWidth
                        onChange={(_, v) => { if (!v) return; setAssignMode(v); }}
                        sx={{ mb: 1.5 }}
                      >
                        <ToggleButton value="user"><Person sx={{ mr: 0.5 }} fontSize="small" />Utente</ToggleButton>
                        <ToggleButton value="group"><Group sx={{ mr: 0.5 }} fontSize="small" />Gruppo</ToggleButton>
                      </ToggleButtonGroup>

                      {assignMode === 'user' ? (
                        <Box display="flex" flexDirection="column" gap={0.5} maxHeight={220} overflow="auto">
                          <Box
                            px={1} py={0.5} borderRadius={1} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={() => handleAssigneeChange('')}
                          >
                            <Typography variant="body2" color="text.secondary">{t.ticketDetail.unassigned}</Typography>
                          </Box>
                          {users?.map(u => (
                            <Box
                              key={u.id}
                              px={1} py={0.5} borderRadius={1}
                              display="flex" alignItems="center" gap={1}
                              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, bgcolor: ticket.assignedTo === u.id ? 'action.selected' : undefined }}
                              onClick={() => handleAssigneeChange(String(u.id))}
                            >
                              <Avatar
                                src={(u as any).avatarUrl ?? undefined}
                                sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}
                              >
                                {u.name?.charAt(0)}
                              </Avatar>
                              <Typography variant="body2">{u.name}</Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box display="flex" flexDirection="column" gap={0.5} maxHeight={220} overflow="auto">
                          <Box
                            px={1} py={0.5} borderRadius={1} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={() => handleGroupChange('')}
                          >
                            <Typography variant="body2" color="text.secondary">{t.ticketDetail.unassigned}</Typography>
                          </Box>
                          {groups.map(g => (
                            <Box
                              key={g}
                              px={1} py={0.5} borderRadius={1}
                              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, bgcolor: assignedGroup === g ? 'action.selected' : undefined }}
                              onClick={() => handleGroupChange(g)}
                            >
                              <Typography variant="body2">{g}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Popover>
                </>
              ) : (
                <Box display="flex" alignItems="center" gap={1}>
                  {assignee && (
                    <Avatar
                      src={assignee.avatarUrl ?? undefined}
                      sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'secondary.main' }}
                    >
                      {assignee.name?.charAt(0)}
                    </Avatar>
                  )}
                  <Typography variant="body2">
                    {assignedGroup ? `Gruppo: ${assignedGroup}` : assignee?.name || t.ticketDetail.unassigned}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Category */}
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.categoryLabel}
              </Typography>
              <Typography variant="body2">{ticket.category}</Typography>
            </Box>

            {/* Location */}
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.locationLabel}
              </Typography>
              <Typography variant="body2">{ticket.location}</Typography>
            </Box>

            {/* Resource */}
            {ticket.resource && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.resourceLabel}
                </Typography>
                <Typography variant="body2">{ticket.resource}</Typography>
              </Box>
            )}

            {/* Closed on + resolver */}
            {ticket.closedAt && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.closedOn}
                </Typography>
                <Typography variant="body2">
                  {new Date(ticket.closedAt).toLocaleString(dateLocale)}
                  {closerActivity?.user?.name && (
                    <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                      · {closerActivity.user.name}
                    </Box>
                  )}
                </Typography>
              </Box>
            )}
          </Box>

        </Box>
      </Card>

      <Box>
          <Card sx={{ mb: 3 }}>
            <Box p={3}>
              <Typography variant="overline" color="text.secondary">{t.ticketDetail.descriptionLabel}</Typography>
              <Box mt={1}>
                <MarkdownContent content={ticket.description} />
              </Box>
              {(() => {
                const ticketAttachments = (attachments ?? []).filter((a: any) => a.commentId == null);
                if (!ticketAttachments.length) return null;
                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                    {ticketAttachments.map((a: any) => {
                      const isImg = (a.mimeType as string).startsWith('image/');
                      const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                      return (
                        <Chip
                          key={a.id}
                          icon={isImg ? <ImageIcon fontSize="small" /> : <InsertDriveFile fontSize="small" />}
                          label={a.fileName}
                          size="small"
                          variant="outlined"
                          component="a"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          clickable
                          deleteIcon={<Download fontSize="small" />}
                          onDelete={() => window.open(href, '_blank')}
                          sx={{ maxWidth: 280 }}
                        />
                      );
                    })}
                  </Box>
                );
              })()}
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
                  {comments?.map((c) => {
                    const commentAttachments = (attachments ?? []).filter((a: any) => a.commentId === c.id);
                    return (
                    <Box key={c.id} display="flex" gap={2}>
                      <Avatar
                        src={(c.author as any)?.avatarUrl ?? undefined}
                        sx={{ bgcolor: 'primary.main' }}
                      >
                        {c.author?.name?.charAt(0)}
                      </Avatar>
                      <Box flex={1} bgcolor="background.default" p={2} borderRadius={1}>
                        <Box display="flex" justifyContent="space-between" mb={1} flexWrap="wrap" gap={0.5}>
                          <UserLink
                            userId={c.authorId}
                            name={c.author?.name}
                            typographyProps={{ variant: 'subtitle2', fontWeight: 'bold' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(c.createdAt).toLocaleString(dateLocale)}
                          </Typography>
                        </Box>
                        <MarkdownContent content={c.commentText} />
                        {commentAttachments.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                            {commentAttachments.map((a: any) => {
                              const isImg = (a.mimeType as string).startsWith('image/');
                              const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                              return (
                                <Chip
                                  key={a.id}
                                  icon={isImg ? <ImageIcon fontSize="small" /> : <InsertDriveFile fontSize="small" />}
                                  label={a.fileName}
                                  size="small"
                                  variant="outlined"
                                  component="a"
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  clickable
                                  sx={{ maxWidth: 260 }}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    );
                  })}

                  {/* Resolution note shown inline among comments */}
                  {(ticket as any).resolutionNote && (
                    <Box display="flex" gap={1.5}>
                      <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32, flexShrink: 0 }}>
                        <CheckCircleOutline sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Box
                        flex={1}
                        borderRadius={1}
                        overflow="hidden"
                        sx={{ border: '1px solid', borderColor: 'success.200' }}
                      >
                        {/* Metadata bar */}
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          px={1.5}
                          py={0.6}
                          sx={{ bgcolor: 'success.100', borderBottom: '1px solid', borderColor: 'success.200' }}
                        >
                          <Typography variant="caption" fontWeight="bold" color="success.dark" sx={{ flexShrink: 0 }}>
                            ✓ {t.ticketDetail.resolutionNoteLabel}
                          </Typography>
                          {closerActivity?.user?.name && (
                            <Typography variant="caption" color="success.dark" sx={{ opacity: 0.75, flexShrink: 0 }}>
                              · {closerActivity.user.name}
                            </Typography>
                          )}
                        </Box>
                        {/* Note text */}
                        <Box px={1.5} py={1} sx={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'success.dark' }}>
                            {(ticket as any).resolutionNote}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <Box display="flex" gap={2} mt={2}>
                    <Avatar
                      src={(currentUser as any)?.avatarUrl ?? undefined}
                      sx={{ bgcolor: 'primary.main' }}
                    >
                      {currentUser?.name?.charAt(0)}
                    </Avatar>
                    <Box flex={1} display="flex" flexDirection="column" gap={1}>
                      <RichCommentEditor
                        value={newComment}
                        onChange={setNewComment}
                        placeholder={t.ticketDetail.addCommentPlaceholder}
                        ticketId={ticketId}
                        onAttachmentsChange={setPendingAttachments}
                      />
                      <Button
                        variant="contained"
                        sx={{ alignSelf: 'flex-end' }}
                        onClick={submitComment}
                        disabled={(!newComment.trim() && pendingAttachments.length === 0) || addComment.isPending}
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
      </Box>

      {/* Resolution note dialog */}
      <Dialog open={resolutionDialog} onClose={() => setResolutionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t.ticketDetail.resolutionNoteTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t.ticketDetail.resolutionNoteSubtitle}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder={t.ticketDetail.resolutionNotePlaceholder}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => confirmResolved('')} disabled={updateTicket.isPending} color="inherit">
            {t.ticketDetail.resolutionNoteSkip}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => confirmResolved(resolutionNote)}
            disabled={updateTicket.isPending}
            startIcon={<CheckCircleOutline />}
          >
            {updateTicket.isPending ? '...' : t.ticketDetail.resolutionNoteConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
