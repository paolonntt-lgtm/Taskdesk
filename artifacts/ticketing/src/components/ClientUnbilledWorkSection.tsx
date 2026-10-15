import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { ReceiptLong } from '@mui/icons-material';
import {
  getGetClientQueryKey,
  getGetTimeTrackingReportQueryKey,
  getListClientsQueryKey,
  useGetTimeTrackingReport,
  useUpdateTimeTrackingClientBillingStatus,
} from '@workspace/api-client-react';
import type { TimeTrackingReportRow } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

type Ticket = {
  id: number;
  ticketNumber?: number | null;
  title?: string | null;
  workedMinutes?: number | null;
  workedBillingStatus?: 'billed' | 'unbilled' | null;
  closedAt?: string | Date | null;
};

type WorkItem = {
  ticketId: number;
  ticketNumber: number | null;
  title: string;
  date: string | null;
  durationMinutes: number;
};

function formatDuration(minutes: number, isItalian: boolean): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return isItalian ? `${remainder} min` : `${remainder} min`;
  if (!remainder) return isItalian ? `${hours} h` : `${hours} hr`;
  return isItalian ? `${hours} h ${remainder} min` : `${hours} hr ${remainder} min`;
}

export default function ClientUnbilledWorkSection({
  clientId,
  tickets,
  isAdmin,
}: {
  clientId: number;
  tickets: Ticket[];
  isAdmin: boolean;
}) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const isItalian = lang === 'it';
  const settings = useQuery<{ timeTrackingModuleEnabled?: boolean; workedTimeEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });
  const trackingEnabled = settings.data?.timeTrackingModuleEnabled === true;
  const report = useGetTimeTrackingReport(
    { clientId },
    {
      query: {
        queryKey: getGetTimeTrackingReportQueryKey({ clientId }),
        enabled: isAdmin && trackingEnabled,
      },
    },
  );
  const updateBilling = useUpdateTimeTrackingClientBillingStatus();

  const items = useMemo<WorkItem[]>(() => {
    if (trackingEnabled) {
      const grouped = new Map<number, WorkItem>();
      for (const row of (report.data?.customerRows ?? []) as TimeTrackingReportRow[]) {
        if (row.billingStatus !== 'unbilled' || row.clientId !== clientId) continue;
        const current = grouped.get(row.ticketId);
        if (current) {
          current.durationMinutes += row.durationMinutes;
          if (row.date && (!current.date || row.date < current.date)) current.date = row.date;
        } else {
          grouped.set(row.ticketId, {
            ticketId: row.ticketId,
            ticketNumber: row.ticketNumber,
            title: row.title,
            date: row.date ?? null,
            durationMinutes: row.durationMinutes,
          });
        }
      }
      return [...grouped.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    }

    if (settings.data?.workedTimeEnabled === false) return [];
    return tickets
      .filter((ticket) =>
        ticket.closedAt != null
        && typeof ticket.workedMinutes === 'number'
        && ticket.workedMinutes > 0
        && ticket.workedBillingStatus !== 'billed',
      )
      .map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber ?? null,
        title: ticket.title ?? '',
        date: ticket.closedAt ? new Date(ticket.closedAt).toISOString() : null,
        durationMinutes: ticket.workedMinutes!,
      }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [report.data, settings.data?.workedTimeEnabled, tickets, trackingEnabled]);

  if (!isAdmin) return null;

  const loading = settings.isLoading || (trackingEnabled && report.isLoading);
  const error = settings.isError || (trackingEnabled && report.isError);
  const totalMinutes = items.reduce((total, item) => total + item.durationMinutes, 0);
  const labels = isItalian
    ? {
        heading: 'Da fatturare',
        intro: 'Ore fatturabili al cliente ancora non segnate come fatturate.',
        empty: 'Nessuna ora da fatturare per questo cliente.',
        error: 'Impossibile caricare le ore da fatturare.',
        ticket: 'Ticket',
        markBilled: 'Segna fatturato',
        busy: 'Aggiornamento…',
        retry: 'Riprova',
        wholeTicket: 'Lo stato di fatturazione vale per tutto il ticket.',
      }
    : {
        heading: 'Unbilled work',
        intro: 'Customer-billable hours not yet marked as billed.',
        empty: 'There are no unbilled hours for this customer.',
        error: 'Could not load unbilled hours.',
        ticket: 'Ticket',
        markBilled: 'Mark as billed',
        busy: 'Updating…',
        retry: 'Try again',
        wholeTicket: 'Billing status applies to the whole ticket.',
      };

  const markBilled = (ticketId: number) => {
    updateBilling.mutate(
      { data: { ticketId, status: 'billed' } },
      {
        onSuccess: () => Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetTimeTrackingReportQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) }),
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() }),
        ]),
      },
    );
  };

  return (
    <Box mt={3} data-testid="client-unbilled-work-section">
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <ReceiptLong fontSize="small" color="action" />
        <Typography variant="subtitle1" fontWeight={700}>{labels.heading}</Typography>
        {!loading && (!error || items.length > 0) && (
          <Chip
            size="small"
            color={items.length ? 'warning' : 'default'}
            variant={items.length ? 'filled' : 'outlined'}
            label={formatDuration(totalMinutes, isItalian)}
            data-testid="client-unbilled-work-total"
          />
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
        {labels.intro} {labels.wholeTicket}
      </Typography>

      {updateBilling.isError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {isItalian ? 'Impossibile aggiornare lo stato di fatturazione.' : 'Could not update the billing status.'}
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void settings.refetch();
                if (trackingEnabled) void report.refetch();
              }}
            >
              {labels.retry}
            </Button>
          }
        >
          {labels.error}
          {items.length > 0 && (isItalian
            ? ' Sono mostrate le ultime informazioni disponibili.'
            : ' Showing the last available information.')}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={2}><CircularProgress size={22} /></Box>
      ) : error && items.length === 0 ? null : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" py={1}>{labels.empty}</Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {items.map((item) => (
            <Stack
              key={item.ticketId}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              spacing={1}
              py={1}
              data-testid={`client-unbilled-work-ticket-${item.ticketId}`}
            >
              <Box minWidth={0}>
                <Link href={`/tickets/${item.ticketId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ '&:hover': { color: 'primary.main' } }}>
                    {labels.ticket} #{item.ticketNumber ?? item.ticketId}{item.title ? ` · ${item.title}` : ''}
                  </Typography>
                </Link>
                <Typography variant="caption" color="text.secondary">
                  {item.date ? new Date(item.date).toLocaleDateString(isItalian ? 'it-IT' : 'en-GB') : ''}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" fontWeight={700} whiteSpace="nowrap">
                  {formatDuration(item.durationMinutes, isItalian)}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => markBilled(item.ticketId)}
                  disabled={updateBilling.isPending}
                  data-testid={`button-mark-client-ticket-billed-${item.ticketId}`}
                >
                  {updateBilling.isPending ? labels.busy : labels.markBilled}
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
