import React from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

interface ClientEmailAssociationDialogProps {
  open: boolean;
  busy: boolean;
  title: string;
  prompt: string;
  addressNotice?: string;
  cancelLabel: string;
  linkOnlyLabel: string;
  addAndLinkLabel: string;
  allowAddSender?: boolean;
  error: string | null;
  onClose: () => void;
  onLinkOnly: () => void;
  onAddAndLink: () => void;
}

export default function ClientEmailAssociationDialog({
  open,
  busy,
  title,
  prompt,
  addressNotice,
  cancelLabel,
  linkOnlyLabel,
  addAndLinkLabel,
  allowAddSender = true,
  error,
  onClose,
  onLinkOnly,
  onAddAndLink,
}: ClientEmailAssociationDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="client-email-association-dialog-title"
    >
      <DialogTitle id="client-email-association-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {addressNotice && <Alert severity="info" sx={{ mb: 2 }}>{addressNotice}</Alert>}
        {prompt}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, pb: 2.5 }}>
        <Button color="inherit" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={onLinkOnly}
        >
          {linkOnlyLabel}
        </Button>
        {allowAddSender && (
          <Button
            variant="contained"
            disabled={busy}
            onClick={onAddAndLink}
          >
            {addAndLinkLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
