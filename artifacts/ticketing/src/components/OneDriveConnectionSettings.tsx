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

type Connection = { connected: boolean; microsoftEmail?: string };
type Notice = { severity: "success" | "error" | "info"; text: string } | null;

export default function OneDriveConnectionSettings() {
  const { t, lang } = useLanguage();
  const copy = t.settings;
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

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
    } catch (error) {
      setNotice({
        severity: "error",
        text: error instanceof Error ? error.message : copy.oneDriveLoadError,
      });
    } finally {
      setLoading(false);
    }
  }, [copy.oneDriveLoadError]);

  useEffect(() => {
    void loadConnection();
    const currentUrl = new URL(window.location.href);
    const result = currentUrl.searchParams.get("onedrive");
    if (result === "connected") {
      setNotice({ severity: "success", text: copy.oneDriveConnectedSuccess });
    } else if (result === "sharing_partial") {
      setNotice({
        severity: "info",
        text: lang === "it"
          ? "Account collegato, ma alcuni inviti non sono riusciti. Ricollega OneDrive per riprovare."
          : "Account connected, but some invitations failed. Reconnect OneDrive to retry.",
      });
    } else if (result === "cancelled") {
      setNotice({ severity: "info", text: copy.oneDriveConnectCancelled });
    } else if (result) {
      setNotice({ severity: "error", text: copy.oneDriveConnectError });
    }
    if (result) {
      currentUrl.searchParams.delete("onedrive");
      window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
  }, [copy.oneDriveConnectCancelled, copy.oneDriveConnectError, copy.oneDriveConnectedSuccess, loadConnection]);

  const startConnect = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/onedrive/connect?returnTo=${encodeURIComponent(returnTo)}`);
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
      if (!response.ok) throw new Error(data.error || copy.oneDriveRequestError);
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
              <Typography variant="body2" color="text.secondary" mb={2}>
                {connection?.connected
                  ? `${copy.oneDriveCurrentlyConnected}: ${connection.microsoftEmail ?? ""}`
                  : copy.oneDriveNotConnected}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {copy.oneDriveAccountHint}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<CloudSync />}
                  onClick={() => connection?.connected ? setSwitchDialogOpen(true) : startConnect()}
                  disabled={saving}
                >
                  {connection?.connected ? copy.oneDriveSwitchAccount : copy.oneDriveConnect}
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
