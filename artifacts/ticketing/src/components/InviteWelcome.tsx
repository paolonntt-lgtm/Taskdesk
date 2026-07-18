import React from 'react';
import {
  Box, Typography, Button, Paper,
} from '@mui/material';
import WavingHandIcon from '@mui/icons-material/WavingHand';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  orgName: string | null;
  adminName: string;
  onStart: () => void;
}

export default function InviteWelcome({ orgName, adminName, onStart }: Props) {
  const { t } = useLanguage();
  const tr = t.inviteWelcome;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        p: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          maxWidth: 480,
          width: '100%',
          borderRadius: 4,
          p: { xs: 4, sm: 6 },
          textAlign: 'center',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WavingHandIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
        </Box>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          {tr.title}
        </Typography>

        {orgName && (
          <Typography variant="body1" color="text.secondary" mb={1}>
            {tr.joinedOrg}{' '}
            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {orgName}
            </Box>
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary" mb={4}>
          {tr.invitedBy}{' '}
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {adminName}
          </Box>
          {tr.invitedBySuffix}
        </Typography>

        <Typography variant="body2" color="text.secondary" mb={4}>
          {tr.description}
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={onStart}
          sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}
        >
          {tr.startButton}
        </Button>
      </Paper>
    </Box>
  );
}
