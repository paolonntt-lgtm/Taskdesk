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
import { ArrowBack, DeleteOutline, FolderOutlined, InsertDriveFile, OpenInNew } from "@mui/icons-material";
import { useLanguage } from "../contexts/LanguageContext";
import { listOneDriveChildren, type OneDriveItem, getOneDriveAccessToken } from "../lib/onedrive";

type OneDriveReference = {
  id: number;
  driveFolderId: string;
  folderName: string;
  createdAt: string;
};
type Crumb = { id: string; name: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "Unable to save OneDrive folder.");
  return body as T;
}

export default function TicketOneDriveFolders({ ticketId }: { ticketId: number }) {
  const { lang } = useLanguage();
  const it = lang === "it";
  const text = it
    ? {
        title: "Cartelle OneDrive",
        add: "Collega cartella",
        picker: "Scegli una cartella OneDrive",
        location: "Posizione",
        root: "I miei file",
        empty: "Questa cartella è vuota.",
        link: "Collega",
        close: "Chiudi",
        remove: "Rimuovi cartella",
        confirm: "Rimuovere il collegamento a",
        open: "Apri in OneDrive",
        connect: "Collega o cambia account Microsoft",
        error: "Impossibile accedere a OneDrive. Verifica il Client ID e l’URI di reindirizzamento dell’app Microsoft.",
        noFolders: "Nessuna cartella OneDrive collegata.",
        inside: "Apri cartella",
      }
    : {
        title: "OneDrive folders",
        add: "Link folder",
        picker: "Choose a OneDrive folder",
        location: "Location",
        root: "My files",
        empty: "This folder is empty.",
        link: "Link",
        close: "Close",
        remove: "Remove folder",
        confirm: "Remove the link to",
        open: "Open in OneDrive",
        connect: "Connect or switch Microsoft account",
        error: "Could not access OneDrive. Check the Microsoft app Client ID and redirect URI.",
        noFolders: "No OneDrive folders linked.",
        inside: "Open folder",
      };

  const [references, setReferences] = useState<OneDriveReference[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"select" | "browse">("select");
  const [pickerItems, setPickerItems] = useState<OneDriveItem[]>([]);
  const [pickerPath, setPickerPath] = useState<Crumb[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [selectedReference, setSelectedReference] = useState<OneDriveReference | null>(null);
  const [browserItems, setBrowserItems] = useState<OneDriveItem[]>([]);
  const [browserPath, setBrowserPath] = useState<Crumb[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReferences = useCallback(async () => {
    setLoadingReferences(true);
    try {
      setReferences(await requestJson<OneDriveReference[]>(`/api/tickets/${ticketId}/onedrive-folders`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      setLoadingReferences(false);
    }
  }, [ticketId, text.error]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const loadPicker = async (parentId?: string) => {
    setPickerLoading(true);
    setError(null);
    try {
      setPickerItems(await listOneDriveChildren(parentId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = async () => {
    setPickerMode("select");
    setPickerPath([]);
    setPickerItems([]);
    setPickerOpen(true);
    await loadPicker();
  };

  const openLinkedFolder = async (reference: OneDriveReference) => {
    setSelectedReference(reference);
    setBrowserPath([{ id: reference.driveFolderId, name: reference.folderName }]);
    setBrowserLoading(true);
    try {
      setBrowserItems(await listOneDriveChildren(reference.driveFolderId));
      setPickerMode("browse");
      setPickerOpen(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      setBrowserLoading(false);
    }
  };

  const addFolder = async (item: OneDriveItem) => {
    try {
      const created = await requestJson<OneDriveReference>(`/api/tickets/${ticketId}/onedrive-folders`, {
        method: "POST",
        body: JSON.stringify({ folderId: item.id, folderName: item.name }),
      });
      setReferences((old) => old.some((ref) => ref.id === created.id) ? old : [...old, created]);
      setPickerOpen(false);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    }
  };

  const removeFolder = async (reference: OneDriveReference) => {
    if (!window.confirm(`${text.confirm} "${reference.folderName}"?`)) return;
    try {
      await requestJson(`/api/tickets/${ticketId}/onedrive-folders/${reference.id}`, { method: "DELETE" });
      setReferences((old) => old.filter((item) => item.id !== reference.id));
      if (selectedReference?.id === reference.id) setSelectedReference(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    }
  };

  const openChildFolder = async (item: OneDriveItem) => {
    if (!item.folder) return;
    const nextPath = pickerMode === "select" ? pickerPath : browserPath;
    setPickerLoading(true);
    try {
      const children = await listOneDriveChildren(item.id);
      if (pickerMode === "select") {
        setPickerPath([...nextPath, { id: item.id, name: item.name }]);
        setPickerItems(children);
      } else {
        setBrowserPath([...nextPath, { id: item.id, name: item.name }]);
        setBrowserItems(children);
      }
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      setPickerLoading(false);
    }
  };

  const navigateUp = async () => {
    const path = pickerMode === "select" ? pickerPath : browserPath.slice(1);
    if (pickerMode === "select") {
      const nextPath = pickerPath.slice(0, -1);
      setPickerPath(nextPath);
      await loadPicker(nextPath.at(-1)?.id);
    } else {
      const nextPath = browserPath.slice(0, -1);
      setBrowserPath(nextPath);
      setPickerLoading(true);
      try {
        setBrowserItems(await listOneDriveChildren(nextPath.at(-1)?.id ?? selectedReference?.driveFolderId));
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : text.error);
      } finally {
        setPickerLoading(false);
      }
    }
    void path;
  };

  const switchAccount = async () => {
    try {
      await getOneDriveAccessToken(true);
      setError(null);
      if (pickerMode === "select") await loadPicker(pickerPath.at(-1)?.id);
      else if (selectedReference) setBrowserItems(await listOneDriveChildren(browserPath.at(-1)?.id ?? selectedReference.driveFolderId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text.error);
    }
  };

  const visiblePath = pickerMode === "select"
    ? pickerPath
    : browserPath.slice(1);
  const visibleItems = pickerMode === "select" ? pickerItems : browserItems;

  return (
    <Box mt={2} aria-label={text.title}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
        <Typography variant="subtitle2" fontWeight={700}>{text.title}</Typography>
        <Button size="small" variant="outlined" startIcon={<FolderOutlined />} onClick={() => void openPicker()}>
          {text.add}
        </Button>
      </Stack>
      {error && <Alert severity="warning" sx={{ mb: 1 }} action={<Button size="small" color="inherit" onClick={() => void switchAccount()}>{text.connect}</Button>}>{error}</Alert>}
      {loadingReferences ? <CircularProgress size={20} /> : references.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{text.noFolders}</Typography>
      ) : (
        <List dense disablePadding>
          {references.map((reference) => (
            <ListItem key={reference.id} disablePadding secondaryAction={
              <Tooltip title={text.remove}>
                <IconButton aria-label={`${text.remove}: ${reference.folderName}`} edge="end" size="small" onClick={() => void removeFolder(reference)}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            }>
              <ListItemButton onClick={() => void openLinkedFolder(reference)} sx={{ borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 34 }}><FolderOutlined fontSize="small" /></ListItemIcon>
                <ListItemText primary={reference.folderName} secondary={text.inside} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{pickerMode === "select" ? text.picker : selectedReference?.folderName}</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <IconButton size="small" aria-label={it ? "Cartella precedente" : "Previous folder"} disabled={visiblePath.length === 0 || pickerLoading} onClick={() => void navigateUp()}>
              <ArrowBack fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {text.location}: {pickerMode === "select" ? [text.root, ...visiblePath.map((c) => c.name)].join(" / ") : [selectedReference?.folderName, ...visiblePath.map((c) => c.name)].filter(Boolean).join(" / ")}
            </Typography>
          </Stack>
          {pickerLoading || browserLoading ? <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box> :
            visibleItems.length === 0 ? <Typography variant="body2" color="text.secondary">{text.empty}</Typography> : (
              <List dense>
                {visibleItems.map((item) => (
                  <ListItem key={item.id} disablePadding secondaryAction={pickerMode === "select" && item.folder ? (
                    <Button size="small" onClick={() => void addFolder(item)}>{text.link}</Button>
                  ) : !item.folder && item.webUrl ? (
                    <Button size="small" aria-label={`${text.open}: ${item.name}`} onClick={() => window.open(item.webUrl, "_blank", "noopener,noreferrer")}><OpenInNew fontSize="small" /></Button>
                  ) : undefined}>
                    <ListItemButton onClick={() => item.folder ? void openChildFolder(item) : item.webUrl && window.open(item.webUrl, "_blank", "noopener,noreferrer")} sx={{ borderRadius: 1 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.folder ? <FolderOutlined /> : <InsertDriveFile />}</ListItemIcon>
                      <ListItemText primary={item.name} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
        </DialogContent>
        <DialogActions><Button onClick={() => setPickerOpen(false)}>{text.close}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
