import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, MenuItem, Checkbox,
  ToggleButton, ToggleButtonGroup, Autocomplete, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Tooltip, IconButton,
  Alert, Chip, Paper, Avatar, FormControlLabel, Switch,
} from '@mui/material';
import { Person, Group, AddCircle as AddCircleIcon, PlaylistAddCheck, AutoAwesome, LockOutlined, PublicOutlined, Repeat as RepeatIcon, FolderOutlined } from '@mui/icons-material';
import { useCreateTicket, useUpdateTicket, useGetTicket, useListUsers, useSaveTicketAttachment, useListClients, getGetTicketQueryKey, getListTicketsQueryKey, getListClientsQueryKey } from '@workspace/api-client-react';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { RichCommentEditor, type PendingAttachment } from '../components/RichCommentEditor';
import NewTicketChecklistSection, { type ChecklistDraft } from '../components/NewTicketChecklistSection';
import DriveBrowser, { type SelectedDriveFolder } from '../components/DriveBrowser';
import { trackEvent } from '../lib/analytics';
import { buildNewTicketAssociations } from '../lib/newTicketAssociations';

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ChecklistTemplate {
  id: number;
  title: string;
  category: string | null;
  items: { id: number; text: string; position: number }[];
}

const STOP_WORDS = new Set([
  'il','lo','la','i','gli','le','un','una','di','da','in','con','su','per','tra','fra','a','e','è',
  'del','della','delle','degli','dei','allo','alla','al','ai','agli','alle','un','uno','una',
  'the','an','is','are','of','for','to','on','at','by','with','and','or',
]);

function scoreTemplate(tpl: ChecklistTemplate, words: string[]): number {
  const haystack = `${tpl.title} ${tpl.category ?? ''}`.toLowerCase();
  return words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
}

const PRIORITY_DOTS: Record<string, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
  urgent: '#b71c1c',
};

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" fontWeight={700} color="text.disabled"
      sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', mb: 0.25 }}>
      {children}
    </Typography>
  );
}

function SideSection({ children, divider = true }: { children: React.ReactNode; divider?: boolean }) {
  return (
    <Box pb={0.6} mb={0.6} sx={divider ? { borderBottom: '1px solid', borderColor: 'divider' } : {}}>
      {children}
    </Box>
  );
}

export default function NewTicket() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const editTicketId = Number(urlParams.get('edit'));
  const isEditing = Number.isInteger(editTicketId) && editTicketId > 0;
  const { t, lang } = useLanguage();
  const entityTerm = useEntityTerm();
  const queryClient = useQueryClient();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const saveAttachment = useSaveTicketAttachment();
  const { data: existingTicket, isLoading: isLoadingEditTicket, isError: editTicketLoadError } = useGetTicket(
    isEditing ? editTicketId : 0,
    { query: { enabled: isEditing } as any },
  );
  const { data: users } = useListUsers();
  const { user: currentUser } = useAuth();
  const { data: organizationSettings } = useQuery<{ timeTrackingModuleEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load organization settings');
      return response.json();
    },
  });

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [driveFolders, setDriveFolders] = useState<SelectedDriveFolder[]>([]);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft | null>(null);
  const [checklistError, setChecklistError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checklistForceExpand, setChecklistForceExpand] = useState(false);

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [debouncedTitle, setDebouncedTitle] = useState('');

  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [debouncedDescription, setDebouncedDescription] = useState('');

  const [titleHistory, setTitleHistory] = useState<{ id: number; ticketNumber?: number; title: string; status: string }[]>([]);
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false);
  const titleFieldRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');
  const [userSearch, setUserSearch] = useState('');
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [timeBillableToClient, setTimeBillableToClient] = useState(false);
  const [timeRecognizableToCollaborator, setTimeRecognizableToCollaborator] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(new Date().getDay());
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(new Date().getDate());
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const { data: clientsList = [] } = useListClients();
  const hydratedTicketId = useRef<number | null>(null);

  const { data: workload = [] } = useQuery<{ id: number; name: string; open: number; total: number }[]>({
    queryKey: ['assignee-workload'],
    queryFn: () => fetch('/api/stats/assignee-workload', { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
    enabled: currentUser?.role === 'admin',
  });
  const openByUser = Object.fromEntries(workload.map(w => [w.id, w.open]));

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddEmail, setQuickAddEmail] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const addDriveFolder = (folder: SelectedDriveFolder) => {
    setDriveFolders((previous) =>
      previous.some((item) => item.driveFolderId === folder.driveFolderId)
        ? previous
        : [...previous, folder],
    );
  };

  const handleQuickAddClient = async () => {
    if (!quickAddName.trim()) return;
    setQuickAddSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickAddName.trim(),
          email: quickAddEmail.trim() || null,
          phone: quickAddPhone.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const newClient = await res.json();
      queryClient.setQueryData(getListClientsQueryKey(), (old: any) =>
        Array.isArray(old) ? [...old, newClient] : [newClient]
      );
      setFormData(f => ({ ...f, clientId: String(newClient.id) }));
      setQuickAddOpen(false);
       trackEvent('client_created', { source: 'quick_add' });
    } catch {
      // silent
    } finally {
      setQuickAddSaving(false);
    }
  };

  const [formData, setFormData] = useState({
    title: urlParams.get('title') || '',
    description: urlParams.get('description') || '',
    category: urlParams.get('category') || '',
    location: urlParams.get('location') || currentUser?.mainLocation || '',
    resource: urlParams.get('resource') || '',
    priority: 'medium',
    assignedTo: '',
    assignedToGroup: '',
    dueAt: '',
    clientId: '',
    visibility: 'organization' as 'organization' | 'admins',
  });

  useEffect(() => {
    if (!isEditing || !existingTicket || hydratedTicketId.current === existingTicket.id) return;
    hydratedTicketId.current = existingTicket.id;
    setFormData({
      title: existingTicket.title ?? '',
      description: existingTicket.description ?? '',
      category: existingTicket.category ?? '',
      location: existingTicket.location ?? '',
      resource: (existingTicket as any).resource ?? '',
      priority: existingTicket.priority ?? 'medium',
      assignedTo: existingTicket.assignedTo == null ? '' : String(existingTicket.assignedTo),
      assignedToGroup: (existingTicket as any).assignedToGroup ?? '',
      dueAt: (existingTicket as any).dueAt ? toLocalDatetimeInput(new Date((existingTicket as any).dueAt)) : '',
      clientId: (existingTicket as any).clientId == null ? '' : String((existingTicket as any).clientId),
      visibility: (existingTicket as any).visibility === 'admins' ? 'admins' : 'organization',
    });
    setAssignMode((existingTicket as any).assignedToGroup ? 'group' : 'user');
    setTimeBillableToClient(Boolean((existingTicket as any).timeTrackingBillable));
    setTimeRecognizableToCollaborator((existingTicket as any).timeTrackingCompensationOverride === true);
  }, [isEditing, existingTicket]);

  useEffect(() => {
    let defaultCat: string | null = null;
    Promise.all([
      fetch('/api/settings/categories', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/settings/default-category', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([catsData, defData]) => {
        const cats: string[] = catsData.value ?? [];
        defaultCat = defData.value ?? null;
        setCategories(cats);
        if (!isEditing && !formData.category && cats.length > 0) {
          const preselect = (defaultCat && cats.includes(defaultCat)) ? defaultCat : cats[0];
          setFormData((f) => ({ ...f, category: preselect }));
        }
      })
      .catch(() => {});
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const locs = d.value ?? [];
        setLocations(locs);
        if (!isEditing && locs.length === 1) {
          setFormData((f) => ({ ...f, location: locs[0] }));
        }
      })
      .catch(() => {});
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups(d.value ?? []))
      .catch(() => {});
    fetch('/api/checklist-templates', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: ChecklistTemplate[]) => setTemplates(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedTitle(formData.title), 450);
    return () => clearTimeout(timeout);
  }, [formData.title]);

  useEffect(() => {
    if (isEditing) return;
    const q = formData.title.trim();
    if (q.length < 3) { setTitleHistory([]); setTitleDropdownOpen(false); return; }
    let cancelled = false;
    const timeout = setTimeout(() => {
      fetch(`/api/tickets?search=${encodeURIComponent(q)}&limit=6`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const tickets = (data.tickets ?? data ?? [])
            .filter((tk: any) => tk.title.toLowerCase() !== q.toLowerCase())
            .slice(0, 5)
            .map((tk: any) => ({ id: tk.id, ticketNumber: tk.ticketNumber, title: tk.title, status: tk.status }));
          setTitleHistory(tickets);
          setTitleDropdownOpen(tickets.length > 0);
        })
        .catch(() => {});
    }, 350);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [formData.title, isEditing]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedDescription(formData.description), 1200);
    return () => clearTimeout(timeout);
  }, [formData.description]);

  useEffect(() => {
    if (formData.title.trim()) return;
    const plain = debouncedDescription.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length < 25) { setSuggestedTitle(null); return; }
    let cancelled = false;
    setSuggestingTitle(true);
    fetch('/api/ai/suggest-title', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: debouncedDescription, category: formData.category }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.title) setSuggestedTitle(data.title); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSuggestingTitle(false); });
    return () => { cancelled = true; setSuggestingTitle(false); };
  }, [debouncedDescription]);

  const suggestedTemplates = useMemo(() => {
    const raw = debouncedTitle.trim().toLowerCase();
    if (raw.length < 3 || checklistDraft !== null) return [];
    const words = raw.split(/[\s\-_/\\]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    if (words.length === 0) return [];
    return templates
      .map(tpl => ({ tpl, score: scoreTemplate(tpl, words) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.tpl);
  }, [debouncedTitle, templates, checklistDraft]);

  function applyTemplateSuggestion(tpl: ChecklistTemplate) {
    const sortedItems = [...tpl.items].sort((a, b) => a.position - b.position);
    setChecklistDraft({
      mode: 'template',
      templateId: tpl.id,
      templateTitle: tpl.title,
      title: tpl.title,
      items: sortedItems.map(i => i.text),
    });
    setChecklistForceExpand(true);
    setTimeout(() => setChecklistForceExpand(false), 100);
  }

  const singleLocation = locations.length === 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistError(false);
    setSubmitError(null);
    const validateTaskTrackSelection =
      !isEditing || (!(existingTicket as any)?.timeTrackingEnabled && currentUser?.role === 'admin');
    if (validateTaskTrackSelection && timeBillableToClient && !formData.clientId) {
      setSubmitError(t.newTicket.clientRequiredForBillableTime);
      return;
    }
    if (validateTaskTrackSelection && timeRecognizableToCollaborator && (assignMode !== 'user' || !formData.assignedTo)) {
      setSubmitError(t.ticketDetail.trackedTimeAssigneeRequired);
      return;
    }
    try {
      const selectedClient = clientsList.find(c => c.id.toString() === formData.clientId);
      const oldClientId = (existingTicket as any)?.clientId ?? null;
      let finalTitle = formData.title;
      if (selectedClient) {
        const newPrefix = `${(selectedClient as any).alias || selectedClient.name}: `;
        if (!isEditing || !oldClientId) {
          finalTitle = `${newPrefix}${formData.title}`;
        } else if (oldClientId !== Number(formData.clientId)) {
          const oldClient = clientsList.find(c => c.id === oldClientId);
          const oldPrefix = oldClient ? `${(oldClient as any).alias || oldClient.name}: ` : '';
          finalTitle = formData.title.startsWith(oldPrefix)
            ? `${newPrefix}${formData.title.slice(oldPrefix.length)}`
            : `${newPrefix}${formData.title}`;
        }
      }

      let ticketId: number;
      if (isEditing) {
        if (!existingTicket) throw new Error(t.newTicket.createError);
        const updateData: Record<string, unknown> = {
          title: finalTitle,
          description: formData.description,
          category: formData.category,
          location: formData.location,
          resource: formData.resource.trim() || null,
          priority: formData.priority,
        };
        if (currentUser?.role === 'admin' || Number((existingTicket as any).assignedTo) === Number((currentUser as any)?.id)) {
          updateData.dueAt = formData.dueAt ? new Date(formData.dueAt).toISOString() : null;
        }
        if (clientsEnabled) updateData.clientId = formData.clientId ? Number(formData.clientId) : null;

        const oldAssignedTo = (existingTicket as any).assignedTo ?? null;
        const oldAssignedToGroup = (existingTicket as any).assignedToGroup ?? null;
        const newAssignedTo = assignMode === 'user' && formData.assignedTo ? Number(formData.assignedTo) : null;
        const newAssignedToGroup = assignMode === 'group' ? formData.assignedToGroup || null : null;
        const assignmentChanged =
          oldAssignedTo !== newAssignedTo || oldAssignedToGroup !== newAssignedToGroup;
        if (assignmentChanged && currentUser?.role === 'admin') {
          updateData.assignedTo = newAssignedTo;
          updateData.assignedToGroup = newAssignedToGroup;
        } else if (assignmentChanged && currentUser?.role !== 'admin') {
          updateData.assignedTo = newAssignedTo;
        }

        const enableTaskTrack = currentUser?.role === 'admin' &&
          taskTrackModuleEnabled &&
          !(existingTicket as any).timeTrackingEnabled &&
          (timeBillableToClient || timeRecognizableToCollaborator);
        if (enableTaskTrack) {
          updateData.timeTrackingBillable = timeBillableToClient;
          updateData.timeTrackingCompensationOverride = timeRecognizableToCollaborator;
        }

        const updated = await updateTicket.mutateAsync({
          id: editTicketId,
          data: updateData as any,
        });
        ticketId = updated.id;
        await queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(editTicketId) });
      } else {
        const created = await createTicket.mutateAsync({
          data: {
            title: finalTitle,
            description: formData.description,
            category: formData.category,
            location: formData.location || undefined,
            resource: formData.resource || undefined,
            priority: formData.priority as any,
            ...buildNewTicketAssociations({
              clientId: formData.clientId,
              assignMode,
              assignedTo: formData.assignedTo,
              assignedToGroup: formData.assignedToGroup,
            }),
            dueAt: formData.dueAt ? new Date(formData.dueAt).toISOString() : null,
            visibility: formData.visibility,
            ...(currentUser?.role === 'admin' && organizationSettings?.timeTrackingModuleEnabled === true
              ? {
                  timeTrackingEnabled: timeBillableToClient || timeRecognizableToCollaborator,
                  timeTrackingBillable: timeBillableToClient,
                  timeTrackingCompensationOverride:
                    timeBillableToClient || timeRecognizableToCollaborator
                      ? timeRecognizableToCollaborator
                      : null,
                }
              : {}),
            ...(recurrenceEnabled && currentUser?.role === 'admin'
              ? {
                  recurrenceRule: {
                    frequency: recurrenceFreq,
                    interval: recurrenceInterval,
                    ...(recurrenceFreq === 'weekly' ? { dayOfWeek: recurrenceDayOfWeek } : {}),
                    ...(recurrenceFreq === 'monthly' ? { dayOfMonth: recurrenceDayOfMonth } : {}),
                    ...(recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
                  },
                }
              : {}),
          },
        });
        ticketId = created.id;
      }

      if (!isEditing && driveFolders.length > 0) {
        let failedLinks = 0;
        for (const folder of driveFolders) {
          try {
            const response = await fetch(`/api/tickets/${ticketId}/drive-folders`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId: folder.driveFolderId }),
            });
            if (!response.ok) failedLinks += 1;
          } catch {
            failedLinks += 1;
          }
        }
        if (failedLinks > 0) {
          window.alert(lang === 'it'
            ? 'Ticket creato, ma non è stato possibile collegare una o più cartelle Drive. Puoi riprovare dal dettaglio del ticket.'
            : 'Ticket created, but one or more Drive folders could not be linked. You can retry from the ticket details.');
        }
      }

      for (const att of pendingAttachments) {
        await saveAttachment.mutateAsync({ id: ticketId, data: { ...att, commentId: null } });
      }
      const checklistReady = (() => {
        if (!checklistDraft) return false;
        if (checklistDraft.mode === 'template') return checklistDraft.templateId !== null;
        return checklistDraft.title.trim().length > 0 || checklistDraft.items.length > 0;
      })();

      if (!isEditing && checklistReady && checklistDraft) {
        try {
          if (checklistDraft.mode === 'template' && checklistDraft.templateId) {
            const tplRes = await fetch(
              `/api/tickets/${ticketId}/checklists/from-template/${checklistDraft.templateId}`,
              { method: 'POST', credentials: 'include' }
            );
            if (!tplRes.ok) throw new Error('Template checklist creation failed');
          } else {
            const clTitle = checklistDraft.title.trim() || t.checklist.sectionTitle;
            const clRes = await fetch(`/api/tickets/${ticketId}/checklists`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: clTitle }),
            });
            if (!clRes.ok) throw new Error('Checklist creation failed');
            const cl = await clRes.json();
            for (const itemText of checklistDraft.items) {
              const itemRes = await fetch(`/api/tickets/${ticketId}/checklists/${cl.id}/items`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: itemText }),
              });
              if (!itemRes.ok) throw new Error('Checklist item creation failed');
            }
          }
        } catch {
          setChecklistError(true);
        }
      }
      if (!isEditing) {
        trackEvent('ticket_created', {
          priority: formData.priority,
          visibility: formData.visibility,
          has_attachment: pendingAttachments.length > 0,
          has_checklist: checklistReady,
          source: urlParams.has('title') ? 'bot' : 'form',
        });
      }
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setLocation(`/tickets/${ticketId}`);
    } catch (err) {
      console.error(err);
      const apiError = err as {
        data?: { error?: string; message?: string };
        message?: string;
      };
      setSubmitError(
        apiError.data?.message ??
          apiError.data?.error ??
          apiError.message ??
          t.newTicket.createError,
      );
    }
  };

  const clientsEnabled = (currentUser as any)?.clientsEnabled !== false;
  const showClients = clientsEnabled && (clientsList.length > 0 || currentUser?.role === 'admin');
  const taskTrackModuleEnabled = organizationSettings?.timeTrackingModuleEnabled === true;
  const clientField = showClients ? (
    <>
      <SideLabel>
        {t.clients.clientField}{timeBillableToClient ? ' *' : ''}
      </SideLabel>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Autocomplete
          sx={{ flex: 1, '& input': { fontSize: 12 }, '& .MuiAutocomplete-option': { fontSize: 12 } }}
          size="small"
          options={clientsList}
          getOptionLabel={(o) => o.name}
          value={clientsList.find(c => c.id.toString() === formData.clientId) ?? null}
          onChange={(_, v) => setFormData(f => ({ ...f, clientId: v ? v.id.toString() : '' }))}
          noOptionsText={t.newTicket.noClientFound}
          renderInput={(params) => (
            <TextField {...params} placeholder={t.clients.clientField} inputProps={{ ...params.inputProps, style: { fontSize: 12 } }} />
          )}
        />
        {currentUser?.role === 'admin' && (
          <Tooltip title={t.newTicket.quickAddClient}>
            <IconButton
              size="small"
              onClick={() => { setQuickAddName(''); setQuickAddEmail(''); setQuickAddPhone(''); setQuickAddOpen(true); }}
              color="primary"
            >
              <AddCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {timeBillableToClient && !formData.clientId && (
        <Typography variant="caption" color="error" display="block" sx={{ mt: 0.25 }}>
          {t.newTicket.clientRequiredForBillableTime}
        </Typography>
      )}
    </>
  ) : null;
  const assignmentField = currentUser?.role === 'admin' ? (
    <>
      <SideLabel>{t.newTicket.assignField}</SideLabel>
      <ToggleButtonGroup
        value={assignMode}
        exclusive
        onChange={(_, value: 'user' | 'group' | null) => {
          if (!value) return;
          setAssignMode(value);
          setFormData(f => ({
            ...f,
            assignedTo: value === 'group' ? '' : f.assignedTo,
            assignedToGroup: value === 'user' ? '' : f.assignedToGroup,
          }));
        }}
        size="small"
        sx={{ mb: 1, '& .MuiToggleButton-root': { py: 0.4, px: 1, fontSize: 11 } }}
        fullWidth
      >
        <ToggleButton value="user">
          <Person sx={{ mr: 0.5, fontSize: 14 }} />{t.newTicket.assignCollaborator}
        </ToggleButton>
        <ToggleButton value="group" disabled={timeRecognizableToCollaborator}>
          <Group sx={{ mr: 0.5, fontSize: 14 }} />{t.newTicket.assignGroup}
        </ToggleButton>
      </ToggleButtonGroup>

      {assignMode === 'user' ? (
        <Box display="flex" flexDirection="column" gap={0.25}>
          <TextField
            size="small"
            fullWidth
            placeholder={lang === 'it' ? 'Cerca collaboratore…' : 'Search collaborator…'}
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            inputProps={{ style: { fontSize: '0.75rem', padding: '5px 8px' } }}
            sx={{ mb: 0.5 }}
          />
          <Box
            onClick={() => setFormData(f => ({ ...f, assignedTo: '' }))}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.2,
              borderRadius: 1, cursor: 'pointer',
              bgcolor: !formData.assignedTo ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem', bgcolor: 'action.disabledBackground' }}>—</Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, fontSize: 11 }}>
              {t.newTicket.unassigned}
            </Typography>
          </Box>
          {users?.filter(u => (u as any).active !== false && u.name.toLowerCase().includes(userSearch.toLowerCase())).map(u => {
            const open = openByUser[u.id];
            const selected = formData.assignedTo === u.id.toString();
            return (
              <Box
                key={u.id}
                onClick={() => setFormData(f => ({
                  ...f,
                  assignedTo: selected ? '' : u.id.toString(),
                  assignedToGroup: '',
                }))}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.2,
                  borderRadius: 1, cursor: 'pointer',
                  bgcolor: selected ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem', bgcolor: 'primary.main' }}>
                  {u.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography
                  variant="body2"
                  fontWeight={selected ? 700 : 400}
                  color={selected ? 'primary' : 'text.primary'}
                  sx={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {u.name}
                </Typography>
                {open > 0 && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    {open}
                  </Typography>
                )}
                {selected && <Typography variant="caption" color="primary" lineHeight={1}>✓</Typography>}
              </Box>
            );
          })}
        </Box>
      ) : (
        <TextField
          select fullWidth size="small"
          value={formData.assignedToGroup}
          onChange={e => setFormData(f => ({ ...f, assignedTo: '', assignedToGroup: e.target.value }))}
        >
          <MenuItem value=""><em>{t.newTicket.unassigned}</em></MenuItem>
          {groups.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
        </TextField>
      )}
      {assignMode === 'group' && timeRecognizableToCollaborator && (
        <Typography variant="caption" color="warning.main" textAlign="center" display="block" sx={{ px: 1 }}>
          {t.ticketDetail.recognitionRequiresIndividualAssignee}
        </Typography>
      )}
    </>
  ) : (
    <Box
      display="flex" alignItems="center" gap={1}
      onClick={() => setFormData(f => ({
        ...f,
        assignedTo: f.assignedTo === String((currentUser as any)?.id)
          ? ''
          : String((currentUser as any)?.id),
        assignedToGroup: '',
      }))}
      sx={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <Box
        sx={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
          bgcolor: formData.assignedTo === String((currentUser as any)?.id) ? 'primary.main' : 'action.disabledBackground',
          transition: 'background-color 0.2s',
        }}
      >
        <Box sx={{
          position: 'absolute', top: 2, left: formData.assignedTo === String((currentUser as any)?.id) ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', bgcolor: 'white',
          boxShadow: 1, transition: 'left 0.2s',
        }} />
      </Box>
      <Box>
        <Box sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
          {lang === 'it' ? 'Assegna a me' : 'Assign to me'}
        </Box>
        <Box sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.2 }}>
          {currentUser?.name}
        </Box>
      </Box>
    </Box>
  );

  if (isEditing && isLoadingEditTicket) {
    return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
  }
  if (isEditing && (editTicketLoadError || !existingTicket)) {
    return (
      <Box maxWidth={600} mx="auto">
        <Alert severity="error">{lang === 'it' ? 'Impossibile caricare il ticket da modificare.' : 'Could not load the ticket to edit.'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => setLocation(`/tickets/${editTicketId}`)}>{t.newTicket.cancel}</Button>
      </Box>
    );
  }

  return (
    <Box maxWidth={960} mx="auto">
      <Typography variant="h5" fontWeight={800} mb={{ xs: 1.5, sm: 3 }}>
        {isEditing
          ? (lang === 'it' ? `Modifica ${entityTerm.singularLower} #${(existingTicket as any)?.ticketNumber ?? editTicketId}` : `Edit ${entityTerm.singular} #${(existingTicket as any)?.ticketNumber ?? editTicketId}`)
          : (lang === 'it' ? `Apri ${entityTerm.navNew}` : `Open ${entityTerm.navNew}`)}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Box display="flex" gap={{ xs: 2, lg: '28px' }} alignItems="flex-start"
          flexDirection={{ xs: 'column', lg: 'row' }}>

          {/* ── LEFT: main content ── */}
          <Box flex={1} minWidth={0} display="flex" flexDirection="column" gap={1.5}>

            {/* Title field */}
            <Box ref={titleFieldRef} sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                label={t.newTicket.titleField}
                required
                value={formData.title}
                onChange={e => {
                  setFormData({ ...formData, title: e.target.value });
                  if (e.target.value) setSuggestedTitle(null);
                }}
                onBlur={() => setTimeout(() => setTitleDropdownOpen(false), 150)}
                onFocus={() => { if (titleHistory.length > 0) setTitleDropdownOpen(true); }}
                onKeyDown={e => { if (e.key === 'Escape') setTitleDropdownOpen(false); }}
                placeholder={t.newTicket.titlePlaceholder}
                inputProps={{ style: { fontSize: '1rem', fontWeight: 600 } }}
                sx={{ bgcolor: 'background.paper', '& .MuiOutlinedInput-root fieldset': { border: '2px solid #8a96a3' }, '& .MuiOutlinedInput-root:hover fieldset': { border: '2px solid #4a5568' } }}
              />
              {titleDropdownOpen && titleHistory.length > 0 && (
                <Paper
                  elevation={4}
                  sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300, mt: 0.5, maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}
                >
                  <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {(t.newTicket as any).titleHistoryLabel}
                    </Typography>
                  </Box>
                  {titleHistory.map(tk => (
                    <Box
                      key={tk.id}
                      onMouseDown={e => {
                        e.preventDefault();
                        setFormData(f => ({ ...f, title: tk.title }));
                        setTitleDropdownOpen(false);
                        setSuggestedTitle(null);
                      }}
                      sx={{ px: 1.5, py: 0.9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 32 }}>
                        #{tk.ticketNumber ?? tk.id}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tk.title}
                      </Typography>
                      <Chip label={tk.status} size="small" sx={{ height: 18, fontSize: '0.65rem', flexShrink: 0 }} />
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {/* AI title suggestion */}
            {!formData.title.trim() && (suggestingTitle || suggestedTitle) && (
              <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap" mt={-1.5}>
                <AutoAwesome sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                {suggestingTitle ? (
                  <>
                    <CircularProgress size={11} thickness={5} sx={{ flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">
                      {(t.newTicket as any).titleSuggestLoading}
                    </Typography>
                  </>
                ) : suggestedTitle ? (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {(t.newTicket as any).titleSuggestLabel}
                    </Typography>
                    <Chip
                      label={suggestedTitle}
                      size="small"
                      color="primary"
                      variant="outlined"
                      clickable
                      onClick={() => {
                        setFormData(f => ({ ...f, title: suggestedTitle }));
                        setSuggestedTitle(null);
                      }}
                      sx={{ height: 22, fontSize: '0.72rem', maxWidth: 400 }}
                    />
                  </>
                ) : null}
              </Box>
            )}

            {/* Checklist template suggestions */}
            {!isEditing && suggestedTemplates.length > 0 && (
              <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap" mt={-1.5}>
                <PlaylistAddCheck sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {(t.newTicket as any).checklistSuggestedTitle}
                </Typography>
                {suggestedTemplates.map(tpl => (
                  <Tooltip
                    key={tpl.id}
                    arrow
                    placement="bottom-start"
                    title={
                      tpl.items.length > 0 ? (
                        <Box component="ul" sx={{ m: 0, pl: 2, py: 0.25 }}>
                          {[...tpl.items]
                            .sort((a, b) => a.position - b.position)
                            .map(item => (
                              <Box component="li" key={item.id} sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                                {item.text}
                              </Box>
                            ))}
                        </Box>
                      ) : undefined
                    }
                  >
                    <Chip
                      label={`${tpl.title}${tpl.items.length > 0 ? ` · ${tpl.items.length}` : ''}`}
                      size="small"
                      variant="outlined"
                      color="primary"
                      clickable
                      onClick={() => applyTemplateSuggestion(tpl)}
                      sx={{ height: 22, fontSize: '0.72rem' }}
                    />
                  </Tooltip>
                ))}
              </Box>
            )}

            {/* Description */}
            <Box sx={{ '& .MuiPaper-outlined': { border: '2px solid #8a96a3' } }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                {t.newTicket.descriptionField} *
              </Typography>
              <RichCommentEditor
                value={formData.description}
                onChange={val => setFormData({ ...formData, description: val })}
                placeholder={t.newTicket.descriptionPlaceholder}
                ticketId={isEditing ? editTicketId : 0}
                onAttachmentsChange={setPendingAttachments}
                minRows={6}
              />
            </Box>

            {!isEditing && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={700}>
                    {lang === 'it' ? 'Cartelle Google Drive' : 'Google Drive folders'}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderOutlined />}
                    onClick={() => setDrivePickerOpen(true)}
                  >
                    {lang === 'it' ? 'Collega cartella' : 'Link folder'}
                  </Button>
                </Box>
                {driveFolders.length > 0 ? (
                  <Box display="flex" gap={0.75} flexWrap="wrap" mt={1}>
                    {driveFolders.map((folder) => (
                      <Chip
                        key={folder.driveFolderId}
                        label={folder.folderName}
                        size="small"
                        icon={<FolderOutlined />}
                        onDelete={() => setDriveFolders((previous) =>
                          previous.filter((item) => item.driveFolderId !== folder.driveFolderId))}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" mt={0.75}>
                    {lang === 'it'
                      ? 'Facoltativo: scegli una cartella da associare al ticket.'
                      : 'Optional: choose a folder to link to this ticket.'}
                  </Typography>
                )}
              </Paper>
            )}

            {/* Checklist */}
            {!isEditing && (
              <NewTicketChecklistSection
                value={checklistDraft}
                onChange={setChecklistDraft}
                forceExpand={checklistForceExpand}
              />
            )}

            {!isEditing && checklistError && (
              <Alert severity="warning" onClose={() => setChecklistError(false)}>
                {t.newTicket.checklistError}
              </Alert>
            )}
            {submitError && (
              <Alert severity="error" onClose={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}
          </Box>

          {/* ── RIGHT: sidebar ── */}
          <Box
            width={{ xs: '100%', lg: 280 }}
            flexShrink={0}
            sx={{ position: { lg: 'sticky' }, top: { lg: 20 } }}
          >
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>

                <Typography variant="caption" fontWeight={700} color="text.disabled"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', mb: 0.6 }}>
                  {lang === 'it' ? 'Dettagli' : 'Details'}
                </Typography>

                {/* Category */}
                <SideSection>
                  <SideLabel>{t.newTicket.categoryField} *</SideLabel>
                  <TextField
                    select fullWidth size="small" required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    sx={{ '& .MuiSelect-select': { fontSize: 12, py: '6px' } }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { fontSize: 12 } }, MenuListProps: { dense: true } } }}
                  >
                    {categories.map(c => <MenuItem key={c} value={c} sx={{ fontSize: 12, py: 0.5, minHeight: 0 }}>{c}</MenuItem>)}
                  </TextField>
                </SideSection>

                {/* Priority — dot picker */}
                <SideSection>
                  <SideLabel>{t.newTicket.priorityField}</SideLabel>
                  <Box display="flex" flexDirection="column" gap={0.25}>
                    {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                      <Box
                        key={p}
                        onClick={() => setFormData({ ...formData, priority: p })}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 0.75, py: 0.2, borderRadius: 1, cursor: 'pointer',
                          bgcolor: formData.priority === p ? 'action.selected' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_DOTS[p], flexShrink: 0 }} />
                        <Typography
                          variant="body2"
                          fontWeight={formData.priority === p ? 700 : 400}
                          color={formData.priority === p ? 'primary' : 'text.primary'}
                          sx={{ flex: 1, fontSize: 11 }}
                        >
                          {t.priority[p]}
                        </Typography>
                        {formData.priority === p && (
                          <Typography variant="caption" color="primary" lineHeight={1}>✓</Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </SideSection>

                {/* Visibility (admin only) */}
                {!isEditing && currentUser?.role === 'admin' && (
                  <SideSection>
                    <SideLabel>{t.newTicket.visibilityField}</SideLabel>
                    <TextField
                      select fullWidth size="small"
                      value={formData.visibility}
                      onChange={e => setFormData({ ...formData, visibility: e.target.value as 'organization' | 'admins' })}
                      sx={{ '& .MuiSelect-select': { fontSize: 12, py: '6px' } }}
                      SelectProps={{ MenuProps: { PaperProps: { sx: { fontSize: 12 } }, MenuListProps: { dense: true } } }}
                    >
                      <MenuItem value="organization" sx={{ fontSize: 12, py: 0.5, minHeight: 0 }}>
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <PublicOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />
                          {t.newTicket.visibilityOrganization}
                        </Box>
                      </MenuItem>
                      <MenuItem value="admins" sx={{ fontSize: 12, py: 0.5, minHeight: 0 }}>
                        <Box display="flex" alignItems="center" gap={0.75}>
                          <LockOutlined sx={{ fontSize: 15, color: 'warning.main' }} />
                          {t.newTicket.visibilityAdmins}
                        </Box>
                      </MenuItem>
                    </TextField>
                  </SideSection>
                )}

                {/* Location */}
                {!singleLocation && (
                  <SideSection>
                    <SideLabel>{t.newTicket.locationField}</SideLabel>
                    <TextField
                      select fullWidth size="small"
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      inputProps={{ style: { fontSize: 12 } }}
                      SelectProps={{ MenuProps: { PaperProps: { sx: { fontSize: 12 } } } }}
                    >
                      <MenuItem value="" sx={{ fontSize: 12 }}><em>{t.newTicket.noLocation}</em></MenuItem>
                      {locations.map(l => <MenuItem key={l} value={l} sx={{ fontSize: 12 }}>{l}</MenuItem>)}
                    </TextField>
                  </SideSection>
                )}

                {/* Due date */}
                {(!isEditing ||
                  currentUser?.role === 'admin' ||
                  Number((existingTicket as any)?.assignedTo) === Number((currentUser as any)?.id)) && (
                  <SideSection>
                    <SideLabel>{t.newTicket.dueAtField}</SideLabel>
                    <TextField
                      fullWidth size="small" type="datetime-local"
                      value={formData.dueAt}
                      onChange={e => setFormData({ ...formData, dueAt: e.target.value })}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: toLocalDatetimeInput(new Date()), style: { fontSize: 12 } }}
                      label=""
                    />
                  </SideSection>
                )}

                {taskTrackModuleEnabled && (!isEditing || !(existingTicket as any)?.timeTrackingEnabled) ? (
                  <SideSection>
                    <SideLabel>{t.newTicket.taskTrackSection}</SideLabel>
                    {currentUser?.role === 'admin' && (
                      <>
                        <FormControlLabel
                          sx={{ mx: 0, width: '100%', justifyContent: 'center', alignItems: 'center' }}
                          control={<Checkbox size="small" checked={timeBillableToClient} onChange={(event) => setTimeBillableToClient(event.target.checked)} />}
                          data-testid="toggle-ticket-client-billable"
                          label={<Typography variant="body2" fontSize={12} textAlign="center">{t.newTicket.billableToClient}</Typography>}
                        />
                        <Typography variant="caption" color="text.secondary" textAlign="center" display="block" sx={{ px: 1, mt: -0.25 }}>
                          {t.newTicket.billableToClientHint}
                        </Typography>
                        <FormControlLabel
                          sx={{ mx: 0, mt: 0.75, width: '100%', justifyContent: 'center', alignItems: 'center' }}
                          control={<Checkbox size="small" disabled={assignMode === 'group'} checked={timeRecognizableToCollaborator} onChange={(event) => setTimeRecognizableToCollaborator(event.target.checked)} />}
                          data-testid="toggle-ticket-collaborator-recognizable"
                          label={<Typography variant="body2" fontSize={12} textAlign="center">{t.ticketDetail.trackedTimeCollaboratorRecognizable}</Typography>}
                        />
                        <Typography variant="caption" color="text.secondary" textAlign="center" display="block" sx={{ px: 1, mt: -0.25 }}>
                          {t.ticketDetail.trackedTimeCollaboratorRecognizableHelp}
                        </Typography>
                        {assignMode === 'group' && (
                          <Typography variant="caption" color="warning.main" textAlign="center" display="block" sx={{ px: 1 }}>
                            {t.ticketDetail.recognitionRequiresIndividualAssignee}
                          </Typography>
                        )}
                      </>
                    )}
                    {clientField && (
                      <Box mt={1} pt={1} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                        {clientField}
                      </Box>
                    )}
                    <Box mt={1} pt={1} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                      {assignmentField}
                    </Box>
                  </SideSection>
                ) : (
                  <>
                    {clientField && <SideSection>{clientField}</SideSection>}
                    <SideSection>{assignmentField}</SideSection>
                  </>
                )}

                {!isEditing && currentUser?.role === 'admin' && (
                  <SideSection>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <RepeatIcon sx={{ fontSize: 16, color: recurrenceEnabled ? 'primary.main' : 'text.secondary' }} />
                      <FormControlLabel
                        sx={{ m: 0, flex: 1, justifyContent: 'space-between' }}
                        label={<Typography variant="body2" fontSize={12} fontWeight={recurrenceEnabled ? 700 : 500}>{t.newTicket.recurrenceToggle}</Typography>}
                        labelPlacement="start"
                        control={
                          <Switch
                            size="small"
                            checked={recurrenceEnabled}
                            onChange={(event) => setRecurrenceEnabled(event.target.checked)}
                          />
                        }
                      />
                    </Box>
                    {recurrenceEnabled && (
                      <Box display="flex" flexDirection="column" gap={0.75} mt={0.75}>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                          {t.newTicket.recurrenceHint}
                        </Typography>
                        <TextField
                          select
                          fullWidth
                          size="small"
                          label={t.newTicket.recurrenceFrequency}
                          value={recurrenceFreq}
                          onChange={(event) => setRecurrenceFreq(event.target.value as typeof recurrenceFreq)}
                          sx={{ '& .MuiSelect-select': { fontSize: 12, py: '6px' } }}
                        >
                          <MenuItem value="daily" sx={{ fontSize: 12 }}>{t.newTicket.recurrenceFreqDaily}</MenuItem>
                          <MenuItem value="weekly" sx={{ fontSize: 12 }}>{t.newTicket.recurrenceFreqWeekly}</MenuItem>
                          <MenuItem value="monthly" sx={{ fontSize: 12 }}>{t.newTicket.recurrenceFreqMonthly}</MenuItem>
                          <MenuItem value="yearly" sx={{ fontSize: 12 }}>{t.newTicket.recurrenceFreqYearly}</MenuItem>
                        </TextField>
                        {recurrenceFreq === 'weekly' && (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label={t.newTicket.recurrenceDayOfWeek}
                            value={recurrenceDayOfWeek}
                            onChange={(event) => setRecurrenceDayOfWeek(parseInt(event.target.value, 10))}
                            sx={{ '& .MuiSelect-select': { fontSize: 12, py: '6px' } }}
                          >
                            {[
                              { value: 1, label: t.newTicket.recurrenceDayMonday },
                              { value: 2, label: t.newTicket.recurrenceDayTuesday },
                              { value: 3, label: t.newTicket.recurrenceDayWednesday },
                              { value: 4, label: t.newTicket.recurrenceDayThursday },
                              { value: 5, label: t.newTicket.recurrenceDayFriday },
                              { value: 6, label: t.newTicket.recurrenceDaySaturday },
                              { value: 0, label: t.newTicket.recurrenceDaySunday },
                            ].map((day) => (
                              <MenuItem key={day.value} value={day.value} sx={{ fontSize: 12 }}>{day.label}</MenuItem>
                            ))}
                          </TextField>
                        )}
                        {recurrenceFreq === 'monthly' && (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label={t.newTicket.recurrenceDayOfMonth}
                            value={recurrenceDayOfMonth}
                            onChange={(event) => setRecurrenceDayOfMonth(parseInt(event.target.value, 10))}
                            helperText={t.newTicket.recurrenceDayOfMonthHint}
                            sx={{ '& .MuiSelect-select': { fontSize: 12, py: '6px' }, '& .MuiFormHelperText-root': { fontSize: 10, mx: 0 } }}
                          >
                            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                              <MenuItem key={day} value={day} sx={{ fontSize: 12 }}>{day}</MenuItem>
                            ))}
                          </TextField>
                        )}
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label={t.newTicket.recurrenceEvery}
                          value={recurrenceInterval}
                          onChange={(event) => setRecurrenceInterval(Math.max(1, Math.min(365, parseInt(event.target.value, 10) || 1)))}
                          inputProps={{ min: 1, max: 365, style: { fontSize: 12 } }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t.newTicket.recurrenceEndDate}
                          value={recurrenceEndDate}
                          onChange={(event) => setRecurrenceEndDate(event.target.value)}
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ min: new Date().toISOString().slice(0, 10), style: { fontSize: 12 } }}
                        />
                      </Box>
                    )}
                  </SideSection>
                )}

                {/* Buttons */}
                <Box display="flex" flexDirection="column" gap={0.5} mt={0.25}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={createTicket.isPending || updateTicket.isPending || (isEditing && isLoadingEditTicket)}
                  >
                    {createTicket.isPending || updateTicket.isPending
                      ? (isEditing ? (lang === 'it' ? 'Salvataggio…' : 'Saving…') : t.newTicket.creating)
                      : (isEditing
                        ? (lang === 'it' ? 'Salva modifiche' : 'Save changes')
                        : (lang === 'it' ? `Crea ${entityTerm.singular}` : `Create ${entityTerm.singular}`))}
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setLocation(isEditing ? `/tickets/${editTicketId}` : '/tickets')}>
                    {t.newTicket.cancel}
                  </Button>
                </Box>

              </CardContent>
            </Card>
          </Box>

        </Box>
      </form>

      {/* Quick-add client dialog */}
      <Dialog open={quickAddOpen} onClose={() => !quickAddSaving && setQuickAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.newTicket.quickAddClientTitle}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label={`${t.clients?.name ?? 'Nome'} *`}
            value={quickAddName}
            onChange={e => setQuickAddName(e.target.value)}
            fullWidth
            autoFocus
            disabled={quickAddSaving}
          />
          <TextField
            label={`${t.clients?.email ?? 'Email'} (${lang === 'it' ? 'opzionale' : 'optional'})`}
            type="email"
            value={quickAddEmail}
            onChange={e => setQuickAddEmail(e.target.value)}
            fullWidth
            disabled={quickAddSaving}
          />
          <TextField
            label={`${t.clients?.phone ?? 'Telefono'} (${lang === 'it' ? 'opzionale' : 'optional'})`}
            value={quickAddPhone}
            onChange={e => setQuickAddPhone(e.target.value)}
            fullWidth
            disabled={quickAddSaving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickAddOpen(false)} disabled={quickAddSaving}>
            {t.newTicket.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleQuickAddClient}
            disabled={!quickAddName.trim() || quickAddSaving}
            startIcon={quickAddSaving ? <CircularProgress size={16} /> : undefined}
          >
            {quickAddSaving ? t.newTicket.quickAddClientSaving : t.newTicket.quickAddClientSave}
          </Button>
        </DialogActions>
      </Dialog>
      {!isEditing && (
        <Dialog open={drivePickerOpen} onClose={() => setDrivePickerOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{lang === 'it' ? 'Scegli una cartella Google Drive' : 'Choose a Google Drive folder'}</DialogTitle>
          <DialogContent dividers>
            <DriveBrowser context="new-ticket" selectionMode onSelectFolder={addDriveFolder} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDrivePickerOpen(false)}>{t.newTicket.cancel}</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
