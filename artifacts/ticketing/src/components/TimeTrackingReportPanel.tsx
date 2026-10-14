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
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AccessTime, ArrowOutward, Groups2, ReceiptLong, RestartAlt } from '@mui/icons-material';
import {
  getGetTimeTrackingReportQueryKey,
  getListClientsQueryKey,
  getListUsersQueryKey,
  useGetTimeTrackingReport,
  useListClients,
  useListUsers,
} from '@workspace/api-client-react';
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
}: {
  rows: TimeTrackingReportRow[];
  lang: string;
  labels: { ticket: string; billed: string; unbilled: string; manual: string; session: string };
  emptyLabel: string;
  testPrefix: string;
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
            data-testid={`status-billing-${row.ticketId}-${testPrefix}-${index}`}
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
  const isItalian = lang === 'it';
  const copy = isItalian
    ? {
        title: 'Rendiconto ore',
        intro: 'Una vista chiara del tempo registrato, fatturabile ai clienti e riconoscibile ai collaboratori.',
        from: 'Dal',
        to: 'Al',
        client: 'Cliente',
        collaborator: 'Collaboratore',
        allClients: 'Tutti i clienti',
        allCollaborators: 'Tutti i collaboratori',
        clear: 'Azzera filtri',
        customerTitle: 'Tempo fatturabile ai clienti',
        customerHint: 'Tempo registrato per i clienti, con stato di fatturazione.',
        collaboratorTitle: 'Tempo riconoscibile ai collaboratori',
        collaboratorHint: 'Tempo idoneo al riconoscimento del collaboratore.',
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
      }
    : {
        title: 'Hours report',
        intro: 'A clear view of tracked time, billable to customers and recognizable to collaborators.',
        from: 'From',
        to: 'To',
        client: 'Customer',
        collaborator: 'Collaborator',
        allClients: 'All customers',
        allCollaborators: 'All collaborators',
        clear: 'Clear filters',
        customerTitle: 'Customer-billable time',
        customerHint: 'Time recorded for customers, with billing status.',
        collaboratorTitle: 'Collaborator-recognizable time',
        collaboratorHint: 'Time eligible for collaborator recognition.',
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

  const reportQuery = useGetTimeTrackingReport(params, {
    query: { queryKey: getGetTimeTrackingReportQueryKey(params), enabled: true },
  });
  const clientsQuery = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey(), staleTime: 60_000 },
  });
  const usersQuery = useListUsers({
    query: { queryKey: getListUsersQueryKey(), staleTime: 60_000 },
  });
  const report = reportQuery.data;
  const totals = report?.totals;
  const hasData = Boolean(report && (report.customerRows.length || report.collaboratorRows.length));
  const hasFilters = Boolean(dateFrom || dateTo || clientId || collaboratorId);
  const labels = { ticket: copy.ticket, billed: copy.billed, unbilled: copy.unbilled, manual: copy.manual, session: copy.session };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setClientId('');
    setCollaboratorId('');
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
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={copy.from}
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
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
              onChange={(event) => setDateTo(event.target.value)}
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
              {(clientsQuery.data ?? []).map((client) => (
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
              {(usersQuery.data ?? []).map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>{user.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        {(clientsQuery.isError || usersQuery.isError) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {isItalian ? 'Alcune opzioni filtro non sono disponibili.' : 'Some filter options are unavailable.'}
          </Typography>
        )}
      </Box>

      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
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
              <Grid container spacing={1.25} sx={{ mb: 2.5 }}>
                <Grid item xs={6} md={3}>
                  <Metric label={copy.billable} value={formatDuration(totals.clientBillableMinutes, lang)} testId="metric-client-billable-minutes" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Metric label={copy.billed} value={formatDuration(totals.clientBilledMinutes, lang)} accent="success.main" testId="metric-client-billed-minutes" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Metric label={copy.unbilled} value={formatDuration(totals.clientUnbilledMinutes, lang)} accent="warning.dark" testId="metric-client-unbilled-minutes" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Metric label={copy.recognizable} value={formatDuration(totals.collaboratorRecognizableMinutes, lang)} accent="secondary.main" testId="metric-collaborator-recognizable-minutes" />
                </Grid>
              </Grid>
            )}

            {!hasData && hasFilters && (
              <Alert severity="info" sx={{ mb: 2 }} data-testid="status-time-report-no-results">{copy.noResults}</Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} lg={7}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                  <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.25}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} data-testid="text-customer-report-heading">{copy.customerTitle}</Typography>
                        <Typography variant="caption" color="text.secondary">{copy.customerHint}</Typography>
                      </Box>
                      <Chip size="small" icon={<ReceiptLong />} label={formatDuration(totals?.clientBillableMinutes ?? 0, lang)} color="primary" variant="outlined" />
                    </Stack>
                    <ReportRows rows={report?.customerRows ?? []} lang={lang} labels={labels} emptyLabel={copy.noCustomerRows} testPrefix="customer" />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} lg={5}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 2, borderColor: 'divider' }}>
                  <CardContent sx={{ p: { xs: 1.75, sm: 2.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={0.25}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} data-testid="text-collaborator-report-heading">{copy.collaboratorTitle}</Typography>
                        <Typography variant="caption" color="text.secondary">{copy.collaboratorHint}</Typography>
                      </Box>
                      <Chip size="small" icon={<Groups2 />} label={formatDuration(totals?.collaboratorRecognizableMinutes ?? 0, lang)} color="secondary" variant="outlined" />
                    </Stack>
                    <ReportRows rows={report?.collaboratorRows ?? []} lang={lang} labels={labels} emptyLabel={copy.noCollaboratorRows} testPrefix="collaborator" />
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
