import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Person, Group, SmartToy } from '@mui/icons-material';
import { useCreateTicket, useListUsers, useSaveTicketAttachment, getListTicketsQueryKey } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RichCommentEditor, type PendingAttachment } from '../components/RichCommentEditor';
import BotDialog from '../components/BotDialog';

export default function NewTicket() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const createTicket = useCreateTicket();
  const saveAttachment = useSaveTicketAttachment();
  const { data: users } = useListUsers();
  const { user: currentUser } = useAuth();

  const [botOpen, setBotOpen] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'user' | 'group'>('user');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: currentUser?.mainLocation || '',
    resource: '',
    priority: 'medium',
    assignedTo: '',
    assignedToGroup: '',
  });

  useEffect(() => {
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const cats = d.value ?? [];
        setCategories(cats);
        if (!formData.category && cats.length > 0) setFormData((f) => ({ ...f, category: cats[0] }));
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
  }, []);

  const singleLocation = locations.length === 1;

  const handleBotCreateTicket = (title: string, description: string) => {
    setFormData((f) => ({ ...f, title, description }));
    setBotOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createTicket.mutateAsync({
        data: {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          location: formData.location || undefined,
          resource: formData.resource || undefined,
          priority: formData.priority as any,
          assignedTo: assignMode === 'user' && formData.assignedTo ? parseInt(formData.assignedTo) : null,
          assignedToGroup: assignMode === 'group' && formData.assignedToGroup ? formData.assignedToGroup : null,
        },
      });
      for (const att of pendingAttachments) {
        await saveAttachment.mutateAsync({ id: result.id, data: { ...att, commentId: null } });
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
        {t.newTicket.title}
      </Typography>

      {!botOpen && (
        <Box mb={2} display="flex" justifyContent="flex-end">
          <Button
            variant="outlined"
            size="small"
            startIcon={<SmartToy />}
            onClick={() => setBotOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Chiedi a TaskBot
          </Button>
        </Box>
      )}

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
                        {users?.map(u => (
                          <MenuItem key={u.id} value={u.id.toString()}>{u.name}</MenuItem>
                        ))}
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
                  {createTicket.isPending ? t.newTicket.creating : t.newTicket.create}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
      <BotDialog
        open={botOpen}
        onClose={() => setBotOpen(false)}
        onCreateTicket={handleBotCreateTicket}
      />
    </Box>
  );
}
