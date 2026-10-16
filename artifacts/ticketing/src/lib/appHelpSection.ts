type AppHelpAccess = {
  isAdmin: boolean;
  clientsEnabled: boolean;
};

export function getAppHelpSectionId(location: string, access: AppHelpAccess): string | null {
  const pathname = location.split(/[?#]/, 1)[0];

  if (pathname === '/') return 'dashboard';
  if (pathname === '/help') return null;
  if (pathname === '/tickets/trash') return access.isAdmin ? 'trash' : null;
  if (pathname === '/tickets' || pathname === '/tickets/new' || /^\/tickets\/\d+$/.test(pathname)) return 'tickets';
  if (pathname === '/clients' || /^\/clients\/\d+$/.test(pathname)) {
    return access.clientsEnabled ? 'clients' : null;
  }
  if (pathname === '/calendar') return 'calendar';
  if (pathname === '/reports') return 'reports';
  if (pathname === '/notifications' || /^\/daily-reports\/\d+$/.test(pathname)) return 'notifications';
  if (pathname === '/users' || /^\/users\/\d+$/.test(pathname)) return access.isAdmin ? 'users' : null;
  if (pathname === '/settings') return access.isAdmin ? 'settings' : null;
  if (pathname === '/billing') return access.isAdmin ? 'billing' : null;
  if (pathname === '/announcements') return access.isAdmin ? 'team-announcements' : null;
  if (pathname === '/time-report' || pathname === '/tasktrack-help') {
    return access.isAdmin ? 'task-track' : null;
  }

  return null;
}
