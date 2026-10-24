import React, { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Tooltip,
} from "@mui/material";
import { FolderOutlined, InsertDriveFile } from "@mui/icons-material";
import { listSharedOneDriveFolderItems, type OneDriveBrowseItem } from "@workspace/api-client-react";
import { useLanguage } from "../contexts/LanguageContext";
import { getAttachmentValidationFailure, MAX_ATTACHMENT_SIZE_BYTES } from "../lib/attachmentRules";
import OneDriveLogo from "./OneDriveLogo";

type Crumb = { id: string; name: string };
export type SelectedOneDriveFile = {
  ownerUserId: number;
  item: OneDriveBrowseItem;
  path: Crumb[];
};

export default function OneDriveAttachmentPicker({
  onSelect,
  disabled,
}: {
  onSelect: (files: SelectedOneDriveFile[]) => void;
  disabled?: boolean;
}) {
  const { t, lang } = useLanguage();
  const copy = t.richEditor;
  const [open, setOpen] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [path, setPath] = useState<Crumb[]>([]);
  const [items, setItems] = useState<OneDriveBrowseItem[]>([]);
  const [selected, setSelected] = useState<Record<string, { item: OneDriveBrowseItem; path: Crumb[] }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (owner: number, nextPath: Crumb[]) => {
    setLoading(true);
    setError("");
    try {
      const result = await listSharedOneDriveFolderItems(owner, { path: nextPath.map((crumb) => crumb.id) });
      setItems(result.items);
      setPath(nextPath);
    } catch {
      setError(copy.oneDriveLoadError);
    } finally {
      setLoading(false);
    }
  };

  const openPicker = async () => {
    setOpen(true);
    setSelected({});
    setError("");
    try {
      const [connectionResponse, sharesResponse] = await Promise.all([
        fetch("/api/onedrive/connection", { credentials: "include" }),
        fetch("/api/onedrive/organization-shares", { credentials: "include" }),
      ]);
      if (!connectionResponse.ok || !sharesResponse.ok) throw new Error();
      const connection = await connectionResponse.json() as { connected: boolean };
      const shares = await sharesResponse.json() as { ownerUserId: number; canUpload: boolean }[];
      const ownShare = shares.find((share) => share.canUpload);
      if (!connection.connected || !ownShare) {
        setError(copy.oneDriveNotConnected);
        return;
      }
      setOwnerUserId(ownShare.ownerUserId);
      await load(ownShare.ownerUserId, []);
    } catch {
      setError(copy.oneDriveLoadError);
    }
  };

  const toggle = (item: OneDriveBrowseItem) => {
    if (selected[item.id]) {
      setSelected((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setError("");
      return;
    }

    const failure = getAttachmentValidationFailure(item.mimeType, item.size);
    if (failure) {
      setError(`${item.name}: ${failure === "size"
        ? copy.uploadSizeError.replace("{max}", String(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)))
        : copy.uploadTypeError}`);
      return;
    }

    setError("");
    setSelected((current) => {
      return { ...current, [item.id]: { item, path } };
    });
  };

  return (
    <>
      <Tooltip title={copy.oneDriveAttach}>
        <span>
          <IconButton size="small" onClick={() => void openPicker()} disabled={disabled} aria-label={copy.oneDriveAttach}>
            <OneDriveLogo width={18} height={18} />
          </IconButton>
        </span>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{copy.oneDriveTitle}</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity={error === copy.oneDriveNotConnected ? "info" : "error"} action={error === copy.oneDriveNotConnected
              ? <Button color="inherit" href="/app/onedrive">{copy.oneDriveOpenSettings}</Button>
              : undefined}
            >
              {error}
            </Alert>
          )}
          {path.length > 0 && (
            <Button size="small" onClick={() => ownerUserId && void load(ownerUserId, path.slice(0, -1))}>
              {copy.oneDriveBack}
            </Button>
          )}
          {loading ? <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box> : (
            <List dense disablePadding>
              {items.map((item) => {
                const folder = item.kind === "folder";
                const checked = Boolean(selected[item.id]);
                return (
                  <ListItemButton
                    key={item.id}
                    onClick={() => folder
                      ? ownerUserId && void load(ownerUserId, [...path, { id: item.id, name: item.name }])
                      : toggle(item)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {folder ? <FolderOutlined fontSize="small" /> : <InsertDriveFile fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText primary={item.name} primaryTypographyProps={{ noWrap: true }} />
                    {!folder && (
                      <Checkbox
                        edge="end"
                        checked={checked}
                        tabIndex={-1}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggle(item)}
                      />
                    )}
                  </ListItemButton>
                );
              })}
              {!loading && !error && items.length === 0 && <ListItemText primary={copy.oneDriveEmpty} sx={{ px: 2, py: 1 }} />}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{copy.oneDriveCancel}</Button>
          <Button
            variant="contained"
            disabled={!Object.keys(selected).length || !ownerUserId}
            onClick={() => {
              const files = Object.values(selected);
              const invalidFile = files.find(({ item }) => getAttachmentValidationFailure(item.mimeType, item.size));
              if (invalidFile) {
                const failure = getAttachmentValidationFailure(invalidFile.item.mimeType, invalidFile.item.size);
                setError(`${invalidFile.item.name}: ${failure === "size"
                  ? copy.uploadSizeError.replace("{max}", String(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)))
                  : copy.uploadTypeError}`);
                return;
              }
              if (ownerUserId) onSelect(files.map(({ item, path }) => ({ ownerUserId, item, path })));
              setOpen(false);
            }}
          >
            {copy.oneDriveAdd(Object.keys(selected).length)}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
