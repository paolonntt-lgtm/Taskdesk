import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch, apiGet, apiPost, apiPut } from "@/utils/api";

type Price = { id: string; unit_amount: number | null; currency: string; recurring?: { interval: string } | null; active: boolean };
type Product = { id: string; name: string; description: string; prices: Price[]; seats: number | null; unlimited: boolean };
type Subscription = { status: string; current_period_end?: number | null } | null;
type SeatUsage = {
  usedSeats: number; planSeats: number | null; addonSeats: number; maxAddonSeats: number;
  planName: string; currentPriceId: string | null; hasActiveSubscription: boolean;
  unlimited: boolean; available: number | null; limitReached: boolean;
};
type BillingDetails = {
  ragioneSociale: string; piva: string; codiceFiscale: string; indirizzo: string;
  cap: string; citta: string; provincia: string; paese: string; sdiCode: string; pec: string;
};

const EMPTY_BILLING: BillingDetails = {
  ragioneSociale: "", piva: "", codiceFiscale: "", indirizzo: "", cap: "",
  citta: "", provincia: "", paese: "IT", sdiCode: "", pec: "",
};

export default function BillingScreen() {
  const colors = useColors();
  const s = makeStyles(colors);
  const { user } = useAuth();
  const { lang } = useLanguage();
  const it = lang === "it";
  const isAdmin = user?.role === "admin" && user.organizationId != null;
  const qc = useQueryClient();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [pending, setPending] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingDetails>(EMPTY_BILLING);
  const [billingSaving, setBillingSaving] = useState(false);
  const [addonCount, setAddonCount] = useState(0);
  const [addonPrice, setAddonPrice] = useState<{ unitAmount: number | null; currency: string; interval: string } | null>(null);
  const [addonPriceLoading, setAddonPriceLoading] = useState(false);
  const [addonPriceError, setAddonPriceError] = useState(false);
  const productsQuery = useQuery({
    queryKey: ["mobile-billing-products"],
    queryFn: () => apiGet<{ data: Product[] }>("/stripe/products"),
    enabled: isAdmin,
  });
  const subscriptionQuery = useQuery({
    queryKey: ["mobile-billing-subscription"],
    queryFn: () => apiGet<{ subscription: Subscription }>("/stripe/subscription"),
    enabled: isAdmin,
  });
  const seatsQuery = useQuery({
    queryKey: ["mobile-billing-seat-usage"],
    queryFn: () => apiGet<SeatUsage>("/stripe/seat-usage"),
    enabled: isAdmin,
  });
  const seats = seatsQuery.data;
  const detailsQuery = useQuery({
    queryKey: ["mobile-billing-details"],
    queryFn: () => apiGet<BillingDetails>("/settings/billing"),
    enabled: isAdmin,
  });
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["mobile-billing-subscription"] }),
      qc.invalidateQueries({ queryKey: ["mobile-billing-seat-usage"] }),
      qc.invalidateQueries({ queryKey: ["mobile-billing-products"] }),
    ]);
  }, [qc]);
  useEffect(() => {
    if (detailsQuery.data) setBilling({ ...EMPTY_BILLING, ...detailsQuery.data });
  }, [detailsQuery.data]);
  useEffect(() => {
    if (seats) setAddonCount(seats.addonSeats);
  }, [seats?.addonSeats]);
  const products = productsQuery.data?.data ?? [];
  const subscription = subscriptionQuery.data?.subscription ?? null;
  const active = subscription?.status === "active" || subscription?.status === "trialing";
  const intervals = new Set(products.flatMap((p) => p.prices.filter((x) => x.active).map((x) => x.recurring?.interval)));
  const cadence = intervals.has(interval) ? interval : intervals.has("month") ? "month" : "year";
  const plans = useMemo(() => products.flatMap((product) => {
    const price = product.prices.find((item) => item.active && item.recurring?.interval === cadence);
    return price ? [{ product, price }] : [];
  }).sort((a, b) => (a.price.unit_amount ?? 0) - (b.price.unit_amount ?? 0)), [products, cadence]);

  const openStripeUrl = async (path: string, body?: unknown) => {
    setPending(path);
    try {
      const response = await apiFetch(path, {
        method: body === undefined ? "POST" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || (it ? "Operazione non riuscita." : "The operation failed."));
      if (!data.url) throw new Error(it ? "Link di pagamento non disponibile." : "Payment link unavailable.");
      await Linking.openURL(data.url);
    } catch (error: any) {
      Alert.alert(it ? "Errore" : "Error", error?.message ?? (it ? "Operazione non riuscita." : "The operation failed."));
    } finally {
      setPending(null);
    }
  };
  const checkout = (price: Price) => Alert.alert(
    it ? "Conferma abbonamento" : "Confirm subscription",
    it ? "Si aprirà la pagina sicura di Stripe per completare l’attivazione." : "Stripe's secure page will open to complete activation.",
    [
      { text: it ? "Annulla" : "Cancel", style: "cancel" },
      { text: it ? "Continua" : "Continue", onPress: () => void openStripeUrl("/stripe/checkout", { priceId: price.id }) },
    ],
  );
  const saveBilling = async () => {
    setBillingSaving(true);
    try {
      const response = await apiPut<BillingDetails>("/settings/billing", billing);
      setBilling({ ...EMPTY_BILLING, ...response });
      Alert.alert(it ? "Salvato" : "Saved", it ? "Dati di fatturazione salvati." : "Billing details saved.");
    } catch (error: any) {
      Alert.alert(it ? "Errore" : "Error", error?.message ?? (it ? "Impossibile salvare." : "Could not save."));
    } finally {
      setBillingSaving(false);
    }
  };
  const updateSeats = async (count: number) => {
    if (!seats) return;
    const bounded = Math.max(0, Math.min(seats.maxAddonSeats, count));
    setAddonCount(bounded);
    if (!addonPrice) {
      setAddonPriceLoading(true);
      setAddonPriceError(false);
      try {
        const result = await apiGet<{ unitAmount: number | null; currency: string; interval: string }>("/stripe/addon-price");
        setAddonPrice(result);
      } catch {
        setAddonPriceError(true);
      } finally {
        setAddonPriceLoading(false);
      }
    }
  };
  const confirmSeats = async () => {
    setPending("seats");
    try {
      await apiPost("/stripe/add-seats", { quantity: addonCount });
      Alert.alert(it ? "Aggiornato" : "Updated", it ? "Posti aggiuntivi aggiornati." : "Additional seats updated.");
      await refresh();
    } catch (error: any) {
      Alert.alert(it ? "Errore" : "Error", error?.message ?? (it ? "Impossibile aggiornare i posti." : "Could not update seats."));
    } finally { setPending(null); }
  };
  const updatePlan = (price: Price, name: string) => Alert.alert(
    it ? `Passare a ${name}?` : `Switch to ${name}?`,
    it ? "Stripe applicherà le regole di proratazione del piano." : "Stripe will apply the plan's proration rules.",
    [
      { text: it ? "Annulla" : "Cancel", style: "cancel" },
      { text: it ? "Conferma" : "Confirm", onPress: async () => {
        setPending(price.id);
        try {
          await apiPost("/stripe/upgrade", { priceId: price.id });
          Alert.alert(it ? "Piano aggiornato" : "Plan updated");
          await refresh();
        } catch (error: any) {
          Alert.alert(it ? "Errore" : "Error", error?.message ?? (it ? "Impossibile aggiornare il piano." : "Could not update the plan."));
        } finally { setPending(null); }
      } },
    ],
  );

  if (!isAdmin) return <View style={s.center}><Text style={s.muted}>{user?.role === "admin" ? it ? "Serve un’organizzazione per gestire la fatturazione." : "An organization is required to manage billing." : it ? "Accesso riservato agli amministratori." : "Admin access only."}</Text></View>;
  if (productsQuery.isLoading || subscriptionQuery.isLoading || seatsQuery.isLoading || detailsQuery.isLoading) {
    return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  const stripeUnavailable = [productsQuery.error, subscriptionQuery.error, seatsQuery.error].some((error: any) => {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.response?.status === 503 || message.includes("503") ||
      message.includes("stripe_not_configured") || message.includes("stripe billing is not configured");
  });
  const errorMessage = [productsQuery.error, subscriptionQuery.error, seatsQuery.error].find(Boolean) as any;

  return <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.heading}>
      <Text style={s.title}>{it ? "Fatturazione" : "Billing"}</Text>
      <Text style={s.subtitle}>{it ? "Gestisci piano, posti e dati fiscali dell’organizzazione." : "Manage your plan, seats, and organization tax details."}</Text>
    </View>
    {stripeUnavailable ? <View style={s.notice}><Feather name="info" size={18} color={colors.primary} /><Text style={s.noticeText}>{it ? "La gestione online degli abbonamenti non è al momento disponibile. Puoi comunque aggiornare i dati fiscali qui sotto." : "Online subscription management is currently unavailable. You can still update tax details below."}</Text></View> : null}
    {errorMessage && !stripeUnavailable ? <Text style={s.error}>{errorMessage.message ?? (it ? "Impossibile caricare la fatturazione." : "Could not load billing.")}</Text> : null}
    {!stripeUnavailable && user?.trialEndsAt && !active && <View style={s.trialNotice}>
      <Feather name="clock" size={17} color={colors.warning} />
      <Text style={s.noticeText}>{user.trialStatus?.isExpired
        ? it ? "La prova gratuita è terminata. Scegli un piano per continuare a usare TaskDesk."
          : "Your free trial has ended. Choose a plan to keep using TaskDesk."
        : it ? `Prova gratuita fino al ${new Date(user.trialEndsAt).toLocaleDateString("it-IT")}.`
          : `Free trial ends on ${new Date(user.trialEndsAt).toLocaleDateString("en-GB")}.`}</Text>
    </View>}
    {!stripeUnavailable && <View style={s.card}>
      <Text style={s.cardTitle}>{it ? "Piano e collaboratori" : "Plan and collaborators"}</Text>
      <View style={s.planSummary}>
        <View><Text style={s.muted}>{it ? "PIANO ATTUALE" : "CURRENT PLAN"}</Text><Text style={s.planName}>{seats?.hasActiveSubscription ? seats.planName : it ? "Prova gratuita" : "Free trial"}</Text></View>
        {active && <View style={[s.status, subscription?.status === "trialing" && s.statusTrial]}><Text style={s.statusText}>{subscription?.status === "trialing" ? it ? "In prova" : "Trial" : it ? "Attivo" : "Active"}</Text></View>}
      </View>
      {seats ? <View style={s.seatBox}>
        <View style={s.row}><Text style={s.label}>{it ? "Posti utilizzati" : "Seats used"}</Text><Text style={s.value}>{seats.unlimited ? `${seats.usedSeats} / ∞` : `${seats.usedSeats} / ${(seats.planSeats ?? 0) + seats.addonSeats}`}</Text></View>
        {!seats.unlimited && <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, seats.usedSeats / Math.max(1, (seats.planSeats ?? 0) + seats.addonSeats) * 100)}%` }]} /></View>}
        {subscription?.current_period_end ? <Text style={s.muted}>{it ? "Rinnovo" : "Renews"}: {new Date(subscription.current_period_end * 1000).toLocaleDateString(it ? "it-IT" : "en-GB")}</Text> : null}
      </View> : null}
      {active && seats?.hasActiveSubscription && <Pressable style={s.outlineButton} disabled={pending === "/stripe/portal"} onPress={() => void openStripeUrl("/stripe/portal")}>
        {pending === "/stripe/portal" ? <ActivityIndicator color={colors.primary} /> : <Feather name="external-link" size={16} color={colors.primary} />}
        <Text style={s.outlineButtonText}>{it ? "Gestisci abbonamento su Stripe" : "Manage subscription on Stripe"}</Text>
      </Pressable>}
      {seats?.hasActiveSubscription && !seats.unlimited && seats.maxAddonSeats > 0 && <View style={s.addon}>
        <Text style={s.label}>{it ? `Posti aggiuntivi attivi: ${seats.addonSeats}` : `Additional seats active: ${seats.addonSeats}`}</Text>
        <Text style={s.muted}>{it ? "Scegli il numero totale di posti aggiuntivi." : "Choose the total number of additional seats."}</Text>
        <View style={s.stepper}><Pressable accessibilityLabel={it ? "Riduci posti" : "Decrease seats"} disabled={addonPriceLoading} style={s.stepButton} onPress={() => void updateSeats(addonCount - 1)}><Feather name="minus" size={18} color={colors.primary} /></Pressable><Text style={s.stepValue}>{addonCount}</Text><Pressable accessibilityLabel={it ? "Aumenta posti" : "Increase seats"} disabled={addonPriceLoading} style={s.stepButton} onPress={() => void updateSeats(addonCount + 1)}><Feather name="plus" size={18} color={colors.primary} /></Pressable></View>
        {addonPrice?.unitAmount != null && <Text style={s.muted}>{(addonPrice.unitAmount / 100).toLocaleString(it ? "it-IT" : "en-GB", { style: "currency", currency: addonPrice.currency.toUpperCase() })} {addonPrice.interval === "year" ? it ? "/ anno per posto" : "/ year per seat" : it ? "/ mese per posto" : "/ month per seat"}</Text>}
         {addonPriceLoading && <ActivityIndicator color={colors.primary} />}
         {addonPriceError && <Text style={s.error}>{it ? "Prezzo dei posti aggiuntivi non disponibile. Riprova modificando il numero." : "Additional-seat pricing is unavailable. Retry by changing the quantity."}</Text>}
         <Pressable style={[s.primaryButton, (pending === "seats" || addonPriceLoading || addonPriceError) && s.disabled]} disabled={pending === "seats" || addonPriceLoading || addonPriceError} onPress={() => void confirmSeats()}><Text style={s.primaryText}>{pending === "seats" ? (it ? "Aggiornamento…" : "Updating…") : it ? "Aggiorna posti" : "Update seats"}</Text></Pressable>
      </View>}
    </View>}
    {!stripeUnavailable && <View style={s.card}>
      <View style={s.row}><Text style={s.cardTitle}>{active ? it ? "Piani disponibili" : "Available plans" : it ? "Scegli un piano" : "Choose a plan"}</Text>
        {intervals.has("month") && intervals.has("year") ? <View style={s.toggleRow}>
          {(["month", "year"] as const).map((value) => <Pressable key={value} onPress={() => setInterval(value)} style={[s.cadence, cadence === value && s.cadenceActive]}><Text style={[s.cadenceText, cadence === value && s.cadenceTextActive]}>{value === "month" ? it ? "Mensile" : "Monthly" : it ? "Annuale" : "Annual"}</Text></Pressable>)}
        </View> : null}
      </View>
      {plans.length === 0 ? <Text style={s.muted}>{it ? "Nessun piano acquistabile disponibile." : "No purchasable plans are available."}</Text> : plans.map(({ product, price }) => {
        const isCurrent = price.id === seats?.currentPriceId;
        const amount = price.unit_amount == null ? "—" : (price.unit_amount / 100).toLocaleString(it ? "it-IT" : "en-GB", { style: "currency", currency: price.currency.toUpperCase() });
        return <View key={price.id} style={s.planCard}>
          <View style={s.row}><Text style={s.planName}>{product.name}</Text>{isCurrent && <Text style={s.currentTag}>{it ? "PIANO ATTUALE" : "CURRENT"}</Text>}</View>
          <Text style={s.price}>{amount}<Text style={s.muted}> {cadence === "year" ? it ? "/ anno" : "/ year" : it ? "/ mese" : "/ month"}</Text></Text>
          <Text style={s.muted}>{product.description || (product.unlimited ? it ? "Collaboratori illimitati" : "Unlimited collaborators" : product.seats ? `${product.seats} ${it ? "posti inclusi" : "seats included"}` : "")}</Text>
          {!isCurrent && <Pressable style={s.primaryButton} disabled={pending === price.id} onPress={() => active ? updatePlan(price, product.name) : checkout(price)}><Text style={s.primaryText}>{pending === price.id ? (it ? "Attendi…" : "Please wait…") : active ? it ? "Seleziona piano" : "Select plan" : it ? "Attiva piano" : "Choose plan"}</Text></Pressable>}
        </View>;
      })}
    </View>}
    <View style={s.card}>
      <Text style={s.cardTitle}>{it ? "Dati di fatturazione" : "Billing details"}</Text>
      <Text style={s.muted}>{it ? "Questi dati vengono salvati per l’organizzazione e sincronizzati con Stripe." : "These details are saved for the organization and synced with Stripe."}</Text>
      {([
        ["ragioneSociale", it ? "Ragione sociale" : "Company name"],
        ["piva", it ? "Partita IVA" : "VAT number"],
        ["codiceFiscale", it ? "Codice fiscale" : "Tax code"],
        ["indirizzo", it ? "Indirizzo" : "Street address"],
        ["cap", it ? "CAP" : "Postal code"],
        ["citta", it ? "Città" : "City"],
        ["provincia", it ? "Provincia" : "Region"],
        ["paese", it ? "Paese (codice)" : "Country (code)"],
        ["sdiCode", it ? "Codice SDI" : "E-invoice code"],
        ["pec", "PEC"],
      ] as [keyof BillingDetails, string][]).map(([key, label]) => <View key={key} style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput value={billing[key]} onChangeText={(value) => setBilling((current) => ({ ...current, [key]: value }))} autoCapitalize="none" keyboardType={key === "pec" ? "email-address" : "default"} style={s.input} placeholder={label} placeholderTextColor={colors.mutedForeground} /></View>)}
      <Pressable style={[s.primaryButton, billingSaving && s.disabled]} disabled={billingSaving} onPress={() => void saveBilling()}>{billingSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={s.primaryText}>{it ? "Salva dati fiscali" : "Save billing details"}</Text>}</Pressable>
    </View>
    <View style={{ height: 28 }} />
  </ScrollView>;
}

function makeStyles(colors: ReturnType<typeof useColors>) {
return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  heading: { gap: 5 }, title: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 25 }, subtitle: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 14 },
  cardTitle: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17 }, muted: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  planSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, planName: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20 },
  status: { backgroundColor: colors.success + "30", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }, statusTrial: { backgroundColor: colors.warning + "50" }, statusText: { color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  seatBox: { backgroundColor: colors.background, borderRadius: 10, padding: 12, gap: 9 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, label: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 14 }, value: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }, track: { height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }, fill: { height: 7, borderRadius: 4, backgroundColor: colors.primary },
  outlineButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, outlineButtonText: { color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  addon: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, gap: 8 }, stepper: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 14 }, stepButton: { borderRadius: 9, borderWidth: 1, borderColor: colors.border, width: 40, height: 40, alignItems: "center", justifyContent: "center" }, stepValue: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18, minWidth: 24, textAlign: "center" },
  primaryButton: { backgroundColor: colors.primary, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 14 }, primaryText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 14 }, disabled: { opacity: 0.6 },
  toggleRow: { flexDirection: "row", gap: 5 }, cadence: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 18 }, cadenceActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" }, cadenceText: { color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }, cadenceTextActive: { color: colors.primary },
  planCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, gap: 7 }, currentTag: { color: colors.primary, fontSize: 10, fontFamily: "Inter_600SemiBold" }, price: { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 22 },
  field: { gap: 5 }, fieldLabel: { color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }, input: { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  notice: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 10, backgroundColor: colors.primary + "18" }, trialNotice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: colors.warning + "28" }, noticeText: { color: colors.foreground, flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }, error: { color: colors.destructive },
});
}
