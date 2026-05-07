import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, TextField, Button,
  Alert, Divider, Chip, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, CircularProgress, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Stack, useMediaQuery, useTheme,
  Avatar, Snackbar,
} from '@mui/material';
import { Add, Delete, Save, Lock, Person, LocationOn, Category, Group, NotificationsActive, Phone, PhotoCamera, Check, Business, Receipt, EditOutlined, Close } from '@mui/icons-material';
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
  label,
  items,
  onSave,
  saving,
}: {
  label: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
  saving: boolean;
}) {
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
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Nessun elemento.</Typography>
        )}
      </List>

      <Box display="flex" gap={1} mt={2} alignItems="center">
        <TextField
          size="small"
          fullWidth
          placeholder={`Aggiungi ${label.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving || editIdx !== null}
        />
        <Button variant="outlined" startIcon={<Add />} onClick={add} disabled={!newItem.trim() || saving || editIdx !== null}>
          Aggiungi
        </Button>
        {saving && <CircularProgress size={18} />}
        {!saving && savedFlash && <Check fontSize="small" color="success" />}
      </Box>
    </Box>
  );
}

export default function Settings() {
  const { user } = useAuth();
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
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={t.settings.tabProfile} />
          <Tab label={t.settings.tabNotifications} />
          {isAdmin && <Tab label={t.settings.tabSystem} />}
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
                Clicca sull'icona per cambiare la foto
              </Typography>
              {avatarUrl && (
                <Box mt={0.5}>
                  <Button
                    size="small"
                    color="error"
                    sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }}
                    onClick={() => setAvatarUrl('')}
                  >
                    Rimuovi foto
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
              label="sede"
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
              label="categoria"
              items={categories}
              onSave={saveCategories}
              saving={catSaving}
            />
          </Section>

          <Section title={t.settings.manageGroups} icon={<Group color="primary" />}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t.settings.groupsNote}
            </Typography>
            <ListEditor
              label="gruppo"
              items={groups}
              onSave={saveGroups}
              saving={grpSaving}
            />
          </Section>
        </TabPanel>
      )}
    </Box>
  );
}
