import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { getNotificationIconType, NotificationTypeIcon } from './NotificationTypeIcon';

const supportedNotificationTypes = [
  'ticket_created',
  'ticket_status_changed',
  'ticket_commented',
  'ticket_assigned',
  'ticket_priority_changed',
  'ticket_due',
  'daily_report_submitted',
  'time_session_corrected',
  'system',
] as const;

describe('notification type icons', () => {
  it.each(supportedNotificationTypes)('uses the event icon for %s', (type) => {
    expect(getNotificationIconType(type)).toBe(type);

    const markup = renderToStaticMarkup(
      createElement(NotificationTypeIcon, { type }),
    );
    expect(markup).toContain(`data-notification-icon-type="${type}"`);
  });

  it.each([undefined, null, '', 'future_notification', 'constructor'])(
    'uses a neutral icon for missing or unknown type %s',
    (type) => {
      expect(getNotificationIconType(type)).toBe('system');

      const markup = renderToStaticMarkup(
        createElement(NotificationTypeIcon, { type }),
      );
      expect(markup).toContain('data-notification-icon-type="system"');
    },
  );

  it('uses the workspace invitation icon when an invite token is present', () => {
    expect(getNotificationIconType('system', true)).toBe('workspace_invite');
    expect(getNotificationIconType('ticket_created', true)).toBe('workspace_invite');

    const markup = renderToStaticMarkup(
      createElement(NotificationTypeIcon, {
        type: 'system',
        hasWorkspaceInviteToken: true,
      }),
    );
    expect(markup).toContain('data-notification-icon-type="workspace_invite"');
  });

  it('keeps category colors readable in light and dark themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const markup = renderToStaticMarkup(
        createElement(
          ThemeProvider,
          { theme: createTheme({ palette: { mode } }) },
          createElement(NotificationTypeIcon, { type: 'ticket_created' }),
        ),
      );
      expect(markup).toContain(mode === 'light' ? '#2e7d32' : '#81c784');
    }
  });
});
