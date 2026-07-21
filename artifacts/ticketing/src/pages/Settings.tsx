import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, TextField, Button,
  Alert, Divider, Chip, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, CircularProgress, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Stack, useMediaQuery, useTheme,
  Avatar, Snackbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem, Collapse,
} from '@mui/material';
import { Add, Delete, Save, Lock, Person, LocationOn, Category, Group as GroupIcon, NotificationsActive, Phone, PhotoCamera, Check, Business, Receipt, EditOutlined, Close, SmartToy, Article, MailOutline, WifiTethering, Send, MoreVert, StarOutlined, ContentCopy, Refresh, ExpandMore, ExpandLess, AlternateEmail, People, OpenInNew, SecurityOutlined, History, CloudDownload, PictureAsPdf, CheckBoxOutlineBlank } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Link, useSearch, useLocation } from 'wouter';
import { useTicketStatuses, type TicketStatus } from '../hooks/useTicketStatuses';
import { useQueryClient } from '@tanstack/react-query';
import ConsoleHistoryTab from './ConsoleHistoryTab';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
function TabPanel({ children, value, index }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
}

const NOTIF_TYPES = [
  'ticket_created',
  'ticket_status_changed',
  'ticket_commented',
  'ticket_assigned',
  'ticket_priority_changed',
  'system',
] as const;
type NotifType = typeof NOTIF_TYPES[number];

interface NotifPref { type: NotifType; inApp: boolean; browser: boolean; sound: boolean; email: boolean }

function NotificationPreferences() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [prefs, setPrefs] = useState<NotifPref[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testPushStatus, setTestPushStatus] = useState<'idle' | 'sending' | 'success' | 'error' | 'no-token'>('idle');

  const sendTestPush = async () => {
    setTestPushStatus('sending');
    try {
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.status === 400) {
        setTestPushStatus('no-token');
      } else if (res.ok) {
        setTestPushStatus('success');
      } else {
        setTestPushStatus('error');
      }
    } catch {
      setTestPushStatus('error');
    }
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/notification-preferences', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const merged: NotifPref[] = NOTIF_TYPES.map((type) => {
          const found = (data.preferences ?? []).find((p: any) => p.type === type);
          return found
            ? { type, inApp: !!found.inApp, browser: !!found.browser, sound: !!found.sound, email: found.email !== false }
            : { type, inApp: true, browser: true, sound: true, email: true };
        });
        setPrefs(merged);
      })
      .catch(() => mounted && setMsg({ type: 'error', text: t.settings.notifSaveError }))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [t]);

  const toggle = (type: NotifType, channel: 'inApp' | 'browser' | 'sound' | 'email') => {
    setPrefs((cur) => cur && cur.map((p) => p.type === type ? { ...p, [channel]: !p[channel] } : p));
  };

  const setAll = (value: boolean) => {
    setPrefs((cur) => cur && cur.map((p) => ({ ...p, inApp: value, browser: value, sound: value, email: value })));
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg({ type: 'success', text: t.settings.notifSavedOk });
      window.dispatchEvent(new CustomEvent('notif-prefs-updated'));
    } catch {
      setMsg({ type: 'error', text: t.settings.notifSaveError });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title={t.settings.notifPrefsTitle} icon={<NotificationsActive color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.notifPrefsNote}</Typography>
      {msg && (
        <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>
      )}
      {loading || !prefs ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
      ) : (
        <>
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={() => setAll(true)}>{t.settings.notifEnableAll}</Button>
            <Button size="small" variant="outlined" color="inherit" onClick={() => setAll(false)}>{t.settings.notifDisableAll}</Button>
          </Box>

          {isMobile ? (
            <Stack spacing={1.5}>
              {prefs.map((p) => (
                <Box
                  key={p.type}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5 }}
                >
                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    {(t.nav.notifTypes as any)[p.type] ?? p.type}
                  </Typography>
                  <Stack spacing={0.5}>
                    {([
                      { key: 'inApp' as const, label: t.settings.notifColInApp, hint: t.settings.notifInAppHint, disabled: false },
                      { key: 'browser' as const, label: t.settings.notifColBrowser, hint: t.settings.notifBrowserHint, disabled: !p.inApp },
                      { key: 'sound' as const, label: t.settings.notifColSound, hint: t.settings.notifSoundHint, disabled: !p.inApp },
                      { key: 'email' as const, label: t.settings.notifColEmail, hint: t.settings.notifEmailHint, disabled: false },
                    ]).map(({ key, label, disabled }) => (
                      <Box key={key} display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.primary'}>
                          {label}
                        </Typography>
                        <Switch
                          size="small"
                          checked={p[key]}
                          onChange={() => toggle(p.type, key)}
                          disabled={disabled}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t.settings.notifColType}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    <Tooltip title={t.settings.notifInAppHint}><span>{t.settings.notifColInApp}</span></Tooltip>
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    <Tooltip title={t.settings.notifBrowserHint}><span>{t.settings.notifColBrowser}</span></Tooltip>
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    <Tooltip title={t.settings.notifSoundHint}><span>{t.settings.notifColSound}</span></Tooltip>
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>
                    <Tooltip title={t.settings.notifEmailHint}><span>{t.settings.notifColEmail}</span></Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prefs.map((p) => (
                  <TableRow key={p.type} hover>
                    <TableCell>{(t.nav.notifTypes as any)[p.type] ?? p.type}</TableCell>
                    <TableCell align="center"><Switch size="small" checked={p.inApp} onChange={() => toggle(p.type, 'inApp')} /></TableCell>
                    <TableCell align="center"><Switch size="small" checked={p.browser} onChange={() => toggle(p.type, 'browser')} disabled={!p.inApp} /></TableCell>
                    <TableCell align="center"><Switch size="small" checked={p.sound} onChange={() => toggle(p.type, 'sound')} disabled={!p.inApp} /></TableCell>
                    <TableCell align="center"><Switch size="small" checked={p.email} onChange={() => toggle(p.type, 'email')} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Box display="flex" justifyContent="flex-end" mt={3}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={save}
              disabled={saving}
            >
              {saving ? t.settings.saving : t.settings.save}
            </Button>
          </Box>
        </>
      )}

      {isAdmin && (
        <>
          <Divider sx={{ my: 3 }} />
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Send fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>{t.settings.testPushTitle}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.testPushNote}</Typography>
            {testPushStatus === 'success' && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setTestPushStatus('idle')}>{t.settings.testPushSuccess}</Alert>
            )}
            {testPushStatus === 'error' && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTestPushStatus('idle')}>{t.settings.testPushError}</Alert>
            )}
            {testPushStatus === 'no-token' && (
              <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setTestPushStatus('idle')}>{t.settings.testPushNoToken}</Alert>
            )}
            <Button
              variant="outlined"
              startIcon={testPushStatus === 'sending' ? <CircularProgress size={16} color="inherit" /> : <Send />}
              onClick={sendTestPush}
              disabled={testPushStatus === 'sending'}
            >
              {testPushStatus === 'sending' ? t.settings.testPushSending : t.settings.testPushButton}
            </Button>
          </Box>
        </>
      )}
    </Section>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card sx={{ mb: 3 }} elevation={1}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {icon}
          <Typography variant="h6" fontWeight="bold">{title}</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function ListEditor({
  placeholder,
  items,
  onSave,
  saving,
}: {
  placeholder: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const [list, setList] = useState<string[]>(items);
  const [newItem, setNewItem] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => { setList(items); }, [items]);

  const triggerSave = useCallback(async (next: string[]) => {
    await onSave(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, [onSave]);

  const add = async () => {
    const trimmed = newItem.trim();
    if (!trimmed || list.includes(trimmed)) return;
    const next = [...list, trimmed];
    setList(next);
    setNewItem('');
    await triggerSave(next);
  };

  const remove = async (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    setList(next);
    await triggerSave(next);
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValue(list[idx]);
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditValue('');
  };

  const confirmEdit = async () => {
    if (editIdx === null) return;
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== list[editIdx] && list.includes(trimmed))) {
      cancelEdit();
      return;
    }
    const next = list.map((item, i) => (i === editIdx ? trimmed : item));
    setList(next);
    setEditIdx(null);
    setEditValue('');
    await triggerSave(next);
  };

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

  return (
    <Box>
      <List dense disablePadding>
        {list.map((item, idx) => (
          <ListItem key={idx} disableGutters divider sx={{ py: 0.5 }}>
            {editIdx === idx ? (
              <Box display="flex" flex={1} alignItems="center" gap={1}>
                <TextField
                  size="small"
                  fullWidth
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKey}
                  autoFocus
                  disabled={saving}
                />
                <IconButton size="small" color="primary" onClick={confirmEdit} disabled={!editValue.trim() || saving}>
                  <Check fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={cancelEdit} disabled={saving}>
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <>
                <ListItemText primary={item} />
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => startEdit(idx)} disabled={saving || editIdx !== null} sx={{ mr: 0.5 }}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                  <IconButton edge="end" size="small" onClick={() => remove(idx)} color="error" disabled={saving || editIdx !== null}>
                    <Delete fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </>
            )}
          </ListItem>
        ))}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{t.settings.noItems}</Typography>
        )}
      </List>

      <Box display="flex" gap={1} mt={2} alignItems="center">
        <TextField
          size="small"
          fullWidth
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving || editIdx !== null}
        />
        <Button variant="outlined" startIcon={<Add />} onClick={add} disabled={!newItem.trim() || saving || editIdx !== null}>
          {t.settings.addItem}
        </Button>
        {saving && <CircularProgress size={18} />}
        {!saving && savedFlash && <Check fontSize="small" color="success" />}
      </Box>
    </Box>
  );
}

function TicketStatusesTab() {
  const { t } = useLanguage();
  const ts = t.ticketStatuses;
  const queryClient = useQueryClient();
  const { statuses, isLoading } = useTicketStatuses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TicketStatus | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formColor, setFormColor] = useState('#1976d2');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formIsClosed, setFormIsClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TicketStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ticket-statuses'] });

  const openAdd = () => {
    setEditTarget(null);
    setFormLabel('');
    setFormColor('#1976d2');
    setFormIsDefault(false);
    setFormIsClosed(false);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (s: TicketStatus) => {
    setEditTarget(s);
    setFormLabel(s.label);
    setFormColor(s.color ?? '#1976d2');
    setFormIsDefault(s.isDefault);
    setFormIsClosed(s.isClosed);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) { setFormError(ts.errorRequired); return; }
    setSaving(true);
    setFormError(null);
    try {
      const body = { label: formLabel.trim(), color: formColor, isDefault: formIsDefault, isClosed: formIsClosed };
      const url = editTarget ? `/api/settings/ticket-statuses/${editTarget.id}` : '/api/settings/ticket-statuses';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setFormError(d.message || ts.errorSave); return; }
      invalidate();
      setDialogOpen(false);
      setMsg({ type: 'success', text: editTarget ? 'Salvato.' : 'Stato creato.' });
    } catch { setFormError(ts.errorSave); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/settings/ticket-statuses/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        if (d.ticketCount !== undefined) { setDeleteError(ts.deleteInUseError(d.ticketCount)); }
        else { setDeleteError(d.message || ts.errorDelete); }
        return;
      }
      invalidate();
      setDeleteTarget(null);
      setMsg({ type: 'success', text: 'Eliminato.' });
    } catch { setDeleteError(ts.errorDelete); }
    finally { setDeleting(false); }
  };

  const handleMove = async (id: number, direction: 'up' | 'down') => {
    const sorted = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s.id === id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = sorted.map((s, i) => {
      if (i === idx) return { id: s.id, sortOrder: sorted[swapIdx].sortOrder };
      if (i === swapIdx) return { id: s.id, sortOrder: sorted[idx].sortOrder };
      return { id: s.id, sortOrder: s.sortOrder };
    });
    try {
      await fetch('/api/settings/ticket-statuses/reorder', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      invalidate();
    } catch { setMsg({ type: 'error', text: ts.errorSave }); }
  };

  const sorted = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">{ts.title}</Typography>
          <Typography variant="body2" color="text.secondary">{ts.subtitle}</Typography>
        </Box>
        <Button startIcon={<Add />} variant="contained" size="small" onClick={openAdd}>{ts.addStatus}</Button>
      </Box>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : sorted.length === 0 ? (
        <Typography color="text.secondary">{ts.noStatuses}</Typography>
      ) : (
        <Stack spacing={1}>
          {sorted.map((s, idx) => (
            <Paper key={s.id} variant="outlined" sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: s.color ?? '#bbb', flexShrink: 0 }} />
              <Typography fontWeight={600} sx={{ flex: 1 }}>{s.label}</Typography>
              {s.isDefault && <Chip label={ts.defaultBadge} size="small" color="primary" />}
              {s.isClosed && <Chip label={ts.closedBadge} size="small" color="default" />}
              <Tooltip title={ts.moveUp}><span><IconButton size="small" onClick={() => handleMove(s.id, 'up')} disabled={idx === 0}><ExpandLess fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title={ts.moveDown}><span><IconButton size="small" onClick={() => handleMove(s.id, 'down')} disabled={idx === sorted.length - 1}><ExpandMore fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Modifica"><IconButton size="small" onClick={() => openEdit(s)}><EditOutlined fontSize="small" /></IconButton></Tooltip>
              <Tooltip title={ts.delete}><IconButton size="small" color="error" onClick={() => { setDeleteTarget(s); setDeleteError(null); }}><Delete fontSize="small" /></IconButton></Tooltip>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editTarget ? ts.editStatus : ts.addStatus}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label={ts.labelField}
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              size="small" fullWidth autoFocus
            />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{ts.colorField}</Typography>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: formColor, border: '1px solid', borderColor: 'divider' }} />
                <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} style={{ width: 36, height: 32, border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} />
                <Typography variant="caption" color="text.secondary">{formColor}</Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" fontWeight={500}>{ts.isDefaultField}</Typography>
                <Typography variant="caption" color="text.secondary">{ts.isDefaultHint}</Typography>
              </Box>
              <Switch checked={formIsDefault} onChange={(e) => setFormIsDefault(e.target.checked)} />
            </Box>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" fontWeight={500}>{ts.isClosedField}</Typography>
                <Typography variant="caption" color="text.secondary">{ts.isClosedHint}</Typography>
              </Box>
              <Switch checked={formIsClosed} onChange={(e) => setFormIsClosed(e.target.checked)} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{ts.cancel}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? ts.saving : ts.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{ts.deleteConfirmTitle}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
          <Typography>{deleteTarget ? ts.deleteConfirmText(deleteTarget.label) : ''}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{ts.cancel}</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? ts.deleting : ts.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BackupSection() {
  const { t } = useLanguage();
  const ts = t.settings as any;

  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [triggerStatus, setTriggerStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExportStatus('running');
    try {
      const res = await fetch('/api/backup/export', { credentials: 'include' });
      if (!res.ok) { setExportStatus('error'); return; }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? 'taskdesk-backup.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setExportStatus('idle');
    } catch {
      setExportStatus('error');
    }
  };

  const handleTrigger = async () => {
    setTriggerStatus('running');
    try {
      const res = await fetch('/api/backup/trigger', { method: 'POST', credentials: 'include' });
      setTriggerStatus(res.ok ? 'success' : 'error');
    } catch {
      setTriggerStatus('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
    e.target.value = '';
  };

  const handleRestoreConfirm = async () => {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setRestoreStatus('running');
    setRestoreMsg('');
    try {
      const text = await pendingFile.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) {
        setRestoreStatus('error');
        setRestoreMsg(data.error ?? ts.backupRestoreError);
      } else {
        setRestoreStatus('success');
        setRestoreMsg(
          ts.backupRestoreSuccess
            .replace('{tickets}', String(data.ticketsRestored))
            .replace('{clients}', String(data.clientsRestored))
            .replace('{comments}', String(data.commentsRestored))
            .replace('{notes}', String(data.notesRestored))
        );
      }
    } catch {
      setRestoreStatus('error');
      setRestoreMsg(ts.backupRestoreError);
    }
    setPendingFile(null);
  };

  return (
    <Section title={ts.backupSectionTitle} icon={<CloudDownload color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        🕑 {ts.backupScheduleNote}
      </Typography>

      {/* ── Export / Download ── */}
      <Box mb={3}>
        <Typography variant="subtitle2" gutterBottom>{ts.backupExportButton}</Typography>
        <Typography variant="body2" color="text.secondary" mb={1.5}>{ts.backupExportNote}</Typography>
        {exportStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setExportStatus('idle')}>{ts.backupError}</Alert>
        )}
        <Button
          variant="contained"
          startIcon={exportStatus === 'running' ? <CircularProgress size={16} color="inherit" /> : <CloudDownload />}
          onClick={handleExport}
          disabled={exportStatus === 'running'}
        >
          {exportStatus === 'running' ? ts.backupRunning : ts.backupExportButton}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ── Restore ── */}
      <Box mb={3}>
        <Typography variant="subtitle2" gutterBottom>{ts.backupRestoreButton}</Typography>
        <Typography variant="body2" color="text.secondary" mb={1.5}>{ts.backupRestoreNote}</Typography>
        {restoreStatus === 'success' && (
          <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setRestoreStatus('idle')}>{restoreMsg}</Alert>
        )}
        {restoreStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setRestoreStatus('idle')}>{restoreMsg || ts.backupRestoreError}</Alert>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <Button
          variant="outlined"
          color="warning"
          startIcon={restoreStatus === 'running' ? <CircularProgress size={16} color="inherit" /> : <CloudDownload />}
          onClick={() => fileInputRef.current?.click()}
          disabled={restoreStatus === 'running'}
        >
          {restoreStatus === 'running' ? ts.backupRestoreRunning : ts.backupRestoreButton}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ── Trigger cloud backup ── */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>{ts.backupButton}</Typography>
        <Typography variant="body2" color="text.secondary" mb={1.5}>{ts.backupSectionNote}</Typography>
        {triggerStatus === 'success' && (
          <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setTriggerStatus('idle')}>{ts.backupSuccess}</Alert>
        )}
        {triggerStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setTriggerStatus('idle')}>{ts.backupError}</Alert>
        )}
        <Button
          variant="outlined"
          startIcon={triggerStatus === 'running' ? <CircularProgress size={16} color="inherit" /> : <CloudDownload />}
          onClick={handleTrigger}
          disabled={triggerStatus === 'running'}
        >
          {triggerStatus === 'running' ? ts.backupRunning : ts.backupButton}
        </Button>
      </Box>

      {/* ── Confirm restore dialog ── */}
      <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setPendingFile(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{ts.backupRestoreDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{ts.backupRestoreDialogText}</Typography>
          {pendingFile && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {pendingFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmOpen(false); setPendingFile(null); }}>{ts.cancel}</Button>
          <Button onClick={handleRestoreConfirm} variant="contained" color="warning">{ts.backupRestoreConfirm}</Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { t, lang } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isAdmin = user?.role === 'admin';

  // URL-based section routing
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const urlSection = new URLSearchParams(rawSearch).get('section') ?? 'profile';
  const activeSection = !isAdmin && !['profile', 'notifications'].includes(urlSection) ? 'profile' : urlSection;
  const setSection = (s: string) => navigate(`/settings?section=${s}`);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState((user as any)?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string>((user as any)?.avatarUrl ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [defaultCatSaving, setDefaultCatSaving] = useState(false);
  const [locSaving, setLocSaving] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [orgName, setOrgName] = useState('');
  const [orgBusinessType, setOrgBusinessType] = useState((user as any)?.businessType ?? '');
  const [orgClientsEnabled, setOrgClientsEnabled] = useState<boolean>((user as any)?.clientsEnabled !== false);
  const [orgEntitySingular, setOrgEntitySingular] = useState((user as any)?.entitySingular ?? '');
  const [orgEntityPlural, setOrgEntityPlural] = useState((user as any)?.entityPlural ?? '');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [billing, setBilling] = useState({
    ragioneSociale: '', piva: '', codiceFiscale: '',
    indirizzo: '', cap: '', citta: '', provincia: '', paese: 'IT',
    sdiCode: '', pec: '',
  });
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setLocations(d.value ?? [])).catch(() => {});
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setCategories(d.value ?? [])).catch(() => {});
    fetch('/api/settings/default-category', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setDefaultCategory(d.value ?? '')).catch(() => {});
    fetch('/api/settings/organization', { credentials: 'include' })
      .then((r) => r.json()).then((d) => {
        setOrgName(d.name ?? '');
        if (d.businessType) setOrgBusinessType(d.businessType);
        setOrgClientsEnabled(d.clientsEnabled !== false);
        setOrgEntitySingular(d.entitySingular ?? '');
        setOrgEntityPlural(d.entityPlural ?? '');
      }).catch(() => {});
    fetch('/api/settings/billing', { credentials: 'include' })
      .then((r) => r.json()).then((d) => {
        if (d && !d.error) setBilling({
          ragioneSociale: d.ragioneSociale ?? '',
          piva: d.piva ?? '',
          codiceFiscale: d.codiceFiscale ?? '',
          indirizzo: d.indirizzo ?? '',
          cap: d.cap ?? '',
          citta: d.citta ?? '',
          provincia: d.provincia ?? '',
          paese: d.paese ?? 'IT',
          sdiCode: d.sdiCode ?? '',
          pec: d.pec ?? '',
        });
      }).catch(() => {});
  }, [isAdmin]);

  const saveBilling = async () => {
    setBillingSaving(true);
    setBillingMsg(null);
    try {
      const res = await fetch('/api/settings/billing', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billing),
      });
      const data = await res.json();
      if (!res.ok) { setBillingMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setBillingMsg({ type: 'success', text: 'Dati di fatturazione salvati e sincronizzati con Stripe.' });
    } catch {
      setBillingMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setBillingSaving(false);
    }
  };

  const saveOrgName = async () => {
    if (orgName.trim().length < 2) return;
    setOrgSaving(true);
    setOrgMsg(null);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          businessType: orgBusinessType || undefined,
          clientsEnabled: orgClientsEnabled,
          entitySingular: orgEntitySingular || undefined,
          entityPlural: orgEntityPlural || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setOrgMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setOrgName(data.name);
      if (data.businessType !== undefined) setOrgBusinessType(data.businessType ?? '');
      if (data.clientsEnabled !== undefined) setOrgClientsEnabled(data.clientsEnabled !== false);
      updateUser({
        ...(user as any),
        businessType: data.businessType ?? null,
        clientsEnabled: data.clientsEnabled !== undefined ? data.clientsEnabled : (user as any)?.clientsEnabled,
        entitySingular: data.entitySingular ?? null,
        entityPlural: data.entityPlural ?? null,
      });
      setOrgMsg({ type: 'success', text: t.settings.orgSavedOk });
    } catch {
      setOrgMsg({ type: 'error', text: t.settings.orgSaveError });
    } finally {
      setOrgSaving(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_BYTES = 1.4 * 1024 * 1024;
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX_DIM = 1024;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length * 0.75 > MAX_BYTES) {
          reject(new Error('Impossibile comprimere ulteriormente l\'immagine.'));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Errore caricamento immagine.')); };
      img.src = objectUrl;
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Immagine troppo grande. Massimo 10 MB.' });
      return;
    }
    try {
      const compressed = await compressImage(file);
      const wasCompressed = file.size > 1.5 * 1024 * 1024;
      setAvatarUrl(compressed);
      if (wasCompressed) {
        setProfileMsg({ type: 'success', text: 'Immagine compressa automaticamente.' });
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Errore durante la compressione.' });
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || null, avatarUrl: avatarUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) { setProfileMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      if (data.user) updateUser(data.user);
      setProfileMsg({ type: 'success', text: 'Profilo aggiornato con successo.' });
    } catch {
      setProfileMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Le nuove password non coincidono.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'La password deve essere di almeno 6 caratteri.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setPwMsg({ type: 'success', text: 'Password cambiata con successo.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch {
      setPwMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setPwSaving(false);
    }
  };

  const saveLocations = async (list: string[]) => {
    setLocSaving(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/settings/locations', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: list }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setLocations(data.value);
    } catch {
      setAdminMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setLocSaving(false);
    }
  };

  const saveCategories = async (list: string[]) => {
    setCatSaving(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: list }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      const sorted = [...(data.value as string[])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      setCategories(sorted);
      if (defaultCategory && !sorted.includes(defaultCategory)) {
        setDefaultCategory('');
      }
    } catch {
      setAdminMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setCatSaving(false);
    }
  };

  const saveDefaultCategory = async (val: string) => {
    setDefaultCatSaving(true);
    try {
      const res = await fetch('/api/settings/default-category', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val || null }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setDefaultCategory(data.value ?? '');
    } catch {
      setAdminMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setDefaultCatSaving(false);
    }
  };

  // Sidebar navigation items
  const personalNav = [
    { id: 'profile', label: t.settings.navProfile, icon: <Person fontSize="small" /> },
    { id: 'notifications', label: t.settings.navNotifications, icon: <NotificationsActive fontSize="small" /> },
  ];
  const orgNav = [
    { id: 'general', label: t.settings.navGeneral, icon: <Business fontSize="small" /> },
    { id: 'users', label: t.settings.navUsers, icon: <People fontSize="small" /> },
    { id: 'tickets', label: t.settings.navTickets, icon: <Category fontSize="small" /> },
    { id: 'email', label: t.settings.navEmail, icon: <MailOutline fontSize="small" /> },
    { id: 'knowledge', label: t.settings.navKnowledge, icon: <SmartToy fontSize="small" /> },
    { id: 'billing', label: t.settings.navBilling, icon: <Receipt fontSize="small" /> },
    { id: 'console', label: (t.settings as any).navConsole, icon: <History fontSize="small" /> },
    { id: 'backup', label: (t.settings as any).navBackup, icon: <CloudDownload fontSize="small" /> },
  ];

  const renderSidebarItem = (item: { id: string; label: string; icon: React.ReactNode }) => {
    const active = activeSection === item.id;
    return (
      <Box
        key={item.id}
        onClick={() => setSection(item.id)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25,
          px: 1.5, py: 0.875, mb: 0.25, borderRadius: 1.5, cursor: 'pointer',
          bgcolor: active ? 'action.selected' : 'transparent',
          color: active ? 'primary.main' : 'text.primary',
          borderLeft: '2px solid',
          borderLeftColor: active ? 'primary.main' : 'transparent',
          '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' },
          transition: 'all 0.15s',
        }}
      >
        <Box sx={{ color: active ? 'primary.main' : 'text.secondary', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {item.icon}
        </Box>
        <Typography variant="body2" fontWeight={active ? 600 : 400} sx={{ color: 'inherit' }}>
          {item.label}
        </Typography>
      </Box>
    );
  };

  return (
    <Box maxWidth={1000} mx="auto">
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={3}>
        {t.settings.title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {/* ── SIDEBAR (desktop only) ── */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          pr: 1,
          mr: 3,
          pt: 0.5,
          position: 'sticky',
          top: 72,
          alignSelf: 'flex-start',
        }}>
          <Typography variant="overline" color="text.disabled" sx={{ px: 1.5, mb: 0.5, display: 'block', fontWeight: 700, letterSpacing: 1, fontSize: '0.65rem' }}>
            {t.settings.sidebarPersonal}
          </Typography>
          {personalNav.map(renderSidebarItem)}

          {isAdmin && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="overline" color="text.disabled" sx={{ px: 1.5, mb: 0.5, display: 'block', fontWeight: 700, letterSpacing: 1, fontSize: '0.65rem' }}>
                {t.settings.sidebarOrganization}
              </Typography>
              {orgNav.map(renderSidebarItem)}
            </>
          )}
        </Box>

        {/* ── CONTENT AREA ── */}
        <Box flex={1} minWidth={0} sx={{ width: { xs: '100%', md: 'auto' } }}>
          {/* Mobile: Select dropdown */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              value={activeSection}
              onChange={(e) => setSection(e.target.value)}
            >
              <MenuItem disabled sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.disabled', opacity: '1 !important', py: 0.5 }}>
                — {t.settings.sidebarPersonal} —
              </MenuItem>
              {personalNav.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
              ))}
              {isAdmin && [
                <MenuItem key="__div_org" disabled sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.disabled', opacity: '1 !important', py: 0.5 }}>
                  — {t.settings.sidebarOrganization} —
                </MenuItem>,
                ...orgNav.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
                )),
              ]}
            </TextField>
          </Box>

          {/* ── PROFILE & SECURITY ── */}
          {activeSection === 'profile' && (
            <>
              <Section title={t.settings.personalData} icon={<Person color="primary" />}>
                {profileMsg && (
                  <Alert severity={profileMsg.type} sx={{ mb: 2 }} onClose={() => setProfileMsg(null)}>
                    {profileMsg.text}
                  </Alert>
                )}
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Box position="relative">
                    <Avatar src={avatarUrl || undefined} sx={{ width: 72, height: 72, fontSize: 28 }}>
                      {!avatarUrl && (user?.name?.[0] ?? '?').toUpperCase()}
                    </Avatar>
                    <IconButton
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'primary.main', color: 'white', width: 26, height: 26, '&:hover': { bgcolor: 'primary.dark' } }}
                    >
                      <PhotoCamera sx={{ fontSize: 14 }} />
                    </IconButton>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{user?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.settings.clickIconToChangePhoto}</Typography>
                    {avatarUrl && (
                      <Box mt={0.5}>
                        <Button size="small" color="error" sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }} onClick={() => setAvatarUrl('')}>
                          {t.settings.removePhoto}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField label={t.settings.name} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                  <TextField label={t.settings.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                  <TextField
                    label="Numero di cellulare"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                    placeholder="Es: +39 333 1234567"
                    InputProps={{ startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                  />
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip size="small" label={user?.role === 'admin' ? t.role.admin : t.role.user} color={user?.role === 'admin' ? 'secondary' : 'default'} variant="outlined" />
                    <Typography variant="caption" color="text.secondary">{t.settings.roleNote}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="flex-end">
                    <Button variant="contained" startIcon={profileSaving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={saveProfile} disabled={profileSaving}>
                      {profileSaving ? t.settings.saving : t.settings.save}
                    </Button>
                  </Box>
                </Box>
              </Section>

              <Section title={t.settings.changePassword} icon={<Lock color="primary" />}>
                {pwMsg && (
                  <Alert severity={pwMsg.type} sx={{ mb: 2 }} onClose={() => setPwMsg(null)}>{pwMsg.text}</Alert>
                )}
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField label={t.settings.currentPassword} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} fullWidth autoComplete="current-password" />
                  <TextField label={t.settings.newPassword} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth autoComplete="new-password" helperText={t.settings.passwordHint} />
                  <TextField
                    label={t.settings.confirmNewPassword}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                    error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                    helperText={confirmPassword.length > 0 && newPassword !== confirmPassword ? t.settings.passwordMismatch : ''}
                  />
                  <Box display="flex" justifyContent="flex-end">
                    <Button variant="contained" startIcon={pwSaving ? <CircularProgress size={16} color="inherit" /> : <Lock />} onClick={savePassword} disabled={pwSaving || !currentPassword || !newPassword}>
                      {pwSaving ? t.settings.saving : t.settings.changePasswordBtn}
                    </Button>
                  </Box>
                </Box>
              </Section>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === 'notifications' && <NotificationPreferences />}

          {/* ── GENERAL (admin) ── */}
          {isAdmin && activeSection === 'general' && (
            <Section title={t.settings.orgNameTitle} icon={<Business color="primary" />}>
              <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.orgNameNote}</Typography>
              {orgMsg && <Alert severity={orgMsg.type} sx={{ mb: 2 }} onClose={() => setOrgMsg(null)}>{orgMsg.text}</Alert>}
              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" gap={2} alignItems="flex-start">
                  <TextField
                    size="small" fullWidth label={t.settings.orgNameLabel} value={orgName}
                    onChange={(e) => setOrgName(e.target.value)} disabled={orgSaving} inputProps={{ maxLength: 100 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={orgSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                    onClick={saveOrgName}
                    disabled={orgSaving || orgName.trim().length < 2}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {orgSaving ? t.settings.saving : t.settings.save}
                  </Button>
                </Box>
                <Box sx={{ maxWidth: 340 }}>
                  <TextField
                    select size="small" fullWidth label={t.settings.orgBusinessTypeLabel}
                    value={orgBusinessType} onChange={(e) => setOrgBusinessType(e.target.value)}
                    disabled={orgSaving} helperText={t.settings.orgBusinessTypeHint}
                  >
                    <MenuItem value="">{t.settings.orgBusinessTypeNone}</MenuItem>
                    {(t.settings.orgBusinessTypeOptions as { value: string; label: string }[]).map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                  {orgBusinessType && orgBusinessType !== '' && (() => {
                    const st = t.settings as any;
                    const suggestions: string[] = st.orgEntitySuggestionsMap?.[orgBusinessType] ?? [];
                    const suggestionsPlural: string[] = st.orgEntitySuggestionsPlural?.[orgBusinessType] ?? [];
                    const et = (t.entityTerms as Record<string, any>)[orgBusinessType];
                    const previewSingular = orgEntitySingular.trim() || et?.singular || '';
                    const previewPlural = orgEntityPlural.trim() || et?.plural || '';
                    return (
                      <Box display="flex" flexDirection="column" gap={1} mt={1.5}>
                        <Typography variant="caption" color="text.secondary">{st.orgEntityCustomHint}</Typography>
                        {suggestions.length > 0 && (
                          <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>{st.orgEntitySuggestions}</Typography>
                            {suggestions.map((s: string, i: number) => (
                              <Chip
                                key={s}
                                label={s}
                                size="small"
                                variant={orgEntitySingular.trim() === s ? 'filled' : 'outlined'}
                                color={orgEntitySingular.trim() === s ? 'primary' : 'default'}
                                clickable
                                onClick={() => {
                                  setOrgEntitySingular(s);
                                  if (suggestionsPlural[i]) setOrgEntityPlural(suggestionsPlural[i]);
                                }}
                                sx={{ height: 22, fontSize: '0.75rem', cursor: 'pointer' }}
                              />
                            ))}
                          </Box>
                        )}
                        <TextField
                          size="small" fullWidth
                          label={st.orgEntitySingularLabel}
                          placeholder={st.orgEntitySingularPlaceholder}
                          value={orgEntitySingular}
                          onChange={(e) => setOrgEntitySingular(e.target.value)}
                          disabled={orgSaving}
                          inputProps={{ maxLength: 40 }}
                        />
                        <TextField
                          size="small" fullWidth
                          label={st.orgEntityPluralLabel}
                          placeholder={st.orgEntityPluralPlaceholder}
                          value={orgEntityPlural}
                          onChange={(e) => setOrgEntityPlural(e.target.value)}
                          disabled={orgSaving}
                          inputProps={{ maxLength: 40 }}
                        />
                        {(previewSingular || previewPlural) && (
                          <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary">{t.settings.orgBusinessTypePreviewLabel}</Typography>
                            {previewSingular && <Chip label={previewSingular} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.75rem' }} />}
                            {previewPlural && previewPlural !== previewSingular && <Chip label={previewPlural} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.75rem', color: 'text.secondary' }} />}
                          </Box>
                        )}
                      </Box>
                    );
                  })()}
                </Box>
                <Box display="flex" flexDirection="column" gap={1} mt={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Switch checked={orgClientsEnabled} onChange={(e) => setOrgClientsEnabled(e.target.checked)} disabled={orgSaving} size="small" />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{t.settings.orgClientsEnabledLabel}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.settings.orgClientsEnabledHint}</Typography>
                    </Box>
                  </Box>
                  {!orgClientsEnabled && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>{t.settings.orgClientsDisabledWarning}</Alert>
                  )}
                </Box>
              </Box>
            </Section>
          )}

          {/* ── USERS & GROUPS (admin) ── */}
          {isAdmin && activeSection === 'users' && (
            <>
              <Section title={t.settings.manageUsersLink} icon={<People color="primary" />}>
                <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.manageUsersLinkHint}</Typography>
                <Link href="/users" style={{ textDecoration: 'none' }}>
                  <Button variant="outlined" startIcon={<OpenInNew fontSize="small" />}>{t.settings.manageUsersLink}</Button>
                </Link>
              </Section>
              {((user as any)?.clientsEnabled !== false) && (
                <Section title={t.settings.manageClientsLink} icon={<Business color="primary" />}>
                  <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.manageClientsLinkHint}</Typography>
                  <Link href="/clients" style={{ textDecoration: 'none' }}>
                    <Button variant="outlined" startIcon={<OpenInNew fontSize="small" />}>{t.settings.manageClientsLink}</Button>
                  </Link>
                </Section>
              )}
              <GroupsManagementTab />
            </>
          )}

          {/* ── TICKETS (admin) ── */}
          {isAdmin && activeSection === 'tickets' && (
            <>
              <TicketStatusesTab />
              <Box mt={4} />
              {adminMsg && <Alert severity={adminMsg.type} sx={{ mb: 2 }} onClose={() => setAdminMsg(null)}>{adminMsg.text}</Alert>}
              <Section title={t.settings.manageLocations} icon={<LocationOn color="primary" />}>
                <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.locationsNote}</Typography>
                <ListEditor placeholder={t.settings.addLocationPlaceholder} items={locations} onSave={saveLocations} saving={locSaving} />
              </Section>
              <Section title={t.settings.manageCategories} icon={<Category color="primary" />}>
                <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.categoriesNote}</Typography>
                <ListEditor placeholder={t.settings.addCategoryPlaceholder} items={categories} onSave={saveCategories} saving={catSaving} />
                {categories.length > 0 && (
                  <Box mt={3} display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <TextField
                      select
                      size="small"
                      label={t.settings.defaultCategoryLabel}
                      value={defaultCategory}
                      onChange={(e) => saveDefaultCategory(e.target.value)}
                      disabled={defaultCatSaving}
                      sx={{ minWidth: 220 }}
                      helperText={t.settings.defaultCategoryHint}
                    >
                      <MenuItem value=""><em>{t.settings.defaultCategoryNone}</em></MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </TextField>
                    {defaultCatSaving && <CircularProgress size={18} />}
                  </Box>
                )}
              </Section>
              <Box mt={4} />
              <InboundAddressesSection />
            </>
          )}

          {/* ── EMAIL & CHANNELS (admin) ── */}
          {isAdmin && activeSection === 'email' && (
            <EmailChannelsTab />
          )}

          {/* ── KNOWLEDGE BASE (admin) ── */}
          {isAdmin && activeSection === 'knowledge' && <KnowledgeBaseTab />}

          {/* ── CONSOLE LOG (admin) ── */}
          {isAdmin && activeSection === 'console' && <ConsoleHistoryTab />}

          {/* ── BACKUP (admin) ── */}
          {isAdmin && activeSection === 'backup' && <BackupSection />}

          {/* ── BILLING (admin) ── */}
          {isAdmin && activeSection === 'billing' && (
            <>
              <Section title={t.settings.subscriptionSectionTitle} icon={<Receipt color="primary" />}>
                <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.subscriptionSectionNote}</Typography>
                <Link href="/billing" style={{ textDecoration: 'none' }}>
                  <Button variant="contained" startIcon={<OpenInNew fontSize="small" />}>{t.settings.goToSubscription}</Button>
                </Link>
              </Section>
              <Section title={t.settings.billingTitle} icon={<Receipt color="primary" />}>
                <Typography variant="body2" color="text.secondary" mb={2}>{t.settings.billingNote}</Typography>
                {billingMsg && <Alert severity={billingMsg.type} sx={{ mb: 2 }} onClose={() => setBillingMsg(null)}>{billingMsg.text}</Alert>}
                <Box display="flex" flexDirection="column" gap={2}>
                  <TextField size="small" fullWidth label={t.settings.billingRagioneSociale} value={billing.ragioneSociale}
                    onChange={(e) => setBilling((b) => ({ ...b, ragioneSociale: e.target.value }))} disabled={billingSaving} />
                  <Box display="flex" gap={2}>
                    <TextField size="small" fullWidth label={t.settings.billingPiva} value={billing.piva}
                      onChange={(e) => setBilling((b) => ({ ...b, piva: e.target.value }))} disabled={billingSaving} placeholder="IT12345678901" />
                    <TextField size="small" fullWidth label={t.settings.billingCodFiscale} value={billing.codiceFiscale}
                      onChange={(e) => setBilling((b) => ({ ...b, codiceFiscale: e.target.value }))} disabled={billingSaving} />
                  </Box>
                  <TextField size="small" fullWidth label={t.settings.billingIndirizzo} value={billing.indirizzo}
                    onChange={(e) => setBilling((b) => ({ ...b, indirizzo: e.target.value }))} disabled={billingSaving} />
                  <Box display="flex" gap={2}>
                    <TextField size="small" label={t.settings.billingCap} value={billing.cap} sx={{ width: 120 }}
                      onChange={(e) => setBilling((b) => ({ ...b, cap: e.target.value }))} disabled={billingSaving} />
                    <TextField size="small" fullWidth label={t.settings.billingCitta} value={billing.citta}
                      onChange={(e) => setBilling((b) => ({ ...b, citta: e.target.value }))} disabled={billingSaving} />
                    <TextField size="small" label={t.settings.billingProv} value={billing.provincia} sx={{ width: 90 }}
                      onChange={(e) => setBilling((b) => ({ ...b, provincia: e.target.value }))} disabled={billingSaving}
                      inputProps={{ maxLength: 2 }} placeholder="PE" />
                  </Box>
                  <Divider />
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{t.settings.billingElectronic}</Typography>
                  <Box display="flex" gap={2}>
                    <TextField size="small" fullWidth label={t.settings.billingSdi} value={billing.sdiCode}
                      onChange={(e) => setBilling((b) => ({ ...b, sdiCode: e.target.value }))} disabled={billingSaving}
                      placeholder="7 caratteri" inputProps={{ maxLength: 7 }} />
                    <TextField size="small" fullWidth label={t.settings.billingPec} type="email" value={billing.pec}
                      onChange={(e) => setBilling((b) => ({ ...b, pec: e.target.value }))} disabled={billingSaving}
                      placeholder="azienda@pec.it" />
                  </Box>
                  <Box display="flex" justifyContent="flex-end">
                    <Button variant="contained" startIcon={billingSaving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={saveBilling} disabled={billingSaving}>
                      {billingSaving ? t.settings.saving : t.settings.saveSyncStripe}
                    </Button>
                  </Box>
                </Box>
              </Section>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

const SMTP_PRESETS = [
  { label: 'Aruba', host: 'smtp.aruba.it', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'Register.it', host: 'smtp.register.it', port: 465, secure: true, appPwd: false, pwdLink: '' },
  { label: 'Netsons', host: 'smtp.netsons.com', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'Keliweb', host: 'smtp.keliweb.it', port: 465, secure: true, appPwd: false, pwdLink: '' },
  { label: 'Serverplan', host: 'smtp.serverplan.com', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'Seeweb', host: 'smtp.seeweb.it', port: 465, secure: true, appPwd: false, pwdLink: '' },
  { label: 'OVH', host: 'ssl0.ovh.net', port: 465, secure: true, appPwd: false, pwdLink: '' },
  { label: 'Ionos / 1&1', host: 'smtp.ionos.it', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'GoDaddy', host: 'smtpout.secureserver.net', port: 465, secure: true, appPwd: false, pwdLink: '' },
  { label: 'Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false, appPwd: true, pwdLink: 'https://myaccount.google.com/apppasswords' },
  { label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false, appPwd: false, pwdLink: '' },
  { label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, secure: false, appPwd: false, pwdLink: '' },
];

// ── EMAIL CHANNELS TAB ────────────────────────────────────────────────────

interface InboundChannel {
  id: number;
  label: string;
  token: string;
  slug: string | null;
  defaultCategory: string | null;
  defaultGroup: string | null;
  defaultAssignee: number | null;
  enabled: boolean;
}

interface SimpleUser {
  id: number;
  name: string;
  email: string;
}

function InboundAddressesSection() {
  const { t, lang } = useLanguage();
  const [channels, setChannels] = useState<InboundChannel[]>([]);
  const [domain, setDomain] = useState('inbound.taskdesk.it');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InboundChannel | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formGroup, setFormGroup] = useState('');
  const [formAssignee, setFormAssignee] = useState<number | ''>('');
  const [formSlug, setFormSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<InboundChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [confirmRegen, setConfirmRegen] = useState<InboundChannel | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; channel: InboundChannel } | null>(null);

  const fullAddress = (ch: InboundChannel) => ch.slug ? `${ch.slug}@${domain}` : `tickets-${ch.token}@${domain}`;

  const load = async () => {
    try {
      const res = await fetch('/api/settings/inbound-channels', { credentials: 'include' });
      const data = await res.json();
      setChannels(data.channels ?? []);
      if (data.domain) setDomain(data.domain);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    fetch('/api/settings/categories', { credentials: 'include' }).then(r => r.json()).then(d => setCategories(d.value ?? [])).catch(() => {});
    fetch('/api/settings/groups', { credentials: 'include' }).then(r => r.json()).then(d => setGroups(d.value ?? [])).catch(() => {});
    fetch('/api/users', { credentials: 'include' }).then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : (d.users ?? []))).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditTarget(null); setFormLabel(''); setFormCategory(''); setFormGroup(''); setFormAssignee(''); setFormSlug(''); setSlugError('');
    setMenuAnchor(null); setDialogOpen(true);
  };
  const openEdit = (ch: InboundChannel) => {
    setEditTarget(ch); setFormLabel(ch.label);
    setFormCategory(ch.defaultCategory ?? ''); setFormGroup(ch.defaultGroup ?? '');
    setFormAssignee(ch.defaultAssignee ?? ''); setFormSlug(ch.slug ?? ''); setSlugError('');
    setMenuAnchor(null); setDialogOpen(true);
  };

  const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$|^[a-z0-9]{3}$/;
  const handleSave = async () => {
    const cleanSlug = formSlug.trim().toLowerCase();
    if (cleanSlug && !SLUG_RE.test(cleanSlug)) {
      setSlugError(t.settings.inboundSlugError);
      return;
    }
    setSlugError('');
    setSaving(true); setMsg(null);
    try {
      const url = editTarget ? `/api/settings/inbound-channels/${editTarget.id}` : '/api/settings/inbound-channels';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: formLabel, defaultCategory: formCategory || null, defaultGroup: formGroup || null, defaultAssignee: formAssignee || null, slug: cleanSlug || null }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.message || t.settings.inboundAddressError }); return; }
      setMsg({ type: 'success', text: t.settings.inboundAddressSaved });
      setDialogOpen(false);
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.inboundAddressError }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/settings/inbound-channels/${confirmDelete.id}`, { method: 'DELETE', credentials: 'include' });
      setMsg({ type: 'success', text: t.settings.inboundAddressDeleted });
      setConfirmDelete(null);
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.inboundAddressError }); }
    finally { setDeleting(false); }
  };

  const handleToggle = async (ch: InboundChannel) => {
    setMenuAnchor(null);
    try {
      await fetch(`/api/settings/inbound-channels/${ch.id}/toggle`, { method: 'PUT', credentials: 'include' });
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.inboundAddressError }); }
  };

  const handleRegen = async () => {
    if (!confirmRegen) return;
    setRegenerating(true);
    try {
      await fetch(`/api/settings/inbound-channels/${confirmRegen.id}/regenerate-token`, { method: 'POST', credentials: 'include' });
      setConfirmRegen(null);
      setMsg({ type: 'success', text: t.settings.inboundAddressRegeneratedMsg });
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.inboundAddressError }); }
    finally { setRegenerating(false); }
  };

  const copyAddress = (ch: InboundChannel) => {
    navigator.clipboard.writeText(fullAddress(ch)).then(() => {
      setCopiedId(ch.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  if (loading) return null;

  return (
    <>
      <Section title={t.settings.inboundAddresses} icon={<AlternateEmail color="primary" />}>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t.settings.inboundAddressesNote}
        </Typography>

        {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

        {channels.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1, mb: 2 }}>{t.settings.inboundAddressEmpty}</Typography>
        ) : (
          <Stack spacing={1.5} mb={3}>
            {channels.map((ch) => (
              <Paper key={ch.id} variant="outlined" sx={{ borderRadius: 2, p: 2, opacity: ch.enabled ? 1 : 0.65 }}>
                <Box display="flex" alignItems="flex-start" gap={1.5}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'success.light', color: 'success.dark', flexShrink: 0 }}>
                    <AlternateEmail sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight={700}>{ch.label}</Typography>
                      <Chip label={ch.enabled ? t.settings.channelEnabled : t.settings.channelDisabled}
                        size="small" color={ch.enabled ? 'success' : 'default'} variant="outlined"
                        sx={{ height: 18, fontSize: '0.65rem' }} />
                      {ch.defaultCategory && (
                        <Chip label={ch.defaultCategory} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                      {ch.defaultGroup && (
                        <Chip label={ch.defaultGroup} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                      {ch.defaultAssignee && (() => {
                        const u = users.find(x => x.id === ch.defaultAssignee);
                        return u ? <Chip label={u.name} size="small" variant="outlined" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} /> : null;
                      })()}
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary"
                        sx={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                        {fullAddress(ch)}
                      </Typography>
                      <Tooltip title={copiedId === ch.id ? t.settings.inboundAddressCopied : t.settings.inboundAddressCopy}>
                        <IconButton size="small" onClick={() => copyAddress(ch)} sx={{ p: 0.25 }}>
                          {copiedId === ch.id
                            ? <Check sx={{ fontSize: 14 }} color="success" />
                            : <ContentCopy sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box mt={0.75}>
                      <Button size="small" variant="text"
                        sx={{ p: 0, fontSize: '0.72rem', color: 'text.secondary', minWidth: 0 }}
                        startIcon={expandedId === ch.id
                          ? <ExpandLess sx={{ fontSize: 14 }} />
                          : <ExpandMore sx={{ fontSize: 14 }} />}
                        onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}>
                        {t.settings.inboundSetupTitle}
                      </Button>
                      {expandedId === ch.id && (
                        <Box mt={1} p={1.5} sx={{ bgcolor: 'action.hover', borderRadius: 1.5 }}>
                          <Typography variant="caption" display="block" mb={1} color="text.secondary">
                            {t.settings.inboundSetupNote}
                          </Typography>
                          {[
                            { label: 'Gmail', text: t.settings.inboundSetupGmail },
                            { label: 'Outlook', text: t.settings.inboundSetupOutlook },
                            { label: lang === 'it' ? 'Altri provider' : 'Other providers', text: t.settings.inboundSetupGeneric },
                          ].map((item) => (
                            <Box key={item.label} mb={0.75}>
                              <Typography variant="caption" fontWeight={700} display="block">{item.label}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.text}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={(e) => setMenuAnchor({ el: e.currentTarget, channel: ch })} sx={{ flexShrink: 0 }}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}

        <Box>
          <Button variant="outlined" size="small" startIcon={<Add fontSize="small" />} onClick={openAdd}>
            {t.settings.addInboundAddress}
          </Button>
        </Box>

        {/* Context menu */}
        {menuAnchor && (
          <Paper component="div" elevation={3} sx={{
            position: 'fixed', zIndex: 1400, minWidth: 200, borderRadius: 2, overflow: 'hidden', py: 0.5,
            top: menuAnchor.el.getBoundingClientRect().bottom + 4,
            left: Math.min(menuAnchor.el.getBoundingClientRect().left, window.innerWidth - 210),
          }}>
            <MenuItem dense onClick={() => openEdit(menuAnchor.channel)} sx={{ gap: 1.5 }}>
              <EditOutlined fontSize="small" color="action" />
              <Typography variant="body2">{t.settings.editChannel}</Typography>
            </MenuItem>
            <MenuItem dense onClick={() => { setMenuAnchor(null); setConfirmRegen(menuAnchor.channel); }} sx={{ gap: 1.5 }}>
              <Refresh fontSize="small" color="action" />
              <Typography variant="body2">{t.settings.inboundAddressRegenerate}</Typography>
            </MenuItem>
            <MenuItem dense onClick={() => handleToggle(menuAnchor.channel)} sx={{ gap: 1.5 }}>
              <Box sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: menuAnchor.channel.enabled ? 'text.disabled' : 'success.main' }} />
              </Box>
              <Typography variant="body2">{menuAnchor.channel.enabled ? t.settings.channelDisabled : t.settings.channelEnabled}</Typography>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem dense onClick={() => { setMenuAnchor(null); setConfirmDelete(menuAnchor.channel); }} sx={{ gap: 1.5, color: 'error.main' }}>
              <Delete fontSize="small" color="error" />
              <Typography variant="body2" color="error">{t.settings.deleteChannel}</Typography>
            </MenuItem>
          </Paper>
        )}
        {menuAnchor && <Box sx={{ position: 'fixed', inset: 0, zIndex: 1399 }} onClick={() => setMenuAnchor(null)} />}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ pb: 1 }}>
            {editTarget ? t.settings.inboundAddressEditTitle : t.settings.inboundAddressAddTitle}
          </DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              <TextField label={t.settings.inboundAddressLabel} size="small" fullWidth
                placeholder={t.settings.inboundAddressLabelPlaceholder}
                value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
              <TextField label={t.settings.inboundSlugLabel} size="small" fullWidth
                placeholder={t.settings.inboundSlugPlaceholder}
                value={formSlug}
                error={!!slugError}
                helperText={slugError || t.settings.inboundSlugHelper.replace('{slug}', formSlug.trim() || 'support_acme').replace('{domain}', domain)}
                onChange={(e) => { setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); setSlugError(''); }}
                inputProps={{ maxLength: 40 }}
              />
              <TextField select label={t.settings.imapRoutingCategory} value={formCategory} size="small" fullWidth
                helperText={t.settings.imapRoutingCategoryHint}
                onChange={(e) => setFormCategory(e.target.value)}>
                <MenuItem value="">{t.settings.imapRoutingNone}</MenuItem>
                {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField select label={t.settings.imapRoutingGroup} value={formGroup} size="small" fullWidth
                helperText={t.settings.imapRoutingGroupHint}
                onChange={(e) => setFormGroup(e.target.value)}>
                <MenuItem value="">{t.settings.imapRoutingNone}</MenuItem>
                {groups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
              <TextField select label={t.settings.inboundDefaultAssignee} value={formAssignee} size="small" fullWidth
                helperText={t.settings.inboundDefaultAssigneeHint}
                onChange={(e) => setFormAssignee(e.target.value === '' ? '' : Number(e.target.value))}>
                <MenuItem value="">{t.settings.imapRoutingNone}</MenuItem>
                {users.filter(u => u.id).map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.name} ({u.email})</MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>{t.settings.kbCancel}</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !formLabel.trim()}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}>
              {saving ? t.settings.saving : t.settings.kbSave}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle>{t.settings.deleteChannel}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{t.settings.inboundAddressDeleteConfirm}</Typography>
            {confirmDelete && <Typography variant="body2" fontWeight={600} mt={1}>"{confirmDelete.label}"</Typography>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmDelete(null)} disabled={deleting}>{t.settings.kbCancel}</Button>
            <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Delete />}>
              {deleting ? t.settings.saving : t.settings.kbDeleteAction}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Regenerate token confirm */}
        <Dialog open={!!confirmRegen} onClose={() => setConfirmRegen(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle>{t.settings.inboundAddressRegenerate}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{t.settings.inboundAddressRegenerateWarning}</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmRegen(null)} disabled={regenerating}>{t.settings.kbCancel}</Button>
            <Button variant="contained" color="warning" onClick={handleRegen} disabled={regenerating}
              startIcon={regenerating ? <CircularProgress size={16} color="inherit" /> : <Refresh />}>
              {regenerating ? t.settings.saving : t.settings.inboundAddressRegenerateConfirm}
            </Button>
          </DialogActions>
        </Dialog>
      </Section>
    </>
  );
}

interface EmailChannel {
  id: number;
  type: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string | null;
  folder: string | null;
  defaultCategory: string | null;
  defaultGroup: string | null;
  isPrimary: boolean;
  enabled: boolean;
  status?: { lastPollAt: string | null; lastError: string | null; ticketsCreated: number; baselined: boolean } | null;
}

interface ChannelForm {
  type: 'smtp' | 'imap';
  label: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  folder: string;
  defaultCategory: string;
  defaultGroup: string;
  isPrimary: boolean;
  enabled: boolean;
}

const EMPTY_SMTP_FORM: ChannelForm = { type: 'smtp', label: '', host: '', port: 587, secure: false, user: '', password: '', fromAddress: '', folder: 'INBOX', defaultCategory: '', defaultGroup: '', isPrimary: false, enabled: true };

function EmailChannelsTab() {
  const { t } = useLanguage();
  const [channels, setChannels] = useState<EmailChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmailChannel | null>(null);
  const [form, setForm] = useState<ChannelForm>(EMPTY_SMTP_FORM);
  const [saving, setSaving] = useState(false);
  const [presetNote, setPresetNote] = useState<{ label: string; link: string } | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<EmailChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Test state
  const [testing, setTesting] = useState<number | null>(null);

  // Menu anchor
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; channel: EmailChannel } | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/settings/email-channels', { credentials: 'include' });
      const data = await res.json();
      setChannels(data.channels ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_SMTP_FORM });
    setPresetNote(null);
    setDialogOpen(true);
  };

  const openEdit = (ch: EmailChannel) => {
    setMenuAnchor(null);
    setEditTarget(ch);
    setForm({
      type: ch.type as 'smtp' | 'imap',
      label: ch.label,
      host: ch.host,
      port: ch.port,
      secure: ch.secure,
      user: ch.user,
      password: '',
      fromAddress: ch.fromAddress ?? '',
      folder: ch.folder ?? 'INBOX',
      defaultCategory: ch.defaultCategory ?? '',
      defaultGroup: ch.defaultGroup ?? '',
      isPrimary: ch.isPrimary,
      enabled: ch.enabled,
    });
    setPresetNote(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const url = editTarget ? `/api/settings/email-channels/${editTarget.id}` : '/api/settings/email-channels';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fromAddress: form.fromAddress || null, defaultCategory: form.defaultCategory || null, defaultGroup: form.defaultGroup || null }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.message || t.settings.channelError }); return; }
      setMsg({ type: 'success', text: t.settings.channelSaved });
      setDialogOpen(false);
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.channelError }); }
    finally { setSaving(false); }
  };

  const handleTest = async (ch: EmailChannel) => {
    setMenuAnchor(null);
    setTesting(ch.id); setMsg(null);
    try {
      const res = await fetch(`/api/settings/email-channels/${ch.id}/test`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setMsg(data.ok
        ? { type: 'success', text: t.settings.channelTestOk }
        : { type: 'error', text: `${t.settings.channelTestFail}: ${data.error ?? ''}` });
    } catch { setMsg({ type: 'error', text: t.settings.channelTestFail }); }
    finally { setTesting(null); }
  };

  const handleToggle = async (ch: EmailChannel) => {
    setMenuAnchor(null);
    try {
      await fetch(`/api/settings/email-channels/${ch.id}/toggle`, { method: 'PUT', credentials: 'include' });
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.channelError }); }
  };

  const handleSetPrimary = async (ch: EmailChannel) => {
    setMenuAnchor(null);
    try {
      await fetch(`/api/settings/email-channels/${ch.id}/primary`, { method: 'PUT', credentials: 'include' });
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.channelError }); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/settings/email-channels/${confirmDelete.id}`, { method: 'DELETE', credentials: 'include' });
      setMsg({ type: 'success', text: t.settings.channelDeleted });
      setConfirmDelete(null);
      await load();
    } catch { setMsg({ type: 'error', text: t.settings.channelError }); }
    finally { setDeleting(false); }
  };

  const applyPreset = (preset: { host: string; port: number; secure: boolean; appPwd: boolean; pwdLink: string; label: string }) => {
    setForm((f) => ({ ...f, host: preset.host, port: preset.port, secure: preset.secure }));
    setPresetNote(preset.appPwd ? { label: preset.label, link: preset.pwdLink } : null);
  };

  if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;

  return (
    <>
    <Section title={t.settings.emailChannels} icon={<MailOutline color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t.settings.imapNote}
      </Typography>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* Channel cards */}
      {channels.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>{t.settings.noChannels}</Alert>
      ) : (
        <Stack spacing={1.5} mb={3}>
          {channels.map((ch) => (
            <Paper key={ch.id} variant="outlined" sx={{ borderRadius: 2, p: 2, borderColor: ch.enabled ? (ch.isPrimary ? 'primary.main' : 'divider') : 'divider', opacity: ch.enabled ? 1 : 0.65 }}>
              <Box display="flex" alignItems="flex-start" gap={1.5}>
                {/* Icon */}
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light', color: 'primary.dark', flexShrink: 0 }}>
                  <Send sx={{ fontSize: 18 }} />
                </Avatar>
                {/* Body */}
                <Box flex={1} minWidth={0}>
                  <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                    <Typography variant="subtitle2" fontWeight={700} noWrap>{ch.label || ch.user}</Typography>
                    {ch.isPrimary && (
                      <Chip label={t.settings.primaryBadge} size="small" color="primary" icon={<StarOutlined sx={{ fontSize: '12px !important' }} />} sx={{ height: 18, fontSize: '0.65rem' }} />
                    )}
                    <Chip
                      label={ch.enabled ? t.settings.channelEnabled : t.settings.channelDisabled}
                      size="small"
                      color={ch.enabled ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                    {ch.host}:{ch.port} · {ch.user}
                  </Typography>
                  {testing === ch.id && (
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                      <CircularProgress size={12} />
                      <Typography variant="caption">Test in corso…</Typography>
                    </Box>
                  )}
                </Box>
                {/* Actions menu */}
                <IconButton size="small" onClick={(e) => setMenuAnchor({ el: e.currentTarget, channel: ch })} sx={{ flexShrink: 0 }}>
                  <MoreVert fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Add channel button */}
      <Box>
        <Button variant="outlined" size="small" startIcon={<Add fontSize="small" />} onClick={openAdd}>
          {t.settings.addChannel}
        </Button>
      </Box>

      {/* Context menu */}
      {menuAnchor && (
        <Paper component="div" elevation={3} sx={{ position: 'fixed', zIndex: 1400, minWidth: 200, borderRadius: 2, overflow: 'hidden', py: 0.5,
          top: menuAnchor.el.getBoundingClientRect().bottom + 4,
          left: Math.min(menuAnchor.el.getBoundingClientRect().left, window.innerWidth - 210),
        }}>
          <MenuItem dense onClick={() => openEdit(menuAnchor.channel)} sx={{ gap: 1.5 }}>
            <EditOutlined fontSize="small" color="action" />
            <Typography variant="body2">{t.settings.editChannel}</Typography>
          </MenuItem>
          <MenuItem dense onClick={() => handleTest(menuAnchor.channel)} disabled={testing !== null} sx={{ gap: 1.5 }}>
            <WifiTethering fontSize="small" color="action" />
            <Typography variant="body2">{t.settings.imapTest}</Typography>
          </MenuItem>
          {!menuAnchor.channel.isPrimary && (
            <MenuItem dense onClick={() => handleSetPrimary(menuAnchor.channel)} sx={{ gap: 1.5 }}>
              <StarOutlined fontSize="small" color="action" />
              <Typography variant="body2">{t.settings.setPrimary}</Typography>
            </MenuItem>
          )}
          <MenuItem dense onClick={() => handleToggle(menuAnchor.channel)} sx={{ gap: 1.5 }}>
            <Box sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: menuAnchor.channel.enabled ? 'text.disabled' : 'success.main' }} />
            </Box>
            <Typography variant="body2">{menuAnchor.channel.enabled ? t.settings.channelDisabled : t.settings.channelEnabled}</Typography>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem dense onClick={() => { setMenuAnchor(null); setConfirmDelete(menuAnchor.channel); }} sx={{ gap: 1.5, color: 'error.main' }}>
            <Delete fontSize="small" color="error" />
            <Typography variant="body2" color="error">{t.settings.deleteChannel}</Typography>
          </MenuItem>
        </Paper>
      )}
      {/* Click-away overlay for menu */}
      {menuAnchor && <Box sx={{ position: 'fixed', inset: 0, zIndex: 1399 }} onClick={() => setMenuAnchor(null)} />}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          {editTarget ? t.settings.editChannel : t.settings.addChannelTitle}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {/* Presets */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.75 }}>
                {t.settings.providerPreset}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {SMTP_PRESETS.map((p) => (
                  <Chip key={p.label} label={p.label} size="small" clickable
                    variant={form.host === p.host ? 'filled' : 'outlined'}
                    color={form.host === p.host ? 'primary' : 'default'}
                    onClick={() => applyPreset(p)}
                  />
                ))}
              </Box>
              {presetNote && (
                <Alert severity="info" sx={{ mt: 1.5, fontSize: '0.8rem', py: 0.5 }}>
                  <strong>{presetNote.label}</strong> {t.settings.appPasswordNote}{' '}
                  {presetNote.link && <a href={presetNote.link} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{t.settings.appPasswordLink} →</a>}
                </Alert>
              )}
            </Box>

            {/* Label */}
            <TextField label={t.settings.channelLabel} size="small" fullWidth value={form.label}
              placeholder={t.settings.channelLabelPlaceholder}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />

            {/* Host + Port */}
            <Box display="flex" gap={1}>
              <TextField label={t.settings.smtpHost}
                value={form.host} size="small" sx={{ flex: 1 }}
                placeholder="smtp.gmail.com"
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
              <TextField label={t.settings.smtpPort} value={form.port} size="small" sx={{ width: 88, flexShrink: 0 }}
                type="number" inputProps={{ min: 1, max: 65535 }}
                onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value, 10) || 587 }))} />
            </Box>

            {/* SSL */}
            <Box display="flex" alignItems="center" gap={1}>
              <Switch size="small" checked={form.secure}
                onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked, port: e.target.checked ? 465 : 587 }))} />
              <Typography variant="body2">{t.settings.smtpSecure}</Typography>
            </Box>

            {/* User */}
            <TextField label={t.settings.smtpUser}
              value={form.user} size="small" fullWidth
              placeholder="support@miazienda.it" type="email" autoComplete="off"
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} />

            {/* Password */}
            <TextField label={t.settings.smtpPassword}
              value={form.password} size="small" fullWidth type="password" autoComplete="new-password"
              placeholder={editTarget ? t.settings.smtpPasswordEditPlaceholder : undefined}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />

            {/* From address */}
            <TextField label={t.settings.channelFromAddress} value={form.fromAddress} size="small" fullWidth
              placeholder="Supporto <support@azienda.it>"
              onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))} />

            {/* Primary toggle */}
            <Box display="flex" alignItems="center" gap={1}>
              <Switch size="small" checked={form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
              <Typography variant="body2">{t.settings.setPrimary}</Typography>
            </Box>

            {/* Enabled toggle */}
            <Box display="flex" alignItems="center" gap={1}>
              <Switch size="small" checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
              <Typography variant="body2">{form.enabled ? t.settings.channelEnabled : t.settings.channelDisabled}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>{t.settings.kbCancel}</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.host || !form.user || (!editTarget && !form.password)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}>
            {saving ? t.settings.saving : t.settings.kbSave}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>{t.settings.deleteChannel}</DialogTitle>
        {confirmDelete && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary">{t.settings.confirmDeleteChannel}</Typography>
            <Typography variant="body2" fontWeight={600} mt={1}>"{confirmDelete.label || confirmDelete.user}"</Typography>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleting}>{t.settings.kbCancel}</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Delete />}>
            {deleting ? t.settings.saving : t.settings.kbDeleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
    </>
  );
}

interface KbArticle {
  id: number;
  title: string;
  content: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

function KnowledgeBaseTab() {
  const { t } = useLanguage();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromPdf, setFromPdf] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<KbArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfFile = async (file: File) => {
    setPdfLoading(true);
    setMsg(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/ {2,}/g, ' ')
          .trim();
        if (pageText) pages.push(pageText);
      }
      const extracted = pages.join('\n\n');
      if (!extracted.trim()) {
        setMsg({ type: 'error', text: t.settings.kbPdfEmpty });
        return;
      }
      const titleFromFile = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      setEditing(null);
      setFormTitle(titleFromFile);
      setFormContent(extracted);
      setFormCategory('');
      setFromPdf(true);
      setDialogOpen(true);
    } catch {
      setMsg({ type: 'error', text: t.settings.kbPdfError });
    } finally {
      setPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge-articles', { credentials: 'include' });
      const data = await res.json();
      setArticles(data);
    } catch {
      setMsg({ type: 'error', text: t.settings.kbError });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('');
    setFromPdf(false);
    setDialogOpen(true);
  };

  const openEdit = (article: KbArticle) => {
    setEditing(article);
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormCategory(article.category ?? '');
    setFromPdf(false);
    setDialogOpen(true);
  };

  const saveArticle = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const url = editing ? `/api/knowledge-articles/${editing.id}` : '/api/knowledge-articles';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      setMsg({ type: 'success', text: t.settings.kbSaved });
      setDialogOpen(false);
      await load();
    } catch {
      setMsg({ type: 'error', text: t.settings.kbError });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge-articles/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      setMsg({ type: 'success', text: t.settings.kbDeleted });
      setDeleteTarget(null);
      await load();
    } catch {
      setMsg({ type: 'error', text: t.settings.kbError });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Section title={t.settings.kbTitle} icon={<SmartToy color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {t.settings.kbNote}
      </Typography>
      {msg && (
        <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>
      )}
      <Box display="flex" justifyContent="flex-end" gap={1} mb={2}>
        <Button
          variant="outlined"
          startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
          size="small"
          onClick={() => pdfInputRef.current?.click()}
          disabled={pdfLoading}
          sx={{ borderRadius: 2 }}
        >
          {pdfLoading ? t.settings.kbPdfExtracting : t.settings.kbImportPdf}
        </Button>
        <Button variant="contained" startIcon={<Add />} size="small" onClick={openAdd} sx={{ borderRadius: 2 }}>
          {t.settings.kbAddArticle}
        </Button>
      </Box>
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePdfFile(file);
        }}
      />

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
      ) : articles.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {t.settings.kbNoArticles}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {articles.map((a) => (
            <Paper key={a.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
              <Box display="flex" alignItems="flex-start" gap={1}>
                <Article sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
                <Box flex={1} minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>{a.title}</Typography>
                  {a.category && (
                    <Chip label={a.category} size="small" sx={{ mt: 0.5, mb: 0.5, height: 20, fontSize: '0.7rem' }} />
                  )}
                  <Typography variant="body2" color="text.secondary" sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontSize: '0.8rem',
                    lineHeight: 1.4,
                  }}>
                    {a.content}
                  </Typography>
                </Box>
                <Box display="flex" gap={0.5} flexShrink={0}>
                  <IconButton size="small" onClick={() => openEdit(a)}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(a)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          {editing ? t.settings.kbEditArticle : t.settings.kbAddArticle}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label={t.settings.kbTitleField}
              fullWidth
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              inputProps={{ maxLength: 300 }}
            />
            <TextField
              label={t.settings.kbContentField}
              fullWidth
              multiline
              minRows={6}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              required
              helperText={fromPdf ? t.settings.kbPdfHelperText : undefined}
            />
            <TextField
              label={t.settings.kbCategoryField}
              fullWidth
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              inputProps={{ maxLength: 100 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>{t.settings.kbCancel}</Button>
          <Button
            variant="contained"
            onClick={saveArticle}
            disabled={saving || !formTitle.trim() || !formContent.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          >
            {saving ? t.settings.saving : t.settings.kbSave}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>{t.settings.kbDeleteConfirm}</DialogTitle>
        {deleteTarget && (
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              "{deleteTarget.title}"
            </Typography>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>{t.settings.kbCancel}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Delete />}
          >
            {deleting ? t.settings.saving : t.settings.kbDeleteAction}
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}

interface GroupWithMembers {
  id: number;
  name: string;
  organizationId?: number | null;
  createdAt: string;
  permissions: string[];
  memberCount: number;
  members: Array<{ id: number; name: string; email: string; role: string; avatarUrl?: string | null; isActive: boolean }>;
}

function GroupsManagementTab() {
  const { t } = useLanguage();
  const tg = t.groups;

  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; email: string; avatarUrl?: string | null; isActive: boolean }>>([]);

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupWithMembers | null>(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GroupWithMembers | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [membersTarget, setMembersTarget] = useState<GroupWithMembers | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);

  const [permissionsTarget, setPermissionsTarget] = useState<GroupWithMembers | null>(null);
  const [permissionsDraft, setPermissionsDraft] = useState<string[]>([]);
  const [permissionsSaving, setPermissionsSaving] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups', { credentials: 'include' });
      if (res.ok) setGroups(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchGroups();
    fetch('/api/users', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAllUsers(data.filter((u: any) => u.isActive)))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setFormName('');
    setFormError(null);
    setNameDialogOpen(true);
  };

  const openRename = (g: GroupWithMembers) => {
    setEditTarget(g);
    setFormName(g.name);
    setFormError(null);
    setNameDialogOpen(true);
  };

  const handleSaveName = async () => {
    if (!formName.trim()) { setFormError(tg.errorRequired); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        const res = await fetch(`/api/groups/${editTarget.id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim() }),
        });
        if (!res.ok) { setFormError(tg.errorSaving); setSaving(false); return; }
        const updated = await res.json();
        setGroups((prev) => prev.map((g) => g.id === editTarget.id ? updated : g));
        setMsg({ type: 'success', text: tg.successUpdated });
      } else {
        const res = await fetch('/api/groups', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim() }),
        });
        if (!res.ok) { setFormError(tg.errorSaving); setSaving(false); return; }
        const created = await res.json();
        setGroups((prev) => [...prev, created]);
        setMsg({ type: 'success', text: tg.successCreated });
      }
      setNameDialogOpen(false);
    } catch { setFormError(tg.errorSaving); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/groups/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { setDeleteError(tg.errorDeleting); setDeleting(false); return; }
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMsg({ type: 'success', text: tg.successDeleted });
    } catch { setDeleteError(tg.errorDeleting); }
    finally { setDeleting(false); }
  };

  const openMembers = (g: GroupWithMembers) => {
    setMembersTarget({ ...g });
  };

  const handleAddMember = async (userId: number) => {
    if (!membersTarget) return;
    setMemberLoading(true);
    try {
      const res = await fetch(`/api/groups/${membersTarget.id}/members`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) { setMsg({ type: 'error', text: tg.errorMember }); return; }
      const user = allUsers.find((u) => u.id === userId);
      if (user) {
        const updatedMembers = [...membersTarget.members, { ...user, role: 'user', isActive: true }];
        const updatedGroup = { ...membersTarget, members: updatedMembers, memberCount: updatedMembers.length };
        setMembersTarget(updatedGroup);
        setGroups((prev) => prev.map((g) => g.id === membersTarget.id ? updatedGroup : g));
      }
    } catch { setMsg({ type: 'error', text: tg.errorMember }); }
    finally { setMemberLoading(false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!membersTarget) return;
    setMemberLoading(true);
    try {
      const res = await fetch(`/api/groups/${membersTarget.id}/members`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) { setMsg({ type: 'error', text: tg.errorMember }); return; }
      const updatedMembers = membersTarget.members.filter((m) => m.id !== userId);
      const updatedGroup = { ...membersTarget, members: updatedMembers, memberCount: updatedMembers.length };
      setMembersTarget(updatedGroup);
      setGroups((prev) => prev.map((g) => g.id === membersTarget.id ? updatedGroup : g));
    } catch { setMsg({ type: 'error', text: tg.errorMember }); }
    finally { setMemberLoading(false); }
  };

  const openPermissions = (g: GroupWithMembers) => {
    setPermissionsTarget(g);
    setPermissionsDraft([...(g.permissions ?? [])]);
  };

  const togglePermission = (perm: string) => {
    setPermissionsDraft((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePermissions = async () => {
    if (!permissionsTarget) return;
    setPermissionsSaving(true);
    try {
      const res = await fetch(`/api/groups/${permissionsTarget.id}/permissions`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permissionsDraft }),
      });
      if (!res.ok) { setMsg({ type: 'error', text: tg.permError }); setPermissionsSaving(false); return; }
      const updated = await res.json();
      setGroups((prev) => prev.map((g) => g.id === permissionsTarget.id ? { ...g, permissions: updated.permissions } : g));
      setPermissionsTarget(null);
      setMsg({ type: 'success', text: tg.permSaved });
    } catch { setMsg({ type: 'error', text: tg.permError }); }
    finally { setPermissionsSaving(false); }
  };

  const memberIds = new Set(membersTarget?.members.map((m) => m.id) ?? []);
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <Section title={tg.title} icon={<People color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={2}>{tg.subtitle}</Typography>

      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<Add />} size="small" onClick={openCreate}>
          {tg.addGroup}
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
      ) : groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{tg.noGroups}</Typography>
      ) : (
        <Stack spacing={1}>
          {groups.map((g) => (
            <Paper key={g.id} variant="outlined" sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <GroupIcon color="action" sx={{ flexShrink: 0 }} />
              <Box flex={1}>
                <Typography fontWeight={600}>{g.name}</Typography>
                <Typography variant="caption" color="text.secondary">{tg.membersCount(g.memberCount)}</Typography>
              </Box>
              <Tooltip title={tg.manageMembers}>
                <IconButton size="small" onClick={() => openMembers(g)}>
                  <Person fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={tg.managePermissions}>
                <IconButton size="small" onClick={() => openPermissions(g)} color={g.permissions?.length ? 'primary' : 'default'}>
                  <SecurityOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={tg.rename}>
                <IconButton size="small" onClick={() => openRename(g)}>
                  <EditOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={tg.deleteGroupTitle}>
                <IconButton size="small" color="error" onClick={() => { setDeleteTarget(g); setDeleteError(null); }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Create / Rename Dialog */}
      <Dialog open={nameDialogOpen} onClose={() => setNameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editTarget ? tg.editGroup : tg.addGroup}</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            {formError && <Alert severity="error" sx={{ mb: 1.5 }}>{formError}</Alert>}
            <TextField
              label={tg.groupName}
              placeholder={tg.groupNamePlaceholder}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); } }}
              fullWidth autoFocus size="small"
              disabled={saving}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNameDialogOpen(false)} disabled={saving}>{tg.cancel}</Button>
          <Button variant="contained" onClick={handleSaveName} disabled={saving || !formName.trim()}>
            {saving ? tg.saving : tg.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{tg.deleteGroupTitle}</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
          <Typography>{deleteTarget ? tg.deleteGroupConfirm(deleteTarget.name) : ''}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>{tg.cancel}</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? tg.saving : tg.deleteGroupAction}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permissionsTarget} onClose={() => setPermissionsTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{permissionsTarget ? tg.permissionsTitle : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>{tg.permissionsNote}</Typography>
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permChangeStatus}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('change_status')}
                onChange={() => togglePermission('change_status')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permAddNotes}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('add_notes')}
                onChange={() => togglePermission('add_notes')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permEditFixedNotes}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('edit_fixed_notes')}
                onChange={() => togglePermission('edit_fixed_notes')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permEditClientNotes}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('edit_client_notes')}
                onChange={() => togglePermission('edit_client_notes')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permDeleteClientNotes}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('delete_client_notes')}
                onChange={() => togglePermission('delete_client_notes')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permManageClientSections}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('manage_client_sections')}
                onChange={() => togglePermission('manage_client_sections')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permEditClientSectionContent}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('edit_client_section_content')}
                onChange={() => togglePermission('edit_client_section_content')}
                disabled={permissionsSaving}
              />
            </Box>
            <Divider />
            <Box display="flex" alignItems="center" justifyContent="space-between" py={1}>
              <Typography variant="body2">{tg.permCreateAppointments}</Typography>
              <Switch
                size="small"
                checked={permissionsDraft.includes('create_appointments')}
                onChange={() => togglePermission('create_appointments')}
                disabled={permissionsSaving}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsTarget(null)} disabled={permissionsSaving}>{tg.cancel}</Button>
          <Button variant="contained" onClick={handleSavePermissions} disabled={permissionsSaving}>
            {permissionsSaving ? tg.saving : tg.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={!!membersTarget} onClose={() => setMembersTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{membersTarget ? tg.membersDialogTitle(membersTarget.name) : ''}</DialogTitle>
        <DialogContent>
          <Box>
            {/* Current members */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{tg.manageMembers}</Typography>
            {!membersTarget || membersTarget.members.length === 0 ? (
              <Typography variant="body2" color="text.secondary" mb={2}>{tg.noMembers}</Typography>
            ) : (
              <List dense disablePadding sx={{ mb: 2 }}>
                {membersTarget.members.map((m) => (
                  <ListItem key={m.id} disableGutters divider>
                    <Avatar src={m.avatarUrl ?? undefined} sx={{ width: 28, height: 28, mr: 1.5, fontSize: 13 }}>
                      {m.name[0]?.toUpperCase()}
                    </Avatar>
                    <ListItemText primary={m.name} secondary={m.email} />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={memberLoading}
                        onClick={() => handleRemoveMember(m.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            {/* Add members */}
            {nonMembers.length > 0 && (
              <>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} mb={1}>{tg.addMembersTitle}</Typography>
                <List dense disablePadding>
                  {nonMembers.map((u) => (
                    <ListItem key={u.id} disableGutters divider>
                      <Avatar src={u.avatarUrl ?? undefined} sx={{ width: 28, height: 28, mr: 1.5, fontSize: 13 }}>
                        {u.name[0]?.toUpperCase()}
                      </Avatar>
                      <ListItemText primary={u.name} secondary={u.email} />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={memberLoading}
                          onClick={() => handleAddMember(u.id)}
                          startIcon={<Add />}
                        >
                          {tg.addMember}
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersTarget(null)}>{tg.cancel}</Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}
