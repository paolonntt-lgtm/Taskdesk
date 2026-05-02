import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Tabs, Tab, TextField, Button,
  Alert, Divider, Chip, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, CircularProgress,
} from '@mui/material';
import { Add, Delete, Save, Lock, Person, LocationOn, Category, Group } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
function TabPanel({ children, value, index }: TabPanelProps) {
  return <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>;
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
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setList(items); setDirty(false); }, [items]);

  const add = () => {
    const trimmed = newItem.trim();
    if (!trimmed || list.includes(trimmed)) return;
    setList((l) => [...l, trimmed]);
    setNewItem('');
    setDirty(true);
  };

  const remove = (idx: number) => {
    setList((l) => l.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

  return (
    <Box>
      <List dense disablePadding>
        {list.map((item, idx) => (
          <ListItem key={idx} disableGutters divider sx={{ py: 0.5 }}>
            <ListItemText primary={item} />
            <ListItemSecondaryAction>
              <IconButton edge="end" size="small" onClick={() => remove(idx)} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Nessun elemento.</Typography>
        )}
      </List>

      <Box display="flex" gap={1} mt={2}>
        <TextField
          size="small"
          fullWidth
          placeholder={`Aggiungi ${label.toLowerCase()}...`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKey}
        />
        <Button variant="outlined" startIcon={<Add />} onClick={add} disabled={!newItem.trim()}>
          Aggiungi
        </Button>
      </Box>

      {dirty && (
        <Box mt={2} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={() => onSave(list)}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState(0);

  // Profile state
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mainLocation, setMainLocation] = useState(user?.mainLocation ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin settings state
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [locSaving, setLocSaving] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [grpSaving, setGrpSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/settings/locations', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setLocations(d.value ?? [])).catch(() => {});
    fetch('/api/settings/categories', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setCategories(d.value ?? [])).catch(() => {});
    fetch('/api/settings/groups', { credentials: 'include' })
      .then((r) => r.json()).then((d) => setGroups(d.value ?? [])).catch(() => {});
  }, [isAdmin]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mainLocation: mainLocation || null }),
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
      setAdminMsg({ type: 'success', text: 'Sedi aggiornate.' });
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
      setAdminMsg({ type: 'success', text: 'Categorie aggiornate.' });
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
      setAdminMsg({ type: 'success', text: 'Gruppi aggiornati.' });
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
              label={t.settings.mainLocation}
              value={mainLocation}
              onChange={(e) => setMainLocation(e.target.value)}
              fullWidth
              placeholder="Es: Sede A, Milano..."
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

      {/* ── SISTEMA (admin only) ── */}
      {isAdmin && (
        <TabPanel value={tab} index={1}>
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
