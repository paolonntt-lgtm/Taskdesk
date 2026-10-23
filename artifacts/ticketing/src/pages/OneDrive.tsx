import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { OpenInNew } from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";
import OneDriveLogo from "../components/OneDriveLogo";

type OrganizationShare = {
  operatorName: string;
  url: string;
};

export default function OneDrivePage() {
  const { lang } = useLanguage();
  const it = lang === "it";
  const [shares, setShares] = useState<OrganizationShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const result = currentUrl.searchParams.get("onedrive");
    if (result) {
      setOauthStatus(result);
      currentUrl.searchParams.delete("onedrive");
      window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    fetch("/api/onedrive/organization-shares", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(it ? "Impossibile caricare le cartelle condivise." : "Could not load shared folders.");
        return response.json() as Promise<OrganizationShare[]>;
      })
      .then((data) => { if (active) setShares(data); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : "OneDrive unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [it]);

  const connect = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/onedrive/connect?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <Box maxWidth={1000} mx="auto">
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <OneDriveLogo width={38} height={38} />
        <Typography variant="h4" fontWeight={700}>
          {it ? "Cartelle OneDrive Taskdesk" : "Taskdesk OneDrive folders"}
        </Typography>
      </Stack>
      <Typography color="text.secondary" mb={3}>
        {it
          ? "Apri le cartelle Taskdesk condivise con i collaboratori. Ogni cartella si apre in OneDrive e richiede l’accesso con l’account invitato."
          : "Open Taskdesk folders shared with collaborators. Each folder opens in OneDrive and requires sign-in with an invited account."}
      </Typography>

      {oauthStatus && (
        <Alert
          severity={oauthStatus === "connected" ? "success" : oauthStatus === "cancelled" ? "info" : oauthStatus === "sharing_partial" ? "warning" : "error"}
          sx={{ mb: 2 }}
        >
          {oauthStatus === "connected"
            ? (it ? "Account OneDrive collegato." : "OneDrive account connected.")
            : oauthStatus === "sharing_partial"
              ? (it
                ? "Account collegato, ma alcuni inviti ai collaboratori non sono riusciti. Ricollega OneDrive per riprovare."
                : "Account connected, but some collaborator invitations failed. Reconnect OneDrive to retry.")
              : oauthStatus === "cancelled"
                ? (it ? "Collegamento OneDrive annullato." : "OneDrive connection cancelled.")
                : oauthStatus === "connect_error"
                  ? (it
                    ? "Microsoft ha completato l’accesso, ma TaskDesk non è riuscito a salvare il collegamento. Riprova."
                    : "Microsoft sign-in completed, but TaskDesk could not save the connection. Please try again.")
                  : (it
                    ? "Sessione di collegamento scaduta o non valida. Riprova."
                    : "The connection session expired or was invalid. Please try again.")}
        </Alert>
      )}
      {loading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && !error && shares.length === 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography fontWeight={600} mb={1}>
              {it ? "Nessuna cartella condivisa" : "No shared folders yet"}
            </Typography>
            <Typography color="text.secondary" mb={2}>
              {it
                ? "Collega OneDrive dal dettaglio di un ticket per creare la cartella Taskdesk e invitare i collaboratori collegati."
                : "Connect OneDrive from a ticket detail page to create your Taskdesk folder and invite connected collaborators."}
            </Typography>
            <Button variant="contained" onClick={connect}>
              {it ? "Collega OneDrive" : "Connect OneDrive"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Stack spacing={1.5}>
        {shares.map((share) => (
          <Card key={share.url} variant="outlined">
            <CardContent sx={{ display: "flex", gap: 1.5, alignItems: "center", justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                <OneDriveLogo width={30} height={30} />
                <Box minWidth={0}>
                  <Typography fontWeight={650}>Taskdesk · {share.operatorName}</Typography>
                </Box>
              </Stack>
              <Button
                component="a"
                href={share.url}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNew />}
                sx={{ flexShrink: 0 }}
              >
                {it ? "Apri cartella" : "Open folder"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
