import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { ArrowForwardRounded, CardGiftcardRounded, VisibilityOffOutlined } from '@mui/icons-material';
import type { Lang } from '../i18n/translations';

interface ReferralProgramAnnouncementDialogProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onOpenProgram: () => void;
  onNeverShowAgain: () => void;
}

export default function ReferralProgramAnnouncementDialog({
  open,
  lang,
  onClose,
  onOpenProgram,
  onNeverShowAgain,
}: ReferralProgramAnnouncementDialogProps) {
  const isItalian = lang === 'it';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="referral-announcement-title"
      aria-describedby="referral-announcement-description"
      PaperProps={{
        sx: {
          overflow: 'hidden',
          borderRadius: 4,
          border: (theme) =>
            `1px solid ${theme.palette.mode === 'light' ? 'rgba(99,102,241,.18)' : 'rgba(129,140,248,.2)'}`,
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 28px 90px rgba(30,41,59,.25)'
              : '0 28px 90px rgba(0,0,0,.52)',
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          px: { xs: 2.75, sm: 3.5 },
          pt: 3.25,
          pb: 3,
          background: (theme) =>
            theme.palette.mode === 'light'
              ? 'radial-gradient(circle at 100% 0%, rgba(99,102,241,.14), transparent 40%), linear-gradient(135deg, #f4f5ff 0%, #f8f6ff 100%)'
              : 'radial-gradient(circle at 100% 0%, rgba(129,140,248,.2), transparent 40%), linear-gradient(135deg, #20233b 0%, #29233a 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: 190,
            height: 190,
            borderRadius: '50%',
            right: -108,
            bottom: -132,
            border: '1px solid rgba(99,102,241,.2)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              width: 58,
              height: 58,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '19px',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              boxShadow: '0 9px 20px rgba(99,102,241,.24)',
              color: '#fff',
            }}
          >
            <CardGiftcardRounded sx={{ fontSize: 31 }} />
          </Box>
          <Chip
            label={isItalian ? 'PROGRAMMA REFERRAL' : 'REFERRAL PROGRAM'}
            size="small"
            sx={{
              height: 28,
              px: 0.5,
              color: (theme) => theme.palette.mode === 'light' ? '#4f46e5' : '#c4b5fd',
              bgcolor: (theme) =>
                theme.palette.mode === 'light' ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.08)',
              border: '1px solid rgba(99,102,241,.22)',
              fontWeight: 800,
              letterSpacing: '.04em',
              fontSize: 10,
            }}
          />
        </Box>
        <DialogTitle
          id="referral-announcement-title"
          sx={{
            position: 'relative',
            zIndex: 1,
            px: 0,
            pt: 2.5,
            pb: 0.9,
            color: 'text.primary',
            fontSize: { xs: 24, sm: 26 },
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: '-.035em',
          }}
        >
          {isItalian ? 'Invita un’azienda, ricevi un premio' : 'Refer a business and earn a reward'}
        </DialogTitle>
        <DialogContent sx={{ position: 'relative', zIndex: 1, px: 0, pb: 0 }}>
          <Typography
            id="referral-announcement-description"
            variant="body2"
            color="text.secondary"
            data-testid="text-referral-announcement"
            sx={{ maxWidth: 390, fontSize: 14.5, lineHeight: 1.7 }}
          >
            {isItalian
              ? 'Condividi il tuo link con un’altra azienda. Dopo il suo primo pagamento idoneo, riceverai un premio pari a un mese del piano attivo al momento dell’accredito.'
              : 'Share your referral link with another business. After its first eligible payment, you’ll receive a reward equal to one month of the plan active when it is credited.'}
          </Typography>
        </DialogContent>
      </Box>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          pt: 2,
          pb: 1.25,
          gap: 0.5,
          alignItems: 'stretch',
          flexDirection: 'column',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '& .MuiButton-root': { minHeight: 44 },
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Button onClick={onClose} data-testid="button-dismiss-referral-announcement" sx={{ color: 'text.secondary', px: 1.5 }}>
            {isItalian ? 'Ho capito' : 'Got it'}
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
            onClick={onOpenProgram}
            data-testid="button-open-referral-program"
            sx={{
              minWidth: { xs: 156, sm: 174 },
              borderRadius: 2.5,
              bgcolor: '#4f46e5',
              boxShadow: '0 8px 18px rgba(79,70,229,.22)',
              '&:hover': { bgcolor: '#4338ca', boxShadow: '0 10px 20px rgba(79,70,229,.28)' },
            }}
          >
            {isItalian ? 'Scopri il programma' : 'View the program'}
          </Button>
        </Box>
        <Button
          onClick={onNeverShowAgain}
          data-testid="button-never-show-referral-announcement"
          startIcon={<VisibilityOffOutlined sx={{ fontSize: 16 }} />}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            minHeight: 32,
            px: 1.5,
            color: 'text.secondary',
            fontSize: 12,
            fontWeight: 600,
            '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
          }}
        >
          {isItalian ? 'Non mostrarlo più' : "Don't show this again"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
