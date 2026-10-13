import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AddRounded, DeleteOutline, EditOutlined, NotificationsActiveRounded, SaveRounded } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getListActiveAnnouncementsQueryKey,
  getListAnnouncementsQueryKey,
  getListGroupsQueryKey,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useListAnnouncements,
  useListGroups,
  useUpdateAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from '@workspace/api-client-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  announcementDateTimeInputProps,
  localDateTimeValue,
  runWithValidAnnouncementSchedule,
} from '../lib/announcementSchedule';

type TargetType = 'all' | 'location' | 'group';

interface AnnouncementForm {
  title: string;
  body: string;
  targetType: TargetType;
  targetLocation: string;
  targetGroupId: string;
  startsAt: string;
  endsAt: string;
}

function defaultForm(): AnnouncementForm {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: '',
    body: '',
    targetType: 'all',
    targetLocation: '',
    targetGroupId: '',
    startsAt: localDateTimeValue(now),
    endsAt: localDateTimeValue(end),
  };
}

function responseError(error: unknown, fallback: string): string {
  const apiError = error as { data?: { error?: string; message?: string } };
  return apiError?.data?.message ?? apiError?.data?.error ?? fallback;
}

export default function AnnouncementsSettings() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const isItalian = lang === 'it';
  const organizationId = (user as any)?.organizationId as number | null | undefined;
  const canManageAnnouncements = !!user && organizationId != null;
  const tenantScope = `${user?.id ?? 'signed-out'}:${(user as any)?.organizationId ?? 'no-org'}`;
  const announcementsKey = [...getListAnnouncementsQueryKey(), tenantScope];
  const groupsKey = [...getListGroupsQueryKey(), tenantScope];

  const announcementsQuery = useListAnnouncements({
    query: { enabled: canManageAnnouncements, queryKey: announcementsKey, staleTime: 15_000 } as any,
  });
  const groupsQuery = useListGroups({
    query: { enabled: canManageAnnouncements, queryKey: groupsKey, staleTime: 5 * 60_000 } as any,
  });
  const locationsQuery = useQuery({
    queryKey: ['announcement-locations', tenantScope],
    enabled: canManageAnnouncements,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await fetch('/api/settings/locations', { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load locations');
      const data = await response.json();
      return Array.isArray(data.value) ? data.value as string[] : [];
    },
  });

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(defaultForm);
  const [formError, setFormError] = useState('');
  const [pageMessage, setPageMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const saving = createAnnouncement.isPending || updateAnnouncement.isPending;
  const deleting = deleteAnnouncement.isPending;

  const refreshAnnouncements = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: announcementsKey }),
      queryClient.invalidateQueries({ queryKey: getListActiveAnnouncementsQueryKey() }),
    ]);
  };

  const openCreateDialog = () => {
    setEditingAnnouncement(null);
    setForm(defaultForm());
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title,
      body: announcement.body,
      targetType: announcement.targetType,
      targetLocation: announcement.targetLocation ?? '',
      targetGroupId: announcement.targetGroupId == null ? '' : String(announcement.targetGroupId),
      startsAt: localDateTimeValue(announcement.startsAt),
      endsAt: localDateTimeValue(announcement.endsAt),
    });
    setFormError('');
    setDialogOpen(true);
  };

  const saveAnnouncement = async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) {
      setFormError(isItalian ? 'Inserisci titolo e testo dell’avviso.' : 'Enter an announcement title and message.');
      return;
    }
    if (form.targetType === 'location' && !form.targetLocation) {
      setFormError(isItalian ? 'Seleziona una sede.' : 'Select a location.');
      return;
    }
    if (form.targetType === 'group' && !form.targetGroupId) {
      setFormError(isItalian ? 'Seleziona un gruppo.' : 'Select a group.');
      return;
    }

    setFormError('');
    setPageMessage(null);
    try {
      const saved = await runWithValidAnnouncementSchedule(form.startsAt, form.endsAt, async (schedule) => {
        const data: AnnouncementInput = {
          title,
          body,
          targetType: form.targetType,
          targetLocation: form.targetType === 'location' ? form.targetLocation : null,
          targetGroupId: form.targetType === 'group' ? Number(form.targetGroupId) : null,
          ...schedule,
        };
        if (editingAnnouncement) {
          await updateAnnouncement.mutateAsync({ id: editingAnnouncement.id, data });
        } else {
          await createAnnouncement.mutateAsync({ data });
        }
      });
      if (!saved) {
        setFormError(isItalian ? 'La data di fine deve essere successiva alla data di inizio.' : 'The end date must be after the start date.');
        return;
      }
      await refreshAnnouncements();
      setDialogOpen(false);
      setPageMessage({
        severity: 'success',
        text: isItalian ? 'Avviso salvato.' : 'Announcement saved.',
      });
    } catch (error) {
      setFormError(responseError(error, isItalian ? 'Non è stato possibile salvare l’avviso.' : 'Could not save the announcement.'));
    }
  };

  const confirmDelete = async () => {
    if (!announcementToDelete) return;
    setDeleteError('');
    try {
      await deleteAnnouncement.mutateAsync({ id: announcementToDelete.id });
      await refreshAnnouncements();
      setAnnouncementToDelete(null);
      setPageMessage({
        severity: 'success',
        text: isItalian ? 'Avviso eliminato.' : 'Announcement deleted.',
      });
    } catch (error) {
      setDeleteError(responseError(error, isItalian ? 'Non è stato possibile eliminare l’avviso.' : 'Could not delete the announcement.'));
    }
  };

  const dateLabel = (value: Date | string) => new Date(value).toLocaleString(
    isItalian ? 'it-IT' : 'en-GB',
    { dateStyle: 'medium', timeStyle: 'short' },
  );
  const targetLabel = (announcement: Announcement) => {
    if (announcement.targetType === 'all') return isItalian ? 'Tutti i collaboratori' : 'All collaborators';
    if (announcement.targetType === 'location') return announcement.targetLocation ?? (isItalian ? 'Sede non disponibile' : 'Location unavailable');
    const group = groupsQuery.data?.find((item) => item.id === announcement.targetGroupId);
    return group?.name ?? (isItalian ? 'Gruppo non disponibile' : 'Group unavailable');
  };
  const statusFor = (announcement: Announcement) => {
    const now = Date.now();
    if (new Date(announcement.startsAt).getTime() > now) {
      return { label: isItalian ? 'Programmato' : 'Scheduled', color: 'info' as const };
    }
    if (new Date(announcement.endsAt).getTime() > now) {
      return { label: isItalian ? 'Attivo' : 'Active', color: 'success' as const };
    }
    return { label: isItalian ? 'Scaduto' : 'Expired', color: 'default' as const };
  };
  const announcements = announcementsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={2} mb={2.5}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotificationsActiveRounded color="primary" />
              <Typography variant="h6" fontWeight={700}>{isItalian ? 'Avvisi ai collaboratori' : 'Collaborator announcements'}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {isItalian
                ? 'Crea popup con destinatari e periodo di validità. Gli avvisi sono separati dai messaggi motivazionali.'
                : 'Create popups with selected recipients and an active period. These are separate from motivational messages.'}
            </Typography>
          </Box>
          <Button data-testid="button-create-announcement" variant="contained" startIcon={<AddRounded />} onClick={openCreateDialog} disabled={!canManageAnnouncements} sx={{ flexShrink: 0 }}>
            {isItalian ? 'Nuovo avviso' : 'New announcement'}
          </Button>
        </Stack>

        {pageMessage && (
          <Alert data-testid="alert-announcement-status" severity={pageMessage.severity} sx={{ mb: 2 }} onClose={() => setPageMessage(null)}>
            {pageMessage.text}
          </Alert>
        )}
        {!canManageAnnouncements && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {isItalian ? 'Questa funzione richiede un account amministratore associato a un’organizzazione.' : 'This feature requires an administrator account linked to an organization.'}
          </Alert>
        )}
        {(announcementsQuery.isError || locationsQuery.isError || groupsQuery.isError) && (
          <Alert data-testid="alert-announcements-load-error" severity="error" sx={{ mb: 2 }}>
            {isItalian ? 'Errore nel caricamento dei dati degli avvisi.' : 'Could not load announcement data.'}
          </Alert>
        )}

        {announcementsQuery.isLoading ? (
          <Box display="flex" justifyContent="center" py={5}><CircularProgress size={28} /></Box>
        ) : announcements.length === 0 ? (
          <Box data-testid="empty-announcements" sx={{ py: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
            <NotificationsActiveRounded color="disabled" sx={{ fontSize: 34, mb: 1 }} />
            <Typography fontWeight={600}>{isItalian ? 'Nessun avviso creato' : 'No announcements yet'}</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {isItalian ? 'Gli avvisi attivi appariranno come popup ai destinatari selezionati.' : 'Active announcements appear as popups for their selected recipients.'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {announcements.map((announcement) => {
              const status = statusFor(announcement);
              return (
                <Card key={announcement.id} data-testid={`card-announcement-${announcement.id}`} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 1.75, sm: 2 }, '&:last-child': { pb: { xs: 1.75, sm: 2 } } }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                      <Box minWidth={0} flex={1}>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                          <Typography data-testid={`text-announcement-title-${announcement.id}`} variant="subtitle1" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{announcement.title}</Typography>
                          <Chip data-testid={`status-announcement-${announcement.id}`} size="small" label={status.label} color={status.color} variant={status.color === 'default' ? 'outlined' : 'filled'} />
                        </Stack>
                        <Typography data-testid={`text-announcement-message-${announcement.id}`} variant="body2" color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {announcement.body}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mt={1.5} alignItems="center">
                          <Chip size="small" variant="outlined" label={targetLabel(announcement)} />
                          <Typography variant="caption" color="text.secondary">
                            {dateLabel(announcement.startsAt)} — {dateLabel(announcement.endsAt)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack direction="row" alignItems="flex-start" justifyContent="flex-end" flexShrink={0}>
                        <Tooltip title={isItalian ? 'Modifica avviso' : 'Edit announcement'}>
                          <IconButton data-testid={`button-edit-announcement-${announcement.id}`} aria-label={isItalian ? 'Modifica avviso' : 'Edit announcement'} onClick={() => openEditDialog(announcement)}>
                            <EditOutlined />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={isItalian ? 'Elimina avviso' : 'Delete announcement'}>
                          <IconButton
                            data-testid={`button-delete-announcement-${announcement.id}`}
                            aria-label={isItalian ? 'Elimina avviso' : 'Delete announcement'}
                            color="error"
                            onClick={() => { setAnnouncementToDelete(announcement); setDeleteError(''); }}
                          >
                            <DeleteOutline />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </CardContent>

      <Dialog data-testid="dialog-announcement-form" open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingAnnouncement ? (isItalian ? 'Modifica avviso' : 'Edit announcement') : (isItalian ? 'Nuovo avviso' : 'New announcement')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={0.5}>
            {formError && <Alert data-testid="alert-announcement-form-error" severity="error">{formError}</Alert>}
            <TextField
              inputProps={{ 'data-testid': 'input-announcement-title', maxLength: 180 }}
              autoFocus
              required
              fullWidth
              label={isItalian ? 'Titolo' : 'Title'}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              disabled={saving}
            />
            <TextField
              inputProps={{ 'data-testid': 'input-announcement-body', maxLength: 5000 }}
              required
              fullWidth
              multiline
              minRows={5}
              label={isItalian ? 'Testo dell’avviso' : 'Announcement message'}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              helperText={isItalian ? 'Il testo sarà mostrato nel popup ai destinatari.' : 'This message appears in the recipients’ popup.'}
              disabled={saving}
            />
            <TextField
                data-testid="select-announcement-target"
              select
              fullWidth
              label={isItalian ? 'Destinatari' : 'Recipients'}
              value={form.targetType}
              onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value as TargetType }))}
              disabled={saving}
            >
              <MenuItem value="all">{isItalian ? 'Tutti i collaboratori' : 'All collaborators'}</MenuItem>
              <MenuItem value="location">{isItalian ? 'Una sede' : 'One location'}</MenuItem>
              <MenuItem value="group">{isItalian ? 'Un gruppo di collaboratori' : 'One collaborator group'}</MenuItem>
            </TextField>
            {form.targetType === 'location' && (
              <TextField
                data-testid="select-announcement-location"
                select
                required
                fullWidth
                label={isItalian ? 'Sede' : 'Location'}
                value={form.targetLocation}
                onChange={(event) => setForm((current) => ({ ...current, targetLocation: event.target.value }))}
                disabled={saving || locationsQuery.isLoading}
                helperText={isItalian ? 'Riceveranno l’avviso i collaboratori con questa sede nel profilo.' : 'Recipients must have this location set on their profile.'}
              >
                {locations.length === 0 && <MenuItem value="" disabled>{isItalian ? 'Nessuna sede configurata' : 'No locations configured'}</MenuItem>}
                {locations.map((location) => <MenuItem key={location} value={location}>{location}</MenuItem>)}
              </TextField>
            )}
            {form.targetType === 'group' && (
              <TextField
                data-testid="select-announcement-group"
                select
                required
                fullWidth
                label={isItalian ? 'Gruppo' : 'Group'}
                value={form.targetGroupId}
                onChange={(event) => setForm((current) => ({ ...current, targetGroupId: event.target.value }))}
                disabled={saving || groupsQuery.isLoading}
                helperText={isItalian ? 'Riceveranno l’avviso i membri del gruppo selezionato.' : 'Only members of the selected group receive the announcement.'}
              >
                {groups.length === 0 && <MenuItem value="" disabled>{isItalian ? 'Nessun gruppo disponibile' : 'No groups available'}</MenuItem>}
                {groups.map((group) => <MenuItem key={group.id} value={String(group.id)}>{group.name}</MenuItem>)}
              </TextField>
            )}
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
              <TextField
                required
                {...announcementDateTimeInputProps('startsAt', form.startsAt, form.endsAt)}
                label={isItalian ? 'Inizio pubblicazione' : 'Starts at'}
                onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                disabled={saving}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                required
                {...announcementDateTimeInputProps('endsAt', form.startsAt, form.endsAt)}
                label={isItalian ? 'Fine pubblicazione' : 'Ends at'}
                onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                disabled={saving}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {isItalian
                ? 'Il popup viene mostrato nell’intervallo selezionato; la chiusura viene ricordata per questo utente su questo browser.'
                : 'The popup is shown during this period; dismissal is remembered for this user in this browser.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button data-testid="button-cancel-announcement" onClick={() => setDialogOpen(false)} disabled={saving}>
            {isItalian ? 'Annulla' : 'Cancel'}
          </Button>
          <Button data-testid="button-save-announcement" variant="contained" onClick={saveAnnouncement} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}>
            {isItalian ? 'Salva avviso' : 'Save announcement'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog data-testid="dialog-delete-announcement" open={!!announcementToDelete} onClose={() => !deleting && setAnnouncementToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{isItalian ? 'Eliminare l’avviso?' : 'Delete announcement?'}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert data-testid="alert-delete-announcement-error" severity="error" sx={{ mb: 1.5 }}>{deleteError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            {isItalian
              ? 'L’avviso verrà rimosso e non sarà più mostrato ai destinatari.'
              : 'The announcement will be removed and will no longer be shown to recipients.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button data-testid="button-cancel-delete-announcement" onClick={() => setAnnouncementToDelete(null)} disabled={deleting}>{isItalian ? 'Annulla' : 'Cancel'}</Button>
          <Button data-testid="button-confirm-delete-announcement" color="error" variant="contained" onClick={confirmDelete} disabled={deleting} startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}>
            {isItalian ? 'Elimina' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
