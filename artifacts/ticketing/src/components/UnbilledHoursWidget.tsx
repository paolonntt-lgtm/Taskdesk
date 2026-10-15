import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { AccessTime, ArrowForward, ReceiptLong } from '@mui/icons-material';
import { getGetTimeTrackingReportQueryKey, useGetTimeTrackingReport } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';
import { summarizeUnbilledCustomerTime } from '../lib/dashboardWidgetUtils';

function formatDuration(totalMinutes: number, lang: string): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (lang === 'it') {
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'ora' : 'ore'}`;
    return `${hours} ${hours === 1 ? 'ora' : 'ore'} e ${minutes} min`;
  }
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minutes} min`;
}

export default function UnbilledHoursWidget() {
  const { t, lang } = useLanguage();
  const report = useGetTimeTrackingReport(undefined, {
    query: {
      queryKey: getGetTimeTrackingReportQueryKey(),
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  });
  const dashboardText = t.dashboard;

  const content = report.isLoading ? (
    <Stack data-testid="unbilled-loading" alignItems="center" justifyContent="center" gap={1} sx={{ minHeight: 120 }}>
      <CircularProgress size={24} aria-label={dashboardText.widgetUnbilledLoading} />
      <Typography variant="body2" color="text.secondary">{dashboardText.widgetUnbilledLoading}</Typography>
    </Stack>
  ) : report.isError ? (
    <Alert
      severity="error"
      data-testid="unbilled-error"
      action={<Button color="inherit" size="small" onClick={() => report.refetch()}>{dashboardText.widgetUnbilledRetry}</Button>}
    >
      {dashboardText.widgetUnbilledError}
    </Alert>
  ) : (() => {
    const summary = summarizeUnbilledCustomerTime(report.data?.customerRows ?? []);
    if (summary.ticketCount === 0) {
      return (
        <Box sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary" data-testid="unbilled-empty">
            {dashboardText.widgetUnbilledEmpty}
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {dashboardText.widgetUnbilledMinutes}
        </Typography>
        <Typography variant="h4" fontWeight={800} color="warning.dark" data-testid="unbilled-total">
          {formatDuration(summary.totalMinutes, lang)}
        </Typography>
        <Typography variant="body2" color="text.secondary" data-testid="unbilled-ticket-count">
          {dashboardText.widgetUnbilledTicketCount(summary.ticketCount)}
        </Typography>
      </Box>
    );
  })();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }} data-testid="widget-unbilled-hours">
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
          <ReceiptLong fontSize="small" color="warning" />
          <Typography variant="subtitle2" fontWeight={800}>{dashboardText.widgetUnbilled}</Typography>
        </Stack>
        {content}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Button
            component={Link}
            href="/time-report"
            size="small"
            endIcon={<ArrowForward />}
            data-testid="unbilled-report-link"
          >
            {dashboardText.widgetUnbilledLink}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
