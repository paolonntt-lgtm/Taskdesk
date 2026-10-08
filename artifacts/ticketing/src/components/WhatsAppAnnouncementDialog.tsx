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
import { ArrowForwardRounded, VisibilityOffOutlined, WhatsApp } from '@mui/icons-material';
import type { Lang } from '../i18n/translations';

interface WhatsAppAnnouncementDialogProps {
  open: boolean;
  lang: Lang;
  href: string;
  onClose: () => void;
  onContact: () => void;
  onNeverShowAgain: () => void;
}

export default function WhatsAppAnnouncementDialog({
  open,
  lang,
  href,
  onClose,
  onContact,
  onNeverShowAgain,
}: WhatsAppAnnouncementDialogProps) {
  const isItalian = lang === 'it';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="whatsapp-announcement-title"
      aria-describedby="whatsapp-announcement-description"
      PaperProps={{
        sx: {
          overflow: 'hidden',
          borderRadius: 4,
          border: (theme) =>
            `1px solid ${theme.palette.mode === 'light' ? 'rgba(148,163,184,.2)' : 'rgba(148,163,184,.18)'}`,
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
              ? 'radial-gradient(circle at 100% 0%, rgba(34,197,94,.12), transparent 38%), linear-gradient(135deg, #effaf3 0%, #f1fbf8 100%)'
              : 'radial-gradient(circle at 100% 0%, rgba(34,197,94,.2), transparent 38%), linear-gradient(135deg, #142b25 0%, #172b2b 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: 190,
            height: 190,
            borderRadius: '50%',
            right: -108,
            bottom: -132,
            border: '1px solid rgba(34,197,94,.16)',
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
              background: 'linear-gradient(135deg, #16a34a, #0f766e)',
              boxShadow: '0 9px 20px rgba(15,118,110,.22)',
              color: '#fff',
            }}
          >
            <WhatsApp sx={{ fontSize: 31 }} />
          </Box>
          <Chip
            label={isItalian ? 'NOVITÀ' : 'WHAT’S NEW'}
            size="small"
            sx={{
              height: 28,
              px: 0.5,
              color: (theme) => theme.palette.mode === 'light' ? '#15803d' : '#86efac',
              bgcolor: (theme) =>
                theme.palette.mode === 'light' ? 'rgba(255,255,255,.76)' : 'rgba(255,255,255,.08)',
              border: '1px solid rgba(34,197,94,.22)',
              fontWeight: 800,
              letterSpacing: '.05em',
              fontSize: 10,
            }}
          />
        </Box>
        <DialogTitle
          id="whatsapp-announcement-title"
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
          {isItalian ? 'Il team di sviluppo è su WhatsApp' : 'The development team is on WhatsApp'}
        </DialogTitle>
        <DialogContent sx={{ position: 'relative', zIndex: 1, px: 0, pb: 0 }}>
          <Typography
            id="whatsapp-announcement-description"
            variant="body2"
            color="text.secondary"
            data-testid="text-whatsapp-announcement"
            sx={{ maxWidth: 390, fontSize: 14.5, lineHeight: 1.7 }}
          >
            {isItalian
              ? 'Per domande o feedback puoi contattarci direttamente. Trovi l’icona WhatsApp verde nella barra in alto, accanto alle notifiche.'
              : 'For questions or feedback, you can contact us directly. The green WhatsApp icon is in the top bar, next to notifications.'}
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
          <Button onClick={onClose} data-testid="button-dismiss-whatsapp-announcement" sx={{ color: 'text.secondary', px: 1.5 }}>
            {isItalian ? 'Ho capito' : 'Got it'}
          </Button>
          <Button
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            startIcon={<WhatsApp sx={{ fontSize: 18 }} />}
            endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
            onClick={onContact}
            data-testid="button-contact-dev-whatsapp"
            sx={{
              minWidth: { xs: 156, sm: 174 },
              borderRadius: 2.5,
              bgcolor: '#0f766e',
              boxShadow: '0 8px 18px rgba(15,118,110,.2)',
              '&:hover': { bgcolor: '#115e59', boxShadow: '0 10px 20px rgba(15,118,110,.27)' },
            }}
          >
            {isItalian ? 'Scrivi al team' : 'Message the team'}
          </Button>
        </Box>
        <Button
          onClick={onNeverShowAgain}
          data-testid="button-never-show-whatsapp-announcement"
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
