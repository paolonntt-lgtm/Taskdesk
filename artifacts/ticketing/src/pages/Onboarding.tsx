import React, { useState } from 'react';
import {
  Box, Typography, Card, CardActionArea, CardContent, Button,
  CircularProgress, Alert, Container, Grid, Stepper, Step, StepLabel,
  TextField, Chip, Stack, IconButton,
} from '@mui/material';
import {
  Computer, Gavel, Campaign, Category, Add, Close, CheckCircle,
  AccountBalance, WorkOutline, EditNote, Storefront, FitnessCenter,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../lib/analytics';
import { dashboardPreferenceStorageKey } from '../lib/dashboardPreferenceStorage';
import {
  getOnboardingBusinessType,
  getOnboardingDashboardPreset,
  isOnboardingProfileId,
  isProfessionalDashboardPresetId,
  ONBOARDING_PROFILE_IDS,
  type OnboardingProfileId,
} from '../lib/onboardingDashboardPresets';

interface BusinessTypeOption {
  value: OnboardingProfileId;
  icon: React.ReactNode;
  color: string;
}

const DASHBOARD_VISIBLE_KEY = 'td_dashboard_visible_v4';
const DASHBOARD_LAYOUT_KEY = 'td_dashboard_layout_v4';
const ONBOARDING_PROFESSION_KEY = 'td_onboarding_profession';

function applyDashboardPreset(profile: OnboardingProfileId, userId: number | string | null | undefined): void {
  try {
    const preset = getOnboardingDashboardPreset(profile);
    localStorage.setItem(dashboardPreferenceStorageKey(DASHBOARD_VISIBLE_KEY, userId), JSON.stringify(preset));
    localStorage.removeItem(dashboardPreferenceStorageKey(DASHBOARD_LAYOUT_KEY, userId));
  } catch { /* ignore quota errors */ }
}

const OPTION_PRESENTATION: Record<OnboardingProfileId, Omit<BusinessTypeOption, 'value'>> = {
  commercialisti: { icon: <AccountBalance sx={{ fontSize: 42 }} />, color: '#1565c0' },
  avvocati: { icon: <Gavel sx={{ fontSize: 42 }} />, color: '#2e7d32' },
  'consulenti-del-lavoro': { icon: <WorkOutline sx={{ fontSize: 42 }} />, color: '#6a1b9a' },
  notai: { icon: <EditNote sx={{ fontSize: 42 }} />, color: '#ad5b12' },
  commercio: { icon: <Storefront sx={{ fontSize: 42 }} />, color: '#00838f' },
  agenzie: { icon: <Campaign sx={{ fontSize: 42 }} />, color: '#6a1b9a' },
  palestre: { icon: <FitnessCenter sx={{ fontSize: 42 }} />, color: '#d97706' },
  it_support: { icon: <Computer sx={{ fontSize: 42 }} />, color: '#1565c0' },
  other: { icon: <Category sx={{ fontSize: 42 }} />, color: '#e65100' },
};
const OPTIONS: BusinessTypeOption[] = ONBOARDING_PROFILE_IDS.map((value) => ({
  value,
  ...OPTION_PRESENTATION[value],
}));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PREVIEW_WIDGET_LABEL_KEYS: Record<string, string> = {
  'stat-open': 'widgetStatOpen',
  'stat-resolved': 'widgetStatResolved',
  'stat-urgent': 'widgetStatUrgent',
  'stat-overdue': 'widgetStatOverdue',
  'feed-my': 'widgetFeedMy',
  'feed-due': 'widgetFeedDue',
  'feed-recent': 'widgetFeedRecent',
  'feed-assigned': 'widgetFeedAssigned',
  'chart-trend': 'widgetChartTrend',
  'chart-status': 'widgetChartStatus',
  'chart-category': 'widgetChartCategory',
  'chart-priority': 'widgetChartPriority',
  'chart-assignee': 'widgetChartAssignee',
  'gym-access': 'widgetGymAccess',
};

interface Props {
  onComplete: (businessType: string, profession: OnboardingProfileId) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [selected, setSelected] = useState<OnboardingProfileId | null>(() => {
    const savedProfession = (user as any)?.profession;
    if (isOnboardingProfileId(savedProfession)) return savedProfession;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('trial_profession');
      if (isOnboardingProfileId(fromUrl)) return fromUrl;
      const fromSession = sessionStorage.getItem(ONBOARDING_PROFESSION_KEY);
      return isOnboardingProfileId(fromSession) ? fromSession : null;
    } catch {
      return null;
    }
  });

  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailError, setEmailError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: number; fail: number } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const [completing, setCompleting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const steps = [
    t.onboarding.stepBusinessType,
    t.onboarding.stepInviteTeam,
    t.onboarding.stepFirstTicket,
  ];

  React.useEffect(() => {
    trackEvent('onboarding_started');
  }, []);

  const callOnboardingComplete = async (firstTicketCreated = false) => {
    setCompleting(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: getOnboardingBusinessType(selected!), profession: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError(data.message || t.onboarding.errorGeneric);
        return;
      }
      applyDashboardPreset(selected!, user?.id);
      try { sessionStorage.removeItem(ONBOARDING_PROFESSION_KEY); } catch {}
      trackEvent('onboarding_completed', {
        business_type: getOnboardingBusinessType(selected!),
        ...(isProfessionalDashboardPresetId(selected) ? { profession: selected } : {}),
        first_ticket_created: firstTicketCreated,
      });
       onComplete(getOnboardingBusinessType(selected!), selected!);
    } catch {
      setGlobalError(t.onboarding.errorNetwork);
    } finally {
      setCompleting(false);
    }
  };

  const handleAddEmail = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(t.onboarding.inviteInvalidEmail);
      return;
    }
    if (emails.includes(trimmed)) {
      setEmailInput('');
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setEmailInput('');
    setEmailError('');
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); }
  };

  const handleRemoveEmail = (email: string) => {
    setEmails((prev) => prev.filter((x) => x !== email));
  };

  const handleSendInvites = async () => {
    if (emails.length === 0) {
      trackEvent('onboarding_invites_skipped', { method: 'continue_without_invites' });
      setCurrentStep(3);
      return;
    }
    setInviting(true);
    setInviteError(null);
    let ok = 0;
    let fail = 0;
    let seatLimitHit = false;

    for (const email of emails) {
      try {
        const res = await fetch('/api/invites', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (res.status === 402) { seatLimitHit = true; fail++; }
        else if (!res.ok) { fail++; }
        else {
          const data = await res.json().catch(() => ({}));
          if (data.emailSent === true) { ok++; }
          else { fail++; }
        }
      } catch { fail++; }
    }

    setInviting(false);
    trackEvent('onboarding_invites_sent', {
      invited_count: ok,
      failed_count: fail,
    });
    if (seatLimitHit && ok === 0 && fail === emails.length) {
      setInviteError(t.onboarding.inviteSeatLimit);
      return;
    }
    setInviteResult({ ok, fail });
    setTimeout(() => { setCurrentStep(3); }, 1400);
  };

  const handleSkipInvite = () => {
    trackEvent('onboarding_invites_skipped', { method: 'skip_button' });
    setCurrentStep(3);
  };

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim()) return;
    setCreating(true);
    setTicketError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ticketTitle.trim(),
          description: ticketDescription.trim() || ticketTitle.trim(),
          category: 'General',
          priority: 'medium',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTicketError(data.message || t.onboarding.ticketErrorGeneric);
        return;
      }
      setTicketSuccess(true);
      trackEvent('onboarding_first_ticket_created');
      setTimeout(() => callOnboardingComplete(true), 1200);
    } catch {
      setTicketError(t.onboarding.ticketErrorGeneric);
    } finally {
      setCreating(false);
    }
  };

  const handleSkipTicket = () => {
    trackEvent('onboarding_first_ticket_skipped');
    callOnboardingComplete();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 40%, #fdf2f8 100%)',
        py: 6,
        px: 2,
      }}
    >
      <Container maxWidth="md">
        <Box textAlign="center" mb={4}>
          <Box
            component="img"
            src="/taskdesk-logo.svg"
            alt="TaskDesk"
            sx={{ height: 44, width: 'auto', mx: 'auto', mb: 3, display: 'block' }}
          />
        </Box>

        <Stepper activeStep={currentStep - 1} alternativeLabel sx={{ mb: 5 }}>
          {steps.map((label, i) => (
            <Step key={label} completed={i < currentStep - 1}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {globalError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setGlobalError(null)}>
            {globalError}
          </Alert>
        )}

        {currentStep === 1 && (
          <StepBusinessType
            selected={selected}
            setSelected={setSelected}
            onNext={() => {
              if (!selected) return;
              trackEvent('onboarding_business_type_selected', { business_type: selected });
              setCurrentStep(2);
            }}
            t={t}
          />
        )}

        {currentStep === 2 && (
          <StepInviteTeam
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            emails={emails}
            emailError={emailError}
            inviting={inviting}
            inviteResult={inviteResult}
            inviteError={inviteError}
            onAddEmail={handleAddEmail}
            onEmailKeyDown={handleEmailKeyDown}
            onRemoveEmail={handleRemoveEmail}
            onSendInvites={handleSendInvites}
            onSkip={handleSkipInvite}
            t={t}
          />
        )}

        {currentStep === 3 && (
          <StepFirstTicket
            ticketTitle={ticketTitle}
            setTicketTitle={setTicketTitle}
            ticketDescription={ticketDescription}
            setTicketDescription={setTicketDescription}
            creating={creating}
            completing={completing}
            ticketSuccess={ticketSuccess}
            ticketError={ticketError}
            onCreateTicket={handleCreateTicket}
            onSkip={handleSkipTicket}
            t={t}
          />
        )}
      </Container>
    </Box>
  );
}

function StepBusinessType({
  selected, setSelected, onNext, t,
}: {
  selected: OnboardingProfileId | null;
  setSelected: (v: OnboardingProfileId) => void;
  onNext: () => void;
  t: any;
}) {
  return (
    <>
      <Box textAlign="center" mb={4}>
        <Typography variant="h4" fontWeight={800} mb={1.5} color="text.primary">
          {t.onboarding.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto' }}>
          {t.onboarding.subtitle}
        </Typography>
      </Box>

      <Grid container spacing={2.5} justifyContent="center">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          const label = (t.onboarding.types as any)[opt.value]?.label ?? opt.value;
          const desc = (t.onboarding.types as any)[opt.value]?.description ?? '';
          return (
            <Grid item xs={12} sm={6} key={opt.value}>
              <Card
                elevation={isSelected ? 8 : 1}
                sx={{
                  borderRadius: '16px',
                  border: '2px solid',
                  borderColor: isSelected ? opt.color : 'transparent',
                  transition: 'all 0.18s ease',
                  cursor: 'pointer',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  boxShadow: isSelected
                    ? `0 8px 24px ${opt.color}30`
                    : '0 2px 8px rgba(0,0,0,0.06)',
                }}
              >
                <CardActionArea onClick={() => setSelected(opt.value)} sx={{ borderRadius: '14px' }}>
                  <CardContent sx={{ p: 3.5 }}>
                    <Box
                      sx={{
                        width: 72, height: 72, borderRadius: '20px',
                        background: isSelected ? `${opt.color}18` : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        mb: 2, color: isSelected ? opt.color : '#9ca3af',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      {opt.icon}
                    </Box>
                    <Typography
                      variant="h6" fontWeight={700} mb={0.75}
                      color={isSelected ? opt.color : 'text.primary'}
                      sx={{ transition: 'color 0.18s ease' }}
                    >
                      {label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.5}>
                      {desc}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {selected && <DashboardPresetPreview profile={selected} t={t} />}

      <Box mt={4} display="flex" justifyContent="center">
        <Button
          variant="contained"
          size="large"
          disabled={!selected}
          onClick={onNext}
          sx={{ px: 5, py: 1.6, fontWeight: 700, fontSize: '1rem', borderRadius: '12px', minWidth: 220 }}
        >
          {t.onboarding.next}
        </Button>
      </Box>
    </>
  );
}

function DashboardPresetPreview({ profile, t }: { profile: OnboardingProfileId; t: any }) {
  const widgetIds = getOnboardingDashboardPreset(profile);
  const businessType = getOnboardingBusinessType(profile);
  const dashboard = t.dashboard as Record<string, any>;
  const entityTerm = (t.entityTerms as Record<string, any>)[businessType];
  const profileLabel = (t.onboarding.types as Record<string, { label: string }>)[profile]?.label ?? profile;

  const getWidgetLabel = (widgetId: string): string => {
    const label = dashboard[PREVIEW_WIDGET_LABEL_KEYS[widgetId]] ?? widgetId;
    if (widgetId === 'feed-my' && typeof label === 'function') {
      return label(entityTerm?.plural ?? 'Tickets', entityTerm?.grammaticalGender);
    }
    return typeof label === 'function' ? label() : label;
  };

  return (
    <Card
      variant="outlined"
      data-testid="dashboard-preset-preview"
      sx={{
        mt: 3,
        borderRadius: '16px',
        borderColor: 'divider',
        background: 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)',
        boxShadow: '0 8px 28px rgba(37, 69, 124, 0.08)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={750} color="text.primary">
              {t.onboarding.dashboardPreviewTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {t.onboarding.dashboardPreviewSubtitle}
            </Typography>
          </Box>
          <Chip
            size="small"
            icon={<Category />}
            label={profileLabel}
            color="primary"
            variant="outlined"
            sx={{ flexShrink: 0, maxWidth: '45%' }}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {widgetIds.map((widgetId) => {
            const isStat = widgetId.startsWith('stat-');
            const isChart = widgetId.startsWith('chart-');
            return (
              <Box
                key={widgetId}
                data-testid={`dashboard-preview-widget-${widgetId}`}
                sx={{ gridColumn: isStat ? 'span 1' : 'span 2', minWidth: 0 }}
              >
                <Box
                  sx={{
                    height: '100%',
                    minHeight: isStat ? 82 : 112,
                    border: '1px solid',
                    borderColor: 'rgba(37, 99, 235, 0.12)',
                    borderRadius: '12px',
                    bgcolor: '#fff',
                    p: 1.25,
                    overflow: 'hidden',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="text.secondary" noWrap>
                    {getWidgetLabel(widgetId)}
                  </Typography>
                  {isStat ? (
                    <Box display="flex" alignItems="center" justifyContent="space-between" mt={0.75}>
                      <Typography variant="h5" fontWeight={800} color="primary.main">—</Typography>
                      <Box sx={{ width: 30, height: 30, borderRadius: '10px', bgcolor: 'primary.50' }} />
                    </Box>
                  ) : isChart ? (
                    <Box display="flex" alignItems="flex-end" gap={0.75} height={54} mt={1}>
                      {[38, 58, 45, 78, 55, 68].map((height, index) => (
                        <Box
                          key={index}
                          sx={{
                            flex: 1,
                            height: `${height}%`,
                            borderRadius: '4px 4px 0 0',
                            bgcolor: index === 3 ? 'primary.main' : 'rgba(37, 99, 235, 0.22)',
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Box display="flex" flexDirection="column" gap={0.8} mt={1.25}>
                      {[1, 0.72, 0.88].map((width, index) => (
                        <Box
                          key={index}
                          sx={{ height: 6, width: `${width * 100}%`, borderRadius: 4, bgcolor: 'action.hover' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

function StepInviteTeam({
  emailInput, setEmailInput, emails, emailError, inviting,
  inviteResult, inviteError,
  onAddEmail, onEmailKeyDown, onRemoveEmail, onSendInvites, onSkip, t,
}: {
  emailInput: string;
  setEmailInput: (v: string) => void;
  emails: string[];
  emailError: string;
  inviting: boolean;
  inviteResult: { ok: number; fail: number } | null;
  inviteError: string | null;
  onAddEmail: () => void;
  onEmailKeyDown: (e: React.KeyboardEvent) => void;
  onRemoveEmail: (email: string) => void;
  onSendInvites: () => void;
  onSkip: () => void;
  t: any;
}) {
  return (
    <Box maxWidth={560} mx="auto">
      <Box textAlign="center" mb={4}>
        <Typography variant="h4" fontWeight={800} mb={1.5} color="text.primary">
          {t.onboarding.inviteTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
          {t.onboarding.inviteSubtitle}
        </Typography>
      </Box>

      {inviteError && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>
          {inviteError}
        </Alert>
      )}

      {inviteResult && !inviteError && (
        <Alert
          severity="success"
          icon={<CheckCircle />}
          sx={{ mb: 2, borderRadius: '12px' }}
        >
          {inviteResult.fail === 0
            ? t.onboarding.inviteSuccess(inviteResult.ok)
            : t.onboarding.invitePartial(inviteResult.ok, inviteResult.fail)}
        </Alert>
      )}

      <Box display="flex" gap={1} mb={2}>
        <TextField
          fullWidth
          size="small"
          type="email"
          placeholder={t.onboarding.inviteEmailPlaceholder}
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={onEmailKeyDown}
          error={!!emailError}
          helperText={emailError}
          disabled={inviting}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <Button
          variant="outlined"
          onClick={onAddEmail}
          disabled={inviting}
          startIcon={<Add />}
          sx={{ borderRadius: '10px', px: 2.5, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {t.onboarding.inviteAdd}
        </Button>
      </Box>

      {emails.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1} mb={3}>
          {emails.map((email) => (
            <Chip
              key={email}
              label={email}
              onDelete={() => onRemoveEmail(email)}
              deleteIcon={<Close />}
              size="small"
              sx={{ borderRadius: '8px' }}
            />
          ))}
        </Stack>
      )}

      <Box display="flex" flexDirection="column" alignItems="center" gap={1.5} mt={3}>
        <Button
          variant="contained"
          size="large"
          disabled={inviting || !!inviteResult}
          onClick={onSendInvites}
          startIcon={inviting ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ px: 5, py: 1.6, fontWeight: 700, fontSize: '1rem', borderRadius: '12px', minWidth: 220 }}
        >
          {inviting ? t.onboarding.inviteSending : (emails.length === 0 ? t.onboarding.inviteNext : t.onboarding.inviteSend)}
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={onSkip}
          disabled={inviting}
          sx={{ color: 'text.secondary', fontSize: '0.875rem' }}
        >
          {t.onboarding.inviteSkip}
        </Button>
      </Box>
    </Box>
  );
}

function StepFirstTicket({
  ticketTitle, setTicketTitle, ticketDescription, setTicketDescription,
  creating, completing, ticketSuccess, ticketError,
  onCreateTicket, onSkip, t,
}: {
  ticketTitle: string;
  setTicketTitle: (v: string) => void;
  ticketDescription: string;
  setTicketDescription: (v: string) => void;
  creating: boolean;
  completing: boolean;
  ticketSuccess: boolean;
  ticketError: string | null;
  onCreateTicket: () => void;
  onSkip: () => void;
  t: any;
}) {
  const busy = creating || completing;

  return (
    <Box maxWidth={560} mx="auto">
      <Box textAlign="center" mb={4}>
        <Typography variant="h4" fontWeight={800} mb={1.5} color="text.primary">
          {t.onboarding.ticketTitle}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
          {t.onboarding.ticketSubtitle}
        </Typography>
      </Box>

      {ticketError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => {}}>
          {ticketError}
        </Alert>
      )}

      {ticketSuccess && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2, borderRadius: '12px' }}>
          {t.onboarding.ticketSuccessMsg}
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <TextField
          fullWidth
          label={t.onboarding.ticketTitleField}
          placeholder={t.onboarding.ticketTitlePlaceholder}
          value={ticketTitle}
          onChange={(e) => setTicketTitle(e.target.value)}
          disabled={busy || ticketSuccess}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        <TextField
          fullWidth
          multiline
          rows={3}
          label={t.onboarding.ticketDescriptionField}
          placeholder={t.onboarding.ticketDescriptionPlaceholder}
          value={ticketDescription}
          onChange={(e) => setTicketDescription(e.target.value)}
          disabled={busy || ticketSuccess}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
      </Box>

      <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
        <Button
          variant="contained"
          size="large"
          disabled={!ticketTitle.trim() || busy || ticketSuccess}
          onClick={onCreateTicket}
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ px: 5, py: 1.6, fontWeight: 700, fontSize: '1rem', borderRadius: '12px', minWidth: 220 }}
        >
          {busy ? t.onboarding.ticketCreating : t.onboarding.ticketCreate}
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={onSkip}
          disabled={busy || ticketSuccess}
          sx={{ color: 'text.secondary', fontSize: '0.875rem' }}
        >
          {t.onboarding.ticketSkip}
        </Button>
      </Box>
    </Box>
  );
}
