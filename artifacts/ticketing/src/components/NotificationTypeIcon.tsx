import React from 'react';
import {
  AccessTime,
  Assessment,
  AssignmentInd,
  CalendarMonth,
  Comment,
  FiberNew,
  GroupAdd,
  Info,
  PriorityHigh,
  SwapHoriz,
} from '@mui/icons-material';
import { useTheme } from '@mui/material';

const notificationIconConfig = {
  ticket_created: {
    Icon: FiberNew,
    color: { light: '#2e7d32', dark: '#81c784' },
  },
  ticket_status_changed: {
    Icon: SwapHoriz,
    color: { light: '#0277bd', dark: '#4fc3f7' },
  },
  ticket_commented: {
    Icon: Comment,
    color: { light: '#1565c0', dark: '#90caf9' },
  },
  ticket_assigned: {
    Icon: AssignmentInd,
    color: { light: '#7b1fa2', dark: '#ce93d8' },
  },
  ticket_priority_changed: {
    Icon: PriorityHigh,
    color: { light: '#b45309', dark: '#ffb74d' },
  },
  ticket_due: {
    Icon: CalendarMonth,
    color: { light: '#c62828', dark: '#ef9a9a' },
  },
  daily_report_submitted: {
    Icon: Assessment,
    color: { light: '#00838f', dark: '#80deea' },
  },
  time_session_corrected: {
    Icon: AccessTime,
    color: { light: '#6d4c41', dark: '#bcaaa4' },
  },
  system: {
    Icon: Info,
    color: { light: '#616161', dark: '#bdbdbd' },
  },
  workspace_invite: {
    Icon: GroupAdd,
    color: { light: '#6a1b9a', dark: '#ce93d8' },
  },
} as const;

export type NotificationIconType = keyof typeof notificationIconConfig;

export function getNotificationIconType(
  type?: string | null,
  hasWorkspaceInviteToken = false,
): NotificationIconType {
  if (hasWorkspaceInviteToken) return 'workspace_invite';
  return type && Object.prototype.hasOwnProperty.call(notificationIconConfig, type)
    ? type as NotificationIconType
    : 'system';
}

interface NotificationTypeIconProps {
  type?: string | null;
  hasWorkspaceInviteToken?: boolean;
  fontSize?: 'inherit' | 'small' | 'medium' | 'large';
}

export function NotificationTypeIcon({
  type,
  hasWorkspaceInviteToken = false,
  fontSize = 'small',
}: NotificationTypeIconProps) {
  const theme = useTheme();
  const resolvedType = getNotificationIconType(type, hasWorkspaceInviteToken);
  const { Icon, color } = notificationIconConfig[resolvedType];

  return (
    <Icon
      fontSize={fontSize}
      aria-hidden="true"
      data-testid="notification-type-icon"
      data-notification-icon-type={resolvedType}
      sx={{ color: color[theme.palette.mode] }}
    />
  );
}
