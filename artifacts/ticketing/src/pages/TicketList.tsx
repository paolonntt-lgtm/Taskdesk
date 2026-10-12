import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import {
  Avatar, Box, Card, Typography, TextField, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, CircularProgress, InputAdornment, Grid,
  Tooltip, TableSortLabel, Collapse, IconButton, Checkbox, Toolbar, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
  Select, FormControl, InputLabel, OutlinedInput, ListItemText, Menu,
  useTheme, useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, CheckCircle, FilterList, FilterListOff, Delete as DeleteIcon, DeleteSweep as DeleteSweepIcon, Email as EmailIcon, BookmarkAdd as BookmarkAddIcon, Close as CloseIcon, Schedule as ScheduleIcon, ViewColumn, Repeat as RepeatIcon, CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import { useListTickets, useListUsers, useListClients, useDeleteTicket, getListTicketsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearch, useLocation } from 'wouter';
import { getStatusColor, getPriorityColor } from './Dashboard';
import { useDebounce } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useEntityTerm } from '../hooks/useEntityTerm';
import { useTicketStatuses } from '../hooks/useTicketStatuses';
import DeadlineCell from '../components/DeadlineCell';
function hashAvatarColor(name: string): string {
  const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828', '#00838f', '#6a1b9a', '#0277bd'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { open: 0, waiting: 1, resolved: 2, closed: 3 };

type SortCol = 'id' | 'title' | 'category' | 'status' | 'priority' | 'assignee' | 'location' | 'createdAt' | 'client' | 'dueAt';
type SortDir = 'asc' | 'desc';

interface FilterPreset {
  id: string;
  name: string;
  params: string;
}

function loadPresetsFromStorage(userId: number | string): FilterPreset[] {
  try {
    const raw = localStorage.getItem(`filter_presets_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(userId: number | string, presets: FilterPreset[]) {
  try {
    localStorage.setItem(`filter_presets_${userId}`, JSON.stringify(presets));
  } catch {
    // ignore storage errors
  }
}

export default function TicketList() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const entityTerm = useEntityTerm();
  const isAdmin = user?.role === 'admin';
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const queryClient = useQueryClient();

  // ── Derive ALL filter values from the URL query string ──────────────────
  const { statuses: orgStatuses, getLabelForKey, getColorForKey } = useTicketStatuses();

  const urlParams = new URLSearchParams(searchStr);
  const validStatuses = orgStatuses.map((s) => s.key);

  // These must be declared before the useMemo hooks that normalise against them
  const [configuredLocations, setConfiguredLocations] = useState<string[]>([]);
  const [configuredCategories, setConfiguredCategories] = useState<string[]>([]);

  // Multi-value params — each is an array of selected values (empty = no filter = "all")
  // "all options selected" is normalised to empty (same as no filter)
  const statusValues: string[] = useMemo(() => {
    const raw = urlParams.get('status') ?? '';
    if (!raw) return [];
    const parts = raw.split(',').map((v) => v.trim()).filter(Boolean);
    const filtered = validStatuses.length === 0
      ? parts
      : parts.filter((v) => v === 'due_soon' || validStatuses.includes(v));
    // "all real org statuses selected AND no due_soon" is treated as no filter
    const withoutDueSoon = filtered.filter((v) => v !== 'due_soon');
    if (validStatuses.length > 0 && validStatuses.every((v) => withoutDueSoon.includes(v)) && !filtered.includes('due_soon')) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, validStatuses.join(',')]);

  const priorityValues: string[] = useMemo(() => {
    const raw = urlParams.get('priority') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter((v) => VALID_PRIORITIES.includes(v));
    if (VALID_PRIORITIES.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

  const locationValues: string[] = useMemo(() => {
    const raw = urlParams.get('location') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter(Boolean);
    if (configuredLocations.length > 1 && configuredLocations.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, configuredLocations.join(',')]);

  const categoryValues: string[] = useMemo(() => {
    const raw = urlParams.get('category') ?? '';
    if (!raw) return [];
    const filtered = raw.split(',').map((v) => v.trim()).filter(Boolean);
    if (configuredCategories.length > 0 && configuredCategories.every((v) => filtered.includes(v))) return [];
    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr, configuredCategories.join(',')]);
  const dateFrom = urlParams.get('dateFrom') ?? '';
  const dateTo   = urlParams.get('dateTo') ?? '';
  const nonClosedFilter = urlParams.get('nonClosed') === 'true';
  const userFilter     = urlParams.get('userFilter') ?? 'all';
  const userFilterType = (urlParams.get('userFilterType') as 'assignedTo' | 'createdBy') || 'assignedTo';
  const emailOrigin    = urlParams.get('emailOrigin') === 'true';
  const clientIdFilter = urlParams.get('clientId') ?? 'all';
  const overdueFilter  = urlParams.get('overdue') === 'true';
  const scheduledFilter = urlParams.get('scheduled') === 'true';
  const recurringFilter = urlParams.get('recurring') === 'true';
  const sortCol  = (urlParams.get('sortCol') as SortCol) || 'id';
  const sortDir  = (urlParams.get('sortDir') as SortDir) || 'desc';

  const [searchInput, setSearchInput] = useState(urlParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data: users } = useListUsers();
  const { data: clients } = useListClients();

  // ── Filter presets ────────────────────────────────────────────────────────
  const [presets, setPresets] = useState<FilterPreset[]>(() =>
    user ? loadPresetsFromStorage(user.id) : []
  );
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Re-load presets when user changes
  useEffect(() => {
    if (user) setPresets(loadPresetsFromStorage(user.id));
  }, [user?.id]);

  const buildPresetParams = useCallback((): string => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set('search', debouncedSearch);
    if (statusValues.length > 0) p.set('status', statusValues.join(','));
    if (priorityValues.length > 0) p.set('priority', priorityValues.join(','));
    if (locationValues.length > 0) p.set('location', locationValues.join(','));
    if (categoryValues.length > 0) p.set('category', categoryValues.join(','));
    if (userFilter !== 'all') { p.set('userFilter', userFilter); p.set('userFilterType', userFilterType); }
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    if (nonClosedFilter) p.set('nonClosed', 'true');
    if (emailOrigin) p.set('emailOrigin', 'true');
    if (clientIdFilter !== 'all') p.set('clientId', clientIdFilter);
    if (overdueFilter) p.set('overdue', 'true');
    if (scheduledFilter) p.set('scheduled', 'true');
    if (recurringFilter) p.set('recurring', 'true');
    return p.toString();
  }, [debouncedSearch, statusValues, priorityValues, locationValues, categoryValues, userFilter, userFilterType, dateFrom, dateTo, nonClosedFilter, emailOrigin, clientIdFilter, overdueFilter, scheduledFilter, recurringFilter]);

  const handleSavePreset = useCallback(() => {
    if (!user || !presetName.trim()) return;
    const newPreset: FilterPreset = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: presetName.trim(),
      params: buildPresetParams(),
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresetsToStorage(user.id, updated);
    setSavePresetOpen(false);
    setPresetName('');
  }, [user, presetName, presets, buildPresetParams]);

  const handleDeletePreset = useCallback((id: string) => {
    if (!user) return;
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    savePresetsToStorage(user.id, updated);
  }, [user, presets]);

  const applyPreset = useCallback((params: string) => {
    // Preserve sort params from current URL, apply filter params from preset
    const currentParams = new URLSearchParams(searchStr);
    const next = new URLSearchParams(params);
    // Re-apply current sort if present
    if (currentParams.get('sortCol')) next.set('sortCol', currentParams.get('sortCol')!);
    if (currentParams.get('sortDir')) next.set('sortDir', currentParams.get('sortDir')!);
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
    // Sync search input and close advanced filters panel
    setSearchInput(next.get('search') ?? '');
    setShowExtraManual(false);
  }, [searchStr, navigate]);

  // ── Bulk selection state ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Resizable columns ─────────────────────────────────────────────────────
  const DEFAULT_COL_WIDTHS: Record<string, number> = {
    id: 48, title: 240, category: 110, status: 90,
    priority: 80, dueAt: 90, assignee: 120, location: 90, createdAt: 90,
  };
  const MIN_COL_WIDTHS: Record<string, number> = {
    id: 40, title: 160, category: 80, status: 70,
    priority: 60, dueAt: 70, assignee: 90, location: 70, createdAt: 75,
  };
  const MAX_COL_WIDTHS: Record<string, number> = {
    id: 96, title: 420, category: 280, status: 220,
    priority: 180, dueAt: 180, assignee: 260, location: 220, createdAt: 180,
  };
  const normalizeColWidths = (value: unknown) => {
    const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(
      Object.entries(DEFAULT_COL_WIDTHS).map(([key, defaultWidth]) => {
        const width = Number(saved[key]);
        const min = MIN_COL_WIDTHS[key] ?? 40;
        const max = MAX_COL_WIDTHS[key] ?? 500;
        return [key, Number.isFinite(width) ? Math.min(max, Math.max(min, width)) : defaultWidth];
      }),
    ) as Record<string, number>;
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ticketlist-col-widths');
      return saved ? normalizeColWidths(JSON.parse(saved)) : DEFAULT_COL_WIDTHS;
    } catch { return DEFAULT_COL_WIDTHS; }
  });
  const cw = (k: string) => colWidths[k] ?? DEFAULT_COL_WIDTHS[k] ?? 100;
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);
  const startResize = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] ?? DEFAULT_COL_WIDTHS[col] ?? 100 };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
        const activeCol = resizingRef.current.col;
        const min = MIN_COL_WIDTHS[activeCol] ?? 40;
        const max = MAX_COL_WIDTHS[activeCol] ?? 500;
        const w = Math.min(max, Math.max(min, resizingRef.current.startWidth + ev.clientX - resizingRef.current.startX));
      setColWidths(prev => {
        const next = { ...prev, [resizingRef.current!.col]: w };
        localStorage.setItem('ticketlist-col-widths', JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => { resizingRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  // ── Column visibility ─────────────────────────────────────────────────────
  const DEFAULT_VISIBLE: Record<string, boolean> = { id: true, title: true, category: true, status: true, priority: true, dueAt: true, assignee: true, location: true, createdAt: true };
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem('ticketlist-visible-cols'); return s ? { ...DEFAULT_VISIBLE, ...JSON.parse(s) } : DEFAULT_VISIBLE; } catch { return DEFAULT_VISIBLE; }
  });
  const [colMenuAnchor, setColMenuAnchor] = useState<HTMLElement | null>(null);
  const toggleCol = (key: string) => setVisibleCols(prev => { const next = { ...prev, [key]: !prev[key] }; localStorage.setItem('ticketlist-visible-cols', JSON.stringify(next)); return next; });

  const deleteTicket = useDeleteTicket();
  const [focusedRowIdx, setFocusedRowIdx] = useState<number | null>(null);

  const hasExtraFilters = locationValues.length > 0 || categoryValues.length > 0 || !!dateFrom || !!dateTo || userFilter !== 'all' || emailOrigin || clientIdFilter !== 'all' || overdueFilter;
  const hasActiveFilters = !!debouncedSearch || statusValues.length > 0 || priorityValues.length > 0 || hasExtraFilters || nonClosedFilter || scheduledFilter || recurringFilter;

  // Key of the currently active quick filter chip (used when navigating to ticket detail)
  const activeQFK: string | null =
    user && userFilter === String(user.id) && userFilterType === 'assignedTo' ? 'assignedToMe' :
    overdueFilter ? 'overdue' :
    (priorityValues.includes('high') && priorityValues.includes('urgent')) ? 'highPriority' :
    (statusValues.includes('open') && statusValues.length === 1) ? 'open' :
    null;
  const [showExtraManual, setShowExtraManual] = useState(false);
  // Auto-expand only when extra filters were set manually (not via a quick-filter chip).
  // When a chip is active, activeQFK !== null — suppress auto-expand so the panel stays collapsed.
  const showExtra = showExtraManual || (hasExtraFilters && activeQFK === null);

  const setParam = useCallback((key: string, value: string, empty = 'all') => {
    const next = new URLSearchParams(searchStr);
    if (!value || value === empty) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  }, [searchStr, navigate]);

  const setMultiParam = useCallback((key: string, values: string[], allOptions?: string[]) => {
    const next = new URLSearchParams(searchStr);
    if (key === 'status') next.delete('nonClosed');
    // Treat "all options selected" the same as "nothing selected" — no filter applied
    const isAll = allOptions && allOptions.length > 0 && allOptions.every((v) => values.includes(v));
    if (values.length === 0 || isAll) {
      next.delete(key);
    } else {
      next.set(key, values.join(','));
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  }, [searchStr, navigate]);

  useEffect(() => {
    const next = new URLSearchParams(searchStr);
    if (debouncedSearch) {
      next.set('search', debouncedSearch);
    } else {
      next.delete('search');
    }
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const clearExtra = () => {
    const next = new URLSearchParams(searchStr);
    ['location', 'category', 'dateFrom', 'dateTo', 'userFilter', 'userFilterType', 'emailOrigin', 'clientId', 'overdue'].forEach((k) => next.delete(k));
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
    setShowExtraManual(false);
  };

  const clearAllFilters = useCallback(() => {
    setSearchInput('');
    navigate('/tickets', { replace: true } as any);
    setShowExtraManual(false);
    try {
      sessionStorage.removeItem('ticketlist_session_filters');
      sessionStorage.removeItem('ticketlist_session_scroll');
    } catch {}
  }, [navigate]);

  // ── sessionStorage: persist filters + scroll across navigation ────────────
  const sessionRestored = useRef(false);
  const scrollRestored  = useRef(false);

  useEffect(() => {
    if (sessionRestored.current) return;
    sessionRestored.current = true;
    if (!searchStr) {
      try {
        const saved = sessionStorage.getItem('ticketlist_session_filters');
        if (saved) {
          navigate(`/tickets?${saved}`, { replace: true } as any);
          setSearchInput(new URLSearchParams(saved).get('search') ?? '');
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionRestored.current) return;
    try {
      if (searchStr) {
        sessionStorage.setItem('ticketlist_session_filters', searchStr);
      } else {
        sessionStorage.removeItem('ticketlist_session_filters');
      }
    } catch {}
  }, [searchStr]);

  useEffect(() => {
    const handler = () => {
      try { sessionStorage.setItem('ticketlist_session_scroll', String(window.scrollY)); } catch {}
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleSort = (col: SortCol) => {
    const next = new URLSearchParams(searchStr);
    if (sortCol === col) {
      const newDir = sortDir === 'asc' ? 'desc' : 'asc';
      newDir === 'desc' ? next.delete('sortDir') : next.set('sortDir', newDir);
    } else {
      next.set('sortCol', col);
      next.delete('sortDir');
    }
    if (col === 'id') next.delete('sortCol');
    const qs = next.toString();
    navigate(`/tickets${qs ? '?' + qs : ''}`, { replace: true } as any);
  };

  useEffect(() => {
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setConfiguredLocations(d.value ?? []))
      .catch(() => {});
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setConfiguredCategories(d.value ?? []))
      .catch(() => {});
  }, []);

  const { data: tickets, isLoading } = useListTickets({
    search: debouncedSearch || undefined,
    status:   statusValues.length   > 0 ? statusValues.join(',')   : undefined,
    priority: priorityValues.length > 0 ? priorityValues.join(',') : undefined,
    location: locationValues.length > 0 ? locationValues.join(',') : undefined,
    category: categoryValues.length > 0 ? categoryValues.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    assignedTo: userFilter !== 'all' && userFilterType === 'assignedTo' ? parseInt(userFilter, 10) : undefined,
    createdBy:  userFilter !== 'all' && userFilterType === 'createdBy'  ? parseInt(userFilter, 10) : undefined,
    emailOrigin: emailOrigin || undefined,
    clientId: clientIdFilter !== 'all' ? parseInt(clientIdFilter, 10) : undefined,
    ...(overdueFilter ? { overdue: 'true' } : {}),
    ...(scheduledFilter ? { scheduled: 'true' } : {}),
    ...(recurringFilter ? { recurring: true } : {}),
    ...(nonClosedFilter ? { nonClosed: 'true' } : {}),
  } as any, { query: { refetchInterval: 30_000, refetchIntervalInBackground: false } as any });

  // Restore scroll position after tickets first load
  useEffect(() => {
    if (scrollRestored.current || tickets === undefined) return;
    scrollRestored.current = true;
    try {
      const saved = sessionStorage.getItem('ticketlist_session_scroll');
      if (saved) requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    } catch {}
  }, [tickets]);

  // Clear selection and keyboard focus when tickets change (e.g. after delete or filter)
  useEffect(() => { setSelectedIds(new Set()); setFocusedRowIdx(null); }, [tickets]);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dateLocale = lang === 'en' ? 'en-US' : 'it-IT';
  const showLocation = configuredLocations.length !== 1;
  const showClient = (user as any)?.clientsEnabled !== false;
  const colsConfig: Array<{ key: string; label: string; fixed?: boolean }> = [
    { key: 'id', label: t.ticketList.colId },
    { key: 'title', label: t.ticketList.colTitle, fixed: true },
    { key: 'category', label: t.ticketList.colCategory },
    { key: 'status', label: t.ticketList.colStatus },
    { key: 'priority', label: t.ticketList.colPriority },
    { key: 'dueAt', label: t.ticketList.deadlineColumn },
    { key: 'assignee', label: t.ticketList.colAssignee },
    ...(showLocation ? [{ key: 'location', label: t.ticketList.colLocation }] : []),
    { key: 'createdAt', label: t.ticketList.colCreated },
  ];

  const sortedTickets = useMemo(() => {
    if (!tickets) return [];
    return [...tickets].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'id':        cmp = a.id - b.id; break;
        case 'title':     cmp = a.title.localeCompare(b.title); break;
        case 'category':  cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'status': {
          const aIsClose = a.status === 'closed';
          const bIsClose = b.status === 'closed';
          if (aIsClose !== bIsClose) return aIsClose ? 1 : -1;
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        }
        case 'priority':  cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99); break;
        case 'assignee':  cmp = (a.assignee?.name || '').localeCompare(b.assignee?.name || ''); break;
        case 'location':  cmp = ((a as any).location || '').localeCompare((b as any).location || ''); break;
        case 'client':    cmp = ((a as any).client?.name || '').localeCompare((b as any).client?.name || ''); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'dueAt': {
          const aTime = (a as any).dueAt ? new Date((a as any).dueAt).getTime() : Infinity;
          const bTime = (b as any).dueAt ? new Date((b as any).dueAt).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tickets, sortCol, sortDir]);

  // J/K/Enter keyboard row navigation — via shared hook
  const handleJKey = useCallback(() => {
    setFocusedRowIdx((prev) => {
      const max = sortedTickets.length - 1;
      if (max < 0) return null;
      return prev === null ? 0 : Math.min(prev + 1, max);
    });
  }, [sortedTickets]);

  const handleKKey = useCallback(() => {
    setFocusedRowIdx((prev) => {
      if (prev === null || prev === 0) return prev;
      return prev - 1;
    });
  }, []);

  const handleEnterKey = useCallback(() => {
    setFocusedRowIdx((prev) => {
      if (prev !== null && sortedTickets[prev]) {
        const ticket = sortedTickets[prev];
        navigate(`/tickets/${ticket.id}${activeQFK ? `?bql=${activeQFK}` : ''}`);
      }
      return prev;
    });
  }, [sortedTickets, navigate, activeQFK]);

  useKeyboardShortcut(['j', 'J'], handleJKey);
  useKeyboardShortcut(['k', 'K'], handleKKey);
  useKeyboardShortcut('Enter', handleEnterKey);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedRowIdx === null) return;
    document.querySelector(`[data-row-idx="${focusedRowIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusedRowIdx]);

  // ── Selection helpers ────────────────────────────────────────────────────
  const allVisibleIds = sortedTickets.map((t) => t.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteTicket.mutateAsync({ id });
      } catch {
        failed++;
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
    setDeleting(false);
    const succeeded = ids.length - failed;
    if (failed === 0) {
      setBulkFeedback({ type: 'success', msg: t.ticketList.bulkDeleteSuccess(succeeded, entityTerm.singular) });
    } else if (succeeded > 0) {
      setBulkFeedback({ type: 'error', msg: t.ticketList.bulkDeletePartial(succeeded, failed, entityTerm.singular) });
    } else {
      setBulkFeedback({ type: 'error', msg: t.ticketList.bulkDeleteError });
    }
    setTimeout(() => setBulkFeedback(null), 5000);
  };

  const col = (id: SortCol, label: string, sx?: object) => (
    <TableCell style={{ padding: '10px 8px', width: colWidths[id] ?? DEFAULT_COL_WIDTHS[id] }} sx={{ whiteSpace: 'nowrap', position: 'relative', overflow: 'hidden', ...sx }}>
      <TableSortLabel
        active={sortCol === id}
        direction={sortCol === id ? sortDir : 'asc'}
        onClick={() => handleSort(id)}
        sx={{ '& .MuiTableSortLabel-icon': { fontSize: '0.75rem' } }}
      >
        {label}
      </TableSortLabel>
      <Box
        onMouseDown={(e) => startResize(id, e)}
        sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1, '&:hover': { bgcolor: 'primary.main', opacity: 0.4 } }}
      />
    </TableCell>
  );

  const colSpanTotal = ['id','title','category','status','priority','dueAt','assignee','createdAt'].filter(k => visibleCols[k] ?? true).length + (showLocation && (visibleCols.location ?? true) ? 1 : 0) + (isAdmin ? 1 : 0) + 1;
  const tableWidth =
    (isAdmin ? 28 : 0) +
    (visibleCols.id ?? true ? cw('id') : 0) +
    cw('title') +
    (visibleCols.category ?? true ? cw('category') : 0) +
    (visibleCols.status ?? true ? cw('status') : 0) +
    (visibleCols.priority ?? true ? cw('priority') : 0) +
    (visibleCols.dueAt ?? true ? cw('dueAt') : 0) +
    (visibleCols.assignee ?? true ? cw('assignee') : 0) +
    (showLocation && (visibleCols.location ?? true) ? cw('location') : 0) +
    (visibleCols.createdAt ?? true ? cw('createdAt') : 0);

  return (
    <Box className={`td-operational-page${theme.palette.mode === 'dark' ? ' td-operational-page--dark' : ''}`}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{ xs: 1.5, sm: 3 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Typography variant="h5" fontWeight="bold">{entityTerm.navAll}</Typography>
          {isAdmin && (
            <Chip
              icon={<RepeatIcon style={{ fontSize: 14 }} />}
              label={t.ticketList.recurringTab}
              size="small"
              variant={recurringFilter ? 'filled' : 'outlined'}
              color={recurringFilter ? 'primary' : 'default'}
              onClick={() => setParam('recurring', recurringFilter ? '' : 'true', 'false')}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {isAdmin && (
            <Tooltip title={lang === 'it' ? 'Apri il cestino' : 'Open ticket trash'} arrow>
              <IconButton
                component={Link}
                href="/tickets/trash"
                size="small"
                aria-label={lang === 'it' ? 'Apri il cestino' : 'Open ticket trash'}
                sx={{
                  color: 'text.secondary',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  '&:hover': { color: 'error.main', borderColor: 'error.light', bgcolor: 'error.50' },
                }}
              >
                <DeleteSweepIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Button
          component={Link}
          href="/tickets/new"
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          size="small"
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>{entityTerm.navNew}</Box>
        </Button>
      </Box>

      {/* Overdue filter banner */}
      {overdueFilter && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setParam('overdue', '', 'true')}>
              {lang === 'it' ? 'Rimuovi filtro' : 'Clear filter'}
            </Button>
          }
        >
          {lang === 'it' ? 'Filtro attivo: ticket scaduti (con scadenza passata, non risolti)' : 'Active filter: overdue tickets (past due date, not resolved)'}
        </Alert>
      )}

      {/* Bulk feedback */}
      {bulkFeedback && (
        <Alert severity={bulkFeedback.type} sx={{ mb: 2 }} onClose={() => setBulkFeedback(null)}>
          {bulkFeedback.msg}
        </Alert>
      )}

      {/* Quick filter chips */}
      <Box display="flex" flexWrap="wrap" gap={1} mb={1.5} alignItems="center">
        {user && (
          <Chip
            label={t.ticketList.quickFilterAssignedToMe}
            size="small"
            variant={userFilter === String(user.id) && userFilterType === 'assignedTo' ? 'filled' : 'outlined'}
            color={userFilter === String(user.id) && userFilterType === 'assignedTo' ? 'primary' : 'default'}
            onClick={() =>
              userFilter === String(user.id) && userFilterType === 'assignedTo'
                ? clearAllFilters()
                : applyPreset(`userFilter=${user.id}&userFilterType=assignedTo`)
            }
            sx={{ cursor: 'pointer', fontWeight: userFilter === String(user.id) && userFilterType === 'assignedTo' ? 600 : 400 }}
          />
        )}
        <Chip
          label={t.ticketList.quickFilterOverdue}
          size="small"
          variant={overdueFilter ? 'filled' : 'outlined'}
          color={overdueFilter ? 'error' : 'default'}
          onClick={() => overdueFilter ? clearAllFilters() : applyPreset('overdue=true')}
          sx={{ cursor: 'pointer', fontWeight: overdueFilter ? 600 : 400 }}
        />
        <Chip
          label={t.ticketList.quickFilterHighPriority}
          size="small"
          variant={priorityValues.includes('high') && priorityValues.includes('urgent') ? 'filled' : 'outlined'}
          color={priorityValues.includes('high') && priorityValues.includes('urgent') ? 'warning' : 'default'}
          onClick={() =>
            priorityValues.includes('high') && priorityValues.includes('urgent')
              ? clearAllFilters()
              : applyPreset('priority=high,urgent')
          }
          sx={{ cursor: 'pointer', fontWeight: priorityValues.includes('high') && priorityValues.includes('urgent') ? 600 : 400 }}
        />
        <Chip
          label={t.ticketList.quickFilterOpen}
          size="small"
          variant={statusValues.includes('open') && statusValues.length === 1 ? 'filled' : 'outlined'}
          color={statusValues.includes('open') && statusValues.length === 1 ? 'primary' : 'default'}
          onClick={() =>
            statusValues.includes('open') && statusValues.length === 1
              ? clearAllFilters()
              : applyPreset('status=open')
          }
          sx={{ cursor: 'pointer', fontWeight: statusValues.includes('open') && statusValues.length === 1 ? 600 : 400 }}
        />
      </Box>

      {/* Filter preset chips */}
      {presets.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1} mb={1.5} alignItems="center">
          {presets.map((preset) => (
            <Chip
              key={preset.id}
              label={preset.name}
              onClick={() => applyPreset(preset.params)}
              onDelete={() => handleDeletePreset(preset.id)}
              deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 500, cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      <Card className="td-operational-card" sx={{ mb: { xs: 1.5, sm: 3 }, p: { xs: 1.5, sm: 2 } }}>
        {/* Row 1: search + stato + priorità + toggle */}
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder={lang === 'it' ? `Cerca ${entityTerm.pluralLower}...` : `Search ${entityTerm.pluralLower}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>{t.ticketList.statusFilter}</InputLabel>
              <Select
                multiple
                displayEmpty
                value={statusValues}
                onChange={(e) => setMultiParam('status', e.target.value as string[], orgStatuses.map((s) => s.key))}
                input={<OutlinedInput notched label={t.ticketList.statusFilter} />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allStatuses}</Box>;
                  return (
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                      {selected.map((v) => {
                        const isDueSoon = v === 'due_soon';
                        const customColor = isDueSoon ? undefined : getColorForKey(v);
                        const label = isDueSoon ? t.ticketList.dueSoon : (getLabelForKey(v) || v);
                        return (
                          <Chip
                            key={v}
                            label={label}
                            size="small"
                            icon={isDueSoon ? <ScheduleIcon style={{ fontSize: 14 }} /> : undefined}
                            onDelete={() => setMultiParam('status', statusValues.filter((s) => s !== v), orgStatuses.map((s) => s.key))}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={isDueSoon
                              ? { bgcolor: 'warning.main', color: 'white', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }, '& .MuiChip-icon': { color: 'white' } }
                              : customColor ? { bgcolor: customColor, color: 'white', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } } : undefined}
                          />
                        );
                      })}
                    </Box>
                  );
                }}
              >
                {orgStatuses.map((s) => (
                  <MenuItem key={s.key} value={s.key} dense>
                    <Checkbox size="small" checked={statusValues.includes(s.key)} sx={{ py: 0 }} />
                    <ListItemText primary={s.label} />
                  </MenuItem>
                ))}
                <MenuItem key="due_soon" value="due_soon" dense>
                  <Checkbox size="small" checked={statusValues.includes('due_soon')} sx={{ py: 0 }} />
                  <ScheduleIcon sx={{ fontSize: 16, mr: 0.75, color: 'warning.main', flexShrink: 0 }} />
                  <ListItemText primary={t.ticketList.dueSoon} primaryTypographyProps={{ sx: { color: 'warning.main', fontWeight: 600 } }} />
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel shrink>{t.ticketList.priorityFilter}</InputLabel>
              <Select
                multiple
                displayEmpty
                value={priorityValues}
                onChange={(e) => setMultiParam('priority', e.target.value as string[], VALID_PRIORITIES)}
                input={<OutlinedInput notched label={t.ticketList.priorityFilter} />}
                renderValue={(selected) => {
                  if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allPriorities}</Box>;
                  return (
                    <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                      {selected.map((v) => (
                        <Chip
                          key={v}
                          label={t.priority[v as keyof typeof t.priority] || v}
                          size="small"
                          onDelete={() => setMultiParam('priority', priorityValues.filter((p) => p !== v), VALID_PRIORITIES)}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ))}
                    </Box>
                  );
                }}
              >
                {VALID_PRIORITIES.map((p) => (
                  <MenuItem key={p} value={p} dense>
                    <Checkbox size="small" checked={priorityValues.includes(p)} sx={{ py: 0 }} />
                    <ListItemText primary={t.priority[p as keyof typeof t.priority] || p} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm="auto" md={2}>
            <Button
              fullWidth size="small"
              variant={hasExtraFilters ? 'contained' : 'outlined'}
              color={hasExtraFilters ? 'primary' : 'inherit'}
              startIcon={<FilterList />}
              onClick={() => setShowExtraManual((v) => !v)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t.ticketList.moreFilters}
              {hasExtraFilters && ` (${[locationValues.length > 0, categoryValues.length > 0, !!dateFrom, !!dateTo, userFilter !== 'all', emailOrigin, clientIdFilter !== 'all', overdueFilter].filter(Boolean).length})`}
            </Button>
          </Grid>
          {hasActiveFilters && (
            <Grid item xs={12} sm="auto">
              <Tooltip title={t.ticketList.presetSaveTitle} arrow>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<BookmarkAddIcon />}
                  onClick={() => { setPresetName(''); setSavePresetOpen(true); }}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {t.ticketList.presetSave}
                </Button>
              </Tooltip>
            </Grid>
          )}
        </Grid>

        {/* Row 2: advanced filters */}
        <Collapse in={showExtra}>
          <Grid container spacing={1.5} mt={0.25}>
            {configuredLocations.length > 1 && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink>{t.ticketList.locationFilter}</InputLabel>
                  <Select
                    multiple
                    displayEmpty
                    value={locationValues}
                    onChange={(e) => setMultiParam('location', e.target.value as string[], configuredLocations)}
                    input={<OutlinedInput notched label={t.ticketList.locationFilter} />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allLocations}</Box>;
                      return (
                        <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                          {selected.map((v) => (
                            <Chip
                              key={v}
                              label={v}
                              size="small"
                              onDelete={() => setMultiParam('location', locationValues.filter((l) => l !== v), configuredLocations)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      );
                    }}
                  >
                    {configuredLocations.map((loc) => (
                      <MenuItem key={loc} value={loc} dense>
                        <Checkbox size="small" checked={locationValues.includes(loc)} sx={{ py: 0 }} />
                        <ListItemText primary={loc} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {configuredCategories.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel shrink>{t.ticketList.categoryFilter}</InputLabel>
                  <Select
                    multiple
                    displayEmpty
                    value={categoryValues}
                    onChange={(e) => setMultiParam('category', e.target.value as string[], configuredCategories)}
                    input={<OutlinedInput notched label={t.ticketList.categoryFilter} />}
                    renderValue={(selected) => {
                      if (selected.length === 0) return <Box component="span" sx={{ color: 'text.secondary' }}>{t.ticketList.allCategories}</Box>;
                      return (
                        <Box display="flex" flexWrap="wrap" gap={0.5} sx={{ my: -0.25 }}>
                          {selected.map((v) => (
                            <Chip
                              key={v}
                              label={v}
                              size="small"
                              onDelete={() => setMultiParam('category', categoryValues.filter((c) => c !== v), configuredCategories)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      );
                    }}
                  >
                    {configuredCategories.map((cat) => (
                      <MenuItem key={cat} value={cat} dense>
                        <Checkbox size="small" checked={categoryValues.includes(cat)} sx={{ py: 0 }} />
                        <ListItemText primary={cat} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {users && users.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={userFilterType === 'assignedTo' ? t.ticketList.userFilterAssigned : t.ticketList.userFilterCreated}
                  value={userFilter}
                  onChange={(e) => setParam('userFilter', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allUsers}</MenuItem>
                  {users.map((u: any) => (
                    <MenuItem key={u.id} value={String(u.id)}>{u.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {users && users.length > 0 && (
              <Grid item xs={12} sm={6} md={2.5}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.userFilterType}
                  value={userFilterType}
                  onChange={(e) => setParam('userFilterType', e.target.value, 'assignedTo')}
                >
                  <MenuItem value="assignedTo">{t.ticketList.userFilterAssigned}</MenuItem>
                  <MenuItem value="createdBy">{t.ticketList.userFilterCreated}</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small"
                label={t.ticketList.dateFrom}
                type="date"
                value={dateFrom}
                onChange={(e) => setParam('dateFrom', e.target.value, '')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small"
                label={t.ticketList.dateTo}
                type="date"
                value={dateTo}
                onChange={(e) => setParam('dateTo', e.target.value, '')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small"
                label={t.ticketList.originFilter}
                value={emailOrigin ? 'email' : 'all'}
                onChange={(e) => setParam('emailOrigin', e.target.value === 'email' ? 'true' : '', 'all')}
              >
                <MenuItem value="all">{t.ticketList.allOrigins}</MenuItem>
                <MenuItem value="email">{t.ticketList.emailOriginFilter}</MenuItem>
              </TextField>
            </Grid>
            {showClient && clients && clients.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select fullWidth size="small"
                  label={t.ticketList.clientFilter}
                  value={clientIdFilter}
                  onChange={(e) => setParam('clientId', e.target.value)}
                >
                  <MenuItem value="all">{t.ticketList.allClients}</MenuItem>
                  {clients.map((c: any) => (
                    <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {hasExtraFilters && (
              <Grid item xs={12} sm="auto">
                <Button
                  size="small" color="inherit"
                  startIcon={<FilterListOff />}
                  onClick={clearExtra}
                >
                  {t.ticketList.clearFilters}
                </Button>
              </Grid>
            )}
          </Grid>
        </Collapse>
      </Card>

      <Card className="td-operational-card">
        {/* Bulk action toolbar — visible only when items are selected */}
        {isAdmin && selectedIds.size > 0 && (
          <Toolbar
            sx={{
              pl: 2, pr: 1,
              bgcolor: 'primary.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              minHeight: '48px !important',
              gap: 1,
            }}
          >
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', color: 'primary.main' }}>
              {t.ticketList.bulkSelected(selectedIds.size, entityTerm.singular)}
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t.ticketList.bulkDelete}
            </Button>
          </Toolbar>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 0.5, pb: 0 }}>
          <Button
            size="small"
            startIcon={<ViewColumn />}
            onClick={(e) => setColMenuAnchor(e.currentTarget)}
            sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.75rem' }}
          >
            {lang === 'it' ? 'Colonne' : 'Columns'}
          </Button>
          <Menu anchorEl={colMenuAnchor} open={Boolean(colMenuAnchor)} onClose={() => setColMenuAnchor(null)}>
            {colsConfig.map(({ key, label, fixed }) => (
              <MenuItem key={key} dense onClick={() => !fixed && toggleCol(key)} sx={{ gap: 0.5 }}>
                <Checkbox size="small" checked={visibleCols[key] ?? true} disabled={fixed} sx={{ p: 0 }} />
                <ListItemText primary={label} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <Box sx={{ width: '100%', overflowX: { xs: 'hidden', sm: 'auto' } }}>
          <Table className="td-ticket-table" size="small" sx={{ tableLayout: { xs: 'auto', sm: 'fixed' }, width: { xs: '100%', sm: tableWidth }, minWidth: { xs: 'unset', sm: '100%' } }}>
            {/* colgroup omitted on mobile — fixed col widths cause page-level overflow
                even when columns are hidden with display:none */}
            {!isMobile && (
              <colgroup>
                <col style={{ width: 4 }} />
                {isAdmin && <col style={{ width: 28 }} />}
                {(visibleCols.id ?? true) && <col style={{ width: colWidths.id ?? DEFAULT_COL_WIDTHS.id }} />}
                <col style={{ width: colWidths.title ?? DEFAULT_COL_WIDTHS.title }} />
                {(visibleCols.category ?? true) && <col style={{ width: colWidths.category ?? DEFAULT_COL_WIDTHS.category }} />}
                {(visibleCols.status ?? true) && <col style={{ width: colWidths.status ?? DEFAULT_COL_WIDTHS.status }} />}
                {(visibleCols.priority ?? true) && <col style={{ width: colWidths.priority ?? DEFAULT_COL_WIDTHS.priority }} />}
                {(visibleCols.dueAt ?? true) && <col style={{ width: colWidths.dueAt ?? DEFAULT_COL_WIDTHS.dueAt }} />}
                {(visibleCols.assignee ?? true) && <col style={{ width: colWidths.assignee ?? DEFAULT_COL_WIDTHS.assignee }} />}
                {showLocation && (visibleCols.location ?? true) && <col style={{ width: colWidths.location ?? DEFAULT_COL_WIDTHS.location }} />}
                {(visibleCols.createdAt ?? true) && <col style={{ width: colWidths.createdAt ?? DEFAULT_COL_WIDTHS.createdAt }} />}
              </colgroup>
            )}
            <TableHead>
              <TableRow className="td-ticket-table-head" sx={{ borderBottom: '2px solid', borderColor: 'divider' }}>
                <TableCell padding="none" sx={{ p: 0, width: 4, border: 'none' }} />
                {isAdmin && (
                  <TableCell padding="none" sx={{ width: 28, pl: 0.5, pr: 0, verticalAlign: 'middle' }}>
                    <Checkbox
                      size="small"
                      indeterminate={someSelected}
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={sortedTickets.length === 0}
                      sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                    />
                  </TableCell>
                )}
                {(visibleCols.id ?? true) && col('id', t.ticketList.colId)}
                {col('title', t.ticketList.colTitle)}
                {(visibleCols.category ?? true) && col('category', t.ticketList.colCategory, { display: { xs: 'none', md: 'table-cell' } })}
                {(visibleCols.status ?? true) && col('status', t.ticketList.colStatus)}
                {(visibleCols.priority ?? true) && col('priority', t.ticketList.colPriority, { display: { xs: 'none', sm: 'table-cell' } })}
                {(visibleCols.dueAt ?? true) && col('dueAt', t.ticketList.deadlineColumn, { display: { xs: 'none', sm: 'table-cell' } })}
                {(visibleCols.assignee ?? true) && col('assignee', t.ticketList.colAssignee, { display: { xs: 'none', lg: 'table-cell' } })}
                {showLocation && (visibleCols.location ?? true) && col('location', t.ticketList.colLocation, { display: { xs: 'none', md: 'table-cell' } })}
                {(visibleCols.createdAt ?? true) && col('createdAt', t.ticketList.colCreated, { display: { xs: 'none', md: 'table-cell' } })}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpanTotal} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : sortedTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpanTotal} align="center" sx={{ py: 5 }}>
                    {hasActiveFilters ? (
                      <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                        <Typography variant="body2" color="text.secondary">
                          {t.ticketList.noFilterResults}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          startIcon={<FilterListOff />}
                          onClick={clearAllFilters}
                        >
                          {t.ticketList.resetFilters}
                        </Button>
                      </Box>
                    ) : (
                      <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                        <Typography variant="body1" fontWeight={600} color="text.secondary">
                          {t.ticketList.emptyStateTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.ticketList.emptyStateDesc}
                        </Typography>
                        {isAdmin && (
                          <Button
                            component={Link}
                            to="/tickets/new"
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            size="small"
                          >
                            {t.nav.newTicket}
                          </Button>
                        )}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTickets.map((ticket, rowIdx) => {
                  const isSelected = selectedIds.has(ticket.id);
                  const isFocused = focusedRowIdx === rowIdx;
                  return (
                    <TableRow
                      key={ticket.id}
                      selected={isSelected}
                      data-row-idx={rowIdx}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: ticket.priority === 'urgent' ? 'rgba(211,47,47,0.04)' : undefined,
                        '&:hover': {
                          bgcolor: ticket.priority === 'urgent' ? 'rgba(211,47,47,0.08) !important' : 'action.hover !important',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                          position: 'relative',
                          zIndex: 1,
                        },
                        ...(isFocused ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' } : {}),
                      }}
                      onClick={() => { setFocusedRowIdx(rowIdx); navigate(`/tickets/${ticket.id}${activeQFK ? `?bql=${activeQFK}` : ''}`); }}
                    >
                      <TableCell
                        padding="none"
                        sx={{
                          p: 0,
                          width: 4,
                          bgcolor: ({ urgent: '#d32f2f', high: '#e65100', medium: '#1976d2', low: '#9e9e9e' } as Record<string, string>)[ticket.priority] ?? 'transparent',
                        }}
                      />
                      {isAdmin && (
                        <TableCell padding="none" onClick={(e) => toggleSelectOne(ticket.id, e)} sx={{ width: 28, pl: 0.5, pr: 0, verticalAlign: 'middle' }}>
                          <Checkbox size="small" checked={isSelected} sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 16 } }} />
                        </TableCell>
                      )}
                      {(visibleCols.id ?? true) && <TableCell style={{ padding: '10px 6px 10px 0' }} sx={{ fontWeight: 700, color: '#9e9e9e', whiteSpace: 'nowrap', width: { xs: 28, sm: 48 }, fontSize: '0.75rem' }}>#{(ticket as any).ticketNumber ?? ticket.id}</TableCell>}
                      <TableCell style={{ padding: '10px 8px' }} sx={{ width: { xs: 'auto', sm: 180, md: 220, lg: 260 } }}>
                        <Box display="flex" alignItems="flex-start" gap={0.5}>
                          {((ticket as any).hasSolution || (ticket as any).resolutionNote) && (
                            <Tooltip title={(ticket as any).resolutionNote || 'Soluzione trovata'} placement="top" arrow>
                              <CheckCircle sx={{ fontSize: 14, color: 'success.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          {ticket.inboundChannelId && (
                            <Tooltip title={t.ticketList.emailBadgeTooltip(entityTerm.singular)} placement="top" arrow>
                              <EmailIcon sx={{ fontSize: 14, color: 'info.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          {(ticket as any).recurrence && (
                            <Tooltip title={t.ticketList.recurrenceBadgeTooltip} placement="top" arrow>
                              <RepeatIcon sx={{ fontSize: 14, color: 'secondary.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          {(ticket as any).scheduledAt && new Date((ticket as any).scheduledAt) > new Date() && (
                            <Tooltip title={t.ticketList.scheduledBadgeTooltip} placement="top" arrow>
                              <CalendarTodayIcon sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0, mt: 0.2 }} />
                            </Tooltip>
                          )}
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: { xs: '0.82rem', sm: '0.9rem' }, lineHeight: 1.3, fontWeight: ticket.priority === 'urgent' ? 600 : 500, color: 'text.primary' }}>{ticket.title}</Box>
                            {ticket.priority === 'urgent' && (ticket as any).dueAt && (
                              <Typography variant="caption" sx={{ display: 'block', color: 'error.main', fontWeight: 600, mt: 0.25, lineHeight: 1.2 }}>
                                ⚠ {t.ticketList.deadlineColumn}: {new Date((ticket as any).dueAt).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })}
                              </Typography>
                            )}
                          </Box>
                          {(ticket as any).checklistCount > 0 && (
                            <Tooltip title={t.ticketList.checklistProgressTooltip((ticket as any).checklistChecked, (ticket as any).checklistTotal)} placement="top" arrow>
                              <Chip
                                label={`✓ ${(ticket as any).checklistChecked}/${(ticket as any).checklistTotal}`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600, flexShrink: 0, cursor: 'inherit', borderColor: 'text.disabled', color: 'text.secondary' }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      {(visibleCols.category ?? true) && <TableCell style={{ padding: '10px 8px' }} sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{ticket.category}</TableCell>}
                      {(visibleCols.status ?? true) && (
                      <TableCell style={{ padding: '10px 8px' }} sx={{ overflow: 'hidden' }}>
                        {(() => {
                          const customColor = getColorForKey(ticket.status);
                          const muiColor = getStatusColor(ticket.status);
                          const label = getLabelForKey(ticket.status) || t.status[ticket.status] || ticket.status;
                          const softMap: Record<string, { bg: string; fg: string }> = {
                            open: { bg: '#e3f0fd', fg: '#1565c0' },
                            in_progress: { bg: '#fff3e0', fg: '#e65100' },
                            waiting: { bg: '#f3e5f5', fg: '#6a1b9a' },
                            resolved: { bg: '#e8f5e9', fg: '#1b5e20' },
                            closed: { bg: '#f5f5f5', fg: '#424242' },
                          };
                          const soft = !customColor ? softMap[ticket.status] : null;
                          return (
                            <Chip
                              label={label}
                              size="small"
                              sx={customColor
                                ? { bgcolor: customColor, color: 'white', fontWeight: 500, fontSize: { xs: '0.55rem', sm: '0.75rem' }, height: { xs: 16, sm: 24 }, '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } }
                                : soft
                                  ? { bgcolor: soft.bg, color: soft.fg, fontWeight: 600, fontSize: { xs: '0.55rem', sm: '0.75rem' }, height: { xs: 16, sm: 24 }, '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } }
                                  : { color: muiColor as any, fontSize: { xs: '0.55rem', sm: '0.75rem' }, height: { xs: 16, sm: 24 }, '& .MuiChip-label': { px: { xs: 0.5, sm: 1 } } }
                              }
                            />
                          );
                        })()}
                      </TableCell>
                      )}
                      {(visibleCols.priority ?? true) && (
                      <TableCell style={{ padding: '10px 8px' }} sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {(() => {
                          const dotColor = ({ urgent: '#d32f2f', high: '#e65100', medium: '#1976d2', low: '#9e9e9e' } as Record<string, string>)[ticket.priority] ?? '#9e9e9e';
                          return (
                            <Box display="flex" alignItems="center" gap={0.625}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                              <Box component="span" sx={{ fontSize: '0.8rem', fontWeight: 600, color: dotColor, whiteSpace: 'nowrap' }}>
                                {t.priority[ticket.priority] || ticket.priority}
                              </Box>
                            </Box>
                          );
                        })()}
                      </TableCell>
                      )}
                      {(visibleCols.dueAt ?? true) && (
                      <TableCell style={{ padding: '10px 8px' }} sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <DeadlineCell dueAt={(ticket as any).dueAt} />
                      </TableCell>
                      )}
                      {(visibleCols.assignee ?? true) && (
                      <TableCell style={{ padding: '10px 8px' }} sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        {ticket.assignee ? (
                          <Tooltip title={ticket.assignee.name} arrow placement="top">
                            <Box display="flex" alignItems="center" gap={0.875} sx={{ overflow: 'hidden' }}>
                              <Avatar
                                sx={{
                                  width: 26,
                                  height: 26,
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  bgcolor: hashAvatarColor(ticket.assignee.name),
                                  flexShrink: 0,
                                  background: hashAvatarColor(ticket.assignee.name),
                                }}
                              >
                                {getInitials(ticket.assignee.name)}
                              </Avatar>
                               <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ticket.assignee.name}
                              </Box>
                            </Box>
                          </Tooltip>
                        ) : (
                           <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
                        )}
                      </TableCell>
                      )}
                      {showLocation && (visibleCols.location ?? true) && (
                        <TableCell style={{ padding: '10px 8px' }} sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {(ticket as any).location || '—'}
                        </TableCell>
                      )}
                      {(visibleCols.createdAt ?? true) && (
                       <TableCell style={{ padding: '10px 12px 10px 8px' }} sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.disabled', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(ticket.createdAt).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' })}
                        {' '}
                         <Box component="span" sx={{ color: 'text.disabled' }}>
                          {new Date(ticket.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </Box>
                      </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => { if (!deleting) setDeleteDialogOpen(false); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t.ticketList.bulkDeleteConfirmTitle(entityTerm.plural)}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t.ticketList.bulkDeleteConfirmText(selectedIds.size, entityTerm.singular)}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            {t.ticketList.bulkDeleteCancel}
          </Button>
          <Button
            onClick={handleBulkDelete}
            disabled={deleting}
            variant="contained"
            color="error"
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {deleting ? '...' : t.ticketList.bulkDeleteConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save preset dialog */}
      <Dialog
        open={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t.ticketList.presetSaveTitle}
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t.ticketList.presetNameLabel}
            placeholder={t.ticketList.presetNamePlaceholder}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && presetName.trim()) handleSavePreset(); }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setSavePresetOpen(false)}
            variant="outlined"
            color="inherit"
            sx={{ textTransform: 'none' }}
          >
            {t.ticketList.presetSaveCancel}
          </Button>
          <Button
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            variant="contained"
            color="primary"
            startIcon={<BookmarkAddIcon />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t.ticketList.presetSaveConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
