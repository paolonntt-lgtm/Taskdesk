import { useEffect, useMemo, useState } from 'react';
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
import { ArrowForwardRounded } from '@mui/icons-material';
import { useLocation } from 'wouter';
import OneDriveLogo from './OneDriveLogo';
import {
  getListActiveAnnouncementsQueryKey,
  useListActiveAnnouncements,
  type Announcement,
} from '@workspace/api-client-react';
import type { Lang } from '../i18n/translations';

interface AnnouncementsPopupProps {
  userId?: string;
  enabled: boolean;
  lang: Lang;
}

const ONEDRIVE_COMMENT_ANNOUNCEMENT_ID = -20261024;
const ONEDRIVE_COMMENT_ANNOUNCEMENT_VERSION = 'onedrive-comment-attachments-v2';

function dismissalVersion(announcement: Announcement): string {
  return `${announcement.id}:${String(announcement.updatedAt)}`;
}

function oneDriveCommentAnnouncement(isItalian: boolean): Announcement {
  return {
    id: ONEDRIVE_COMMENT_ANNOUNCEMENT_ID,
    title: isItalian ? 'Novità: allegati OneDrive nei commenti' : 'New: OneDrive attachments in comments',
    body: isItalian
      ? 'Collega il tuo account OneDrive nelle impostazioni di TaskDesk per usare questa funzione. Poi potrai sfogliare le cartelle e scegliere i file da allegare a un nuovo commento o a una risposta. Come gli altri allegati, anche il file importato viene conservato nello spazio privato di TaskDesk e collegato al ticket. L’originale su OneDrive non viene modificato e le modifiche successive non si sincronizzano automaticamente.'
      : 'Connect your OneDrive account in TaskDesk settings to use this feature. Then browse folders and choose files to attach to a new comment or reply. Like other ticket attachments, the imported file is stored in TaskDesk’s private attachment storage and linked to the ticket. The original in OneDrive is not changed, and later changes are not synced automatically.',
    targetType: 'all',
    targetLocation: null,
    targetGroupId: null,
    startsAt: '',
    endsAt: '',
    createdAt: '',
    updatedAt: ONEDRIVE_COMMENT_ANNOUNCEMENT_VERSION,
  };
}

function readDismissedVersions(storageKey: string): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

export default function AnnouncementsPopup({ userId, enabled, lang }: AnnouncementsPopupProps) {
  const isItalian = lang === 'it';
  const [, setLocation] = useLocation();
  const [dismissedVersions, setDismissedVersions] = useState<Set<string>>(() => new Set());
  const [dismissalsLoadedFor, setDismissalsLoadedFor] = useState<string | undefined>();
  const storageKey = useMemo(
    () => userId ? `td_announcements_dismissed_v1:${userId}` : '',
    [userId],
  );

  const announcementsQuery = useListActiveAnnouncements({
    query: {
      enabled: !!userId && enabled,
      queryKey: [...getListActiveAnnouncementsQueryKey(), userId ?? 'signed-out'],
      staleTime: 20_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
    } as any,
  });

  useEffect(() => {
    setDismissedVersions(storageKey ? readDismissedVersions(storageKey) : new Set());
    setDismissalsLoadedFor(userId);
  }, [storageKey]);

  const availableAnnouncements = enabled && userId
    ? [oneDriveCommentAnnouncement(isItalian), ...(announcementsQuery.data ?? [])]
    : announcementsQuery.data ?? [];
  const announcement = enabled && userId === dismissalsLoadedFor
    ? availableAnnouncements.find((item) => !dismissedVersions.has(dismissalVersion(item)))
    : undefined;
  const isOneDriveAnnouncement = announcement?.id === ONEDRIVE_COMMENT_ANNOUNCEMENT_ID;

  const dismiss = () => {
    if (!announcement) return;
    const version = dismissalVersion(announcement);
    setDismissedVersions((current) => {
      const next = new Set(current);
      next.add(version);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next).slice(-300)));
      } catch {
        // Keep the dismissal in memory for this session if browser storage is unavailable.
      }
      return next;
    });
  };

  if (!announcement) return null;

  const endsAt = new Date(announcement.endsAt);
  const endLabel = Number.isNaN(endsAt.getTime())
    ? ''
    : endsAt.toLocaleString(isItalian ? 'it-IT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const oneDriveSteps = isItalian
    ? [
        'Apri un ticket e scrivi un nuovo commento o una risposta.',
        'Seleziona l’icona OneDrive, sfoglia le cartelle e scegli i file.',
        'Come gli altri allegati, il file viene conservato nello spazio privato di TaskDesk e collegato al ticket.',
      ]
    : [
        'Open a ticket and write a new comment or reply.',
        'Select the OneDrive icon, browse folders, and choose files.',
        'Like other ticket attachments, the file is stored in TaskDesk’s private attachment storage and linked to the ticket.',
      ];

  return (
    <Dialog
      open
      data-testid="dialog-team-announcement"
      onClose={dismiss}
      fullWidth
      maxWidth="xs"
      aria-labelledby="team-announcement-title"
      aria-describedby="team-announcement-body"
      PaperProps={{
        sx: {
          overflow: 'hidden',
          borderRadius: 4,
          border: (theme) => `1px solid ${theme.palette.mode === 'light' ? 'rgba(148,163,184,.2)' : 'rgba(148,163,184,.18)'}`,
          boxShadow: (theme) => theme.palette.mode === 'light'
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
          background: (theme) => theme.palette.mode === 'light'
            ? 'radial-gradient(circle at 100% 0%, rgba(124,58,237,.12), transparent 38%), linear-gradient(135deg, #eff6ff 0%, #f7f3ff 100%)'
            : 'radial-gradient(circle at 100% 0%, rgba(124,58,237,.22), transparent 38%), linear-gradient(135deg, #17243c 0%, #241e38 100%)',
          '&::before': {
            content: '""',
            position: 'absolute',
            width: 190,
            height: 190,
            borderRadius: '50%',
            right: -108,
            bottom: -132,
            border: '1px solid rgba(124,58,237,.12)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 58,
              height: 58,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '19px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              boxShadow: '0 9px 20px rgba(79,70,229,.22)',
              color: '#fff',
            }}
          >
            <OneDriveLogo width={36} height={36} />
          </Box>
          <Chip
            label={isItalian ? 'AVVISO' : 'ANNOUNCEMENT'}
            size="small"
            sx={{
              height: 28,
              px: 0.5,
              color: (theme) => theme.palette.mode === 'light' ? '#4f46e5' : '#c4b5fd',
              bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(255,255,255,.76)' : 'rgba(255,255,255,.08)',
              border: '1px solid rgba(99,102,241,.2)',
              fontWeight: 800,
              letterSpacing: '.05em',
              fontSize: 10,
            }}
          />
        </Box>
        <DialogTitle
          id="team-announcement-title"
          data-testid="text-team-announcement-title"
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
            overflowWrap: 'anywhere',
          }}
        >
          {announcement.title}
        </DialogTitle>
        <DialogContent sx={{ position: 'relative', zIndex: 1, px: 0, pb: 0, maxHeight: 'min(55vh, 520px)', overflowY: 'auto' }}>
          {isOneDriveAnnouncement ? (
            <Box
              id="team-announcement-body"
              data-testid="text-team-announcement-body"
              sx={{ display: 'grid', gap: 1.75, maxWidth: 410 }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14.5, lineHeight: 1.65 }}>
                {isItalian
                  ? 'Collega il tuo account OneDrive nelle impostazioni di TaskDesk per iniziare.'
                  : 'Connect your OneDrive account in TaskDesk settings to get started.'}
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {oneDriveSteps.map((step, index) => (
                  <Box key={step} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        flex: '0 0 25px',
                        width: 25,
                        height: 25,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontSize: 12,
                        fontWeight: 800,
                        mt: '1px',
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography variant="body2" color="text.primary" sx={{ fontSize: 14, lineHeight: 1.55, pt: '2px' }}>
                      {step}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderLeft: '3px solid',
                  borderColor: 'divider',
                  borderLeftColor: 'primary.main',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 800, mb: 0.4 }}>
                  {isItalian ? 'Copia indipendente' : 'Independent copy'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.55 }}>
                  {isItalian
                    ? 'L’originale su OneDrive non viene modificato né sincronizzato. L’accesso agli allegati segue i permessi del ticket.'
                    : 'The original in OneDrive is not changed or synced. Access to attachments follows the ticket’s permissions.'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography
              id="team-announcement-body"
              data-testid="text-team-announcement-body"
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 390, fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              {announcement.body}
            </Typography>
          )}
        </DialogContent>
      </Box>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          pt: 2,
          pb: 2,
          gap: 1,
          alignItems: 'stretch',
          flexDirection: 'column',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '& .MuiButton-root': { minHeight: 44 },
        }}
      >
        {isOneDriveAnnouncement && (
          <Button
            variant="outlined"
            data-testid="button-open-onedrive-settings-announcement"
            endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
            onClick={() => {
              dismiss();
              setLocation('/onedrive');
            }}
            sx={{ alignSelf: 'flex-end', minHeight: 44, borderRadius: 2.5 }}
          >
            {isItalian ? 'Apri OneDrive' : 'Open OneDrive'}
          </Button>
        )}
        {endLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            {isItalian ? 'Valido fino al' : 'Valid until'} {endLabel}
          </Typography>
        )}
        <Button
          variant="contained"
          data-testid="button-dismiss-team-announcement"
          endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
          onClick={dismiss}
          sx={{
            alignSelf: 'flex-end',
            minWidth: 150,
            borderRadius: 2.5,
            boxShadow: '0 8px 18px rgba(79,70,229,.2)',
            '&:hover': { boxShadow: '0 10px 20px rgba(79,70,229,.27)' },
          }}
        >
          {isItalian ? 'Ho capito' : 'Got it'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
