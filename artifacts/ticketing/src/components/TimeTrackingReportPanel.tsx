import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AccessTime, ArrowBackIosNew, ArrowForwardIos, ArrowOutward, Groups2, ReceiptLong, RestartAlt } from '@mui/icons-material';
import {
  getGetTimeTrackingReportQueryKey,
  useUpdateCollaboratorInvoiceStatus,
  useUpdateTimeTrackingClientBillingStatus,
  useGetTimeTrackingReport,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { GetTimeTrackingReportParams, TimeTrackingReportRow } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

function formatDuration(totalMinutes: number, lang: string): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (lang === 'it') {
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatDate(value: string, lang: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function ReportRows({
  rows,
  lang,
  labels,
  emptyLabel,
  testPrefix,
  onToggleBilling,
  onToggleInvoice,
  busy = false,
}: {
  rows: TimeTrackingReportRow[];
  lang: string;
  labels: { ticket: string; billed: string; unbilled: string; manual: string; session: string };
  emptyLabel: string;
  testPrefix: string;
  onToggleBilling?: (row: TimeTrackingReportRow) => void;
  onToggleInvoice?: (row: TimeTrackingReportRow) => void;
  busy?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Box
        data-testid={`empty-${testPrefix}`}
        sx={{
          textAlign: 'center',
          py: 4,
          px: 2,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.default',
        }}
      >
        <AccessTime sx={{ color: 'text.disabled', mb: 0.75 }} />
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Stack divider={<Divider flexItem />} data-testid={`list-${testPrefix}`}>
      {rows.map((row, index) => (
        <Box
          key={`${row.ticketId}-${row.date}-${row.kind}-${index}`}
          data-testid={`row-${testPrefix}-${row.ticketId}-${index}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(0, 1fr) auto auto' },
            alignItems: 'center',
            gap: { xs: 0.75, sm: 2 },
            py: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Link
              href={`/tickets/${row.ticketId}`}
              data-testid={`link-ticket-${row.ticketId}-${testPrefix}-${index}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: 'inherit',
                textDecoration: 'none',
                maxWidth: '100%',
              }}
            >
              <Typography
                component="span"
                variant="body2"
                fontWeight={700}
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { color: 'primary.main' } }}
              >
                <Box component="span" sx={{ color: 'text.secondary', mr: 0.75 }}>
                  {row.ticketNumber != null ? `#${row.ticketNumber}` : `#${row.ticketId}`}
                </Box>
                {row.title}
              </Typography>
              <ArrowOutward sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            </Link>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" data-testid={`text-date-${row.ticketId}-${testPrefix}-${index}`}>
                {formatDate(row.date, lang)}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.secondary">
                {row.kind === 'manual' ? labels.manual : labels.session}
              </Typography>
              {row.clientName && testPrefix === 'customer' && (
                <>
                  <Typography variant="caption" color="text.disabled">·</Typography>
                  <Typography variant="caption" color="text.secondary">{row.clientName}</Typography>
                </>
              )}
              {row.collaboratorName && testPrefix === 'collaborator' && (
                <>
                  <Typography variant="caption" color="text.disabled">·</Typography>
                  <Typography variant="caption" color="text.secondary">{row.collaboratorName}</Typography>
                </>
              )}
            </Stack>
          </Box>
          {testPrefix === 'customer' && <Chip
            size="small"
            icon={<ReceiptLong sx={{ fontSize: '16px !important' }} />}
            label={row.billingStatus === 'billed' ? labels.billed : labels.unbilled}
            color={row.billingStatus === 'billed' ? 'success' : 'warning'}
            variant="outlined"
            onClick={() => onToggleBilling?.(row)}
            clickable={Boolean(onToggleBilling)}
            disabled={busy}
            title={onToggleBilling ? (lang === 'it' ? 'Cambia stato fatturazione per tutto il ticket' : 'Change billing status for the whole ticket') : undefined}
            data-testid={`status-billing-${row.ticketId}-${testPrefix}-${index}`}
            sx={{ gridColumn: { xs: 1, sm: 2 }, gridRow: { xs: 2, sm: 1 }, width: 'fit-content' }}
          />}
          {testPrefix === 'collaborator' && row.collaboratorId != null && <Chip
            size="small"
            label={row.collaboratorInvoiceReceived ? (lang === 'it' ? 'Fattura ricevuta' : 'Invoice received') : (lang === 'it' ? 'Fattura da ricevere' : 'Invoice pending')}
            color={row.collaboratorInvoiceReceived ? 'success' : 'default'}
            variant="outlined"
            onClick={() => onToggleInvoice?.(row)}
            clickable={Boolean(onToggleInvoice)}
            disabled={busy}
            data-testid={`status-invoice-${row.ticketId}-${row.collaboratorId}-${index}`}
            sx={{ gridColumn: { xs: 1, sm: 2 }, gridRow: { xs: 2, sm: 1 }, width: 'fit-content' }}
          />}
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ whiteSpace: 'nowrap', gridColumn: { xs: 2, sm: 3 }, gridRow: { xs: 1, sm: 1 } }}
            data-testid={`value-duration-${row.ticketId}-${testPrefix}-${index}`}
          >
            {formatDuration(row.durationMinutes, lang)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function Metric({
  label,
  value,
  accent = 'primary.main',
  testId,
}: {
  label: string;
  value: string;
  accent?: string;
  testId: string;
}) {
  return (
    <Box
      data-testid={testId}
      sx={{
        p: { xs: 1.5, sm: 2 },
        height: '100%',
        borderRadius: 2,
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.6 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={accent} sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function TimeTrackingReportPanel() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const billingMutation = useUpdateTimeTrackingClientBillingStatus();
  const invoiceMutation = useUpdateCollaboratorInvoiceStatus();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const isItalian = lang === 'it';
  const copy = isItalian
    ? {
        title: 'Rendiconto ore',
        intro: 'Consulta separatamente le ore fatturabili ai clienti e quelle riconoscibili ai collaboratori.',
        from: 'Dal',
        to: 'Al',
        client: 'Cliente',
        collaborator: 'Collaboratore',
        allClients: 'Tutti i clienti',
        allCollaborators: 'Tutti i collaboratori',
        clear: 'Azzera filtri',
        customerTitle: 'Tempo fatturabile ai clienti',
        customerHint: 'Sessioni e inserimenti manuali inclusi nel totale fatturabile.',
        collaboratorTitle: 'Tempo riconoscibile ai collaboratori',
        collaboratorHint: 'Sessioni e inserimenti manuali inclusi nel totale riconoscibile.',
        billedScope: 'Fatturato/Da fatturare vale per l’intero ticket, anche fuori dal periodo selezionato.',
        invoiceScope: 'La ricezione della fattura è separata dal totale delle ore riconoscibili.',
        billable: 'Fatturabile',
        billed: 'Fatturato',
        unbilled: 'Da fatturare',
        recognizable: 'Riconoscibile',
        noCustomerRows: 'Nessun tempo fatturabile nel periodo selezionato.',
        noCollaboratorRows: 'Nessun tempo riconoscibile nel periodo selezionato.',
        noResults: 'Nessun dato corrisponde ai filtri. Prova a modificare il periodo o i criteri.',
        errorTitle: 'Impossibile caricare il report',
        errorText: 'Si è verificato un problema durante il recupero dei dati. Riprova.',
        retry: 'Riprova',
        loading: 'Caricamento report',
        ticket: 'Ticket',
        manual: 'Inserimento manuale',
        session: 'Sessione timer',
        month: 'Mese',
        invoiceReceived: 'Fattura ricevuta',
      }
    : {
        title: 'Time report',
        intro: 'Review customer-billable time and collaborator-recognizable time as separate totals.',
        from: 'From',
        to: 'To',
        client: 'Customer',
        collaborator: 'Collaborator',
        allClients: 'All customers',
        allCollaborators: 'All collaborators',
        clear: 'Clear filters',
        customerTitle: 'Customer-billable time',
        customerHint: 'Timer sessions and manual entries included in the billable total.',
        collaboratorTitle: 'Collaborator-recognizable time',
        collaboratorHint: 'Timer sessions and manual entries included in the recognizable total.',
        billedScope: 'Billed/Unbilled applies to the whole ticket, including time outside this period.',
        invoiceScope: 'Invoice receipt is tracked separately from the recognizable-hours total.',
        billable: 'Billable',
        billed: 'Billed',
        unbilled: 'Unbilled',
        recognizable: 'Recognizable',
        noCustomerRows: 'No customer-billable time in the selected period.',
        noCollaboratorRows: 'No collaborator-recognizable time in the selected period.',
        noResults: 'Nothing matches these filters. Try changing the date range or selection.',
        errorTitle: 'Could not load the report',
        errorText: 'There was a problem retrieving the report. Please try again.',
        retry: 'Try again',
        loading: 'Loading report',
        ticket: 'Ticket',
        manual: 'Manual entry',
        session: 'Timer session',
        month: 'Month',
        invoiceReceived: 'Invoice received',
      };

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientId, setClientId] = useState('');
  const [collaboratorId, setCollaboratorId] = useState('');
  const params = useMemo<GetTimeTrackingReportParams>(() => ({
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(clientId ? { clientId: Number(clientId) } : {}),
    ...(collaboratorId ? { collaboratorId: Number(collaboratorId) } : {}),
  }), [dateFrom, dateTo, clientId, collaboratorId]);
  const periodParams = useMemo<GetTimeTrackingReportParams>(() => ({
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [dateFrom, dateTo]);

  const reportQuery = useGetTimeTrackingReport(params, {
    query: { queryKey: getGetTimeTrackingReportQueryKey(params), enabled: true },
  });
  const periodReportQuery = useGetTimeTrackingReport(periodParams, {
    query: { queryKey: getGetTimeTrackingReportQueryKey(periodParams), enabled: true },
  });
  const report = reportQuery.data;
  const totals = report?.totals;
  const hasData = Boolean(report && (report.customerRows.length || report.collaboratorRows.length));
  const hasFilters = Boolean(dateFrom || dateTo || clientId || collaboratorId);
  const availableClients = useMemo(() => {
    const clients = new Map<number, string>();
    for (const row of periodReportQuery.data?.customerRows ?? []) {
      if (row.clientId != null && row.clientName) clients.set(row.clientId, row.clientName);
    }
    return [...clients].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, isItalian ? 'it' : 'en'));
  }, [periodReportQuery.data, isItalian]);
  const availableCollaborators = useMemo(() => {
    const collaborators = new Map<number, string>();
    for (const row of periodReportQuery.data?.collaboratorRows ?? []) {
      if (row.collaboratorId != null && row.collaboratorName) collaborators.set(row.collaboratorId, row.collaboratorName);
    }
    return [...collaborators].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, isItalian ? 'it' : 'en'));
  }, [periodReportQuery.data, isItalian]);
  const labels = { ticket: copy.ticket, billed: copy.billed, unbilled: copy.unbilled, manual: copy.manual, session: copy.session };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setClientId('');
    setCollaboratorId('');
    setSelectedMonth(null);
  };
  const selectMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    setSelectedMonth(`${year}-${String(month + 1).padStart(2, '0')}`);
    setDateFrom(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    setDateTo(`${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`);
    setClientId('');
    setCollaboratorId('');
  };
  const moveMonth = (delta: number) => {
    const current = selectedMonth ? new Date(`${selectedMonth}-01T12:00:00`) : new Date();
    current.setMonth(current.getMonth() + delta);
    selectMonth(current);
  };
  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(isItalian ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' })
    : null;
  const refreshReport = () => queryClient.invalidateQueries({ queryKey: getGetTimeTrackingReportQueryKey() });
  const toggleBilling = (row: TimeTrackingReportRow) => {
    billingMutation.mutate({ data: { ticketId: row.ticketId, status: row.billingStatus === 'billed' ? 'unbilled' : 'billed' } }, { onSuccess: refreshReport });
  };
  const toggleInvoice = (row: TimeTrackingReportRow) => {
    if (row.collaboratorId == null) return;
    invoiceMutation.mutate({ data: { ticketId: row.ticketId, collaboratorId: row.collaboratorId, invoiceReceived: !row.collaboratorInvoiceReceived } }, { onSuccess: refreshReport });
  };

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderRadius: 2.5,
        borderColor: 'divider',
        boxShadow: '0 8px 26px rgba(42, 62, 80, 0.055)',
      }}
      data-testid="panel-time-tracking-report"
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 2.5, sm: 3 },
          pb: 2.25,
          background: 'linear-gradient(115deg, rgba(220, 237, 232, 0.6), rgba(246, 248, 245, 0.35) 58%, transparent)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <AccessTime fontSize="small" />
              </Box>
              <Typography variant="h6" fontWeight={800} data-testid="text-time-report-title">{copy.title}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>{copy.intro}</Typography>
          </Box>
          {hasFilters && (
            <Button
              size="small"
              color="inherit"
              startIcon={<RestartAlt fontSize="small" />}
              onClick={resetFilters}
              data-testid="button-clear-time-report-filters"
              sx={{ color: 'text.secondary', flexShrink: 0 }}
            >
              {copy.clear}
            </Button>
          )}
        </Stack>
        <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
          <Grid item xs={12}>
            <Stack direction="row" alignItems="center" justifyContent="center" gap={1}>
              <IconButton size="small" aria-label={isItalian ? 'Mese precedente' : 'Previous month'} onClick={() => moveMonth(-1)} data-testid="button-report-previous-month"><ArrowBackIosNew fontSize="small" /></IconButton>
              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 150, textAlign: 'center' }}>
                {monthLabel ?? (isItalian ? 'Tutti i periodi' : 'All dates')}
              </Typography>
              <IconButton size="small" aria-label={isItalian ? 'Mese successivo' : 'Next month'} onClick={() => moveMonth(1)} data-testid="button-report-next-month"><ArrowForwardIos fontSize="small" /></IconButton>
              {!selectedMonth && <Button size="small" onClick={() => selectMonth(new Date())}>{isItalian ? 'Questo mese' : 'This month'}</Button>}
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={copy.from}
              value={dateFrom}
              onChange={(event) => { setSelectedMonth(null); setDateFrom(event.target.value); setClientId(''); setCollaboratorId(''); }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'data-testid': 'input-report-date-from' }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={copy.to}
              value={dateTo}
              onChange={(event) => { setSelectedMonth(null); setDateTo(event.target.value); setClientId(''); setCollaboratorId(''); }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'data-testid': 'input-report-date-to' }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              size="small"
              label={copy.client}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              inputProps={{ 'data-testid': 'select-report-client' }}
            >
              <MenuItem value="">{copy.allClients}</MenuItem>
              {availableClients.map((client) => (
                <MenuItem key={client.id} value={String(client.id)}>{client.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              size="small"
              label={copy.collaborator}
              value={collaboratorId}
              onChange={(event) => setCollaboratorId(event.target.value)}
              inputProps={{ 'data-testid': 'select-report-collaborator' }}
            >
              <MenuItem value="">{copy.allCollaborators}</MenuItem>
              {availableCollaborators.map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>{user.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        {periodReportQuery.isError && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {isItalian ? 'Non è stato possibile caricare le opzioni per il periodo selezionato.' : 'Could not load filter options for the selected period.'}
          </Typography>
        )}
      </Box>

      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {(billingMutation.isError || invoiceMutation.isError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {isItalian ? 'Impossibile aggiornare lo stato. Riprova.' : 'Could not update the status. Please try again.'}
          </Alert>
        )}
        {reportQuery.isLoading ? (
          <Stack gap={2} data-testid="status-time-report-loading" aria-label={copy.loading}>
            <Grid container spacing={1.5}>{[0, 1, 2, 3].map((item) => <Grid item xs={6} sm={3} key={item}><Skeleton variant="rounded" height={76} /></Grid>)}</Grid>
            <Skeleton variant="rounded" height={180} />
            <Skeleton variant="rounded" height={180} />
          </Stack>
        ) : reportQuery.isError ? (
          <Alert
            severity="error"
            data-testid="status-time-report-error"
            action={<Button color="inherit" size="small" onClick={() => reportQuery.refetch()} data-testid="button-retry-time-report">{copy.retry}</Button>}
          >
            <Typography variant="subtitle2" fontWeight={700}>{copy.errorTitle}</Typography>
            <Typography variant="body2">{copy.errorText}</Typography>
          </Alert>
        ) : (
          <>
            {totals && (
              <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12} md={7}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                    <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, '&:last-child': { pb: { xs: 1.75, sm: 2.25 } } }}>
                      <Stack direction="row" alignItems="center" gap={1.25} mb={1.5}>
                        <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 1.5, bgcolor: 'action.hover', color: 'primary.main', flexShrink: 0 }}>
                          <ReceiptLong fontSize="small" />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>{copy.customerTitle}</Typography>
                          <Typography variant="h5" fontWeight={800} color="primary.main" data-testid="metric-client-billable-minutes">
                            {formatDuration(totals.clientBillableMinutes, lang)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Metric label={copy.billed} value={formatDuration(totals.clientBilledMinutes, lang)} accent="success.main" testId="metric-client-billed-minutes" />
                        </Grid>
                        <Grid item xs={6}>
                          <Metric label={copy.unbilled} value={formatDuration(totals.clientUnbilledMinutes, lang)} accent="warning.dark" testId="metric-client-unbilled-minutes" />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                    <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, '&:last-child': { pb: { xs: 1.75, sm: 2.25 } } }}>
                      <Stack direction="row" alignItems="center" gap={1.25} mb={1}>
                        <Box sx={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 1.5, bgcolor: 'action.hover', color: 'secondary.main', flexShrink: 0 }}>
                          <Groups2 fontSize="small" />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>{copy.collaboratorTitle}</Typography>
                          <Typography variant="h5" fontWeight={800} color="secondary.main" data-testid="metric-collaborator-recognizable-minutes">
                            {formatDuration(totals.collaboratorRecognizableMinutes, lang)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{copy.invoiceScope}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {!hasData && hasFilters && (
              <Alert severity="info" sx={{ mb: 2 }} data-testid="status-time-report-no-results">{copy.noResults}</Alert>
            )}

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                  <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.25}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} data-testid="text-customer-report-heading">{copy.customerTitle}</Typography>
                        <Typography variant="caption" color="text.secondary">{copy.customerHint}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>{copy.billedScope}</Typography>
                    <ReportRows rows={report?.customerRows ?? []} lang={lang} labels={labels} emptyLabel={copy.noCustomerRows} testPrefix="customer" onToggleBilling={toggleBilling} busy={billingMutation.isPending} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                  <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.25}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} data-testid="text-collaborator-report-heading">{copy.collaboratorTitle}</Typography>
                        <Typography variant="caption" color="text.secondary">{copy.collaboratorHint}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>{copy.invoiceScope}</Typography>
                    <ReportRows rows={report?.collaboratorRows ?? []} lang={lang} labels={labels} emptyLabel={copy.noCollaboratorRows} testPrefix="collaborator" onToggleInvoice={toggleInvoice} busy={invoiceMutation.isPending} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
}
