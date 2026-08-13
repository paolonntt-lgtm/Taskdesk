import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Tabs, Tab, Chip, Button, Divider,
  TextField, MenuItem, CircularProgress, Avatar, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  IconButton, Popover, Snackbar, Menu, ListItemIcon, ListItemText,
  FormControlLabel, Checkbox, Autocomplete, Link as MuiLink,
  useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircleOutline, CheckCircle, ArrowBack, Person, Group, EditOutlined, InsertDriveFile, Download, DeleteOutline, MoreVert, MailOutline, Email as EmailIcon, AttachFile, Close as CloseIcon, Repeat as RepeatIcon, CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
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
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2.5 } }}>{children}</Box>}
    </div>
  );
}

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Matches both legacy format (header\n\nbody) and new format (header\n\n---\n\nbody)
const CUSTOMER_REPLY_RE = /^📧 \*\*Risposta del cliente\*\* — da: (.+?) <([^>]+)>\n\n(?:---\n\n)?([\s\S]*)$/;
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
  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  const [priorityAnchor, setPriorityAnchor] = useState<null | HTMLElement>(null);
  const [dueAnchor, setDueAnchor] = useState<null | HTMLElement>(null);
  const [categoryAnchor, setCategoryAnchor] = useState<null | HTMLElement>(null);
  const [locationAnchor, setLocationAnchor] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [markingSolution, setMarkingSolution] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', location: '', resource: '', clientId: '', dueAt: '' });
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
  const { data: attachments } = useListTicketAttachments(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000 } as any });

  const updateTicket = useUpdateTicket();
  const addComment = useAddTicketComment();
  const saveAttachment = useSaveTicketAttachment();

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
      dueAt: (ticket as any).dueAt ? new Date((ticket as any).dueAt).toISOString().slice(0, 16) : '',
    });
    setEditError(null);
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      const existingClientId = (ticket as any).clientId ?? null;
      const newClientId = editForm.clientId ? parseInt(editForm.clientId) : null;

      // Mirror the NewTicket behaviour: if a client is being assigned where there was none,
      // prefix the title with the client name (or alias). If the client changes, swap the prefix.
      let finalTitle = editForm.title;
      if (newClientId) {
        const selectedClient = clientsList.find((c) => c.id === newClientId);
        if (selectedClient) {
          const prefix = `${(selectedClient as any).alias || selectedClient.name}: `;
          if (!existingClientId) {
            // No client before → add prefix
            finalTitle = `${prefix}${editForm.title}`;
          } else if (existingClientId !== newClientId) {
            // Different client → replace old prefix if present, otherwise prepend
            const oldClient = clientsList.find((c) => c.id === existingClientId);
            if (oldClient) {
              const oldPrefix = `${(oldClient as any).alias || oldClient.name}: `;
              finalTitle = editForm.title.startsWith(oldPrefix)
                ? `${prefix}${editForm.title.slice(oldPrefix.length)}`
                : `${prefix}${editForm.title}`;
            } else {
              finalTitle = `${prefix}${editForm.title}`;
            }
          }
          // same client → title unchanged
        }
      }

      await updateTicket.mutateAsync({
        id: ticketId,
        data: {
          title: finalTitle,
          description: editForm.description,
          category: editForm.category,
          location: editForm.location,
          resource: editForm.resource || undefined,
          clientId: newClientId,
          dueAt: editForm.dueAt ? new Date(editForm.dueAt) as any : null,
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

  const priorityColor = (p: string) =>
    p === 'urgent' ? '#d32f2f' : p === 'high' ? '#e65100' : p === 'medium' ? '#1976d2' : '#9e9e9e';

  return (
    <Box sx={{ mx: { xs: -1, sm: -3, md: -4 }, px: { xs: 1, sm: 3, md: 4 }, bgcolor: '#f4f6f8', minHeight: '100%' }}>
    <Box maxWidth={720} sx={{ bgcolor: 'white', borderRadius: { xs: 0, sm: 2 }, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1px solid #e8e8e8', px: { xs: 2, sm: 3 }, py: 2.5, ml: { xs: 'auto', sm: '10%' }, mr: 'auto' }}>
      {/* ── Top bar: breadcrumb-style nav + action buttons ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, mb: { xs: 1.5, sm: 1.5 }, borderBottom: '1px solid #efefef' }}>
        {/* Breadcrumb */}
        <Box display="flex" alignItems="center" gap={0.75} sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <MuiLink
            underline="hover"
            onClick={() => setLocation(backTo)}
            sx={{ fontSize: 13, color: '#9e9e9e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <ArrowBack sx={{ fontSize: 14 }} />
            {breadcrumbLabel}
          </MuiLink>
          <Box component="span" sx={{ color: '#ddd', fontSize: 14, flexShrink: 0 }}>/</Box>
          <Box component="span" sx={{ fontSize: 13, color: '#1565c0', fontWeight: 600, flexShrink: 0 }}>
            #{ticket.ticketNumber ?? ticket.id}
          </Box>
          <Box component="span" sx={{ fontSize: 13, color: '#9e9e9e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
            — {ticket.title}
          </Box>
        </Box>
        {/* Action buttons */}
        <Box display="flex" gap={0.75} alignItems="center" flexShrink={0}>
          {canEdit && (
            isMobile ? (
              <Tooltip title={t.ticketDetail.editButton}>
                <IconButton size="small" onClick={openEditDialog} sx={{ border: '1px solid #e8e8e8', borderRadius: '6px' }}>
                  <EditOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button size="small" onClick={openEditDialog} sx={{ px: '14px', py: '5px', borderRadius: '6px', border: '1px solid #e8e8e8', background: 'none', fontSize: 12, color: '#616161', fontWeight: 400, textTransform: 'none', minWidth: 0, boxShadow: 'none', '&:hover': { background: '#f9f9f9', boxShadow: 'none' } }}>
                {t.ticketDetail.editButton}
              </Button>
            )
          )}
          {isAdmin && (
            <Tooltip title={(ticket as any).recurrenceRule ? t.ticketDetail.recurrenceBadge : t.ticketDetail.recurrenceButton}>
              {isMobile ? (
                <IconButton size="small" onClick={openRecurrenceDialog} sx={{ border: '1px solid', borderColor: (ticket as any).recurrenceRule ? 'primary.main' : '#e8e8e8', borderRadius: '6px', bgcolor: (ticket as any).recurrenceRule ? 'primary.main' : 'transparent', color: (ticket as any).recurrenceRule ? 'white' : 'inherit' }}>
                  <RepeatIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : (
                <Button size="small" onClick={openRecurrenceDialog} variant={(ticket as any).recurrenceRule ? 'contained' : 'text'} color={(ticket as any).recurrenceRule ? 'primary' : 'inherit'} sx={{ px: '14px', py: '5px', borderRadius: '6px', fontSize: 12, textTransform: 'none', minWidth: 0, ...((!(ticket as any).recurrenceRule) && { border: '1px solid #e8e8e8', color: '#616161', fontWeight: 400, boxShadow: 'none', '&:hover': { background: '#f9f9f9', boxShadow: 'none' } }) }}>
                  {t.ticketDetail.recurrenceButton}
                </Button>
              )}
            </Tooltip>
          )}
          {isAdmin && (
            isMobile ? (
              <Tooltip title={lang === 'it' ? `Elimina ${entityTerm.singularLower}` : `Delete ${entityTerm.singularLower}`}>
                <IconButton size="small" onClick={() => setDeleteDialog(true)} sx={{ borderRadius: '6px', background: '#fde8e8', color: '#b71c1c', '&:hover': { background: '#fcc' } }}>
                  <DeleteOutline sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button size="small" onClick={() => setDeleteDialog(true)} sx={{ px: '14px', py: '5px', borderRadius: '6px', border: 'none', background: '#fde8e8', fontSize: 12, color: '#b71c1c', fontWeight: 600, textTransform: 'none', minWidth: 0, boxShadow: 'none', '&:hover': { background: '#fbbdbd', boxShadow: 'none' } }}>
                {lang === 'it' ? 'Elimina' : 'Delete'}
              </Button>
            )
          )}
        </Box>
      </Box>

      {/* ── Two-column layout: left (main) + right (sidebar) ── */}
      <Box>

        {/* ── LEFT: main content ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

          {/* Meta bar — righe esplicite */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2.5 }}>

            {/* Riga 1: status · priorità · categoria · sede */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              {/* Status pill — cliccabile se permesso */}
              {(() => {
                const customColor = getColorForKey(ticket.status);
                const label = getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status;
                const clickProps = canChangeStatus ? { onClick: (e: React.MouseEvent<HTMLElement>) => setStatusAnchor(e.currentTarget), sx: { cursor: 'pointer' } } : {};
                if (customColor) {
                  return (
                    <Box component="span" {...clickProps} sx={{ display: 'inline-flex', alignItems: 'center', px: 1.375, py: 0.375, borderRadius: 20, bgcolor: customColor, color: 'white', fontWeight: 700, fontSize: { xs: 12, sm: 14 }, lineHeight: 1.6, ...(canChangeStatus ? { cursor: 'pointer', '&:hover': { opacity: 0.85 } } : {}) }}>
                      {label}
                    </Box>
                  );
                }
                const muiColor = getStatusColor(ticket.status);
                const softMap: Record<string, { bg: string; fg: string }> = {
                  open: { bg: '#e3f0fd', fg: '#1565c0' },
                  in_progress: { bg: '#fff3e0', fg: '#e65100' },
                  waiting: { bg: '#f3e5f5', fg: '#6a1b9a' },
                  resolved: { bg: '#e8f5e9', fg: '#1b5e20' },
                  closed: { bg: '#f5f5f5', fg: '#424242' },
                };
                const soft = softMap[ticket.status];
                return soft ? (
                  <Box component="span" {...clickProps} sx={{ display: 'inline-flex', alignItems: 'center', px: 1.375, py: 0.375, borderRadius: 20, bgcolor: soft.bg, color: soft.fg, fontWeight: 700, fontSize: { xs: 12, sm: 14 }, lineHeight: 1.6, ...(canChangeStatus ? { cursor: 'pointer', '&:hover': { opacity: 0.85 } } : {}) }}>
                    {label}
                  </Box>
                ) : (
                  <Chip label={label} size="small" color={muiColor as any} onClick={canChangeStatus ? (e) => setStatusAnchor(e.currentTarget) : undefined} sx={{ fontWeight: 700, height: 22, fontSize: { xs: 12, sm: 14 }, borderRadius: 20, ...(canChangeStatus ? { cursor: 'pointer' } : {}) }} />
                );
              })()}
              {/* Priority dot + text — cliccabile se permesso */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625, ...(canChangeStatus ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}
                onClick={canChangeStatus ? (e) => setPriorityAnchor(e.currentTarget) : undefined}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: priorityColor(ticket.priority) }} />
                <Box component="span" sx={{ fontWeight: 600, fontSize: { xs: 12, sm: 14 }, color: priorityColor(ticket.priority) }}>
                  {t.priority[ticket.priority] || ticket.priority}
                </Box>
              </Box>
              {ticket.category && (
                <>
                  <Box component="span" sx={{ color: '#e0e0e0' }}>·</Box>
                  <Box component="span"
                    onClick={canEdit ? (e) => setCategoryAnchor(e.currentTarget) : undefined}
                    sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: '#546e7a', ...(canEdit ? { cursor: 'pointer', '&:hover': { opacity: 0.7 } } : {}) }}>
                    {ticket.category}
                  </Box>
                </>
              )}
              {!singleLocation && ticket.location && (
                <>
                  <Box component="span" sx={{ color: '#e0e0e0' }}>·</Box>
                  <Box component="span"
                    onClick={canEdit ? (e) => setLocationAnchor(e.currentTarget) : undefined}
                    sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: '#00838f', ...(canEdit ? { cursor: 'pointer', '&:hover': { opacity: 0.7 } } : {}) }}>
                    {ticket.location}
                  </Box>
                </>
              )}
            </Box>

            {/* Riga 2 desktop: nomi + scadenza/chip sulla stessa riga */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', alignItems: { sm: 'center' }, gap: { xs: 0.5, sm: 2 } }}>

              {/* Chi ha aperto → assegnatario */}
              {(creator?.name || assignee || assignedGroup) && (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ...(isAdmin ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}
                  onClick={isAdmin ? (e) => setAssignAnchor(e.currentTarget) : undefined}
                >
                  {creator?.name && (
                    <>
                      <Avatar src={creator.avatarUrl ?? undefined} sx={{ width: 16, height: 16, fontSize: 8, bgcolor: 'primary.main' }}>{creator.name.charAt(0)}</Avatar>
                      <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: '#546e7a' }}>{creator.name}</Box>
                    </>
                  )}
                  {creator?.name && (assignee || assignedGroup) && (
                    <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, color: '#bdbdbd', mx: 0.25 }}>→</Box>
                  )}
                  {(assignee || assignedGroup) && (
                    <>
                      {assignee && <Avatar src={assignee.avatarUrl ?? undefined} sx={{ width: 16, height: 16, fontSize: 8, bgcolor: 'secondary.main' }}>{assignee.name?.charAt(0)}</Avatar>}
                      <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: '#1565c0' }}>{assignedGroup ? assignedGroup : assignee?.name}</Box>
                    </>
                  )}
                </Box>
              )}

              {/* Scadenza + chip */}
              {((ticket as any).dueAt || ticket.inboundChannelId || (ticket as any).recurrenceRule || (ticket as any).scheduledAt) && (
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  {(ticket as any).dueAt && (
                    <Box component="span"
                      onClick={(isAdmin || isAssignee) ? (e) => setDueAnchor(e.currentTarget) : undefined}
                      sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 600, color: new Date((ticket as any).dueAt) < new Date() && ticket.status !== 'resolved' && !isClosedKey(ticket.status) ? '#d32f2f' : '#e65100', ...((isAdmin || isAssignee) ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}>
                      ⚠ {lang === 'it' ? 'Scade' : 'Due'} {new Date((ticket as any).dueAt).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Box>
                  )}
                  {ticket.inboundChannelId && (
                    <Tooltip title={t.ticketDetail.inboundChannelLabel} placement="top" arrow>
                      <Chip icon={<EmailIcon sx={{ fontSize: '0.875rem !important' }} />} label="Email" size="small" color="info" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  {(ticket as any).recurrenceRule && (
                    <Tooltip title={t.ticketList.recurrenceBadgeTooltip} placement="top" arrow>
                      <Chip icon={<RepeatIcon sx={{ fontSize: '0.875rem !important' }} />} label={t.ticketDetail.recurrenceBadge} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  {(ticket as any).scheduledAt && new Date((ticket as any).scheduledAt) > new Date() && !((ticket as any).recurrenceRule) && (
                    <Tooltip title={`${t.ticketList.scheduledBadgeTooltip} ${new Date((ticket as any).scheduledAt).toLocaleDateString(dateLocale)}`} placement="top" arrow>
                      <Chip icon={<CalendarTodayIcon sx={{ fontSize: '0.875rem !important' }} />} label={lang === 'it' ? 'Programmata' : 'Scheduled'} size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Box>
              )}

            </Box>

          </Box>

          {/* H1 Title — E style */}
          <Box component="h1" sx={{ m: 0, mb: 1.5, fontSize: { xs: '1.25rem', sm: '1.45rem' }, fontWeight: 800, color: '#111', lineHeight: 1.22, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
            {ticket.title}
          </Box>

          {/* Description block — flat, no card border */}
          <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #efefef' }}>
            <Box sx={{ fontSize: 11, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: '6px' }}>
              {t.ticketDetail.descriptionLabel}
            </Box>
            <MarkdownContent content={ticket.description} />
            {/* Ticket-level attachments */}
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
                          <Box key={a.id} onClick={() => setLightboxSrc(href)} sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', cursor: 'zoom-in', '&:hover img': { opacity: 0.85 } }}>
                            <img src={href} alt={a.fileName} style={{ display: 'block', maxWidth: 200, maxHeight: 140, objectFit: 'cover' }} />
                            <Box sx={{ px: 1, py: 0.4, fontSize: '0.7rem', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                  {files.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {files.map((a: any) => {
                        const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                        return <Chip key={a.id} icon={<InsertDriveFile fontSize="small" />} label={a.fileName} size="small" variant="outlined" component="a" href={href} target="_blank" rel="noopener noreferrer" clickable deleteIcon={<Download fontSize="small" />} onDelete={() => window.open(href, '_blank')} sx={{ maxWidth: 280 }} />;
                      })}
                    </Box>
                  )}
                </Box>
              );
            })()}
          </Box>

          {/* Checklist */}
          <ChecklistSection ticketId={ticketId} isAdmin={isAdmin} />

          <Divider sx={{ mt: 1.5, mb: 1.5 }} />

          {/* Tabs — E style: minimal underline indicator */}
          <Box>
            <Box sx={{ borderBottom: '1px solid #efefef' }}>
              <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  px: 0,
                  minHeight: 0,
                  '& .MuiTabs-indicator': { bgcolor: '#111', height: 2 },
                  '& .MuiTab-root': {
                    minHeight: 0,
                    px: 0,
                    mr: 3,
                    pb: 1.5,
                    pt: 0,
                    fontSize: 14,
                    fontWeight: 400,
                    color: '#bdbdbd',
                    textTransform: 'none',
                    minWidth: 0,
                  },
                  '& .MuiTab-root.Mui-selected': { color: '#111', fontWeight: 700 },
                }}
              >
                <Tab label={`${t.ticketDetail.tabComments} (${(comments?.length ?? 0) + ((ticket as any).resolutionNote ? 1 : 0)})`} />
                <Tab label={t.ticketDetail.tabActivity} />
                {canAccessNotes && <Tab label={`${t.ticketDetail.tabNotes} (${notes?.length ?? 0})`} />}
              </Tabs>
            </Box>

            {/* ── Tab: Comments ── */}
            <TabPanel value={tabValue} index={0}>
              <Box display="flex" flexDirection="column" gap={0}>
                {comments?.length === 0 && !(ticket as any).resolutionNote && (
                  <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: '#9e9e9e' }}>
                    {t.ticketDetail.noComments}
                  </Box>
                )}

                {(comments?.length ?? 0) > 0 && (
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
                      const avatarLetter = customerReply ? customerReply.name.charAt(0).toUpperCase() : c.author?.name?.charAt(0);
                      const avatarBg = isSolution ? '#2e7d32' : customerReply ? '#7c4dff' : '#1565c0';

                      const commentEl = (
                        <Box
                          key={`c-${c.id}`}
                          display="flex"
                          gap={1.5}
                          sx={{ py: 2, borderBottom: '1px solid #f5f5f5', ...(customerReply ? { ml: { xs: 3, sm: 5 } } : {}) }}
                          onMouseEnter={() => setHoveredCommentId(c.id)}
                          onMouseLeave={() => setHoveredCommentId(null)}
                        >
                          <Avatar
                            src={customerReply ? undefined : ((c.author as any)?.avatarUrl ?? undefined)}
                            sx={{ bgcolor: avatarBg, width: 34, height: 34, fontSize: 14, flexShrink: 0 }}
                          >
                            {avatarLetter}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            {/* Header: author · time · solution badge */}
                            <Box display="flex" alignItems="baseline" gap={1.25} mb={0.875} flexWrap="wrap">
                              {customerReply ? (
                                <>
                                  <Box component="span" sx={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{customerReply.name}</Box>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    <MailOutline sx={{ fontSize: 12, color: '#9e9e9e' }} />
                                    <Box component="span" sx={{ fontSize: 12, color: '#9e9e9e' }}>Risposta del cliente</Box>
                                    <Box component="a" href={`mailto:${customerReply.email}`} sx={{ fontSize: 12, color: '#1565c0', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{customerReply.email}</Box>
                                  </Box>
                                </>
                              ) : (
                                <UserLink
                                  userId={c.authorId}
                                  name={c.author?.name}
                                  typographyProps={{ sx: { fontWeight: 700, fontSize: 14, color: '#111' } } as any}
                                />
                              )}
                              <Box component="span" sx={{ fontSize: 13, color: '#bdbdbd' }}>
                                {new Date(c.createdAt).toLocaleString(dateLocale)}
                              </Box>
                              {c.updatedAt && c.updatedAt !== c.createdAt && (
                                <Box component="span" sx={{ fontSize: 13, color: '#bdbdbd', fontStyle: 'italic' }}>({t.ticketDetail.commentEdited})</Box>
                              )}
                              {isSolution && (
                                <Box component="span" sx={{ fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>✓ {t.ticketDetail.solutionLabel}</Box>
                              )}
                            </Box>
                            {/* Comment text */}
                            <Box sx={isSolution ? { borderLeft: '3px solid #4caf50', pl: 1.5, color: '#1b5e20' } : customerReply ? { borderLeft: '3px solid #7c4dff', pl: 1.5 } : {}}>
                              {isEditingThis ? (
                                <Box mt={0.5} display="flex" flexDirection="column" gap={1}>
                                  <RichCommentEditor ref={editCommentEditorRef} value={editCommentText} onChange={setEditCommentText} placeholder={t.ticketDetail.addCommentPlaceholder} ticketId={ticketId} minRows={2} />
                                  <Box display="flex" gap={1} justifyContent="flex-end">
                                    <Button size="small" onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}>{t.ticketDetail.editCancel}</Button>
                                    <Button size="small" variant="contained" onClick={() => handleEditCommentSave(c.id)} disabled={!editCommentText.trim() || updateComment.isPending}>
                                      {updateComment.isPending ? '...' : t.ticketDetail.editCommentSave}
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <MarkdownContent content={customerReply ? customerReply.body : c.commentText} />
                              )}
                              {/* Comment attachments */}
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
                                                <Box key={a.id} onClick={() => setLightboxSrc(href)} sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', cursor: 'zoom-in', '&:hover img': { opacity: 0.85 } }}>
                                                  <img src={href} alt={a.fileName} style={{ display: 'block', maxWidth: 180, maxHeight: 120, objectFit: 'cover' }} />
                                                  <Box sx={{ px: 1, py: 0.4, fontSize: '0.7rem', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</Box>
                                                </Box>
                                              );
                                            })}
                                          </Box>
                                        )}
                                        {files.length > 0 && (
                                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {files.map((a: any) => {
                                              const href = `/api/storage/objects/${(a.objectPath as string).replace(/^\/objects\//, '')}`;
                                              return <Chip key={a.id} icon={<InsertDriveFile fontSize="small" />} label={a.fileName} size="small" variant="outlined" component="a" href={href} target="_blank" rel="noopener noreferrer" clickable sx={{ maxWidth: 260 }} />;
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
                                {/* Reaction chips */}
                                {(() => {
                                  const reactions = commentReactions[c.id] ?? [];
                                  if (reactions.length === 0) return null;
                                  return (
                                    <Box display="flex" flexWrap="wrap" gap={0.5} mb={0.5}>
                                      {reactions.map((r) => (
                                        <Tooltip key={r.emoji} title={formatReactionTooltip(r.users)} placement="top" arrow enterDelay={300} enterTouchDelay={400} leaveTouchDelay={3000}>
                                          <Box component="span" onClick={() => handleToggleReaction(c.id, r.emoji)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.2, borderRadius: 10, fontSize: '0.78rem', cursor: 'pointer', border: '1px solid', borderColor: r.userReacted ? 'primary.main' : 'divider', bgcolor: r.userReacted ? 'primary.50' : 'action.hover', color: r.userReacted ? 'primary.main' : 'text.secondary', fontWeight: r.userReacted ? 700 : 400, transition: 'all 0.15s', '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' } }}>
                                            <span>{r.emoji}</span><span>{r.count}</span>
                                          </Box>
                                        </Tooltip>
                                      ))}
                                    </Box>
                                  );
                                })()}
                                {/* Action links row */}
                                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                  <Box component="span" onClick={() => handleReply(c.id, c.author?.name)} sx={{ fontSize: 12, color: replyingToCommentId === c.id ? '#1565c0' : '#9e9e9e', cursor: 'pointer', '&:hover': { color: '#1565c0', textDecoration: 'underline' } }}>
                                    {t.ticketDetail.replyComment}
                                  </Box>
                                  {(() => {
                                    const alreadyLiked = (commentReactions[c.id] ?? []).some((r) => r.emoji === '👍' && r.userReacted);
                                    return (
                                      <Box component="span" onClick={() => handleToggleReaction(c.id, '👍')} sx={{ cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, color: alreadyLiked ? 'primary.main' : '#9e9e9e', fontWeight: alreadyLiked ? 700 : 400, opacity: hoveredCommentId === c.id || alreadyLiked ? 1 : 0, transition: 'opacity 0.15s, color 0.15s', '@media (pointer: coarse)': { opacity: 1 }, '&:hover': { color: 'primary.main' } }}>
                                        👍
                                      </Box>
                                    );
                                  })()}
                                  {(canEditComment || canDeleteComment) && (
                                    <IconButton size="small" onClick={(e) => setCommentMenuAnchor({ el: e.currentTarget, commentId: c.id })} sx={{ p: 0.25, color: '#9e9e9e', '&:hover': { color: '#111' } }}>
                                      <MoreVert sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  )}
                                  {canMarkSolution && (
                                    <Button size="small" variant={isSolution ? 'contained' : 'outlined'} color="success" startIcon={isSolution ? <CheckCircle sx={{ fontSize: 13 }} /> : <CheckCircleOutline sx={{ fontSize: 13 }} />} onClick={() => handleMarkSolution(c.id, isSolution)} disabled={markingSolution === c.id} sx={{ fontSize: '0.68rem', py: 0.25, px: 0.75, height: 22, minWidth: 0, ml: 'auto' }}>
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
                          <Avatar src={(currentUser as any)?.avatarUrl ?? undefined} sx={{ bgcolor: 'primary.main', width: { xs: 28, sm: 34 }, height: { xs: 28, sm: 34 }, flexShrink: 0 }}>{currentUser?.name?.charAt(0)}</Avatar>
                          <Box flex={1} display="flex" flexDirection="column" gap={1}>
                            <RichCommentEditor ref={inlineEditorRef} value={inlineReplyText} onChange={setInlineReplyText} placeholder={t.ticketDetail.addCommentPlaceholder} ticketId={ticketId} onAttachmentsChange={setInlinePendingAttachments} minRows={2} />
                            <Box display="flex" gap={1} justifyContent="flex-end">
                              <Button size="small" onClick={() => { setReplyingToCommentId(null); setInlineReplyText(''); }}>{t.ticketDetail.editCancel}</Button>
                              <Button size="small" variant="contained" onClick={submitInlineReply} disabled={(!inlineReplyText.trim() && inlinePendingAttachments.length === 0) || addComment.isPending}>
                                {addComment.isPending ? t.ticketDetail.sending : t.ticketDetail.replyComment}
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                      return [commentEl, editorEl];
                    })}
                  </Box>
                )}

                {/* Comment actions menu */}
                <Menu anchorEl={commentMenuAnchor?.el} open={Boolean(commentMenuAnchor)} onClose={() => setCommentMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { elevation: 3, sx: { minWidth: 150 } } }}>
                  {(() => {
                    const mc = comments?.find((c) => c.id === commentMenuAnchor?.commentId);
                    if (!mc) return null;
                    const canEdit = mc.authorId === currentUser?.id;
                    const canDelete = mc.authorId === currentUser?.id || isAdmin;
                    return [
                      canEdit && <MenuItem key="edit" onClick={() => { handleEditComment(commentMenuAnchor!.commentId, mc.commentText); setCommentMenuAnchor(null); }}><ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon><ListItemText>{t.ticketDetail.editComment}</ListItemText></MenuItem>,
                      canDelete && <MenuItem key="delete" onClick={() => { setDeleteCommentId(commentMenuAnchor!.commentId); setCommentMenuAnchor(null); }} sx={{ color: 'error.main' }}><ListItemIcon sx={{ color: 'error.main' }}><DeleteOutline fontSize="small" /></ListItemIcon><ListItemText>{t.ticketDetail.deleteComment}</ListItemText></MenuItem>,
                    ].filter(Boolean);
                  })()}
                </Menu>

                {/* Resolution note */}
                {(ticket as any).resolutionNote && (
                  <Box display="flex" gap={1.5} mt={1}>
                    <Avatar sx={{ bgcolor: 'success.main', width: 34, height: 34, flexShrink: 0 }}><CheckCircleOutline sx={{ fontSize: 16 }} /></Avatar>
                    <Box flex={1} borderRadius={1} overflow="hidden" sx={{ border: '1px solid', borderColor: 'success.200' }}>
                      <Box display="flex" alignItems="center" gap={1} px={1.5} py={0.6} sx={{ bgcolor: 'success.100', borderBottom: '1px solid', borderColor: 'success.200' }}>
                        <Box component="span" sx={{ fontWeight: 700, fontSize: 12, color: '#1b5e20', flexShrink: 0 }}>✓ {t.ticketDetail.resolutionNoteLabel}</Box>
                        {closerActivity?.user?.name && <Box component="span" sx={{ fontSize: 12, color: '#1b5e20', opacity: 0.75, flexShrink: 0 }}>· {closerActivity.user.name}</Box>}
                      </Box>
                      <Box px={1.5} py={1} sx={{ background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.16)} 100%)` }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'success.dark' }}>{(ticket as any).resolutionNote}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Email reply compose panel */}
                {emailReplyOpen && ticket.status !== 'closed' && isEmailResource && (
                  <Box mt={2} sx={{ border: '1px solid', borderColor: (theme) => alpha(theme.palette.info.main, 0.35), borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ bgcolor: (theme) => alpha(theme.palette.info.main, 0.08), px: 2, py: 1, borderBottom: '1px solid', borderColor: (theme) => alpha(theme.palette.info.main, 0.2), display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon sx={{ fontSize: 16, color: 'info.main' }} />
                      <Typography variant="caption" fontWeight={600} color="info.dark">{t.ticketDetail.replyViaEmail}</Typography>
                    </Box>
                    <Box px={2} py={1.5} display="flex" flexDirection="column" gap={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>{t.ticketDetail.emailReplyTo}:</Typography>
                        <Typography variant="caption" fontWeight={600} color="info.main">{(ticket as any).resource}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, flexShrink: 0 }}>{t.ticketDetail.emailReplySubject}:</Typography>
                        <Typography variant="caption" color="text.secondary">Re: [#{ticket.ticketNumber ?? ticket.id}] {ticket.title}</Typography>
                      </Box>
                      <TextField multiline minRows={4} maxRows={12} fullWidth size="small" value={emailReplyBody} onChange={(e) => setEmailReplyBody(e.target.value)} placeholder={t.ticketDetail.emailReplyBodyPlaceholder} disabled={emailReplySending} sx={{ mt: 0.5 }} />
                      {emailReplyAttachments.length > 0 && (
                        <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.5}>
                          {emailReplyAttachments.map((att) => (
                            <Chip key={att.objectPath} icon={<AttachFile sx={{ fontSize: 14 }} />} label={att.fileName} size="small" onDelete={() => setEmailReplyAttachments((prev) => prev.filter((a) => a.objectPath !== att.objectPath))} deleteIcon={<Tooltip title={t.ticketDetail.emailReplyRemoveAttachment}><CloseIcon sx={{ fontSize: 14 }} /></Tooltip>} sx={{ maxWidth: 200 }} />
                          ))}
                        </Box>
                      )}
                      {emailReplyAttachError && <Alert severity="warning" sx={{ py: 0.5 }} onClose={() => setEmailReplyAttachError(null)}>{emailReplyAttachError}</Alert>}
                      {emailReplyError && <Alert severity="error" sx={{ py: 0.5 }}>{emailReplyError}</Alert>}
                      <input type="file" multiple ref={emailReplyFileInputRef} style={{ display: 'none' }} onChange={handleEmailReplyFileChange} accept={EMAIL_REPLY_ALLOWED_TYPES.join(',')} />
                      <Box display="flex" gap={1} justifyContent="space-between" alignItems="center">
                        <Tooltip title={t.ticketDetail.emailReplyAttach}>
                          <span>
                            <IconButton size="small" onClick={() => emailReplyFileInputRef.current?.click()} disabled={emailReplySending || emailReplyUploading}>
                              {emailReplyUploading ? <CircularProgress size={16} /> : <AttachFile sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Box display="flex" gap={1}>
                          <Button size="small" onClick={() => { setEmailReplyOpen(false); setEmailReplyBody(''); setEmailReplyError(null); setEmailReplyAttachments([]); setEmailReplyAttachError(null); }} disabled={emailReplySending}>{t.ticketDetail.emailReplyCancel}</Button>
                          <Button variant="contained" color="info" size="small" startIcon={<EmailIcon />} onClick={submitEmailReply} disabled={!emailReplyBody.trim() || emailReplySending || emailReplyUploading}>
                            {emailReplySending ? t.ticketDetail.emailReplySending : t.ticketDetail.emailReplySend}
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Compose — new comment */}
                {ticket.status === 'closed' ? (
                  <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>{t.ticketDetail.closedTicketComment(entityTerm.singular)}</Alert>
                ) : !replyingToCommentId && (
                  <Box display="flex" gap={1.5} alignItems="flex-start" sx={{ pt: 2.5, mt: 1, borderTop: '1px solid #efefef' }}>
                    <Avatar src={(currentUser as any)?.avatarUrl ?? undefined} sx={{ bgcolor: 'primary.main', width: 32, height: 32, flexShrink: 0, fontSize: 12 }}>
                      {currentUser?.name?.charAt(0)}
                    </Avatar>
                    <Box flex={1} display="flex" flexDirection="column" gap={1}>
                      <RichCommentEditor ref={editorRef} value={newComment} onChange={setNewComment} placeholder={t.ticketDetail.addCommentPlaceholder} ticketId={ticketId} onAttachmentsChange={setPendingAttachments} />
                      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        {isEmailResource && (
                          <Tooltip title={`${t.ticketDetail.replyWillBeSentTo} ${(ticket as any).resource}`}>
                            <FormControlLabel
                              control={<Checkbox size="small" checked={sendToCustomer} onChange={(e) => setSendToCustomer(e.target.checked)} color="primary" />}
                              label={<Typography variant="caption" color="text.secondary">{t.ticketDetail.sendReplyToCustomer}{' '}<Typography component="span" variant="caption" color="primary.main" fontWeight={600}>{(ticket as any).resource}</Typography></Typography>}
                            />
                          </Tooltip>
                        )}
                        <Button variant="contained" sx={{ alignSelf: 'flex-end', ml: 'auto', borderRadius: '8px', px: 2.5 }} onClick={submitComment} disabled={(!newComment.trim() && pendingAttachments.length === 0) || addComment.isPending}>
                          {addComment.isPending ? t.ticketDetail.sending : t.ticketDetail.sendComment}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

              </Box>
            </TabPanel>

            {/* ── Tab: Activity ── */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ pt: 0.5, pb: 0.5 }}>
                {activities?.length === 0 && (
                  <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: '#9e9e9e' }}>{t.ticketDetail.noActivity}</Box>
                )}
                {[...(activities ?? [])].reverse().map((a) => {
                  const isHighlight = a.actionType === 'priority_changed' || (a.actionType === 'status_changed' && (a.actionDescription?.includes('Urgente') || a.actionDescription?.includes('Urgent')));
                  const actorName = (a as any).user?.name as string | undefined;
                  return (
                    <Box key={a.id} display="flex" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, ml: '14px', bgcolor: isHighlight ? '#e65100' : '#e0e0e0' }} />
                      <Box component="span" sx={{ flex: 1, fontSize: 13, color: isHighlight ? '#e65100' : '#9e9e9e' }}>
                        {actorName && (
                          <Box component="span" sx={{ fontWeight: 700, color: isHighlight ? '#e65100' : '#616161', mr: 0.5 }}>{actorName}</Box>
                        )}
                        {a.actionDescription}
                      </Box>
                      <Box component="span" sx={{ fontSize: 12, color: '#bdbdbd', flexShrink: 0 }}>{new Date(a.createdAt).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}</Box>
                    </Box>
                  );
                })}
              </Box>
            </TabPanel>

            {/* ── Tab: Notes ── */}
            {canAccessNotes && (
              <TabPanel value={tabValue} index={2}>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" alignItems="center" justifyContent="flex-end">
                    <PermissionGateButton permission="add_notes" sectionLabel={t.ticketDetail.tabNotes} />
                  </Box>
                  {notes?.length === 0 && <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: '#9e9e9e' }}>{t.ticketDetail.noNotes}</Box>}
                  {notes?.map((n: any) => (
                    <Box key={n.id} display="flex" gap={2} sx={{ bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200', borderRadius: 1, p: 2 }}>
                      <Avatar sx={{ bgcolor: 'warning.main', width: 34, height: 34, fontSize: 14 }}>{n.author?.name?.charAt(0)}</Avatar>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="subtitle2" fontWeight={700}>{n.author?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{new Date(n.createdAt).toLocaleString(dateLocale)}</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{n.noteText}</Typography>
                      </Box>
                    </Box>
                  ))}
                  <Box display="flex" gap={2} mt={1}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 34, height: 34, fontSize: 14 }}>{currentUser?.name?.charAt(0)}</Avatar>
                    <Box flex={1} display="flex" flexDirection="column" gap={1}>
                      <TextField multiline rows={3} fullWidth placeholder={t.ticketDetail.addNotePlaceholder} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                      <Button variant="contained" color="warning" sx={{ alignSelf: 'flex-end' }} disabled={!newNote.trim() || addNote.isPending}
                        onClick={async () => {
                          if (!newNote.trim()) return;
                          const note = await addNote.mutateAsync({ id: ticketId, data: { noteText: newNote } });
                          setNewNote('');
                          queryClient.setQueryData(getListTicketNotesQueryKey(ticketId), (old: any[] = []) => [...old, note]);
                        }}>
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

      {/* ── Popover: cambia categoria dalla metabar ── */}
      <Popover open={Boolean(categoryAnchor)} anchorEl={categoryAnchor} onClose={() => setCategoryAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.categoryLabel}</Box>
        <Box display="flex" flexDirection="column" gap={0.5}>
          {editCategories.map((c) => (
            <Box key={c} onClick={async () => { await updateTicket.mutateAsync({ id: ticketId, data: { category: c } as any }); queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }); setCategoryAnchor(null); }}
              sx={{ px: 1, py: 0.75, borderRadius: 1, fontSize: 13, cursor: 'pointer', bgcolor: ticket.category === c ? 'primary.50' : 'transparent', color: ticket.category === c ? 'primary.main' : '#424242', fontWeight: ticket.category === c ? 700 : 400, '&:hover': { bgcolor: '#f5f5f5' } }}>
              {c}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* ── Popover: cambia sede dalla metabar ── */}
      <Popover open={Boolean(locationAnchor)} anchorEl={locationAnchor} onClose={() => setLocationAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.locationLabel}</Box>
        <Box display="flex" flexDirection="column" gap={0.5}>
          {editLocations.map((l) => (
            <Box key={l} onClick={async () => { await updateTicket.mutateAsync({ id: ticketId, data: { location: l } as any }); queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }); setLocationAnchor(null); }}
              sx={{ px: 1, py: 0.75, borderRadius: 1, fontSize: 13, cursor: 'pointer', bgcolor: ticket.location === l ? 'primary.50' : 'transparent', color: ticket.location === l ? 'primary.main' : '#424242', fontWeight: ticket.location === l ? 700 : 400, '&:hover': { bgcolor: '#f5f5f5' } }}>
              {l}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* ── Popover: modifica scadenza dalla metabar ── */}
      <Popover open={Boolean(dueAnchor)} anchorEl={dueAnchor} onClose={() => setDueAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.dueAtLabel}</Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <TextField type="datetime-local" size="small" value={dueEditVal} onChange={(e) => setDueEditVal(e.target.value)} onBlur={() => handleDueAtChange(dueEditVal)} inputProps={{ style: { fontSize: 12 } }} sx={{ minWidth: 190 }} disabled={updateTicket.isPending} />
          {dueEditVal && (
            <Tooltip title={t.ticketDetail.dueAtClear}>
              <span>
                <IconButton size="small" disabled={updateTicket.isPending} onClick={() => { setDueEditVal(''); handleDueAtChange(''); setDueAnchor(null); }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
        <Box display="flex" justifyContent="flex-end" mt={1}>
          <Button size="small" variant="contained" disabled={updateTicket.isPending} onClick={() => { handleDueAtChange(dueEditVal); setDueAnchor(null); }}>
            {lang === 'it' ? 'Salva' : 'Save'}
          </Button>
        </Box>
      </Popover>

      {/* ── Popover: cambia stato dalla metabar ── */}
      <Popover open={Boolean(statusAnchor)} anchorEl={statusAnchor} onClose={() => setStatusAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.statusLabel}</Box>
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {orgStatuses.map((s) => {
            const isActive = ticket.status === s.key;
            const customColor = s.color;
            return (
              <Chip key={s.key} label={s.label} size="small" variant={isActive ? 'filled' : 'outlined'}
                onClick={() => { handleStatusChange(s.key); setStatusAnchor(null); }}
                disabled={updateTicket.isPending}
                {...(isActive && customColor ? { sx: { bgcolor: customColor, color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 11 } } : isActive ? { color: getStatusColor(s.key) as any, sx: { cursor: 'pointer', fontWeight: 700, fontSize: 11 } } : { sx: { cursor: 'pointer', fontWeight: 400, fontSize: 11 } })}
              />
            );
          })}
        </Box>
      </Popover>

      {/* ── Popover: cambia priorità dalla metabar ── */}
      <Popover open={Boolean(priorityAnchor)} anchorEl={priorityAnchor} onClose={() => setPriorityAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: '#bdbdbd', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.priorityLabel}</Box>
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {PRIORITY_OPTIONS.map((p) => (
            <Chip key={p} label={t.priority[p] || p} size="small"
              color={ticket.priority === p ? (getPriorityColor(p) as any) : 'default'}
              variant={ticket.priority === p ? 'filled' : 'outlined'}
              onClick={() => { handlePriorityChange(p); setPriorityAnchor(null); }}
              disabled={updateTicket.isPending}
              sx={{ cursor: 'pointer', fontWeight: ticket.priority === p ? 700 : 400, fontSize: 11 }}
            />
          ))}
        </Box>
      </Popover>

      {/* ── Dialogs ── */}

      {/* Resolution note dialog */}
      <Dialog open={resolutionDialog} onClose={() => setResolutionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t.ticketDetail.resolutionNoteTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>{t.ticketDetail.resolutionNoteSubtitle}</Typography>
          <TextField fullWidth multiline rows={4} placeholder={t.ticketDetail.resolutionNotePlaceholder} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => confirmResolved('')} disabled={updateTicket.isPending} color="inherit">{t.ticketDetail.resolutionNoteSkip}</Button>
          <Button variant="contained" color="success" onClick={() => confirmResolved(resolutionNote)} disabled={updateTicket.isPending} startIcon={<CheckCircleOutline />}>
            {updateTicket.isPending ? '...' : t.ticketDetail.resolutionNoteConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email reply sent */}
      <Snackbar open={emailReplySent} autoHideDuration={4000} onClose={() => setEmailReplySent(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setEmailReplySent(false)} sx={{ width: '100%' }}>{t.ticketDetail.emailReplySentOk}</Alert>
      </Snackbar>

      {/* Status change error */}
      <Snackbar open={statusError != null} autoHideDuration={5000} onClose={() => setStatusError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setStatusError(null)} sx={{ width: '100%' }}>{statusError}</Alert>
      </Snackbar>

      {/* Reaction error */}
      <Snackbar open={reactionError != null} autoHideDuration={4000} onClose={() => setReactionError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setReactionError(null)} sx={{ width: '100%' }}>{reactionError}</Alert>
      </Snackbar>

      {/* Comment error */}
      <Snackbar open={commentError != null} autoHideDuration={5000} onClose={() => setCommentError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="warning" onClose={() => setCommentError(null)} sx={{ width: '100%' }}>{commentError}</Alert>
      </Snackbar>

      {/* Delete comment confirm */}
      <Dialog open={deleteCommentId != null} onClose={() => setDeleteCommentId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteOutline /> {t.ticketDetail.deleteCommentTitle}
        </DialogTitle>
        <DialogContent><Typography variant="body2">{t.ticketDetail.deleteCommentConfirm}</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteCommentId(null)} color="inherit" disabled={deleteComment.isPending}>{t.ticketDetail.editCancel}</Button>
          <Button variant="contained" color="error" onClick={handleDeleteCommentConfirm} disabled={deleteComment.isPending} startIcon={<DeleteOutline />}>
            {deleteComment.isPending ? t.ticketDetail.deleting : t.ticketDetail.deleteCommentAction}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete ticket confirm */}
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
          <Button onClick={() => setDeleteDialog(false)} color="inherit" disabled={deleteTicket.isPending}>Annulla</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={deleteTicket.isPending} startIcon={<DeleteOutline />}>
            {deleteTicket.isPending ? t.ticketDetail.deleting : t.ticketDetail.deletePermanently}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} maxWidth="xl" PaperProps={{ sx: { bgcolor: 'black', m: 1 } }}>
        <Box sx={{ position: 'relative', lineHeight: 0 }}>
          <IconButton onClick={() => setLightboxSrc(null)} size="small" sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', zIndex: 1, '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>✕</IconButton>
          {lightboxSrc && <img src={lightboxSrc} alt="anteprima" style={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} />}
        </Box>
      </Dialog>

      {/* Edit ticket dialog */}
      <Dialog open={editDialog} onClose={() => !editSaving && setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {lang === 'it' ? `Modifica ${entityTerm.singularLower}` : `Edit ${entityTerm.singular}`} #{ticket?.ticketNumber ?? ticket?.id}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {editError && <Alert severity="error" onClose={() => setEditError(null)}>{editError}</Alert>}
          <TextField label={t.ticketDetail.editTitleField} fullWidth size="small" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} disabled={editSaving} required />
          <TextField label={t.ticketDetail.descriptionLabel} fullWidth multiline minRows={4} size="small" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} disabled={editSaving} />
          <TextField label={t.ticketDetail.categoryLabel} fullWidth size="small" select={editCategories.length > 0} value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} disabled={editSaving}>
            {editCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          {!singleLocation && (
            <TextField label={t.ticketDetail.locationLabel} fullWidth size="small" select={editLocations.length > 0} value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} disabled={editSaving}>
              {editLocations.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
          )}
          <TextField label={t.ticketDetail.resourceLabel} fullWidth size="small" value={editForm.resource} onChange={(e) => setEditForm((f) => ({ ...f, resource: e.target.value }))} disabled={editSaving} placeholder={t.ticketDetail.resourceLabel} />
          {(isAdmin || isAssignee) && (
            <TextField type="datetime-local" label={t.ticketDetail.dueAtLabel} fullWidth size="small" value={editForm.dueAt} onChange={(e) => setEditForm((f) => ({ ...f, dueAt: e.target.value }))} disabled={editSaving} InputLabelProps={{ shrink: true }} />
          )}
          {clientsList.length > 0 && (currentUser as any)?.clientsEnabled !== false && (
            <Autocomplete options={clientsList} getOptionLabel={(o) => o.name} value={clientsList.find(c => c.id.toString() === editForm.clientId) ?? null} onChange={(_, v) => setEditForm((f) => ({ ...f, clientId: v ? v.id.toString() : '' }))} disabled={editSaving} renderInput={(params) => <TextField {...params} label={t.clients.clientField} fullWidth size="small" />} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setEditDialog(false)} color="inherit" disabled={editSaving}>{t.ticketDetail.editCancel}</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving || !editForm.title.trim()} startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : <EditOutlined />}>{t.ticketDetail.editSave}</Button>
        </DialogActions>
      </Dialog>

      {/* Recurrence dialog */}
      <Dialog open={recurrenceDialog} onClose={() => setRecurrenceDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RepeatIcon fontSize="small" /> {t.ticketDetail.recurrenceDialogTitle}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {recurrenceError && <Alert severity="error">{recurrenceError}</Alert>}
            <TextField select fullWidth size="small" label={t.ticketDetail.recurrenceFrequency} value={recurrenceFreq} onChange={(e) => setRecurrenceFreq(e.target.value as any)}>
              <MenuItem value="daily">{t.ticketDetail.recurrenceFreqDaily}</MenuItem>
              <MenuItem value="weekly">{t.ticketDetail.recurrenceFreqWeekly}</MenuItem>
              <MenuItem value="monthly">{t.ticketDetail.recurrenceFreqMonthly}</MenuItem>
              <MenuItem value="yearly">{t.ticketDetail.recurrenceFreqYearly}</MenuItem>
            </TextField>
            <TextField fullWidth size="small" type="number" label={lang === 'it' ? 'Ogni' : 'Every'} value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))} inputProps={{ min: 1, max: 365 }} />
            <TextField fullWidth size="small" type="date" label={t.ticketDetail.recurrenceEndDate} value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: new Date().toISOString().slice(0, 10) }} />
            {(ticket as any).recurrenceNextAt && (
              <Typography variant="caption" color="text.secondary">{t.ticketDetail.recurrenceNextAt}: {new Date((ticket as any).recurrenceNextAt).toLocaleDateString(dateLocale)}</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Box>{(ticket as any).recurrenceRule && <Button color="error" onClick={handleRecurrenceRemove} disabled={recurrenceSaving}>{t.ticketDetail.recurrenceRemove}</Button>}</Box>
          <Box display="flex" gap={1}>
            <Button onClick={() => setRecurrenceDialog(false)} color="inherit" disabled={recurrenceSaving}>{t.ticketDetail.recurrenceCancel}</Button>
            <Button variant="contained" onClick={handleRecurrenceSave} disabled={recurrenceSaving} startIcon={recurrenceSaving ? <CircularProgress size={16} color="inherit" /> : <RepeatIcon />}>{t.ticketDetail.recurrenceSave}</Button>
          </Box>
        </DialogActions>
      </Dialog>

    </Box>
    </Box>
  );
}
