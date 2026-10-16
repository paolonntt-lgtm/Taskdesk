import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import type { TimeTrackingReportMonthTotal, TimeTrackingReportRow } from '@workspace/api-client-react';
import {
  buildTimeTrackingBreakdowns,
  type TimeTrackingBreakdownKey,
  type TimeTrackingBreakdownRow,
} from './timeTrackingBreakdowns';

interface Props {
  customerRows: TimeTrackingReportRow[];
  collaboratorRows: TimeTrackingReportRow[];
  monthlyTotals: TimeTrackingReportMonthTotal[];
  lang: string;
}

const labels = {
  it: {
    title: 'Totali dettagliati',
    client: 'Per cliente',
    collaborator: 'Per collaboratore',
    ticket: 'Per ticket',
    month: 'Per mese',
    billable: 'Fatturabili',
    billed: 'Fatturate',
    unbilled: 'Da fatturare',
    recognizable: 'Riconoscibili',
    total: 'Totale',
    empty: 'Nessun totale disponibile per i filtri selezionati.',
    collaboratorNote: 'La suddivisione per collaboratore mostra le ore riconoscibili.',
  },
  en: {
    title: 'Detailed totals',
    client: 'By customer',
    collaborator: 'By collaborator',
    ticket: 'By ticket',
    month: 'By month',
    billable: 'Billable',
    billed: 'Billed',
    unbilled: 'Unbilled',
    recognizable: 'Recognizable',
    total: 'Total',
    empty: 'No totals are available for the selected filters.',
    collaboratorNote: 'The collaborator breakdown shows recognizable hours.',
  },
};

function formatDuration(minutes: number, lang: string): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (lang === 'it') return hours ? `${hours} h ${rest} min` : `${rest} min`;
  return hours ? `${hours} hr ${rest} min` : `${rest} min`;
}

function monthLabel(value: string, lang: string): string {
  const date = new Date(`${value}-01T12:00:00Z`);
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function TimeTrackingReportBreakdown({
  customerRows,
  collaboratorRows,
  monthlyTotals,
  lang,
}: Props) {
  const [view, setView] = useState<TimeTrackingBreakdownKey>('client');
  const copy = lang === 'it' ? labels.it : labels.en;
  const groups = useMemo(
    () => buildTimeTrackingBreakdowns(customerRows, collaboratorRows, monthlyTotals),
    [customerRows, collaboratorRows, monthlyTotals],
  );
  const rows = groups[view];
  const isCollaboratorView = view === 'collaborator';
  const total = rows.reduce((sum, row) => ({
    clientBillableMinutes: sum.clientBillableMinutes + row.clientBillableMinutes,
    clientBilledMinutes: sum.clientBilledMinutes + row.clientBilledMinutes,
    clientUnbilledMinutes: sum.clientUnbilledMinutes + row.clientUnbilledMinutes,
    collaboratorRecognizableMinutes: sum.collaboratorRecognizableMinutes + row.collaboratorRecognizableMinutes,
  }), {
    clientBillableMinutes: 0,
    clientBilledMinutes: 0,
    clientUnbilledMinutes: 0,
    collaboratorRecognizableMinutes: 0,
  });

  const tabs: { value: TimeTrackingBreakdownKey; label: string }[] = [
    { value: 'client', label: copy.client },
    { value: 'collaborator', label: copy.collaborator },
    { value: 'ticket', label: copy.ticket },
    { value: 'month', label: copy.month },
  ];
  const columns = isCollaboratorView
    ? [{ key: 'collaboratorRecognizableMinutes', label: copy.recognizable }]
    : [
        { key: 'clientBillableMinutes', label: copy.billable },
        { key: 'clientBilledMinutes', label: copy.billed },
        { key: 'clientUnbilledMinutes', label: copy.unbilled },
        { key: 'collaboratorRecognizableMinutes', label: copy.recognizable },
      ];

  return (
    <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
      <Box sx={{ px: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={800}>{copy.title}</Typography>
        <Tabs
          value={view}
          onChange={(_event, value: TimeTrackingBreakdownKey) => setView(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={copy.title}
        >
          {tabs.map((tab) => <Tab key={tab.value} value={tab.value} label={tab.label} />)}
        </Tabs>
      </Box>
      {isCollaboratorView && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1 }}>
          {copy.collaboratorNote}
        </Typography>
      )}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{copy.empty}</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader aria-label={copy.title}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 180 }}>{tabs.find((tab) => tab.value === view)?.label}</TableCell>
                {columns.map((column) => <TableCell key={column.key} align="right">{column.label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key} hover>
                  <TableCell>{view === 'month' ? monthLabel(row.label, lang) : row.label}</TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.key} align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatDuration(row[column.key as keyof TimeTrackingBreakdownRow] as number, lang)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>{copy.total}</TableCell>
                {columns.map((column) => (
                  <TableCell key={column.key} align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {formatDuration(total[column.key as keyof typeof total], lang)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
