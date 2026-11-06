import { AccessTimeRounded } from '@mui/icons-material';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useLanguage } from '../contexts/LanguageContext';

export default function TrialExpiredNotice({ subscriptionExpired = false }: { subscriptionExpired?: boolean }) {
  const { t } = useLanguage();
  const copy = t.trialExpiredAccess;
  const title = subscriptionExpired ? copy.subscriptionTitle : copy.title;
  const message = subscriptionExpired ? copy.subscriptionMessage : copy.message;

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper variant="outlined" sx={{ maxWidth: 520, width: '100%', p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <AccessTimeRounded color="primary" sx={{ fontSize: 44 }} />
          <Typography variant="h5" fontWeight={800}>{title}</Typography>
          <Typography color="text.secondary">{message}</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
