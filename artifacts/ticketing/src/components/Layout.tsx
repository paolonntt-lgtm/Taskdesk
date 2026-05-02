import React, { useState } from 'react';
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
} from '@mui/icons-material';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { useListNotifications, useMarkAllNotificationsRead } from '@workspace/api-client-react';

const drawerWidth = 260;

interface LayoutProps {
  children: React.ReactNode;
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}

export default function Layout({ children, toggleTheme, mode }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);

  const { data: notifications = [] } = useListNotifications({
    query: { enabled: !!user },
  });

  const markAllRead = useMarkAllNotificationsRead();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotifMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setNotifAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
    handleMenuClose();
  };

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Tutti i Ticket', icon: <ConfirmationNumber />, path: '/tickets' },
    { text: 'Nuovo Ticket', icon: <AddBox />, path: '/tickets/new' },
    { text: 'Report', icon: <BarChart />, path: '/reports' },
  ];

  const roleLabel = user?.role === 'admin' ? 'Amministratore' : 'Utente';

  const drawer = (
    <div>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: 'primary.main', letterSpacing: 1 }}>
          Ticket Manager
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 2, pt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => {
                setLocation(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              selected={location === item.path || (item.path !== '/' && location.startsWith(item.path))}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                },
                '&.Mui-selected:hover': { backgroundColor: 'primary.dark' },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color:
                    location === item.path || (item.path !== '/' && location.startsWith(item.path))
                      ? 'inherit'
                      : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` } }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="apri menu"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          <IconButton color="inherit" onClick={toggleTheme} sx={{ mr: 1 }} title={mode === 'light' ? 'Modalità scura' : 'Modalità chiara'}>
            {mode === 'light' ? <DarkMode /> : <LightMode />}
          </IconButton>

          <IconButton color="inherit" onClick={handleNotifMenuOpen} sx={{ mr: 2 }} title="Notifiche">
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { width: 340, maxHeight: 420 } }}
          >
            <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">Notifiche</Typography>
              {unreadCount > 0 && (
                <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }} onClick={handleMarkAllRead}>
                  Segna tutto come letto
                </Typography>
              )}
            </Box>
            <Divider />
            {notifications.length === 0 ? (
              <MenuItem disabled>Nessuna notifica</MenuItem>
            ) : (
              notifications.map((n: any) => (
                <MenuItem
                  key={n.id}
                  onClick={() => {
                    handleMenuClose();
                    if (n.ticketId) setLocation(`/tickets/${n.ticketId}`);
                  }}
                  sx={{
                    whiteSpace: 'normal',
                    bgcolor: n.isRead ? 'transparent' : 'action.hover',
                    borderLeft: n.isRead ? 'none' : '3px solid',
                    borderLeftColor: 'primary.main',
                  }}
                >
                  <Typography variant="body2">{n.notificationText}</Typography>
                </MenuItem>
              ))
            )}
          </Menu>

          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleProfileMenuOpen}>
            <Box sx={{ mr: 1.5, textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight="bold">{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {roleLabel}
              </Typography>
            </Box>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              {user?.name?.charAt(0) || <AccountCircle />}
            </Avatar>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box>
                <Typography variant="body2" fontWeight="bold">{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Esci</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
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
          p: { xs: 2, sm: 3, md: 4 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
