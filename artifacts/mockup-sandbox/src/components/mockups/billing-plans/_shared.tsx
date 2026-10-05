import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CssBaseline,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { createTheme } from "@mui/material/styles";
import {
  AllInclusive,
  CheckCircle,
  CreditCard,
  Group,
} from "@mui/icons-material";
import "./_group.css";

interface PreviewPrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string };
}

interface PreviewProduct {
  id: string;
  name: string;
  description: string;
  seats: number | null;
  unlimited: boolean;
  prices: PreviewPrice[];
}

const previewProducts: PreviewProduct[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Per i piccoli team che vogliono organizzare il lavoro.",
    seats: 3,
    unlimited: false,
    prices: [
      { id: "starter-month", unit_amount: 1900, currency: "eur", recurring: { interval: "month" } },
      { id: "starter-year", unit_amount: 19000, currency: "eur", recurring: { interval: "year" } },
    ],
  },
  {
    id: "team",
    name: "Team",
    description: "Per i team in crescita che gestiscono più richieste.",
    seats: 10,
    unlimited: false,
    prices: [
      { id: "team-month", unit_amount: 3900, currency: "eur", recurring: { interval: "month" } },
      { id: "team-year", unit_amount: 39000, currency: "eur", recurring: { interval: "year" } },
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Per le organizzazioni che hanno bisogno di più flessibilità.",
    seats: null,
    unlimited: true,
    prices: [
      { id: "business-month", unit_amount: 7900, currency: "eur", recurring: { interval: "month" } },
      { id: "business-year", unit_amount: 79000, currency: "eur", recurring: { interval: "year" } },
    ],
  },
];

const previewTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb", light: "#60a5fa", dark: "#1d4ed8", contrastText: "#fff" },
    secondary: { main: "#7c3aed", light: "#a78bfa", dark: "#6d28d9", contrastText: "#fff" },
    background: { default: "#f8faff", paper: "#fff" },
    text: { primary: "#111827", secondary: "#6b7280" },
    divider: "#f3f4f6",
    success: { main: "#10b981", light: "#6ee7b7", dark: "#059669" },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h4: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontSize: "1rem", fontWeight: 700 },
    body2: { fontSize: "0.875rem" },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: "10px", padding: "8px 18px", fontWeight: 700, boxShadow: "none" },
        contained: { background: "linear-gradient(135deg, #2563eb, #7c3aed)" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
          border: "1px solid #f3f4f6",
          borderRadius: "16px",
        },
      },
    },
  },
});

const features = [
  "7 giorni di prova gratuita inclusi",
  "Prezzo fisso per team, non per utente",
  "Ticket e storage illimitati",
  "Tutte le funzionalità incluse",
];

function formatPrice(price: PreviewPrice) {
  const amount = (price.unit_amount / 100).toLocaleString("it-IT", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  });
  return `${amount}${price.recurring.interval === "year" ? "/anno" : "/mese"}`;
}

function annualSavings(product: PreviewProduct) {
  const monthlyPrice = product.prices.find((price) => price.recurring.interval === "month");
  const annualPrice = product.prices.find((price) => price.recurring.interval === "year");
  if (!monthlyPrice || !annualPrice || monthlyPrice.currency !== annualPrice.currency) return null;
  const amount = monthlyPrice.unit_amount * 12 - annualPrice.unit_amount;
  return amount > 0
    ? (amount / 100).toLocaleString("it-IT", {
        style: "currency",
        currency: annualPrice.currency.toUpperCase(),
      })
    : null;
}

function PlanCard({ product, price, showSavings }: {
  product: PreviewProduct;
  price: PreviewPrice;
  showSavings: boolean;
}) {
  const savings = showSavings ? annualSavings(product) : null;

  return (
    <Card
      sx={{
        width: "100%",
        minWidth: 0,
        maxWidth: 380,
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 12px 32px rgba(37,99,235,0.12)" },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>{product.name}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
          {product.unlimited ? (
            <Chip icon={<AllInclusive sx={{ fontSize: 14 }} />} label="Posti illimitati" size="small" color="secondary" />
          ) : (
            <Chip icon={<Group sx={{ fontSize: 14 }} />} label={`${product.seats} utenti`} size="small" />
          )}
        </Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
          gutterBottom
        >
          {formatPrice(price)}
        </Typography>
        {savings && (
          <Typography variant="caption" color="success.dark" fontWeight={600} display="block" sx={{ mt: -0.75, mb: 1.25 }}>
            Risparmi {savings} all’anno con il piano annuale
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{product.description}</Typography>
        <Divider sx={{ my: 2 }} />
        <List dense disablePadding>
          {features.map((feature) => (
            <ListItem key={feature} disablePadding sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 30 }}><CheckCircle fontSize="small" color="success" /></ListItemIcon>
              <ListItemText primary={feature} primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
          ))}
        </List>
      </CardContent>
      <CardActions sx={{ px: 3, pb: 3 }}>
        <Button fullWidth variant="contained" size="large" startIcon={<CreditCard />}>
          Abbonati ora
        </Button>
      </CardActions>
    </Card>
  );
}

export function BillingPlansPreview({ layout }: { layout: "current" | "cycle" }) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const planPrices = layout === "current"
    ? previewProducts.flatMap((product) => product.prices.map((price) => ({ product, price })))
    : previewProducts.flatMap((product) => {
        const price = product.prices.find((candidate) => candidate.recurring.interval === billingInterval);
        return price ? [{ product, price }] : [];
      });

  return (
    <ThemeProvider theme={previewTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", px: { xs: 2, sm: 3 }, py: 3 }}>
        <Box sx={{ maxWidth: layout === "current" ? 1700 : 1280, mx: "auto" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" fontWeight={800}>Scegli un piano</Typography>
            {layout === "cycle" && (
              <Box role="group" aria-label="Frequenza di fatturazione" sx={{ display: "inline-flex", gap: 0.5, p: 0.5, bgcolor: "rgba(37,99,235,0.06)", borderRadius: "12px" }}>
                <Button
                  size="small"
                  variant={billingInterval === "month" ? "contained" : "outlined"}
                  aria-pressed={billingInterval === "month"}
                  onClick={() => setBillingInterval("month")}
                >
                  Mensile
                </Button>
                <Button
                  size="small"
                  variant={billingInterval === "year" ? "contained" : "outlined"}
                  aria-pressed={billingInterval === "year"}
                  onClick={() => setBillingInterval("year")}
                >
                  Annuale
                </Button>
              </Box>
            )}
          </Box>
          <Alert severity="info" sx={{ mb: 2, borderRadius: "12px" }}>
            Prezzi di esempio per confrontare il layout; nell’app restano quelli configurati in Stripe.
          </Alert>
          <Box
            sx={layout === "current"
              ? { display: "flex", gap: 2.5, flexWrap: "wrap" }
              : {
                  display: "grid",
                  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
                  justifyItems: "center",
                  gap: 2.5,
                }}
          >
            {planPrices.map(({ product, price }) => (
              <PlanCard
                key={price.id}
                product={product}
                price={price}
                showSavings={layout === "cycle"}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
