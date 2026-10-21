import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Chip, Button, Divider,
  TextField, MenuItem, CircularProgress, Avatar, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tooltip,
  IconButton, Popover, Snackbar, Menu, ListItemIcon, ListItemText,
  FormControlLabel, FormHelperText, Checkbox, Autocomplete, Link as MuiLink,
  useTheme, useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircleOutline, CheckCircle, ArrowBack, Person, Group, EditOutlined, InsertDriveFile, Download, DeleteOutline, MoreVert, MailOutline, Email as EmailIcon, AttachFile, Close as CloseIcon, Repeat as RepeatIcon, CalendarToday as CalendarTodayIcon, LockOutlined } from '@mui/icons-material';
import {
  useGetTicket, useUpdateTicket, useListTicketComments, useAddTicketComment,
  useListTicketActivity, useListUsers, useListTicketAttachments, useSaveTicketAttachment,
  useDeleteTicket,
  useListTicketNotes, useAddTicketNote,
  useUpdateTicketComment, useDeleteTicketComment,
  useListClients,
  useSetTicketRecurrence, useDeleteTicketRecurrence,
  useGetTicketTimeSessionEdits, getGetTicketTimeSessionEditsQueryKey,
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
import { trackEvent } from '../lib/analytics';

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

function splitWorkedMinutes(total: number | null | undefined): { hours: string; minutes: string } {
  if (total == null || !Number.isFinite(total) || total < 0) return { hours: '', minutes: '' };
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

function parseWorkedDuration(hoursText: string, minutesText: string): { total: number | null; error?: 'hours' | 'minutes' } {
  if (!hoursText.trim() && !minutesText.trim()) return { total: null };
  const hours = hoursText.trim() ? Number(hoursText) : 0;
  const minutes = minutesText.trim() ? Number(minutesText) : 0;
  if (!Number.isInteger(hours) || hours < 0) return { total: null, error: 'hours' };
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return { total: null, error: 'minutes' };
  return { total: hours * 60 + minutes };
}

function formatWorkedDuration(total: number, lang: 'it' | 'en'): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (lang === 'it') {
    const hourLabel = hours === 1 ? 'ora' : 'ore';
    if (hours === 0) return `${minutes} minuti`;
    if (minutes === 0) return `${hours} ${hourLabel}`;
    return `${hours} ${hourLabel} e ${minutes} minuti`;
  }
  const hourLabel = hours === 1 ? 'hour' : 'hours';
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes';
  if (hours === 0) return `${minutes} ${minuteLabel}`;
  if (minutes === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} and ${minutes} ${minuteLabel}`;
}

function toCsvCell(value: string | number): string {
  const text = String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
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

  const [tabValue, setTabValue] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');
  const [resolutionDialog, setResolutionDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [closureSummary, setClosureSummary] = useState<any | null>(null);
  const [closureSummaryOpen, setClosureSummaryOpen] = useState(false);
  const [editingTimeSession, setEditingTimeSession] = useState<any | null>(null);
  const [editedSessionMinutes, setEditedSessionMinutes] = useState('');
  const [editedSessionBillable, setEditedSessionBillable] = useState(false);
  const [editedSessionRecognizable, setEditedSessionRecognizable] = useState(false);
  const [workedHours, setWorkedHours] = useState('');
  const [workedMinutes, setWorkedMinutes] = useState('');
  const [workedTimeError, setWorkedTimeError] = useState<'hours' | 'minutes' | null>(null);
  const [timeSessionEditsDownloading, setTimeSessionEditsDownloading] = useState(false);
  const [timeSessionEditsExportError, setTimeSessionEditsExportError] = useState(false);
  const [visibilityDialog, setVisibilityDialog] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

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
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editLocations, setEditLocations] = useState<string[]>([]);
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
  const [ticketUpdateError, setTicketUpdateError] = useState<string | null>(null);
  const [clientAssociationBusy, setClientAssociationBusy] = useState(false);
  const [clientAssociationError, setClientAssociationError] = useState<string | null>(null);
  const [clientAssociationDraftId, setClientAssociationDraftId] = useState<number | null>(null);
  const [clientAssociationSaved, setClientAssociationSaved] = useState(false);

  useEffect(() => {
    setClientAssociationDraftId(null);
    setClientAssociationSaved(false);
    setClientAssociationError(null);
  }, [ticketId]);
  const [clientSuggestionBusy, setClientSuggestionBusy] = useState(false);
  const [clientSuggestionError, setClientSuggestionError] = useState<string | null>(null);
  const [sendToCustomer, setSendToCustomer] = useState(false);
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

  const publishTicket = async () => {
    if (!ticket) return;
    setVisibilitySaving(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/visibility`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: 'organization' }),
      });
      if (!response.ok) throw new Error('visibility update failed');
      await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setVisibilityDialog(false);
    } finally {
      setVisibilitySaving(false);
    }
  };

  const [recurrenceDialog, setRecurrenceDialog] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(new Date().getDay());
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(new Date().getDate());
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceSaving, setRecurrenceSaving] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);

  const { data: ticket, isLoading } = useGetTicket(ticketId, { query: { enabled: !!ticketId, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: comments } = useListTicketComments(ticketId, { query: { enabled: !!ticketId, staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: activities } = useListTicketActivity(ticketId, { query: { enabled: !!ticketId, staleTime: 60_000, refetchInterval: 30_000, refetchIntervalInBackground: false } as any });
  const { data: users } = useListUsers({ query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: clientsList = [] } = useListClients(undefined, { query: { enabled: currentUser?.role === 'admin', staleTime: 5 * 60_000 } as any });
  const { data: organizationSettings } = useQuery<{ workedTimeEnabled?: boolean; timeTrackingModuleEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    enabled: !!currentUser,
    staleTime: 5 * 60_000,
  });
  const workedTimeEnabled = organizationSettings?.workedTimeEnabled !== false;
  const timeTrackingModuleEnabled = organizationSettings?.timeTrackingModuleEnabled === true;
  const {
    data: timeSessionEdits = [],
    isLoading: timeSessionEditsLoading,
    isError: timeSessionEditsError,
    refetch: refetchTimeSessionEdits,
  } = useGetTicketTimeSessionEdits(ticketId, {
    query: {
      enabled: currentUser?.role === 'admin'
        && timeTrackingModuleEnabled
        && (ticket as any)?.timeTrackingEnabled === true
        && (ticket as any)?.canViewTimeTrackingSummary === true,
      staleTime: 30_000,
    },
  } as any);
  const firstWaitingStatusKey = orgStatuses.find((status) =>
    /waiting|attesa/i.test(`${status.key} ${status.label}`),
  )?.key;
  const visibleTicketStatuses = timeTrackingModuleEnabled && Boolean((ticket as any)?.timeTrackingEnabled)
    ? orgStatuses.filter((status) =>
        status.key === 'in_progress' ||
        status.key === firstWaitingStatusKey ||
        status.isClosed,
      )
    : orgStatuses;
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
  const isAssignee = !!(ticket && (currentUser as any)?.id && (ticket as any).assignedTo === (currentUser as any).id);
  const canAccessNotes = currentUser?.role === 'admin' || hasGroupPerm('add_notes');

  const [newNote, setNewNote] = useState('');
  const { data: notes } = useListTicketNotes(ticketId, { query: { enabled: !!ticketId && canAccessNotes, staleTime: 60_000 } as any });
  const addNote = useAddTicketNote();

  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';

  const handleExportTimeSessionEdits = async () => {
    setTimeSessionEditsDownloading(true);
    setTimeSessionEditsExportError(false);
    try {
      const result = await refetchTimeSessionEdits();
      if (!result.isSuccess || result.data.length === 0) {
        if (!result.isSuccess) setTimeSessionEditsExportError(true);
        return;
      }

      const csvRows = [
        [
          t.ticketDetail.trackedTimeEditCsvDate,
          t.ticketDetail.trackedTimeEditCsvAuthor,
          t.ticketDetail.trackedTimeEditCsvCollaborator,
          t.ticketDetail.trackedTimeEditCsvPreviousDuration,
          t.ticketDetail.trackedTimeEditCsvUpdatedDuration,
          t.ticketDetail.trackedTimeEditCsvPreviousBillable,
          t.ticketDetail.trackedTimeEditCsvUpdatedBillable,
          t.ticketDetail.trackedTimeEditCsvPreviousRecognizable,
          t.ticketDetail.trackedTimeEditCsvUpdatedRecognizable,
        ],
        ...result.data.map((edit) => [
          new Date(edit.editedAt).toISOString(),
          edit.editedByName,
          edit.collaboratorName,
          edit.previousDurationMinutes,
          edit.updatedDurationMinutes,
          edit.previousClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff,
          edit.updatedClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff,
          edit.previousCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff,
          edit.updatedCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff,
        ]),
      ];
      const csv = `\uFEFF${csvRows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${(ticket as any)?.ticketNumber ?? ticketId}-time-corrections.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setTimeSessionEditsExportError(true);
    } finally {
      setTimeSessionEditsDownloading(false);
    }
  };

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
    setTabValue(null);
    setSendToCustomer(false);
  }, [ticketId]);

  useEffect(() => {
    if (!ticket) return;
    const d = (ticket as any).dueAt;
    setDueEditVal(d ? toLocalDatetimeInput(d) : '');
  }, [ticket]);

  if (isLoading || !ticket) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  const selectedTabValue = tabValue ?? ((ticket as any).timeTrackingEnabled ? 1 : 0);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === ticket.status) return;
    if (isClosedKey(newStatus) && !isClosedKey(ticket.status)) {
      setResolutionNote('');
      const initialWorkedTime = splitWorkedMinutes((ticket as any).workedMinutes);
      setWorkedHours(initialWorkedTime.hours);
      setWorkedMinutes(initialWorkedTime.minutes);
      setWorkedTimeError(null);
      setResolutionDialog(true);
      return;
    }
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus as any } });
      trackEvent('ticket_status_changed', { status: newStatus });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    } catch (err: any) {
      if (err?.data?.error === 'TIMER_ALREADY_ACTIVE') {
        const active = err.data.activeTicket;
        setStatusError(`${t.ticketDetail.timerAlreadyActive}${active ? ` #${active.ticketNumber ?? active.id}: ${active.title}` : ''}`);
      } else if (err?.data?.error === 'Collaborator-recognizable tracked tickets require an individual assignee') {
        setStatusError(t.ticketDetail.trackedTimeAssigneeRequired);
      } else {
        setStatusError(err?.data?.message || err?.message || t.ticketDetail.statusChangeError);
      }
    }
  };

  const confirmResolved = async (note: string) => {
    const resolvedKey = orgStatuses.find((s) => s.isClosed)?.key ?? 'resolved';
    const workedTime = parseWorkedDuration(workedHours, workedMinutes);
    const showTrackedClosureSummary = Boolean((ticket as any).timeTrackingEnabled);
    if (workedTimeEnabled && workedTime.error) {
      setWorkedTimeError(workedTime.error);
      return;
    }
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: {
          status: resolvedKey as any,
          resolutionNote: note || null,
          ...(workedTimeEnabled ? { workedMinutes: workedTime.total } : {}),
        } as any,
      });
      trackEvent('ticket_resolved', {
        worked_minutes: workedTime.total ?? 0,
        has_resolution_note: Boolean(note.trim()),
      });
      await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setResolutionDialog(false);
      setResolutionNote('');
      setWorkedHours('');
      setWorkedMinutes('');
      setWorkedTimeError(null);
      if (showTrackedClosureSummary) {
        await loadTrackedClosureSummary(
          note,
          workedTimeEnabled ? workedTime.total : undefined,
        );
      }
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
    setTicketUpdateError(null);
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { assignedTo: newAssignee ? parseInt(newAssignee) : null } });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setAssignAnchor(null);
    } catch (err: any) {
      setTicketUpdateError(err?.response?.data?.message || err?.response?.data?.error || err?.data?.message || err?.data?.error || err?.message || t.ticketDetail.ticketUpdateError);
    }
  };

  const handleDueAtChange = async (val: string) => {
    setTicketUpdateError(null);
    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: { dueAt: val ? new Date(val) as any : null } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setDueEditVal(val);
      setDueAnchor(null);
    } catch (err: any) {
      setTicketUpdateError(err?.response?.data?.message || err?.response?.data?.error || err?.data?.message || err?.data?.error || err?.message || t.ticketDetail.ticketUpdateError);
    }
  };

  const loadTrackedClosureSummary = async (
    note?: string | null,
    finalManualMinutes?: number | null,
  ) => {
    if (!(ticket as any).timeTrackingEnabled) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('ticket summary unavailable');
      const finalizedTicket = await response.json();
      if (!finalizedTicket.canViewTimeTrackingSummary) return;
      setClosureSummary({
        ...finalizedTicket,
        closureSummaryNote: note?.trim() || finalizedTicket.resolutionNote || '',
        manualWorkedMinutes: finalManualMinutes !== undefined
          ? finalManualMinutes
          : finalizedTicket.workedMinutes ?? null,
      });
      setClosureSummaryOpen(true);
    } catch {
      setStatusError(t.ticketDetail.closureSummaryUnavailable);
    }
  };

  const openTimeSessionEditor = (session: any) => {
    setEditingTimeSession(session);
    setEditedSessionMinutes(String(session.durationMinutes));
    setEditedSessionBillable(Boolean(session.clientBillable));
    setEditedSessionRecognizable(Boolean(session.collaboratorRecognizable));
  };

  const saveTimeSessionEdit = async () => {
    if (!editingTimeSession) return;
    const durationMinutes = Number(editedSessionMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 0) return;
    try {
      const response = await fetch(`/api/tickets/${ticketId}/time-sessions/${editingTimeSession.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes,
          clientBillable: editedSessionBillable,
          collaboratorRecognizable: editedSessionRecognizable,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || error?.error || t.ticketDetail.trackedTimeChangeError);
      }
      await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTicketTimeSessionEditsQueryKey(ticketId) });
      setEditingTimeSession(null);
    } catch (error: any) {
      setStatusError(error?.message || t.ticketDetail.trackedTimeChangeError);
    }
  };

  const handleGroupChange = async (val: string) => {
    setTicketUpdateError(null);
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { assignedToGroup: val || null } as any });
      queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setAssignAnchor(null);
    } catch (err: any) {
      setTicketUpdateError(err?.response?.data?.message || err?.response?.data?.error || err?.data?.message || err?.data?.error || err?.message || t.ticketDetail.ticketUpdateError);
    }
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
          await loadTrackedClosureSummary(
            (ticket as any).resolutionNote,
            (ticket as any).workedMinutes ?? null,
          );
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
      setRecurrenceDayOfWeek(existing.dayOfWeek ?? new Date((ticket as any).createdAt ?? new Date()).getDay());
      setRecurrenceDayOfMonth(existing.dayOfMonth ?? new Date().getDate());
      setRecurrenceEndDate(existing.endDate ? existing.endDate.slice(0, 10) : '');
    } else {
      setRecurrenceFreq('weekly');
      setRecurrenceInterval(1);
      setRecurrenceDayOfWeek(new Date((ticket as any)?.createdAt ?? new Date()).getDay());
      setRecurrenceDayOfMonth(new Date().getDate());
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
          ...(recurrenceFreq === 'weekly' ? { dayOfWeek: recurrenceDayOfWeek } : {}),
          ...(recurrenceFreq === 'monthly' ? { dayOfMonth: recurrenceDayOfMonth } : {}),
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

  const openEditDialog = () => setLocation(`/tickets/new?edit=${ticketId}`);

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
       trackEvent('customer_reply_sent', { has_attachment: emailReplyAttachments.length > 0 });
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
       trackEvent('comment_added', {
         has_attachment: pendingAttachments.length > 0,
         sent_to_customer: Boolean(isEmailResource && sendToCustomer),
         is_reply: false,
       });
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
       trackEvent('comment_added', {
         has_attachment: inlinePendingAttachments.length > 0,
         sent_to_customer: false,
         is_reply: true,
       });
    } catch (err: any) {
      const msg = err?.message || err?.error || t.ticketDetail.closedTicketComment(entityTerm.singular);
      setCommentError(msg);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isAuthor = (ticket as any).createdBy === currentUser?.id;
  const canEdit = isAdmin || isAuthor;
  const canChangeDueAt = isAdmin || isAssignee;
  // Anyone who can open the ticket may change its status and priority.
  const canChangeStatus = (ticket as any).timeTrackingEnabled
    ? isAdmin || isAssignee
    : !!currentUser;
  const creator = (ticket as any).creator;
  const assignee = (ticket as any).assignee;
  const assignedGroup = (ticket as any).assignedToGroup;
  const canChangeAssignment = (ticket as any).timeTrackingEnabled
    ? isAdmin || hasGroupPerm('assign_time_tracked_tickets')
    : isAdmin || (!assignedGroup && (!(ticket as any).assignedTo || isAssignee));
  const clientsEnabled = (currentUser as any)?.clientsEnabled !== false;
  const ticketClient = (ticket as any).client ?? null;
  const ticketClientId = ticketClient?.id ?? (ticket as any).clientId ?? null;
  const selectedTicketClient =
    clientsList.find((client: any) => client.id === ticketClientId) ?? ticketClient;
  const clientOptions =
    selectedTicketClient && !clientsList.some((client: any) => client.id === selectedTicketClient.id)
      ? [selectedTicketClient, ...clientsList]
      : clientsList;

  const handleClientAssociationChange = async (clientId: number) => {
    setClientAssociationBusy(true);
    setClientAssociationError(null);
    setClientAssociationSaved(false);
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { clientId } as any });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() }),
      ]);
      setClientAssociationDraftId(null);
      setClientAssociationSaved(true);
    } catch {
      setClientAssociationError(t.ticketDetail.clientAssociationUpdateError);
    } finally {
      setClientAssociationBusy(false);
    }
  };

  const handleClientSuggestion = async (action: 'confirm' | 'dismiss') => {
    setClientSuggestionBusy(true);
    setClientSuggestionError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/client-suggestion/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
      await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    } catch {
      setClientSuggestionError(t.ticketDetail.clientSuggestionActionError);
    } finally {
      setClientSuggestionBusy(false);
    }
  };
  const openDueAtEditor = (anchor: HTMLElement) => {
    const dueAt = (ticket as any).dueAt;
    setDueEditVal(dueAt ? toLocalDatetimeInput(dueAt) : '');
    setTicketUpdateError(null);
    setDueAnchor(anchor);
  };

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
  const breadcrumbLabel = backTo === '/' ? t.nav.dashboard : backTo === '/calendar' ? t.nav.calendar : (bql && bqlLabels[bql]) || entityTerm.navAll;

  const priorityColor = (p: string) =>
    p === 'urgent' ? '#d32f2f' : p === 'high' ? '#e65100' : p === 'medium' ? '#1976d2' : '#9e9e9e';

  return (
    <Box className={`td-operational-page${theme.palette.mode === 'dark' ? ' td-operational-page--dark' : ''}`} sx={{ mx: { xs: -1, sm: -3, md: -4 }, px: { xs: 1, sm: 3, md: 4 }, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'var(--td-paper)', minHeight: '100%' }}>
    <Box className="td-ticket-detail-shell" maxWidth={900} sx={{ px: { xs: 1.5, sm: 3, md: 4 }, py: { xs: 2, sm: 2.75 }, ml: 'auto', mr: 'auto' }}>
      {/* ── Top bar: breadcrumb-style nav + action buttons ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1, pb: 1.5, mb: { xs: 1.5, sm: 2 }, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
        {/* Breadcrumb */}
        <Box display="flex" alignItems="center" gap={0.75} sx={{ flex: { xs: '1 1 100%', sm: 1 }, minWidth: 0, overflow: 'hidden', flexWrap: { xs: 'wrap', sm: 'nowrap' }, rowGap: 0.5 }}>
          <MuiLink
            underline="hover"
            onClick={() => setLocation(backTo)}
            sx={{ fontSize: 13, color: 'text.secondary', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            <ArrowBack sx={{ fontSize: 14 }} />
            {breadcrumbLabel}
          </MuiLink>
          <Box component="span" sx={{ color: 'text.disabled', fontSize: 14, flexShrink: 0 }}>/</Box>
          <Box component="span" sx={{ fontSize: 13, color: 'primary.main', fontWeight: 600, flexShrink: 0 }}>
            #{ticket.ticketNumber ?? ticket.id}
          </Box>
           <Box component="span" sx={{ color: 'text.disabled', fontSize: 13, flexShrink: 0 }}>·</Box>
           <Box
             component="span"
             data-testid="text-ticket-opened-at"
             sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, fontSize: { xs: 10, sm: 11 }, color: 'text.secondary', whiteSpace: { xs: 'normal', sm: 'nowrap' }, flexShrink: { xs: 1, sm: 0 }, minWidth: 0, lineHeight: 1.35 }}
           >
             <CalendarTodayIcon sx={{ fontSize: { xs: 12, sm: 13 }, color: 'text.disabled' }} />
             {t.ticketDetail.openedOn} {new Date(ticket.createdAt).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })}
           </Box>
        </Box>
        {/* Action buttons */}
        <Box display="flex" gap={0.75} alignItems="center" flexShrink={0} flexWrap="wrap" sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'initial' } }}>
          {(ticket as any).visibility === 'admins' && isAdmin && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              onClick={() => setVisibilityDialog(true)}
              startIcon={<LockOutlined sx={{ fontSize: 15 }} />}
              sx={{ px: '12px', py: '5px', borderRadius: '6px', fontSize: 12, textTransform: 'none', minWidth: 0 }}
            >
              {lang === 'it' ? 'Rendi visibile al team' : 'Make visible to team'}
            </Button>
          )}
          {canEdit && (
            isMobile ? (
              <Tooltip title={t.ticketDetail.editButton}>
                <IconButton size="small" onClick={openEditDialog} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '6px' }}>
                  <EditOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button size="small" onClick={openEditDialog} sx={{ px: '14px', py: '5px', borderRadius: '6px', border: '1px solid', borderColor: 'divider', background: 'none', fontSize: 12, color: 'text.secondary', fontWeight: 400, textTransform: 'none', minWidth: 0, boxShadow: 'none', '&:hover': { bgcolor: 'action.hover', boxShadow: 'none' } }}>
                {t.ticketDetail.editButton}
              </Button>
            )
          )}
          {isAdmin && (
            <Tooltip title={(ticket as any).recurrenceRule ? t.ticketDetail.recurrenceBadge : t.ticketDetail.recurrenceButton}>
              {isMobile ? (
                <IconButton size="small" onClick={openRecurrenceDialog} sx={{ border: '1px solid', borderColor: (ticket as any).recurrenceRule ? 'primary.main' : 'divider', borderRadius: '6px', bgcolor: (ticket as any).recurrenceRule ? 'primary.main' : 'transparent', color: (ticket as any).recurrenceRule ? 'white' : 'inherit' }}>
                  <RepeatIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : (
                <Button size="small" onClick={openRecurrenceDialog} variant={(ticket as any).recurrenceRule ? 'contained' : 'text'} color={(ticket as any).recurrenceRule ? 'primary' : 'inherit'} sx={{ px: '14px', py: '5px', borderRadius: '6px', fontSize: 12, textTransform: 'none', minWidth: 0, ...((!(ticket as any).recurrenceRule) && { border: '1px solid', borderColor: 'divider', color: 'text.secondary', fontWeight: 400, boxShadow: 'none', '&:hover': { bgcolor: 'action.hover', boxShadow: 'none' } }) }}>
                  {t.ticketDetail.recurrenceButton}
                </Button>
              )}
            </Tooltip>
          )}
          {isAdmin && (
            isMobile ? (
              <Tooltip title={lang === 'it' ? `Elimina ${entityTerm.singularLower}` : `Delete ${entityTerm.singularLower}`}>
                <IconButton size="small" onClick={() => setDeleteDialog(true)} sx={{ borderRadius: '6px', bgcolor: theme.palette.mode === 'dark' ? alpha('#b71c1c', 0.18) : '#fde8e8', color: '#b71c1c', '&:hover': { bgcolor: theme.palette.mode === 'dark' ? alpha('#b71c1c', 0.3) : '#fcc' } }}>
                  <DeleteOutline sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Button size="small" onClick={() => setDeleteDialog(true)} sx={{ px: '14px', py: '5px', borderRadius: '6px', border: 'none', bgcolor: theme.palette.mode === 'dark' ? alpha('#b71c1c', 0.18) : '#fde8e8', fontSize: 12, color: '#b71c1c', fontWeight: 600, textTransform: 'none', minWidth: 0, boxShadow: 'none', '&:hover': { bgcolor: theme.palette.mode === 'dark' ? alpha('#b71c1c', 0.3) : '#fbbdbd', boxShadow: 'none' } }}>
                {lang === 'it' ? 'Elimina' : 'Delete'}
              </Button>
            )
          )}
        </Box>
      </Box>

      {/* ── Two-column layout: left (main) + right (sidebar) ── */}
      <Box>

        {/* ── LEFT: main content ── */}
        <Box className="td-ticket-detail-content" sx={{ flex: 1, minWidth: 0 }}>

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
                  open: { bg: theme.palette.mode === 'dark' ? 'rgba(37,99,235,0.25)' : '#e3f0fd', fg: theme.palette.mode === 'dark' ? '#60a5fa' : '#1565c0' },
                  in_progress: { bg: theme.palette.mode === 'dark' ? 'rgba(230,81,0,0.25)' : '#fff3e0', fg: theme.palette.mode === 'dark' ? '#fb923c' : '#e65100' },
                  waiting: { bg: theme.palette.mode === 'dark' ? 'rgba(124,58,237,0.25)' : '#f3e5f5', fg: theme.palette.mode === 'dark' ? '#a78bfa' : '#6a1b9a' },
                  resolved: { bg: theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.25)' : '#e8f5e9', fg: theme.palette.mode === 'dark' ? '#6ee7b7' : '#1b5e20' },
                  closed: { bg: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f5f5f5', fg: theme.palette.mode === 'dark' ? '#9ca3af' : '#424242' },
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
                  <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
                  <Box component="span"
                    onClick={canEdit ? (e) => setCategoryAnchor(e.currentTarget) : undefined}
                    sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: 'text.secondary', ...(canEdit ? { cursor: 'pointer', '&:hover': { opacity: 0.7 } } : {}) }}>
                    {ticket.category}
                  </Box>
                </>
              )}
              {!singleLocation && ticket.location && (
                <>
                  <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
                  <Box component="span"
                    onClick={canEdit ? (e) => setLocationAnchor(e.currentTarget) : undefined}
                    sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: 'secondary.main', ...(canEdit ? { cursor: 'pointer', '&:hover': { opacity: 0.7 } } : {}) }}>
                    {ticket.location}
                  </Box>
                </>
              )}
              {(ticket as any).visibility === 'admins' && (
                <Chip
                  icon={<LockOutlined sx={{ fontSize: '14px !important' }} />}
                  label={lang === 'it' ? 'Solo admin' : 'Admins only'}
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 24, fontWeight: 700 }}
                />
              )}
            </Box>

            {/* Riga 2 desktop: nomi + scadenza/chip sulla stessa riga */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', alignItems: { sm: 'center' }, gap: { xs: 0.5, sm: 2 } }}>

              {/* Chi ha aperto → assegnatario */}
              {(creator?.name || assignee || assignedGroup) && (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ...(canChangeAssignment ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}
                  onClick={canChangeAssignment ? (e) => setAssignAnchor(e.currentTarget) : undefined}
                >
                  {creator?.name && (
                    <>
                      <Avatar src={creator.avatarUrl ?? undefined} sx={{ width: 16, height: 16, fontSize: 8, bgcolor: 'primary.main' }}>{creator.name.charAt(0)}</Avatar>
                      <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: 'text.secondary' }}>{creator.name}</Box>
                    </>
                  )}
                  {creator?.name && (assignee || assignedGroup) && (
                    <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, color: 'text.disabled', mx: 0.25 }}>→</Box>
                  )}
                  {(assignee || assignedGroup) && (
                    <>
                      {assignee && <Avatar src={assignee.avatarUrl ?? undefined} sx={{ width: 16, height: 16, fontSize: 8, bgcolor: 'secondary.main' }}>{assignee.name?.charAt(0)}</Avatar>}
                      <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 700, color: 'primary.main' }}>{assignedGroup ? assignedGroup : assignee?.name}</Box>
                    </>
                  )}
                </Box>
              )}

              {/* Scadenza + chip */}
              {((ticket as any).dueAt || canChangeDueAt || ticket.inboundChannelId || (ticket as any).recurrenceRule || (ticket as any).scheduledAt || (workedTimeEnabled && (ticket as any).workedMinutes != null)) && (
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  {((ticket as any).dueAt || canChangeDueAt) && (
                    (ticket as any).dueAt ? (
                    <Box component="span"
                      onClick={canChangeDueAt ? (e) => openDueAtEditor(e.currentTarget) : undefined}
                      sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 600, color: new Date((ticket as any).dueAt) < new Date() && ticket.status !== 'resolved' && !isClosedKey(ticket.status) ? '#d32f2f' : '#e65100', ...(canChangeDueAt ? { cursor: 'pointer', '&:hover': { opacity: 0.75 } } : {}) }}>
                      ⚠ {lang === 'it' ? 'Scade' : 'Due'} {new Date((ticket as any).dueAt).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Box>
                    ) : (
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<CalendarTodayIcon sx={{ fontSize: '14px !important' }} />}
                        onClick={(e) => openDueAtEditor(e.currentTarget)}
                        sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: { xs: 12, sm: 14 }, textTransform: 'none', color: 'text.secondary' }}
                      >
                        {t.ticketDetail.dueAtAdd}
                      </Button>
                    )
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
                  {workedTimeEnabled && (ticket as any).workedMinutes != null && (
                    <Box component="span" sx={{ fontSize: { xs: 12, sm: 14 }, fontWeight: 600, color: 'success.dark' }}>
                      ⏱ {t.ticketDetail.workedTime}: {formatWorkedDuration((ticket as any).workedMinutes, lang)}
                    </Box>
                  )}
                </Box>
              )}

            </Box>

          </Box>

          {/* H1 Title — E style */}
          <Box component="h1" sx={{ m: 0, mb: 1.5, fontSize: { xs: '1.25rem', sm: '1.45rem' }, fontWeight: 800, color: 'text.primary', lineHeight: 1.22, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
            {ticket.title}
          </Box>

          {clientsEnabled && (
            <Box sx={{ mb: 2, maxWidth: 420 }}>
              {isAdmin ? (
                <Autocomplete
                  size="small"
                  options={clientOptions}
                  value={
                    clientAssociationDraftId === null
                      ? selectedTicketClient
                      : clientOptions.find((client: any) => client.id === clientAssociationDraftId) ?? null
                  }
                  getOptionLabel={(client: any) =>
                    client.alias ? `${client.name} (${client.alias})` : client.name
                  }
                  isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
                  onChange={(_, client: any) => {
                    setClientAssociationError(null);
                    setClientAssociationSaved(false);
                    setClientAssociationDraftId(client?.id ?? null);
                  }}
                  disabled={clientAssociationBusy}
                  disableClearable
                  noOptionsText={t.newTicket.noClientFound}
                  renderInput={(params) => (
                    <TextField {...params} label={t.clients.clientField} />
                  )}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 32 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t.clients.clientField}:
                  </Typography>
                  <Chip
                    size="small"
                    variant={selectedTicketClient ? 'filled' : 'outlined'}
                    label={selectedTicketClient?.name ?? (lang === 'it' ? 'Non associato' : 'Not assigned')}
                  />
                </Box>
              )}
              {isAdmin && clientAssociationDraftId !== null && clientAssociationDraftId !== ticketClientId && (
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleClientAssociationChange(clientAssociationDraftId)}
                    disabled={clientAssociationBusy}
                  >
                    {clientAssociationBusy
                      ? t.ticketDetail.clientAssociationSaving
                      : t.ticketDetail.clientAssociationSave}
                  </Button>
                  <FormHelperText>{t.ticketDetail.clientAssociationSaveHint}</FormHelperText>
                </Box>
              )}
              {clientAssociationSaved && (
                <FormHelperText sx={{ color: 'success.main' }}>
                  {t.ticketDetail.clientAssociationSaved}
                </FormHelperText>
              )}
              {!clientAssociationSaved && ticket.inboundChannelId && selectedTicketClient && (
                <FormHelperText>{t.ticketDetail.clientEmailAssociationHint}</FormHelperText>
              )}
              {clientAssociationError && (
                <FormHelperText error>{clientAssociationError}</FormHelperText>
              )}
            </Box>
          )}

          {isAdmin && (ticket as any).suggestedClient && (
            <Alert
              severity="info"
              data-testid="client-suggestion-alert"
              sx={{ mb: 2, alignItems: 'center' }}
              action={
                <Box display="flex" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckCircleOutline />}
                    disabled={clientSuggestionBusy}
                    data-testid="button-confirm-client-suggestion"
                    onClick={() => void handleClientSuggestion('confirm')}
                  >
                    {t.ticketDetail.clientSuggestionConfirm}
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={clientSuggestionBusy}
                    data-testid="button-dismiss-client-suggestion"
                    onClick={() => void handleClientSuggestion('dismiss')}
                  >
                    {t.ticketDetail.clientSuggestionDismiss}
                  </Button>
                </Box>
              }
            >
              <Typography variant="body2" data-testid="text-client-suggestion">
                {t.ticketDetail.clientSuggestionIntro}{' '}
                <strong>{(ticket as any).suggestedClient.alias || (ticket as any).suggestedClient.name}</strong>
                {' — '}{t.ticketDetail.clientSuggestionDomainInfo}
              </Typography>
              {clientSuggestionError && (
                <Typography variant="caption" color="error" display="block" mt={0.5}>
                  {clientSuggestionError}
                </Typography>
              )}
            </Alert>
          )}

          {/* Description block — flat, no card border */}
          <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
            <Box sx={{ fontSize: 11, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: '6px' }}>
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

          {timeTrackingModuleEnabled &&
            Boolean((ticket as any).timeTrackingEnabled) &&
            ((ticket as any).canViewTimeTrackingSummary || isAdmin) && (
            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                {(ticket as any).timeTrackingEnabled && (ticket as any).canViewTimeTrackingSummary && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: 1.25,
                    mb: (ticket as any).timeSessions?.length > 0 ? 1.5 : 0,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t.ticketDetail.trackedTimeTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.25 }}>
                      {t.ticketDetail.trackedTimeTotal}:{' '}
                      <strong>{formatWorkedDuration((ticket as any).timeTrackingSummary?.totalMinutes ?? 0, lang)}</strong>
                    </Typography>
                  </Box>
                  {isAdmin && <Box display="flex" flexWrap="wrap" gap={0.75}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={(ticket as any).timeTrackingBillable ? 'success' : 'default'}
                      label={`${t.ticketDetail.trackedTimeCustomerBillable}: ${(ticket as any).timeTrackingBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={(ticket as any).timeTrackingCompensationOverride === true ? 'success' : 'default'}
                      label={`${t.ticketDetail.trackedTimeOverride}: ${(ticket as any).timeTrackingCompensationOverride == null
                        ? t.ticketDetail.trackedTimeInherit
                        : (ticket as any).timeTrackingCompensationOverride
                          ? t.ticketDetail.trackedTimeOn
                          : t.ticketDetail.trackedTimeOff}`}
                    />
                  </Box>}
                </Box>
                )}
                {(ticket as any).timeTrackingEnabled && (ticket as any).canViewTimeTrackingSummary && (ticket as any).timeSessions?.length > 0 && (
                  <Box display="flex" flexDirection="column" gap={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {t.ticketDetail.trackedTimeSessionBy}
                    </Typography>
                    {(ticket as any).timeSessions.map((session: any) => (
                      <Box key={session.id} display="flex" justifyContent="space-between" alignItems="center" gap={1} data-testid={`time-session-${session.id}`}>
                        <Typography variant="body2">{session.userName}</Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2" fontWeight={600}>
                            {formatWorkedDuration(session.durationMinutes, lang)}{session.endedAt ? '' : ` · ${t.ticketDetail.trackedTimeActive}`}
                          </Typography>
                          {isAdmin && (ticket as any).closedAt && session.endedAt && (
                            <IconButton size="small" aria-label={t.ticketDetail.editTrackedSession} onClick={() => openTimeSessionEditor(session)}>
                              <EditOutlined fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                {isAdmin && (ticket as any).timeTrackingEnabled && (
                  <Box mt={1.75} data-testid="time-session-edit-history">
                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={0.75}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {t.ticketDetail.trackedTimeEditHistory}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={timeSessionEditsDownloading ? <CircularProgress size={16} /> : <Download fontSize="small" />}
                        onClick={handleExportTimeSessionEdits}
                        disabled={timeSessionEditsLoading || timeSessionEditsDownloading || (!timeSessionEditsError && timeSessionEdits.length === 0)}
                      >
                        {timeSessionEditsDownloading ? t.ticketDetail.trackedTimeEditExporting : t.ticketDetail.trackedTimeEditExport}
                      </Button>
                    </Box>
                    {timeSessionEditsExportError && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        {t.ticketDetail.trackedTimeEditExportError}
                      </Alert>
                    )}
                    {timeSessionEditsLoading ? (
                      <CircularProgress size={18} aria-label={t.ticketDetail.trackedTimeEditHistory} />
                    ) : timeSessionEditsError ? (
                      <Typography variant="body2" color="error">
                        {t.ticketDetail.trackedTimeEditHistoryLoadError}
                      </Typography>
                    ) : timeSessionEdits.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t.ticketDetail.trackedTimeEditHistoryEmpty}
                      </Typography>
                    ) : (
                      <Box display="flex" flexDirection="column" gap={0.75}>
                        {timeSessionEdits.map((edit) => (
                          <Box
                            key={edit.id}
                            sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover' }}
                            data-testid={`time-session-edit-${edit.id}`}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {new Date(edit.editedAt).toLocaleString(dateLocale)} · {edit.editedByName} · {t.ticketDetail.trackedTimeEditAttribution} {edit.collaboratorName}
                            </Typography>
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                                gap: 0.5,
                                mt: 0.5,
                              }}
                            >
                              <Typography variant="body2">
                                {t.ticketDetail.trackedTimeEditDuration}: {formatWorkedDuration(edit.previousDurationMinutes, lang)} → {formatWorkedDuration(edit.updatedDurationMinutes, lang)}
                              </Typography>
                              <Typography variant="body2">
                                {t.ticketDetail.trackedTimeEditBillable}: {edit.previousClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff} → {edit.updatedClientBillable ? t.ticketDetail.trackedTimeCustomerBillableOn : t.ticketDetail.trackedTimeCustomerBillableOff}
                              </Typography>
                              <Typography variant="body2">
                                {t.ticketDetail.trackedTimeEditRecognizable}: {edit.previousCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff} → {edit.updatedCollaboratorRecognizable ? t.ticketDetail.trackedTimeOn : t.ticketDetail.trackedTimeOff}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
                {isAdmin && (
                  <Box
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} mb={1}>
                      {t.ticketDetail.trackedTimeClassificationTitle}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.5,
                        maxWidth: 760,
                      }}
                    >
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label={t.ticketDetail.trackedTimeCustomerBillable}
                        helperText={t.ticketDetail.trackedTimeCustomerBillableHelp}
                        data-testid="select-time-tracking-billable"
                        value={(ticket as any).timeTrackingBillable ? 'true' : 'false'}
                        onChange={async (event) => {
                          try {
                            await updateTicket.mutateAsync({ id: ticketId, data: { timeTrackingBillable: event.target.value === 'true' } });
                            queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
                          } catch {
                            setStatusError(t.ticketDetail.trackedTimeChangeError);
                          }
                        }}
                      >
                        <MenuItem value="true">{t.ticketDetail.trackedTimeCustomerBillableOn}</MenuItem>
                        <MenuItem value="false">{t.ticketDetail.trackedTimeCustomerBillableOff}</MenuItem>
                      </TextField>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label={t.ticketDetail.trackedTimeOverride}
                        helperText={t.ticketDetail.trackedTimeCollaboratorRecognizableHelp}
                        data-testid="select-time-tracking-recognition"
                        value={(ticket as any).timeTrackingCompensationOverride == null
                          ? (ticket as any).timeTrackingEnabled ? '' : 'false'
                          : String((ticket as any).timeTrackingCompensationOverride)}
                        onChange={async (event) => {
                          try {
                            const value = event.target.value === '' ? null : event.target.value === 'true';
                            await updateTicket.mutateAsync({ id: ticketId, data: { timeTrackingCompensationOverride: value } });
                            queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) });
                          } catch {
                            setStatusError(t.ticketDetail.trackedTimeChangeError);
                          }
                        }}
                      >
                          {(ticket as any).timeTrackingEnabled && (
                            <MenuItem value="">{t.ticketDetail.trackedTimeInherit}</MenuItem>
                          )}
                        <MenuItem value="true">{t.ticketDetail.trackedTimeOn}</MenuItem>
                        <MenuItem value="false">{t.ticketDetail.trackedTimeOff}</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Divider sx={{ mt: 1.5, mb: 1.5 }} />

          {/* Tabs — E style: minimal underline indicator */}
          <Box>
            <Box sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Tabs
                value={selectedTabValue}
                onChange={(_, v) => setTabValue(v)}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  px: 0,
                  minHeight: 0,
                  '& .MuiTabs-indicator': { bgcolor: 'text.primary', height: 2 },
                  '& .MuiTab-root': {
                    minHeight: 0,
                    px: 0,
                    mr: 3,
                    pb: 1.5,
                    pt: 0,
                    fontSize: 14,
                    fontWeight: 400,
                    color: 'text.disabled',
                    textTransform: 'none',
                    minWidth: 0,
                  },
                  '& .MuiTab-root.Mui-selected': { color: 'text.primary', fontWeight: 700 },
                }}
              >
                <Tab label={`${t.ticketDetail.tabComments} (${(comments?.length ?? 0) + ((ticket as any).resolutionNote ? 1 : 0)})`} />
                <Tab label={t.ticketDetail.tabActivity} />
                {canAccessNotes && <Tab label={`${t.ticketDetail.tabNotes} (${notes?.length ?? 0})`} />}
              </Tabs>
            </Box>

            {/* ── Tab: Comments ── */}
            <TabPanel value={selectedTabValue} index={0}>
              <Box display="flex" flexDirection="column" gap={0}>
                {comments?.length === 0 && !(ticket as any).resolutionNote && (
                  <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>
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
                          sx={{ py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', ...(customerReply ? { ml: { xs: 3, sm: 5 } } : {}) }}
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
                                  <Box component="span" sx={{ fontWeight: 700, fontSize: 14, color: 'text.primary' }}>{customerReply.name}</Box>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    <MailOutline sx={{ fontSize: 12, color: 'text.secondary' }} />
                                    <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>Risposta del cliente</Box>
                                    <Box component="a" href={`mailto:${customerReply.email}`} sx={{ fontSize: 12, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{customerReply.email}</Box>
                                  </Box>
                                </>
                              ) : (
                                <UserLink
                                  userId={c.authorId}
                                  name={c.author?.name}
                                  typographyProps={{ sx: { fontWeight: 700, fontSize: 14, color: 'text.primary' } } as any}
                                />
                              )}
                              <Box component="span" sx={{ fontSize: 13, color: 'text.disabled' }}>
                                {new Date(c.createdAt).toLocaleString(dateLocale)}
                              </Box>
                              {c.updatedAt && c.updatedAt !== c.createdAt && (
                                <Box component="span" sx={{ fontSize: 13, color: 'text.disabled', fontStyle: 'italic' }}>({t.ticketDetail.commentEdited})</Box>
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
                                  <Box component="span" onClick={() => handleReply(c.id, c.author?.name)} sx={{ fontSize: 12, color: replyingToCommentId === c.id ? 'primary.main' : 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }}>
                                    {t.ticketDetail.replyComment}
                                  </Box>
                                  {(() => {
                                    const alreadyLiked = (commentReactions[c.id] ?? []).some((r) => r.emoji === '👍' && r.userReacted);
                                    return (
                                      <Box component="span" onClick={() => handleToggleReaction(c.id, '👍')} sx={{ cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, color: alreadyLiked ? 'primary.main' : 'text.secondary', fontWeight: alreadyLiked ? 700 : 400, opacity: hoveredCommentId === c.id || alreadyLiked ? 1 : 0, transition: 'opacity 0.15s, color 0.15s', '@media (pointer: coarse)': { opacity: 1 }, '&:hover': { color: 'primary.main' } }}>
                                        👍
                                      </Box>
                                    );
                                  })()}
                                  {(canEditComment || canDeleteComment) && (
                                    <IconButton size="small" onClick={(e) => setCommentMenuAnchor({ el: e.currentTarget, commentId: c.id })} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
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
                  <Box display="flex" gap={1.5} alignItems="flex-start" sx={{ pt: 2.5, mt: 1, borderTop: '1px solid', borderTopColor: 'divider' }}>
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
            <TabPanel value={selectedTabValue} index={1}>
              <Box sx={{ pt: 0.5, pb: 0.5 }}>
                {activities?.length === 0 && (
                  <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>{t.ticketDetail.noActivity}</Box>
                )}
                {[...(activities ?? [])].reverse().map((a) => {
                  const isHighlight = a.actionType === 'priority_changed' || (a.actionType === 'status_changed' && (a.actionDescription?.includes('Urgente') || a.actionDescription?.includes('Urgent')));
                  const actorName = (a as any).user?.name as string | undefined;
                  return (
                    <Box key={a.id} display="flex" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, ml: '14px', bgcolor: isHighlight ? '#e65100' : 'action.disabled' }} />
                      <Box component="span" sx={{ flex: 1, fontSize: 13, color: isHighlight ? '#e65100' : 'text.secondary' }}>
                        {actorName && (
                          <Box component="span" sx={{ fontWeight: 700, color: isHighlight ? '#e65100' : 'text.secondary', mr: 0.5 }}>{actorName}</Box>
                        )}
                        {a.actionDescription}
                      </Box>
                      <Box component="span" sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }}>{new Date(a.createdAt).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })}</Box>
                    </Box>
                  );
                })}
              </Box>
            </TabPanel>

            {/* ── Tab: Notes ── */}
            {canAccessNotes && (
              <TabPanel value={selectedTabValue} index={2}>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" alignItems="center" justifyContent="flex-end">
                    <PermissionGateButton permission="add_notes" sectionLabel={t.ticketDetail.tabNotes} />
                  </Box>
                  {notes?.length === 0 && <Box component="p" sx={{ m: 0, py: 3, textAlign: 'center', fontSize: 14, color: 'text.secondary' }}>{t.ticketDetail.noNotes}</Box>}
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
        <Box sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.categoryLabel}</Box>
        <Box display="flex" flexDirection="column" gap={0.5}>
          {editCategories.map((c) => (
            <Box key={c} onClick={async () => { await updateTicket.mutateAsync({ id: ticketId, data: { category: c } as any }); queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }); setCategoryAnchor(null); }}
              sx={{ px: 1, py: 0.75, borderRadius: 1, fontSize: 13, cursor: 'pointer', bgcolor: ticket.category === c ? 'primary.50' : 'transparent', color: ticket.category === c ? 'primary.main' : 'text.primary', fontWeight: ticket.category === c ? 700 : 400, '&:hover': { bgcolor: 'action.hover' } }}>
              {c}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* ── Popover: cambia sede dalla metabar ── */}
      <Popover open={Boolean(locationAnchor)} anchorEl={locationAnchor} onClose={() => setLocationAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.locationLabel}</Box>
        <Box display="flex" flexDirection="column" gap={0.5}>
          {editLocations.map((l) => (
            <Box key={l} onClick={async () => { await updateTicket.mutateAsync({ id: ticketId, data: { location: l } as any }); queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }); setLocationAnchor(null); }}
              sx={{ px: 1, py: 0.75, borderRadius: 1, fontSize: 13, cursor: 'pointer', bgcolor: ticket.location === l ? 'primary.50' : 'transparent', color: ticket.location === l ? 'primary.main' : 'text.primary', fontWeight: ticket.location === l ? 700 : 400, '&:hover': { bgcolor: 'action.hover' } }}>
              {l}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* ── Popover: modifica scadenza dalla metabar ── */}
      <Popover open={Boolean(dueAnchor)} anchorEl={dueAnchor} onClose={() => setDueAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.dueAtLabel}</Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <TextField type="datetime-local" size="small" value={dueEditVal} onChange={(e) => setDueEditVal(e.target.value)} inputProps={{ 'aria-label': t.ticketDetail.dueAtLabel, style: { fontSize: 12 } }} sx={{ minWidth: 190 }} disabled={updateTicket.isPending} />
          {dueEditVal && (
            <Tooltip title={t.ticketDetail.dueAtClear}>
              <span>
                <IconButton size="small" disabled={updateTicket.isPending} onClick={() => { void handleDueAtChange(''); }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
        <Box display="flex" justifyContent="flex-end" mt={1}>
          <Button size="small" variant="contained" disabled={updateTicket.isPending} onClick={() => { void handleDueAtChange(dueEditVal); }}>
            {t.ticketDetail.dueAtSave}
          </Button>
        </Box>
      </Popover>

      {/* ── Popover: cambia stato dalla metabar ── */}
      <Popover open={Boolean(statusAnchor)} anchorEl={statusAnchor} onClose={() => setStatusAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 180 } } }}>
        <Box sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.statusLabel}</Box>
        <Box display="flex" flexWrap="wrap" gap={0.5}>
          {visibleTicketStatuses.map((s) => {
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
        <Box sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>{t.ticketDetail.priorityLabel}</Box>
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

      {/* ── Popover: cambia assegnatario dalla metabar ── */}
      <Popover
        open={Boolean(assignAnchor)}
        anchorEl={assignAnchor}
        onClose={() => setAssignAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { elevation: 3, sx: { p: 1.5, minWidth: 200, maxWidth: 280 } } }}
      >
        {isAdmin ? (
          <>
            {/* Mode toggle: user vs group (admin only) */}
            <Box display="flex" gap={0.5} mb={1}>
              {(['user', 'group'] as const).map((mode) => (
                <Box
                  key={mode}
                  component="button"
                  onClick={() => setAssignMode(mode)}
                  sx={{
                    flex: 1, py: 0.5, border: '1px solid', borderRadius: 1, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    borderColor: assignMode === mode ? 'primary.main' : 'divider',
                    bgcolor: assignMode === mode ? 'primary.main' : 'transparent',
                    color: assignMode === mode ? 'white' : 'text.secondary',
                  }}
                >
                  {mode === 'user' ? (lang === 'it' ? 'Persona' : 'Person') : (lang === 'it' ? 'Gruppo' : 'Group')}
                </Box>
              ))}
            </Box>

            {assignMode === 'user' ? (
              <Box display="flex" flexDirection="column" gap={0.25}>
                <Box
                  onClick={() => handleAssigneeChange('')}
                  sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', fontSize: 13, color: 'text.secondary', fontStyle: 'italic', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  {lang === 'it' ? 'Nessun assegnatario' : 'No assignee'}
                </Box>
                {(users ?? []).map((u: any) => {
                  const load = (workload as any[]).find((w) => w.id === u.id)?.open ?? 0;
                  const isCurrent = (ticket as any).assignedTo === u.id;
                  return (
                    <Box
                      key={u.id}
                      onClick={() => handleAssigneeChange(String(u.id))}
                      sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, bgcolor: isCurrent ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Avatar src={u.avatarUrl ?? undefined} sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'secondary.main' }}>{u.name?.charAt(0)}</Avatar>
                      <Box component="span" sx={{ fontSize: 13, flex: 1, fontWeight: isCurrent ? 700 : 400 }}>{u.name}</Box>
                      {load > 0 && <Box component="span" sx={{ fontSize: 11, color: load >= 10 ? 'error.main' : 'text.disabled', fontWeight: 600 }}>{load}</Box>}
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Box display="flex" flexDirection="column" gap={0.25}>
                <Box
                  onClick={() => handleGroupChange('')}
                  sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', fontSize: 13, color: 'text.secondary', fontStyle: 'italic', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  {lang === 'it' ? 'Nessun gruppo' : 'No group'}
                </Box>
                {groups.map((g) => {
                  const isCurrent = (ticket as any).assignedToGroup === g;
                  return (
                    <Box
                      key={g}
                      onClick={() => handleGroupChange(g)}
                      sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', fontSize: 13, bgcolor: isCurrent ? 'action.selected' : 'transparent', fontWeight: isCurrent ? 700 : 400, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      {g}
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        ) : (
          /* Non-admin: solo "Assegna a me" / "Rimuovi assegnazione" */
          <Box display="flex" flexDirection="column" gap={0.25}>
            {(ticket as any).assignedTo !== (currentUser as any)?.id && (
              <Box
                onClick={() => handleAssigneeChange(String((currentUser as any)?.id))}
                sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Avatar src={(currentUser as any)?.avatarUrl ?? undefined} sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'primary.main' }}>
                  {currentUser?.name?.charAt(0)}
                </Avatar>
                <Box component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
                  {lang === 'it' ? 'Assegna a me' : 'Assign to me'}
                </Box>
              </Box>
            )}
            {(ticket as any).assignedTo && (
              <Box
                onClick={() => handleAssigneeChange('')}
                sx={{ px: 1, py: 0.75, borderRadius: 1, cursor: 'pointer', fontSize: 13, color: 'text.secondary', fontStyle: 'italic', '&:hover': { bgcolor: 'action.hover' } }}
              >
                {lang === 'it' ? 'Rimuovi assegnazione' : 'Remove assignee'}
              </Box>
            )}
          </Box>
        )}
      </Popover>

      {/* ── Dialogs ── */}

      {/* Resolution note dialog */}
      <Dialog open={resolutionDialog} onClose={() => setResolutionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t.ticketDetail.resolutionNoteTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>{t.ticketDetail.resolutionNoteSubtitle}</Typography>
          <TextField fullWidth multiline rows={4} placeholder={t.ticketDetail.resolutionNotePlaceholder} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} autoFocus />
          {workedTimeEnabled && (
            <>
              <Typography variant="body2" color="text.secondary" mt={2} mb={1}>{t.ticketDetail.workedTimeOptional}</Typography>
              <Box display="flex" gap={1.5}>
                <TextField
                  label={t.ticketDetail.workedHours}
                  type="number"
                  size="small"
                  value={workedHours}
                  onChange={(e) => { setWorkedHours(e.target.value); setWorkedTimeError(null); }}
                  disabled={updateTicket.isPending}
                  inputProps={{ min: 0, step: 1 }}
                  error={workedTimeError === 'hours'}
                  fullWidth
                />
                <TextField
                  label={t.ticketDetail.workedMinutes}
                  type="number"
                  size="small"
                  value={workedMinutes}
                  onChange={(e) => { setWorkedMinutes(e.target.value); setWorkedTimeError(null); }}
                  disabled={updateTicket.isPending}
                  inputProps={{ min: 0, max: 59, step: 1 }}
                  error={workedTimeError === 'minutes'}
                  fullWidth
                />
              </Box>
              {workedTimeError && <FormHelperText error>{workedTimeError === 'hours' ? t.ticketDetail.workedHoursError : t.ticketDetail.workedMinutesError}</FormHelperText>}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => confirmResolved('')} disabled={updateTicket.isPending} color="inherit">{t.ticketDetail.resolutionNoteSkip}</Button>
          <Button variant="contained" color="success" onClick={() => confirmResolved(resolutionNote)} disabled={updateTicket.isPending} startIcon={<CheckCircleOutline />}>
            {updateTicket.isPending ? '...' : t.ticketDetail.resolutionNoteConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={closureSummaryOpen}
        onClose={() => setClosureSummaryOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t.ticketDetail.closureSummaryTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t.ticketDetail.closureSummarySubtitle}
          </Typography>
          <Box display="flex" flexDirection="column" gap={1.25}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {t.ticketDetail.trackedTimeTotal}
              </Typography>
              <Typography variant="body2">
                {formatWorkedDuration(closureSummary?.timeTrackingSummary?.totalMinutes ?? 0, lang)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {t.ticketDetail.trackedTimeSessionBy}
              </Typography>
              {(closureSummary?.timeSessions?.length ?? 0) > 0 ? (
                Object.entries(
                  (closureSummary.timeSessions as any[]).reduce((byCollaborator: Record<string, number>, session) => {
                    byCollaborator[session.userName] = (byCollaborator[session.userName] ?? 0) + session.durationMinutes;
                    return byCollaborator;
                  }, {}),
                ).map(([name, minutes]) => (
                  <Box key={name} display="flex" justifyContent="space-between" gap={1}>
                    <Typography variant="body2">{name}</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatWorkedDuration(minutes as number, lang)}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">{t.ticketDetail.closureSummaryNoSessions}</Typography>
              )}
            </Box>
            {(closureSummary?.manualWorkedMinutes ?? null) != null && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>{t.ticketDetail.workedTime}</Typography>
                <Typography variant="body2">
                  {formatWorkedDuration(closureSummary.manualWorkedMinutes, lang)}
                </Typography>
              </Box>
            )}
            {isAdmin && (
              <>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{t.ticketDetail.trackedTimeCustomerBillable}</Typography>
                  <Typography variant="body2">
                    {formatWorkedDuration(closureSummary?.timeTrackingSummary?.clientBillableMinutes ?? 0, lang)}
                    {' · '}
                    {closureSummary?.timeTrackingBillable
                      ? t.ticketDetail.trackedTimeCustomerBillableOn
                      : t.ticketDetail.trackedTimeCustomerBillableOff}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{t.ticketDetail.trackedTimeCollaboratorRecognizable}</Typography>
                  <Typography variant="body2">
                    {formatWorkedDuration(closureSummary?.timeTrackingSummary?.collaboratorRecognizableMinutes ?? 0, lang)}
                  </Typography>
                </Box>
              </>
            )}
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{t.ticketDetail.resolutionNoteLabel}</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {closureSummary?.closureSummaryNote || t.ticketDetail.closureSummaryNoNote}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={() => setClosureSummaryOpen(false)}>
            {t.ticketDetail.closureSummaryClose}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingTimeSession} onClose={() => setEditingTimeSession(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.ticketDetail.editTrackedSession}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {editingTimeSession?.userName}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="number"
            label={t.ticketDetail.trackedSessionDuration}
            value={editedSessionMinutes}
            onChange={(event) => setEditedSessionMinutes(event.target.value)}
            inputProps={{ min: 0, step: 1 }}
            sx={{ mb: 1 }}
          />
          <FormControlLabel control={<Checkbox checked={editedSessionBillable} onChange={(event) => setEditedSessionBillable(event.target.checked)} />} label={t.ticketDetail.trackedTimeCustomerBillable} />
          <FormControlLabel control={<Checkbox checked={editedSessionRecognizable} onChange={(event) => setEditedSessionRecognizable(event.target.checked)} />} label={t.ticketDetail.trackedTimeCollaboratorRecognizable} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTimeSession(null)}>{t.ticketDetail.closureSummaryClose}</Button>
          <Button
            variant="contained"
            onClick={() => void saveTimeSessionEdit()}
            disabled={!Number.isInteger(Number(editedSessionMinutes)) || Number(editedSessionMinutes) < 0}
          >
            {t.ticketDetail.editTrackedSessionSave}
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

      {/* Ticket update error */}
      <Snackbar open={ticketUpdateError != null} autoHideDuration={5000} onClose={() => setTicketUpdateError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setTicketUpdateError(null)} sx={{ width: '100%' }}>{ticketUpdateError}</Alert>
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
           <DeleteOutline /> {lang === 'it' ? `Sposta ${entityTerm.singularLower} nel cestino` : `Move ${entityTerm.singularLower} to trash`}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {lang === 'it'
               ? <>Vuoi spostare nel cestino {entityTerm.articleIndef} {entityTerm.singularLower} <strong>#{ticket?.ticketNumber ?? ticket?.id} — {ticket?.title}</strong>?</>
               : <>Are you sure you want to move {entityTerm.articleIndef} {entityTerm.singularLower} <strong>#{ticket?.ticketNumber ?? ticket?.id}</strong> to the trash?</>}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
             Il ticket e tutti i suoi commenti, allegati e storico attività resteranno recuperabili nel cestino per 30 giorni. Dopo questo periodo verranno eliminati definitivamente.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteDialog(false)} color="inherit" disabled={deleteTicket.isPending}>Annulla</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={deleteTicket.isPending} startIcon={<DeleteOutline />}>
             {deleteTicket.isPending ? t.ticketDetail.deleting : lang === 'it' ? 'Sposta nel cestino' : 'Move to trash'}
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
            {recurrenceFreq === 'weekly' && (
              <TextField
                select
                fullWidth
                size="small"
                label={t.ticketDetail.recurrenceDayOfWeek}
                value={recurrenceDayOfWeek}
                onChange={(e) => setRecurrenceDayOfWeek(parseInt(e.target.value, 10))}
              >
                {[
                  { value: 1, label: t.ticketDetail.recurrenceDayMonday },
                  { value: 2, label: t.ticketDetail.recurrenceDayTuesday },
                  { value: 3, label: t.ticketDetail.recurrenceDayWednesday },
                  { value: 4, label: t.ticketDetail.recurrenceDayThursday },
                  { value: 5, label: t.ticketDetail.recurrenceDayFriday },
                  { value: 6, label: t.ticketDetail.recurrenceDaySaturday },
                  { value: 0, label: t.ticketDetail.recurrenceDaySunday },
                ].map((day) => (
                  <MenuItem key={day.value} value={day.value}>{day.label}</MenuItem>
                ))}
              </TextField>
            )}
            {recurrenceFreq === 'monthly' && (
              <TextField
                select
                fullWidth
                size="small"
                label={t.ticketDetail.recurrenceDayOfMonth}
                value={recurrenceDayOfMonth}
                onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value, 10))}
                helperText={t.ticketDetail.recurrenceDayOfMonthHint}
                sx={{ '& .MuiFormHelperText-root': { fontSize: 11 } }}
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <MenuItem key={day} value={day}>{day}</MenuItem>
                ))}
              </TextField>
            )}
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

      <Dialog open={visibilityDialog} onClose={() => !visibilitySaving && setVisibilityDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockOutlined color="warning" />
          {lang === 'it' ? 'Rendi il ticket visibile al team?' : 'Make this ticket visible to the team?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {lang === 'it'
              ? 'Il ticket e i suoi commenti, allegati, note e attività saranno accessibili agli utenti autorizzati dell’organizzazione.'
              : 'The ticket and its comments, attachments, notes, and activity will become accessible to authorized organization users.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setVisibilityDialog(false)} disabled={visibilitySaving}>
            {lang === 'it' ? 'Annulla' : 'Cancel'}
          </Button>
          <Button variant="contained" color="warning" onClick={publishTicket} disabled={visibilitySaving}>
            {visibilitySaving ? <CircularProgress size={18} color="inherit" /> : (lang === 'it' ? 'Rendi visibile' : 'Make visible')}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
    </Box>
  );
}
