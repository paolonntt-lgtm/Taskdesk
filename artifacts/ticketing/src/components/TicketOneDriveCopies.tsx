import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { DeleteOutline } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTicketOneDriveCopiesQueryKey,
  useDeleteTicketOneDriveCopy,
  useListTicketOneDriveCopies,
} from "@workspace/api-client-react";
import type { TicketOneDriveCopy } from "@workspace/api-client-react";
import { useLanguage } from "../contexts/LanguageContext";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const apiError = error as { message?: string; data?: { error?: string } };
    if (apiError.data?.error) return apiError.data.error;
    if (apiError.message) return apiError.message;
  }
  return fallback;
}

export default function TicketOneDriveCopies({ ticketId }: { ticketId: number }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const it = lang === "it";
  const strings = {
    title: t.ticketDetail.oneDriveCopiesTitle,
    description: t.ticketDetail.oneDriveCopiesDescription,
    warning: t.ticketDetail.oneDriveCopiesWarning,
    loading: t.ticketDetail.oneDriveCopiesLoading,
    empty: t.ticketDetail.oneDriveCopiesEmpty,
    loadError: t.ticketDetail.oneDriveCopiesLoadError,
    retry: t.ticketDetail.oneDriveCopiesRetry,
    remove: t.ticketDetail.oneDriveCopiesRemove,
    dialogTitle: t.ticketDetail.oneDriveCopiesDialogTitle,
    dialogText: t.ticketDetail.oneDriveCopiesDialogText,
    cancel: t.ticketDetail.oneDriveCopiesCancel,
    confirm: t.ticketDetail.oneDriveCopiesConfirm,
    date: t.ticketDetail.oneDriveCopiesDate,
    removeError: t.ticketDetail.oneDriveCopiesRemoveError,
  };

  const { data, isLoading, isError, error, refetch } = useListTicketOneDriveCopies(ticketId, {
    query: {
      queryKey: getListTicketOneDriveCopiesQueryKey(ticketId),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const deleteCopy = useDeleteTicketOneDriveCopy();
  const copies: TicketOneDriveCopy[] = data ?? [];
  const [selected, setSelected] = useState<TicketOneDriveCopy | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!selected) return;
    setMutationError(null);
    try {
      await deleteCopy.mutateAsync({ id: ticketId, copyId: selected.id });
      await queryClient.invalidateQueries({ queryKey: getListTicketOneDriveCopiesQueryKey(ticketId) });
      setSelected(null);
    } catch (failure) {
      setMutationError(getErrorMessage(failure, strings.removeError));
    }
  };

  return (
    <>
      <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
          <Typography variant="subtitle2" fontWeight={700}>{strings.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.25 }}>
            {strings.description}
          </Typography>
          <Alert severity="info" sx={{ mb: 1.25, py: 0 }}>
            {strings.warning}
          </Alert>

          {mutationError && <Alert severity="error" sx={{ mb: 1.25 }}>{mutationError}</Alert>}
          {isLoading ? (
            <Box display="flex" alignItems="center" gap={1} py={1}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">{strings.loading}</Typography>
            </Box>
          ) : isError ? (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={() => void refetch()}>{strings.retry}</Button>}
            >
              {getErrorMessage(error, strings.loadError)}
            </Alert>
          ) : copies.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{strings.empty}</Typography>
          ) : (
            <List dense disablePadding>
              {copies.map((copy) => (
                <ListItem
                  key={copy.id}
                  divider
                  disableGutters
                  secondaryAction={(
                    <Tooltip title={strings.remove}>
                      <span>
                        <IconButton
                          edge="end"
                          aria-label={`${strings.remove}: ${copy.fileName}`}
                          color="error"
                          disabled={deleteCopy.isPending}
                          onClick={() => setSelected(copy)}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  sx={{ pr: 6 }}
                >
                  <ListItemText
                    primary={copy.fileName}
                    secondary={
                      <>
                        <span>{copy.ownerName} · {copy.ownerEmail}</span>
                        <br />
                        <span>{strings.date}: {new Intl.DateTimeFormat(it ? "it-IT" : "en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(copy.createdAt))}</span>
                      </>
                    }
                    primaryTypographyProps={{ variant: "body2", fontWeight: 600, sx: { overflowWrap: "anywhere" } }}
                    secondaryTypographyProps={{ component: "div", variant: "caption" }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onClose={() => !deleteCopy.isPending && setSelected(null)}>
        <DialogTitle>{strings.dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{strings.dialogText}</Typography>
          {selected && (
            <Box mt={1.5}>
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                {selected.fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selected.ownerName} · {selected.ownerEmail}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={deleteCopy.isPending}>{strings.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleDelete()}
            disabled={deleteCopy.isPending}
            startIcon={deleteCopy.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}
          >
            {strings.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
