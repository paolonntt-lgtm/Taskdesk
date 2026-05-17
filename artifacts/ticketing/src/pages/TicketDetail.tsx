import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Divider, Chip, Button,
  TextField, MenuItem, CircularProgress, Avatar, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  IconButton, Popover, Snackbar, Menu, ListItemIcon, ListItemText,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { CheckCircleOutline, CheckCircle, ArrowBack, Person, Group, EditOutlined, InsertDriveFile, Image as ImageIcon, Download, DeleteOutline, MoreVert, MailOutline } from '@mui/icons-material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketActivity, useListUsers, useListTicketAttachments, useSaveTicketAttachment,
  useDeleteTicket,
  useListTicketNotes, useAddTicketNote,
  useUpdateTicketComment, useDeleteTicketComment,
  getGetTicketQueryKey, getListTicketCommentsQueryKey, getListTicketAttachmentsQueryKey,
  getListTicketsQueryKey, getListTicketNotesQueryKey,
} from '@workspace/api-client-react';
import { useParams, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { RichCommentEditor, type PendingAttachment, type RichCommentEditorHandle } from '../components/RichCommentEditor';
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
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

const STATUS_OPTIONS = ['open', 'waiting', 'resolved', 'closed'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

const CUSTOMER_REPLY_RE = /^📧 \*\*Risposta del cliente\*\* — da: (.+?) <([^>]+)>\n\n([\s\S]*)$/;
function parseCustomerReply(text: string): { name: string; email: string; body: string } | null {
  const m = CUSTOMER_REPLY_RE.exec(text);
  if (!m) return null;
  return { name: m[1].trim(), email: m[2].trim(), body: m[3].trim() };
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
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [groupPerms, setGroupPerms] = useState<Record<string, string[]>>({});
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');
  const [resolutionDialog, setResolutionDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const [assignAnchor, setAssignAnchor] = useState<null | HTMLElement>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [markingSolution, setMarkingSolution] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', location: '', resource: '' });
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const singleLocation = editLocations.length <= 1;
  const editorRef = useRef<RichCommentEditorHandle>(null);
  const inlineEditorRef = useRef<RichCommentEditorHandle>(null);
  const editCommentEditorRef = useRef<RichCommentEditorHandle>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [inlinePendingAttachments, setInlinePendingAttachments] = useState<PendingAttachment[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
  const [commentMenuAnchor, setCommentMenuAnchor] = useState<{ el: HTMLElement; commentId: number } | null>(null);
  const [commentReactions, setCommentReactions] = useState<Record<number, { emoji: string; count: number; userReacted: boolean; users: string[] }[]>>({});
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [sendToCustomer, setSendToCustomer] = useState(true);

  const deleteTicket = useDeleteTicket();
  const updateComment = useUpdateTicketComment();
  const deleteComment = useDeleteTicketComment();

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId } as any });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId, staleTime: 30_000 } as any });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: attachments } = useListTicketAttachments(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();
  const saveAttachment = useSaveTicketAttachment();

  // Group permission helpers (computed after ticket is loaded)
  const userGroupsList: string[] = (() => {
    try { return (currentUser as any)?.groups ? JSON.parse((currentUser as any).groups) : []; } catch { return []; }
  })();
  const hasGroupPerm = (perm: string) =>
    userGroupsList.some((g) => (groupPerms[g] ?? []).includes(perm));
  const canChangeStatusByGroup = hasGroupPerm('change_status');
  const canAccessNotes = currentUser?.role === 'admin' || hasGroupPerm('add_notes');

  const [newNote, setNewNote] = useState('');
  const { data: notes } = useListTicketNotes(ticketId, { query: { enabled: !!ticketId && canAccessNotes, staleTime: 60_000 } as any });
  const addNote = useAddTicketNote();

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  const formatReactionTooltip = (users: string[]): string => {
    if (users.length === 0) return '';
    const maxShown = 3;
    const shown = users.slice(0, maxShown);
    const rest = users.length - maxShown;
    const nameList = shown.join(', ');
    if (rest <= 0) return nameList;
    return lang === 'en'
      ? `${nameList} and ${rest} other${rest > 1 ? 's' : ''}`
      : `${nameList} e ${rest} altr${rest > 1 ? 'i' : 'o'}`;
  };

  // Sync reactions from API data when comments load
  useEffect(() => {
    if (!comments) return;
    const map: Record<number, { emoji: string; count: number; userReacted: boolean; users: string[] }[]> = {};
    for (const c of comments) {
      if (Array.isArray(c.reactions)) map[c.id] = c.reactions;
    }
    setCommentReactions(map);
  }, [comments]);

  const handleToggleReaction = async (commentId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments/${commentId}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommentReactions((prev) => ({ ...prev, [commentId]: data.reactions }));
      } else {
        setReactionError(lang === 'en' ? 'Could not save reaction. Please try again.' : 'Impossibile salvare la reazione. Riprova.');
      }
    } catch {
      setReactionError(lang === 'en' ? 'Network error. Please try again.' : 'Errore di rete. Riprova.');
    }
  };

  const handleReply = (commentId: number, authorName: string | null | undefined) => {
    const mention = authorName ? `@[${authorName}] ` : '';
    setReplyingToCommentId(commentId);
    setInlineReplyText(mention);
    setTabValue(0);
    setTimeout(() => inlineEditorRef.current?.focusEnd(), 50);
  };

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/settings/group-permissions', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroupPerms(d.value ?? {}))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEditCategories(d.value ?? []))
      .catch(() => {});
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEditLocations(d.value ?? []))
      .catch(() => {});
  }, []);

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
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
  };

  const confirmResolved = async (note: string) => {
    const updated = await updateTicket.mutateAsync({
      id: ticketId,
      data: { status: 'resolved' as any, resolutionNote: note || null } as any,
    });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setResolutionDialog(false);
    setResolutionNote('');
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === ticket.priority) return;
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { priority: newPriority as any } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setAssignAnchor(null);
  };

  const handleGroupChange = async (val: string) => {
    const updated = await updateTicket.mutateAsync({ id: ticketId, data: { assignedToGroup: val || null } as any });
    queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setAssignAnchor(null);
  };

  const handleMarkSolution = async (commentId: number, currentValue: boolean) => {
    setMarkingSolution(commentId);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments/${commentId}/solution`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) =>
          old.map((c: any) =>
            c.id === commentId
              ? { ...c, isSolution: !currentValue }
              : { ...c, isSolution: false }
          )
        );
        // If ticket was auto-resolved, refresh ticket data and list
        if (data.autoResolved) {
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
        }
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      }
    } finally {
      setMarkingSolution(null);
    }
  };

  const handleDeleteConfirm = async () => {
    await deleteTicket.mutateAsync({ id: ticketId });
    setDeleteDialog(false);
    setLocation('/tickets');
  };

  const handleEditComment = (commentId: number, currentText: string) => {
    setEditingCommentId(commentId);
    setEditCommentText(currentText);
    setReplyingToCommentId(null);
    setTimeout(() => editCommentEditorRef.current?.focusEnd(), 50);
  };

  const handleEditCommentSave = async (commentId: number) => {
    if (!editCommentText.trim()) return;
    const updated = await updateComment.mutateAsync({ id: ticketId, commentId, data: { commentText: editCommentText } });
    queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) =>
      old.map((c: any) => c.id === commentId ? { ...c, commentText: updated.commentText, updatedAt: updated.updatedAt } : c)
    );
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteCommentConfirm = async () => {
    if (deleteCommentId == null) return;
    await deleteComment.mutateAsync({ id: ticketId, commentId: deleteCommentId });
    queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) =>
      old.filter((c: any) => c.id !== deleteCommentId)
    );
    setDeleteCommentId(null);
  };

  const openEditDialog = () => {
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      location: ticket.location,
      resource: (ticket as any).resource || '',
    });
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    try {
      const updated = await updateTicket.mutateAsync({
        id: ticketId,
        data: {
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          location: editForm.location,
          resource: editForm.resource || undefined,
        } as any,
      });
      queryClient.setQueryData(getGetTicketQueryKey(ticketId), updated);
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setEditDialog(false);
    } finally {
      setEditSaving(false);
    }
  };

  const isEmailResource = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((ticket as any)?.resource ?? '');

  const submitComment = async () => {
    if (!newComment.trim() && pendingAttachments.length === 0) return;
    const commentText = newComment.trim() || '📎 Allegato';
    try {
      const comment = await addComment.mutateAsync({ id: ticketId, data: { commentText, ...(isEmailResource && sendToCustomer ? { sendToCustomer: true } : {}) } as any });
      setNewComment('');
      queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);
      for (const att of pendingAttachments) {
        await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: comment.id } });
      }
      if (pendingAttachments.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
        setPendingAttachments([]);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || t.ticketDetail.closedTicketComment;
      setCommentError(msg);
    }
  };

  const submitInlineReply = async () => {
    if (!inlineReplyText.trim() && inlinePendingAttachments.length === 0) return;
    const commentText = inlineReplyText.trim() || '📎 Allegato';
    try {
      const comment = await addComment.mutateAsync({ id: ticketId, data: { commentText, replyToCommentId: replyingToCommentId } });
      setInlineReplyText('');
      setReplyingToCommentId(null);
      queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);
      for (const att of inlinePendingAttachments) {
        await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: comment.id } });
      }
      if (inlinePendingAttachments.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
        setInlinePendingAttachments([]);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || t.ticketDetail.closedTicketComment;
      setCommentError(msg);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isAuthor = (ticket as any).createdBy === currentUser?.id;
  const canEdit = isAdmin || isAuthor;
  const canChangeStatus = isAdmin || canChangeStatusByGroup;
  const creator = (ticket as any).creator;
  const assignee = (ticket as any).assignee;
  const assignedGroup = (ticket as any).assignedToGroup;
  const closerActivity = [...(activities ?? [])].reverse().find(
    (a: any) => a.actionType === 'status_changed' &&
      (a.actionDescription?.includes('Risolto') || a.actionDescription?.includes('Chiuso') ||
       a.actionDescription?.includes('Resolved') || a.actionDescription?.includes('Closed'))
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1, sm: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => { if (window.history.length > 1) { window.history.back(); } else { setLocation('/tickets'); } }}
          color="inherit"
          size="small"
        >
          {t.ticketDetail.backToList}
        </Button>
        <Box display="flex" gap={1}>
          {canEdit && (
            <Button
              startIcon={<EditOutlined />}
              size="small"
              variant="outlined"
              onClick={openEditDialog}
            >
              {t.ticketDetail.editButton}
            </Button>
          )}
          {isAdmin && (
            <Tooltip title="Elimina ticket">
              <Button
                startIcon={<DeleteOutline />}
                color="error"
                size="small"
                variant="outlined"
                onClick={() => setDeleteDialog(true)}
              >
                Elimina
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Compact header card ── */}
      <Card sx={{ mb: { xs: 1.5, sm: 3 }, overflow: 'visible' }}>
        <Box px={{ xs: 1.5, sm: 3 }} pt={{ xs: 1, sm: 2.5 }} pb={{ xs: 1, sm: 2 }}>
          {/* Row 1: author + date */}
          <Box display="flex" alignItems="center" gap={1.5} mb={{ xs: 1, sm: 1.5 }}>
            <Avatar
              src={creator?.avatarUrl ?? undefined}
              sx={{ width: { xs: 32, sm: 42 }, height: { xs: 32, sm: 42 }, bgcolor: 'primary.main', fontSize: { xs: 14, sm: 18 }, flexShrink: 0 }}
            >
              {creator?.name?.charAt(0)}
            </Avatar>
            <Box minWidth={0}>
              <UserLink
                userId={(creator as any)?.id}
                name={creator?.name}
                typographyProps={{ variant: 'subtitle2', fontWeight: 'bold', noWrap: true }}
              />
              
              <Typography variant="caption" color="text.secondary" display="block">
                {t.ticketDetail.openedOn} {new Date(ticket.createdAt).toLocaleString(dateLocale)}
              </Typography>
            </Box>
          </Box>

          {/* Row 2: ticket title */}
          <Typography variant="h6" fontWeight="bold" sx={{ wordBreak: 'break-word', mb: { xs: 1, sm: 1.5 }, lineHeight: 1.3, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            #{ticket.ticketNumber ?? ticket.id} — {ticket.title}
          </Typography>

          {/* Row 3: status chips */}
          {canChangeStatus ? (
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
          {canChangeStatus ? (
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
                      <Typography variant="body2" color="text.disabled">—</Typography>
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
                        <ToggleButton value="user"><Person sx={{ mr: 0.5 }} fontSize="small" />{t.ticketDetail.assignUser}</ToggleButton>
                        <ToggleButton value="group"><Group sx={{ mr: 0.5 }} fontSize="small" />{t.ticketDetail.assignGroup}</ToggleButton>
                      </ToggleButtonGroup>

                      {assignMode === 'user' ? (
                        <Box display="flex" flexDirection="column" gap={0.5} maxHeight={220} overflow="auto">
                          <Box
                            px={1} py={0.5} borderRadius={1} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            onClick={() => handleAssigneeChange('')}
                          >
                            <Typography variant="body2" color="text.secondary">{t.ticketDetail.unassigned}</Typography>
                          </Box>
                          {[...(users ?? [])].sort((a, b) => {
                            if (a.isAvailable === b.isAvailable) return 0;
                            return a.isAvailable ? -1 : 1;
                          }).map(u => (
                            <Box
                              key={u.id}
                              px={1} py={0.5} borderRadius={1}
                              display="flex" alignItems="center" gap={1}
                              sx={{
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                                bgcolor: ticket.assignedTo === u.id ? 'action.selected' : undefined,
                                opacity: u.isAvailable ? 1 : 0.55,
                              }}
                              onClick={() => handleAssigneeChange(String(u.id))}
                            >
                              <Avatar
                                src={u.avatarUrl ?? undefined}
                                sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}
                              >
                                {u.name?.charAt(0)}
                              </Avatar>
                              <Tooltip title={u.isAvailable ? (lang === 'it' ? 'Disponibile' : 'Available') : (lang === 'it' ? 'Non disponibile' : 'Unavailable')} placement="right">
                                <Box
                                  component="span"
                                  sx={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    bgcolor: u.isAvailable ? 'success.main' : 'text.disabled',
                                    display: 'inline-block',
                                  }}
                                />
                              </Tooltip>
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
              ) : (assignee || assignedGroup) ? (
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
                    {assignedGroup ? `Gruppo: ${assignedGroup}` : assignee?.name}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.disabled">—</Typography>
              )}
            </Box>

            {/* Category */}
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.ticketDetail.categoryLabel}
              </Typography>
              <Typography variant="body2">{ticket.category}</Typography>
            </Box>

            {/* Location — hidden when org has only 1 location */}
            {!singleLocation && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.locationLabel}
                </Typography>
                <Typography variant="body2">{ticket.location}</Typography>
              </Box>
            )}

            {/* Resource */}
            {ticket.resource && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.resourceLabel}
                </Typography>
                <Typography variant="body2">{ticket.resource}</Typography>
              </Box>
            )}

            {/* Due date */}
            {(ticket as any).dueAt && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.ticketDetail.dueAtLabel}
                </Typography>
                <Typography variant="body2" color={new Date((ticket as any).dueAt) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed' ? 'error.main' : 'text.primary'}>
                  {new Date((ticket as any).dueAt).toLocaleString(dateLocale)}
                </Typography>
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
          <Card sx={{ mb: { xs: 1.5, sm: 3 } }}>
            <Box p={{ xs: 2, sm: 3 }}>
              <Typography variant="overline" color="text.secondary">{t.ticketDetail.descriptionLabel}</Typography>
              <Box mt={1}>
                <MarkdownContent content={ticket.description} />
              </Box>
              {(() => {
                const ticketAttachments = (attachments ?? []).filter((a: any) => a.commentId == null);
                if (!ticketAttachments.length) return null;
                const imgs = ticketAttachments.filter((a: any) => (a.mimeType as string).startsWith('image/'));
                const files = ticketAttachments.filter((a: any) => !(a.mimeType as string).startsWith('image/'));
                return (
                  <Box mt={2}>
                    {imgs.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: files.length ? 1 : 0 }}>
                        {imgs.map((a: any) => {
                          const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                          return (
                            <Box
                              key={a.id}
                              onClick={() => setLightboxSrc(href)}
                              sx={{
                                borderRadius: 1, overflow: 'hidden', border: '1px solid',
                                borderColor: 'divider', cursor: 'zoom-in',
                                '&:hover img': { opacity: 0.85 },
                              }}
                            >
                              <img src={href} alt={a.fileName} style={{ display: 'block', maxWidth: 200, maxHeight: 140, objectFit: 'cover' }} />
                              <Box sx={{ px: 1, py: 0.4, fontSize: '0.7rem', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.fileName}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {files.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {files.map((a: any) => {
                          const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                          return (
                            <Chip
                              key={a.id}
                              icon={<InsertDriveFile fontSize="small" />}
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
                    )}
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
                <Tab label={`${t.ticketDetail.tabComments} (${(comments?.length ?? 0) + ((ticket as any).resolutionNote ? 1 : 0)})`} />
                <Tab label={t.ticketDetail.tabActivity} />
                {canAccessNotes && <Tab label={`${t.ticketDetail.tabNotes} (${notes?.length ?? 0})`} />}
              </Tabs>
            </Box>
            <Box p={{ xs: 1.5, sm: 3 }}>
              <TabPanel value={tabValue} index={0}>
                <Box display="flex" flexDirection="column" gap={{ xs: 1.5, sm: 3 }}>
                  {comments?.length === 0 && !(ticket as any).resolutionNote && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      {t.ticketDetail.noComments}
                    </Typography>
                  )}
                  {/* Thread wrapper with vertical connector line */}
                  {(comments?.length ?? 0) > 0 && (
                  <Box sx={{ position: 'relative' }}>
                    {(comments?.length ?? 0) > 1 && (
                      <Box sx={{
                        position: 'absolute',
                        left: { xs: 15, sm: 17 },
                        top: { xs: 32, sm: 36 },
                        bottom: 24,
                        width: 2,
                        bgcolor: 'divider',
                        borderRadius: 1,
                        zIndex: 0,
                        pointerEvents: 'none',
                      }} />
                    )}
                    <Box display="flex" flexDirection="column" gap={{ xs: 1, sm: 1.5 }}>
                  {comments?.flatMap((c) => {
                    const commentAttachments = (attachments ?? []).filter((a: any) => a.commentId === c.id);
                    const isSolution = (c as any).isSolution === true;
                    const canMarkSolution = !!currentUser;
                    const showInlineEditor = replyingToCommentId === c.id;
                    const isEditingThis = editingCommentId === c.id;
                    const isCommentAuthor = c.authorId === currentUser?.id;
                    const canEditComment = isCommentAuthor;
                    const canDeleteComment = isCommentAuthor || isAdmin;
                    const customerReply = parseCustomerReply(c.commentText);
                    const avatarLetter = customerReply
                      ? customerReply.name.charAt(0).toUpperCase()
                      : c.author?.name?.charAt(0);
                    const avatarBg = isSolution
                      ? 'success.main'
                      : customerReply
                      ? '#7c4dff'
                      : 'primary.main';
                    const commentEl = (
                    <Box
                      key={`c-${c.id}`}
                      display="flex"
                      gap={{ xs: 1, sm: 1.5 }}
                      sx={{ position: 'relative', zIndex: 1, ...(customerReply ? { ml: { xs: 3, sm: 5 } } : {}) }}
                      onMouseEnter={() => setHoveredCommentId(c.id)}
                      onMouseLeave={() => setHoveredCommentId(null)}
                    >
                      <Avatar
                        src={customerReply ? undefined : ((c.author as any)?.avatarUrl ?? undefined)}
                        sx={{ bgcolor: avatarBg, width: { xs: 32, sm: 36 }, height: { xs: 32, sm: 36 }, fontSize: { xs: 14, sm: 16 }, flexShrink: 0 }}
                      >
                        {avatarLetter}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        {isSolution && (
                          <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                            <CheckCircle sx={{ fontSize: 14, color: 'success.dark' }} />
                            <Typography variant="caption" fontWeight="bold" color="success.dark">
                              {t.ticketDetail.solutionLabel}
                            </Typography>
                          </Box>
                        )}
                        <Box
                          sx={isSolution ? {
                            border: '1px solid',
                            borderColor: 'success.300',
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                            px: { xs: 1.5, sm: 2 },
                            py: 1,
                          } : customerReply ? {
                            borderRadius: 2,
                            bgcolor: '#f5f0ff',
                            border: '1px solid',
                            borderColor: '#d4bbff',
                            px: { xs: 1.5, sm: 2 },
                            py: 1,
                          } : {
                            borderRadius: 2,
                            bgcolor: '#f8faff',
                            border: '1px solid',
                            borderColor: 'divider',
                            px: { xs: 1.5, sm: 2 },
                            py: 1,
                          }}
                        >
                          {customerReply ? (
                            <Box>
                              <Typography variant="body2" fontWeight="bold" color="text.primary">
                                {customerReply.name}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
                                <MailOutline sx={{ fontSize: 12, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  Risposta del cliente
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="a"
                                  href={`mailto:${customerReply.email}`}
                                  sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                >
                                  {customerReply.email}
                                </Typography>
                              </Box>
                            </Box>
                          ) : (
                            <UserLink
                              userId={c.authorId}
                              name={c.author?.name}
                              typographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                            />
                          )}
                          {isEditingThis ? (
                            <Box mt={0.5} display="flex" flexDirection="column" gap={1}>
                              <RichCommentEditor
                                ref={editCommentEditorRef}
                                value={editCommentText}
                                onChange={setEditCommentText}
                                placeholder={t.ticketDetail.addCommentPlaceholder}
                                ticketId={ticketId}
                                minRows={2}
                              />
                              <Box display="flex" gap={1} justifyContent="flex-end">
                                <Button size="small" onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}>
                                  {t.ticketDetail.editCancel}
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => handleEditCommentSave(c.id)}
                                  disabled={!editCommentText.trim() || updateComment.isPending}
                                >
                                  {updateComment.isPending ? '...' : t.ticketDetail.editCommentSave}
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Box mt={0.5}>
                              <MarkdownContent content={customerReply ? customerReply.body : c.commentText} />
                            </Box>
                          )}
                          {commentAttachments.length > 0 && (
                            <Box mt={1.5}>
                              {(() => {
                                const imgs = commentAttachments.filter((a: any) => (a.mimeType as string).startsWith('image/'));
                                const files = commentAttachments.filter((a: any) => !(a.mimeType as string).startsWith('image/'));
                                return (
                                  <>
                                    {imgs.length > 0 && (
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: files.length ? 1 : 0 }}>
                                        {imgs.map((a: any) => {
                                          const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                                          return (
                                            <Box
                                              key={a.id}
                                              onClick={() => setLightboxSrc(href)}
                                              sx={{
                                                borderRadius: 1, overflow: 'hidden', border: '1px solid',
                                                borderColor: 'divider', cursor: 'zoom-in',
                                                '&:hover img': { opacity: 0.85 },
                                              }}
                                            >
                                              <img src={href} alt={a.fileName} style={{ display: 'block', maxWidth: 180, maxHeight: 120, objectFit: 'cover' }} />
                                              <Box sx={{ px: 1, py: 0.4, fontSize: '0.7rem', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {a.fileName}
                                              </Box>
                                            </Box>
                                          );
                                        })}
                                      </Box>
                                    )}
                                    {files.length > 0 && (
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {files.map((a: any) => {
                                          const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                                          return (
                                            <Chip
                                              key={a.id}
                                              icon={<InsertDriveFile fontSize="small" />}
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
                                  </>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>
                        {!isEditingThis && (
                        <Box mt={0.5}>
                          {/* Reaction chips row */}
                          {(() => {
                            const reactions = commentReactions[c.id] ?? [];
                            if (reactions.length === 0) return null;
                            return (
                              <Box display="flex" flexWrap="wrap" gap={0.5} mb={0.5}>
                                {reactions.map((r) => (
                                  <Tooltip
                                    key={r.emoji}
                                    title={formatReactionTooltip(r.users)}
                                    placement="top"
                                    arrow
                                    enterDelay={300}
                                    enterTouchDelay={400}
                                    leaveTouchDelay={3000}
                                  >
                                    <Box
                                      component="span"
                                      onClick={() => handleToggleReaction(c.id, r.emoji)}
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.4,
                                        px: 0.8,
                                        py: 0.2,
                                        borderRadius: 10,
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        border: '1px solid',
                                        borderColor: r.userReacted ? 'primary.main' : 'divider',
                                        bgcolor: r.userReacted ? 'primary.50' : 'action.hover',
                                        color: r.userReacted ? 'primary.main' : 'text.secondary',
                                        fontWeight: r.userReacted ? 700 : 400,
                                        transition: 'all 0.15s',
                                        '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                                      }}
                                    >
                                      <span>{r.emoji}</span>
                                      <span>{r.count}</span>
                                    </Box>
                                  </Tooltip>
                                ))}
                              </Box>
                            );
                          })()}
                          {/* Action row: timestamp + links */}
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(c.createdAt).toLocaleString(dateLocale)}
                          </Typography>
                          {c.updatedAt && c.updatedAt !== c.createdAt && (
                            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                              ({t.ticketDetail.commentEdited} {new Date(c.updatedAt).toLocaleString(dateLocale)})
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            component="span"
                            onClick={() => handleReply(c.id, c.author?.name)}
                            sx={{
                              color: replyingToCommentId === c.id ? 'primary.main' : 'text.secondary',
                              cursor: 'pointer',
                              fontWeight: replyingToCommentId === c.id ? 'bold' : 'normal',
                              '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                            }}
                          >
                            {t.ticketDetail.replyComment}
                          </Typography>
                          {/* Mi Piace 👍 — toggle diretto */}
                          {(() => {
                            const alreadyLiked = (commentReactions[c.id] ?? []).some((r) => r.emoji === '👍' && r.userReacted);
                            return (
                              <Tooltip title={alreadyLiked ? t.ticketDetail.addReaction : t.ticketDetail.addReaction}>
                                <Typography
                                  variant="caption"
                                  component="span"
                                  onClick={() => handleToggleReaction(c.id, '👍')}
                                  sx={{
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                    fontSize: '0.85rem',
                                    color: alreadyLiked ? 'primary.main' : 'text.secondary',
                                    fontWeight: alreadyLiked ? 700 : 400,
                                    opacity: hoveredCommentId === c.id || alreadyLiked ? 1 : 0,
                                    transition: 'opacity 0.15s, color 0.15s',
                                    '@media (pointer: coarse)': { opacity: 1 },
                                    '&:hover': { color: 'primary.main' },
                                  }}
                                >
                                  👍
                                </Typography>
                              </Tooltip>
                            );
                          })()}
                          {(canEditComment || canDeleteComment) && (
                            <IconButton
                              size="small"
                              onClick={(e) => setCommentMenuAnchor({ el: e.currentTarget, commentId: c.id })}
                              sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                            >
                              <MoreVert sx={{ fontSize: 16 }} />
                            </IconButton>
                          )}
                          {canMarkSolution && (
                            <Button
                              size="small"
                              variant={isSolution ? 'contained' : 'outlined'}
                              color="success"
                              startIcon={isSolution ? <CheckCircle sx={{ fontSize: 13 }} /> : <CheckCircleOutline sx={{ fontSize: 13 }} />}
                              onClick={() => handleMarkSolution(c.id, isSolution)}
                              disabled={markingSolution === c.id}
                              sx={{ fontSize: '0.68rem', py: 0.25, px: 0.75, height: 22, minWidth: 0, ml: 'auto' }}
                            >
                              {isSolution ? t.ticketDetail.removeSolution : t.ticketDetail.markSolution}
                            </Button>
                          )}
                          </Box>
                        </Box>
                        )}
                      </Box>
                    </Box>
                    );
                    if (!showInlineEditor) return [commentEl];
                    const editorEl = (
                      <Box key={`r-${c.id}`} sx={{ pl: { xs: 3, sm: 5 }, display: 'flex', gap: { xs: 1, sm: 2 } }}>
                        <Avatar
                          src={(currentUser as any)?.avatarUrl ?? undefined}
                          sx={{ bgcolor: 'primary.main', width: { xs: 28, sm: 34 }, height: { xs: 28, sm: 34 }, flexShrink: 0 }}
                        >
                          {currentUser?.name?.charAt(0)}
                        </Avatar>
                        <Box flex={1} display="flex" flexDirection="column" gap={1}>
                          <RichCommentEditor
                            ref={inlineEditorRef}
                            value={inlineReplyText}
                            onChange={setInlineReplyText}
                            placeholder={t.ticketDetail.addCommentPlaceholder}
                            ticketId={ticketId}
                            onAttachmentsChange={setInlinePendingAttachments}
                            minRows={2}
                          />
                          <Box display="flex" gap={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => { setReplyingToCommentId(null); setInlineReplyText(''); }}>
                              {t.ticketDetail.editCancel}
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={submitInlineReply}
                              disabled={(!inlineReplyText.trim() && inlinePendingAttachments.length === 0) || addComment.isPending}
                            >
                              {addComment.isPending ? t.ticketDetail.sending : t.ticketDetail.replyComment}
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    );
                    return [commentEl, editorEl];
                  })}
                    </Box>
                  </Box>
                  )}

                  {/* Comment actions menu (edit / delete) */}
                  <Menu
                    anchorEl={commentMenuAnchor?.el}
                    open={Boolean(commentMenuAnchor)}
                    onClose={() => setCommentMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    slotProps={{ paper: { elevation: 3, sx: { minWidth: 150 } } }}
                  >
                    {(() => {
                      const mc = comments?.find((c) => c.id === commentMenuAnchor?.commentId);
                      if (!mc) return null;
                      const canEdit = mc.authorId === currentUser?.id;
                      const canDelete = mc.authorId === currentUser?.id || isAdmin;
                      return [
                        canEdit && (
                          <MenuItem
                            key="edit"
                            onClick={() => {
                              handleEditComment(commentMenuAnchor!.commentId, mc.commentText);
                              setCommentMenuAnchor(null);
                            }}
                          >
                            <ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon>
                            <ListItemText>{t.ticketDetail.editComment}</ListItemText>
                          </MenuItem>
                        ),
                        canDelete && (
                          <MenuItem
                            key="delete"
                            onClick={() => {
                              setDeleteCommentId(commentMenuAnchor!.commentId);
                              setCommentMenuAnchor(null);
                            }}
                            sx={{ color: 'error.main' }}
                          >
                            <ListItemIcon sx={{ color: 'error.main' }}><DeleteOutline fontSize="small" /></ListItemIcon>
                            <ListItemText>{t.ticketDetail.deleteComment}</ListItemText>
                          </MenuItem>
                        ),
                      ].filter(Boolean);
                    })()}
                  </Menu>

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
                  {ticket.status === 'closed' ? (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                      {t.ticketDetail.closedTicketComment}
                    </Alert>
                  ) : !replyingToCommentId && (
                  <Box display="flex" gap={2} mt={2}>
                    <Avatar
                      src={(currentUser as any)?.avatarUrl ?? undefined}
                      sx={{ bgcolor: 'primary.main' }}
                    >
                      {currentUser?.name?.charAt(0)}
                    </Avatar>
                    <Box flex={1} display="flex" flexDirection="column" gap={1}>
                      <RichCommentEditor
                        ref={editorRef}
                        value={newComment}
                        onChange={setNewComment}
                        placeholder={t.ticketDetail.addCommentPlaceholder}
                        ticketId={ticketId}
                        onAttachmentsChange={setPendingAttachments}
                      />
                      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        {isEmailResource && (
                          <Tooltip title={`${t.ticketDetail.replyWillBeSentTo} ${(ticket as any).resource}`}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={sendToCustomer}
                                  onChange={(e) => setSendToCustomer(e.target.checked)}
                                  color="primary"
                                />
                              }
                              label={
                                <Typography variant="caption" color="text.secondary">
                                  {t.ticketDetail.sendReplyToCustomer}{' '}
                                  <Typography component="span" variant="caption" color="primary.main" fontWeight={600}>
                                    {(ticket as any).resource}
                                  </Typography>
                                </Typography>
                              }
                            />
                          </Tooltip>
                        )}
                        <Button
                          variant="contained"
                          sx={{ alignSelf: 'flex-end', ml: 'auto' }}
                          onClick={submitComment}
                          disabled={(!newComment.trim() && pendingAttachments.length === 0) || addComment.isPending}
                        >
                          {addComment.isPending ? t.ticketDetail.sending : t.ticketDetail.sendComment}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                  )}
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

              {canAccessNotes && (
                <TabPanel value={tabValue} index={2}>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {notes?.length === 0 && (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                        {t.ticketDetail.noNotes}
                      </Typography>
                    )}
                    {notes?.map((n: any) => (
                      <Box key={n.id} display="flex" gap={2} sx={{ bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', borderRadius: 1, p: 2 }}>
                        <Avatar sx={{ bgcolor: 'warning.main', width: 34, height: 34, fontSize: 14 }}>
                          {n.author?.name?.charAt(0)}
                        </Avatar>
                        <Box flex={1}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="subtitle2" fontWeight={700}>{n.author?.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(n.createdAt).toLocaleString(dateLocale)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{n.noteText}</Typography>
                        </Box>
                      </Box>
                    ))}
                    <Box display="flex" gap={2} mt={1}>
                      <Avatar sx={{ bgcolor: 'warning.main', width: 34, height: 34, fontSize: 14 }}>
                        {currentUser?.name?.charAt(0)}
                      </Avatar>
                      <Box flex={1} display="flex" flexDirection="column" gap={1}>
                        <TextField
                          multiline
                          rows={3}
                          fullWidth
                          placeholder={t.ticketDetail.addNotePlaceholder}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                        />
                        <Button
                          variant="contained"
                          color="warning"
                          sx={{ alignSelf: 'flex-end' }}
                          disabled={!newNote.trim() || addNote.isPending}
                          onClick={async () => {
                            if (!newNote.trim()) return;
                            const note = await addNote.mutateAsync({ id: ticketId, data: { noteText: newNote } });
                            setNewNote('');
                            queryClient.setQueryData(getListTicketNotesQueryKey(ticketId), (old: any[] = []) => [...old, note]);
                          }}
                        >
                          {addNote.isPending ? t.ticketDetail.sending : t.ticketDetail.addNote}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </TabPanel>
              )}
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

      {/* ── Reaction error feedback ── */}
      <Snackbar
        open={reactionError != null}
        autoHideDuration={4000}
        onClose={() => setReactionError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setReactionError(null)} sx={{ width: '100%' }}>
          {reactionError}
        </Alert>
      </Snackbar>

      {/* ── Comment error feedback ── */}
      <Snackbar
        open={commentError != null}
        autoHideDuration={5000}
        onClose={() => setCommentError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setCommentError(null)} sx={{ width: '100%' }}>
          {commentError}
        </Alert>
      </Snackbar>


      {/* ── Delete comment confirm dialog ── */}
      <Dialog open={deleteCommentId != null} onClose={() => setDeleteCommentId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutline /> {t.ticketDetail.deleteCommentTitle}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t.ticketDetail.deleteCommentConfirm}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteCommentId(null)} color="inherit" disabled={deleteComment.isPending}>
            {t.ticketDetail.editCancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteCommentConfirm}
            disabled={deleteComment.isPending}
            startIcon={<DeleteOutline />}
          >
            {deleteComment.isPending ? t.ticketDetail.deleting : t.ticketDetail.deleteCommentAction}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutline /> Elimina ticket
        </DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler eliminare il ticket <strong>#{ticket?.ticketNumber ?? ticket?.id} — {ticket?.title}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Questa operazione è irreversibile: verranno eliminati anche tutti i commenti, allegati e lo storico attività.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog(false)} color="inherit" disabled={deleteTicket.isPending}>
            Annulla
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteTicket.isPending}
            startIcon={<DeleteOutline />}
          >
            {deleteTicket.isPending ? t.ticketDetail.deleting : t.ticketDetail.deletePermanently}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Lightbox ── */}
      <Dialog open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} maxWidth="xl" PaperProps={{ sx: { bgcolor: 'black', m: 1 } }}>
        <Box sx={{ position: 'relative', lineHeight: 0 }}>
          <IconButton
            onClick={() => setLightboxSrc(null)}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', zIndex: 1, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
          >
            ✕
          </IconButton>
          {lightboxSrc && (
            <img
              src={lightboxSrc}
              alt="anteprima"
              style={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
            />
          )}
        </Box>
      </Dialog>

      {/* ── Edit ticket dialog ── */}
      <Dialog open={editDialog} onClose={() => !editSaving && setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t.ticketDetail.editDialogTitle} #{ticket?.ticketNumber ?? ticket?.id}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={t.ticketDetail.editTitleField}
            fullWidth
            size="small"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            disabled={editSaving}
            required
          />
          <TextField
            label={t.ticketDetail.descriptionLabel}
            fullWidth
            multiline
            minRows={4}
            size="small"
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            disabled={editSaving}
          />
          <TextField
            label={t.ticketDetail.categoryLabel}
            fullWidth
            size="small"
            select={editCategories.length > 0}
            value={editForm.category}
            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
            disabled={editSaving}
          >
            {editCategories.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          {!singleLocation && (
            <TextField
              label={t.ticketDetail.locationLabel}
              fullWidth
              size="small"
              select={editLocations.length > 0}
              value={editForm.location}
              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
              disabled={editSaving}
            >
              {editLocations.map((l) => (
                <MenuItem key={l} value={l}>{l}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label={t.ticketDetail.resourceLabel}
            fullWidth
            size="small"
            value={editForm.resource}
            onChange={(e) => setEditForm((f) => ({ ...f, resource: e.target.value }))}
            disabled={editSaving}
            placeholder={t.ticketDetail.resourceLabel}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog(false)} color="inherit" disabled={editSaving}>
            {t.ticketDetail.editCancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={editSaving || !editForm.title.trim()}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <EditOutlined />}
          >
            {t.ticketDetail.editSave}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
