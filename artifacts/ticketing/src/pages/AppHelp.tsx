import {
  AccessTimeRounded,
  ArrowBackRounded,
  AssessmentOutlined,
  BusinessOutlined,
  CalendarMonthRounded,
  DeleteOutlineRounded,
  EditNoteRounded,
  GroupsOutlined,
  HelpOutlineRounded,
  NotificationsNoneRounded,
  PaymentsOutlined,
  SettingsOutlined,
  SpaceDashboardOutlined,
  SupportAgentRounded,
  ConfirmationNumberRounded,
} from '@mui/icons-material';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link, useSearch } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type HelpSection = {
  id: string;
  title: string;
  items: string[];
  path?: string;
  action?: string;
  icon: ReactNode;
};

export default function AppHelp() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const search = useSearch();
  const help = t.appHelp;
  const isAdmin = user?.role === 'admin';
  const sections: HelpSection[] = [
    { id: 'dashboard', title: help.dashboardTitle, items: help.dashboardItems, path: '/', action: help.openDashboard, icon: <SpaceDashboardOutlined color="primary" /> },
    { id: 'tickets', title: help.ticketsTitle, items: help.ticketsItems, path: '/tickets', action: help.openTickets, icon: <ConfirmationNumberRounded color="primary" /> },
    ...((user as any)?.clientsEnabled !== false
      ? [{ id: 'clients', title: help.clientsTitle, items: help.clientsItems, path: '/clients', action: help.openClients, icon: <BusinessOutlined color="primary" /> }]
      : []),
    { id: 'calendar', title: help.calendarTitle, items: help.calendarItems, path: '/calendar', action: help.openCalendar, icon: <CalendarMonthRounded color="primary" /> },
    { id: 'reports', title: help.reportsTitle, items: help.reportsItems, path: '/reports', action: help.openReports, icon: <AssessmentOutlined color="primary" /> },
    { id: 'notifications', title: help.notificationsTitle, items: help.notificationsItems, path: '/notifications', action: help.openNotifications, icon: <NotificationsNoneRounded color="primary" /> },
    { id: 'albert', title: help.albertTitle, items: help.albertItems, icon: <SupportAgentRounded color="primary" /> },
    ...((user as any)?.clientsEnabled !== false
      ? [{ id: 'notes', title: help.notesTitle, items: help.notesItems, path: '/clients', action: help.openNotes, icon: <EditNoteRounded color="primary" /> }]
      : []),
    ...(isAdmin
      ? [
          { id: 'users', title: help.usersTitle, items: help.usersItems, path: '/users', action: help.openUsers, icon: <GroupsOutlined color="primary" /> },
          { id: 'settings', title: help.settingsTitle, items: help.settingsItems, path: '/settings', action: help.openSettings, icon: <SettingsOutlined color="primary" /> },
          { id: 'billing', title: help.billingTitle, items: help.billingItems, path: '/billing', action: help.openBilling, icon: <PaymentsOutlined color="primary" /> },
          { id: 'trash', title: help.trashTitle, items: help.trashItems, path: '/tickets/trash', action: help.openTrash, icon: <DeleteOutlineRounded color="primary" /> },
          { id: 'team-announcements', title: help.announcementsTitle, items: help.announcementsItems, path: '/announcements', action: help.openAnnouncements, icon: <NotificationsNoneRounded color="primary" /> },
          { id: 'task-track', title: help.taskTrackTitle, items: help.taskTrackItems, path: '/tasktrack-help', action: help.openTaskTrack, icon: <AccessTimeRounded color="primary" /> },
        ]
      : []),
  ];

  useEffect(() => {
    const sectionId = new URLSearchParams(search).get('section');
    if (!sectionId) return;
    const timeout = window.setTimeout(() => {
      document.getElementById(`help-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <Box maxWidth="md" mx="auto" data-testid="app-help-page">
      <Stack direction="row" alignItems="center" spacing={1.25} mb={1}>
        <HelpOutlineRounded color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={800} sx={{ fontSize: { xs: 26, sm: 32 } }}>
          {help.title}
        </Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 760 }}>
        {help.intro}
      </Typography>

      <Stack spacing={1.5}>
        {sections.map((section) => (
          <Card id={`help-section-${section.id}`} key={section.id} variant="outlined" sx={{ borderRadius: 2.5, scrollMarginTop: 88 }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Box sx={{ pt: 0.25, display: 'flex', flexShrink: 0 }}>{section.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={750} sx={{ fontSize: 17, mb: 0.5 }}>
                    {section.title}
                  </Typography>
                  <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, my: 0, color: 'text.secondary' }}>
                    {section.items.map((item) => (
                      <Typography key={item} component="li" variant="body2" sx={{ pl: 0.25, lineHeight: 1.55 }}>
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                  {section.path && section.action && (
                    <Button component={Link} href={section.path} size="small" sx={{ mt: 1, ml: -1 }}>
                      {section.action}
                    </Button>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Stack direction="row" spacing={1.25} mt={3}>
        <Button component={Link} href="/" variant="text" startIcon={<ArrowBackRounded />}>
          {help.backAction}
        </Button>
      </Stack>
    </Box>
  );
}
