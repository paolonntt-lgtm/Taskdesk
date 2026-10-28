import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Typography,
} from "@mui/material";
import { CheckCircleOutline, Close } from "@mui/icons-material";
import {
  getGetTicketQueryKey,
  getListPendingClientSuggestionsQueryKey,
  getListTicketsQueryKey,
  useListPendingClientSuggestions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function PendingClientSuggestions() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const { data = [], isLoading, isError, refetch } = useListPendingClientSuggestions({
    query: {
      enabled: isAdmin,
      refetchOnWindowFocus: true,
      queryKey: getListPendingClientSuggestionsQueryKey(),
    },
  });
  const [busyTicketId, setBusyTicketId] = useState<number | null>(null);
  const [actionError, setActionError] = useState(false);

  const reviewSuggestion = async (ticketId: number, action: "confirm" | "dismiss") => {
    setBusyTicketId(ticketId);
    setActionError(false);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/client-suggestion/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Client suggestion update failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListPendingClientSuggestionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(ticketId) }),
      ]);
    } catch {
      setActionError(true);
    } finally {
      setBusyTicketId(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card variant="outlined" sx={{ mb: 2.5 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={700} data-testid="text-client-suggestion-queue-title">
          {t.ticketList.clientSuggestionQueueTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          {t.ticketList.clientSuggestionQueueDescription}
        </Typography>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={1}>
            <CircularProgress size={22} aria-label={t.ticketList.clientSuggestionQueueLoading} />
          </Box>
        ) : isError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => void refetch()} data-testid="button-retry-client-suggestions">{t.ticketList.clientSuggestionQueueRetry}</Button>}
          >
            {t.ticketList.clientSuggestionQueueError}
          </Alert>
        ) : data.length === 0 ? (
          <Typography variant="body2" color="text.secondary" data-testid="text-client-suggestion-queue-empty">
            {t.ticketList.clientSuggestionQueueEmpty}
          </Typography>
        ) : (
          <Box>
            {actionError && (
              <Alert severity="error" sx={{ mb: 1.5 }} data-testid="alert-client-suggestion-action-error">
                {t.ticketList.clientSuggestionActionError}
              </Alert>
            )}
            {data.map((suggestion, index) => (
              <Box key={suggestion.id} data-testid={`row-client-suggestion-${suggestion.id}`}>
                {index > 0 && <Divider sx={{ my: 1.5 }} />}
                <Box
                  display="flex"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  gap={2}
                  flexDirection={{ xs: "column", sm: "row" }}
                >
                  <Box minWidth={0}>
                    <Link href={`/tickets/${suggestion.id}`} data-testid={`link-client-suggestion-ticket-${suggestion.id}`}>
                      <Typography component="span" fontWeight={700} sx={{ color: "primary.main", cursor: "pointer" }}>
                        {t.ticketList.clientSuggestionTicket(suggestion.id, suggestion.ticketNumber)}
                      </Typography>
                    </Link>
                    <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
                      {suggestion.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {suggestion.suggestedClient.alias || suggestion.suggestedClient.name}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1} flexShrink={0}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckCircleOutline />}
                      disabled={busyTicketId !== null}
                      onClick={() => void reviewSuggestion(suggestion.id, "confirm")}
                      data-testid={`button-confirm-client-suggestion-${suggestion.id}`}
                    >
                      {t.ticketList.clientSuggestionConfirm}
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<Close />}
                      disabled={busyTicketId !== null}
                      onClick={() => void reviewSuggestion(suggestion.id, "dismiss")}
                      data-testid={`button-dismiss-client-suggestion-${suggestion.id}`}
                    >
                      {t.ticketList.clientSuggestionDismiss}
                    </Button>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
