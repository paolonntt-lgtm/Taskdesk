import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { getGymAccessPeriodRange, type GymAccessPeriod } from "../lib/gymAccessPeriods";

type GymAccessEvent = {
  id: number;
  clientId: number | null;
  personName: string;
  occurredAt: string;
};

export default function GymAccessClientHistory({ clientId }: { clientId: number }) {
  const { t, lang } = useLanguage();
  const labels = t.gymAccess;
  const [period, setPeriod] = useState<GymAccessPeriod>("lastMonth");
  const range = useMemo(() => getGymAccessPeriodRange(period), [period]);
  const query = useQuery<GymAccessEvent[]>({
    queryKey: ["gym-access-client-history", clientId, range.from, range.to],
    queryFn: async () => {
      const params = new URLSearchParams({ ...range, clientId: String(clientId) });
      const response = await fetch(`/api/gym-access?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(labels.loadError);
      return response.json();
    },
    staleTime: 30_000,
  });
  const locale = lang === "it" ? "it-IT" : "en-GB";

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} mb={2}>
          <Typography variant="h6" fontWeight={700}>{labels.clientHistory}</Typography>
          <TextField
            select
            label={labels.period}
            value={period}
            onChange={(event) => setPeriod(event.target.value as GymAccessPeriod)}
            size="small"
            sx={{ minWidth: 190 }}
          >
            {(["today", "yesterday", "last7", "lastMonth"] as GymAccessPeriod[]).map((option) => (
              <MenuItem key={option} value={option}>{labels.periods[option]}</MenuItem>
            ))}
          </TextField>
        </Stack>
        {query.isLoading ? (
          <Box display="flex" justifyContent="center" py={3}><CircularProgress size={26} /></Box>
        ) : query.isError ? (
          <Alert severity="error">{labels.loadError}</Alert>
        ) : query.data?.length ? (
          <Stack spacing={1}>
            {query.data.map((event) => (
              <Paper key={event.id} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", gap: 2 }}>
                <Typography fontWeight={600}>{event.personName}</Typography>
                <Typography variant="body2" color="text.secondary" textAlign="right">
                  {new Date(event.occurredAt).toLocaleString(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">{labels.empty}</Typography>
        )}
      </CardContent>
    </Card>
  );
}
