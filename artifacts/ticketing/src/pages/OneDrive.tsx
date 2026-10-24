import { useCallback, useEffect, useState } from "react";
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
  UploadFileOutlined,
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
  canUpload: boolean;
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
  const [uploadingOwnerId, setUploadingOwnerId] = useState<number | null>(null);
  const [uploadNotices, setUploadNotices] = useState<Record<number, { severity: "success" | "error"; text: string }>>({});
  const [preview, setPreview] = useState<{ item: OneDriveBrowseItem; result?: OneDrivePreview; error?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadFolder = useCallback(async (ownerUserId: number, path: Breadcrumb[]) => {
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
    } catch {
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
  }, [copy.loadFolderError]);

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

  useEffect(() => {
    if (!connected) return;
    for (const share of shares) {
      if (!browsers[share.ownerUserId]) void loadFolder(share.ownerUserId, []);
    }
  }, [browsers, connected, loadFolder, shares]);

  const connect = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/onedrive/connect?returnTo=${encodeURIComponent(returnTo)}`);
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

  const uploadFile = async (ownerUserId: number, path: Breadcrumb[], file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      setUploadNotices((current) => ({
        ...current,
        [ownerUserId]: { severity: "error", text: copy.uploadTooLarge },
      }));
      return;
    }
    setUploadingOwnerId(ownerUserId);
    setUploadNotices((current) => {
      const next = { ...current };
      delete next[ownerUserId];
      return next;
    });
    try {
      const query = new URLSearchParams();
      path.forEach(({ id }) => query.append("path", id));
      const queryString = query.toString();
      const suffix = queryString ? `?${queryString}` : "";
      const response = await fetch(`/api/onedrive/folders/${ownerUserId}/items/upload${suffix}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-File-Content-Type": file.type,
        },
        body: file,
      });
      if (!response.ok) throw new Error("upload failed");
      setUploadNotices((current) => ({
        ...current,
        [ownerUserId]: { severity: "success", text: copy.uploadSuccess },
      }));
      await loadFolder(ownerUserId, path);
    } catch {
      setUploadNotices((current) => ({
        ...current,
        [ownerUserId]: { severity: "error", text: copy.uploadError },
      }));
    } finally {
      setUploadingOwnerId(null);
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
              <CardContent sx={{ position: "relative", pt: 2.5 }}>
                <IconButton
                  component="a"
                  href={share.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.openOneDrive}
                  title={copy.openOneDrive}
                  size="small"
                  sx={{ position: "absolute", top: 8, right: 8 }}
                >
                  <OpenInNew fontSize="small" />
                </IconButton>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ pr: { xs: 4, sm: 5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                    <OneDriveLogo width={30} height={30} />
                    <Box minWidth={0}>
                      <Typography fontWeight={650} sx={{ overflowWrap: "anywhere" }}>Taskdesk · {share.operatorName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {copy.sharedFolder}
                      </Typography>
                    </Box>
                  </Stack>
                  {connected && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {share.canUpload && (
                        <>
                          <input
                            id={`onedrive-upload-${share.ownerUserId}`}
                            type="file"
                            hidden
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = "";
                              if (file) void uploadFile(share.ownerUserId, browse?.path ?? [], file);
                            }}
                          />
                          <Button
                            size="small"
                            component="label"
                            htmlFor={`onedrive-upload-${share.ownerUserId}`}
                            variant="contained"
                            disabled={uploadingOwnerId === share.ownerUserId || browse?.loading}
                            startIcon={uploadingOwnerId === share.ownerUserId
                              ? <CircularProgress size={14} color="inherit" />
                              : <UploadFileOutlined />}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            {uploadingOwnerId === share.ownerUserId ? copy.uploading : copy.uploadFile}
                          </Button>
                        </>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void loadFolder(share.ownerUserId, [])}
                        disabled={browse?.loading}
                        startIcon={browse?.loading ? <CircularProgress size={14} color="inherit" /> : <FolderOutlined />}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {browse ? copy.refresh : copy.browse}
                      </Button>
                    </Stack>
                  )}
                </Stack>

                {connected && share.canUpload && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                    {copy.uploadHint}
                  </Typography>
                )}

                {uploadNotices[share.ownerUserId] && (
                  <Alert severity={uploadNotices[share.ownerUserId].severity} sx={{ mt: 1.5 }}>
                    {uploadNotices[share.ownerUserId].text}
                  </Alert>
                )}

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
                            <List
                              disablePadding
                              sx={{
                                display: "grid",
                                gap: 1,
                              }}
                            >
                              {browse.items.map((item) => (
                                <ListItemButton
                                  key={item.id}
                                  onClick={() => item.kind === "folder"
                                    ? void loadFolder(share.ownerUserId, [...browse.path, { id: item.id, name: item.name }])
                                    : void showPreview(share.ownerUserId, item, browse.path)}
                                  sx={{
                                    minWidth: 0,
                                    border: "1px solid",
                                    borderColor: item.kind === "folder" ? "rgba(37, 99, 235, 0.22)" : "divider",
                                    borderRadius: 2,
                                    px: { xs: 1.25, sm: 1.5 },
                                    py: 1.15,
                                    bgcolor: item.kind === "folder" ? "rgba(37, 99, 235, 0.045)" : "background.paper",
                                    transition: "background-color 140ms ease, border-color 140ms ease, transform 140ms ease",
                                    "&:hover": {
                                      bgcolor: item.kind === "folder" ? "rgba(37, 99, 235, 0.09)" : "action.hover",
                                      borderColor: item.kind === "folder" ? "primary.light" : "divider",
                                    },
                                  }}
                                >
                                  <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>
                                    <Box
                                      sx={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 1.5,
                                        display: "grid",
                                        placeItems: "center",
                                        color: item.kind === "folder" ? "primary.main" : "text.secondary",
                                        bgcolor: item.kind === "folder" ? "rgba(37, 99, 235, 0.12)" : "action.hover",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {item.kind === "folder"
                                        ? <FolderOutlined />
                                        : <DescriptionOutlined />}
                                    </Box>
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={item.name}
                                    secondary={[
                                      formatFileSize(item.size, it),
                                      item.lastModifiedDateTime
                                        ? new Date(item.lastModifiedDateTime).toLocaleDateString(it ? "it-IT" : "en-US")
                                        : "",
                                    ].filter(Boolean).join(" · ") || undefined}
                                    primaryTypographyProps={{ noWrap: true, fontWeight: item.kind === "folder" ? 650 : 500 }}
                                    secondaryTypographyProps={{ noWrap: true, fontSize: 12 }}
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
