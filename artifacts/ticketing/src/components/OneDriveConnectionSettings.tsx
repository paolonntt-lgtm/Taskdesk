import { useCallback, useEffect, useState } from "react";
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
  Stack,
  Typography,
} from "@mui/material";
import { CloudSync, LinkOff } from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";
import OneDriveLogo from "./OneDriveLogo";
import { useAuth } from "../contexts/AuthContext";

type Connection = { connected: boolean; microsoftEmail?: string; reconnectRequired?: boolean };
type Notice = { severity: "success" | "error" | "info"; text: string } | null;

export default function OneDriveConnectionSettings() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const copy = t.settings;
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [archiveOwner, setArchiveOwner] = useState<{ ownerUserId: number; ownerEmail: string | null } | null>(null);

  const loadConnection = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/onedrive/connection", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || copy.oneDriveLoadError);
      setConnection(data as Connection);
      setReconnectRequired(Boolean((data as Connection).reconnectRequired));
      const archiveResponse = await fetch("/api/onedrive/client-archive", { credentials: "include", cache: "no-store" });
      if (archiveResponse.ok) {
        const archive = await archiveResponse.json();
        setArchiveOwner(archive.configured ? { ownerUserId: archive.ownerUserId, ownerEmail: archive.ownerEmail } : null);
      }
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof Error ? error.message : copy.oneDriveLoadError,
      });
    } finally {
      setLoading(false);
    }
  }, [copy.oneDriveLoadError]);

  const selectClientArchive = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/onedrive/client-archive/select", { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (lang === "it" ? "Impossibile impostare l’archivio clienti." : "Could not set the client archive."));
      setArchiveOwner({ ownerUserId: user!.id, ownerEmail: connection?.microsoftEmail ?? null });
      setNotice({ severity: "success", text: lang === "it" ? "Archivio clienti OneDrive attivato." : "OneDrive client archive enabled." });
    } catch (error) {
      setNotice({ severity: "error", text: error instanceof Error ? error.message : copy.oneDriveRequestError });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadConnection();
    const refreshConnectionOnFocus = () => void loadConnection();
    window.addEventListener("focus", refreshConnectionOnFocus);
    const currentUrl = new URL(window.location.href);
    const result = currentUrl.searchParams.get("onedrive");
    if (result === "connected") {
      setReconnectRequired(false);
      setNotice({ severity: "success", text: copy.oneDriveConnectedSuccess });
    } else if (result === "sharing_partial") {
      setNotice({
        severity: "info",
        text: lang === "it"
          ? "Account collegato, ma alcuni inviti non sono riusciti. Ricollega OneDrive per riprovare."
          : "Account connected, but some invitations failed. Reconnect OneDrive to retry.",
      });
    } else if (result === "revocation_failed") {
      setNotice({ severity: "error", text: copy.oneDriveRevocationFailed });
    } else if (result === "revocation_reconnect_required") {
      setReconnectRequired(true);
      setNotice({ severity: "error", text: copy.oneDriveRevocationReconnectRequired });
    } else if (result === "cancelled") {
      setNotice({ severity: "info", text: copy.oneDriveConnectCancelled });
    } else if (result) {
      setNotice({ severity: "error", text: copy.oneDriveConnectError });
    }
    if (result) {
      currentUrl.searchParams.delete("onedrive");
      window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    return () => window.removeEventListener("focus", refreshConnectionOnFocus);
  }, [
    copy.oneDriveConnectCancelled,
    copy.oneDriveConnectError,
    copy.oneDriveConnectedSuccess,
    copy.oneDriveRevocationFailed,
    copy.oneDriveRevocationReconnectRequired,
    loadConnection,
  ]);

  const startConnect = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const popup = window.open(`/api/onedrive/connect?returnTo=${encodeURIComponent(returnTo)}`, "_blank");
    if (!popup) {
      setNotice({ severity: "error", text: copy.oneDrivePopupBlocked });
      return;
    }
    popup.opener = null;
  };

  const disconnect = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/onedrive/connection", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const needsReconnect = data.code === "ONEDRIVE_RECONNECT_REQUIRED";
        setReconnectRequired(needsReconnect);
        if (needsReconnect) setDisconnectDialogOpen(false);
        const message = data.code === "ONEDRIVE_RECONNECT_REQUIRED"
          ? copy.oneDriveDisconnectReconnectRequired
          : data.code === "ONEDRIVE_REVOCATION_FAILED"
            ? copy.oneDriveRevocationFailed
            : data.error || copy.oneDriveRequestError;
        throw new Error(message);
      }
      setConnection({ connected: false });
      setDisconnectDialogOpen(false);
      setNotice({ severity: "success", text: copy.oneDriveDisconnectedSuccess });
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof Error ? error.message : copy.oneDriveRequestError,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <OneDriveLogo width={38} height={38} />
            <Box>
              <Typography variant="h6" fontWeight={700}>{copy.oneDriveSettingsTitle}</Typography>
              <Typography variant="body2" color="text.secondary">{copy.oneDriveSettingsDescription}</Typography>
            </Box>
          </Stack>

          {notice && (
            <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
              {notice.text}
            </Alert>
          )}

          {loading ? (
            <CircularProgress size={22} />
          ) : (
            <>
              {connection?.connected && reconnectRequired && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {copy.oneDriveReconnectRequired}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" mb={2}>
                {connection?.connected
                  ? `${copy.oneDriveCurrentlyConnected}: ${connection.microsoftEmail ?? ""}`
                  : copy.oneDriveNotConnected}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {copy.oneDriveAccountHint}
              </Typography>
              {user?.role === "admin" && connection?.connected && (
                <Box mb={2}>
                  {archiveOwner ? (
                    <Alert severity={archiveOwner.ownerUserId === user.id ? "success" : "info"}>
                      {archiveOwner.ownerUserId === user.id
                        ? (lang === "it" ? "Questo account ospita l’archivio OneDrive dei clienti." : "This account owns the OneDrive client archive.")
                        : (lang === "it" ? `Archivio clienti gestito da ${archiveOwner.ownerEmail ?? "un altro amministratore"}.` : `Client archive managed by ${archiveOwner.ownerEmail ?? "another administrator"}.`)}
                    </Alert>
                  ) : (
                    <Stack spacing={1}>
                      <Alert severity="info">
                        {lang === "it"
                          ? "Per creare nomi descrittivi, l’IA analizzerà gli allegati. Il contenuto o il testo estratto sarà inviato al servizio IA."
                          : "To create descriptive names, AI will analyze attachments. File content or extracted text will be sent to the AI service."}
                      </Alert>
                      <Button variant="outlined" onClick={() => void selectClientArchive()} disabled={saving || reconnectRequired}>
                        {lang === "it" ? "Usa questo account per l’archivio clienti" : "Use this account for the client archive"}
                      </Button>
                    </Stack>
                  )}
                </Box>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<CloudSync />}
                  onClick={() => reconnectRequired
                    ? startConnect()
                    : connection?.connected
                      ? setSwitchDialogOpen(true)
                      : startConnect()}
                  disabled={saving}
                >
                  {reconnectRequired
                    ? copy.oneDriveReconnectSameAccount
                    : connection?.connected
                      ? copy.oneDriveSwitchAccount
                      : copy.oneDriveConnect}
                </Button>
                {connection?.connected && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<LinkOff />}
                    onClick={() => setDisconnectDialogOpen(true)}
                    disabled={saving}
                  >
                    {copy.oneDriveDisconnect}
                  </Button>
                )}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={switchDialogOpen} onClose={() => setSwitchDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{copy.oneDriveSwitchDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">{copy.oneDriveSwitchDialogText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwitchDialogOpen(false)}>{copy.oneDriveCancel}</Button>
          <Button variant="contained" onClick={startConnect}>{copy.oneDriveSwitchConfirm}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={disconnectDialogOpen} onClose={() => !saving && setDisconnectDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{copy.oneDriveDisconnectDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">{copy.oneDriveDisconnectDialogText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectDialogOpen(false)} disabled={saving}>{copy.oneDriveCancel}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void disconnect()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LinkOff />}
          >
            {copy.oneDriveDisconnect}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
