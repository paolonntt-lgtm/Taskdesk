import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Security } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PermissionGateDialog from './PermissionGateDialog';

interface PermissionGateButtonProps {
  permission: string;
  sectionLabel?: string;
}

export default function PermissionGateButton({ permission, sectionLabel }: PermissionGateButtonProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'admin') return null;

  return (
    <>
      <Tooltip title={t.permissionGate.tooltipButton}>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          sx={{
            color: 'text.disabled',
            p: 0.25,
            '&:hover': { color: 'primary.main' },
          }}
        >
          <Security sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      <PermissionGateDialog
        open={open}
        onClose={() => setOpen(false)}
        permission={permission}
        sectionLabel={sectionLabel}
      />
    </>
  );
}
