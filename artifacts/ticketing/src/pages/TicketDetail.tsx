import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Divider, Chip, Button,
  TextField, MenuItem, CircularProgress, Avatar, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  IconButton, Popover, Snackbar, Menu, ListItemIcon, ListItemText,
  FormControlLabel, Checkbox, Autocomplete, Breadcrumbs, Link as MuiLink,
  useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircleOutline, CheckCircle, ArrowBack, Person, Group, EditOutlined, InsertDriveFile, Image as ImageIcon, Download, DeleteOutline, MoreVert, MailOutline, Email as EmailIcon, AttachFile, Close as CloseIcon, Repeat as RepeatIcon, CalendarToday as CalendarTodayIcon, NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketActivity, useListUsers, useListTicketAttachments, useSaveTicketAttachment,
  useDeleteTicket,
  useListTicketNotes, useAddTicketNote,
  useUpdateTicketComment, useDeleteTicketComment,
  useListClients,
  useSetTicketRecurrence, useDeleteTicketRecurrence,
  getGetTicketQueryKey, getListTicketCommentsQueryKey, getListTicketAttachmentsQueryKey,
  getListTicketsQueryKey, getListTicketNotesQueryKey, getListNotificationsQueryKey,
} from '@workspace/api-client-react';
import { useParams, useLocation, useSearch } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useTicketStatuses } from '../hooks/useTicketStatuses';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { RichCommentEditor, type PendingAttachment, type RichCommentEditorHandle } from '../components/RichCommentEditor';
import { MarkdownContent } from '../components/MarkdownContent';
import { UserLink } from '../components/UserLink';
import ChecklistSection from '../components/ChecklistSection';
import PermissionGateButton from '../components/PermissionGateButton';

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

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const entityTerm = useEntityTerm();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const fromParam = new URLSearchParams(search).get('from');
  const backTo = fromParam === 'dashboard' ? '/' : fromParam === 'calendar' ? '/calendar' : '/tickets';
  const { statuses: orgStatuses, isClosedKey, getLabelForKey, getColorForKey } = useTicketStatuses();

  const [tabValue, setTabValue] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');
  const [resolutionDialog, setResolutionDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const [assignAnchor, setAssignAnchor] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [markingSolution, setMarkingSolution] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', location: '', resource: '', clientId: '' });
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [dueEditVal, setDueEditVal] = useState<string>('');
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
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sendToCustomer, setSendToCustomer] = useState(true);
  const [emailReplyOpen, setEmailReplyOpen] = useState(false);
  const [emailReplyBody, setEmailReplyBody] = useState('');
  const [emailReplySending, setEmailReplySending] = useState(false);
  const [emailReplyError, setEmailReplyError] = useState<string | null>(null);
  const [emailReplySent, setEmailReplySent] = useState(false);
  const [emailReplyAttachments, setEmailReplyAttachments] = useState<PendingAttachment[]>([]);
  const [emailReplyUploading, setEmailReplyUploading] = useState(false);
  const [emailReplyAttachError, setEmailReplyAttachError] = useState<string | null>(null);
  const emailReplyFileInputRef = useRef<HTMLInputElement>(null);

  const deleteTicket = useDeleteTicket();
  const updateComment = useUpdateTicketComment();
  const deleteComment = useDeleteTicketComment();
  const setRecurrenceMut = useSetTicketRecurrence();
  const deleteRecurrenceMut = useDeleteTicketRecurrence();

  // Recurrence dialog state
  const [recurrenceDialog, setRecurrenceDialog] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceSaving, setRecurrenceSaving] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId, staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: clientsList = [] } = useListClients(undefined, { query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: workload = [] } = useQuery<{ id: number; open: number }[]>({
    queryKey: ['assignee-workload'],
    queryFn: () => fetch('/api/stats/assignee-workload', { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
    enabled: currentUser?.role === 'admin',
  });
  const openByUser = Object.fromEntries(workload.map(w => [w.id, w.open]));
  const { data: attachments } = useListTicketAttachments(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();
  const saveAttachment = useSaveTicketAttachment();

  // Group permission helpers — reads from groupPermissions returned by /api/auth/me
  const hasGroupPerm = (perm: string) =>
    ((currentUser as any)?.groupPermissions as string[] | undefined ?? []).includes(perm);
  const canChangeStatusByGroup = hasGroupPerm('change_status');
  const isAssignee = !!(ticket && (currentUser as any)?.id && (ticket as any).assignedTo === (currentUser as any).id);
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

  useEffect(() => {
    if (!ticket) return;
    const d = (ticket as any).dueAt;
    setDueEditVal(d ? toLocalDatetimeInput(d) : '');
  }, [ticket]);

  if (isLoading || !ticket) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === ticket.status) return;
    if (isClosedKey(newStatus) && !isClosedKey(ticket.status)) {
      setResolutionNote('');
      setResolutionDialog(true);
      return;
    }
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus as any } });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    } catch (err: any) {
      setStatusError(err?.data?.message || err?.message || t.ticketDetail.statusChangeError);
    }
  };

  const confirmResolved = async (note: string) => {
    const resolvedKey = orgStatuses.find((s) => s.isClosed)?.key ?? 'resolved';
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: { status: resolvedKey as any, resolutionNote: note || null } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setResolutionDialog(false);
      setResolutionNote('');
    } catch (err: any) {
      setStatusError(err?.data?.message || err?.message || t.ticketDetail.statusChangeError);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === ticket.priority) return;
    await updateTicket.mutateAsync({ id: ticketId, data: { priority: newPriority as any } });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setAssignAnchor(null);
  };

  const handleDueAtChange = async (val: string) => {
    await updateTicket.mutateAsync({
      id: ticketId,
      data: { dueAt: val ? new Date(val) as any : null } as any,
    });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
    queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
  };

  const handleGroupChange = async (val: string) => {
    await updateTicket.mutateAsync({ id: ticketId, data: { assignedToGroup: val || null } as any });
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
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

  const openRecurrenceDialog = () => {
    const existing = (ticket as any).recurrenceRule;
    if (existing) {
      setRecurrenceFreq(existing.frequency ?? 'weekly');
      setRecurrenceInterval(existing.interval ?? 1);
      setRecurrenceEndDate(existing.endDate ? existing.endDate.slice(0, 10) : '');
    } else {
      setRecurrenceFreq('weekly');
      setRecurrenceInterval(1);
      setRecurrenceEndDate('');
    }
    setRecurrenceError(null);
    setRecurrenceDialog(true);
  };

  const handleRecurrenceSave = async () => {
    setRecurrenceSaving(true);
    setRecurrenceError(null);
    try {
      await setRecurrenceMut.mutateAsync({
        id: ticketId,
        data: {
          frequency: recurrenceFreq,
          interval: recurrenceInterval,
          ...(recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setRecurrenceDialog(false);
    } catch (err: any) {
      setRecurrenceError(err?.data?.message || err?.message || t.ticketDetail.recurrenceSetError);
    } finally {
      setRecurrenceSaving(false);
    }
  };

  const handleRecurrenceRemove = async () => {
    setRecurrenceSaving(true);
    setRecurrenceError(null);
    try {
      await deleteRecurrenceMut.mutateAsync({ id: ticketId });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setRecurrenceDialog(false);
    } catch (err: any) {
      setRecurrenceError(err?.data?.message || err?.message || t.ticketDetail.recurrenceRemoveError);
    } finally {
      setRecurrenceSaving(false);
    }
  };

  const openEditDialog = () => {
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      location: ticket.location,
      resource: (ticket as any).resource || '',
      clientId: (ticket as any).clientId ? String((ticket as any).clientId) : '',
    });
    setEditError(null);
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: {
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          location: editForm.location,
          resource: editForm.resource || undefined,
          clientId: editForm.clientId ? parseInt(editForm.clientId) : null,
        } as any,
      });
      await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setEditDialog(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? t.ticketDetail.editSaveError;
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const isEmailResource = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((ticket as any)?.resource ?? '');

  const EMAIL_REPLY_ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed',
  ];
  const EMAIL_REPLY_MAX_SIZE_MB = 20;

  const handleEmailReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setEmailReplyAttachError(null);
    for (const file of files) {
      if (!EMAIL_REPLY_ALLOWED_TYPES.includes(file.type)) {
        setEmailReplyAttachError(t.ticketDetail.emailReplyAttachTypeError);
        return;
      }
      if (file.size > EMAIL_REPLY_MAX_SIZE_MB * 1024 * 1024) {
        setEmailReplyAttachError(t.ticketDetail.emailReplyAttachSizeError.replace('{max}', String(EMAIL_REPLY_MAX_SIZE_MB)));
        return;
      }
    }
    setEmailReplyUploading(true);
    try {
      for (const file of files) {
        const urlRes = await fetch('/api/storage/uploads/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }),
        });
        if (!urlRes.ok) throw new Error(t.ticketDetail.emailReplyAttachUploadError);
        const { uploadURL, objectPath } = await urlRes.json();
        const putRes = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) throw new Error(t.ticketDetail.emailReplyAttachUploadError);
        setEmailReplyAttachments((prev) => [
          ...prev,
          { objectPath, fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream' },
        ]);
      }
    } catch {
      setEmailReplyAttachError(t.ticketDetail.emailReplyAttachUploadError);
    } finally {
      setEmailReplyUploading(false);
    }
  };

  const submitEmailReply = async () => {
    if (!emailReplyBody.trim()) return;
    setEmailReplySending(true);
    setEmailReplyError(null);
    try {
      const comment = await addComment.mutateAsync({
        id: ticketId,
        data: {
          commentText: emailReplyBody.trim(),
          sendToCustomer: true,
          emailAttachments: emailReplyAttachments,
        } as any,
      });
      queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);
      queryClient.invalidateQueries({ queryKey: getListTicketCommentsQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      if (emailReplyAttachments.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
      }
      setEmailReplyBody('');
      setEmailReplyAttachments([]);
      setEmailReplyAttachError(null);
      setEmailReplyOpen(false);
      setEmailReplySent(true);
    } catch (err: any) {
      setEmailReplyError(err?.message || err?.error || t.ticketDetail.emailReplyErrorPrefix);
    } finally {
      setEmailReplySending(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() && pendingAttachments.length === 0) return;
    const commentText = newComment.trim() || '📎 Allegato';
    try {
      const comment = await addComment.mutateAsync({ id: ticketId, data: { commentText, ...(isEmailResource && sendToCustomer ? { sendToCustomer: true } : {}) } as any });
      setNewComment('');
      queryClient.setQueryData(getListTicketCommentsQueryKey(ticketId), (old: any[] = []) => [...old, comment]);
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      for (const att of pendingAttachments) {
        await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: comment.id } });
      }
      if (pendingAttachments.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
        setPendingAttachments([]);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || t.ticketDetail.closedTicketComment(entityTerm.singular);
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
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      for (const att of inlinePendingAttachments) {
        await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: comment.id } });
      }
      if (inlinePendingAttachments.length > 0) {
        queryClient.invalidateQueries({ queryKey: getListTicketAttachmentsQueryKey(ticketId) });
        setInlinePendingAttachments([]);
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || t.ticketDetail.closedTicketComment(entityTerm.singular);
      setCommentError(msg);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isAuthor = (ticket as any).createdBy === currentUser?.id;
  const canEdit = isAdmin || isAuthor;
  const canChangeStatus = isAdmin || canChangeStatusByGroup || isAssignee;
  const creator = (ticket as any).creator;
  const assignee = (ticket as any).assignee;
  const assignedGroup = (ticket as any).assignedToGroup;
  const canSelfAssign = !isAdmin && !assignedGroup && !assignee;
  const canRemoveSelf = !isAdmin && isAssignee;
  const closerActivity = [...(activities ?? [])].reverse().find(
    (a: any) => a.actionType === 'status_changed' &&
      (a.actionDescription?.includes('Risolto') || a.actionDescription?.includes('Chiuso') ||
       a.actionDescription?.includes('Resolved') || a.actionDescription?.includes('Closed'))
  );

  const bql = new URLSearchParams(search).get('bql');
  const bqlLabels: Record<string, string> = {
    assignedToMe: t.ticketList.quickFilterAssignedToMe,
    overdue: t.ticketList.quickFilterOverdue,
    highPriority: t.ticketList.quickFilterHighPriority,
    open: t.ticketList.quickFilterOpen,
  };
  const breadcrumbLabel = backTo === '/' ? t.nav.dashboard : backTo === '/calendar' ? t.nav.calendar : (bql && bqlLabels[bql]) || t.ticketDetail.breadcrumbList;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1, sm: 2 }}>
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
          aria-label="breadcrumb"
          sx={{ minWidth: 0, flexShrink: 1, mr: 1 }}
        >
          <MuiLink
            underline="hover"
            color="text.secondary"
            onClick={() => setLocation(backTo)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
          >
            <ArrowBack sx={{ fontSize: 16 }} />
            {breadcrumbLabel}
          </MuiLink>
          <Typography color="text.primary" variant="body2" noWrap sx={{ maxWidth: { xs: 140, sm: 380 } }}>
            #{ticketId} {ticket.title}
          </Typography>
        </Breadcrumbs>
        <Box display="flex" gap={0.5} alignItems="center" flexShrink={0}>
          {isMobile ? (
            /* ── Mobile: icon-only buttons in a compact row ── */
            <>
              {canEdit && (
                <Tooltip title={t.ticketDetail.editButton}>
                  <IconButton size="small" onClick={openEditDialog} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {isAdmin && (
                <Tooltip title={(ticket as any).recurrenceRule ? t.ticketDetail.recurrenceBadge : t.ticketDetail.recurrenceButton}>
                  <IconButton
                    size="small"
                    onClick={openRecurrenceDialog}
                    sx={{
                      border: '1px solid',
                      borderColor: (ticket as any).recurrenceRule ? 'primary.main' : 'divider',
                      bgcolor: (ticket as any).recurrenceRule ? 'primary.main' : 'transparent',
                      color: (ticket as any).recurrenceRule ? 'primary.contrastText' : 'inherit',
                      '&:hover': { bgcolor: (ticket as any).recurrenceRule ? 'primary.dark' : undefined },
                    }}
                  >
                    <RepeatIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {isAdmin && (
                <Tooltip title={lang === 'it' ? `Elimina ${entityTerm.singularLower}` : `Delete ${entityTerm.singularLower}`}>
                  <IconButton size="small" onClick={() => setDeleteDialog(true)} color="error" sx={{ border: '1px solid', borderColor: 'error.main' }}>
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ) : (
            /* ── Desktop: full text buttons ── */
            <>
              {canEdit && (
                <Button startIcon={<EditOutlined />} size="small" variant="outlined" onClick={openEditDialog}>
                  {t.ticketDetail.editButton}
                </Button>
              )}
              {isAdmin && (
                <Tooltip title={(ticket as any).recurrenceRule ? t.ticketDetail.recurrenceBadge : ''}>
                  <Button
                    startIcon={<RepeatIcon />}
                    size="small"
                    variant={(ticket as any).recurrenceRule ? 'contained' : 'outlined'}
                    color={(ticket as any).recurrenceRule ? 'primary' : 'inherit'}
                    onClick={openRecurrenceDialog}
                  >
                    {t.ticketDetail.recurrenceButton}
                  </Button>
                </Tooltip>
              )}
              {isAdmin && (
                <Tooltip title={lang === 'it' ? `Elimina ${entityTerm.singularLower}` : `Delete ${entityTerm.singularLower}`}>
                  <Button startIcon={<DeleteOutline />} color="error" size="small" variant="outlined" onClick={() => setDeleteDialog(true)}>
                    {lang === 'it' ? 'Elimina' : 'Delete'}
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── Flat header ── */}
      <Box sx={{ mb: { xs: 1, sm: 1.5 } }}>

          {/* Meta bar: status · priority · category · due date */}
          <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} mb={1.5}>
            {(() => {
              const customColor = getColorForKey(ticket.status);
              return customColor ? (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.3, borderRadius: 20, bgcolor: customColor, color: 'white', fontWeight: 700, fontSize: '0.72rem', lineHeight: 1.6 }}>
                  {getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status}
                </Box>
              ) : (
                <Chip label={getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status} size="small" color={getStatusColor(ticket.status) as any} sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }} />
              );
            })()}
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: getPriorityColor(ticket.priority) === 'error' ? 'error.main' : getPriorityColor(ticket.priority) === 'warning' ? 'warning.main' : getPriorityColor(ticket.priority) === 'success' ? 'success.main' : 'text.disabled' }} />
              <Typography variant="caption" fontWeight={600} sx={{ color: getPriorityColor(ticket.priority) === 'error' ? 'error.main' : getPriorityColor(ticket.priority) === 'warning' ? 'warning.main' : 'text.secondary' }}>
                {t.priority[ticket.priority] || ticket.priority}
              </Typography>
            </Box>
            {ticket.category && (
              <>
                <Typography variant="caption" color="text.disabled">·</Typography>
                <Typography variant="caption" color="text.secondary">{ticket.category}</Typography>
              </>
            )}
            {(ticket as any).dueAt && (
              <>
                <Typography variant="caption" color="text.disabled">·</Typography>
                <Typography variant="caption" fontWeight={600} color={new Date((ticket as any).dueAt) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed' ? 'error.main' : 'warning.main'}>
                  ⚠ {lang === 'it' ? 'Scade' : 'Due'} {new Date((ticket as any).dueAt).toLocaleDateString(dateLocale)}
                </Typography>
              </>
            )}
          </Box>

          {/* Row 2: ticket title */}
          <Box display="flex" alignItems="flex-start" gap={1} mb={{ xs: 1, sm: 1.5 }} flexWrap="wrap">
            <Typography variant="h5" fontWeight={800} sx={{ wordBreak: 'break-word', lineHeight: 1.2, letterSpacing: '-0.01em', fontSize: { xs: '1.1rem', sm: '1.4rem' } }}>
              #{ticket.ticketNumber ?? ticket.id} — {ticket.title}
            </Typography>
            {ticket.inboundChannelId && (
              <Tooltip title={t.ticketDetail.inboundChannelLabel} placement="top" arrow>
                <Chip
                  icon={<EmailIcon sx={{ fontSize: '0.875rem !important' }} />}
                  label="Email"
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ alignSelf: 'center', height: 22, fontSize: '0.7rem', flexShrink: 0 }}
                />
              </Tooltip>
            )}
            {(ticket as any).recurrenceRule && (
              <Tooltip title={t.ticketList.recurrenceBadgeTooltip} placement="top" arrow>
                <Chip
                  icon={<RepeatIcon sx={{ fontSize: '0.875rem !important' }} />}
                  label={t.ticketDetail.recurrenceBadge}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ alignSelf: 'center', height: 22, fontSize: '0.7rem', flexShrink: 0 }}
                />
              </Tooltip>
            )}
            {(ticket as any).scheduledAt && new Date((ticket as any).scheduledAt) > new Date() && !((ticket as any).recurrenceRule) && (
              <Tooltip title={`${t.ticketList.scheduledBadgeTooltip} ${new Date((ticket as any).scheduledAt).toLocaleDateString(dateLocale)}`} placement="top" arrow>
                <Chip
                  icon={<CalendarTodayIcon sx={{ fontSize: '0.875rem !important' }} />}
                  label={lang === 'it' ? 'Programmata' : 'Scheduled'}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ alignSelf: 'center', height: 22, fontSize: '0.7rem', flexShrink: 0 }}
                />
              </Tooltip>
            )}
          </Box>
      </Box>

      {/* ── Two-column layout: sidebar (right) + main content (left) ── */}
      <Box sx={{ display: { xs: 'block', lg: 'flex' }, gap: 3, alignItems: 'flex-start' }}>
        <Box sx={{ width: { lg: 220 }, flexShrink: 0, order: { lg: 2 }, mb: { xs: 2, lg: 0 }, pt: { xs: 0, lg: '2px' } }}>
          {/* Sidebar: all metadata as vertical SideRows */}
          <Box display="flex" flexDirection="column">
            {/* Status — admin interactive SideRow */}
            {canChangeStatus && (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" gap={0.5} mb={0.25}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                    {t.ticketDetail.statusLabel}
                  </Typography>
                  <PermissionGateButton
                    permission="change_status"
                    sectionLabel={t.ticketDetail.statusLabel}
                  />
                </Box>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {orgStatuses.map((s) => {
                    const isActive = ticket.status === s.key;
                    const customColor = s.color;
                    return (
                      <Chip
                        key={s.key}
                        label={s.label}
                        size="small"
                        variant={isActive ? 'filled' : 'outlined'}
                        onClick={() => handleStatusChange(s.key)}
                        disabled={updateTicket.isPending}
                        {...(isActive && customColor
                          ? { sx: { bgcolor: customColor, color: 'white', cursor: 'pointer', fontWeight: 700 } }
                          : isActive
                          ? { color: getStatusColor(s.key) as any, sx: { cursor: 'pointer', fontWeight: 700 } }
                          : { sx: { cursor: 'pointer', fontWeight: 400 } })}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Priority — admin interactive SideRow */}
            {canChangeStatus && (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
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
            )}
            {/* Assignee */}
            <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
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
                              <Box flex={1} display="flex" alignItems="center" justifyContent="space-between" minWidth={0}>
                                <Typography variant="body2">{u.name}</Typography>
                                {(openByUser[u.id] ?? 0) > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                                    {openByUser[u.id]} {lang === 'it' ? 'aperti' : 'open'}
                                  </Typography>
                                )}
                              </Box>
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
                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
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
                  {canRemoveSelf && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      sx={{ minWidth: 0, px: 0.5, fontSize: '0.72rem' }}
                      disabled={updateTicket.isPending}
                      onClick={() => handleAssigneeChange('')}
                    >
                      {t.ticketDetail.removeSelfAssign}
                    </Button>
                  )}
                </Box>
              ) : (
                <Box>
                  {canSelfAssign ? (
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.72rem' }}
                      disabled={updateTicket.isPending}
                      onClick={() => handleAssigneeChange(String(currentUser?.id))}
                    >
                      {t.ticketDetail.selfAssign}
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Category */}
            <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                {t.ticketDetail.categoryLabel}
              </Typography>
              <Typography variant="body2">{ticket.category}</Typography>
            </Box>

            {/* Location — hidden when org has only 1 location */}
            {!singleLocation && (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                  {t.ticketDetail.locationLabel}
                </Typography>
                <Typography variant="body2">{ticket.location}</Typography>
              </Box>
            )}

            {/* Resource */}
            {ticket.resource && !ticket.inboundChannelId && (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                  {t.ticketDetail.resourceLabel}
                </Typography>
                <Typography variant="body2">{ticket.resource}</Typography>
              </Box>
            )}

            {/* Email origin info */}
            {ticket.inboundChannelId && (
              <>
                {isEmailResource && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      {t.ticketDetail.senderEmailLabel}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <EmailIcon sx={{ fontSize: 14, color: 'info.main' }} />
                      <Typography variant="body2" component="a" href={`mailto:${ticket.resource}`} sx={{ color: 'info.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {ticket.resource}
                      </Typography>
                    </Box>
                    {ticket.status !== 'closed' && (
                      <Button
                        startIcon={<MailOutline />}
                        size="small"
                        variant="outlined"
                        color="info"
                        sx={{ mt: 1, fontSize: '0.75rem' }}
                        onClick={() => { setEmailReplyOpen(true); setTabValue(0); }}
                      >
                        {t.ticketDetail.replyViaEmail}
                      </Button>
                    )}
                  </Box>
                )}
                {ticket.inboundChannelName && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      {t.ticketDetail.inboundChannelLabel}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <MailOutline sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2">{ticket.inboundChannelName}</Typography>
                    </Box>
                  </Box>
                )}
              </>
            )}

            {/* Client */}
            {(ticket as any).clientId && (currentUser as any)?.clientsEnabled !== false && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.clients.clientField}
                </Typography>
                {isAdmin ? (
                  <Typography
                    variant="body2"
                    sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => setLocation(`/clients/${(ticket as any).clientId}`)}
                  >
                    {(ticket as any).client?.name ?? `#${(ticket as any).clientId}`}{(ticket as any).client?.alias ? ` (${(ticket as any).client.alias})` : ''}
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    {(ticket as any).client?.name ?? `#${(ticket as any).clientId}`}{(ticket as any).client?.alias ? ` (${(ticket as any).client.alias})` : ''}
                  </Typography>
                )}
              </Box>
            )}

            {/* Due date */}
            {(isAdmin || isAssignee) ? (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                  {t.ticketDetail.dueAtLabel}
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TextField
                    type="datetime-local"
                    size="small"
                    value={dueEditVal}
                    onChange={(e) => setDueEditVal(e.target.value)}
                    onBlur={() => handleDueAtChange(dueEditVal)}
                    inputProps={{ style: { fontSize: 13 } }}
                    sx={{ minWidth: 190 }}
                    disabled={updateTicket.isPending}
                  />
                  {dueEditVal && (
                    <Tooltip title={t.ticketDetail.dueAtClear}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={updateTicket.isPending}
                          onClick={() => { setDueEditVal(''); handleDueAtChange(''); }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ) : (ticket as any).dueAt ? (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
                  {t.ticketDetail.dueAtLabel}
                </Typography>
                <Typography variant="body2" color={new Date((ticket as any).dueAt) < new Date() && ticket.status !== 'resolved' && ticket.status !== 'closed' ? 'error.main' : 'text.primary'}>
                  {new Date((ticket as any).dueAt).toLocaleString(dateLocale)}
                </Typography>
              </Box>
            ) : null}

            {/* Closed on + resolver */}
            {ticket.closedAt && (
              <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
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

          {/* Creator info */}
          <Box sx={{ py: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.25} sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, fontSize: '0.62rem' }}>
              {t.ticketDetail.openedOn}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.75}>
              <Avatar src={creator?.avatarUrl ?? undefined} sx={{ width: 20, height: 20, fontSize: 10, bgcolor: 'primary.main' }}>
                {creator?.name?.charAt(0)}
              </Avatar>
              <Typography variant="body2" noWrap>{creator?.name}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {new Date(ticket.createdAt).toLocaleDateString(dateLocale)}
            </Typography>
          </Box>

        </Box>
        <Box sx={{ flex: 1, minWidth: 0, order: { lg: 1 } }}>
          <Box sx={{ mb: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.68rem' }}>{t.ticketDetail.descriptionLabel}</Typography>
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
          </Box>

          <ChecklistSection ticketId={ticketId} isAdmin={isAdmin} />

          <Box>
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
            <Box>
              <TabPanel value={tabValue} index={0}>
                <Box display="flex" flexDirection="column" gap={0}>
                  {comments?.length === 0 && !(ticket as any).resolutionNote && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      {t.ticketDetail.noComments}
                    </Typography>
                  )}
                  {(comments?.length ?? 0) > 0 && (
                  <Box>
                    <Box display="flex" flexDirection="column" gap={0}>
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
                      sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider', ...(customerReply ? { ml: { xs: 3, sm: 5 } } : {}) }}
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
                          sx={isSolution ? (theme) => ({
                            borderLeft: `3px solid ${theme.palette.success.main}`,
                            pl: 1.5,
                          }) : customerReply ? (theme) => ({
                            borderLeft: `3px solid ${theme.palette.secondary.main}`,
                            pl: 1.5,
                          }) : {}}
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
                        <Box px={1.5} py={1} sx={{ background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.16)} 100%)` }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'success.dark' }}>
                            {(ticket as any).resolutionNote}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  {/* Email reply compose panel */}
                  {emailReplyOpen && ticket.status !== 'closed' && isEmailResource && (
                    <Box mt={2} sx={{ border: '1px solid', borderColor: (theme) => alpha(theme.palette.info.main, 0.35), borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ bgcolor: (theme) => alpha(theme.palette.info.main, 0.08), px: 2, py: 1, borderBottom: '1px solid', borderColor: (theme) => alpha(theme.palette.info.main, 0.2), display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 16, color: 'info.main' }} />
                        <Typography variant="caption" fontWeight={600} color="info.dark">
                          {t.ticketDetail.replyViaEmail}
                        </Typography>
                      </Box>
                      <Box px={2} py={1.5} display="flex" flexDirection="column" gap={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>
                            {t.ticketDetail.emailReplyTo}:
                          </Typography>
                          <Typography variant="caption" fontWeight={600} color="info.main">
                            {(ticket as any).resource}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>
                            {t.ticketDetail.emailReplySubject}:
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Re: [#{ticket.ticketNumber ?? ticket.id}] {ticket.title}
                          </Typography>
                        </Box>
                        <TextField
                          multiline
                          minRows={4}
                          maxRows={12}
                          fullWidth
                          size="small"
                          value={emailReplyBody}
                          onChange={(e) => setEmailReplyBody(e.target.value)}
                          placeholder={t.ticketDetail.emailReplyBodyPlaceholder}
                          disabled={emailReplySending}
                          sx={{ mt: 0.5 }}
                        />
                        {/* Attached files list */}
                        {emailReplyAttachments.length > 0 && (
                          <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.5}>
                            {emailReplyAttachments.map((att) => (
                              <Chip
                                key={att.objectPath}
                                icon={<AttachFile sx={{ fontSize: 14 }} />}
                                label={att.fileName}
                                size="small"
                                onDelete={() => setEmailReplyAttachments((prev) => prev.filter((a) => a.objectPath !== att.objectPath))}
                                deleteIcon={
                                  <Tooltip title={t.ticketDetail.emailReplyRemoveAttachment}>
                                    <CloseIcon sx={{ fontSize: 14 }} />
                                  </Tooltip>
                                }
                                sx={{ maxWidth: 200 }}
                              />
                            ))}
                          </Box>
                        )}
                        {emailReplyAttachError && (
                          <Alert severity="warning" sx={{ py: 0.5 }} onClose={() => setEmailReplyAttachError(null)}>
                            {emailReplyAttachError}
                          </Alert>
                        )}
                        {emailReplyError && (
                          <Alert severity="error" sx={{ py: 0.5 }}>
                            {emailReplyError}
                          </Alert>
                        )}
                        {/* Hidden file input */}
                        <input
                          type="file"
                          multiple
                          ref={emailReplyFileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleEmailReplyFileChange}
                          accept={EMAIL_REPLY_ALLOWED_TYPES.join(',')}
                        />
                        <Box display="flex" gap={1} justifyContent="space-between" alignItems="center">
                          <Tooltip title={t.ticketDetail.emailReplyAttach}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => emailReplyFileInputRef.current?.click()}
                                disabled={emailReplySending || emailReplyUploading}
                                color="default"
                              >
                                {emailReplyUploading
                                  ? <CircularProgress size={16} />
                                  : <AttachFile sx={{ fontSize: 18 }} />
                                }
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Box display="flex" gap={1}>
                            <Button
                              size="small"
                              onClick={() => { setEmailReplyOpen(false); setEmailReplyBody(''); setEmailReplyError(null); setEmailReplyAttachments([]); setEmailReplyAttachError(null); }}
                              disabled={emailReplySending}
                            >
                              {t.ticketDetail.emailReplyCancel}
                            </Button>
                            <Button
                              variant="contained"
                              color="info"
                              size="small"
                              startIcon={<EmailIcon />}
                              onClick={submitEmailReply}
                              disabled={!emailReplyBody.trim() || emailReplySending || emailReplyUploading}
                            >
                              {emailReplySending ? t.ticketDetail.emailReplySending : t.ticketDetail.emailReplySend}
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {ticket.status === 'closed' ? (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                      {t.ticketDetail.closedTicketComment(entityTerm.singular)}
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
                    <Box display="flex" alignItems="center" justifyContent="flex-end">
                      <PermissionGateButton
                        permission="add_notes"
                        sectionLabel={t.ticketDetail.tabNotes}
                      />
                    </Box>
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
          </Box>
        </Box>
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

      {/* ── Email reply sent confirmation ── */}
      <Snackbar
        open={emailReplySent}
        autoHideDuration={4000}
        onClose={() => setEmailReplySent(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setEmailReplySent(false)} sx={{ width: '100%' }}>
          {t.ticketDetail.emailReplySentOk}
        </Alert>
      </Snackbar>

      {/* ── Status change error feedback ── */}
      <Snackbar
        open={statusError != null}
        autoHideDuration={5000}
        onClose={() => setStatusError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setStatusError(null)} sx={{ width: '100%' }}>
          {statusError}
        </Alert>
      </Snackbar>

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
          <DeleteOutline /> {lang === 'it' ? `Elimina ${entityTerm.singularLower}` : `Delete ${entityTerm.singularLower}`}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {lang === 'it'
              ? <>Sei sicuro di voler eliminare {entityTerm.articleIndef} {entityTerm.singularLower} <strong>#{ticket?.ticketNumber ?? ticket?.id} — {ticket?.title}</strong>?</>
              : <>Are you sure you want to delete {entityTerm.articleIndef} {entityTerm.singularLower} <strong>#{ticket?.ticketNumber ?? ticket?.id} — {ticket?.title}</strong>?</>}
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
          {lang === 'it' ? `Modifica ${entityTerm.singularLower}` : `Edit ${entityTerm.singular}`} #{ticket?.ticketNumber ?? ticket?.id}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {editError && (
            <Alert severity="error" onClose={() => setEditError(null)}>
              {editError}
            </Alert>
          )}
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
          {clientsList.length > 0 && (currentUser as any)?.clientsEnabled !== false && (
            <Autocomplete
              options={clientsList}
              getOptionLabel={(o) => o.name}
              value={clientsList.find(c => c.id.toString() === editForm.clientId) ?? null}
              onChange={(_, v) => setEditForm((f) => ({ ...f, clientId: v ? v.id.toString() : '' }))}
              disabled={editSaving}
              renderInput={(params) => (
                <TextField {...params} label={t.clients.clientField} fullWidth size="small" />
              )}
            />
          )}
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

      {/* ── Recurrence Dialog ── */}
      <Dialog open={recurrenceDialog} onClose={() => setRecurrenceDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RepeatIcon fontSize="small" />
          {t.ticketDetail.recurrenceDialogTitle}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {recurrenceError && <Alert severity="error">{recurrenceError}</Alert>}
            <TextField
              select
              fullWidth
              size="small"
              label={t.ticketDetail.recurrenceFrequency}
              value={recurrenceFreq}
              onChange={(e) => setRecurrenceFreq(e.target.value as any)}
            >
              <MenuItem value="daily">{t.ticketDetail.recurrenceFreqDaily}</MenuItem>
              <MenuItem value="weekly">{t.ticketDetail.recurrenceFreqWeekly}</MenuItem>
              <MenuItem value="monthly">{t.ticketDetail.recurrenceFreqMonthly}</MenuItem>
              <MenuItem value="yearly">{t.ticketDetail.recurrenceFreqYearly}</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={lang === 'it' ? 'Ogni' : 'Every'}
              value={recurrenceInterval}
              onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: 365 }}
            />
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t.ticketDetail.recurrenceEndDate}
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            />
            {(ticket as any).recurrenceNextAt && (
              <Typography variant="caption" color="text.secondary">
                {t.ticketDetail.recurrenceNextAt}: {new Date((ticket as any).recurrenceNextAt).toLocaleDateString(dateLocale)}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Box>
            {(ticket as any).recurrenceRule && (
              <Button color="error" onClick={handleRecurrenceRemove} disabled={recurrenceSaving}>
                {t.ticketDetail.recurrenceRemove}
              </Button>
            )}
          </Box>
          <Box display="flex" gap={1}>
            <Button onClick={() => setRecurrenceDialog(false)} color="inherit" disabled={recurrenceSaving}>
              {t.ticketDetail.recurrenceCancel}
            </Button>
            <Button
              variant="contained"
              onClick={handleRecurrenceSave}
              disabled={recurrenceSaving}
              startIcon={recurrenceSaving ? <CircularProgress size={16} color="inherit" /> : <RepeatIcon />}
            >
              {t.ticketDetail.recurrenceSave}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
