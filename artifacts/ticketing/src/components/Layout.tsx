import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import {
  ArrowForwardRounded,
  AutoAwesomeRounded,
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
  AccessTime,
  PriorityHigh,
  Info,
  ChevronLeft,
  Brightness4,
  Brightness7,
  Business,
  CalendarMonth,
  Campaign,
  AdminPanelSettings,
  Search,
  BugReport,
  WhatsApp,
  VisibilityOffOutlined,
} from '@mui/icons-material';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useColorMode } from '../App';
import { useLanguage } from '../contexts/LanguageContext';
import { useListNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, getListNotificationsQueryKey, useGetPersonalTimeTrackingReport } from '@workspace/api-client-react';
import { canAccessPersonalTimeReport, shouldShowPersonalTimeReport } from '../lib/personalTimeReportAccess';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Lang } from '../i18n/translations';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import BugReportDialog from './BugReportDialog';
import BotDialog from './BotDialog';
import { AlbertAvatarIcon } from './AlbertAvatarIcon';
import NotesConsole from './NotesConsole';
import CommandPalette from './CommandPalette';
import ShortcutsDialog from './ShortcutsDialog';
import { trackEvent } from '../lib/analytics';
import AnnouncementsPopup from './AnnouncementsPopup';
import WhatsAppAnnouncementDialog from './WhatsAppAnnouncementDialog';

const drawerWidth = 264;
const botFabPositionStorageKey = 'td_bot_fab_position_v1';
const taskdeskWhatsAppNumber = '393203177882';

function hasSeenAnnouncement(key: string): boolean {
  try {
    if (localStorage.getItem(key) === 'seen') return true;
  } catch {
    // Try session storage when persistent storage is unavailable.
  }
  try {
    return sessionStorage.getItem(key) === 'seen';
  } catch {
    return false;
  }
}

interface BotFabPosition {
  left: number;
  top: number;
}

interface BotFabDragState extends BotFabPosition {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function readBotFabPosition(): BotFabPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(botFabPositionStorageKey) ?? 'null');
    return Number.isFinite(value?.left) && value.left >= 0 &&
      Number.isFinite(value?.top) && value.top >= 0
      ? { left: value.left, top: value.top }
      : null;
  } catch {
    return null;
  }
}

function saveBotFabPosition(position: BotFabPosition): void {
  try {
    localStorage.setItem(botFabPositionStorageKey, JSON.stringify(position));
  } catch {
    // The drag still works for this session when storage is unavailable.
  }
}

function constrainBotFabPosition(
  left: number,
  top: number,
  width: number,
  height: number,
): BotFabPosition {
  const maxLeft = Math.max(0, window.innerWidth - width);
  const maxTop = Math.max(0, window.innerHeight - height);
  return {
    left: Math.round(Math.min(maxLeft, Math.max(0, left))),
    top: Math.round(Math.min(maxTop, Math.max(0, top))),
  };
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const { t, lang, setLang } = useLanguage();
  const entityTerm = useEntityTerm();
  const [location, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: timeTrackingSettings } = useQuery<{ timeTrackingModuleEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    enabled: user?.role === 'admin',
    staleTime: 5 * 60_000,
  });
  const personalTimeReport = useGetPersonalTimeTrackingReport(undefined, {
    query: {
      queryKey: ['personal-time-report-nav', user?.id],
      enabled: !!user && canAccessPersonalTimeReport(user.role),
      staleTime: 60_000,
      refetchInterval: 120_000,
    },
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebar_open') !== 'false'; } catch { return true; }
  });
  const [botOpen, setBotOpen] = useState(() => {
    try { return sessionStorage.getItem('td_bot_open') === '1'; } catch { return false; }
  });
  const [botUnreadCount, setBotUnreadCount] = useState(0);
  const [botFabPosition, setBotFabPosition] = useState<BotFabPosition | null>(() => readBotFabPosition());
  const [isDraggingBotFab, setIsDraggingBotFab] = useState(false);
  const botFabRef = React.useRef<HTMLButtonElement | null>(null);
  const botFabDragRef = React.useRef<BotFabDragState | null>(null);
  const botFabDraggedRef = React.useRef(false);

  // Persist bot open state so it survives page refresh
  const setBotOpenPersist = React.useCallback((val: boolean) => {
    try { sessionStorage.setItem('td_bot_open', val ? '1' : '0'); } catch { /* ignore */ }
    setBotOpen(val);
  }, []);

  const handleBotFabPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isMobile || event.button !== 0) return;
    botFabDraggedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    botFabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Continue with pointer events on the button if capture is unavailable.
    }
  };

  const handleBotFabPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = botFabDragRef.current;
    if (!isMobile || !drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;

    drag.moved = true;
    botFabDraggedRef.current = true;
    setIsDraggingBotFab(true);
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setBotFabPosition(constrainBotFabPosition(
      drag.left + deltaX,
      drag.top + deltaY,
      rect.width,
      rect.height,
    ));
  };

  const handleBotFabPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = botFabDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = constrainBotFabPosition(
        drag.left + event.clientX - drag.startX,
        drag.top + event.clientY - drag.startY,
        rect.width,
        rect.height,
      );
      setBotFabPosition(position);
      saveBotFabPosition(position);
      botFabDraggedRef.current = true;
    }
    botFabDragRef.current = null;
    setIsDraggingBotFab(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleBotFabPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = botFabDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = constrainBotFabPosition(
        drag.left + event.clientX - drag.startX,
        drag.top + event.clientY - drag.startY,
        rect.width,
        rect.height,
      );
      setBotFabPosition(position);
      saveBotFabPosition(position);
    }
    botFabDragRef.current = null;
    botFabDraggedRef.current = false;
    setIsDraggingBotFab(false);
  };

  const handleBotFabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isMobile) return;
    const movementByKey: Record<string, [number, number]> = {
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
    };
    const movement = movementByKey[event.key];
    if (!movement) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const current = botFabPosition ?? { left: rect.left, top: rect.top };
    const position = constrainBotFabPosition(
      current.left + movement[0],
      current.top + movement[1],
      rect.width,
      rect.height,
    );
    setBotFabPosition(position);
    saveBotFabPosition(position);
  };

  useEffect(() => {
    if (!isMobile) return;
    const constrainSavedPosition = () => {
      const rect = botFabRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBotFabPosition((current) => {
        if (!current) return current;
        const position = constrainBotFabPosition(current.left, current.top, rect.width, rect.height);
        if (position.left === current.left && position.top === current.top) return current;
        saveBotFabPosition(position);
        return position;
      });
    };
    constrainSavedPosition();
    window.addEventListener('resize', constrainSavedPosition);
    return () => window.removeEventListener('resize', constrainSavedPosition);
  }, [isMobile]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [albertAnnouncementOpen, setAlbertAnnouncementOpen] = useState(false);
  const [whatsappAnnouncementOpen, setWhatsAppAnnouncementOpen] = useState(false);
  const dismissedAlbertAnnouncementUsersRef = useRef(new Set<string>());
  const dismissedWhatsAppAnnouncementUsersRef = useRef(new Set<string>());
  const canShowAlbertAnnouncement = !!user &&
    !((user as any).registeredViaInvite && !(user as any).tourDone);

  useEffect(() => {
    if (!canShowAlbertAnnouncement || !user || botOpen) return;
    const userId = String(user.id);
    if (dismissedAlbertAnnouncementUsersRef.current.has(userId)) return;

    const storageKey = `td_albert_reports_announcement_v1:${userId}`;
    let hasSeenAnnouncement = false;
    try {
      hasSeenAnnouncement = localStorage.getItem(storageKey) === 'seen';
    } catch {
      // Try session storage below when persistent browser storage is unavailable.
    }
    if (!hasSeenAnnouncement) {
      try {
        hasSeenAnnouncement = sessionStorage.getItem(storageKey) === 'seen';
      } catch {
        // The in-memory dismissal guard still prevents repeats in this session.
      }
    }
    if (!hasSeenAnnouncement) setAlbertAnnouncementOpen(true);
  }, [user?.id, canShowAlbertAnnouncement, botOpen]);

  useEffect(() => {
    setWhatsAppAnnouncementOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!canShowAlbertAnnouncement || !user || botOpen || albertAnnouncementOpen) return;
    const userId = String(user.id);
    if (dismissedWhatsAppAnnouncementUsersRef.current.has(userId)) return;

    const whatsappStorageKey = `td_whatsapp_contact_announcement_v1:${userId}`;
    if (hasSeenAnnouncement(whatsappStorageKey)) {
      dismissedWhatsAppAnnouncementUsersRef.current.add(userId);
      return;
    }

    const albertStorageKey = `td_albert_reports_announcement_v1:${userId}`;
    const hasSeenAlbertAnnouncement =
      dismissedAlbertAnnouncementUsersRef.current.has(userId) ||
      hasSeenAnnouncement(albertStorageKey);
    if (hasSeenAlbertAnnouncement) setWhatsAppAnnouncementOpen(true);
  }, [user?.id, canShowAlbertAnnouncement, botOpen, albertAnnouncementOpen]);

  const dismissAlbertAnnouncement = () => {
    if (user) {
      const userId = String(user.id);
      dismissedAlbertAnnouncementUsersRef.current.add(userId);
      try {
        sessionStorage.setItem(`td_albert_reports_announcement_v1:${userId}`, 'seen');
      } catch {
        // The in-memory dismissal guard still keeps it closed for this session.
      }
    }
    setAlbertAnnouncementOpen(false);
  };

  const neverShowAlbertAnnouncementAgain = () => {
    if (user) {
      const storageKey = `td_albert_reports_announcement_v1:${user.id}`;
      try {
        localStorage.setItem(storageKey, 'seen');
      } catch {
        // Fall back to this browser tab when persistent storage is blocked.
      }
      try {
        sessionStorage.setItem(storageKey, 'seen');
      } catch {
        // The in-memory dismissal guard still keeps it closed for this session.
      }
    }
    dismissAlbertAnnouncement();
  };

  const askAlbertFromAnnouncement = () => {
    neverShowAlbertAnnouncementAgain();
    setBotUnreadCount(0);
    setBotOpenPersist(true);
  };

  const dismissWhatsAppAnnouncement = () => {
    if (user) {
      const userId = String(user.id);
      dismissedWhatsAppAnnouncementUsersRef.current.add(userId);
      try {
        sessionStorage.setItem(`td_whatsapp_contact_announcement_v1:${userId}`, 'seen');
      } catch {
        // The in-memory dismissal guard still prevents repeats in this session.
      }
    }
    setWhatsAppAnnouncementOpen(false);
  };

  const neverShowWhatsAppAnnouncementAgain = () => {
    if (user) {
      try {
        localStorage.setItem(`td_whatsapp_contact_announcement_v1:${user.id}`, 'seen');
      } catch {
        // Fall back to the session dismissal.
      }
    }
    dismissWhatsAppAnnouncement();
  };

  const contactTeamViaWhatsAppAnnouncement = () => {
    trackEvent('whatsapp_contact_clicked', { location: 'announcement' });
    neverShowWhatsAppAnnouncementAgain();
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
    if (notification.dailyReportId) setLocation(`/daily-reports/${notification.dailyReportId}`);
    else if (notification.ticketId) setLocation(`/tickets/${notification.ticketId}`);
  };
  const toggleLang = () => setLang(lang === 'it' ? 'en' : 'it' as Lang);
  const whatsappMessage = lang === 'it'
    ? 'Ciao, uso TaskDesk e vorrei chiederti una cosa.'
    : 'Hi, I use TaskDesk and would like to ask you something.';
  const whatsappHref = `https://wa.me/${taskdeskWhatsAppNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const recentNotifications = (notifications as any[]).slice(0, 6);
  const typeIconMap: Record<string, React.ReactNode> = {
    ticket_created: <FiberNew fontSize="small" sx={{ color: 'primary.main' }} />,
    ticket_status_changed: <SwapHoriz fontSize="small" sx={{ color: 'info.main' }} />,
    ticket_commented: <Comment fontSize="small" sx={{ color: 'success.main' }} />,
    ticket_assigned: <AssignmentInd fontSize="small" sx={{ color: 'secondary.main' }} />,
    ticket_priority_changed: <PriorityHigh fontSize="small" sx={{ color: 'warning.main' }} />,
    time_session_corrected: <AccessTime fontSize="small" sx={{ color: 'info.main' }} />,
    daily_report_submitted: <Info fontSize="small" sx={{ color: 'primary.main' }} />,
    system: <Info fontSize="small" sx={{ color: 'text.secondary' }} />,
  };

  const menuItems = [
    { text: t.nav.dashboard,    icon: <Dashboard />,          path: '/',            adminOnly: false, group: lang === 'it' ? 'Operazioni' : 'Operations' },
    { text: entityTerm.navAll,  icon: <ConfirmationNumber />,  path: '/tickets',     adminOnly: false, group: lang === 'it' ? 'Operazioni' : 'Operations' },
    { text: entityTerm.navNew,  icon: <AddBox />,              path: '/tickets/new', adminOnly: false, group: lang === 'it' ? 'Operazioni' : 'Operations' },
    ...((user as any)?.clientsEnabled !== false
      ? [{ text: t.nav.clients, icon: <Business />, path: '/clients', adminOnly: false, group: lang === 'it' ? 'Operazioni' : 'Operations' }]
      : []),
    { text: t.nav.reports,    icon: <BarChart />,            path: '/reports',     adminOnly: false, group: lang === 'it' ? 'Controllo' : 'Control' },
    ...(user?.role === 'admin' && timeTrackingSettings?.timeTrackingModuleEnabled
      ? [{ text: t.nav.timeTrackingReport, icon: <AccessTime />, path: '/time-report', adminOnly: true, group: lang === 'it' ? 'Controllo' : 'Control' }]
      : []),
    ...(shouldShowPersonalTimeReport(user?.role, personalTimeReport.data?.rows)
      ? [{ text: t.nav.myTimeTrackingReport, icon: <AccessTime />, path: '/my-time-report', adminOnly: false, group: lang === 'it' ? 'Controllo' : 'Control' }]
      : []),
    { text: t.nav.calendar,   icon: <CalendarMonth />,       path: '/calendar',    adminOnly: false, group: lang === 'it' ? 'Controllo' : 'Control' },
    { text: lang === 'it' ? 'Avvisi' : 'Announcements', icon: <Campaign />, path: '/announcements', adminOnly: true, group: lang === 'it' ? 'Controllo' : 'Control' },
  ].filter((item) => !item.adminOnly || user?.role === 'admin');

  const roleLabel = user?.role === 'admin' ? t.role.admin : t.role.user;

  const isActive = (path: string) => {
    if (path === '/') return location === '/';
    if (path === '/tickets') {
      return location === '/tickets' || (location.startsWith('/tickets/') && location !== '/tickets/trash');
    }
    return location.startsWith(path);
  };

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
        {menuItems.map((item, index) => (
          <React.Fragment key={item.text}>
            {(index === 0 || item.group !== menuItems[index - 1]?.group) && (
              <Typography sx={{ px: 1.5, pt: index === 0 ? 0 : 1.75, pb: 0.6, color: theme.palette.mode === 'dark' ? '#c3d0dc' : '#526579', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', lineHeight: 1.2, textTransform: 'uppercase' }}>
                {item.group}
              </Typography>
            )}
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                data-tour={item.path === '/tickets' ? 'tickets' : item.path === '/tickets/new' ? 'new-ticket' : undefined}
                data-testid={item.path === '/announcements' ? 'nav-announcements' : undefined}
                onClick={() => { setLocation(item.path); if (isMobile) setMobileOpen(false); }}
                selected={isActive(item.path)}
                sx={{
                  borderRadius: '8px',
                  py: 1,
                  color: theme.palette.mode === 'dark' ? '#e4edf5' : '#26384d',
                  '&.Mui-selected': {
                     background: theme.palette.mode === 'dark' ? 'rgba(25,118,210,.22)' : '#eaf2fb',
                     color: theme.palette.mode === 'dark' ? '#f4f8fc' : '#143c5c',
                    boxShadow: theme.palette.mode === 'dark'
                      ? 'inset 3px 0 0 #64b5f6'
                       : `inset 3px 0 0 ${theme.palette.primary.main}`,
                    '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: 'inherit' },
                     '&:hover': { background: theme.palette.mode === 'dark' ? 'rgba(25,118,210,.3)' : '#eaf2fb' },
                  },
                  '&:not(.Mui-selected):hover': { bgcolor: 'action.hover', color: theme.palette.mode === 'dark' ? '#ffffff' : '#172a40' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isActive(item.path) ? 'inherit' : (theme.palette.mode === 'dark' ? '#b9c9d8' : '#506275') }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive(item.path) ? 700 : 600, fontSize: '0.94rem' }} />
              </ListItemButton>
            </ListItem>
          </React.Fragment>
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
                <ListItemIcon sx={{ minWidth: 38, color: isActive('/superadmin') ? 'inherit' : (theme.palette.mode === 'dark' ? '#b9c9d8' : '#506275') }}>
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
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 12px rgba(15, 23, 42, .05)',
          backgroundImage: 'none',
           backgroundColor: theme.palette.mode === 'light' ? 'rgba(255,254,249,.92)' : undefined,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, minHeight: { xs: '48px !important', sm: '64px !important' }, px: { xs: 1, sm: 3 } }}>
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

          {!isMobile && location === '/' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', mr: 2, ml: 0.5 }}>
              <Typography sx={{ color: '#9ca3af', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.2, textTransform: 'uppercase' }}>
                {lang === 'it' ? 'Panoramica' : 'Overview'}
              </Typography>
              <Typography sx={{ color: '#25364d', fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.2 }}>
                {t.nav.dashboard}
              </Typography>
            </Box>
          )}
          {!isMobile && <Box sx={{ flexGrow: 1 }} />}

          {/* Search button */}
          <Tooltip title={t.commandPalette.tooltip}>
            <Button
              onClick={() => setCommandPaletteOpen(true)}
              size="small"
              aria-label={t.commandPalette.tooltip}
              startIcon={<Search fontSize="small" />}
              sx={{
                minWidth: { xs: 36, sm: location === '/' ? 205 : 36 },
                width: { xs: 36, sm: location === '/' ? 205 : 36 },
                flexShrink: 0,
                justifyContent: 'flex-start',
                px: { xs: 0.75, sm: location === '/' ? 1.25 : 1 },
                py: 0.65,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                color: 'text.secondary',
                bgcolor: location === '/' ? 'action.hover' : 'transparent',
                '& .MuiButton-startIcon': { mr: { xs: 0, sm: location === '/' ? 0.75 : 0 } },
                '&:hover': { borderColor: 'primary.light', color: 'text.primary', bgcolor: 'background.paper' },
              }}
            >
              {location === '/' && <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: '0.72rem', fontWeight: 500 }}>{lang === 'it' ? 'Cerca ticket' : 'Search tickets'}</Box>}
            </Button>
          </Tooltip>

          {/* Language toggle */}
          <Button
            onClick={toggleLang}
            size="small"
            sx={{
              minWidth: { xs: 34, sm: 0 }, px: { xs: 0.75, sm: 1.5 },
              fontWeight: 700, fontSize: '0.7rem',
              border: '1.5px solid', borderColor: 'divider',
              borderRadius: '8px', letterSpacing: '0.05em',
              color: 'text.secondary',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {lang === 'it' ? 'EN' : 'IT'}
          </Button>

          {/* Notifications */}
          <IconButton
            data-tour="notifications"
            onClick={handleNotifMenuOpen}
            size="small"
            aria-label={t.nav.notifications}
            title={t.nav.notifications}
            sx={{ color: 'text.secondary', p: { xs: 0.75, sm: 1 }, '&:hover': { color: 'text.primary' } }}
          >
            <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}>
              <Notifications fontSize="small" />
            </Badge>
          </IconButton>
          <IconButton
            component="a"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('whatsapp_contact_clicked', { location: 'topbar' })}
            size="small"
            aria-label={lang === 'it' ? 'Scrivimi su WhatsApp' : 'Message me on WhatsApp'}
            title={lang === 'it' ? 'Scrivimi su WhatsApp' : 'Message me on WhatsApp'}
            sx={{
              color: '#0f766e',
              p: { xs: 0.75, sm: 1 },
              '&:hover': { color: '#115e59', bgcolor: 'rgba(15, 118, 110, 0.08)' },
            }}
          >
            <WhatsApp fontSize="small" />
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
                        {notification.dailyReportId && (
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, mt: 0.65, display: 'block' }}>
                            {lang === 'it' ? 'Apri report' : 'Open report'} →
                          </Typography>
                        )}
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
            <MenuItem
              onClick={() => {
                handleMenuClose();
                setLocation('/settings');
              }}
              selected={isActive('/settings')}
              sx={{ fontWeight: 500 }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: isActive('/settings') ? 'primary.main' : 'text.secondary' }}>
                <Settings fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={t.nav.settings} />
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                setBugReportOpen(true);
              }}
              sx={{ fontWeight: 500 }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'text.secondary' }}>
                <BugReport fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={t.bugReport.tooltip} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={toggleColorMode} sx={{ fontWeight: 500 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {mode === 'dark' ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
                {mode === 'dark' ? t.nav.lightMode : t.nav.darkMode}
              </Box>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                window.dispatchEvent(new Event('td-open-cookie-settings'));
              }}
              sx={{ fontWeight: 500 }}
            >
              {t.nav.cookieSettings}
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
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: theme.palette.mode === 'light' ? '#eef2eb' : undefined,
            },
          }}
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
              backgroundColor: theme.palette.mode === 'light' ? '#eef2eb' : undefined,
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
        className="td-app-main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          overflowX: 'hidden',
          p: { xs: 1, sm: 3, md: 4 },
          width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          mt: { xs: '48px', sm: '64px' },
            bgcolor: theme.palette.mode === 'light' ? '#f7f7f1' : 'background.default',
          minHeight: { xs: 'calc(100vh - 48px)', sm: 'calc(100vh - 64px)' },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>

      <BugReportDialog open={bugReportOpen} onClose={() => setBugReportOpen(false)} />

      <Dialog
        open={albertAnnouncementOpen}
        onClose={dismissAlbertAnnouncement}
        fullWidth
        maxWidth="xs"
        aria-labelledby="albert-announcement-title"
        aria-describedby="albert-announcement-description"
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
                position: 'relative',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                boxShadow: '0 9px 20px rgba(79,70,229,.22)',
              }}
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,.9)',
                  bgcolor: '#fff',
                }}
              >
                <AlbertAvatarIcon size={42} />
              </Box>
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  right: -5,
                  bottom: -4,
                  width: 23,
                  height: 23,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  color: '#6d28d9',
                  boxShadow: '0 2px 7px rgba(30,41,59,.18)',
                }}
              >
                <AutoAwesomeRounded sx={{ fontSize: 15 }} />
              </Box>
            </Box>
            <Chip
              label={lang === 'it' ? 'NOVITÀ' : 'WHAT’S NEW'}
              size="small"
              sx={{
                height: 28,
                px: 0.5,
                color: (theme) => theme.palette.mode === 'light' ? '#4f46e5' : '#c4b5fd',
                bgcolor: (theme) =>
                  theme.palette.mode === 'light' ? 'rgba(255,255,255,.76)' : 'rgba(255,255,255,.08)',
                border: '1px solid rgba(99,102,241,.2)',
                fontWeight: 800,
                letterSpacing: '.05em',
                fontSize: 10,
              }}
            />
          </Box>
          <DialogTitle
            id="albert-announcement-title"
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
            {lang === 'it' ? 'Albert è più conversazionale' : 'Albert is more conversational'}
          </DialogTitle>
          <DialogContent sx={{ position: 'relative', zIndex: 1, px: 0, pb: 0 }}>
            <Typography
              id="albert-announcement-description"
              variant="body2"
              color="text.secondary"
              data-testid="text-albert-announcement"
              sx={{ maxWidth: 390, fontSize: 14.5, lineHeight: 1.7 }}
            >
              {lang === 'it' ? (
                <>
                  <strong>Scienziato curioso (camice facoltativo).</strong>{' '}
                  Albert indaga su ticket e commenti e ti aiuta a preparare o ritrovare i report giornalieri.
                </>
              ) : (
                <>
                  <strong>Curious scientist (lab coat optional).</strong>{' '}
                  Albert investigates tickets and comments and helps prepare or find daily reports.
                </>
              )}
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
            <Button
              onClick={dismissAlbertAnnouncement}
              data-testid="button-dismiss-albert-announcement"
              sx={{ color: 'text.secondary', px: 1.5 }}
            >
              {lang === 'it' ? 'Ho capito' : 'Got it'}
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRounded sx={{ fontSize: 17 }} />}
              onClick={askAlbertFromAnnouncement}
              data-testid="button-ask-albert"
              sx={{
                minWidth: { xs: 152, sm: 165 },
                borderRadius: 2.5,
                boxShadow: '0 8px 18px rgba(79,70,229,.2)',
                '&:hover': { boxShadow: '0 10px 20px rgba(79,70,229,.27)' },
              }}
            >
              {lang === 'it' ? 'Chiedi ad Albert' : 'Ask Albert'}
            </Button>
          </Box>
          <Button
            onClick={neverShowAlbertAnnouncementAgain}
            data-testid="button-never-show-albert-announcement"
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
            {lang === 'it' ? 'Non mostrarlo più' : "Don't show this again"}
          </Button>
        </DialogActions>
      </Dialog>

      <WhatsAppAnnouncementDialog
        open={whatsappAnnouncementOpen}
        lang={lang}
        href={whatsappHref}
        onClose={dismissWhatsAppAnnouncement}
        onContact={contactTeamViaWhatsAppAnnouncement}
        onNeverShowAgain={neverShowWhatsAppAnnouncementAgain}
      />

      <AnnouncementsPopup
        userId={user ? String(user.id) : undefined}
        enabled={canShowAlbertAnnouncement && !botOpen && !albertAnnouncementOpen && !whatsappAnnouncementOpen}
        lang={lang}
      />

      <Tooltip title={t.bot.fabTooltip} placement="left" disableTouchListener={isMobile}>
        <Fab
          ref={botFabRef}
          color="primary"
          aria-label={t.bot.fabTooltip}
          data-testid="bot-fab"
          onPointerDown={handleBotFabPointerDown}
          onPointerMove={handleBotFabPointerMove}
          onPointerUp={handleBotFabPointerUp}
          onPointerCancel={handleBotFabPointerCancel}
          onKeyDown={handleBotFabKeyDown}
          onContextMenu={isMobile ? (event) => event.preventDefault() : undefined}
          onClick={() => {
            if (botFabDraggedRef.current) {
              botFabDraggedRef.current = false;
              return;
            }
            trackEvent('bot_opened');
            setBotOpenPersist(true);
            setBotUnreadCount(0);
          }}
          sx={{
            position: 'fixed',
            ...(isMobile && botFabPosition
              ? {
                  left: botFabPosition.left,
                  top: botFabPosition.top,
                  right: 'auto',
                  bottom: 'auto',
                }
              : { bottom: 88, right: 24 }),
            touchAction: isMobile ? 'none' : 'auto',
            userSelect: isMobile ? 'none' : 'auto',
            cursor: isMobile ? (isDraggingBotFab ? 'grabbing' : 'grab') : 'pointer',
            zIndex: theme.zIndex.speedDial,
          }}
        >
          <Badge
            badgeContent={botUnreadCount}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16 } }}
          >
            <AlbertAvatarIcon size={28} />
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
        onClose={() => { trackEvent('bot_closed'); setBotOpenPersist(false); setBotUnreadCount(0); }}
        onExpand={() => setBotUnreadCount(0)}
        onBotMessage={() => setBotUnreadCount((c) => c + 1)}
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
