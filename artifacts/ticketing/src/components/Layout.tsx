import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Badge,
  Divider,
  useTheme,
  useMediaQuery,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  ConfirmationNumber,
  AddBox,
  BarChart,
  Notifications,
  AccountCircle,
  Settings,
  FiberNew,
  SwapHoriz,
  Comment,
  AssignmentInd,
  PriorityHigh,
  Info,
  ChevronLeft,
  Circle,
  SmartToy,
  Brightness4,
  Brightness7,
  Business,
  CalendarMonth,
  AdminPanelSettings,
  Search,
} from '@mui/icons-material';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useColorMode } from '../App';
import { useLanguage } from '../contexts/LanguageContext';
import { useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getListNotificationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Lang } from '../i18n/translations';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import BugReportFab from './BugReportFab';
import BotDialog from './BotDialog';
import NotesConsole from './NotesConsole';
import CommandPalette from './CommandPalette';
import ShortcutsDialog from './ShortcutsDialog';

const drawerWidth = 264;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, updateUser } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const { t, lang, setLang } = useLanguage();
  const entityTerm = useEntityTerm();
  const [location, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebar_open') !== 'false'; } catch { return true; }
  });
  const [botOpen, setBotOpen] = useState(() => {
    try { return sessionStorage.getItem('td_bot_open') === '1'; } catch { return false; }
  });
  const [botUnreadCount, setBotUnreadCount] = useState(0);
  const [dailyReportUnread, setDailyReportUnread] = useState(0);

  // Persist bot open state so it survives page refresh
  const setBotOpenPersist = React.useCallback((val: boolean) => {
    try { sessionStorage.setItem('td_bot_open', val ? '1' : '0'); } catch { /* ignore */ }
    setBotOpen(val);
  }, []);

  // Poll for unread daily reports from colleagues — updates the FAB badge
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      fetch('/api/daily-reports/unread', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : { reports: [] })
        .then((d) => setDailyReportUnread((d.reports ?? []).length))
        .catch(() => { /* ignore */ });
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);

  const handleToggleAvailability = async () => {
    if (!user || availabilityUpdating) return;
    const newVal = !user.isAvailable;
    // Optimistic update: flip immediately so the UI responds at once
    updateUser({ ...user, isAvailable: newVal });
    setAvailabilityUpdating(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newVal }),
      });
      if (!res.ok) {
        // Rollback on failure
        updateUser({ ...user, isAvailable: !newVal });
      }
    } catch {
      // Rollback on network error
      updateUser({ ...user, isAvailable: !newVal });
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar_open', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const { data: notifications = [] } = useListNotifications({
    query: { enabled: !!user, refetchInterval: 40_000, refetchIntervalInBackground: false, staleTime: 20_000 } as any,
  });

  const markAllRead = useMarkAllNotificationsRead();
  const markNotificationRead = useMarkNotificationRead();
  const queryClient = useQueryClient();

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const [notifPrefs, setNotifPrefs] = useState<Record<string, { inApp: boolean; browser: boolean; sound: boolean }> | undefined>(undefined);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notification-preferences', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, { inApp: boolean; browser: boolean; sound: boolean }> = {};
      for (const p of data.preferences ?? []) {
        map[p.type] = { inApp: !!p.inApp, browser: !!p.browser, sound: !!p.sound };
      }
      setNotifPrefs(map);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);
  useEffect(() => {
    const h = () => loadPrefs();
    window.addEventListener('notif-prefs-updated', h);
    return () => window.removeEventListener('notif-prefs-updated', h);
  }, [loadPrefs]);

  const { requestPermission: requestBrowserPermission } = useBrowserNotifications(notifications as any[], !!user, notifPrefs);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestBrowserPermission();
    setNotifPermission(result as NotificationPermission);
  }, [requestBrowserPermission]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Cmd/Ctrl+K: open command palette (requires meta key — keep as raw listener)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // N → new ticket
  useKeyboardShortcut(['n', 'N'], useCallback(() => setLocation('/tickets/new'), [setLocation]));
  // ? → shortcuts dialog
  useKeyboardShortcut('?', useCallback(() => setShortcutsOpen((prev) => !prev), []));

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleNotifMenuOpen = (event: React.MouseEvent<HTMLElement>) => setNotifAnchorEl(event.currentTarget);
  const handleMenuClose = () => {
    setAnchorEl(null);
    setNotifAnchorEl(null);
  };
  const handleLogout = () => { handleMenuClose(); logout(); };
  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getListNotificationsQueryKey(), (current: any[] | undefined) =>
          current?.map((notification) => ({ ...notification, isRead: true })),
        );
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    });
    handleMenuClose();
  };
  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markNotificationRead.mutate({ id: notification.id }, {
        onSuccess: (updated) => {
          queryClient.setQueryData(getListNotificationsQueryKey(), (current: any[] | undefined) =>
            current?.map((item) => item.id === updated.id ? { ...item, isRead: true } : item),
          );
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        },
      });
    }
    handleMenuClose();
    if (notification.ticketId) setLocation(`/tickets/${notification.ticketId}`);
  };
  const toggleLang = () => setLang(lang === 'it' ? 'en' : 'it' as Lang);

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const recentNotifications = (notifications as any[]).slice(0, 6);
  const typeIconMap: Record<string, React.ReactNode> = {
    ticket_created: <FiberNew fontSize="small" sx={{ color: 'primary.main' }} />,
    ticket_status_changed: <SwapHoriz fontSize="small" sx={{ color: 'info.main' }} />,
    ticket_commented: <Comment fontSize="small" sx={{ color: 'success.main' }} />,
    ticket_assigned: <AssignmentInd fontSize="small" sx={{ color: 'secondary.main' }} />,
    ticket_priority_changed: <PriorityHigh fontSize="small" sx={{ color: 'warning.main' }} />,
    system: <Info fontSize="small" sx={{ color: 'text.secondary' }} />,
  };

  const menuItems = [
    { text: t.nav.dashboard,    icon: <Dashboard />,          path: '/',            adminOnly: false },
    { text: entityTerm.navAll,  icon: <ConfirmationNumber />,  path: '/tickets',     adminOnly: false },
    { text: entityTerm.navNew,  icon: <AddBox />,              path: '/tickets/new', adminOnly: false },
    { text: t.nav.reports,    icon: <BarChart />,            path: '/reports',     adminOnly: false },
    { text: t.nav.calendar,   icon: <CalendarMonth />,       path: '/calendar',    adminOnly: false },
    ...((user as any)?.clientsEnabled !== false
      ? [{ text: t.nav.clients, icon: <Business />, path: '/clients', adminOnly: false }]
      : []),
    { text: t.nav.settings,   icon: <Settings />,            path: '/settings',    adminOnly: false },
  ].filter((item) => !item.adminOnly || user?.role === 'admin');

  const roleLabel = user?.role === 'admin' ? t.role.admin : t.role.user;

  const isActive = (path: string) =>
    path === '/' ? location === '/' : location.startsWith(path);

  const drawer = (
    <Box data-tour="sidebar" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo + close button */}
      <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center',
          borderRadius: '8px',
          px: theme.palette.mode === 'dark' ? 1 : 0,
          py: theme.palette.mode === 'dark' ? 0.5 : 0,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.92)' : 'transparent',
        }}>
          <Box component="img" src="/taskdesk-logo.png" alt="TaskDesk" sx={{ height: 28, width: 'auto' }} />
        </Box>
        {!isMobile && (
          <IconButton size="small" onClick={toggleSidebar} sx={{ color: 'text.secondary' }}>
            <ChevronLeft />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Nav items */}
      <List sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              data-tour={item.path === '/tickets' ? 'tickets' : item.path === '/tickets/new' ? 'new-ticket' : undefined}
              onClick={() => { setLocation(item.path); if (isMobile) setMobileOpen(false); }}
              selected={isActive(item.path)}
              sx={{
                borderRadius: '10px',
                py: 1,
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  color: '#ffffff',
                  boxShadow: `0 4px 12px rgba(${parseInt(theme.palette.primary.main.slice(1,3),16)},${parseInt(theme.palette.primary.main.slice(3,5),16)},${parseInt(theme.palette.primary.main.slice(5,7),16)},0.25)`,
                  '& .MuiListItemIcon-root': { color: '#ffffff' },
                  '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
                },
                '&:not(.Mui-selected):hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon sx={{
                minWidth: 38,
                color: isActive(item.path) ? 'inherit' : 'text.secondary',
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontWeight: isActive(item.path) ? 700 : 500, fontSize: '0.9rem' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {(user as any)?.isSuperAdmin && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { setLocation('/superadmin'); if (isMobile) setMobileOpen(false); }}
                selected={isActive('/superadmin')}
                sx={{
                  borderRadius: '10px',
                  py: 1,
                  '&.Mui-selected': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    color: '#ffffff',
                    boxShadow: `0 4px 12px rgba(${parseInt(theme.palette.primary.main.slice(1,3),16)},${parseInt(theme.palette.primary.main.slice(3,5),16)},${parseInt(theme.palette.primary.main.slice(5,7),16)},0.25)`,
                    '& .MuiListItemIcon-root': { color: '#ffffff' },
                    '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
                  },
                  '&:not(.Mui-selected):hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isActive('/superadmin') ? 'inherit' : 'text.secondary' }}>
                  <AdminPanelSettings />
                </ListItemIcon>
                <ListItemText
                  primary={t.nav.superadmin}
                  primaryTypographyProps={{ fontWeight: isActive('/superadmin') ? 700 : 500, fontSize: '0.9rem' }}
                />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>

      {(user as any)?.clientsEnabled !== false && <NotesConsole />}

      {/* User card at bottom */}
      <Box sx={{ p: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5, borderRadius: '12px',
          bgcolor: 'background.default',
          border: '1px solid', borderColor: 'divider',
        }}>
          <Avatar
            src={(user as any)?.avatarUrl ?? undefined}
            sx={{
              width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700,
            }}
          >
            {!(user as any)?.avatarUrl && (user?.name?.charAt(0) || <AccountCircle />)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" fontWeight={700} noWrap display="block" sx={{ lineHeight: 1.3 }}>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
              {(user as any)?.organizationName ?? roleLabel}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: '48px !important', sm: '64px !important' } }}>
          <IconButton
            color="inherit"
            aria-label="apri menu"
            edge="start"
            onClick={isMobile ? handleDrawerToggle : toggleSidebar}
            sx={{ mr: 1, ...(isMobile ? {} : { display: sidebarOpen ? 'none' : 'inline-flex' }) }}
          >
            <MenuIcon />
          </IconButton>

          {isMobile && (() => {
            const active = menuItems.find(item =>
              item.path === '/' ? location === '/' : location.startsWith(item.path)
            );
            return active ? (
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flexGrow: 1, ml: 0.5 }}>
                {active.text}
              </Typography>
            ) : location === '/notifications' ? (
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flexGrow: 1, ml: 0.5 }}>
                {t.nav.notifications}
              </Typography>
            ) : <Box sx={{ flexGrow: 1 }} />;
          })()}

          {!isMobile && <Box sx={{ flexGrow: 1 }} />}

          {/* Search button */}
          <Tooltip title={t.commandPalette.tooltip}>
            <IconButton
              onClick={() => setCommandPaletteOpen(true)}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              <Search fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Dark mode toggle */}
          <Tooltip title={mode === 'dark' ? t.nav.lightMode : t.nav.darkMode}>
            <IconButton
              onClick={toggleColorMode}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {mode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Language toggle */}
          <Button
            onClick={toggleLang}
            size="small"
            sx={{
              minWidth: 0, px: 1.5,
              fontWeight: 700, fontSize: '0.7rem',
              border: '1.5px solid', borderColor: 'divider',
              borderRadius: '8px', letterSpacing: '0.05em',
              color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {lang === 'it' ? 'EN' : 'IT'}
          </Button>

          {/* Availability toggle */}
          <Tooltip title={user?.isAvailable ? t.availability.toggleTooltipAvailable : t.availability.toggleTooltipUnavailable}>
            <Chip
              size="small"
              icon={<Circle sx={{ fontSize: '10px !important', color: user?.isAvailable ? 'success.main' : 'text.disabled' }} />}
              label={user?.isAvailable ? t.availability.available : t.availability.unavailable}
              onClick={handleToggleAvailability}
              disabled={availabilityUpdating}
              variant="outlined"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                height: 26,
                borderColor: user?.isAvailable ? 'success.main' : 'divider',
                color: user?.isAvailable ? 'success.main' : 'text.secondary',
                cursor: 'pointer',
                display: { xs: 'none', sm: 'inline-flex' },
                '&:hover': { opacity: 0.8 },
              }}
            />
          </Tooltip>

          {/* Notifications */}
          <IconButton
            data-tour="notifications"
            onClick={handleNotifMenuOpen}
            size="small"
            aria-label={t.nav.notifications}
            title={t.nav.notifications}
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
              <Notifications fontSize="small" />
            </Badge>
          </IconButton>

          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                width: { xs: 'calc(100vw - 24px)', sm: 460 },
                maxWidth: 'calc(100vw - 24px)',
                maxHeight: 'min(78vh, 680px)',
                borderRadius: '18px',
                mt: 1,
                overflow: 'hidden',
              },
            }}
          >
            <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                  {t.notifications.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {unreadCount > 0 ? `${unreadCount} ${t.notifications.unreadTotal}` : t.nav.noNotifications}
                </Typography>
              </Box>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={handleMarkAllRead}
                  sx={{ flexShrink: 0, mt: -0.25, fontWeight: 700, textTransform: 'none' }}
                >
                  {t.nav.markAllRead}
                </Button>
              )}
            </Box>

            {notifPermission === 'default' && (
              <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  startIcon={<Notifications fontSize="small" />}
                  onClick={handleRequestPermission}
                  sx={{ py: 1, fontSize: '0.78rem', textTransform: 'none', borderStyle: 'dashed', borderRadius: '10px' }}
                >
                  Abilita notifiche browser
                </Button>
              </Box>
            )}
            {notifPermission === 'granted' && (
              <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 1.25 }}>
                <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                  ✓ Notifiche browser attive
                </Typography>
              </Box>
            )}

            <Divider />
            <Box sx={{ maxHeight: { xs: '48vh', sm: 420 }, overflowY: 'auto', py: 0.5 }}>
              {notifications.length === 0 ? (
                <MenuItem disabled sx={{ justifyContent: 'center', py: 5 }}>
                  <Typography variant="body2" color="text.secondary">{t.nav.noNotifications}</Typography>
                </MenuItem>
              ) : (
                recentNotifications.map((notification: any) => {
                  const ntype = notification.type ?? 'system';
                  return (
                    <MenuItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        whiteSpace: 'normal',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        px: { xs: 2, sm: 2.5 },
                        py: 1.75,
                        minHeight: 82,
                        bgcolor: notification.isRead ? 'transparent' : (theme.palette.mode === 'dark' ? 'rgba(37,99,235,.12)' : '#f7faff'),
                        borderLeft: notification.isRead ? '3px solid transparent' : '3px solid',
                        borderLeftColor: notification.isRead ? 'transparent' : 'primary.main',
                        '&:hover': { bgcolor: notification.isRead ? 'action.hover' : (theme.palette.mode === 'dark' ? 'rgba(37,99,235,.2)' : '#edf4ff') },
                      }}
                    >
                      <Box
                        sx={{
                          mt: 0.15,
                          width: 38,
                          height: 38,
                          borderRadius: '12px',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          bgcolor: notification.isRead ? 'action.hover' : (theme.palette.mode === 'dark' ? 'rgba(96,165,250,.15)' : '#e5efff'),
                        }}
                      >
                        {typeIconMap[ntype] ?? typeIconMap.system}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.45, fontSize: '0.64rem', mb: 0.45 }}
                        >
                          {(t.nav.notifTypes as any)[ntype] ?? ntype}
                        </Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.45, fontWeight: notification.isRead ? 500 : 700, overflowWrap: 'anywhere' }}>
                          {notification.notificationText}
                        </Typography>
                        {notification.createdAt && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', mt: 0.65, display: 'block' }}>
                            {new Date(notification.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  );
                })
              )}
            </Box>

            <Divider />
            <MenuItem
              onClick={() => { handleMenuClose(); setLocation('/notifications'); }}
              sx={{ justifyContent: 'center', py: 1.5, color: 'primary.main', fontWeight: 800 }}
            >
              {t.notifications.viewAll}
            </MenuItem>
          </Menu>

          {/* Profile */}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', ml: 0.5, p: 0.5, borderRadius: '10px', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={handleProfileMenuOpen}
          >
            <Box sx={{ mr: 0.5, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="caption" fontWeight={700} display="block" lineHeight={1.3}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{roleLabel}</Typography>
            </Box>
            <Avatar
              src={(user as any)?.avatarUrl ?? undefined}
              sx={{
                width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700,
              }}
            >
              {!(user as any)?.avatarUrl && (user?.name?.charAt(0) || <AccountCircle />)}
            </Avatar>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { borderRadius: '14px', mt: 1, minWidth: 200 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" fontWeight={700}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={toggleColorMode} sx={{ fontWeight: 500 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {mode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
                {mode === 'dark' ? t.nav.lightMode : t.nav.darkMode}
              </Box>
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', fontWeight: 600 }}>
              {t.nav.logout}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { sm: sidebarOpen ? drawerWidth : 0 },
          flexShrink: { sm: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              overflowX: 'hidden',
              transform: sidebarOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`,
              transition: theme.transitions.create('transform', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          overflowX: 'hidden',
          p: { xs: 1, sm: 3, md: 4 },
          width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          mt: { xs: '48px', sm: '64px' },
          bgcolor: 'background.default',
          minHeight: { xs: 'calc(100vh - 48px)', sm: 'calc(100vh - 64px)' },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>

      <BugReportFab />

      <Tooltip title={t.bot.fabTooltip} placement="left">
        <Fab
          color="primary"
          onClick={() => {
            setBotOpenPersist(true);
            setBotUnreadCount(0);
          }}
          sx={{
            position: 'fixed',
            bottom: 88,
            right: 24,
            zIndex: theme.zIndex.speedDial,
          }}
        >
          <Badge
            badgeContent={botUnreadCount + dailyReportUnread}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
          >
            <SmartToy />
          </Badge>
        </Fab>
      </Tooltip>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <BotDialog
        open={botOpen}
        unreadCount={botUnreadCount}
        dailyReportUnread={dailyReportUnread}
        onClose={() => { setBotOpenPersist(false); setBotUnreadCount(0); }}
        onExpand={() => setBotUnreadCount(0)}
        onBotMessage={() => setBotUnreadCount((c) => c + 1)}
        onDailyReportsRead={() => {
              // Re-fetch the actual count so the badge is always accurate
              fetch('/api/daily-reports/unread', { credentials: 'include' })
                .then((r) => r.ok ? r.json() : { reports: [] })
                .then((d) => setDailyReportUnread((d.reports ?? []).length))
                .catch(() => {});
            }}
        onCreateTicket={(title, description, category, resource, location) => {
          setBotOpenPersist(false);
          setBotUnreadCount(0);
          const params = new URLSearchParams();
          if (title) params.set('title', title);
          if (description) params.set('description', description);
          if (category) params.set('category', category);
          if (resource) params.set('resource', resource);
          if (location) params.set('location', location);
          setLocation(`/tickets/new?${params.toString()}`);
        }}
        onViewTicket={(id) => {
          setBotOpenPersist(false);
          setBotUnreadCount(0);
          setLocation(`/tickets/${id}`);
        }}
      />
    </Box>
  );
}
