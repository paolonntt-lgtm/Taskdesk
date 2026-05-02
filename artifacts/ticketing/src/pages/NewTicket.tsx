import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem } from '@mui/material';
import { useCreateTicket, useListUsers, getListTicketsQueryKey } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = [
  'PC',
  'Stampante',
  'Internet / Rete',
  'Software',
  'Telefonia',
  'Cassa / Gestionale',
  'Altro',
];

const LOCATIONS = ['Sede A', 'Sede B', 'Sede C'];

export default function NewTicket() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createTicket = useCreateTicket();
  const { data: users } = useListUsers();
  const { user: currentUser } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'PC',
    location: currentUser?.mainLocation || '',
    resource: '',
    priority: 'medium',
    assignedTo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createTicket.mutateAsync({
        data: {
          ...formData,
          assignedTo: formData.assignedTo ? parseInt(formData.assignedTo) : undefined,
          priority: formData.priority as any,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      setLocation(`/tickets/${result.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box maxWidth={800} mx="auto">
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Apri Nuovo Ticket
      </Typography>

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Titolo"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Descrivi brevemente il problema..."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descrizione dettagliata"
                  required
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrivi il problema nel dettaglio, quando è iniziato, cosa hai già provato..."
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Categoria"
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Sede"
                  required
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                >
                  {LOCATIONS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Risorsa (dispositivo, software, ecc.)"
                  value={formData.resource}
                  onChange={e => setFormData({ ...formData, resource: e.target.value })}
                  placeholder="Es: stampante reception, PC banco cassa..."
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Priorità"
                  required
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <MenuItem value="low">Bassa</MenuItem>
                  <MenuItem value="medium">Media</MenuItem>
                  <MenuItem value="high">Alta</MenuItem>
                  <MenuItem value="urgent">Urgente</MenuItem>
                </TextField>
              </Grid>

              {currentUser?.role === 'admin' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Assegna a"
                    value={formData.assignedTo}
                    onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                  >
                    <MenuItem value=""><em>Non assegnato</em></MenuItem>
                    {users?.map(u => (
                      <MenuItem key={u.id} value={u.id.toString()}>{u.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}

              <Grid item xs={12} display="flex" justifyContent="flex-end" gap={2} mt={2}>
                <Button variant="outlined" onClick={() => setLocation('/tickets')}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={createTicket.isPending}
                >
                  {createTicket.isPending ? 'Creazione...' : 'Crea Ticket'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
