import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Popper,
  ClickAwayListener,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useLanguage } from '../contexts/LanguageContext';

interface TourStep {
  target: string;
  titleKey: keyof TourStrings;
  descKey: keyof TourStrings;
  placement: 'right' | 'left' | 'bottom' | 'top';
}

interface TourStrings {
  sidebarTitle: string;
  sidebarDesc: string;
  ticketsTitle: string;
  ticketsDesc: string;
  newTicketTitle: string;
  newTicketDesc: string;
  firstTicketTitle: string;
  firstTicketDesc: string;
  notificationsTitle: string;
  notificationsDesc: string;
  skip: string;
  next: string;
  finish: string;
  stepOf: (current: number, total: number) => string;
}

const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="sidebar"]',       titleKey: 'sidebarTitle',       descKey: 'sidebarDesc',       placement: 'right'  },
  { target: '[data-tour="tickets"]',       titleKey: 'ticketsTitle',       descKey: 'ticketsDesc',       placement: 'right'  },
  { target: '[data-tour="new-ticket"]',    titleKey: 'newTicketTitle',     descKey: 'newTicketDesc',     placement: 'right'  },
  { target: '[data-tour="notifications"]', titleKey: 'notificationsTitle', descKey: 'notificationsDesc', placement: 'bottom' },
];

const FIRST_TICKET_GUIDE_STEPS: TourStep[] = [
  { target: '[data-tour="new-ticket"]', titleKey: 'firstTicketTitle', descKey: 'firstTicketDesc', placement: 'right' },
];

interface Props {
  onDone: () => void;
  firstTicketGuide?: boolean;
}

export default function MiniTour({ onDone, firstTicketGuide = false }: Props) {
  const { t } = useLanguage();
  const tr = t.miniTour as unknown as TourStrings;
  const steps = firstTicketGuide ? FIRST_TICKET_GUIDE_STEPS : TOUR_STEPS;
  const [step, setStep] = useState(0);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const findTarget = useCallback((index: number) => {
    const sel = steps[index]?.target;
    if (!sel) return null;
    const candidates = Array.from(document.querySelectorAll(sel));
    return candidates.find((candidate) => candidate.getClientRects().length > 0) ?? candidates[0] ?? null;
  }, [steps]);

  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    let cancelled = false;
    const locateTarget = () => {
      if (cancelled) return;
      const el = findTarget(step);
      if (el && el.getClientRects().length > 0) {
        setAnchorEl(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (attempts++ < 20) frame = window.requestAnimationFrame(locateTarget);
    };
    frame = window.requestAnimationFrame(locateTarget);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [step, findTarget]);

  const markDone = async () => {
    if (!firstTicketGuide) {
      try {
        await fetch('/api/auth/me/tour-done', { method: 'POST', credentials: 'include' });
      } catch { /* fire and forget */ }
    }
    onDone();
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      markDone();
    }
  };

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const title = tr[currentStep.titleKey] as string;
  const desc = tr[currentStep.descKey] as string;

  const popperPlacement = (() => {
    const p = currentStep.placement;
    if (p === 'right') return 'right-start' as const;
    if (p === 'left') return 'left-start' as const;
    if (p === 'bottom') return 'bottom-start' as const;
    return 'top-start' as const;
  })();

  return (
    <>
      {/* Dimmed backdrop */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(0,0,0,0.45)',
          zIndex: 1299,
          pointerEvents: 'none',
        }}
      />

      <Popper
        open={!!anchorEl}
        anchorEl={anchorEl}
        placement={popperPlacement}
        style={{ zIndex: 1300 }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 12] } },
          { name: 'preventOverflow', options: { padding: 16 } },
        ]}
      >
        <ClickAwayListener onClickAway={() => { /* ignore outside clicks */ }}>
          <Paper
            elevation={8}
            sx={{
              maxWidth: 300,
              borderRadius: 3,
              p: 3,
              position: 'relative',
            }}
          >
            {/* Skip button */}
            <Box
              component="button"
              onClick={markDone}
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                p: 0,
                display: 'flex',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              <CloseIcon fontSize="small" />
            </Box>

            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
              {tr.stepOf(step + 1, steps.length)}
            </Typography>

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              {title}
            </Typography>

            <Typography variant="body2" color="text.secondary" mb={2.5}>
              {desc}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="text"
                onClick={markDone}
                sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
              >
                {tr.skip}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleNext}
                sx={{ borderRadius: 1.5, fontWeight: 600 }}
              >
                {isLast ? tr.finish : tr.next}
              </Button>
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
