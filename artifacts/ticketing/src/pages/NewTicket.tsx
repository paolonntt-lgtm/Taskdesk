import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem,
  ToggleButton, ToggleButtonGroup, Autocomplete, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Tooltip, IconButton,
  Alert, Chip,
} from '@mui/material';
import { Person, Group, AddCircle as AddCircleIcon, PlaylistAddCheck } from '@mui/icons-material';
import { useCreateTicket, useListUsers, useSaveTicketAttachment, useListClients, getListTicketsQueryKey, getListClientsQueryKey } from '@workspace/api-client-react';
import { useLocation, useSearch } from 'wouter';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { RichCommentEditor, type PendingAttachment } from '../components/RichCommentEditor';
import NewTicketChecklistSection, { type ChecklistDraft } from '../components/NewTicketChecklistSection';

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

export default function NewTicket() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { t, lang } = useLanguage();
  const entityTerm = useEntityTerm();
  const queryClient = useQueryClient();
  const createTicket = useCreateTicket();
  const saveAttachment = useSaveTicketAttachment();
  const { data: users } = useListUsers();
  const { user: currentUser } = useAuth();

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft | null>(null);
  const [checklistError, setChecklistError] = useState(false);
  const [checklistForceExpand, setChecklistForceExpand] = useState(false);

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [debouncedTitle, setDebouncedTitle] = useState('');

  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');

  const urlParams = new URLSearchParams(search);
  const { data: clientsList = [] } = useListClients();

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
  });

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
        if (!formData.category && cats.length > 0) {
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
        if (locs.length === 1) {
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
    try {
      const selectedClient = clientsList.find(c => c.id.toString() === formData.clientId);
      const finalTitle = selectedClient
        ? `${(selectedClient as any).alias || selectedClient.name}: ${formData.title}`
        : formData.title;
      const result = await createTicket.mutateAsync({
        data: {
          title: finalTitle,
          description: formData.description,
          category: formData.category,
          location: formData.location || undefined,
          resource: formData.resource || undefined,
          priority: formData.priority as any,
          assignedTo: assignMode === 'user' && formData.assignedTo ? parseInt(formData.assignedTo) : null,
          assignedToGroup: assignMode === 'group' && formData.assignedToGroup ? formData.assignedToGroup : null,
          dueAt: formData.dueAt ? new Date(formData.dueAt).toISOString() : null,
          clientId: formData.clientId ? parseInt(formData.clientId) : null,
        },
      });
      for (const att of pendingAttachments) {
        await saveAttachment.mutateAsync({ id: result.id, data: { ...att, commentId: null } });
      }
      const checklistReady = (() => {
        if (!checklistDraft) return false;
        if (checklistDraft.mode === 'template') return checklistDraft.templateId !== null;
        return checklistDraft.title.trim().length > 0 || checklistDraft.items.length > 0;
      })();

      if (checklistReady && checklistDraft) {
        try {
          if (checklistDraft.mode === 'template' && checklistDraft.templateId) {
            const tplRes = await fetch(
              `/api/tickets/${result.id}/checklists/from-template/${checklistDraft.templateId}`,
              { method: 'POST', credentials: 'include' }
            );
            if (!tplRes.ok) throw new Error('Template checklist creation failed');
          } else {
            const clTitle = checklistDraft.title.trim() || t.checklist.sectionTitle;
            const clRes = await fetch(`/api/tickets/${result.id}/checklists`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: clTitle }),
            });
            if (!clRes.ok) throw new Error('Checklist creation failed');
            const cl = await clRes.json();
            for (const itemText of checklistDraft.items) {
              const itemRes = await fetch(`/api/tickets/${result.id}/checklists/${cl.id}/items`, {
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
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setLocation(`/tickets/${result.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box maxWidth={800} mx="auto">
      <Typography variant="h5" fontWeight="bold" mb={{ xs: 1.5, sm: 3 }}>
        {lang === 'it' ? `Apri ${entityTerm.navNew}` : `Open ${entityTerm.navNew}`}
      </Typography>

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 4 } }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t.newTicket.titleField}
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t.newTicket.titlePlaceholder}
                />
                {suggestedTemplates.length > 0 && (
                  <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap" mt={0.75}>
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
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                  {t.newTicket.descriptionField} *
                </Typography>
                <RichCommentEditor
                  value={formData.description}
                  onChange={val => setFormData({ ...formData, description: val })}
                  placeholder={t.newTicket.descriptionPlaceholder}
                  ticketId={0}
                  onAttachmentsChange={setPendingAttachments}
                  minRows={4}
                />
              </Grid>

              <Grid item xs={12} sm={singleLocation ? 12 : 6}>
                <TextField
                  select
                  fullWidth
                  label={t.newTicket.categoryField}
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>

              {!singleLocation && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label={t.newTicket.locationField}
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  >
                    <MenuItem value=""><em>{t.newTicket.noLocation}</em></MenuItem>
                    {locations.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </TextField>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t.newTicket.resourceField}
                  value={formData.resource}
                  onChange={e => setFormData({ ...formData, resource: e.target.value })}
                  placeholder={t.newTicket.resourcePlaceholder}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label={t.newTicket.priorityField}
                  required
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <MenuItem value="low">{t.priority.low}</MenuItem>
                  <MenuItem value="medium">{t.priority.medium}</MenuItem>
                  <MenuItem value="high">{t.priority.high}</MenuItem>
                  <MenuItem value="urgent">{t.priority.urgent}</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t.newTicket.dueAtField}
                  type="datetime-local"
                  value={formData.dueAt}
                  onChange={e => setFormData({ ...formData, dueAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: toLocalDatetimeInput(new Date()) }}
                />
              </Grid>

              {(currentUser as any)?.clientsEnabled !== false && (clientsList.length > 0 || currentUser?.role === 'admin') && (
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Autocomplete
                      sx={{ flex: 1 }}
                      options={clientsList}
                      getOptionLabel={(o) => o.name}
                      value={clientsList.find(c => c.id.toString() === formData.clientId) ?? null}
                      onChange={(_, v) => setFormData({ ...formData, clientId: v ? v.id.toString() : '' })}
                      noOptionsText={t.newTicket.noClientFound}
                      renderInput={(params) => (
                        <TextField {...params} label={t.clients.clientField} />
                      )}
                    />
                    {currentUser?.role === 'admin' && (
                      <Tooltip title={t.newTicket.quickAddClient}>
                        <IconButton
                          onClick={() => { setQuickAddName(''); setQuickAddEmail(''); setQuickAddPhone(''); setQuickAddOpen(true); }}
                          color="primary"
                        >
                          <AddCircleIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Grid>
              )}

              {currentUser?.role === 'admin' && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    {t.newTicket.assignField}
                  </Typography>
                  <Box display="flex" gap={2} alignItems="flex-start" flexWrap="wrap">
                    <ToggleButtonGroup
                      value={assignMode}
                      exclusive
                      onChange={(_, v) => { if (v) setAssignMode(v); }}
                      size="small"
                    >
                      <ToggleButton value="user"><Person sx={{ mr: 0.5 }} fontSize="small" />{t.newTicket.assignUser}</ToggleButton>
                      <ToggleButton value="group"><Group sx={{ mr: 0.5 }} fontSize="small" />{t.newTicket.assignGroup}</ToggleButton>
                    </ToggleButtonGroup>

                    {assignMode === 'user' ? (
                      <TextField
                        select
                        size="small"
                        label={t.newTicket.assignUser}
                        value={formData.assignedTo}
                        onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value=""><em>{t.newTicket.unassigned}</em></MenuItem>
                        {users?.map(u => {
                          const open = openByUser[u.id];
                          return (
                            <MenuItem key={u.id} value={u.id.toString()}>
                              <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
                                <span>{u.name}</span>
                                {open > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                    {open} {t.newTicket.openTickets}
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    ) : (
                      <TextField
                        select
                        size="small"
                        label={t.newTicket.assignGroup}
                        value={formData.assignedToGroup}
                        onChange={e => setFormData({ ...formData, assignedToGroup: e.target.value })}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value=""><em>{t.newTicket.unassigned}</em></MenuItem>
                        {groups.map(g => (
                          <MenuItem key={g} value={g}>{g}</MenuItem>
                        ))}
                      </TextField>
                    )}
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <NewTicketChecklistSection
                  value={checklistDraft}
                  onChange={setChecklistDraft}
                  forceExpand={checklistForceExpand}
                />
              </Grid>

              {checklistError && (
                <Grid item xs={12}>
                  <Alert severity="warning" onClose={() => setChecklistError(false)}>
                    {t.newTicket.checklistError}
                  </Alert>
                </Grid>
              )}

              <Grid item xs={12} display="flex" justifyContent="flex-end" gap={2} mt={{ xs: 0, sm: 2 }}>
                <Button variant="outlined" onClick={() => setLocation('/tickets')}>
                  {t.newTicket.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={createTicket.isPending}
                >
                  {createTicket.isPending ? t.newTicket.creating : (lang === 'it' ? `Crea ${entityTerm.singular}` : `Create ${entityTerm.singular}`)}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

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
    </Box>
  );
}
