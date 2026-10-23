import { useEffect, useState } from "react";
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Stack, Typography,
} from "@mui/material";
import { ArrowBack, FolderOutlined } from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";
import {
  getOneDriveAccessToken,
  isOneDriveInteractionInProgress,
  listOneDriveChildren,
  type OneDriveItem,
} from "../lib/onedrive";

export type SelectedOneDriveFolder = { driveFolderId: string; folderName: string };
type Crumb = { id: string; name: string };

export default function OneDriveFolderPicker({
  open,
  onClose,
  onSelectFolder,
}: {
  open: boolean;
  onClose: () => void;
  onSelectFolder: (folder: SelectedOneDriveFolder) => void;
}) {
  const { lang } = useLanguage();
  const it = lang === "it";
  const [items, setItems] = useState<OneDriveItem[]>([]);
  const [path, setPath] = useState<Crumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionBlocked, setInteractionBlocked] = useState(false);

  const load = async (parentId?: string) => {
    setLoading(true);
    setError(null);
    setInteractionBlocked(false);
    try {
      setItems(await listOneDriveChildren(parentId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "OneDrive request failed.");
      setInteractionBlocked(isOneDriveInteractionInProgress(failure));
    } finally {
      setLoading(false);
    }
  };

  const retryAuthentication = async () => {
    setLoading(true);
    setError(null);
    try {
      await getOneDriveAccessToken(false, true);
      setInteractionBlocked(false);
      await load(path.at(-1)?.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "OneDrive request failed.");
      setInteractionBlocked(isOneDriveInteractionInProgress(failure));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setPath([]);
    void load();
  }, [open]);

  const openFolder = async (folder: OneDriveItem) => {
    if (!folder.folder) return;
    setPath((previous) => [...previous, { id: folder.id, name: folder.name }]);
    await load(folder.id);
  };

  const goUp = async () => {
    const nextPath = path.slice(0, -1);
    setPath(nextPath);
    await load(nextPath.at(-1)?.id);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{it ? "Scegli una cartella OneDrive" : "Choose a OneDrive folder"}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" alignItems="center" gap={1} mb={1}>
          <IconButton size="small" aria-label={it ? "Cartella precedente" : "Previous folder"} disabled={!path.length || loading} onClick={() => void goUp()}>
            <ArrowBack fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {it ? "I miei file" : "My files"}{path.length ? ` / ${path.map((part) => part.name).join(" / ")}` : ""}
          </Typography>
        </Stack>
        {error && (
          <Box role="alert">
            <Typography color="error" variant="body2">{error}</Typography>
            {interactionBlocked && (
              <Button size="small" onClick={() => void retryAuthentication()}>
                {it ? "Riprova accesso Microsoft" : "Retry Microsoft sign-in"}
              </Button>
            )}
          </Box>
        )}
        {loading ? <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box> : error ? null : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{it ? "Nessuna cartella disponibile." : "No folders available."}</Typography>
        ) : (
          <List dense>
            {items.filter((item) => item.folder).map((folder) => (
              <ListItem key={folder.id} disablePadding secondaryAction={
                <Button size="small" onClick={() => onSelectFolder({ driveFolderId: folder.id, folderName: folder.name })}>
                  {it ? "Collega" : "Link"}
                </Button>
              }>
                <ListItemButton onClick={() => void openFolder(folder)} sx={{ borderRadius: 1 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}><FolderOutlined /></ListItemIcon>
                  <ListItemText primary={folder.name} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{it ? "Chiudi" : "Close"}</Button>
      </DialogActions>
    </Dialog>
  );
}
