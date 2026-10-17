import React from 'react';
import { Alert, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

export interface ReferralApplicationStatusMessages {
  appliedTitle: string;
  appliedMessage: string;
  notAppliedTitle: string;
  notAppliedMessage: string;
}

interface ReferralApplicationStatusProps {
  enabled: boolean;
  organizationId: number | null | undefined;
  messages: ReferralApplicationStatusMessages;
}

const REFERRAL_STATUS_REFRESH_INTERVAL_MS = 15_000;

export default function ReferralApplicationStatus({
  enabled,
  organizationId,
  messages,
}: ReferralApplicationStatusProps) {
  const referralStatusQuery = useQuery<{
    applied: boolean;
    attempted: boolean;
    retryPending: boolean;
  }>({
    queryKey: ['referral-application-status', organizationId],
    queryFn: async () => {
      const response = await fetch('/api/stripe/referrals/status', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('referral status unavailable');
      return response.json();
    },
    enabled: enabled && organizationId != null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (query) => query.state.data?.retryPending
      ? REFERRAL_STATUS_REFRESH_INTERVAL_MS
      : false,
    refetchIntervalInBackground: false,
  });

  const referralApplied = referralStatusQuery.data?.applied === true;
  const referralAttempted = referralStatusQuery.data?.attempted === true;

  if (!enabled || !referralStatusQuery.isSuccess || (!referralApplied && !referralAttempted)) {
    return null;
  }

  return (
    <Alert
      severity={referralApplied ? 'success' : 'info'}
      data-testid="status-referral-application"
      sx={{ mb: 2, borderRadius: 2 }}
    >
      <Typography fontWeight={700} data-testid="title-referral-application">
        {referralApplied ? messages.appliedTitle : messages.notAppliedTitle}
      </Typography>
      <Typography variant="body2" data-testid="message-referral-application">
        {referralApplied ? messages.appliedMessage : messages.notAppliedMessage}
      </Typography>
    </Alert>
  );
}
