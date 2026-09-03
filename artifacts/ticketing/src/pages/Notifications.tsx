import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AccessTime,
  ArrowForward,
  Check,
  CheckCircleOutline,
  ConfirmationNumberOutlined,
  DoneAll,
  ErrorOutline,
  InboxOutlined,
  MarkEmailReadOutlined,
  NotificationsActiveOutlined,
  Refresh,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkNotificationRead,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';

type Filter = 'all' | 'unread' | 'read';

interface NotificationItem {
  id: number;
  ticketId?: number | null;
  notificationText: string;
  isRead: boolean;
  createdAt: string;
}

function dateLabel(value: string, lang: 'it' | 'en', today: string, yesterday: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, now)) return today;
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  if (sameDay(date, previous)) return yesterday;
  return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function timeLabel(value: string, lang: 'it' | 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationSkeleton() {
  return (
    <Stack spacing={1.25} data-testid="notifications-loading">
      {[1, 2, 3, 4].map((item) => (
        <Card key={item} sx={{ borderRadius: 3, boxShadow: 'none' }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Skeleton variant="rounded" width={42} height={42} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="28%" height={16} />
                <Skeleton width="88%" height={23} />
                <Skeleton width="24%" height={15} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const notificationsQuery = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      staleTime: 20_000,
      refetchOnWindowFocus: true,
    },
  });
  const markRead = useMarkNotificationRead();
  const notifications = (notificationsQuery.data ?? []) as NotificationItem[];

  const counts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((notification) => !notification.isRead).length,
    read: notifications.filter((notification) => notification.isRead).length,
  }), [notifications]);

  const filteredNotifications = useMemo(() => {
    const result = filter === 'unread'
      ? notifications.filter((notification) => !notification.isRead)
      : filter === 'read'
        ? notifications.filter((notification) => notification.isRead)
        : notifications;
    return [...result].sort((a, b) => {
      const unreadOrder = Number(a.isRead) - Number(b.isRead);
      if (unreadOrder !== 0) return unreadOrder;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, notifications]);

  const handleMarkRead = (notification: NotificationItem) => {
    if (notification.isRead || markingId !== null) return;
    setMarkingId(notification.id);
    markRead.mutate({ id: notification.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        setMarkingId(null);
      },
      onError: () => setMarkingId(null),
    });
  };

  const handleOpenTicket = (notification: NotificationItem) => {
    if (!notification.isRead) handleMarkRead(notification);
    if (notification.ticketId) setLocation(`/tickets/${notification.ticketId}`);
  };

  const emptyCopy = filter === 'unread'
    ? { title: t.notifications.noUnreadTitle, description: t.notifications.noUnreadDescription }
    : filter === 'read'
      ? { title: t.notifications.noReadTitle, description: t.notifications.noReadDescription }
      : { title: t.notifications.noNotificationsTitle, description: t.notifications.noNotificationsDescription };

  return (
    <Box
      sx={{
        maxWidth: 1160,
        mx: 'auto',
        pb: { xs: 4, sm: 7 },
        animation: 'tk-fadeUp 0.45s cubic-bezier(.16,1,.3,1) both',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: { xs: 2.5, sm: 3.5 },
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.14em', fontSize: '0.68rem' }}
          >
            TaskDesk / {t.nav.notifications}
          </Typography>
          <Typography
            variant="h3"
            data-testid="text-notifications-title"
            sx={{ mt: 0.35, fontSize: { xs: '1.8rem', sm: '2.35rem' }, lineHeight: 1.1 }}
          >
            {t.notifications.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.8, maxWidth: 550, fontSize: { xs: '0.88rem', sm: '0.96rem' } }}>
            {t.notifications.subtitle}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => notificationsQuery.refetch()}
          disabled={notificationsQuery.isFetching}
          data-testid="button-refresh-notifications"
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' }, borderRadius: 2.5, px: 2, py: 1.1 }}
        >
          {notificationsQuery.isFetching ? t.notifications.refreshing : t.notifications.refresh}
        </Button>
      </Box>

      <Card
        sx={{
          mb: { xs: 2, sm: 3 },
          overflow: 'hidden',
          borderRadius: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'rgba(37, 99, 235, 0.16)',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(110deg, rgba(37,99,235,.2), rgba(124,58,237,.12))'
            : 'linear-gradient(110deg, #eef5ff 0%, #f4f1ff 100%)',
          boxShadow: 'none',
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2.25, sm: 4 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flex: 1 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '15px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  flexShrink: 0,
                }}
              >
                <NotificationsActiveOutlined />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t.notifications.attentionTitle}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: 410 }}>
                  {t.notifications.attentionDescription}
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={{ xs: 2.5, sm: 3.5 }} sx={{ pl: { xs: 0, sm: 1 } }}>
              <Box data-testid="stat-unread-notifications">
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'primary.main' }}>
                  {counts.unread}
                </Typography>
                <Typography variant="caption" color="text.secondary">{t.notifications.unreadTotal}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', lineHeight: 1, fontWeight: 700 }}>
                  {counts.all}
                </Typography>
                <Typography variant="caption" color="text.secondary">{t.notifications.total}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', lineHeight: 1, fontWeight: 700, color: 'success.main' }}>
                  {counts.read}
                </Typography>
                <Typography variant="caption" color="text.secondary">{t.notifications.readTotal}</Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: { xs: 3, sm: 4 }, boxShadow: 'none', overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 1, sm: 2 }, pt: { xs: 0.5, sm: 1 }, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={filter}
            onChange={(_, value: Filter) => setFilter(value)}
            variant="fullWidth"
            aria-label={t.nav.notifications}
            sx={{
              minHeight: 52,
              '& .MuiTabs-indicator': { height: 3, borderRadius: 3 },
              '& .MuiTab-root': { minHeight: 52, fontWeight: 700, fontSize: { xs: '0.76rem', sm: '0.84rem' } },
            }}
          >
            <Tab value="all" label={`${t.notifications.all} · ${counts.all}`} data-testid="tab-notifications-all" />
            <Tab value="unread" label={`${t.notifications.unread} · ${counts.unread}`} data-testid="tab-notifications-unread" />
            <Tab value="read" label={`${t.notifications.read} · ${counts.read}`} data-testid="tab-notifications-read" />
          </Tabs>
        </Box>

        <Box sx={{ p: { xs: 1.25, sm: 2 } }}>
          {notificationsQuery.isLoading ? (
            <NotificationSkeleton />
          ) : notificationsQuery.isError ? (
            <Alert
              severity="error"
              icon={<ErrorOutline />}
              action={
                <Button color="inherit" size="small" onClick={() => notificationsQuery.refetch()} data-testid="button-retry-notifications">
                  {t.notifications.retry}
                </Button>
              }
              sx={{ alignItems: 'center', border: '1px solid', borderColor: 'error.main' }}
            >
              <Typography variant="body2" fontWeight={700}>{t.notifications.errorTitle}</Typography>
              <Typography variant="caption">{t.notifications.errorDescription}</Typography>
            </Alert>
          ) : filteredNotifications.length === 0 ? (
            <Box
              sx={{ py: { xs: 7, sm: 10 }, px: 2, textAlign: 'center', color: 'text.secondary' }}
              data-testid="empty-notifications"
            >
              <Box sx={{ width: 58, height: 58, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', borderRadius: '18px', bgcolor: 'action.hover', color: 'primary.main' }}>
                {filter === 'unread' ? <DoneAll sx={{ fontSize: 29 }} /> : <InboxOutlined sx={{ fontSize: 30 }} />}
              </Box>
              <Typography variant="h6" color="text.primary" sx={{ fontWeight: 800 }}>{emptyCopy.title}</Typography>
              <Typography variant="body2" sx={{ mt: 0.65 }}>{emptyCopy.description}</Typography>
            </Box>
          ) : (
            <Stack spacing={1.25} data-testid="notifications-list">
              {filteredNotifications.map((notification) => {
                const isMarking = markingId === notification.id;
                const date = dateLabel(notification.createdAt, lang, t.notifications.today, t.notifications.yesterday);
                return (
                  <Card
                    key={notification.id}
                    data-testid={`card-notification-${notification.id}`}
                    onClick={() => handleOpenTicket(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenTicket(notification);
                      }
                    }}
                    sx={{
                      borderRadius: 3,
                      boxShadow: 'none',
                      cursor: 'pointer',
                      bgcolor: notification.isRead ? 'background.paper' : (theme.palette.mode === 'dark' ? 'rgba(37,99,235,.12)' : '#f7faff'),
                      border: '1px solid',
                      borderColor: notification.isRead ? 'divider' : 'rgba(37,99,235,.28)',
                      position: 'relative',
                      transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: theme.palette.mode === 'dark' ? '0 7px 20px rgba(0,0,0,.18)' : '0 7px 20px rgba(36,55,90,.08)',
                        borderColor: notification.isRead ? 'primary.light' : 'primary.main',
                      },
                    }}
                  >
                    <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, '&:last-child': { pb: { xs: 1.75, sm: 2.25 } } }}>
                      <Stack direction="row" spacing={{ xs: 1.25, sm: 2 }} alignItems="flex-start">
                        <Box
                          sx={{
                            width: { xs: 38, sm: 44 },
                            height: { xs: 38, sm: 44 },
                            mt: 0.1,
                            borderRadius: '13px',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            color: notification.isRead ? 'text.secondary' : 'primary.main',
                            bgcolor: notification.isRead ? 'action.hover' : (theme.palette.mode === 'dark' ? 'rgba(96,165,250,.15)' : '#e5efff'),
                          }}
                        >
                          {notification.isRead ? <MarkEmailReadOutlined fontSize="small" /> : <NotificationsActiveOutlined fontSize="small" />}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.45, flexWrap: 'wrap' }}>
                            {!notification.isRead && (
                              <Chip
                                label={t.notifications.unread}
                                size="small"
                                color="primary"
                                data-testid={`status-notification-unread-${notification.id}`}
                                sx={{ height: 22, fontSize: '0.68rem', '& .MuiChip-label': { px: 1 } }}
                              />
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.45, fontWeight: 700 }}>
                              <AccessTime sx={{ fontSize: 14 }} />
                              {date} · {timeLabel(notification.createdAt, lang)}
                            </Typography>
                          </Stack>
                          <Typography
                            variant="body1"
                            data-testid={`text-notification-${notification.id}`}
                            sx={{ fontWeight: notification.isRead ? 500 : 700, lineHeight: 1.45, overflowWrap: 'anywhere' }}
                          >
                            {notification.notificationText}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 0.8 }}>
                            {notification.ticketId ? (
                              <>
                                <Chip
                                  icon={<ConfirmationNumberOutlined sx={{ fontSize: '15px !important' }} />}
                                  label={t.notifications.ticketLabel(notification.ticketId)}
                                  size="small"
                                  variant="outlined"
                                  data-testid={`chip-notification-ticket-${notification.id}`}
                                  sx={{ height: 26, borderColor: 'divider', color: 'text.secondary' }}
                                />
                                <Button
                                  size="small"
                                  endIcon={<ArrowForward sx={{ fontSize: '16px !important' }} />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenTicket(notification);
                                  }}
                                  data-testid={`button-open-ticket-${notification.id}`}
                                  sx={{ px: 0.7, minWidth: 0, fontSize: '0.76rem' }}
                                >
                                  {t.notifications.openTicket}
                                </Button>
                              </>
                            ) : (
                              <Typography variant="caption" color="text.disabled">{t.notifications.notificationLabel}</Typography>
                            )}
                          </Stack>
                        </Box>
                        <Tooltip title={notification.isRead ? t.notifications.markedRead : t.notifications.markRead}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMarkRead(notification);
                              }}
                              disabled={notification.isRead || isMarking}
                              aria-label={notification.isRead ? t.notifications.markedRead : t.notifications.markRead}
                              data-testid={`button-mark-notification-read-${notification.id}`}
                              sx={{
                                mt: -0.4,
                                color: notification.isRead ? 'success.main' : 'text.secondary',
                                bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                '&:hover': { color: 'primary.main', bgcolor: 'action.selected' },
                              }}
                            >
                              {isMarking ? <Skeleton variant="circular" width={20} height={20} /> : notification.isRead ? <CheckCircleOutline fontSize="small" /> : <Check fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>
      </Card>
      <Divider sx={{ mt: 3, opacity: 0.5 }} />
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.25, textAlign: 'right' }}>
        {notifications.length} {t.notifications.total}
      </Typography>
    </Box>
  );
}