import { Alert, Box, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import TimeTrackingReportPanel from '../components/TimeTrackingReportPanel';

export default function TimeTrackingReportPage() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const settings = useQuery<{ timeTrackingModuleEnabled?: boolean }>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/organization', { credentials: 'include' });
      if (!response.ok) throw new Error('organization settings unavailable');
      return response.json();
    },
    enabled: user?.role === 'admin',
    staleTime: 5 * 60_000,
  });

  if (settings.isLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress /></Box>;
  }
  if (settings.isError || settings.data?.timeTrackingModuleEnabled !== true) {
    return (
      <Alert severity="info">
        {lang === 'it'
          ? 'Il modulo Rendiconto non è attivo per questa organizzazione.'
          : 'The report module is not enabled for this organization.'}
      </Alert>
    );
  }
  return <TimeTrackingReportPanel />;
}
