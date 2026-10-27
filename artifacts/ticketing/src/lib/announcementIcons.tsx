import {
  CampaignRounded,
  CelebrationRounded,
  CheckCircleRounded,
  EventRounded,
  InfoRounded,
  SystemUpdateAltRounded,
  WarningAmberRounded,
} from '@mui/icons-material';

export const ANNOUNCEMENT_ICON_KEYS = [
  'auto',
  'announcement',
  'update',
  'success',
  'warning',
  'event',
  'info',
] as const;

export type AnnouncementIconKey = (typeof ANNOUNCEMENT_ICON_KEYS)[number];

const ICONS = {
  announcement: { Icon: CampaignRounded, color: '#2563eb', background: 'rgba(37,99,235,.12)' },
  update: { Icon: SystemUpdateAltRounded, color: '#7c3aed', background: 'rgba(124,58,237,.12)' },
  success: { Icon: CheckCircleRounded, color: '#15803d', background: 'rgba(21,128,61,.12)' },
  warning: { Icon: WarningAmberRounded, color: '#b45309', background: 'rgba(180,83,9,.13)' },
  event: { Icon: EventRounded, color: '#be185d', background: 'rgba(190,24,93,.12)' },
  info: { Icon: InfoRounded, color: '#0369a1', background: 'rgba(3,105,161,.12)' },
  celebration: { Icon: CelebrationRounded, color: '#a16207', background: 'rgba(161,98,7,.13)' },
} as const;

type ResolvedIconKey = keyof typeof ICONS;

function detectIcon(title: string, body: string): ResolvedIconKey {
  const text = `${title} ${body}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/\b(urgente|attenzione|scadenza|problema|rischio|warning|urgent|caution|deadline|issue|risk)\b/.test(text)) return 'warning';
  if (/\b(grazie|complimenti|congratulazioni|raggiunto|completato|successo|thank you|congratulations|completed|success)\b/.test(text)) return 'celebration';
  if (/\b(evento|riunione|meeting|invito|appuntamento|webinar|event|invite)\b/.test(text)) return 'event';
  if (/\b(aggiornamento|novita|disponibile|rilascio|update|release|new feature|changes)\b/.test(text)) return 'update';
  if (/\b(informazione|ricorda|promemoria|comunicazione|inform|reminder|please note|important)\b/.test(text)) return 'info';
  return 'announcement';
}

export function getAnnouncementIconInfo(iconKey: unknown, title = '', body = '') {
  const resolvedKey = iconKey === 'auto'
    ? detectIcon(title, body)
    : typeof iconKey === 'string' && iconKey in ICONS
      ? iconKey as ResolvedIconKey
      : 'announcement';
  return ICONS[resolvedKey];
}
