import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DescriptionOutlined, FolderOutlined, OpenInNew } from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";

type DriveContext = "library" | "new-ticket";

type DriveItem = {
  driveItemId: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  webViewLink: string | null;
};

export type SelectedDriveFolder = {
  driveFolderId: string;
  folderName: string;
};

type Breadcrumb = {
  id: string;
  name: string;
};

type DriveBrowserProps = {
  context: DriveContext;
  selectionMode?: boolean;
  onSelectFolder?: (folder: SelectedDriveFolder) => void;
};

const OAUTH_MESSAGE_TYPE = "taskdesk-drive-oauth";

async function fetchDriveItems(parentId: string): Promise<DriveItem[]> {
  const response = await fetch(`/api/drive/items?parentId=${encodeURIComponent(parentId)}`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || body.error || `HTTP ${response.status}`) as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = body.error;
    throw error;
  }
  return body as DriveItem[];
}

export default function DriveBrowser({
  context,
  selectionMode = false,
  onSelectFolder,
}: DriveBrowserProps) {
  const { lang } = useLanguage();
  const text = lang === "it"
    ? {
        myDrive: "Il mio Drive",
        connect: "Collega Google Drive",
        connecting: "Connessione…",
        popupBlocked: "Il browser ha bloccato la finestra di autorizzazione. Consenti i popup e riprova.",
        connectFailed: "Non è stato possibile collegare Google Drive. Riprova.",
        loadFailed: "Impossibile caricare i contenuti di Google Drive.",
        empty: "Questa cartella è vuota.",
        select: "Seleziona",
        openDrive: "Apri in Google Drive",
      }
    : {
        myDrive: "My Drive",
        connect: "Connect Google Drive",
        connecting: "Connecting…",
        popupBlocked: "The browser blocked the authorization window. Allow popups and try again.",
        connectFailed: "Could not connect Google Drive. Try again.",
        loadFailed: "Could not load Google Drive contents.",
        empty: "This folder is empty.",
        select: "Select",
        openDrive: "Open in Google Drive",
      };

  const [path, setPath] = useState<Breadcrumb[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolder = useCallback(async (folderId: string, nextPath: Breadcrumb[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDriveItems(folderId);
      setItems(result);
      setPath(nextPath);
      setNeedsAuth(false);
    } catch (loadError) {
      const failure = loadError as Error & { code?: string };
      if (failure.code === "DRIVE_AUTH_REQUIRED" || failure.code === "DRIVE_TOKEN_EXPIRED") {
        setNeedsAuth(true);
        setItems([]);
      } else {
        setError(failure.message || text.loadFailed);
      }
    } finally {
      setLoading(false);
    }
  }, [text.loadFailed]);

  useEffect(() => {
    void loadFolder("root", [{ id: "root", name: text.myDrive }]);
  }, [loadFolder, text.myDrive]);

  useEffect(() => {
    const onOAuthMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== OAUTH_MESSAGE_TYPE ||
        event.data?.context !== context
      ) return;

      setConnecting(false);
      if (event.data.status === "ok") {
        void loadFolder("root", [{ id: "root", name: text.myDrive }]);
      } else {
        setError(event.data.status === "not_configured" ? text.connectFailed : text.connectFailed);
      }
    };

    window.addEventListener("message", onOAuthMessage);
    return () => window.removeEventListener("message", onOAuthMessage);
  }, [context, loadFolder, text.connectFailed, text.myDrive]);

  const connectDrive = () => {
    setError(null);
    setConnecting(true);
    const popup = window.open(
      `/api/drive/session/oauth/start?context=${context}`,
      "taskdesk-google-drive",
      "popup,width=560,height=720",
    );
    if (!popup) {
      setConnecting(false);
      setError(text.popupBlocked);
    }
  };

  const openFolder = (item: DriveItem) => {
    if (!item.isFolder) return;
    void loadFolder(item.driveItemId, [...path, { id: item.driveItemId, name: item.name }]);
  };

  const openBreadcrumb = (index: number) => {
    const nextPath = path.slice(0, index + 1);
    const folder = nextPath[nextPath.length - 1];
    if (folder) void loadFolder(folder.id, nextPath);
  };

  const openFile = (item: DriveItem) => {
    const url = item.webViewLink || `https://drive.google.com/open?id=${encodeURIComponent(item.driveItemId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      {error && <Alert severity="warning" sx={{ m: 1 }}>{error}</Alert>}
      {needsAuth ? (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {text.connect}
          </Typography>
          <Button variant="contained" onClick={connectDrive} disabled={connecting}>
            {connecting ? <CircularProgress size={18} color="inherit" /> : text.connect}
          </Button>
        </Box>
      ) : (
        <>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}
          >
            <Breadcrumbs aria-label={text.myDrive}>
              {path.map((crumb, index) =>
                index === path.length - 1 ? (
                  <Typography key={crumb.id} color="text.primary" variant="body2">
                    {crumb.name}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.id}
                    component="button"
                    underline="hover"
                    color="inherit"
                    variant="body2"
                    onClick={() => openBreadcrumb(index)}
                  >
                    {crumb.name}
                  </Link>
                ),
              )}
            </Breadcrumbs>
            <Button size="small" onClick={connectDrive} disabled={connecting}>
              {connecting ? text.connecting : text.connect}
            </Button>
          </Stack>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={26} />
            </Box>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
              {text.empty}
            </Typography>
          ) : (
            <List dense disablePadding>
              {items.map((item) => (
                <ListItem
                  key={item.driveItemId}
                  disablePadding
                  secondaryAction={
                    selectionMode && item.isFolder ? (
                      <Button
                        size="small"
                        onClick={() => onSelectFolder?.({
                          driveFolderId: item.driveItemId,
                          folderName: item.name,
                        })}
                      >
                        {text.select}
                      </Button>
                    ) : !item.isFolder ? (
                      <Button
                        size="small"
                        aria-label={`${text.openDrive}: ${item.name}`}
                        onClick={() => openFile(item)}
                      >
                        <OpenInNew fontSize="small" />
                      </Button>
                    ) : undefined
                  }
                >
                  <ListItemButton
                    onClick={() => item.isFolder ? openFolder(item) : openFile(item)}
                    sx={{ borderRadius: 0, pr: selectionMode && item.isFolder ? 10 : 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 38 }}>
                      {item.isFolder ? <FolderOutlined /> : <DescriptionOutlined />}
                    </ListItemIcon>
                    <ListItemText primary={item.name} secondary={item.isFolder ? undefined : item.mimeType} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Paper>
  );
}
