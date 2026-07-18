import React, { useState } from 'react';
import {
  Box, Typography, Card, CardActionArea, CardContent, Button,
  CircularProgress, Alert, Container, Grid, Stepper, Step, StepLabel,
  TextField, Chip, Stack, IconButton,
} from '@mui/material';
import {
  Computer, Gavel, Campaign, Category, Add, Close, CheckCircle,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

interface BusinessTypeOption {
  value: string;
  icon: React.ReactNode;
  color: string;
}

const DASHBOARD_VISIBLE_KEY = 'td_dashboard_visible_v3';
const DASHBOARD_LAYOUT_KEY = 'td_dashboard_layout_v3';

const DASHBOARD_PRESETS: Record<string, string[]> = {
  it_support:          ['stat-open', 'stat-urgent', 'stat-overdue', 'stat-resolved', 'feed-my', 'feed-due', 'chart-trend', 'chart-status'],
  professional_studio: ['stat-open', 'stat-resolved', 'feed-my', 'feed-due', 'chart-category', 'chart-priority'],
  agency:              ['stat-open', 'stat-resolved', 'stat-urgent', 'feed-recent', 'feed-assigned', 'chart-trend', 'chart-assignee'],
  other:               ['stat-open', 'stat-resolved', 'stat-urgent', 'stat-overdue', 'feed-my', 'feed-due', 'feed-recent'],
};

function applyDashboardPreset(businessType: string): void {
  try {
    const preset = DASHBOARD_PRESETS[businessType] ?? DASHBOARD_PRESETS.other;
    localStorage.setItem(DASHBOARD_VISIBLE_KEY, JSON.stringify(preset));
    localStorage.removeItem(DASHBOARD_LAYOUT_KEY);
  } catch { /* ignore quota errors */ }
}

const OPTIONS: BusinessTypeOption[] = [
  { value: 'it_support', icon: <Computer sx={{ fontSize: 48 }} />, color: '#1565c0' },
  { value: 'professional_studio', icon: <Gavel sx={{ fontSize: 48 }} />, color: '#2e7d32' },
  { value: 'agency', icon: <Campaign sx={{ fontSize: 48 }} />, color: '#6a1b9a' },
  { value: 'other', icon: <Category sx={{ fontSize: 48 }} />, color: '#e65100' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  onComplete: (businessType: string) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const { t } = useLanguage();

  const [currentStep, setCurrentStep] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

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

  const callOnboardingComplete = async () => {
    setCompleting(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError(data.message || t.onboarding.errorGeneric);
        return;
      }
      applyDashboardPreset(selected!);
      onComplete(selected!);
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
    if (emails.length === 0) { setCurrentStep(3); return; }
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
    if (seatLimitHit && ok === 0 && fail === emails.length) {
      setInviteError(t.onboarding.inviteSeatLimit);
      return;
    }
    setInviteResult({ ok, fail });
    setTimeout(() => { setCurrentStep(3); }, 1400);
  };

  const handleSkipInvite = () => { setCurrentStep(3); };

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
      setTimeout(() => callOnboardingComplete(), 1200);
    } catch {
      setTicketError(t.onboarding.ticketErrorGeneric);
    } finally {
      setCreating(false);
    }
  };

  const handleSkipTicket = () => { callOnboardingComplete(); };

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
            src="/taskdesk-logo.png"
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
            onNext={() => setCurrentStep(2)}
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
  selected: string | null;
  setSelected: (v: string) => void;
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
