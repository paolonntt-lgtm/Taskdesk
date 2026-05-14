import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, TextField, Button,
  Alert, Divider, Chip, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, CircularProgress, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Stack, useMediaQuery, useTheme,
  Avatar, Snackbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem,
} from '@mui/material';
import { Add, Delete, Save, Lock, Person, LocationOn, Category, Group as GroupIcon, NotificationsActive, Phone, PhotoCamera, Check, Business, Receipt, EditOutlined, Close, SmartToy, Article, MailOutline, CheckCircleOutline, ErrorOutline, WifiTethering, LinkOff, OpenInNew, Send } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [prefs, setPrefs] = useState<NotifPref[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState(0);

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
  const [groups, setGroups] = useState<string[]>([]);
  const [locSaving, setLocSaving] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [grpSaving, setGrpSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [orgName, setOrgName] = useState('');
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
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setGroups(d.value ?? [])).catch(() => {});
    fetch('/api/settings/organization', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setOrgName(d.name ?? '')).catch(() => {});
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
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      });
      const data = await res.json();
      if (!res.ok) { setOrgMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setOrgName(data.name);
      setOrgMsg({ type: 'success', text: 'Nome azienda aggiornato con successo.' });
    } catch {
      setOrgMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
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
        // Scale down if too large
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
        // Try decreasing quality until under threshold
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
    // Hard cap at 10MB to avoid hanging the browser
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
      setCategories(data.value);
    } catch {
      setAdminMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setCatSaving(false);
    }
  };

  const saveGroups = async (list: string[]) => {
    setGrpSaving(true);
    setAdminMsg(null);
    try {
      const res = await fetch('/api/settings/groups', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: list }),
      });
      const data = await res.json();
      if (!res.ok) { setAdminMsg({ type: 'error', text: data.message || 'Errore' }); return; }
      setGroups(data.value);
    } catch {
      setAdminMsg({ type: 'error', text: 'Errore di rete. Riprova.' });
    } finally {
      setGrpSaving(false);
    }
  };

  return (
    <Box maxWidth={720} mx="auto">
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={3}>
        {t.settings.title}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={t.settings.tabProfile} />
          <Tab label={t.settings.tabNotifications} />
          {isAdmin && <Tab label={t.settings.tabSystem} />}
          {isAdmin && <Tab label={t.settings.tabKnowledgeBase} />}
          {isAdmin && <Tab label={t.settings.tabInboundEmail} icon={<MailOutline sx={{ fontSize: 16 }} />} iconPosition="start" />}
        </Tabs>
      </Box>

      {/* ── PROFILO ── */}
      <TabPanel value={tab} index={0}>
        <Section title={t.settings.personalData} icon={<Person color="primary" />}>
          {profileMsg && (
            <Alert severity={profileMsg.type} sx={{ mb: 2 }} onClose={() => setProfileMsg(null)}>
              {profileMsg.text}
            </Alert>
          )}

          {/* Avatar */}
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Box position="relative">
              <Avatar
                src={avatarUrl || undefined}
                sx={{ width: 72, height: 72, fontSize: 28 }}
              >
                {!avatarUrl && (user?.name?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  bgcolor: 'primary.main',
                  color: 'white',
                  width: 26,
                  height: 26,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <PhotoCamera sx={{ fontSize: 14 }} />
              </IconButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>{user?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t.settings.clickIconToChangePhoto}
              </Typography>
              {avatarUrl && (
                <Box mt={0.5}>
                  <Button
                    size="small"
                    color="error"
                    sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }}
                    onClick={() => setAvatarUrl('')}
                  >
                    {t.settings.removePhoto}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label={t.settings.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t.settings.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
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
              <Chip
                size="small"
                label={user?.role === 'admin' ? t.role.admin : t.role.user}
                color={user?.role === 'admin' ? 'secondary' : 'default'}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">{t.settings.roleNote}</Typography>
            </Box>
            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                startIcon={profileSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                onClick={saveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? t.settings.saving : t.settings.save}
              </Button>
            </Box>
          </Box>
        </Section>

        <Section title={t.settings.changePassword} icon={<Lock color="primary" />}>
          {pwMsg && (
            <Alert severity={pwMsg.type} sx={{ mb: 2 }} onClose={() => setPwMsg(null)}>
              {pwMsg.text}
            </Alert>
          )}
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label={t.settings.currentPassword}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
            />
            <TextField
              label={t.settings.newPassword}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
              helperText={t.settings.passwordHint}
            />
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
              <Button
                variant="contained"
                startIcon={pwSaving ? <CircularProgress size={16} color="inherit" /> : <Lock />}
                onClick={savePassword}
                disabled={pwSaving || !currentPassword || !newPassword}
              >
                {pwSaving ? t.settings.saving : t.settings.changePasswordBtn}
              </Button>
            </Box>
          </Box>
        </Section>
      </TabPanel>

      {/* ── NOTIFICHE ── */}
      <TabPanel value={tab} index={1}>
        <NotificationPreferences />
      </TabPanel>

      {/* ── SISTEMA (admin only) ── */}
      {isAdmin && (
        <TabPanel value={tab} index={2}>
          <Section title={t.settings.orgNameTitle} icon={<Business color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.orgNameNote}
            </Typography>
            {orgMsg && (
              <Alert severity={orgMsg.type} sx={{ mb: 2 }} onClose={() => setOrgMsg(null)}>{orgMsg.text}</Alert>
            )}
            <Box display="flex" gap={2} alignItems="flex-start">
              <TextField
                size="small"
                fullWidth
                label={t.settings.orgNameLabel}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={orgSaving}
                inputProps={{ maxLength: 100 }}
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
          </Section>

          <Section title={t.settings.billingTitle} icon={<Receipt color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.billingNote}
            </Typography>
            {billingMsg && (
              <Alert severity={billingMsg.type} sx={{ mb: 2 }} onClose={() => setBillingMsg(null)}>{billingMsg.text}</Alert>
            )}
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField size="small" fullWidth label={t.settings.billingRagioneSociale} value={billing.ragioneSociale}
                onChange={(e) => setBilling((b) => ({ ...b, ragioneSociale: e.target.value }))} disabled={billingSaving} />
              <Box display="flex" gap={2}>
                <TextField size="small" fullWidth label={t.settings.billingPiva} value={billing.piva}
                  onChange={(e) => setBilling((b) => ({ ...b, piva: e.target.value }))} disabled={billingSaving}
                  placeholder="IT12345678901" />
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
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {t.settings.billingElectronic}
              </Typography>
              <Box display="flex" gap={2}>
                <TextField size="small" fullWidth label={t.settings.billingSdi} value={billing.sdiCode}
                  onChange={(e) => setBilling((b) => ({ ...b, sdiCode: e.target.value }))} disabled={billingSaving}
                  placeholder="7 caratteri" inputProps={{ maxLength: 7 }} />
                <TextField size="small" fullWidth label={t.settings.billingPec} type="email" value={billing.pec}
                  onChange={(e) => setBilling((b) => ({ ...b, pec: e.target.value }))} disabled={billingSaving}
                  placeholder="azienda@pec.it" />
              </Box>
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={billingSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={saveBilling}
                  disabled={billingSaving}
                >
                  {billingSaving ? t.settings.saving : t.settings.saveSyncStripe}
                </Button>
              </Box>
            </Box>
          </Section>

          {adminMsg && (
            <Alert severity={adminMsg.type} sx={{ mb: 2 }} onClose={() => setAdminMsg(null)}>
              {adminMsg.text}
            </Alert>
          )}

          <Section title={t.settings.manageLocations} icon={<LocationOn color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.locationsNote}
            </Typography>
            <ListEditor
              placeholder={t.settings.addLocationPlaceholder}
              items={locations}
              onSave={saveLocations}
              saving={locSaving}
            />
          </Section>

          <Section title={t.settings.manageCategories} icon={<Category color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.categoriesNote}
            </Typography>
            <ListEditor
              placeholder={t.settings.addCategoryPlaceholder}
              items={categories}
              onSave={saveCategories}
              saving={catSaving}
            />
          </Section>

          <Section title={t.settings.manageGroups} icon={<GroupIcon color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.groupsNote}
            </Typography>
            <GroupsEditor
              groups={groups}
              onSave={saveGroups}
              saving={grpSaving}
            />
          </Section>
        </TabPanel>
      )}

      {/* ── KNOWLEDGE BASE (admin only) ── */}
      {isAdmin && (
        <>
          <TabPanel value={tab} index={3}>
            <KnowledgeBaseTab />
          </TabPanel>
          <TabPanel value={tab} index={4}>
            <Box display="flex" flexDirection="column" gap={4}>
              <OutboundEmailTab />
              <InboundEmailTab />
            </Box>
          </TabPanel>
        </>
      )}
    </Box>
  );
}

function GroupsEditor({
  groups,
  onSave,
  saving,
}: {
  groups: string[];
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Group list state
  const [list, setList] = useState<string[]>(groups);
  const [newItem, setNewItem] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [listFlash, setListFlash] = useState(false);

  // Permissions state
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [permSaving, setPermSaving] = useState(false);
  const [permFlash, setPermFlash] = useState(false);

  useEffect(() => { setList(groups); }, [groups]);

  useEffect(() => {
    fetch('/api/settings/group-permissions', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPerms(d.value ?? {}))
      .catch(() => {});
  }, []);

  const triggerListSave = useCallback(async (next: string[]) => {
    await onSave(next);
    setListFlash(true);
    setTimeout(() => setListFlash(false), 1800);
  }, [onSave]);

  const savePerms = useCallback(async (nextPerms: Record<string, string[]>) => {
    setPermSaving(true);
    try {
      await fetch('/api/settings/group-permissions', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: nextPerms }),
      });
      setPermFlash(true);
      setTimeout(() => setPermFlash(false), 1800);
    } catch {}
    finally { setPermSaving(false); }
  }, []);

  const add = async () => {
    const trimmed = newItem.trim();
    if (!trimmed || list.includes(trimmed)) return;
    const next = [...list, trimmed];
    setList(next);
    setNewItem('');
    await triggerListSave(next);
  };

  const remove = async (idx: number) => {
    const removedName = list[idx];
    const next = list.filter((_, i) => i !== idx);
    setList(next);
    const nextPerms = { ...perms };
    delete nextPerms[removedName];
    setPerms(nextPerms);
    await triggerListSave(next);
    await savePerms(nextPerms);
  };

  const startEdit = (idx: number) => { setEditIdx(idx); setEditValue(list[idx]); };
  const cancelEdit = () => { setEditIdx(null); setEditValue(''); };

  const confirmEdit = async () => {
    if (editIdx === null) return;
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== list[editIdx] && list.includes(trimmed))) { cancelEdit(); return; }
    const oldName = list[editIdx];
    const next = list.map((item, i) => (i === editIdx ? trimmed : item));
    setList(next);
    setEditIdx(null);
    setEditValue('');
    // Move permissions to new key
    const nextPerms = { ...perms };
    if (oldName !== trimmed && nextPerms[oldName] !== undefined) {
      nextPerms[trimmed] = nextPerms[oldName];
      delete nextPerms[oldName];
      setPerms(nextPerms);
      await savePerms(nextPerms);
    }
    await triggerListSave(next);
  };

  const handleEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

  const togglePerm = async (group: string, perm: string) => {
    const current = perms[group] ?? [];
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm];
    const nextPerms = { ...perms, [group]: next };
    setPerms(nextPerms);
    await savePerms(nextPerms);
  };

  const PERM_DEFS = [
    { key: 'change_status', label: t.settings.groupPermChangeStatus },
    { key: 'add_notes', label: t.settings.groupPermAddNotes },
  ];

  return (
    <Box>
      <Box display="flex" flexDirection="column" gap={1.5}>
        {list.map((item, idx) => {
          const groupPerms = perms[item] ?? [];
          return (
            <Paper key={idx} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              {/* Group name row */}
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{ px: 2, py: 1.25, bgcolor: 'grey.50' }}
              >
                <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', flexShrink: 0 }}>
                  <GroupIcon sx={{ fontSize: 15 }} />
                </Avatar>
                {editIdx === idx ? (
                  <>
                    <TextField
                      size="small"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKey}
                      autoFocus
                      sx={{ flex: 1 }}
                      disabled={saving}
                    />
                    <IconButton size="small" color="primary" onClick={confirmEdit} disabled={!editValue.trim() || saving}>
                      <Check fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={cancelEdit} disabled={saving}>
                      <Close fontSize="small" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                      {item}
                    </Typography>
                    <IconButton size="small" onClick={() => startEdit(idx)} disabled={saving || editIdx !== null} sx={{ color: 'text.secondary' }}>
                      <EditOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => remove(idx)} disabled={saving || editIdx !== null}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>

              {/* Permissions */}
              <Divider />
              <Box
                display="grid"
                gridTemplateColumns={isMobile ? '1fr' : '1fr 1fr'}
                gap={0}
                sx={{ px: 2, py: 1 }}
              >
                {PERM_DEFS.map(({ key, label }, pi) => (
                  <Box
                    key={key}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{
                      py: 0.5,
                      px: 0.5,
                      borderRadius: 1,
                      borderRight: !isMobile && pi === 0 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      pr: !isMobile && pi === 0 ? 2 : 0.5,
                      pl: !isMobile && pi === 1 ? 2 : 0.5,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', lineHeight: 1.3 }}>
                      {label}
                    </Typography>
                    <Switch
                      size="small"
                      checked={groupPerms.includes(key)}
                      onChange={() => togglePerm(item, key)}
                      disabled={permSaving}
                    />
                  </Box>
                ))}
              </Box>
            </Paper>
          );
        })}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            {t.settings.noItems}
          </Typography>
        )}
      </Box>

      {/* Add new group */}
      <Box display="flex" gap={1} mt={2} alignItems="center">
        <TextField
          size="small"
          fullWidth
          placeholder={t.settings.addGroupPlaceholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving || editIdx !== null}
        />
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={add}
          disabled={!newItem.trim() || saving || editIdx !== null}
        >
          {t.settings.addItem}
        </Button>
        {(saving || permSaving) && <CircularProgress size={18} />}
        {!saving && !permSaving && (listFlash || permFlash) && <Check fontSize="small" color="success" />}
      </Box>
    </Box>
  );
}

// ── INBOUND ROUTING FIELDS (shared sub-component) ────────────────────────

function InboundRoutingFields({
  config,
  setConfig,
}: {
  config: ImapConfig;
  setConfig: React.Dispatch<React.SetStateAction<ImapConfig>>;
}) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/settings/categories', { credentials: 'include' }).then((r) => r.json()).then((d) => setCategories(d.value ?? [])).catch(() => {});
    fetch('/api/settings/groups', { credentials: 'include' }).then((r) => r.json()).then((d) => setGroups(d.value ?? [])).catch(() => {});
  }, []);

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      {/* Category */}
      <TextField
        select
        label={t.settings.imapRoutingCategory}
        value={config.defaultCategory ?? ''}
        onChange={(e) => setConfig((c) => ({ ...c, defaultCategory: e.target.value }))}
        size="small"
        fullWidth
        helperText={t.settings.imapRoutingCategoryHint}
      >
        <MenuItem value="">{t.settings.imapRoutingNone}</MenuItem>
        {categories.map((cat) => (
          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
        ))}
      </TextField>

      {/* Group */}
      <TextField
        select
        label={t.settings.imapRoutingGroup}
        value={config.defaultGroup ?? ''}
        onChange={(e) => setConfig((c) => ({ ...c, defaultGroup: e.target.value }))}
        size="small"
        fullWidth
        helperText={t.settings.imapRoutingGroupHint}
      >
        <MenuItem value="">{t.settings.imapRoutingNone}</MenuItem>
        {groups.map((g) => (
          <MenuItem key={g} value={g}>{g}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

// ── INBOUND EMAIL (IMAP) TAB ──────────────────────────────────────────────

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  enabled: boolean;
  folder: string;
  label?: string;
  defaultCategory?: string;
  defaultGroup?: string;
}
interface ImapStatus {
  lastPollAt: string | null;
  lastError: string | null;
  ticketsCreated: number;
  baselined: boolean;
}

interface OAuthProviderInfo {
  email: string;
  status: ImapStatus | null;
}

interface OAuthStatus {
  gmail: OAuthProviderInfo | null;
  microsoft: OAuthProviderInfo | null;
  gmailAvailable: boolean;
  microsoftAvailable: boolean;
}

const IMAP_PRESETS = [
  { label: 'Gmail', host: 'imap.gmail.com', port: 993, secure: true },
  { label: 'Outlook / Hotmail', host: 'outlook.office365.com', port: 993, secure: true },
  { label: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993, secure: true },
  { label: 'Aruba', host: 'imaps.aruba.it', port: 993, secure: true },
  { label: 'Libero / Italiaonline', host: 'imap.libero.it', port: 993, secure: true },
];

const EMPTY_CONFIG: ImapConfig = { host: '', port: 993, secure: true, user: '', password: '', enabled: true, folder: 'INBOX', label: '', defaultCategory: '', defaultGroup: '' };

function OAuthProviderCard({
  providerLabel, providerColor, connectUrl, available, info, onDisconnect, disconnecting, t,
}: {
  providerLabel: string; providerColor: string; connectUrl: string;
  available: boolean; info: OAuthProviderInfo | null;
  onDisconnect: () => void; disconnecting: boolean; t: any;
}) {
  return (
    <Box
      sx={{
        flex: 1, minWidth: 240, border: '1px solid', borderRadius: 2,
        borderColor: info ? providerColor : 'divider',
        p: 2, display: 'flex', flexDirection: 'column', gap: 1,
        bgcolor: info ? `${providerColor}08` : 'transparent',
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: available ? providerColor : 'text.disabled', flexShrink: 0 }} />
        <Typography variant="subtitle2" fontWeight={700}>{providerLabel}</Typography>
        {info && <CheckCircleOutline fontSize="small" sx={{ color: providerColor, ml: 'auto' }} />}
      </Box>

      {!available ? (
        <Typography variant="caption" color="text.disabled">{t.settings.oauthNotAvailable} — {t.settings.oauthNotAvailableNote}</Typography>
      ) : info ? (
        <>
          <Typography variant="body2" fontSize="0.8rem" color="text.secondary">
            <strong>{t.settings.oauthConnected}:</strong> {info.email}
          </Typography>
          {info.status && (
            <Typography variant="caption" color="text.secondary">
              {info.status.baselined
                ? `${t.settings.oauthLastPoll}: ${info.status.lastPollAt ? new Date(info.status.lastPollAt).toLocaleString('it-IT') : '—'} · ${t.settings.oauthTickets}: ${info.status.ticketsCreated}`
                : 'Calibrazione in corso…'}
            </Typography>
          )}
          {info.status?.lastError && (
            <Typography variant="caption" color="error.main">{t.settings.oauthErrorLabel}: {info.status.lastError}</Typography>
          )}
          <Button
            size="small" color="error" variant="outlined" startIcon={disconnecting ? <CircularProgress size={12} /> : <LinkOff fontSize="small" />}
            onClick={onDisconnect} disabled={disconnecting}
            sx={{ mt: 0.5, alignSelf: 'flex-start', fontSize: '0.75rem', py: 0.5 }}
          >
            {disconnecting ? t.settings.oauthDisconnecting : t.settings.oauthDisconnect}
          </Button>
        </>
      ) : (
        <Button
          size="small" variant="contained" endIcon={<OpenInNew fontSize="small" />}
          href={connectUrl} component="a"
          sx={{ mt: 0.5, alignSelf: 'flex-start', bgcolor: providerColor, '&:hover': { bgcolor: providerColor, filter: 'brightness(0.9)' }, fontSize: '0.8rem', py: 0.75 }}
        >
          {providerLabel === 'Gmail' ? t.settings.oauthConnectGmail : t.settings.oauthConnectMicrosoft}
        </Button>
      )}
    </Box>
  );
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}
const EMPTY_SMTP: SmtpConfig = { host: '', port: 587, secure: false, user: '', password: '', from: '' };

function OutboundEmailTab() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<SmtpConfig>(EMPTY_SMTP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/outbound-email', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.config) setConfig(d.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/settings/outbound-email', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.message || t.settings.smtpSaveError }); return; }
      setConfig(data.config);
      setMsg({ type: 'success', text: t.settings.smtpSaved });
    } catch { setMsg({ type: 'error', text: t.settings.smtpSaveError }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMsg(null);
    try {
      const res = await fetch('/api/settings/outbound-email/test', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) setMsg({ type: 'success', text: t.settings.smtpTestOk });
      else setMsg({ type: 'error', text: `${t.settings.smtpTestFail}: ${data.error ?? ''}` });
    } catch { setMsg({ type: 'error', text: t.settings.smtpTestFail }); }
    finally { setTesting(false); }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  const isConfigured = !!(config.host && config.user && config.from);

  return (
    <Section title={t.settings.smtpTitle} icon={<Send color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={3}>{t.settings.smtpNote}</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Box
        sx={{
          border: '1px solid', borderColor: isConfigured ? 'primary.main' : 'divider',
          borderRadius: 2, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5,
          bgcolor: isConfigured ? 'primary.50' : 'transparent',
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: isConfigured ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
          <Typography variant="subtitle2" fontWeight={700}>{t.settings.smtpTitle}</Typography>
        </Box>

        {/* Host + Port */}
        <Box display="flex" gap={1}>
          <TextField
            label={t.settings.smtpHost} value={config.host} size="small" sx={{ flex: 1 }}
            placeholder="smtp.gmail.com"
            onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
          />
          <TextField
            label={t.settings.smtpPort} value={config.port} size="small" sx={{ width: 88, flexShrink: 0 }}
            type="number" inputProps={{ min: 1, max: 65535 }}
            onChange={(e) => setConfig((c) => ({ ...c, port: parseInt(e.target.value, 10) || 587 }))}
          />
        </Box>

        {/* SSL toggle */}
        <Box display="flex" alignItems="center" gap={1}>
          <Switch size="small" checked={config.secure}
            onChange={(e) => setConfig((c) => ({ ...c, secure: e.target.checked, port: e.target.checked ? 465 : 587 }))}
          />
          <Typography variant="body2">{t.settings.smtpSecure}</Typography>
        </Box>

        {/* User */}
        <TextField
          label={t.settings.smtpUser} value={config.user} size="small" fullWidth
          placeholder="support@miazienda.it" type="email" autoComplete="off"
          onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value }))}
        />

        {/* Password */}
        <TextField
          label={t.settings.smtpPassword} value={config.password} size="small" fullWidth
          type="password" autoComplete="new-password"
          onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
        />

        {/* From */}
        <TextField
          label={t.settings.smtpFrom} value={config.from} size="small" fullWidth
          placeholder={t.settings.smtpFromPlaceholder}
          onChange={(e) => setConfig((c) => ({ ...c, from: e.target.value }))}
        />

        {/* Actions */}
        <Box display="flex" gap={1} justifyContent="flex-end" mt={0.5} flexWrap="wrap">
          <Button size="small" variant="outlined" onClick={test} disabled={testing || saving || !config.host || !config.user}>
            {testing ? t.settings.smtpTesting : t.settings.smtpTest}
          </Button>
          <Button size="small" variant="contained" onClick={save} disabled={saving || testing}>
            {saving ? '…' : t.settings.smtpSave}
          </Button>
        </Box>
      </Box>
    </Section>
  );
}

function InboundEmailTab() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<ImapConfig>(EMPTY_CONFIG);
  const [status, setStatus] = useState<ImapStatus | null>(null);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<'gmail' | 'microsoft' | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadOAuthStatus = () =>
    fetch('/api/settings/inbound-email/oauth-status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setOauthStatus(data))
      .catch(() => {});

  useEffect(() => {
    let mounted = true;

    // Check URL params for OAuth callback results
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === '1') {
      setMsg({ type: 'success', text: t.settings.oauthConnectedSuccess });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('microsoft_connected') === '1') {
      setMsg({ type: 'success', text: t.settings.oauthConnectedSuccess });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('gmail_error') || params.get('microsoft_error')) {
      setMsg({ type: 'error', text: 'Connessione OAuth fallita. Riprova.' });
      window.history.replaceState({}, '', window.location.pathname);
    }

    Promise.all([
      fetch('/api/settings/inbound-email', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/settings/inbound-email/oauth-status', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([imapData, oauthData]) => {
      if (!mounted) return;
      if (imapData.config) setConfig(imapData.config);
      if (imapData.status) setStatus(imapData.status);
      setOauthStatus(oauthData);
    }).catch(() => {}).finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, []);

  const applyPreset = (preset: typeof IMAP_PRESETS[0]) => {
    setConfig((c) => ({ ...c, host: preset.host, port: preset.port, secure: preset.secure }));
  };

  const testConnection = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/inbound-email/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: 'success', text: t.settings.imapTestOk });
      } else {
        setMsg({ type: 'error', text: `${t.settings.imapTestFail}: ${data.error ?? ''}` });
      }
    } catch {
      setMsg({ type: 'error', text: t.settings.imapTestFail });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/inbound-email', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.message || t.settings.imapSaveError }); return; }
      setConfig(data.config);
      if (data.status) setStatus(data.status);
      setMsg({
        type: 'success',
        text: data.baselinePending
          ? `${t.settings.imapSaved} Le email già presenti nella casella verranno ignorate — solo le nuove diventeranno ticket.`
          : t.settings.imapSaved,
      });
    } catch {
      setMsg({ type: 'error', text: t.settings.imapSaveError });
    } finally {
      setSaving(false);
    }
  };

  const disconnectGmail = async () => {
    setDisconnecting('gmail');
    try {
      await fetch('/api/settings/inbound-email/gmail', { method: 'DELETE', credentials: 'include' });
      await loadOAuthStatus();
    } catch { } finally { setDisconnecting(null); }
  };

  const disconnectMicrosoft = async () => {
    setDisconnecting('microsoft');
    try {
      await fetch('/api/settings/inbound-email/microsoft', { method: 'DELETE', credentials: 'include' });
      await loadOAuthStatus();
    } catch { } finally { setDisconnecting(null); }
  };

  if (loading) return <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>;

  return (
    <Section title={t.settings.imapTitle} icon={<MailOutline color="primary" />}>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t.settings.imapNote}
      </Typography>

      {msg && (
        <Alert severity={msg.type} sx={{ mb: 3 }} onClose={() => setMsg(null)}>{msg.text}</Alert>
      )}

      <Box display="flex" gap={2} flexWrap="wrap" alignItems="stretch">
        {/* Gmail */}
        {oauthStatus && (
          <OAuthProviderCard
            providerLabel="Gmail"
            providerColor="#EA4335"
            connectUrl="/api/settings/inbound-email/gmail/connect"
            available={oauthStatus.gmailAvailable}
            info={oauthStatus.gmail}
            onDisconnect={disconnectGmail}
            disconnecting={disconnecting === 'gmail'}
            t={t}
          />
        )}

        {/* Microsoft */}
        {oauthStatus && (
          <OAuthProviderCard
            providerLabel="Microsoft Outlook"
            providerColor="#0078d4"
            connectUrl="/api/settings/inbound-email/microsoft/connect"
            available={oauthStatus.microsoftAvailable}
            info={oauthStatus.microsoft}
            onDisconnect={disconnectMicrosoft}
            disconnecting={disconnecting === 'microsoft'}
            t={t}
          />
        )}

        {/* Altro (IMAP) */}
        <Box
          sx={{
            flex: 1, minWidth: 280,
            border: '1px solid',
            borderColor: (config.host && config.user) ? 'primary.main' : 'divider',
            borderRadius: 2, p: 2,
            display: 'flex', flexDirection: 'column', gap: 1.5,
            bgcolor: (config.host && config.user) ? 'primary.50' : 'transparent',
          }}
        >
          {/* Header */}
          <Box display="flex" alignItems="center" gap={1}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: (config.enabled && config.host) ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
            <Typography variant="subtitle2" fontWeight={700}>{t.settings.imapOtherTitle}</Typography>
            <Switch
              size="small"
              checked={config.enabled}
              onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
              sx={{ ml: 'auto' }}
            />
          </Box>

          {/* Provider label */}
          <TextField
            label={t.settings.imapLabel}
            value={config.label ?? ''}
            onChange={(e) => setConfig((c) => ({ ...c, label: e.target.value }))}
            size="small"
            fullWidth
            placeholder={t.settings.imapLabelPlaceholder}
          />

          {/* Host + Port */}
          <Box display="flex" gap={1}>
            <TextField
              label={t.settings.imapHost}
              value={config.host}
              onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
              size="small"
              sx={{ flex: 1 }}
              placeholder="imap.esempio.it"
            />
            <TextField
              label={t.settings.imapPort}
              value={config.port}
              onChange={(e) => setConfig((c) => ({ ...c, port: parseInt(e.target.value, 10) || 993 }))}
              size="small"
              sx={{ width: 88, flexShrink: 0 }}
              type="number"
              inputProps={{ min: 1, max: 65535 }}
            />
          </Box>

          {/* User */}
          <TextField
            label={t.settings.imapUser}
            value={config.user}
            onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value }))}
            size="small"
            fullWidth
            placeholder="support@miazienda.it"
            type="email"
            autoComplete="off"
          />

          {/* Password */}
          <TextField
            label={t.settings.imapPassword}
            value={config.password}
            onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
            size="small"
            fullWidth
            type="password"
            autoComplete="new-password"
          />

          {/* Folder + SSL */}
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              label={t.settings.imapFolder}
              value={config.folder}
              onChange={(e) => setConfig((c) => ({ ...c, folder: e.target.value }))}
              size="small"
              sx={{ flex: 1 }}
              placeholder="INBOX"
            />
            <Box display="flex" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
              <Typography variant="caption" color="text.secondary">SSL</Typography>
              <Switch
                size="small"
                checked={config.secure}
                onChange={(e) => setConfig((c) => ({ ...c, secure: e.target.checked }))}
              />
            </Box>
          </Box>

          {/* Routing */}
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t.settings.imapRoutingTitle}
            </Typography>
            <InboundRoutingFields config={config} setConfig={setConfig} />
          </Box>

          {/* Actions */}
          <Box display="flex" gap={1} mt={0.5}>
            <Button
              size="small"
              variant="outlined"
              startIcon={testing ? <CircularProgress size={14} color="inherit" /> : <WifiTethering fontSize="small" />}
              onClick={testConnection}
              disabled={testing || saving || !config.host || !config.user}
            >
              {testing ? t.settings.imapTesting : t.settings.imapTest}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save fontSize="small" />}
              onClick={save}
              disabled={saving || testing || !config.host || !config.user}
            >
              {saving ? t.settings.saving : t.settings.imapSave}
            </Button>
          </Box>

          {/* Status */}
          {status && (
            <Box p={1.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}>
              {!status.baselined ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="warning.main">Calibrazione in corso…</Typography>
                </Box>
              ) : (
                <Stack spacing={0.5}>
                  <Box display="flex" alignItems="center" gap={0.75}>
                    {status.lastError
                      ? <ErrorOutline sx={{ fontSize: 14 }} color="error" />
                      : <CheckCircleOutline sx={{ fontSize: 14 }} color="success" />}
                    <Typography variant="caption">
                      <strong>{t.settings.imapStatusLastPoll}:</strong>{' '}
                      {status.lastPollAt ? new Date(status.lastPollAt).toLocaleString('it-IT') : t.settings.imapStatusNever}
                    </Typography>
                  </Box>
                  {status.lastError && (
                    <Typography variant="caption" color="error.main" sx={{ pl: 2.75 }}>{status.lastError}</Typography>
                  )}
                  <Typography variant="caption" sx={{ pl: 2.75 }}>
                    <strong>{t.settings.imapStatusTickets}:</strong> {status.ticketsCreated}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Section>
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

  const [deleteTarget, setDeleteTarget] = useState<KbArticle | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setDialogOpen(true);
  };

  const openEdit = (article: KbArticle) => {
    setEditing(article);
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormCategory(article.category ?? '');
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
      <Box display="flex" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<Add />} size="small" onClick={openAdd} sx={{ borderRadius: 2 }}>
          {t.settings.kbAddArticle}
        </Button>
      </Box>

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
              helperText="Scrivi in modo chiaro e dettagliato. Il bot citerà questo testo nelle risposte."
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
