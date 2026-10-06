import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  ArrowBack,
  CalendarToday,
  LocationOnOutlined,
} from '@mui/icons-material';
import { useLocation, useParams } from 'wouter';
import {
  getGetDailyReportQueryKey,
  useGetDailyReport,
  useMarkDailyReportRead,
} from '@workspace/api-client-react';
import { useLanguage } from '../contexts/LanguageContext';
import { MarkdownContent } from '../components/MarkdownContent';

function formatReportDate(value: string, lang: 'it' | 'en') {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(
    lang === 'it' ? 'it-IT' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );
}

function formatReportTime(value: string, lang: 'it' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DailyReportDetailPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const isValidId = Number.isSafeInteger(reportId) && reportId > 0;
  const { lang } = useLanguage();
  const [, setLocation] = useLocation();
  const markedReadId = useRef<number | null>(null);
  const reportQuery = useGetDailyReport(reportId, {
    query: { queryKey: getGetDailyReportQueryKey(reportId), enabled: isValidId },
  });
  const { mutate: markReportRead } = useMarkDailyReportRead();

  useEffect(() => {
    if (!isValidId || !reportQuery.data || markedReadId.current === reportId) return;
    markedReadId.current = reportId;
    markReportRead({ id: reportId });
  }, [isValidId, reportId, reportQuery.data, markReportRead]);

  const copy = lang === 'it'
    ? {
        back: 'Torna alle notifiche',
        title: (authorName: string) => `Report di ${authorName}`,
        loading: 'Caricamento del report…',
        loadError: 'Non è stato possibile caricare il report.',
        missing: 'Report non trovato o non accessibile.',
        retry: 'Riprova',
        location: 'Sede',
      }
    : {
        back: 'Back to notifications',
        title: (authorName: string) => `Report by ${authorName}`,
        loading: 'Loading report…',
        loadError: 'The report could not be loaded.',
        missing: 'Report not found or not accessible.',
        retry: 'Try again',
        location: 'Site',
      };

  return (
    <Box
      sx={{
        maxWidth: 920,
        mx: 'auto',
        pb: { xs: 4, sm: 7 },
        animation: 'tk-fadeUp 0.45s cubic-bezier(.16,1,.3,1) both',
      }}
    >
      <Button
        startIcon={<ArrowBack />}
        onClick={() => setLocation('/notifications')}
        sx={{ mb: 2, px: 0.5 }}
      >
        {copy.back}
      </Button>

      {!isValidId ? (
        <Alert severity="error">{copy.missing}</Alert>
      ) : reportQuery.isLoading ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}>
          <CircularProgress size={30} />
          <Typography color="text.secondary">{copy.loading}</Typography>
        </Stack>
      ) : reportQuery.isError || !reportQuery.data ? (
        <Alert
          severity="error"
          action={
            reportQuery.isError ? (
              <Button color="inherit" size="small" onClick={() => void reportQuery.refetch()}>
                {copy.retry}
              </Button>
            ) : undefined
          }
        >
          {reportQuery.isError ? copy.loadError : copy.missing}
        </Alert>
      ) : (
        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: { xs: 2.25, sm: 4 } }}>
            <Stack spacing={{ xs: 2, sm: 2.75 }}>
              <Box>
                <Stack
                  direction="row"
                  useFlexGap
                  flexWrap="wrap"
                  columnGap={{ xs: 1.25, sm: 2 }}
                  rowGap={0.75}
                  alignItems="baseline"
                >
                  <Typography
                    variant="h5"
                    component="h1"
                    sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}
                  >
                    {copy.title(reportQuery.data.authorName)}
                  </Typography>
                  <Stack direction="row" spacing={0.65} alignItems="center" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    <CalendarToday sx={{ fontSize: 15 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatReportDate(reportQuery.data.date, lang)}
                    </Typography>
                    <AccessTime sx={{ fontSize: 15, ml: 0.4 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatReportTime(reportQuery.data.createdAt, lang)}
                    </Typography>
                  </Stack>
                </Stack>
                {reportQuery.data.location && (
                  <Chip
                    icon={<LocationOnOutlined sx={{ fontSize: '16px !important' }} />}
                    label={`${copy.location}: ${reportQuery.data.location}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1.25 }}
                  />
                )}
              </Box>

              <Divider />

              <Box sx={{ overflowWrap: 'anywhere', '& p:first-of-type': { mt: 0 } }}>
                <MarkdownContent
                  content={reportQuery.data.content}
                  onTicketClick={(ticketId) => setLocation(`/tickets/${ticketId}`)}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
