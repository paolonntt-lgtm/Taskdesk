import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Switch, CircularProgress, Alert, Skeleton, Divider,
  Snackbar,
} from '@mui/material';
import { Security } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useListGroups } from '@workspace/api-client-react';

interface Group {
  id: number;
  name: string;
  permissions: string[];
}

interface PermissionGateDialogProps {
  open: boolean;
  onClose: () => void;
  permission: string;
  sectionLabel?: string;
}

export default function PermissionGateDialog({ open, onClose, permission, sectionLabel }: PermissionGateDialogProps) {
  const { t } = useLanguage();
  const tp = t.permissionGate;

  const { data: rawGroups, isLoading, isError, refetch } = useListGroups({
    query: { enabled: open, staleTime: 0 },
  } as any);

  const groups: Group[] = (rawGroups as any[]) ?? [];

  const [toggling, setToggling] = useState<number | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<number, string[]>>({});
  const [snackbar, setSnackbar] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalPerms({});
  }, [open]);

  useEffect(() => {
    if (!groups.length) return;
    const map: Record<number, string[]> = {};
    for (const g of groups) map[g.id] = [...(g.permissions ?? [])];
    setLocalPerms(map);
  }, [rawGroups]);

  const getPerms = (groupId: number): string[] => {
    return localPerms[groupId] ?? (groups.find(g => g.id === groupId)?.permissions ?? []);
  };

  const handleToggle = async (groupId: number) => {
    const current = getPerms(groupId);
    const hasIt = current.includes(permission);
    const next = hasIt ? current.filter(p => p !== permission) : [...current, permission];

    setLocalPerms(prev => ({ ...prev, [groupId]: next }));
    setToggling(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: next }),
      });
      if (!res.ok) throw new Error('failed');
      setSnackbar({ type: 'success', text: tp.toggleSuccess });
    } catch {
      setLocalPerms(prev => ({ ...prev, [groupId]: current }));
      setSnackbar({ type: 'error', text: tp.toggleError });
    } finally {
      setToggling(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security fontSize="small" color="action" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} component="span">
              {tp.dialogTitle}
            </Typography>
            {sectionLabel && (
              <Typography variant="body2" color="text.secondary" component="div">
                {sectionLabel}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {tp.dialogSubtitle}
          </Typography>

          {isLoading && (
            <Box display="flex" flexDirection="column" gap={1.5}>
              {[0, 1, 2].map(i => (
                <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
              ))}
            </Box>
          )}

          {isError && (
            <Alert severity="error" action={
              <Button size="small" onClick={() => refetch()}>{tp.retry}</Button>
            }>
              {tp.loadError}
            </Alert>
          )}

          {!isLoading && !isError && groups.length === 0 && (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              {tp.noGroups}
            </Typography>
          )}

          {!isLoading && !isError && groups.length > 0 && (
            <Box>
              {groups.map((g, idx) => {
                const hasPermission = getPerms(g.id).includes(permission);
                const isToggling = toggling === g.id;
                return (
                  <React.Fragment key={g.id}>
                    {idx > 0 && <Divider />}
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      py={1.25}
                    >
                      <Typography variant="body2" fontWeight={hasPermission ? 600 : 400}>
                        {g.name}
                      </Typography>
                      {isToggling ? (
                        <CircularProgress size={20} />
                      ) : (
                        <Switch
                          size="small"
                          checked={hasPermission}
                          onChange={() => handleToggle(g.id)}
                          disabled={toggling !== null}
                        />
                      )}
                    </Box>
                  </React.Fragment>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{tp.close}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.type} onClose={() => setSnackbar(null)} sx={{ width: '100%' }}>
            {snackbar.text}
          </Alert>
        ) : <span />}
      </Snackbar>
    </>
  );
}
