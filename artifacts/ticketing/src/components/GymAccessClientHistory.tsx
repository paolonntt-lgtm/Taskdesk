import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import {
  getGymAccessDateRange,
  getGymAccessPeriodRange,
  getLocalDateInputValue,
  type GymAccessPeriod,
} from "../lib/gymAccessPeriods";

type GymAccessEvent = {
  id: number;
  clientId: number | null;
  personName: string;
  occurredAt: string;
};

type GymAccessPage = {
  events: GymAccessEvent[];
  hasMore: boolean;
};

const PAGE_SIZE = 50;

export default function GymAccessClientHistory({
  clientId,
  organizationId,
}: {
  clientId: number;
  organizationId: number | null;
}) {
  const { t, lang } = useLanguage();
  const labels = t.gymAccess;
  const [period, setPeriod] = useState<GymAccessPeriod | "custom">("lastMonth");
  const [today] = useState(() => getLocalDateInputValue(new Date()));
  const [customToDate, setCustomToDate] = useState(today);
  const [customFromDate, setCustomFromDate] = useState(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return getLocalDateInputValue(from);
  });
  const range = useMemo(
    () => period === "custom"
      ? getGymAccessDateRange(customFromDate, customToDate)
      : getGymAccessPeriodRange(period),
    [period, customFromDate, customToDate],
  );
  const customDatesAreOrdered = customFromDate !== "" && customToDate !== "" && customFromDate <= customToDate;
  const customRangeIsTooLong = period === "custom" && customDatesAreOrdered && range === null;
  const query = useInfiniteQuery<GymAccessPage>({
    queryKey: ["gym-access-client-history", organizationId, clientId, range?.from, range?.to],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!range) throw new Error(labels.invalidDateRange);
      const params = new URLSearchParams({
        ...range,
        clientId: String(clientId),
        limit: String(PAGE_SIZE),
        offset: String(pageParam),
      });
      const response = await fetch(`/api/gym-access?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(labels.loadError);
      return response.json();
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((count, page) => count + page.events.length, 0) : undefined,
    enabled: Boolean(range),
    staleTime: 30_000,
  });
  const events = query.data?.pages.flatMap((page) => page.events) ?? [];
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
            <MenuItem value="custom">{labels.periods.custom}</MenuItem>
          </TextField>
        </Stack>
        {period === "custom" && (
          <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} mb={2}>
            <TextField
              type="date"
              label={labels.dateFrom}
              value={customFromDate}
              onChange={(event) => setCustomFromDate(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: customToDate || today }}
            />
            <TextField
              type="date"
              label={labels.dateTo}
              value={customToDate}
              onChange={(event) => setCustomToDate(event.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: customFromDate || undefined, max: today }}
            />
          </Stack>
        )}
        {period === "custom" && !customDatesAreOrdered ? (
          <Alert severity="warning">{labels.invalidDateRange}</Alert>
        ) : customRangeIsTooLong ? (
          <Alert severity="warning">{labels.rangeTooLong}</Alert>
        ) : query.isLoading ? (
          <Box display="flex" justifyContent="center" py={3}><CircularProgress size={26} /></Box>
        ) : query.isError ? (
          <Alert severity="error">{labels.loadError}</Alert>
        ) : events.length ? (
          <Stack spacing={1}>
            {events.map((event) => (
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
            {query.isFetchNextPageError && <Alert severity="error">{labels.loadError}</Alert>}
            {query.hasNextPage ? (
              <Button
                variant="outlined"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                sx={{ alignSelf: "center", mt: 1 }}
              >
                {query.isFetchingNextPage ? (
                  <Stack direction="row" alignItems="center" gap={1}>
                    <CircularProgress size={16} />
                    {labels.loadingMore}
                  </Stack>
                ) : labels.loadMore}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ pt: 1 }}>
                {labels.endOfHistory}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary">{labels.empty}</Typography>
        )}
      </CardContent>
    </Card>
  );
}
