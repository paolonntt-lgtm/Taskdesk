import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider, MenuItem,
  TextField, Typography,
} from '@mui/material';
import { ContentCopy, LinkOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type WorkspaceMember = {
  userId: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  billingOrganizationName: string | null;
};

type WorkspaceInvitation = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  expiresAt: string;
};

export default function WorkspaceManagement() {
  const { user, switchWorkspace } = useAuth();
  const { lang } = useLanguage();
  const it = lang === 'it';
  const activeWorkspaceId = (user as any)?.activeWorkspaceId ?? user?.organizationId;
  const billingOrganizationId = (user as any)?.billingOrganizationId;
  const isSharedWorkspace = (user as any)?.isSharedWorkspace === true;
  const sharingEnabled = (user as any)?.externalSharingEnabled === true;
  const canCreateWorkspace = user?.role === 'admin' && activeWorkspaceId === billingOrganizationId && !isSharedWorkspace;
  const workspaces = ((user as any)?.workspaces ?? []) as Array<{ id: number; name: string }>;

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(isSharedWorkspace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState('');
  const queryClient = useQueryClient();
  const invitationWorkspaceId = Number(activeWorkspaceId ?? 0);
  const invitationQueryKey = ['workspace-invitations', invitationWorkspaceId] as const;
  const invitationsQuery = useQuery<{ invitations: WorkspaceInvitation[] }>({
    queryKey: invitationQueryKey,
    enabled: isSharedWorkspace && !!activeWorkspaceId,
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${invitationWorkspaceId}/invitations`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || 'Could not load workspace invitations');
      return data;
    },
  });
  const invitations = invitationsQuery.data?.invitations ?? [];

  const loadMembers = async () => {
    if (!isSharedWorkspace || !activeWorkspaceId) return;
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Could not load workspace members');
    setMembers(data.members ?? []);
  };

  const loadInvitations = async () => {
    const result = await invitationsQuery.refetch();
    if (result.error) throw result.error;
  };

  useEffect(() => {
    let cancelled = false;
    if (!isSharedWorkspace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMembers([]);
    fetch(`/api/workspaces/${activeWorkspaceId}/members`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || 'Could not load workspace members');
        if (!cancelled) setMembers(data.members ?? []);
      })
      .catch((reason) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, isSharedWorkspace]);

  useEffect(() => {
    if (invitationsQuery.error) {
      setError((invitationsQuery.error as Error).message || (it ? 'Impossibile caricare gli inviti.' : 'Could not load invitations.'));
    }
  }, [invitationsQuery.error, it]);

  const createWorkspace = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile creare lo spazio.' : 'Could not create workspace.'));
      setWorkspaceName('');
      await switchWorkspace(data.workspace.id);
      setNotice(it ? 'Spazio creato. Puoi invitare collaboratori esterni da qui.' : 'Workspace created. You can invite external collaborators here.');
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const inviteAccount = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile creare l’invito.' : 'Could not create invitation.'));
      setInviteEmail('');
      if (data.emailSent) {
        await loadInvitations();
        setNotice(it
          ? `Invito inviato a ${inviteEmail.trim()}. Potrà accedere solo dopo averlo accettato.`
          : `Invitation sent to ${inviteEmail.trim()}. They can join only after accepting it.`);
      } else {
        await loadMembers();
        setNotice(it ? 'Account aggiunto allo spazio.' : 'Account added to the workspace.');
      }
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const setSharing = async (enabled: boolean) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/sharing`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile modificare la condivisione.' : 'Could not update sharing.'));
      await switchWorkspace(activeWorkspaceId);
      setNotice(enabled
        ? (it ? 'Condivisione esterna attivata.' : 'External sharing enabled.')
        : (it ? 'Condivisione disattivata e link revocati.' : 'Sharing disabled and links revoked.'));
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const createShareLink = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/invite-link`, {
        method: 'POST', credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile creare il link.' : 'Could not create link.'));
      setShareUrl(data.inviteUrl);
      setShareExpiresAt(data.expiresAt);
      await switchWorkspace(activeWorkspaceId);
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const revokeShareLink = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/invite-link`, {
        method: 'DELETE', credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile revocare il link.' : 'Could not revoke link.'));
      setShareUrl(''); setShareExpiresAt('');
      setNotice(it ? 'Link condivisibile revocato.' : 'Share link revoked.');
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const updateMember = async (member: WorkspaceMember, changes: { role?: 'admin' | 'user'; remove?: boolean }) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/workspaces/${activeWorkspaceId}/members/${member.userId}`, {
        method: changes.remove ? 'DELETE' : 'PATCH',
        credentials: 'include',
        headers: changes.remove ? undefined : { 'Content-Type': 'application/json' },
        body: changes.remove ? undefined : JSON.stringify({ role: changes.role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile aggiornare il membro.' : 'Could not update member.'));
      await loadMembers();
      if (changes.remove && member.userId === user?.id) await switchWorkspace(billingOrganizationId);
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const revokeInvitation = async (invitation: WorkspaceInvitation) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspaces/${invitationWorkspaceId}/invitations/${invitation.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || (it ? 'Impossibile revocare l’invito.' : 'Could not revoke invitation.'));
      await queryClient.invalidateQueries({ queryKey: invitationQueryKey });
      setNotice(it ? 'Invito revocato. La condivisione esterna resta attiva.' : 'Invitation revoked. External sharing remains enabled.');
    } catch (reason: any) {
      setError(reason?.message || (it ? 'Operazione non riuscita.' : 'The action could not be completed.'));
    } finally { setBusy(false); }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(it ? 'Link copiato.' : 'Link copied.');
    } catch {
      setError(it ? 'Copia non riuscita: seleziona e copia il link.' : 'Could not copy. Select and copy the link.');
    }
  };

  return (
    <Box maxWidth={900} mx="auto">
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {it ? 'Gestione spazi di lavoro' : 'Workspace management'}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {it ? `Spazio attivo: ${(user as any)?.organizationName ?? ''}. Per gestirne un altro, selezionalo dal menu in basso a sinistra.` : `Active workspace: ${(user as any)?.organizationName ?? ''}. Select another from the bottom-left menu to manage it.`}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

      {canCreateWorkspace && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>{it ? 'Crea uno spazio aggiuntivo' : 'Create an additional workspace'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {it ? 'Lo spazio avrà dati e permessi separati. Potrai condividerlo invitando account TaskDesk attivi di altre organizzazioni.' : 'The workspace has separate data and permissions. You can share it by inviting active TaskDesk accounts from other organizations.'}
            </Typography>
            <Box display="flex" gap={1}>
              <TextField fullWidth size="small" label={it ? 'Nome dello spazio' : 'Workspace name'} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
              <Button variant="contained" disabled={busy || workspaceName.trim().length < 2} onClick={() => void createWorkspace()}>{it ? 'Crea' : 'Create'}</Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {isSharedWorkspace && user?.role === 'admin' && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>{(user as any)?.organizationName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {sharingEnabled
                ? (it ? 'La collaborazione con account di altre organizzazioni è attiva.' : 'Collaboration with accounts from other organizations is enabled.')
                : (it ? 'Questo spazio è interno. Invitare un account esterno attiverà la condivisione.' : 'This workspace is internal. Inviting an external account will enable sharing.')}
            </Typography>
            <Button size="small" variant="outlined" color={sharingEnabled ? 'warning' : 'primary'} disabled={busy} onClick={() => void setSharing(!sharingEnabled)}>
              {sharingEnabled ? (it ? 'Disattiva condivisione' : 'Disable sharing') : (it ? 'Attiva condivisione' : 'Enable sharing')}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={700}>{it ? 'Invita un account TaskDesk attivo' : 'Invite an active TaskDesk account'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {it ? 'Gli account esterni ricevono un invito all’indirizzo email del loro account; potranno accedere solo dopo averlo accettato. La fatturazione resta legata alla loro organizzazione.' : 'External accounts receive an invitation at their account email and join only after accepting. Billing stays with their own organization.'}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <TextField size="small" label="Email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} sx={{ flex: '1 1 240px' }} />
              <TextField select size="small" label={it ? 'Ruolo' : 'Role'} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'user' | 'admin')} sx={{ minWidth: 160 }}>
                <MenuItem value="user">{it ? 'Collaboratore' : 'Collaborator'}</MenuItem>
                <MenuItem value="admin">{it ? 'Amministratore' : 'Administrator'}</MenuItem>
              </TextField>
              <Button variant="contained" disabled={busy || !inviteEmail.trim()} onClick={() => void inviteAccount()}>{it ? 'Invita' : 'Invite'}</Button>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={700}>{it ? 'Inviti in attesa' : 'Pending invitations'}</Typography>
            {invitationsQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 2 }} /> : invitations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {it ? 'Non ci sono inviti in attesa.' : 'There are no pending invitations.'}
              </Typography>
            ) : invitations.map((invitation) => (
              <Box key={invitation.id} display="flex" alignItems="center" gap={1} py={1} sx={{ borderBottom: '1px solid', borderColor: 'divider' }} data-testid={`row-pending-invitation-${invitation.id}`}>
                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" fontWeight={700} noWrap data-testid={`text-invitation-recipient-${invitation.id}`}>{invitation.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{invitation.email}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {invitation.role === 'admin' ? (it ? 'Amministratore' : 'Administrator') : (it ? 'Collaboratore' : 'Collaborator')}
                    {' · '}{it ? 'Scade il' : 'Expires'}{' '}
                    {new Date(invitation.expiresAt).toLocaleString(it ? 'it-IT' : 'en-GB')}
                  </Typography>
                </Box>
                <Button color="error" startIcon={<LinkOff />} disabled={busy} onClick={() => void revokeInvitation(invitation)} data-testid={`button-revoke-invitation-${invitation.id}`}>
                  {it ? 'Revoca' : 'Revoke'}
                </Button>
              </Box>
            ))}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={700}>{it ? 'Link condivisibile' : 'Share link'}</Typography>
            {shareUrl ? (
              <Box display="flex" gap={1} alignItems="center" mt={1}>
                <TextField fullWidth size="small" value={shareUrl} InputProps={{ readOnly: true }} helperText={shareExpiresAt ? `${it ? 'Scade il' : 'Expires'} ${new Date(shareExpiresAt).toLocaleString(it ? 'it-IT' : 'en-GB')}` : undefined} />
                <Button startIcon={<ContentCopy />} onClick={() => void copy(shareUrl)}>{it ? 'Copia' : 'Copy'}</Button>
                <Button color="error" startIcon={<LinkOff />} disabled={busy} onClick={() => void revokeShareLink()}>{it ? 'Revoca' : 'Revoke'}</Button>
              </Box>
            ) : (
              <Box display="flex" gap={1} mt={1}>
                <Button variant="outlined" disabled={busy} onClick={() => void createShareLink()}>{it ? 'Genera link' : 'Generate link'}</Button>
                <Button color="error" startIcon={<LinkOff />} disabled={busy} onClick={() => void revokeShareLink()}>{it ? 'Revoca link attivo' : 'Revoke active link'}</Button>
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={700}>{it ? 'Membri e ruoli' : 'Members and roles'}</Typography>
            {loading ? <CircularProgress size={24} sx={{ mt: 2 }} /> : members.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{it ? 'Nessun membro.' : 'No members yet.'}</Typography>
            ) : members.map((member) => (
              <Box key={member.userId} display="flex" alignItems="center" gap={1} py={1} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" fontWeight={700} noWrap>{member.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{member.email} · {member.billingOrganizationName ?? (it ? 'Organizzazione non disponibile' : 'Billing organization unavailable')}</Typography>
                </Box>
                <TextField select size="small" value={member.role} disabled={busy} onChange={(event) => void updateMember(member, { role: event.target.value as 'user' | 'admin' })} sx={{ minWidth: 135 }}>
                  <MenuItem value="user">{it ? 'Collaboratore' : 'Collaborator'}</MenuItem>
                  <MenuItem value="admin">{it ? 'Amministratore' : 'Administrator'}</MenuItem>
                </TextField>
                <Button color="error" disabled={busy || member.userId === user?.id} onClick={() => void updateMember(member, { remove: true })}>{it ? 'Rimuovi' : 'Remove'}</Button>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
      {!isSharedWorkspace && !canCreateWorkspace && (
        <Alert severity="info">{it ? 'Non hai permessi per gestire spazi in questa organizzazione.' : 'You do not have permission to manage workspaces in this organization.'}</Alert>
      )}
      {workspaces.length === 0 && !canCreateWorkspace && !isSharedWorkspace && (
        <Alert severity="info">{it ? 'Non sono disponibili spazi aggiuntivi.' : 'No additional workspaces are available.'}</Alert>
      )}
      {busy && <CircularProgress size={22} sx={{ position: 'fixed', bottom: 24, right: 24 }} />}
    </Box>
  );
}
