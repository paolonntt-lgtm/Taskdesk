import React, { useState } from 'react';
import {
  Box, Typography, Card, CardActionArea, CardContent, Button,
  CircularProgress, Alert, Container, Grid,
} from '@mui/material';
import {
  Computer, Gavel, Campaign, Category,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

interface BusinessTypeOption {
  value: string;
  icon: React.ReactNode;
  color: string;
}

const OPTIONS: BusinessTypeOption[] = [
  {
    value: 'it_support',
    icon: <Computer sx={{ fontSize: 48 }} />,
    color: '#1565c0',
  },
  {
    value: 'professional_studio',
    icon: <Gavel sx={{ fontSize: 48 }} />,
    color: '#2e7d32',
  },
  {
    value: 'agency',
    icon: <Campaign sx={{ fontSize: 48 }} />,
    color: '#6a1b9a',
  },
  {
    value: 'other',
    icon: <Category sx={{ fontSize: 48 }} />,
    color: '#e65100',
  },
];

interface Props {
  onComplete: (businessType: string) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || t.onboarding.errorGeneric);
        return;
      }
      onComplete(selected);
    } catch {
      setError(t.onboarding.errorNetwork);
    } finally {
      setSubmitting(false);
    }
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
        <Box textAlign="center" mb={5}>
          <Box
            component="img"
            src="/taskdesk-logo.png"
            alt="TaskDesk"
            sx={{ height: 44, width: 'auto', mx: 'auto', mb: 3, display: 'block' }}
          />
          <Typography variant="h4" fontWeight={800} mb={1.5} color="text.primary">
            {t.onboarding.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto' }}>
            {t.onboarding.subtitle}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

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
                  <CardActionArea
                    onClick={() => setSelected(opt.value)}
                    sx={{ borderRadius: '14px' }}
                  >
                    <CardContent sx={{ p: 3.5 }}>
                      <Box
                        sx={{
                          width: 72,
                          height: 72,
                          borderRadius: '20px',
                          background: isSelected ? `${opt.color}18` : '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 2,
                          color: isSelected ? opt.color : '#9ca3af',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        {opt.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        mb={0.75}
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
            disabled={!selected || submitting}
            onClick={handleConfirm}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{
              px: 5,
              py: 1.6,
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: '12px',
              minWidth: 220,
            }}
          >
            {submitting ? t.onboarding.confirming : t.onboarding.confirm}
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
