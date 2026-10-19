import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Avatar, Divider,
  CircularProgress, Alert, TextField, InputAdornment, Tooltip,
  Tabs, Tab, Badge, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Collapse, Select, MenuItem, FormControl,
} from '@mui/material';
import {
  Business, Search, AdminPanelSettings, Person, AccessTime, ConfirmationNumber,
  BugReport, ExpandMore, ExpandLess, CheckCircle, Reply, Refresh, Visibility, VisibilityOff,
  FiberManualRecord,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

interface OrgUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  avatarUrl: string | null;
}

interface Organization {
  id: number;
  name: string;
  createdAt: string | null;
  hiddenFromSuperadmin: boolean;
  totalTickets: number;
  users: OrgUser[];
}

interface BugReport {
  id: number;
  userName: string;
  userEmail: string;
  organizationId: number | null;
  organizationName: string | null;
  description: string;
  currentPage: string;
  status: 'pending' | 'replied' | 'processed';
  replyText: string | null;
  repliedAt: string | null;
  processedAt: string | null;
  isRead: boolean;
  createdAt: string | null;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale);
}

function formatDateTime(iso: string | null, locale: string, never: string): string {
  if (!iso) return never;
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateTimeShort(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export default function SuperAdmin() {
  const { t, lang } = useLanguage();
  const sa = t.superadmin;
  const [tab, setTab] = useState(0);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [updatingOrganizationId, setUpdatingOrganizationId] = useState<number | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [bugLoading, setBugLoading] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [bugTotal, setBugTotal] = useState(0);
  const [bugPage, setBugPage] = useState(1);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [replyDialogId, setReplyDialogId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const dateLocale = lang === 'it' ? 'it-IT' : 'en-GB';

  const loadOrganizations = useCallback(async (includeHidden: boolean, quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/superadmin?includeHidden=${includeHidden}`, { credentials: 'include' });
      if (!response.ok) throw new Error(sa.accessDenied);
      const data = await response.json();
      setOrgs(data.organizations);
      setHiddenCount(data.hiddenCount);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [sa.accessDenied]);

  useEffect(() => {
    void loadOrganizations(showHidden);
  }, [loadOrganizations, showHidden]);

  useEffect(() => {
    const refreshWhileVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadOrganizations(showHidden, true);
      }
    };
    const interval = window.setInterval(refreshWhileVisible, 30_000);
    document.addEventListener('visibilitychange', refreshWhileVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, [loadOrganizations, showHidden]);

  const toggleOrganizationVisibility = async (org: Organization) => {
    const hiddenFromSuperadmin = !org.hiddenFromSuperadmin;
    setUpdatingOrganizationId(org.id);
    setVisibilityError(null);
    try {
      const response = await fetch(`/api/superadmin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenFromSuperadmin }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || sa.visibilityUpdateError);
      }
      setOrgs((current) => showHidden
        ? current.map((item) => item.id === org.id ? { ...item, hiddenFromSuperadmin } : item)
        : hiddenFromSuperadmin ? current.filter((item) => item.id !== org.id) : current);
      setHiddenCount((count) => Math.max(0, count + (hiddenFromSuperadmin ? 1 : -1)));
    } catch (e: any) {
      setVisibilityError(e.message || sa.visibilityUpdateError);
    } finally {
      setUpdatingOrganizationId(null);
    }
  };

  const loadBugReports = useCallback(async (page = 1) => {
    setBugLoading(true);
    setBugError(null);
    try {
      const r = await fetch(`/api/superadmin/bug-reports?page=${page}`, { credentials: 'include' });
      if (!r.ok) throw new Error(sa.accessDenied);
      const data = await r.json();
      setBugReports(data.reports);
      setBugTotal(data.total);
      setBugPage(data.page);
      setPendingCount(data.pendingCount);
    } catch (e: any) {
      setBugError(e.message);
    } finally {
      setBugLoading(false);
    }
  }, [sa.accessDenied]);

  useEffect(() => {
    if (tab === 1) loadBugReports(1);
  }, [tab]);

  const markRead = async (id: number) => {
    await fetch(`/api/superadmin/bug-reports/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    });
    setBugReports((prev) => prev.map((r) => r.id === id ? { ...r, isRead: true } : r));
    setPendingCount((c) => Math.max(0, c - 1));
  };

  const markProcessed = async (id: number) => {
    const resp = await fetch(`/api/superadmin/bug-reports/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'processed' }),
    });
    if (resp.ok) {
      await loadBugReports(bugPage);
    }
  };

  const sendReply = async () => {
    if (!replyDialogId || !replyText.trim()) return;
    setReplying(true);
    try {
      const resp = await fetch(`/api/superadmin/bug-reports/${replyDialogId}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText: replyText.trim() }),
      });
      if (resp.ok) {
        setReplyDialogId(null);
        setReplyText('');
        await loadBugReports(bugPage);
      } else {
        const data = await resp.json().catch(() => ({}));
        alert(data.error || 'Errore invio risposta');
      }
    } finally {
      setReplying(false);
    }
  };

  const handleExpandReport = (id: number, isRead: boolean) => {
    if (expandedReport === id) {
      setExpandedReport(null);
    } else {
      setExpandedReport(id);
      if (!isRead) markRead(id);
    }
  };

  const filtered = orgs.filter((org) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      org.name.toLowerCase().includes(q) ||
      org.users.some(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    );
  });

  const filteredReports = bugReports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const totalUsers = orgs.reduce((sum, o) => sum + o.users.length, 0);
  const totalTickets = orgs.reduce((sum, o) => sum + o.totalTickets, 0);

  const statusColor = (status: string) => {
    if (status === 'pending') return 'warning';
    if (status === 'replied') return 'info';
    if (status === 'processed') return 'success';
    return 'default';
  };

  const statusLabel = (status: string) => {
    if (status === 'pending') return sa.statusPending;
    if (status === 'replied') return sa.statusReplied;
    if (status === 'processed') return sa.statusProcessed;
    return status;
  };

  if (loading && tab === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={sa.tabSubscribers} />
        <Tab
          label={
            <Badge badgeContent={pendingCount} color="error" max={99}>
              <Box pr={pendingCount > 0 ? 1.5 : 0}>{sa.tabBugReports}</Box>
            </Badge>
          }
        />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box mb={3} display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{sa.subscribersTitle}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {orgs.length} {sa.orgs} · {totalUsers} {sa.activeUsers} · {totalTickets} {sa.totalTickets}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" flexWrap="wrap" gap={1}>
              {(hiddenCount > 0 || showHidden) && (
                <Button
                  data-testid="toggle-hidden-organizations"
                  size="small"
                  startIcon={showHidden ? <VisibilityOff /> : <Visibility />}
                  onClick={() => setShowHidden((current) => !current)}
                >
                  {showHidden ? sa.hideHiddenOrganizations : `${sa.showHiddenOrganizations} (${hiddenCount})`}
                </Button>
              )}
              <TextField
                size="small"
                placeholder={sa.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 260 }}
              />
            </Box>
          </Box>

          {visibilityError && <Alert severity="error" sx={{ mb: 2 }}>{visibilityError}</Alert>}

          {filtered.length === 0 && (
            <Alert severity="info">{sa.noResults}</Alert>
          )}

          <Box display="flex" flexDirection="column" gap={2}>
            {filtered.map((org) => (
              <Card
                key={org.id}
                data-testid={`organization-card-${org.id}`}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  ...(org.hiddenFromSuperadmin && { borderStyle: 'dashed', bgcolor: 'action.hover' }),
                }}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                    <Box
                      sx={{
                        width: 38, height: 38, borderRadius: 1.5,
                        bgcolor: 'primary.main', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <Business sx={{ color: '#fff', fontSize: 20 }} />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>
                        {org.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {org.users.length} {org.users.length === 1 ? sa.userSingular : sa.userPlural} ·{' '}
                        {sa.registeredOn} {formatDate(org.createdAt, dateLocale)}
                      </Typography>
                    </Box>
                    {org.totalTickets > 0 && (
                      <Tooltip title={sa.totalTicketsTooltip}>
                        <Chip
                          icon={<ConfirmationNumber sx={{ fontSize: '14px !important' }} />}
                          label={org.totalTickets}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700, fontSize: 12 }}
                        />
                      </Tooltip>
                    )}
                    {org.hiddenFromSuperadmin && <Chip label={sa.hiddenOrganization} size="small" variant="outlined" />}
                    <Chip
                      label={`#${org.id}`}
                      size="small"
                      sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary' }}
                      variant="outlined"
                    />
                    <Tooltip title={org.hiddenFromSuperadmin ? sa.showOrganization : sa.hideOrganization}>
                      <span>
                        <IconButton
                          data-testid={`toggle-organization-visibility-${org.id}`}
                          aria-label={org.hiddenFromSuperadmin ? sa.showOrganization : sa.hideOrganization}
                          size="small"
                          disabled={updatingOrganizationId !== null}
                          onClick={() => void toggleOrganizationVisibility(org)}
                        >
                          {org.hiddenFromSuperadmin ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>

                  {org.users.length > 0 && <Divider sx={{ mb: 1.5 }} />}

                  <Box display="flex" flexDirection="column" gap={1}>
                    {org.users.map((u) => (
                      <Box
                        key={u.id}
                        display="flex"
                        alignItems="center"
                        gap={1.5}
                        sx={{ py: 0.75, px: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}
                      >
                        <Avatar
                          src={u.avatarUrl ?? undefined}
                          sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'secondary.main' }}
                        >
                          {u.name.charAt(0)}
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Box display="flex" alignItems="center" gap={0.75}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {u.name}
                            </Typography>
                            {u.role === 'admin' && (
                              <Tooltip title={sa.orgAdminTooltip}>
                                <AdminPanelSettings sx={{ fontSize: 15, color: 'primary.main' }} />
                              </Tooltip>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {u.email}
                          </Typography>
                        </Box>
                        <Box textAlign="right" sx={{ flexShrink: 0 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {sa.subscribedOn} {formatDate(u.createdAt, dateLocale)}
                          </Typography>
                          <Tooltip title={sa.lastLoginTooltip}>
                            <Box display="flex" alignItems="center" gap={0.5} justifyContent="flex-end">
                              <AccessTime sx={{ fontSize: 11, color: u.lastLoginAt ? 'success.main' : 'text.disabled' }} />
                              <Typography
                                variant="caption"
                                sx={{ color: u.lastLoginAt ? 'success.main' : 'text.disabled' }}
                              >
                                {formatDateTime(u.lastLoginAt, dateLocale, sa.lastLoginNever)}
                              </Typography>
                            </Box>
                          </Tooltip>
                          <Tooltip title={sa.onlineTooltip}>
                            <Box display="flex" alignItems="center" gap={0.5} justifyContent="flex-end">
                              <FiberManualRecord
                                sx={{
                                  fontSize: 9,
                                  color: u.isOnline ? 'success.main' : 'text.disabled',
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{ color: u.isOnline ? 'success.main' : 'text.secondary' }}
                              >
                                {u.isOnline
                                  ? sa.onlineLabel
                                  : u.lastSeenAt
                                    ? `${sa.lastOnlinePrefix} ${formatDateTime(u.lastSeenAt, dateLocale, sa.neverOnline)}`
                                    : sa.neverOnline}
                              </Typography>
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>
                    ))}
                    {org.users.length === 0 && (
                      <Box display="flex" alignItems="center" gap={1} sx={{ py: 0.5, px: 1, color: 'text.disabled' }}>
                        <Person fontSize="small" />
                        <Typography variant="caption">{sa.noActiveUsers}</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box mb={3} display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{sa.bugReportsTitle}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {bugTotal} {sa.bugReportsTotal} · {pendingCount} {sa.bugReportsPending}
              </Typography>
            </Box>
            <Box display="flex" gap={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="all">{sa.filterAll}</MenuItem>
                  <MenuItem value="pending">{sa.statusPending}</MenuItem>
                  <MenuItem value="replied">{sa.statusReplied}</MenuItem>
                  <MenuItem value="processed">{sa.statusProcessed}</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={sa.refresh}>
                <IconButton onClick={() => loadBugReports(bugPage)} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {bugLoading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          {bugError && <Alert severity="error">{bugError}</Alert>}

          {!bugLoading && !bugError && filteredReports.length === 0 && (
            <Alert severity="info">{sa.noBugReports}</Alert>
          )}

          <Box display="flex" flexDirection="column" gap={1.5}>
            {filteredReports.map((report) => (
              <Card
                key={report.id}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderColor: !report.isRead ? 'error.light' : undefined,
                  bgcolor: !report.isRead ? 'error.50' : undefined,
                }}
              >
                <CardContent sx={{ pb: '12px !important' }}>
                  <Box
                    display="flex"
                    alignItems="flex-start"
                    gap={1.5}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleExpandReport(report.id, report.isRead)}
                  >
                    <Box
                      sx={{
                        width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                        bgcolor: report.status === 'processed' ? 'success.light' :
                          report.status === 'replied' ? 'info.light' : 'error.light',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <BugReport sx={{ fontSize: 18, color: 'white' }} />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {report.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {report.userEmail}
                        </Typography>
                        {!report.isRead && (
                          <Chip label={sa.unread} size="small" color="error" sx={{ fontSize: 10, height: 18 }} />
                        )}
                      </Box>
                      <Box display="flex" alignItems="center" gap={1} mt={0.25} flexWrap="wrap">
                        <Chip
                          label={statusLabel(report.status)}
                          size="small"
                          color={statusColor(report.status) as any}
                          sx={{ fontSize: 11, height: 20 }}
                        />
                        {report.organizationName && (
                          <Chip
                            icon={<Business sx={{ fontSize: '11px !important' }} />}
                            label={report.organizationName}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 11, height: 20 }}
                          />
                        )}
                        {report.currentPage && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }} noWrap>
                            {report.currentPage}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTimeShort(report.createdAt, dateLocale)}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" sx={{ flexShrink: 0 }}>
                      {expandedReport === report.id ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>

                  <Collapse in={expandedReport === report.id}>
                    <Box mt={2}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                        {sa.descriptionLabel}
                      </Typography>
                      <Box
                        sx={{
                          mt: 0.75, p: 1.5, borderRadius: 1.5,
                          bgcolor: 'action.hover',
                          fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        }}
                      >
                        {report.description}
                      </Box>

                      {report.replyText && (
                        <Box mt={2}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                            {sa.replyLabel}
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.75, p: 1.5, borderRadius: 1.5,
                              borderLeft: '3px solid',
                              borderColor: 'info.main',
                              bgcolor: 'info.50',
                              fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                            }}
                          >
                            {report.replyText}
                          </Box>
                          {report.repliedAt && (
                            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                              {sa.repliedAt} {formatDateTimeShort(report.repliedAt, dateLocale)}
                            </Typography>
                          )}
                        </Box>
                      )}

                      <Box display="flex" gap={1} mt={2} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Reply />}
                          onClick={() => { setReplyDialogId(report.id); setReplyText(''); }}
                        >
                          {sa.replyButton}
                        </Button>
                        {report.status !== 'processed' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<CheckCircle />}
                            onClick={() => markProcessed(report.id)}
                          >
                            {sa.markProcessed}
                          </Button>
                        )}
                        {report.status === 'processed' && report.processedAt && (
                          <Typography variant="caption" color="success.main" sx={{ alignSelf: 'center' }}>
                            {sa.processedOn} {formatDateTimeShort(report.processedAt, dateLocale)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            ))}
          </Box>

          {bugTotal > 20 && (
            <Box display="flex" justifyContent="center" gap={1} mt={2}>
              <Button disabled={bugPage <= 1} onClick={() => loadBugReports(bugPage - 1)} size="small">
                {sa.prevPage}
              </Button>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                {bugPage} / {Math.ceil(bugTotal / 20)}
              </Typography>
              <Button disabled={bugPage >= Math.ceil(bugTotal / 20)} onClick={() => loadBugReports(bugPage + 1)} size="small">
                {sa.nextPage}
              </Button>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={replyDialogId !== null} onClose={() => setReplyDialogId(null)} fullWidth maxWidth="sm">
        <DialogTitle>{sa.replyDialogTitle}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={4}
            fullWidth
            placeholder={sa.replyPlaceholder}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyDialogId(null)}>{sa.cancel}</Button>
          <Button
            variant="contained"
            disabled={!replyText.trim() || replying}
            onClick={sendReply}
          >
            {replying ? sa.replying : sa.sendReply}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
