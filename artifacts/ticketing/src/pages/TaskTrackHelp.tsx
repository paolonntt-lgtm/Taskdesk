import {
  AccessTimeRounded,
  ArrowBackRounded,
  AssessmentOutlined,
  SettingsOutlined,
  TuneRounded,
  VisibilityOutlined,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { Link } from 'wouter';
import { useLanguage } from '../contexts/LanguageContext';

export default function TaskTrackHelp() {
  const { t } = useLanguage();
  const help = t.taskTrackHelp;
  const sections = [
    { title: help.trackingTitle, items: help.trackingItems, icon: <AccessTimeRounded color="primary" /> },
    { title: help.classificationTitle, items: help.classificationItems, icon: <TuneRounded color="primary" /> },
    { title: help.reportTitle, items: help.reportItems, icon: <AssessmentOutlined color="primary" /> },
    { title: help.personalReportTitle, items: help.personalReportItems, icon: <VisibilityOutlined color="primary" /> },
    { title: help.disabledTitle, items: help.disabledItems, icon: <SettingsOutlined color="primary" /> },
  ];

  return (
    <Box maxWidth="md" mx="auto" data-testid="tasktrack-help-page">
      <Stack direction="row" alignItems="center" spacing={1.25} mb={1}>
        <AccessTimeRounded color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={800} sx={{ fontSize: { xs: 26, sm: 32 } }}>
          {help.title}
        </Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 760 }}>
        {help.intro}
      </Typography>

      <Stack spacing={1.5}>
        {sections.map((section) => (
          <Card key={section.title} variant="outlined" sx={{ borderRadius: 2.5 }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <Box sx={{ pt: 0.25, display: 'flex', flexShrink: 0 }}>{section.icon}</Box>
                <Box>
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
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} mt={3} flexWrap="wrap">
        <Button component={Link} href="/settings" variant="outlined" startIcon={<SettingsOutlined />}>
          {help.settingsAction}
        </Button>
        <Button component={Link} href="/time-report" variant="contained" startIcon={<AssessmentOutlined />}>
          {help.reportAction}
        </Button>
        <Button component={Link} href="/" variant="text" startIcon={<ArrowBackRounded />}>
          {help.backAction}
        </Button>
      </Stack>
    </Box>
  );
}
