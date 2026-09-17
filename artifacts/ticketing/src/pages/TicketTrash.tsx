import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DeleteForever as DeleteForeverIcon,
  DeleteSweep as DeleteSweepIcon,
  RestoreFromTrash as RestoreFromTrashIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

interface TrashTicket {
  id: number;
  ticketNumber?: number | null;
  title: string;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt: string;
  deletedAt: string;
}

type PendingAction =
  | { type: 'restore' | 'permanent'; ticket: TrashTicket }
  | null;

const trashQueryKey = ['ticket-trash'];

async function fetchTrash(): Promise<TrashTicket[]> {
  const response = await fetch('/api/tickets/trash', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load the ticket trash');
  return response.json();
}

async function runTrashAction({ type, id }: { type: 'restore' | 'permanent'; id: number }) {
  const response = await fetch(`/api/tickets/${id}${type === 'restore' ? '/restore' : '/permanent'}`, {
    method: type === 'restore' ? 'POST' : 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || 'Operation failed');
  }
}

function formatDate(value: string, lang: string) {
  return new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function daysUntil(value: string) {
  const expiry = new Date(value).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function TicketTrash() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const trash = useQuery({ queryKey: trashQueryKey, queryFn: fetchTrash });
  const action = useMutation({
    mutationFn: runTrashAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trashQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] }),
      ]);
      setPendingAction(null);
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const tickets = trash.data ?? [];
  const copy = useMemo(() => lang === 'en'
    ? {
        title: 'Ticket trash',
        subtitle: 'Deleted tickets remain recoverable for 30 days.',
        empty: 'The trash is empty.',
        deleted: 'Deleted',
        expires: 'Permanent deletion in',
        days: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
        restore: 'Restore',
        permanent: 'Delete permanently',
        restoreTitle: 'Restore ticket?',
        permanentTitle: 'Delete ticket permanently?',
        restoreText: 'The ticket and all its comments, notes and attachments will become available again.',
        permanentText: 'This action permanently deletes the ticket and all its comments, notes, attachments and activity history. It cannot be undone.',
        cancel: 'Cancel',
        confirmRestore: 'Restore',
        confirmPermanent: 'Delete permanently',
        loadError: 'Could not load the ticket trash.',
        retry: 'Retry',
      }
    : {
        title: 'Cestino ticket',
        subtitle: 'I ticket eliminati restano recuperabili per 30 giorni.',
        empty: 'Il cestino è vuoto.',
        deleted: 'Eliminato',
        expires: 'Eliminazione definitiva tra',
        days: (n: number) => `${n} giorn${n === 1 ? 'o' : 'i'}`,
        restore: 'Ripristina',
        permanent: 'Elimina definitivamente',
        restoreTitle: 'Ripristinare il ticket?',
        permanentTitle: 'Eliminare il ticket definitivamente?',
        restoreText: 'Il ticket e tutti i suoi commenti, note e allegati torneranno disponibili.',
        permanentText: 'Il ticket e tutti i suoi commenti, note, allegati e storico attività verranno eliminati definitivamente. Non è possibile annullare questa operazione.',
        cancel: 'Annulla',
        confirmRestore: 'Ripristina',
        confirmPermanent: 'Elimina definitivamente',
        loadError: 'Impossibile caricare il cestino ticket.',
        retry: 'Riprova',
      }, [lang]);

  const confirmAction = () => {
    if (!pendingAction) return;
    setActionError(null);
    action.mutate({ type: pendingAction.type, id: pendingAction.ticket.id });
  };

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', p: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 750, display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteSweepIcon color="action" /> {copy.title}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            {copy.subtitle}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', pt: 1 }}>
          {tickets.length}
        </Typography>
      </Box>

      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}
      {trash.isError && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => trash.refetch()}>{copy.retry}</Button>} sx={{ mb: 2 }}>
          {copy.loadError}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {trash.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : tickets.length === 0 ? (
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <DeleteSweepIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">{copy.empty}</Typography>
          </CardContent>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{lang === 'en' ? 'Title' : 'Titolo'}</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{copy.deleted}</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{copy.expires}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {tickets.map((ticket) => {
                  const days = daysUntil(ticket.deletedAt);
                  return (
                    <TableRow key={ticket.id} hover>
                      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {ticket.ticketNumber ?? ticket.id}
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>{ticket.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ticket.category || (lang === 'en' ? 'No category' : 'Nessuna categoria')}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{formatDate(ticket.deletedAt, lang)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {copy.days(days)} {lang === 'en' ? 'remaining' : 'rimanenti'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{formatDate(new Date(new Date(ticket.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), lang)}</Typography>
                        <Typography variant="caption" color={days <= 3 ? 'error.main' : 'text.secondary'}>
                          {copy.days(days)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={copy.restore}>
                          <IconButton color="primary" onClick={() => setPendingAction({ type: 'restore', ticket })} aria-label={copy.restore}>
                            <RestoreFromTrashIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={copy.permanent}>
                          <IconButton color="error" onClick={() => setPendingAction({ type: 'permanent', ticket })} aria-label={copy.permanent}>
                            <DeleteForeverIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>

      <Dialog open={pendingAction != null} onClose={() => !action.isPending && setPendingAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {pendingAction?.type === 'restore' ? copy.restoreTitle : copy.permanentTitle}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {pendingAction?.type === 'restore' ? copy.restoreText : copy.permanentText}
          </Typography>
          {pendingAction && (
            <Typography sx={{ mt: 1.5, fontWeight: 650 }}>
              #{pendingAction.ticket.ticketNumber ?? pendingAction.ticket.id} — {pendingAction.ticket.title}
            </Typography>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setPendingAction(null)} disabled={action.isPending} color="inherit">{copy.cancel}</Button>
          <Button
            variant="contained"
            color={pendingAction?.type === 'restore' ? 'primary' : 'error'}
            onClick={confirmAction}
            disabled={action.isPending}
            startIcon={action.isPending ? <CircularProgress size={16} color="inherit" /> : pendingAction?.type === 'restore' ? <RestoreFromTrashIcon /> : <DeleteForeverIcon />}
          >
            {pendingAction?.type === 'restore' ? copy.confirmRestore : copy.confirmPermanent}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}