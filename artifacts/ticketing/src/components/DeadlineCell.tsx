import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { useCountdown } from '../hooks/useCountdown';
import { useLanguage } from '../contexts/LanguageContext';

interface DeadlineCellProps {
  dueAt: string | null | undefined;
}

const STATUS_COLOR: Record<string, string> = {
  expired: 'error.main',
  today: 'warning.dark',
  week: '#f9a825',
  ok: 'text.secondary',
};

const DOT_COLOR: Record<string, string> = {
  expired: '#d32f2f',
  today: '#e65100',
  week: '#f9a825',
  ok: 'transparent',
};

export default function DeadlineCell({ dueAt }: DeadlineCellProps) {
  const { t, lang } = useLanguage();
  const { status, formattedTime, tooltipDate } = useCountdown(dueAt, lang);

  if (status === 'none') {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
        —
      </Typography>
    );
  }

  const color = STATUS_COLOR[status] ?? 'text.secondary';
  const dotColor = DOT_COLOR[status] ?? 'transparent';
  const label = status === 'expired' ? t.ticketList.deadlineExpired : formattedTime;
  const fontWeight = status === 'ok' ? 400 : 600;

  return (
    <Tooltip title={tooltipDate} arrow placement="top">
      <Box display="inline-flex" alignItems="center" gap={0.5} sx={{ cursor: 'default', whiteSpace: 'nowrap' }}>
        {status !== 'ok' && (
          <Box
            component="span"
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: dotColor,
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
        )}
        <Typography
          variant="body2"
          sx={{
            color,
            fontWeight,
            display: 'inline',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
