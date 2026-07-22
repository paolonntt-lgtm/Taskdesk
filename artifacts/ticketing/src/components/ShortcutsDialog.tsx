import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableRow, TableCell, Typography, Box, Divider,
} from '@mui/material';
import { useLanguage } from '../contexts/LanguageContext';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        px: 0.75, py: 0.25, borderRadius: '4px',
        fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700,
        bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider',
        boxShadow: '0 1px 0 rgba(0,0,0,0.15)', minWidth: 22,
      }}
    >
      {children}
    </Box>
  );
}

function Section({ title, rows }: { title: string; rows: { keys: string[]; label: string }[] }) {
  return (
    <Box mb={1.5}>
      <Typography
        variant="caption" color="text.secondary" fontWeight={700}
        textTransform="uppercase" letterSpacing={0.5} display="block" mb={0.75}
      >
        {title}
      </Typography>
      <Table size="small" sx={{ '& td': { border: 'none', py: 0.6 } }}>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell sx={{ width: 130, pl: 0 }}>
                <Box display="flex" gap={0.5} alignItems="center">
                  {row.keys.map((k, i) => (
                    <React.Fragment key={k}>
                      {i > 0 && <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>+</Typography>}
                      <KbdKey>{k}</KbdKey>
                    </React.Fragment>
                  ))}
                </Box>
              </TableCell>
              <TableCell sx={{ pr: 0 }}>
                <Typography variant="body2" color="text.secondary">{row.label}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export default function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const { t } = useLanguage();
  const s = t.shortcuts;

  const globalRows = [
    { keys: ['N'], label: s.keyN },
    { keys: ['?'], label: s.keyQuestion },
    { keys: ['⌘', 'K'], label: s.keyCmdK },
  ];

  const listRows = [
    { keys: ['J'], label: s.keyJ },
    { keys: ['K'], label: s.keyK },
    { keys: ['↵'], label: s.keyEnter },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ pb: 0.5, fontWeight: 700, fontSize: '1rem' }}>{s.dialogTitle}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Section title={s.globalSection} rows={globalRows} />
        <Divider sx={{ my: 1 }} />
        <Section title={s.listSection} rows={listRows} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" size="small" sx={{ borderRadius: '8px' }}>
          {s.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
