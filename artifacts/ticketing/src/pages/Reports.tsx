import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Divider, List, ListItem, Chip } from '@mui/material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import {
  useGetStatsByStatus, useGetStatsByCategory, useGetStatsByLocation,
  useGetStatsByPriority, useGetStatsByAssignee, useGetTicketTrend,
} from '@workspace/api-client-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const COLORS = ['#1976d2', '#ed6c02', '#2e7d32', '#9c27b0', '#d32f2f', '#0288d1'];

interface LeaderEntry { id: number; name: string; count: number }
interface Leaderboard { openers: LeaderEntry[]; commenters: LeaderEntry[]; resolvers: LeaderEntry[] }

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  overdueTickets: number;
  avgResolutionHours: number | null;
}

interface AssigneeResolution {
  id: number;
  name: string;
  avgHours: number;
  count: number;
  minHours: number;
  maxHours: number;
}

interface GroupResolution {
  name: string;
  avgHours: number;
  count: number;
  minHours: number;
  maxHours: number;
}

interface ResolutionStats {
  byAssignee: AssigneeResolution[];
  overall: { avgHours: number | null; count: number };
  buckets: { bucket: string; count: number }[];
}

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];

function formatDuration(hours: number, t: { statsHours: string; statsDays: string }): string {
  if (hours < 24) return `${hours}${t.statsHours}`;
  return `${(hours / 24).toFixed(1)}${t.statsDays}`;
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={800} color={color} lineHeight={1.1}>
          {value}
        </Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function LeaderboardCard({ title, entries, unit, color }: {
  title: string; entries: LeaderEntry[]; unit: string; color: string
}) {
  const max = entries[0]?.count ?? 1;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" mb={2}>{title}</Typography>
        {entries.length === 0 ? (
          <Typography color="text.secondary" fontSize={13}>Nessun dato disponibile</Typography>
        ) : (
          <List disablePadding>
            {entries.map((entry, i) => (
              <React.Fragment key={entry.id}>
                {i > 0 && <Divider component="li" />}
                <ListItem disableGutters sx={{ gap: 1.5, py: 1 }}>
                  <Typography fontSize={i === 0 ? 22 : 16} width={28} textAlign="center">{MEDALS[i]}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={i === 0 ? 700 : 500}>{entry.name}</Typography>
                      <Chip label={`${entry.count} ${unit}`} size="small" sx={{ bgcolor: color + '18', color, fontWeight: 700, fontSize: 11 }} />
                    </Box>
                    <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(entry.count / max) * 100}%`, bgcolor: i === 0 ? color : color + '66', borderRadius: 1, transition: 'width 0.6s' }} />
                    </Box>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const theme = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [resolutionStats, setResolutionStats] = useState<ResolutionStats | null>(null);
  const [resolutionByCategory, setResolutionByCategory] = useState<GroupResolution[]>([]);
  const [resolutionByPriority, setResolutionByPriority] = useState<GroupResolution[]>([]);

  useEffect(() => {
    fetch('/api/stats/leaderboard', { credentials: 'include' })
      .then((r) => r.json()).then(setLeaderboard).catch(() => {});
    fetch('/api/stats/dashboard', { credentials: 'include' })
      .then((r) => r.json()).then(setDashStats).catch(() => {});
    if (isAdmin) {
      fetch('/api/stats/resolution-by-assignee', { credentials: 'include' })
        .then((r) => r.json()).then(setResolutionStats).catch(() => {});
      fetch('/api/stats/resolution-by-category', { credentials: 'include' })
        .then((r) => r.json()).then(setResolutionByCategory).catch(() => {});
      fetch('/api/stats/resolution-by-priority', { credentials: 'include' })
        .then((r) => r.json()).then(setResolutionByPriority).catch(() => {});
    }
  }, [isAdmin]);

  const statsOpts = { query: { staleTime: 30_000 } as any };
  const { data: statusStats, isLoading: s1 } = useGetStatsByStatus(statsOpts);
  const { data: categoryStats, isLoading: s2 } = useGetStatsByCategory(statsOpts);
  const { data: locationStats, isLoading: s3 } = useGetStatsByLocation(statsOpts);
  const { data: priorityStats, isLoading: s4 } = useGetStatsByPriority(statsOpts);
  const { data: assigneeStats, isLoading: s5 } = useGetStatsByAssignee(statsOpts);
  const { data: trendStats, isLoading: s6 } = useGetTicketTrend(statsOpts);

  if (s1 || s2 || s3 || s4 || s5 || s6) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const avgLabel = resolutionStats?.overall.avgHours != null
    ? formatDuration(resolutionStats.overall.avgHours, t.reports)
    : dashStats?.avgResolutionHours != null
    ? formatDuration(dashStats.avgResolutionHours, t.reports)
    : '—';

  const bucketData = resolutionStats?.buckets.map((b, i) => ({
    name: t.reports.bucketLabels[i] ?? b.bucket,
    count: b.count,
  })) ?? [];
  const categoryChartData = (categoryStats ?? [])
    .map((item) => ({
      ...item,
      name: item.name || t.reports.uncategorized,
    }))
    .sort((a, b) => b.count - a.count);
  const categoryChartHeight = Math.max(300, categoryChartData.length * 36 + 32);

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={3}>
        {t.reports.title}
      </Typography>
      {/* ── Summary stat cards ── */}
      {dashStats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={6} sm={3}>
            <StatCard
              label={t.reports.statsTotal}
              value={dashStats.totalTickets}
              color={theme.palette.primary.main}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              label={t.reports.statsOpen}
              value={dashStats.openTickets}
              color={theme.palette.warning.main}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard
              label={t.reports.statsResolved}
              value={dashStats.resolvedTickets + dashStats.closedTickets}
              color={theme.palette.success.main}
            />
          </Grid>
          {isAdmin && (
            <Grid item xs={6} sm={3}>
              <StatCard
                label={t.reports.statsAvgResolution}
                value={avgLabel}
                color={theme.palette.info.main}
                sub={resolutionStats?.overall.count ? `${resolutionStats.overall.count} ${t.reports.resolvedUnit}` : undefined}
              />
            </Grid>
          )}
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Trend */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.volume}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 300 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={theme.palette.primary.main}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name={t.reports.ticketCount}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* By Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byStatus}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 300 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      dataKey="count"
                    >
                      {statusStats?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry as any).color ?? COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* By Category */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byCategory}
              </Typography>
              <Box sx={{ height: categoryChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} interval={0} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} name={t.reports.ticketCount} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* By Priority */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byPriority}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 300 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Bar dataKey="count" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} name={t.reports.ticketCount} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* By Location */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byLocation}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 300 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Bar dataKey="count" fill={theme.palette.info.main} radius={[4, 4, 0, 0]} name={t.reports.ticketCount} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* By Assignee (volume) */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byAssignee}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 280 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assigneeStats} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Bar dataKey="count" fill={theme.palette.success.main} radius={[0, 4, 4, 0]} name={t.reports.ticketCount} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Resolution Time Section (admin only) ── */}
        {isAdmin && (
          <>
            <Grid item xs={12}>
              <Typography variant="h5" fontWeight="bold" mt={1} mb={1}>
                {t.reports.resolutionSection}
              </Typography>
            </Grid>

            {/* Avg resolution time by assignee */}
            <Grid item xs={12} md={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" mb={2}>
                    {t.reports.resolutionByAssignee}
                  </Typography>
                  {!resolutionStats || resolutionStats.byAssignee.length === 0 ? (
                    <Typography color="text.secondary" fontSize={13}>{t.reports.noResolutionData}</Typography>
                  ) : (
                    <Box sx={{ height: Math.max(200, resolutionStats.byAssignee.length * 52) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resolutionStats.byAssignee} layout="vertical" margin={{ left: 10, right: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} unit={t.reports.statsHours} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(v: number, _name, props) => {
                              const row = props.payload as AssigneeResolution;
                              return [
                                `${formatDuration(v, t.reports)} (min ${formatDuration(row.minHours, t.reports)}, max ${formatDuration(row.maxHours, t.reports)})`,
                                t.reports.statsAvgResolution,
                              ];
                            }}
                            labelFormatter={(name) => {
                              const row = resolutionStats.byAssignee.find(r => r.name === name);
                              return `${name}${row ? ` · ${row.count} ${t.reports.resolvedUnit}` : ''}`;
                            }}
                          />
                          <Bar dataKey="avgHours" fill={theme.palette.info.main} radius={[0, 4, 4, 0]} name={t.reports.statsAvgResolution}>
                            <LabelList
                              dataKey="avgHours"
                              position="right"
                              formatter={(v: number) => formatDuration(v, t.reports)}
                              style={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Avg resolution time by category */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" mb={2}>
                    {t.reports.resolutionByCategory}
                  </Typography>
                  {resolutionByCategory.length === 0 ? (
                    <Typography color="text.secondary" fontSize={13}>{t.reports.noResolutionData}</Typography>
                  ) : (
                    <Box sx={{ height: Math.max(200, resolutionByCategory.length * 52) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resolutionByCategory} layout="vertical" margin={{ left: 10, right: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} unit={t.reports.statsHours} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(v: number, _name, props) => {
                              const row = props.payload as GroupResolution;
                              return [
                                `${formatDuration(v, t.reports)} (min ${formatDuration(row.minHours, t.reports)}, max ${formatDuration(row.maxHours, t.reports)})`,
                                t.reports.statsAvgResolution,
                              ];
                            }}
                            labelFormatter={(name) => {
                              const row = resolutionByCategory.find(r => r.name === name);
                              return `${name}${row ? ` · ${row.count} ${t.reports.resolvedUnit}` : ''}`;
                            }}
                          />
                          <Bar dataKey="avgHours" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} name={t.reports.statsAvgResolution}>
                            <LabelList
                              dataKey="avgHours"
                              position="right"
                              formatter={(v: number) => formatDuration(v, t.reports)}
                              style={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Avg resolution time by priority */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" mb={2}>
                    {t.reports.resolutionByPriority}
                  </Typography>
                  {resolutionByPriority.length === 0 ? (
                    <Typography color="text.secondary" fontSize={13}>{t.reports.noResolutionData}</Typography>
                  ) : (
                    <Box sx={{ height: Math.max(200, resolutionByPriority.length * 52) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resolutionByPriority} layout="vertical" margin={{ left: 10, right: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" allowDecimals={false} unit={t.reports.statsHours} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(v: number, _name, props) => {
                              const row = props.payload as GroupResolution;
                              return [
                                `${formatDuration(v, t.reports)} (min ${formatDuration(row.minHours, t.reports)}, max ${formatDuration(row.maxHours, t.reports)})`,
                                t.reports.statsAvgResolution,
                              ];
                            }}
                            labelFormatter={(name) => {
                              const row = resolutionByPriority.find(r => r.name === name);
                              return `${name}${row ? ` · ${row.count} ${t.reports.resolvedUnit}` : ''}`;
                            }}
                          />
                          <Bar dataKey="avgHours" fill={theme.palette.warning.main} radius={[0, 4, 4, 0]} name={t.reports.statsAvgResolution}>
                            <LabelList
                              dataKey="avgHours"
                              position="right"
                              formatter={(v: number) => formatDuration(v, t.reports)}
                              style={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Resolution time distribution (buckets) */}
            <Grid item xs={12} md={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" mb={2}>
                    {t.reports.resolutionBuckets}
                  </Typography>
                  {!resolutionStats || resolutionStats.overall.count === 0 ? (
                    <Typography color="text.secondary" fontSize={13}>{t.reports.noResolutionData}</Typography>
                  ) : (
                    <Box sx={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bucketData} margin={{ top: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} name={t.reports.ticketCount}>
                            {bucketData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                            <LabelList dataKey="count" position="top" style={{ fontSize: 11 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Leaderboards */}
        <Grid item xs={12}>
          <Typography variant="h5" fontWeight="bold" mt={1} mb={1}>
            {t.reports.leaderboardTitle}
          </Typography>
        </Grid>

        <Grid item xs={12} md={4}>
          <LeaderboardCard
            title={t.reports.leaderboardOpeners}
            entries={leaderboard?.openers ?? []}
            unit={t.reports.leaderboardTickets}
            color={theme.palette.primary.main}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <LeaderboardCard
            title={t.reports.leaderboardCommenters}
            entries={leaderboard?.commenters ?? []}
            unit={t.reports.leaderboardComments}
            color={theme.palette.secondary.main}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <LeaderboardCard
            title={t.reports.leaderboardResolvers}
            entries={leaderboard?.resolvers ?? []}
            unit={t.reports.leaderboardResolutions}
            color={theme.palette.success.main}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
