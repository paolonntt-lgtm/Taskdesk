import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { BugReport, Close, CheckCircle } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BugReportDialog({ open, onClose }: BugReportDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [location] = useLocation();
  const tb = t.bugReport;

  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError(null);
    setDescription('');
  }, [open]);

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: description.trim(), currentPage: location }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as any).error ?? tb.errorGeneric);
      } else {
        setSent(true);
      }
    } catch {
      setError(tb.errorGeneric);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <BugReport sx={{ color: 'error.main', fontSize: 22 }} />
          <Typography fontWeight={700} fontSize="1rem">{tb.title}</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={sending}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {sent ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={3} gap={1.5}>
            <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
            <Typography fontWeight={700} fontSize="1.05rem">{tb.successTitle}</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">{tb.successSubtitle}</Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <Typography variant="body2" color="text.secondary">{tb.subtitle}</Typography>

            <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{tb.reporterLabel}</Typography>
              <Typography variant="body2" fontWeight={600}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>

            <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{tb.pageLabel}</Typography>
              <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem" sx={{ wordBreak: 'break-all' }}>
                {location || '/'}
              </Typography>
            </Box>

            <TextField
              label={tb.descriptionLabel}
              placeholder={tb.descriptionPlaceholder}
              multiline
              rows={5}
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={sending}
              autoFocus
            />

            {error && (
              <Typography variant="caption" color="error.main">{error}</Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {sent ? (
          <Button onClick={handleClose} variant="contained" fullWidth>{tb.close}</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={sending} color="inherit">{tb.close}</Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={sending || !description.trim()}
              startIcon={sending ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', '&:hover': { background: 'linear-gradient(135deg, #dc2626, #991b1b)' } }}
            >
              {sending ? tb.sending : tb.submit}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}