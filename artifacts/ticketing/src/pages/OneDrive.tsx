import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  ChevronRight,
  Close,
  DescriptionOutlined,
  FolderOutlined,
  OpenInNew,
  PreviewOutlined,
} from "@mui/icons-material";
import {
  listSharedOneDriveFolderItems,
  previewSharedOneDriveItem,
  type OneDriveBrowseItem,
  type OneDrivePreview,
} from "@workspace/api-client-react";
import { useLanguage } from "../contexts/LanguageContext";
import OneDriveLogo from "../components/OneDriveLogo";

type OrganizationShare = {
  ownerUserId: number;
  operatorName: string;
  url: string;
};

type Breadcrumb = { id: string; name: string };
type BrowseState = {
  path: Breadcrumb[];
  folderName: string;
  items: OneDriveBrowseItem[];
  loading: boolean;
  error: string;
};

function formatFileSize(bytes: number | null, italian: boolean): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString(italian ? "it-IT" : "en-US", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

export default function OneDrivePage() {
  const { lang, t } = useLanguage();
  const it = lang === "it";
  const copy = t.settings.oneDriveBrowse;
  const [shares, setShares] = useState<OrganizationShare[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);
  const [browsers, setBrowsers] = useState<Record<number, BrowseState>>({});
  const [preview, setPreview] = useState<{ item: OneDriveBrowseItem; result?: OneDrivePreview; error?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const currentUrl = new URL(window.location.href);
    const result = currentUrl.searchParams.get("onedrive");
    if (result) {
      setOauthStatus(result);
      currentUrl.searchParams.delete("onedrive");
      window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }

    Promise.all([
      fetch("/api/onedrive/organization-shares", { credentials: "include", cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(copy.loadSharesError);
          return response.json() as Promise<OrganizationShare[]>;
        }),
      fetch("/api/onedrive/connection", { credentials: "include", cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(copy.checkConnectionError);
          return response.json() as Promise<{ connected: boolean }>;
        }),
    ])
      .then(([shareData, connection]) => {
        if (!active) return;
        setShares(shareData);
        setConnected(connection.connected);
      })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : copy.checkConnectionError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [it]);

  const connect = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/onedrive/connect?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const loadFolder = async (ownerUserId: number, path: Breadcrumb[]) => {
    setBrowsers((current) => ({
      ...current,
      [ownerUserId]: {
        path,
        folderName: current[ownerUserId]?.folderName ?? "",
        items: current[ownerUserId]?.items ?? [],
        loading: true,
        error: "",
      },
    }));
    try {
      const result = await listSharedOneDriveFolderItems(ownerUserId, { path: path.map(({ id }) => id) });
      setBrowsers((current) => ({
        ...current,
        [ownerUserId]: { path, folderName: result.folderName, items: result.items, loading: false, error: "" },
      }));
    } catch (failure) {
      setBrowsers((current) => ({
        ...current,
        [ownerUserId]: {
          path,
          folderName: current[ownerUserId]?.folderName ?? "",
          items: [],
          loading: false,
          error: copy.loadFolderError,
        },
      }));
    }
  };

  const showPreview = async (ownerUserId: number, item: OneDriveBrowseItem, path: Breadcrumb[]) => {
    setPreview({ item });
    setPreviewLoading(true);
    try {
      const result = await previewSharedOneDriveItem(ownerUserId, item.id, { path: path.map(({ id }) => id) });
      if (!result.getUrl.startsWith("https://")) throw new Error(copy.invalidPreviewUrl);
      setPreview({ item, result });
    } catch (failure) {
      setPreview({
        item,
          error: copy.previewUnavailable,
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Box maxWidth={1000} mx="auto">
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <OneDriveLogo width={38} height={38} />
        <Typography variant="h4" fontWeight={700}>
          {copy.title}
        </Typography>
      </Stack>
      <Typography color="text.secondary" mb={3}>
        {copy.subtitle}
      </Typography>

      {oauthStatus && (
        <Alert
          severity={oauthStatus === "connected" ? "success" : oauthStatus === "cancelled" ? "info" : oauthStatus === "sharing_partial" ? "warning" : "error"}
          sx={{ mb: 2 }}
        >
          {oauthStatus === "connected"
            ? copy.connectedSuccess
            : oauthStatus === "sharing_partial"
              ? copy.sharingPartial
              : oauthStatus === "cancelled"
                ? copy.cancelled
                : oauthStatus === "connect_error"
                  ? copy.connectError
                  : copy.invalidSession}
        </Alert>
      )}
      {loading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && !error && !connected && (
        <Alert
          severity="info"
          action={<Button color="inherit" onClick={connect}>{copy.connect}</Button>}
          sx={{ mb: 2 }}
        >
          {copy.connectPrompt}
        </Alert>
      )}
      {!loading && !error && shares.length === 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography fontWeight={600} mb={1}>
              {copy.noFoldersTitle}
            </Typography>
            <Typography color="text.secondary" mb={2}>
              {copy.noFoldersDescription}
            </Typography>
            <Button variant="contained" onClick={connect}>
              {copy.connect}
            </Button>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1.5}>
        {shares.map((share) => {
          const browse = browsers[share.ownerUserId];
          return (
            <Card key={share.ownerUserId} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                    <OneDriveLogo width={30} height={30} />
                    <Box minWidth={0}>
                      <Typography fontWeight={650}>Taskdesk · {share.operatorName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {copy.sharedFolder}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} flexShrink={0}>
                    {connected && (
                      <Button
                        variant="contained"
                        onClick={() => void loadFolder(share.ownerUserId, [])}
                        disabled={browse?.loading}
                        startIcon={browse?.loading ? <CircularProgress size={16} color="inherit" /> : <FolderOutlined />}
                      >
                        {browse ? copy.refresh : copy.browse}
                      </Button>
                    )}
                    <Button
                      component="a"
                      href={share.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNew />}
                    >
                      OneDrive
                    </Button>
                  </Stack>
                </Stack>

                {browse && (
                  <Box mt={2}>
                    <Divider sx={{ mb: 1.5 }} />
                    {browse.path.length > 0 && (
                      <Button
                        size="small"
                        startIcon={<ArrowBack />}
                        onClick={() => void loadFolder(share.ownerUserId, browse.path.slice(0, -1))}
                        sx={{ mb: 1 }}
                      >
                        {copy.back}
                      </Button>
                    )}
                    <Breadcrumbs aria-label={copy.folderPath} sx={{ mb: 1.5 }}>
                      <Link
                        component="button"
                        underline="hover"
                        color="inherit"
                        onClick={() => void loadFolder(share.ownerUserId, [])}
                      >
                        {copy.rootFolder}
                      </Link>
                      {browse.path.map((crumb, index) => (
                        <Link
                          key={`${crumb.id}-${index}`}
                          component="button"
                          underline="hover"
                          color={index === browse.path.length - 1 ? "text.primary" : "inherit"}
                          onClick={() => void loadFolder(share.ownerUserId, browse.path.slice(0, index + 1))}
                        >
                          {crumb.name}
                        </Link>
                      ))}
                    </Breadcrumbs>

                    {browse.error && <Alert severity="error" sx={{ mb: 1.5 }}>{browse.error}</Alert>}
                    {browse.loading
                      ? <Box display="flex" justifyContent="center" py={3}><CircularProgress size={26} /></Box>
                      : browse.error
                        ? null
                        : browse.items.length === 0
                          ? <Typography color="text.secondary" py={2}>{copy.emptyFolder}</Typography>
                          : (
                            <List disablePadding>
                              {browse.items.map((item) => (
                                <ListItemButton
                                  key={item.id}
                                  onClick={() => item.kind === "folder"
                                    ? void loadFolder(share.ownerUserId, [...browse.path, { id: item.id, name: item.name }])
                                    : void showPreview(share.ownerUserId, item, browse.path)}
                                  sx={{ borderRadius: 1, px: 1.5 }}
                                >
                                  <ListItemIcon sx={{ minWidth: 38 }}>
                                    {item.kind === "folder"
                                      ? <FolderOutlined color="primary" />
                                      : <DescriptionOutlined color="action" />}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.name}
                                    secondary={[
                                      formatFileSize(item.size, it),
                                      item.lastModifiedDateTime
                                        ? new Date(item.lastModifiedDateTime).toLocaleDateString(it ? "it-IT" : "en-US")
                                        : "",
                                    ].filter(Boolean).join(" · ") || undefined}
                                    primaryTypographyProps={{ noWrap: true }}
                                  />
                                  {item.kind === "file"
                                    ? <PreviewOutlined fontSize="small" color="action" />
                                    : <ChevronRight fontSize="small" color="action" />}
                                </ListItemButton>
                              ))}
                            </List>
                          )}
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pr: 6 }}>
          {preview?.item.name}
          <IconButton aria-label={copy.closePreview} onClick={() => setPreview(null)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: { xs: 420, md: 620 }, p: 0, position: "relative" }}>
          {previewLoading && <Box display="flex" justifyContent="center" alignItems="center" minHeight={420}><CircularProgress /></Box>}
          {!previewLoading && preview?.result && (
            <Box
              component="iframe"
              title={preview.item.name}
              src={preview.result.getUrl}
              referrerPolicy="no-referrer"
              sx={{ display: "block", border: 0, width: "100%", height: { xs: 420, md: 620 } }}
            />
          )}
          {!previewLoading && preview?.error && (
            <Stack alignItems="center" spacing={2} p={4}>
              <Typography color="text.secondary" textAlign="center">{preview.error}</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {copy.previewUnsupported}
              </Typography>
              {preview.item.webUrl && (
                <Button
                  component="a"
                  href={preview.item.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNew />}
                  variant="contained"
                >
                  {copy.openOneDrive}
                </Button>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
