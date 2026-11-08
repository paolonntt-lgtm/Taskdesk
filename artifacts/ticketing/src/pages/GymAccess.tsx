import { useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, FitnessCenter as FitnessCenterIcon } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "../contexts/LanguageContext";
import { getGymAccessPeriodRange, type GymAccessPeriod } from "../lib/gymAccessPeriods";

type GymAccessEvent = {
  id: number;
  personName: string;
  occurredAt: string;
  createdAt: string;
};

type GymAccessClient = {
  id: number;
  name: string;
  membershipNumber?: string | null;
};

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function countDistinctPeople(events: GymAccessEvent[]): number {
  return new Set(events.map((event) => event.personName.trim().toLocaleLowerCase())).size;
}

export default function GymAccessPage() {
  const { t, lang } = useLanguage();
  const labels = t.gymAccess;
  const [period, setPeriod] = useState<GymAccessPeriod>("last7");
  const [selectedClient, setSelectedClient] = useState<GymAccessClient | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => localDateTimeValue(new Date()));
  const [formError, setFormError] = useState("");
  const queryClient = useQueryClient();
  const range = useMemo(() => getGymAccessPeriodRange(period), [period]);
  const query = useQuery<GymAccessEvent[]>({
    queryKey: ["gym-access", range.from, range.to],
    queryFn: async () => {
      const params = new URLSearchParams(range);
      const response = await fetch(`/api/gym-access?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not load gym access events");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const clientSearchQuery = useQuery<GymAccessClient[]>({
    queryKey: ["gym-access-client-search", clientSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ search: clientSearch.trim(), limit: "20" });
      const response = await fetch(`/api/clients?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(labels.clientLookupError);
      return response.json();
    },
    enabled: clientSearch.trim().length >= 2,
    retry: false,
  });
  const createEvent = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/gym-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient?.id,
          occurredAt: new Date(occurredAt).toISOString(),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.message ?? labels.saveError);
      }
      return response.json() as Promise<GymAccessEvent>;
    },
    onSuccess: () => {
      setFormError("");
      setSelectedClient(null);
      setClientSearch("");
      const now = new Date();
      setOccurredAt(localDateTimeValue(now));
      void queryClient.invalidateQueries({ queryKey: ["gym-access"] });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const events = query.data ?? [];
  const distinctPeople = countDistinctPeople(events);
  const locale = lang === "it" ? "it-IT" : "en-GB";
  const formatEventDate = (value: string) => new Date(value).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const canSave = selectedClient !== null && Number.isFinite(new Date(occurredAt).getTime());

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || createEvent.isPending) return;
    createEvent.mutate();
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <FitnessCenterIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>{labels.title}</Typography>
      </Stack>
      <Typography color="text.secondary" mb={2}>{labels.subtitle}</Typography>
      <Alert severity="info" sx={{ mb: 3 }}>{labels.manualNotice}</Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>{labels.addTitle}</Typography>
          <Box component="form" onSubmit={handleSubmit} display="flex" gap={2} flexWrap="wrap" alignItems="flex-start">
            <Autocomplete
              options={clientSearchQuery.data ?? []}
              value={selectedClient}
              loading={clientSearch.trim().length >= 2 && clientSearchQuery.isFetching}
              getOptionLabel={(client) => client.membershipNumber
                ? `${client.name} · ${client.membershipNumber}`
                : client.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options) => options}
              noOptionsText={clientSearch.trim().length < 2 ? labels.clientSearchPrompt : labels.noClientsFound}
              onChange={(_, client) => setSelectedClient(client)}
              onInputChange={(_, value, reason) => {
                if (reason === "input" || reason === "clear") {
                  setClientSearch(value);
                  if (reason === "input") setSelectedClient(null);
                }
              }}
              disabled={createEvent.isPending}
              sx={{ flex: "1 1 260px" }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={labels.client}
                  placeholder={labels.clientSearchPrompt}
                  required
                  error={clientSearchQuery.isError}
                  helperText={clientSearchQuery.isError ? labels.clientLookupError : undefined}
                />
              )}
            />
            <TextField
              label={labels.dateTime}
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              required
              InputLabelProps={{ shrink: true }}
              sx={{ flex: "1 1 220px" }}
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={createEvent.isPending ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              disabled={!canSave || createEvent.isPending}
              sx={{ minHeight: 56 }}
            >
              {createEvent.isPending ? labels.saving : labels.register}
            </Button>
          </Box>
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1.5} mb={2}>
        <Typography variant="h6" fontWeight={700}>{labels.history}</Typography>
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

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
        <Chip label={`${labels.entries}: ${events.length}`} color="primary" />
        <Chip label={`${labels.distinctPeople}: ${distinctPeople}`} variant="outlined" />
      </Stack>

      {query.isLoading ? (
        <Box display="flex" justifyContent="center" py={5}><CircularProgress /></Box>
      ) : query.isError ? (
        <Alert severity="error">{labels.loadError}</Alert>
      ) : events.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
          {labels.empty}
        </Paper>
      ) : (
        <Stack spacing={1}>
          {[...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((event) => (
            <Paper key={event.id} variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{event.personName}</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="right" sx={{ flexShrink: 0 }}>
                {formatEventDate(event.occurredAt)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
