import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Fab, Tooltip, Paper, IconButton, TextField, Typography,
  Select, MenuItem, FormControl, InputLabel, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Autocomplete,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import LockIcon from "@mui/icons-material/Lock";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import PublicIcon from "@mui/icons-material/Public";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

const COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: "#fef9c3", border: "#fde047" },
  green: { bg: "#dcfce7", border: "#86efac" },
  blue: { bg: "#dbeafe", border: "#93c5fd" },
  pink: { bg: "#fce7f3", border: "#f9a8d4" },
  purple: { bg: "#ede9fe", border: "#c4b5fd" },
};
const COLOR_KEYS = Object.keys(COLORS);

const QUERY_KEY = ["sticky-notes"];

interface NoteDisplay {
  id: number;
  createdBy: number;
  text: string;
  color: string;
  visibility: string;
  targetGroupName: string | null;
  targetUserIds: number[];
  posX: number;
  posY: number;
  width: number | null;
  height: number | null;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserOption { id: number; name: string; email: string; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export default function StickyNotesLayer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data: notes = [] } = useQuery<NoteDisplay[]>({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch("/api/sticky-notes"),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const [groups, setGroups] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/settings/groups", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { value: [] })
      .then((d) => setGroups(Array.isArray(d?.value) ? d.value : []))
      .catch(() => {});
    fetch("/api/users", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => setAllUsers(data.map((u) => ({ id: u.id, name: u.name, email: u.email }))))
      .catch(() => {});
  }, [user]);

  const positions = useRef<Map<number, { x: number; y: number }>>(new Map());
  const sizes = useRef<Map<number, { w: number; h: number }>>(new Map());
  const [, forceRender] = useState(0);
  const newNoteId = useRef<number | null>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement | null>>(new Map());

  const DEFAULT_W = 280;
  const DEFAULT_H = 180;
  const MIN_W = 200;
  const MIN_H = 120;

  useEffect(() => {
    notes.forEach((n) => {
      if (!positions.current.has(n.id)) {
        positions.current.set(n.id, { x: n.posX, y: n.posY });
      }
      if (!sizes.current.has(n.id)) {
        sizes.current.set(n.id, { w: n.width ?? DEFAULT_W, h: n.height ?? DEFAULT_H });
      }
    });
  }, [notes]);

  const drag = useRef<{
    noteId: number;
    startMX: number; startMY: number;
    startPX: number; startPY: number;
  } | null>(null);

  const resize = useRef<{
    noteId: number;
    startMX: number; startMY: number;
    startW: number; startH: number;
  } | null>(null);

  const saveStateTimer = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const saveState = useCallback((noteId: number, x: number, y: number, closed: boolean, w?: number, h?: number) => {
    const existing = saveStateTimer.current.get(noteId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      fetch(`/api/sticky-notes/${noteId}/state`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionX: Math.round(x),
          positionY: Math.round(y),
          closed,
          ...(w != null ? { width: Math.round(w) } : {}),
          ...(h != null ? { height: Math.round(h) } : {}),
        }),
      }).catch(() => {});
      saveStateTimer.current.delete(noteId);
    }, 600);
    saveStateTimer.current.set(noteId, timer);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resize.current) {
        const { noteId, startMX, startMY, startW, startH } = resize.current;
        const newW = Math.max(MIN_W, startW + (e.clientX - startMX));
        const newH = Math.max(MIN_H, startH + (e.clientY - startMY));
        sizes.current.set(noteId, { w: newW, h: newH });
        forceRender((c) => c + 1);
        return;
      }
      if (!drag.current) return;
      const { noteId, startMX, startMY, startPX, startPY } = drag.current;
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;
      const sz = sizes.current.get(noteId) ?? { w: DEFAULT_W, h: DEFAULT_H };
      const newX = Math.max(0, Math.min(window.innerWidth - sz.w, startPX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - MIN_H, startPY + dy));
      positions.current.set(noteId, { x: newX, y: newY });
      forceRender((c) => c + 1);
    };
    const onUp = (e: MouseEvent) => {
      if (resize.current) {
        const { noteId, startMX, startMY, startW, startH } = resize.current;
        const newW = Math.max(MIN_W, startW + (e.clientX - startMX));
        const newH = Math.max(MIN_H, startH + (e.clientY - startMY));
        sizes.current.set(noteId, { w: newW, h: newH });
        const pos = positions.current.get(noteId) ?? { x: 100, y: 100 };
        const note = notes.find((n) => n.id === noteId);
        saveState(noteId, pos.x, pos.y, note?.closed ?? false, newW, newH);
        resize.current = null;
        forceRender((c) => c + 1);
        return;
      }
      if (!drag.current) return;
      const { noteId, startMX, startMY, startPX, startPY } = drag.current;
      const dx = e.clientX - startMX;
      const dy = e.clientY - startMY;
      const sz = sizes.current.get(noteId) ?? { w: DEFAULT_W, h: DEFAULT_H };
      const newX = Math.max(0, Math.min(window.innerWidth - sz.w, startPX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - MIN_H, startPY + dy));
      positions.current.set(noteId, { x: newX, y: newY });
      const note = notes.find((n) => n.id === noteId);
      saveState(noteId, newX, newY, note?.closed ?? false, sz.w, sz.h);
      drag.current = null;
      forceRender((c) => c + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [notes, saveState, DEFAULT_W, DEFAULT_H, MIN_W, MIN_H]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: (created: NoteDisplay) => {
      const cx = Math.max(40, Math.min(window.innerWidth - 320, (window.innerWidth - 280) / 2));
      const cy = Math.max(40, Math.min(window.innerHeight - 250, (window.innerHeight - 220) / 2));
      positions.current.set(created.id, { x: cx, y: cy });
      newNoteId.current = created.id;
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/sticky-notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [editingText, setEditingText] = useState<Map<number, string>>(new Map());
  const textTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (newNoteId.current == null) return;
    const id = newNoteId.current;
    const el = textareaRefs.current.get(id);
    if (el) {
      el.focus();
      newNoteId.current = null;
    }
  }, [notes]);

  const handleTextChange = (note: NoteDisplay, val: string) => {
    setEditingText((prev) => new Map(prev).set(note.id, val));
    const ex = textTimers.current.get(note.id);
    if (ex) clearTimeout(ex);
    const t2 = setTimeout(() => {
      updateMutation.mutate({ id: note.id, text: val });
      textTimers.current.delete(note.id);
    }, 1000);
    textTimers.current.set(note.id, t2);
  };

  const handleTextBlur = (note: NoteDisplay, val: string) => {
    const timer = textTimers.current.get(note.id);
    if (timer) {
      clearTimeout(timer);
      textTimers.current.delete(note.id);
    }
    updateMutation.mutate({ id: note.id, text: val });
  };

  const handleClose = (note: NoteDisplay) => {
    const pos = positions.current.get(note.id) ?? { x: note.posX, y: note.posY };
    const sz = sizes.current.get(note.id) ?? { w: note.width ?? DEFAULT_W, h: note.height ?? DEFAULT_H };
    qc.setQueryData<NoteDisplay[]>(QUERY_KEY, (old) =>
      (old ?? []).map((n) => n.id === note.id ? { ...n, closed: true } : n)
    );
    saveState(note.id, pos.x, pos.y, true, sz.w, sz.h);
  };

  const handleOpen = (note: NoteDisplay) => {
    const pos = positions.current.get(note.id) ?? { x: note.posX, y: note.posY };
    const sz = sizes.current.get(note.id) ?? { w: note.width ?? DEFAULT_W, h: note.height ?? DEFAULT_H };
    qc.setQueryData<NoteDisplay[]>(QUERY_KEY, (old) =>
      (old ?? []).map((n) => n.id === note.id ? { ...n, closed: false } : n)
    );
    saveState(note.id, pos.x, pos.y, false, sz.w, sz.h);
  };

  if (!user) return null;

  const openNotes = notes.filter((n) => !n.closed);
  const closedNotes = notes.filter((n) => n.closed);

  const visibilityIcon = (v: string) => {
    if (v === "private") return <LockIcon sx={{ fontSize: 14 }} />;
    if (v === "group") return <GroupIcon sx={{ fontSize: 14 }} />;
    if (v === "users") return <PeopleIcon sx={{ fontSize: 14 }} />;
    return <PublicIcon sx={{ fontSize: 14 }} />;
  };

  const visibilityLabel = (note: NoteDisplay) => {
    const sn = t.stickyNotes;
    if (note.visibility === "private") return sn.visibilityPrivate;
    if (note.visibility === "group") return note.targetGroupName ? `${sn.visibilityGroup}: ${note.targetGroupName}` : sn.visibilityGroup;
    if (note.visibility === "users") return sn.visibilityUsers;
    return sn.visibilityAll;
  };

  return (
    <>
      <Box
        sx={{
          position: "fixed", inset: 0,
          pointerEvents: "none",
          zIndex: 1200,
        }}
      >
        {openNotes.map((note) => {
          const pos = positions.current.get(note.id) ?? { x: note.posX, y: note.posY };
          const col = COLORS[note.color] ?? COLORS.yellow;
          const isOwner = note.createdBy === (user as any).id;
          const textVal = editingText.has(note.id) ? editingText.get(note.id)! : note.text;

          const sz = sizes.current.get(note.id) ?? { w: DEFAULT_W, h: DEFAULT_H };
          const isResizing = resize.current?.noteId === note.id;
          const isDragging = drag.current?.noteId === note.id;

          return (
            <Paper
              key={note.id}
              elevation={4}
              sx={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: sz.w,
                minHeight: sz.h,
                bgcolor: col.bg,
                border: `2px solid ${col.border}`,
                borderRadius: 2,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                userSelect: "none",
                transition: (isDragging || isResizing) ? "none" : "box-shadow 0.15s",
                boxShadow: (isDragging || isResizing) ? "0 8px 24px rgba(0,0,0,0.18)" : undefined,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5,
                  px: 1, py: 0.5,
                  cursor: "grab",
                  borderBottom: `1px solid ${col.border}`,
                  "&:active": { cursor: "grabbing" },
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  drag.current = {
                    noteId: note.id,
                    startMX: e.clientX, startMY: e.clientY,
                    startPX: pos.x, startPY: pos.y,
                  };
                  forceRender((c) => c + 1);
                }}
              >
                <DragIndicatorIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  {COLOR_KEYS.map((ck) => (
                    <Box
                      key={ck}
                      onMouseDown={(e) => { e.stopPropagation(); }}
                      onClick={isOwner ? () => updateMutation.mutate({ id: note.id, color: ck }) : undefined}
                      sx={{
                        width: 12, height: 12, borderRadius: "50%",
                        bgcolor: COLORS[ck].border,
                        border: note.color === ck ? "2px solid #333" : "2px solid transparent",
                        cursor: isOwner ? "pointer" : "default",
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={visibilityLabel(note)} placement="top">
                  <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}
                    onMouseDown={(e) => e.stopPropagation()}>
                    {visibilityIcon(note.visibility)}
                  </Box>
                </Tooltip>
                <Tooltip title={t.stickyNotes.close} placement="top">
                  <IconButton
                    size="small"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleClose(note)}
                    sx={{ p: 0.25, ml: 0.5 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ p: 1.5, flexGrow: 1 }}>
                <TextField
                  multiline
                  minRows={3}
                  maxRows={10}
                  fullWidth
                  variant="standard"
                  placeholder={t.stickyNotes.placeholder}
                  value={textVal}
                  onChange={isOwner ? (e) => handleTextChange(note, e.target.value) : undefined}
                  onBlur={isOwner ? (e) => handleTextBlur(note, e.target.value) : undefined}
                  onMouseDown={(e) => e.stopPropagation()}
                  inputRef={(el) => { textareaRefs.current.set(note.id, el); }}
                  InputProps={{ disableUnderline: true, style: { fontSize: 13 }, readOnly: !isOwner }}
                  sx={{ "& textarea": { userSelect: "text", cursor: isOwner ? "text" : "default" } }}
                />
              </Box>

              {(isOwner || (user as any).role === "admin") && (
                <VisibilitySettings
                  note={note}
                  isOwner={isOwner}
                  groups={groups}
                  allUsers={allUsers}
                  t={t.stickyNotes}
                  onUpdate={isOwner ? (data) => updateMutation.mutate({ id: note.id, ...data }) : undefined}
                  onDelete={() => setDeleteConfirmId(note.id)}
                />
              )}

              {/* Resize handle — bottom-right corner, desktop only */}
              <Tooltip title={t.stickyNotes.resizeTooltip} placement="top">
                <Box
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    resize.current = {
                      noteId: note.id,
                      startMX: e.clientX,
                      startMY: e.clientY,
                      startW: sz.w,
                      startH: sz.h,
                    };
                    forceRender((c) => c + 1);
                  }}
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 18,
                    height: 18,
                    cursor: "se-resize",
                    // Visual: two diagonal lines like a typical resize grip
                    background: `linear-gradient(
                      135deg,
                      transparent 30%,
                      ${col.border} 30%,
                      ${col.border} 45%,
                      transparent 45%,
                      transparent 60%,
                      ${col.border} 60%,
                      ${col.border} 75%,
                      transparent 75%
                    )`,
                    borderRadius: "0 0 8px 0",
                    opacity: 0.7,
                    "&:hover": { opacity: 1 },
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            </Paper>
          );
        })}
      </Box>

      {closedNotes.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 80,
            left: 16,
            zIndex: 1201,
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            maxWidth: "calc(100vw - 200px)",
            pointerEvents: "auto",
          }}
        >
          {closedNotes.map((note) => {
            const col = COLORS[note.color] ?? COLORS.yellow;
            const preview = note.text.trim().slice(0, 30) || "…";
            return (
              <Tooltip key={note.id} title={t.stickyNotes.open} placement="top">
                <Chip
                  label={preview}
                  size="small"
                  icon={<Box sx={{ color: "text.secondary", display: "flex", alignItems: "center", pl: 0.5 }}>
                    <OpenInFullIcon sx={{ fontSize: 12 }} />
                  </Box>}
                  onClick={() => handleOpen(note)}
                  sx={{
                    bgcolor: col.bg,
                    border: `1px solid ${col.border}`,
                    fontSize: 12,
                    cursor: "pointer",
                    "&:hover": { bgcolor: col.border },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* Sticky-note create FAB — sits above the bot FAB (bottom:24 + 56px height + 8px gap = 88) */}
      <Tooltip title={t.stickyNotes.createTooltip} placement="left">
        <Fab
          size="small"
          onClick={() => createMutation.mutate({ text: "", color: "yellow", visibility: "private" })}
          sx={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: 1201,
            bgcolor: "#fef9c3",
            color: "text.primary",
            border: "2px solid #fde047",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            "&:hover": { bgcolor: "#fef08a" },
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      <Dialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t.stickyNotes.deleteConfirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{t.stickyNotes.deleteConfirmText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>{t.stickyNotes.deleteCancel}</Button>
          <Button
            color="error"
            onClick={() => {
              if (deleteConfirmId !== null) {
                deleteMutation.mutate(deleteConfirmId);
                positions.current.delete(deleteConfirmId);
              }
              setDeleteConfirmId(null);
            }}
          >
            {t.stickyNotes.deleteConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

interface VisibilitySettingsProps {
  note: NoteDisplay;
  isOwner: boolean;
  groups: string[];
  allUsers: UserOption[];
  t: any;
  onUpdate?: (data: any) => void;
  onDelete: () => void;
}

function VisibilitySettings({ note, groups, allUsers, t, onUpdate, onDelete }: VisibilitySettingsProps) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState(note.visibility);
  const [targetGroup, setTargetGroup] = useState(note.targetGroupName ?? "");
  const [targetUserIds, setTargetUserIds] = useState<number[]>(note.targetUserIds ?? []);

  useEffect(() => {
    setVisibility(note.visibility);
    setTargetGroup(note.targetGroupName ?? "");
    setTargetUserIds(note.targetUserIds ?? []);
  }, [note.visibility, note.targetGroupName, note.targetUserIds]);

  const handleSave = () => {
    onUpdate?.({
      visibility,
      targetGroupName: visibility === "group" ? targetGroup || null : null,
      targetUserIds: visibility === "users" ? targetUserIds : null,
    });
    setOpen(false);
  };

  const selectedUsers = allUsers.filter((u) => targetUserIds.includes(u.id));

  return (
    <Box
      sx={{ px: 1, pb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Tooltip title={t.visibilityLabel} placement="bottom">
        <IconButton
          size="small"
          sx={{ p: 0.5, color: "text.secondary" }}
          onClick={() => setOpen(true)}
        >
          {note.visibility === "private" && <LockIcon sx={{ fontSize: 15 }} />}
          {note.visibility === "group" && <GroupIcon sx={{ fontSize: 15 }} />}
          {note.visibility === "users" && <PeopleIcon sx={{ fontSize: 15 }} />}
          {note.visibility === "all" && <PublicIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <Tooltip title={t.deleteNote} placement="bottom">
        <IconButton
          size="small"
          sx={{ p: 0.5, color: "text.secondary", "&:hover": { color: "error.main" } }}
          onClick={onDelete}
        >
          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t.visibilityLabel}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>{t.visibilityLabel}</InputLabel>
            <Select
              value={visibility}
              label={t.visibilityLabel}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <MenuItem value="private">{t.visibilityPrivate}</MenuItem>
              <MenuItem value="group">{t.visibilityGroup}</MenuItem>
              <MenuItem value="users">{t.visibilityUsers}</MenuItem>
              <MenuItem value="all">{t.visibilityAll}</MenuItem>
            </Select>
          </FormControl>

          {visibility === "group" && (
            <FormControl fullWidth size="small">
              <InputLabel>{t.selectGroup}</InputLabel>
              <Select
                value={targetGroup}
                label={t.selectGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
              >
                {groups.length === 0 && (
                  <MenuItem value="" disabled>{t.noGroupsAvailable}</MenuItem>
                )}
                {groups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          {visibility === "users" && (
            <Autocomplete
              multiple
              size="small"
              options={allUsers}
              getOptionLabel={(u) => `${u.name} (${u.email})`}
              value={selectedUsers}
              onChange={(_, val) => setTargetUserIds(val.map((u) => u.id))}
              renderInput={(params) => (
                <TextField {...params} label={t.selectUsers} />
              )}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t.deleteCancel}</Button>
          <Button variant="contained" onClick={handleSave}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
