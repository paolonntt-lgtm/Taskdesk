import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  ConfirmationNumber,
  AddBox,
  BarChart,
  Notifications,
  AccountCircle,
  LightMode,
  DarkMode,
  People,
  CreditCard,
  Settings,
  FiberNew,
  SwapHoriz,
  Comment,
  AssignmentInd,
  PriorityHigh,
  Info,
} from '@mui/icons-material';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useListNotifications, useMarkAllNotificationsRead } from '@workspace/api-client-react';
import type { Lang } from '../i18n/translations';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';

const drawerWidth = 264;

interface LayoutProps {
  children: React.ReactNode;
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}

export default function Layout({ children, toggleTheme, mode }: LayoutProps) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [location, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);

  const { data: notifications = [] } = useListNotifications({
    query: { enabled: !!user, refetchInterval: 60_000, refetchIntervalInBackground: false, staleTime: 30_000 } as any,
  });

  const markAllRead = useMarkAllNotificationsRead();

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

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleNotifMenuOpen = (event: React.MouseEvent<HTMLElement>) => setNotifAnchorEl(event.currentTarget);
  const handleMenuClose = () => { setAnchorEl(null); setNotifAnchorEl(null); };
  const handleLogout = () => { handleMenuClose(); logout(); };
  const handleMarkAllRead = () => { markAllRead.mutate(); handleMenuClose(); };
  const toggleLang = () => setLang(lang === 'it' ? 'en' : 'it' as Lang);

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const typeIconMap: Record<string, React.ReactNode> = {
    ticket_created: <FiberNew fontSize="small" sx={{ color: 'primary.main' }} />,
    ticket_status_changed: <SwapHoriz fontSize="small" sx={{ color: 'info.main' }} />,
    ticket_commented: <Comment fontSize="small" sx={{ color: 'success.main' }} />,
    ticket_assigned: <AssignmentInd fontSize="small" sx={{ color: 'secondary.main' }} />,
    ticket_priority_changed: <PriorityHigh fontSize="small" sx={{ color: 'warning.main' }} />,
    system: <Info fontSize="small" sx={{ color: 'text.secondary' }} />,
  };


  const menuItems = [
    { text: t.nav.dashboard,  icon: <Dashboard />,          path: '/',        adminOnly: false },
    { text: t.nav.allTickets, icon: <ConfirmationNumber />,  path: '/tickets', adminOnly: false },
    { text: t.nav.newTicket,  icon: <AddBox />,              path: '/tickets/new', adminOnly: false },
    { text: t.nav.reports,    icon: <BarChart />,            path: '/reports', adminOnly: false },
    { text: t.nav.users,      icon: <People />,              path: '/users',   adminOnly: true },
    { text: t.nav.billing,    icon: <CreditCard />,          path: '/billing', adminOnly: true },
    { text: t.nav.settings,   icon: <Settings />,            path: '/settings', adminOnly: false },
  ].filter((item) => !item.adminOnly || user?.role === 'admin');

  const roleLabel = user?.role === 'admin' ? t.role.admin : t.role.user;

  const isActive = (path: string) =>
    path === '/' ? location === '/' : location.startsWith(path);

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box component="img" src="/taskdesk-logo.png" alt="TaskDesk" sx={{ height: 36, width: 'auto' }} />
        </Box>
      </Box>

      <Divider />

      {/* Nav items */}
      <List sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => { setLocation(item.path); if (isMobile) setMobileOpen(false); }}
              selected={isActive(item.path)}
              sx={{
                borderRadius: '10px',
                py: 1,
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  '& .MuiListItemIcon-root': { color: '#ffffff' },
                  '&:hover': { background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)' },
                },
                '&:not(.Mui-selected):hover': {
                  bgcolor: mode === 'light' ? '#f3f4f6' : 'rgba(255,255,255,0.05)',
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
      </List>

      {/* User card at bottom */}
      <Box sx={{ p: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5, borderRadius: '12px',
          bgcolor: mode === 'light' ? '#f8faff' : 'rgba(255,255,255,0.04)',
          border: '1px solid', borderColor: mode === 'light' ? '#f3f4f6' : 'rgba(255,255,255,0.07)',
        }}>
          <Avatar
            src={(user as any)?.avatarUrl ?? undefined}
            sx={{
              width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700,
              background: (user as any)?.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
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
        sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            aria-label="apri menu"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

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

          {/* Dark/light toggle */}
          <IconButton
            onClick={toggleTheme}
            size="small"
            title={mode === 'light' ? t.nav.darkMode : t.nav.lightMode}
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            {mode === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
          </IconButton>

          {/* Notifications */}
          <IconButton
            onClick={handleNotifMenuOpen}
            size="small"
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
            PaperProps={{ sx: { width: 340, maxHeight: 420, borderRadius: '16px', mt: 1 } }}
          >
            <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight={700}>{t.nav.notifications}</Typography>
              {unreadCount > 0 && (
                <Typography
                  variant="caption" color="primary" fontWeight={700}
                  sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={handleMarkAllRead}
                >
                  {t.nav.markAllRead}
                </Typography>
              )}
            </Box>
            {notifPermission === 'default' && (
              <Box sx={{ px: 2, pb: 1 }}>
                <Button size="small" variant="outlined" fullWidth startIcon={<Notifications fontSize="small" />}
                  onClick={handleRequestPermission}
                  sx={{ fontSize: '0.75rem', textTransform: 'none', borderStyle: 'dashed', borderRadius: '10px' }}>
                  Abilita notifiche browser
                </Button>
              </Box>
            )}
            {notifPermission === 'granted' && (
              <Box sx={{ px: 2, pb: 0.5 }}>
                <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                  ✓ Notifiche browser attive
                </Typography>
              </Box>
            )}
            <Divider />
            {notifications.length === 0 ? (
              <MenuItem disabled sx={{ justifyContent: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">{t.nav.noNotifications}</Typography>
              </MenuItem>
            ) : (
              notifications.map((n: any) => {
                const ntype = (n.type ?? 'system') as string;
                return (
                  <MenuItem
                    key={n.id}
                    onClick={() => { handleMenuClose(); if (n.ticketId) setLocation(`/tickets/${n.ticketId}`); }}
                    sx={{
                      whiteSpace: 'normal', py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1.25,
                      bgcolor: n.isRead ? 'transparent' : 'primary.50',
                      borderLeft: n.isRead ? 'none' : '3px solid',
                      borderLeftColor: 'primary.main',
                    }}
                  >
                    <Box sx={{ mt: '2px', flexShrink: 0 }}>{typeIconMap[ntype] ?? typeIconMap.system}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.65rem', mb: 0.25 }}>
                        {(t.nav.notifTypes as any)[ntype] ?? ntype}
                      </Typography>
                      <Typography variant="body2">{n.notificationText}</Typography>
                    </Box>
                  </MenuItem>
                );
              })
            )}
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
                background: (user as any)?.avatarUrl ? 'transparent' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
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
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', fontWeight: 600, mt: 0.5 }}>
              {t.nav.logout}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
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
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
