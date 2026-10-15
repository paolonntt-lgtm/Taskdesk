import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AccessTime } from '@mui/icons-material';
import {
  getGetPersonalTimeTrackingReportQueryKey,
  useGetPersonalTimeTrackingReport,
} from '@workspace/api-client-react';
import type { GetPersonalTimeTrackingReportParams, PersonalTimeTrackingReportRow } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  canAccessPersonalTimeReport,
  scopePersonalTimeReportQueryKey,
} from '../lib/personalTimeReportAccess';
import { trackEvent } from '../lib/analytics';

function formatDuration(minutes: number, italian: boolean): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return italian ? `${hours} h` : `${hours} hr`;
  return italian ? `${hours} h ${remainder} min` : `${hours} hr ${remainder} min`;
}

function formatMonth(monthKey: string, italian: boolean): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(italian ? 'it-IT' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export default function PersonalTimeTrackingReportPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();
  const italian = lang === 'it';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const params = useMemo<GetPersonalTimeTrackingReportParams>(() => ({
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [dateFrom, dateTo]);
  const report = useGetPersonalTimeTrackingReport(params, {
    query: {
      queryKey: scopePersonalTimeReportQueryKey(
        getGetPersonalTimeTrackingReportQueryKey(params),
        user?.id,
      ),
      enabled: !!user && canAccessPersonalTimeReport(user.role),
    },
  });

  useEffect(() => {
    if (user && !canAccessPersonalTimeReport(user.role)) setLocation('/');
    if (report.error && [403, 404].includes(Number((report.error as any).status))) setLocation('/');
  }, [user?.role, report.error, setLocation]);

  const monthlyGroups = useMemo(() => {
    const months = new Map<string, {
      minutes: number;
      tickets: Map<number, {
        ticketNumber: number | null;
        title: string;
        minutes: number;
        rows: PersonalTimeTrackingReportRow[];
      }>;
    }>();
    for (const row of report.data?.rows ?? []) {
      const month = row.date.slice(0, 7);
      const monthGroup = months.get(month) ?? { minutes: 0, tickets: new Map() };
      monthGroup.minutes += row.durationMinutes;
      const ticket = monthGroup.tickets.get(row.ticketId);
      if (ticket) {
        ticket.minutes += row.durationMinutes;
        ticket.rows.push(row);
      } else {
        monthGroup.tickets.set(row.ticketId, {
          ticketNumber: row.ticketNumber,
          title: row.title,
          minutes: row.durationMinutes,
          rows: [row],
        });
      }
      months.set(month, monthGroup);
    }
    return [...months.entries()]
      .sort(([monthA], [monthB]) => monthB.localeCompare(monthA))
      .map(([month, group]) => ({
        month,
        minutes: group.minutes,
        tickets: [...group.tickets.entries()],
      }));
  }, [report.data]);

  const text = italian
    ? {
        title: 'Le mie ore riconosciute',
        intro: 'Consulta le sessioni timer riconosciute per il tuo lavoro.',
        from: 'Dal',
        to: 'Al',
        total: 'Totale ore riconosciute',
        tickets: 'Ticket',
        monthlyBreakdown: 'Riepilogo mensile',
        empty: 'Nessuna sessione riconosciuta in questo periodo.',
        error: 'Rendiconto non disponibile. Se pensi sia un errore, contatta un amministratore.',
        loading: 'Caricamento rendiconto',
      }
    : {
        title: 'My recognized hours',
        intro: 'Review timer sessions recognized for your work.',
        from: 'From',
        to: 'To',
        total: 'Total recognized hours',
        tickets: 'Tickets',
        monthlyBreakdown: 'Monthly breakdown',
        empty: 'No recognized sessions in this period.',
        error: 'Report unavailable. Contact an administrator if you think this is a mistake.',
        loading: 'Loading report',
      };

  return (
    <Box maxWidth="md" mx="auto" data-testid="personal-time-report">
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <AccessTime color="primary" />
        <Typography variant="h5" fontWeight={800}>{text.title}</Typography>
      </Stack>
      <Typography color="text.secondary" mb={2}>{text.intro}</Typography>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={1.5} mb={2}>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" type="date" label={text.from} value={dateFrom} data-testid="personal-time-date-from"
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  trackEvent('time_report_filter_changed', { scope: 'personal', field: 'date_from' });
                }} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth size="small" type="date" label={text.to} value={dateTo} data-testid="personal-time-date-to"
                onChange={(event) => {
                  setDateTo(event.target.value);
                  trackEvent('time_report_filter_changed', { scope: 'personal', field: 'date_to' });
                }} InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          {report.isLoading ? (
              <Box data-testid="personal-time-loading" display="flex" justifyContent="center" py={4} aria-label={text.loading}><CircularProgress /></Box>
          ) : report.isError ? (
            <Alert severity="error" data-testid="personal-time-error">{text.error}</Alert>
          ) : (
            <>
              <Grid container spacing={1.5} mb={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{text.total}</Typography>
                  <Typography variant="h5" fontWeight={800} color="primary.main" data-testid="personal-time-total">
                    {formatDuration(report.data?.totals.totalMinutes ?? 0, italian)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{text.tickets}</Typography>
                  <Typography variant="h5" fontWeight={800} data-testid="personal-time-ticket-count">{report.data?.totals.ticketCount ?? 0}</Typography>
                </Grid>
              </Grid>
              {monthlyGroups.length === 0 ? (
                <Typography color="text.secondary" py={2} data-testid="personal-time-empty">{text.empty}</Typography>
              ) : (
                <Stack spacing={2} data-testid="personal-time-monthly-breakdown">
                  {monthlyGroups.map((month) => (
                    <Card variant="outlined" key={month.month} data-testid={`personal-time-month-${month.month}`}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5} mb={1.5}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {text.monthlyBreakdown}: {formatMonth(month.month, italian)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" data-testid={`personal-time-month-ticket-count-${month.month}`}>
                              {month.tickets.length} {text.tickets.toLocaleLowerCase(italian ? 'it-IT' : 'en-GB')}
                            </Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={800} data-testid={`personal-time-month-total-${month.month}`}>
                            {formatDuration(month.minutes, italian)}
                          </Typography>
                        </Stack>
                        <Stack spacing={1.5}>
                          {month.tickets.map(([ticketId, ticket]) => (
                            <Box key={ticketId} data-testid={`personal-time-ticket-${month.month}-${ticketId}`} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.5} mb={1}>
                                <Typography variant="subtitle2" fontWeight={700}>
                                  #{ticket.ticketNumber ?? ticketId} · {ticket.title}
                                </Typography>
                                <Typography variant="body2" fontWeight={700} data-testid={`personal-time-ticket-total-${month.month}-${ticketId}`}>
                                  {formatDuration(ticket.minutes, italian)}
                                </Typography>
                              </Stack>
                              <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                {ticket.rows.map((row, index) => (
                                  <Stack key={`${row.date}-${index}`} data-testid={`personal-time-session-${month.month}-${ticketId}-${index}`} direction="row" justifyContent="space-between" py={0.75}>
                                    <Typography variant="body2" color="text.secondary">
                                      {new Date(row.date).toLocaleDateString(italian ? 'it-IT' : 'en-GB')}
                                    </Typography>
                                    <Typography variant="body2">{formatDuration(row.durationMinutes, italian)}</Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
