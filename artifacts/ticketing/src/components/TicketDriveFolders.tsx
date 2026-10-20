import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  DeleteOutline,
  DriveFileMoveOutlined,
  FolderOutlined,
  InsertDriveFile,
  OpenInNew,
} from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";

type DriveReference = {
  id: number;
  driveFolderId: string;
  folderName: string;
  createdAt: string;
};
type DriveFolder = {
  driveFolderId: string;
  folderName: string;
};
type DriveItem = {
  driveItemId: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  webViewLink: string | null;
};
type DriveFolderResponse = {
  currentFolder: DriveFolder;
  items: DriveItem[];
};
type Crumb = DriveFolder;

const OAUTH_MESSAGE_TYPE = "taskdesk-drive-oauth";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || "Google Drive request failed") as Error & { code?: string };
    error.code = body.error;
    throw error;
  }
  return body as T;
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code ?? "DRIVE_API_ERROR")
    : "DRIVE_API_ERROR";
}

export default function TicketDriveFolders({ ticketId }: { ticketId: number }) {
  const { t } = useLanguage();
  const text = t.ticketDetail;
  const [folders, setFolders] = useState<DriveReference[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFolders, setPickerFolders] = useState<DriveFolder[]>([]);
  const [pickerPath, setPickerPath] = useState<Crumb[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [browserReference, setBrowserReference] = useState<DriveReference | null>(null);
  const [browserPath, setBrowserPath] = useState<Crumb[]>([]);
  const [browserItems, setBrowserItems] = useState<DriveItem[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCodeValue, setErrorCodeValue] = useState<string | null>(null);
  const [pendingOAuthAction, setPendingOAuthAction] = useState<"picker" | "browser" | null>(null);

  const clearError = () => {
    setError(null);
    setErrorCodeValue(null);
  };
  const setDriveError = (code: string) => {
    setErrorCodeValue(code);
    setError(errorLabel(code));
  };

  const errorLabel = useCallback((code: string): string => {
    const labels: Record<string, string> = {
      DRIVE_NOT_CONFIGURED: text.driveNotConfigured,
      not_configured: text.driveNotConfigured,
      DRIVE_AUTH_REQUIRED: text.driveAuthRequired,
      DRIVE_TOKEN_EXPIRED: text.driveTokenExpired,
      expired: text.driveTokenExpired,
      DRIVE_ACCESS_DENIED: text.driveAccessDenied,
      DRIVE_ACCESS_REVOKED: text.driveAccessRevoked,
      DRIVE_FOLDER_OUTSIDE_LINK: text.driveOutsideLinkedFolder,
      cancelled: text.driveAuthorizationCancelled,
      invalid_state: text.driveAuthorizationFailed,
      oauth_error: text.driveAuthorizationFailed,
      DRIVE_TEMPORARILY_UNAVAILABLE: text.driveUnavailable,
      DRIVE_API_ERROR: text.driveUnavailable,
      NOT_A_FOLDER: text.driveSelectFolder,
    };
    return labels[code] ?? text.driveUnavailable;
  }, [text]);

  const loadReferences = useCallback(async () => {
    setLoadingFolders(true);
    try {
      setFolders(await requestJson<DriveReference[]>(`/api/tickets/${ticketId}/drive-folders`));
    } catch (loadError) {
      setDriveError(errorCode(loadError));
    } finally {
      setLoadingFolders(false);
    }
  }, [ticketId, errorLabel]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const loadPickerFolders = useCallback(async (parentId = "root") => {
    setPickerLoading(true);
    try {
      const query = new URLSearchParams();
      if (parentId !== "root") query.set("parentId", parentId);
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      setPickerFolders(await requestJson<DriveFolder[]>(`/api/drive/picker${suffix}`));
      clearError();
    } catch (loadError) {
      setDriveError(errorCode(loadError));
    } finally {
      setPickerLoading(false);
    }
  }, [errorLabel]);

  const loadBrowserFolder = useCallback(async (
    reference: DriveReference,
    folderId: string,
  ): Promise<DriveFolderResponse | null> => {
    setBrowserLoading(true);
    try {
      const query = new URLSearchParams({ folderId });
      const result = await requestJson<DriveFolderResponse>(
        `/api/tickets/${ticketId}/drive-folders/${reference.id}/items?${query.toString()}`,
      );
      setBrowserItems(result.items);
      clearError();
      return result;
    } catch (loadError) {
      setDriveError(errorCode(loadError));
      return null;
    } finally {
      setBrowserLoading(false);
    }
  }, [ticketId, errorLabel]);

  const startOAuth = useCallback((action: "picker" | "browser") => {
    clearError();
    setPendingOAuthAction(action);
    const popup = window.open(
      `/api/drive/oauth/start?ticketId=${ticketId}`,
      "taskdesk-google-drive",
      "popup,width=560,height=720",
    );
    if (!popup) {
      setPendingOAuthAction(null);
      setErrorCodeValue("POPUP_BLOCKED");
      setError(text.drivePopupBlocked);
    }
  }, [ticketId, text.drivePopupBlocked]);

  useEffect(() => {
    const onOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin ||
          event.data?.type !== OAUTH_MESSAGE_TYPE ||
          event.data?.ticketId !== ticketId) return;
      const status = String(event.data.status ?? "oauth_error");
      if (status !== "ok") {
        setPendingOAuthAction(null);
        setDriveError(status);
        return;
      }
      const action = pendingOAuthAction;
      setPendingOAuthAction(null);
      if (action === "picker") {
        setPickerPath([]);
        setPickerOpen(true);
        void loadPickerFolders("root");
      } else if (action === "browser" && browserReference) {
        void loadBrowserFolder(
          browserReference,
          browserPath[browserPath.length - 1]?.driveFolderId ?? browserReference.driveFolderId,
        );
      }
    };
    window.addEventListener("message", onOAuthMessage);
    return () => window.removeEventListener("message", onOAuthMessage);
  }, [ticketId, pendingOAuthAction, browserReference, browserPath, errorLabel, loadPickerFolders, loadBrowserFolder]);

  const openPicker = async () => {
    clearError();
    setPickerLoading(true);
    setPickerFolders([]);
    setPickerPath([]);
    setPickerOpen(true);
    try {
      setPickerFolders(await requestJson<DriveFolder[]>("/api/drive/picker"));
    } catch (pickerError) {
      const code = errorCode(pickerError);
      if (["DRIVE_AUTH_REQUIRED", "DRIVE_TOKEN_EXPIRED", "DRIVE_ACCESS_DENIED"].includes(code)) {
        setPickerOpen(false);
        startOAuth("picker");
      } else {
        setDriveError(code);
      }
    } finally {
      setPickerLoading(false);
    }
  };

  const openBrowser = async (reference: DriveReference) => {
    setBrowserReference(reference);
    setBrowserPath([]);
    setBrowserItems([]);
    const result = await loadBrowserFolder(reference, reference.driveFolderId);
    if (result) setBrowserPath([result.currentFolder]);
  };

  const openPickerFolder = async (folder: DriveFolder) => {
    const nextPath = [...pickerPath, folder];
    setPickerPath(nextPath);
    await loadPickerFolders(folder.driveFolderId);
  };

  const addFolder = async (folder: DriveFolder) => {
    try {
      const created = await requestJson<DriveReference>(`/api/tickets/${ticketId}/drive-folders`, {
        method: "POST",
        body: JSON.stringify({ folderId: folder.driveFolderId }),
      });
      setFolders((previous) => previous.some((item) => item.id === created.id)
        ? previous
        : [...previous, created]);
      setPickerOpen(false);
      clearError();
    } catch (addError) {
      const code = errorCode(addError);
      if (code === "DRIVE_AUTH_REQUIRED" || code === "DRIVE_TOKEN_EXPIRED") {
        startOAuth("picker");
      } else {
        setDriveError(code);
      }
    }
  };

  const removeFolder = async (reference: DriveReference) => {
    if (!window.confirm(`${text.driveRemoveConfirm} "${reference.folderName}"?`)) return;
    try {
      await requestJson(`/api/tickets/${ticketId}/drive-folders/${reference.id}`, { method: "DELETE" });
      setFolders((previous) => previous.filter((item) => item.id !== reference.id));
      if (browserReference?.id === reference.id) {
        setBrowserReference(null);
        setBrowserPath([]);
        setBrowserItems([]);
      }
      clearError();
    } catch (removeError) {
      setDriveError(errorCode(removeError));
    }
  };

  const enterBrowserFolder = async (item: DriveItem) => {
    if (!browserReference) return;
    const result = await loadBrowserFolder(browserReference, item.driveItemId);
    if (result) setBrowserPath((previous) => [...previous, result.currentFolder]);
  };

  const selectBrowserCrumb = async (index: number) => {
    if (!browserReference) return;
    const crumb = browserPath[index];
    const result = await loadBrowserFolder(browserReference, crumb.driveFolderId);
    if (result) setBrowserPath((previous) => previous.slice(0, index + 1));
  };

  const reconnectBrowser = () => {
    if (!browserReference) return;
    startOAuth("browser");
  };

  return (
    <Box mt={2} aria-label={text.driveSectionTitle}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
        <Typography variant="subtitle2" fontWeight={700}>{text.driveSectionTitle}</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DriveFileMoveOutlined />}
          onClick={() => void openPicker()}
        >
          {text.driveAddFolder}
        </Button>
      </Stack>
      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={["DRIVE_AUTH_REQUIRED", "DRIVE_TOKEN_EXPIRED", "DRIVE_ACCESS_DENIED", "DRIVE_ACCESS_REVOKED"].includes(errorCodeValue ?? "") && browserReference
            ? <Button color="inherit" size="small" onClick={reconnectBrowser}>{text.driveReconnect}</Button>
            : undefined}
        >
          {error}
        </Alert>
      )}
      {loadingFolders ? (
        <CircularProgress size={20} />
      ) : folders.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{text.driveNoLinkedFolders}</Typography>
      ) : (
        <List dense disablePadding>
          {folders.map((folder) => (
            <ListItem
              key={folder.id}
              disablePadding
              secondaryAction={
                <Tooltip title={text.driveRemoveFolder}>
                  <IconButton
                    aria-label={`${text.driveRemoveFolder}: ${folder.folderName}`}
                    edge="end"
                    size="small"
                    onClick={() => void removeFolder(folder)}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemButton onClick={() => void openBrowser(folder)} sx={{ borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 34 }}><FolderOutlined fontSize="small" /></ListItemIcon>
                <ListItemText primary={folder.folderName} secondary={text.driveOpenFolder} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{text.drivePickerTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {text.driveAccessNotice}
          </Typography>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <IconButton
              size="small"
              aria-label={text.drivePickerUp}
              disabled={pickerPath.length === 0 || pickerLoading}
              onClick={() => {
                const path = pickerPath.slice(0, -1);
                setPickerPath(path);
                void loadPickerFolders(path[path.length - 1]?.driveFolderId ?? "root");
              }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {text.drivePickerLocation}: {pickerPath.length ? pickerPath.map((item) => item.folderName).join(" / ") : text.driveMyDrive}
            </Typography>
          </Stack>
          {pickerLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
          ) : pickerFolders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{text.drivePickerEmpty}</Typography>
          ) : (
            <List dense>
              {pickerFolders.map((folder) => (
                <ListItem
                  key={folder.driveFolderId}
                  disablePadding
                  secondaryAction={
                    <Button size="small" onClick={() => void addFolder(folder)}>{text.driveLinkFolder}</Button>
                  }
                >
                  <ListItemButton onClick={() => void openPickerFolder(folder)} sx={{ borderRadius: 1 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}><FolderOutlined /></ListItemIcon>
                    <ListItemText primary={folder.folderName} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>{text.driveClose}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(browserReference)}
        onClose={() => {
          setBrowserReference(null);
          setBrowserPath([]);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{text.driveBrowserTitle}</DialogTitle>
        <DialogContent dividers>
          {browserReference && (
            <>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                {text.driveNoCopyNote}
              </Typography>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5} mb={1.5}>
                {browserPath.map((crumb, index) => (
                  <Box key={`${crumb.driveFolderId}-${index}`} display="flex" alignItems="center">
                    {index > 0 && <Typography color="text.disabled" mx={0.5}>/</Typography>}
                    <Button
                      size="small"
                      color={index === browserPath.length - 1 ? "primary" : "inherit"}
                      onClick={() => void selectBrowserCrumb(index)}
                      disabled={browserLoading}
                    >
                      {crumb.folderName}
                    </Button>
                  </Box>
                ))}
              </Stack>
              {browserLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
              ) : browserItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{text.driveFolderEmpty}</Typography>
              ) : (
                <List dense>
                  {browserItems.map((item) => (
                    <ListItem key={item.driveItemId} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          if (item.isFolder) {
                            void enterBrowserFolder(item);
                          } else {
                            const url = item.webViewLink ??
                              `https://drive.google.com/open?id=${encodeURIComponent(item.driveItemId)}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }
                        }}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {item.isFolder ? <FolderOutlined /> : <InsertDriveFile />}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.name}
                          secondary={item.isFolder ? text.driveOpenFolder : text.driveOpenInGoogleDrive}
                        />
                        {!item.isFolder && <OpenInNew fontSize="small" color="action" />}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBrowserReference(null);
            setBrowserPath([]);
          }}>{text.driveClose}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
