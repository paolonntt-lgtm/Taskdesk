import React from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, useTheme } from '@mui/material';
import { useGetStatsByStatus, useGetStatsByCategory, useGetStatsByLocation, useGetStatsByPriority, useGetTicketTrend, useGetStatsByAssignee } from '@workspace/api-client-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function Reports() {
  const theme = useTheme();

  const { data: statusStats, isLoading: statusLoading } = useGetStatsByStatus();
  const { data: categoryStats, isLoading: categoryLoading } = useGetStatsByCategory();
  const { data: locationStats } = useGetStatsByLocation();
  const { data: priorityStats, isLoading: priorityLoading } = useGetStatsByPriority();
  const { data: trendStats, isLoading: trendLoading } = useGetTicketTrend();
  const { data: assigneeStats } = useGetStatsByAssignee();

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  if (statusLoading || categoryLoading || priorityLoading || trendLoading) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={4}>
        Report e Statistiche
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Volume Ticket (ultimi 30 giorni)
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={theme.palette.primary.main}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      name="Ticket"
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
                Ticket per Stato
              </Typography>
              <Box height={300}>
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
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
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
                Ticket per Categoria
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats} layout="vertical" margin={{ left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
                    <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} name="Ticket" />
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
                Ticket per Priorità
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
                    <Bar dataKey="count" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} name="Ticket" />
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
                Ticket per Sede
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
                    <Bar dataKey="count" fill={theme.palette.info.main} radius={[4, 4, 0, 0]} name="Ticket" />
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
                Ticket per Operatore
              </Typography>
              <Box height={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assigneeStats} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [v, 'Ticket']} />
                    <Bar dataKey="count" fill={theme.palette.success.main} radius={[0, 4, 4, 0]} name="Ticket" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
