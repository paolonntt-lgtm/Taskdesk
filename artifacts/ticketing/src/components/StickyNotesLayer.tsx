import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box, Fab, Tooltip, Paper, IconButton, TextField, Typography,
  Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, Autocomplete,
  List, ListItemButton, ListItemText, ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import LockIcon from "@mui/icons-material/Lock";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import PublicIcon from "@mui/icons-material/Public";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { wrapSelection, insertLinePrefix, renderStickyNoteText } from "../lib/stickyNoteFormat";

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
  closedPosX: number | null;
  closedPosY: number | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption { id: number; name: string; email: string; }
interface ClientOption { id: number; name: string; }

interface MentionState {
  noteId: number;
  query: string;
  startIndex: number;
  results: ClientOption[];
  selectedIdx: number;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export default function StickyNotesLayer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const theme = useTheme();
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
  const textWrapperRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const DEFAULT_W = 280;
  const DEFAULT_H = 180;
  const MIN_W = 200;
  const MIN_H = 120;

  const DOCK_ITEM_W = 220;
  const DOCK_ITEM_H = 42;
  const DOCK_GAP = 8;
  const DOCK_MARGIN = 16;

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

  const closedPositions = useRef<Map<number, { x: number; y: number }>>(new Map());
  const closedDrag = useRef<{
    noteId: number;
    startMX: number; startMY: number;
    startPX: number; startPY: number;
    moved: boolean;
  } | null>(null);

  const saveStateTimer = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const saveState = useCallback((
    noteId: number,
    x: number,
    y: number,
    closed: boolean,
    w?: number,
    h?: number,
    closedPos?: { x: number; y: number },
  ) => {
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
          ...(closedPos ? { closedPositionX: Math.round(closedPos.x), closedPositionY: Math.round(closedPos.y) } : {}),
        }),
      }).catch(() => {});
      saveStateTimer.current.delete(noteId);
    }, 600);
    saveStateTimer.current.set(noteId, timer);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (closedDrag.current) {
        const { noteId, startMX, startMY, startPX, startPY } = closedDrag.current;
        const dx = e.clientX - startMX;
        const dy = e.clientY - startMY;
        if (Math.abs(dx) + Math.abs(dy) > 4) closedDrag.current.moved = true;
        const newX = Math.max(0, Math.min(window.innerWidth - DOCK_ITEM_W, startPX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - DOCK_ITEM_H, startPY + dy));
        closedPositions.current.set(noteId, { x: newX, y: newY });
        forceRender((c) => c + 1);
        return;
      }
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
      if (closedDrag.current) {
        const { noteId, startMX, startMY, startPX, startPY, moved } = closedDrag.current;
        const dx = e.clientX - startMX;
        const dy = e.clientY - startMY;
        const newX = Math.max(0, Math.min(window.innerWidth - DOCK_ITEM_W, startPX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - DOCK_ITEM_H, startPY + dy));
        closedPositions.current.set(noteId, { x: newX, y: newY });
        closedDrag.current = null;
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          if (!moved) {
            handleOpen(note);
          } else {
            const openPos = positions.current.get(noteId) ?? { x: note.posX, y: note.posY };
            const sz = sizes.current.get(noteId) ?? { w: note.width ?? DEFAULT_W, h: note.height ?? DEFAULT_H };
            saveState(noteId, openPos.x, openPos.y, true, sz.w, sz.h, { x: newX, y: newY });
          }
        }
        forceRender((c) => c + 1);
        return;
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, saveState, DEFAULT_W, DEFAULT_H, MIN_W, MIN_H, DOCK_ITEM_W, DOCK_ITEM_H]);

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

  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number; width: number } | null>(null);

  type MentionSortKey = "name_asc" | "name_desc" | "createdAt_desc" | "createdAt_asc";
  const MENTION_SORT_LS_KEY = "stickyNoteMentionSort";

  const [mentionSort, setMentionSort] = useState<MentionSortKey>(() => {
    try {
      const v = localStorage.getItem(MENTION_SORT_LS_KEY);
      if (v === "name_asc" || v === "name_desc" || v === "createdAt_desc" || v === "createdAt_asc") return v as MentionSortKey;
    } catch { /* ignore */ }
    return "name_asc";
  });

  const buildSortParams = useCallback((s: MentionSortKey) => {
    const [sort, order] = s.split("_") as [string, string];
    return `sort=${sort}&order=${order}`;
  }, []);

  const handleMentionSortChange = (_: React.MouseEvent, val: MentionSortKey | null) => {
    if (!val) return;
    setMentionSort(val);
    try { localStorage.setItem(MENTION_SORT_LS_KEY, val); } catch { /* ignore */ }
  };

  const mentionRef = useRef<MentionState | null>(null);
  mentionRef.current = mention;

  useEffect(() => {
    const m = mentionRef.current;
    if (!m) return;
    fetch(`/api/clients?search=${encodeURIComponent(m.query)}&${buildSortParams(mentionSort)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((clients: any[]) => {
        setMention((prev) => prev ? {
          ...prev,
          results: clients.slice(0, 8).map((c: any) => ({ id: c.id, name: c.name })),
          selectedIdx: 0,
        } : null);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionSort]);

  useEffect(() => {
    if (newNoteId.current == null) return;
    const id = newNoteId.current;
    const el = textareaRefs.current.get(id);
    if (el) {
      el.focus();
      newNoteId.current = null;
    }
  }, [notes]);

  useEffect(() => {
    if (!mention || mention.results.length === 0) { setMentionPos(null); return; }
    const el = textWrapperRefs.current.get(mention.noteId);
    if (!el) { setMentionPos(null); return; }
    const rect = el.getBoundingClientRect();
    setMentionPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(200, rect.width) });
  }, [mention]);

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

  const closeMention = useCallback(() => setMention(null), []);

  const handleTextInputChange = (note: NoteDisplay, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleTextChange(note, val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@([^\s@]*)$/);
    if (match) {
      const query = match[1];
      const startIndex = cursor - match[0].length;
      fetch(`/api/clients?search=${encodeURIComponent(query)}&${buildSortParams(mentionSort)}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((clients: any[]) => {
          setMention({
            noteId: note.id,
            query,
            startIndex,
            results: clients.slice(0, 8).map((c: any) => ({ id: c.id, name: c.name })),
            selectedIdx: 0,
          });
        })
        .catch(() => closeMention());
    } else if (mention?.noteId === note.id) {
      closeMention();
    }
  };

  const insertClientMention = useCallback((note: NoteDisplay, client: ClientOption) => {
    if (!mention || mention.noteId !== note.id) return;
    const ta = textareaRefs.current.get(note.id);
    const currentVal = editingText.has(note.id) ? editingText.get(note.id)! : note.text;
    const cursor = ta?.selectionStart ?? currentVal.length;
    const before = currentVal.slice(0, mention.startIndex);
    const after = currentVal.slice(cursor);
    const tag = `@[${client.name}]`;
    const newVal = before + tag + " " + after;
    handleTextChange(note, newVal);
    closeMention();
    setTimeout(() => {
      if (ta) {
        ta.focus();
        const pos = mention.startIndex + tag.length + 1;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mention, editingText, closeMention]);

  const handleTextKeyDown = (note: NoteDisplay, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mention.noteId === note.id && mention.results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((m) => m ? { ...m, selectedIdx: Math.min(m.selectedIdx + 1, m.results.length - 1) } : null);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((m) => m ? { ...m, selectedIdx: Math.max(m.selectedIdx - 1, 0) } : null);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const client = mention.results[mention.selectedIdx];
        if (client) insertClientMention(note, client);
        return;
      }
      if (e.key === "Escape") {
        closeMention();
        return;
      }
    }
  };

  const handleTextBlur = (note: NoteDisplay, val: string) => {
    const timer = textTimers.current.get(note.id);
    if (timer) {
      clearTimeout(timer);
      textTimers.current.delete(note.id);
    }
    updateMutation.mutate({ id: note.id, text: val });
    if (mention?.noteId === note.id) closeMention();
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

  const action = (note: NoteDisplay, fn: (ta: HTMLTextAreaElement) => void) => {
    const ta = textareaRefs.current.get(note.id);
    if (ta) fn(ta);
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

              {isOwner && (
                <Box
                  sx={{
                    display: "flex", alignItems: "center", gap: 0.25,
                    px: 1, pt: 0.5,
                    borderBottom: `1px solid ${col.border}`,
                    flexWrap: "wrap",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Tooltip title={t.stickyNotes.formatBold}>
                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        action(note, (ta) => wrapSelection(ta, "**", "**", t.stickyNotes.formatDefaultText, (v) => handleTextChange(note, v)));
                      }}
                    >
                      <FormatBoldIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t.stickyNotes.formatItalic}>
                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        action(note, (ta) => wrapSelection(ta, "*", "*", t.stickyNotes.formatDefaultText, (v) => handleTextChange(note, v)));
                      }}
                    >
                      <FormatItalicIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t.stickyNotes.formatUnderline}>
                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        action(note, (ta) => wrapSelection(ta, "~", "~", t.stickyNotes.formatDefaultText, (v) => handleTextChange(note, v)));
                      }}
                    >
                      <FormatUnderlinedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t.stickyNotes.formatBulletList}>
                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        action(note, (ta) => insertLinePrefix(ta, "- ", (v) => handleTextChange(note, v)));
                      }}
                    >
                      <FormatListBulletedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              <Box
                sx={{ p: 1.5, flexGrow: 1 }}
                ref={(el: HTMLDivElement | null) => { textWrapperRefs.current.set(note.id, el); }}
              >
                {isOwner ? (
                  <TextField
                    multiline
                    minRows={3}
                    maxRows={10}
                    fullWidth
                    variant="standard"
                    placeholder={t.stickyNotes.placeholder}
                    value={textVal}
                    onChange={(e) => handleTextInputChange(note, e as React.ChangeEvent<HTMLTextAreaElement>)}
                    onKeyDown={(e) => handleTextKeyDown(note, e as unknown as React.KeyboardEvent<HTMLTextAreaElement>)}
                    onBlur={(e) => handleTextBlur(note, e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    inputRef={(el) => { textareaRefs.current.set(note.id, el); }}
                    InputProps={{ disableUnderline: true, style: { fontSize: 13 } }}
                    sx={{ "& textarea": { userSelect: "text", cursor: "text" } }}
                  />
                ) : (
                  <Box
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{ fontSize: 13, userSelect: "text", minHeight: 24, color: textVal.trim() ? "text.primary" : "text.secondary" }}
                  >
                    {textVal.trim() ? renderStickyNoteText(textVal) : t.stickyNotes.placeholder}
                  </Box>
                )}
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

      {mention && mention.results.length > 0 && mentionPos && createPortal(
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            top: mentionPos.top,
            left: mentionPos.left,
            width: mentionPos.width,
            maxHeight: 280,
            overflowY: "auto",
            zIndex: theme.zIndex.modal + 200,
          }}
        >
          <Box
            sx={{ px: 0.75, pt: 0.75, pb: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ToggleButtonGroup
              value={mentionSort}
              exclusive
              onChange={handleMentionSortChange}
              size="small"
              sx={{ flexWrap: "wrap", gap: 0.25 }}
            >
              {(
                [
                  ["name_asc", t.stickyNotes.sortAZ],
                  ["name_desc", t.stickyNotes.sortZA],
                  ["createdAt_desc", t.stickyNotes.sortNewest],
                  ["createdAt_asc", t.stickyNotes.sortOldest],
                ] as [string, string][]
              ).map(([val, label]) => (
                <ToggleButton
                  key={val}
                  value={val}
                  sx={{ py: 0.2, px: 0.75, fontSize: 11, lineHeight: 1.4, textTransform: "none", minWidth: 0 }}
                >
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <List dense disablePadding>
            {mention.results.map((c, idx) => (
              <ListItemButton
                key={c.id}
                selected={idx === mention.selectedIdx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const note = notes.find((n) => n.id === mention.noteId);
                  if (note) insertClientMention(note, c);
                }}
              >
                <ListItemText primary={c.name} />
              </ListItemButton>
            ))}
          </List>
        </Paper>,
        document.body,
      )}

      {closedNotes.length > 0 && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1201,
          }}
        >
          {closedNotes.map((note, idx) => {
            if (!closedPositions.current.has(note.id)) {
              const defaultX = window.innerWidth - DOCK_ITEM_W - DOCK_MARGIN;
              const defaultY = window.innerHeight - DOCK_MARGIN - DOCK_ITEM_H - idx * (DOCK_ITEM_H + DOCK_GAP) - 64;
              closedPositions.current.set(note.id, {
                x: note.closedPosX ?? defaultX,
                y: note.closedPosY ?? defaultY,
              });
            }
            const pos = closedPositions.current.get(note.id)!;
            const col = COLORS[note.color] ?? COLORS.yellow;
            const preview = note.text.replace(/[*_~]/g, "").replace(/@\[([^\]]+)\]/g, "@$1").trim().slice(0, 34) || t.stickyNotes.placeholder;
            const isDraggingThis = closedDrag.current?.noteId === note.id;

            return (
              <Tooltip key={note.id} title={t.stickyNotes.open} placement="top">
                <Paper
                  elevation={3}
                  sx={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: DOCK_ITEM_W,
                    height: DOCK_ITEM_H,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    bgcolor: col.bg,
                    border: `1px solid ${col.border}`,
                    borderRadius: 1.5,
                    pointerEvents: "auto",
                    cursor: isDraggingThis ? "grabbing" : "grab",
                    userSelect: "none",
                    boxShadow: isDraggingThis ? "0 8px 20px rgba(0,0,0,0.2)" : undefined,
                    transition: isDraggingThis ? "none" : "box-shadow 0.15s",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    closedDrag.current = {
                      noteId: note.id,
                      startMX: e.clientX, startMY: e.clientY,
                      startPX: pos.x, startPY: pos.y,
                      moved: false,
                    };
                    forceRender((c) => c + 1);
                  }}
                >
                  <DragIndicatorIcon sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ flex: 1, fontSize: 12.5 }}>
                    {preview}
                  </Typography>
                  <OpenInFullIcon sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} />
                </Paper>
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* Sticky-note create FAB — sits above the bot FAB (bottom:24 + 56px FAB height + 8px gap = 88).
          zIndex above theme.zIndex.modal so it stays visible when the bot chat dialog is open. */}
      <Tooltip title={t.stickyNotes.createTooltip} placement="left">
        <Fab
          size="small"
          onClick={() => createMutation.mutate({ text: "", color: "yellow", visibility: "private" })}
          sx={{
            position: "fixed",
            bottom: 88,
            right: 24,
            zIndex: theme.zIndex.modal + 100,
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
                closedPositions.current.delete(deleteConfirmId);
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
