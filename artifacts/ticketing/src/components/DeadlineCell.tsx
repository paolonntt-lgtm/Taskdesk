import React from 'react';
import { Tooltip, Typography } from '@mui/material';
import { useCountdown } from '../hooks/useCountdown';
import { useLanguage } from '../contexts/LanguageContext';

interface DeadlineCellProps {
  dueAt: string | null | undefined;
}

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

  const color =
    status === 'expired'
      ? 'error.main'
      : status === 'soon'
      ? 'warning.main'
      : 'text.primary';

  const label = status === 'expired' ? t.ticketList.deadlineExpired : formattedTime;

  return (
    <Tooltip title={tooltipDate} arrow placement="top">
      <Typography
        variant="body2"
        sx={{
          color,
          fontWeight: status === 'expired' || status === 'soon' ? 600 : 400,
          cursor: 'default',
          whiteSpace: 'nowrap',
          display: 'inline-block',
        }}
      >
        {label}
      </Typography>
    </Tooltip>
  );
}
