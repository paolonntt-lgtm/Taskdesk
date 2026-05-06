import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, CircularProgress, Avatar, Divider, List, ListItem, ListItemAvatar, ListItemText, Chip } from '@mui/material';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import {
  useGetStatsByStatus, useGetStatsByCategory, useGetStatsByLocation,
  useGetStatsByPriority, useGetStatsByAssignee, useGetTicketTrend,
} from '@workspace/api-client-react';
import { useLanguage } from '../contexts/LanguageContext';

const COLORS = ['#1976d2', '#ed6c02', '#2e7d32', '#9c27b0', '#d32f2f', '#0288d1'];

interface LeaderEntry { id: number; name: string; count: number }
interface Leaderboard { openers: LeaderEntry[]; commenters: LeaderEntry[]; resolvers: LeaderEntry[] }

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.'];

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
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    fetch('/api/stats/leaderboard', { credentials: 'include' })
      .then((r) => r.json())
      .then(setLeaderboard)
      .catch(() => {});
  }, []);

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

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" gutterBottom mb={3}>
        {t.reports.title}
      </Typography>

      <Grid container spacing={3}>
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
                      {statusStats?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                {t.reports.byCategory}
              </Typography>
              <Box sx={{ height: { xs: 220, sm: 300 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, t.reports.ticketCount]} />
                    <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} name={t.reports.ticketCount} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

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
