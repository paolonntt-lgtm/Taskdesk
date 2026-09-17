import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  CreditCard,
  OpenInNew,
  Stars,
  AccessTime,
  Group,
  TrendingUp,
  AllInclusive,
  AddCircleOutline,
  RemoveCircleOutline,
  PersonAdd,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { trackEvent } from '../lib/analytics';

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: string } | null;
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
  seats: number | null;
  unlimited: boolean;
}

interface SeatUsage {
  usedSeats: number;
  planSeats: number | null;
  addonSeats: number;
  maxAddonSeats: number;
  planName: string;
  currentPriceId: string | null;
  subscriptionId: string | null;
  hasActiveSubscription: boolean;
  unlimited: boolean;
  available: number | null;
  limitReached: boolean;
  status: string | null;
}

interface AddonPrice {
  priceId: string;
  unitAmount: number | null;
  currency: string;
}

function isStripeUnavailableResponse(value: unknown): boolean {
  return value instanceof Response && value.status === 503;
}

export default function Billing() {
  const { t } = useLanguage();
  const b = t.billing;

  const [products, setProducts] = useState<Product[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [seatUsage, setSeatUsage] = useState<SeatUsage | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeUnavailable, setStripeUnavailable] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [upgradeTarget, setUpgradeTarget] = useState<{ product: Product; price: Price } | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Addon seats dialog state
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [addonPrice, setAddonPrice] = useState<AddonPrice | null>(null);
  const [addonPriceLoading, setAddonPriceLoading] = useState(false);
  const [addonPriceError, setAddonPriceError] = useState(false);
  const [addonQuantity, setAddonQuantity] = useState(0);
  const [addonLoading, setAddonLoading] = useState(false);

  const refreshSeatUsage = useCallback(() => {
    fetch('/api/stripe/seat-usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSeatUsage(data))
      .catch((err: unknown) => {
        if (isStripeUnavailableResponse(err)) setStripeUnavailable(true);
      });
  }, []);

  const refreshData = useCallback(() => {
    fetch('/api/stripe/subscription', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSubscription(data.subscription))
      .catch((err: unknown) => {
        if (isStripeUnavailableResponse(err)) setStripeUnavailable(true);
      })
      .finally(() => setLoadingSubscription(false));

    refreshSeatUsage();
  }, [refreshSeatUsage]);

  useEffect(() => {
    fetch('/api/stripe/products', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setProducts(data.data ?? []))
      .catch((err: unknown) => {
        if (isStripeUnavailableResponse(err)) {
          setStripeUnavailable(true);
          setError(null);
        } else {
          setError(b.errorLoadProducts);
        }
      })
      .finally(() => setLoadingProducts(false));

    // After a successful Stripe Checkout redirect, sync the subscription ID
    // to the DB so trial-enforcement checks in requireAuth can see it.
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      fetch('/api/stripe/sync-subscription', { method: 'POST', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then(() => {
          trackEvent('subscription_checkout_completed');
          // Strip the ?success=1 param and reload so auth/me returns the updated subscription
          window.location.replace(window.location.pathname);
        })
        .catch(() => refreshData());
    } else {
      refreshData();
    }
  }, [refreshData]);

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || b.errorCheckout);
       if (data.url) {
         trackEvent('checkout_started', { flow: 'new_subscription' });
         window.location.href = data.url;
       }
    } catch (err: any) {
      setError(err.message || b.errorCheckout);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleUpgradeConfirm = async () => {
    if (!upgradeTarget) return;
    setUpgradeLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/upgrade', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: upgradeTarget.price.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'CANNOT_DOWNGRADE_BELOW_USAGE') throw new Error(b.errorDowngradeBelow);
        throw new Error(data.message || data.error || b.errorUpgrade);
      }
      setUpgradeTarget(null);
      setSuccessMsg(b.upgradeSuccess);
       trackEvent('subscription_upgraded');
      refreshData();
    } catch (err: any) {
      setError(err.message || b.errorUpgrade);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true); setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || b.errorPortal);
       if (data.url) {
         trackEvent('billing_portal_opened');
         window.location.href = data.url;
       }
    } catch (err: any) {
      setError(err.message || b.errorPortal);
    } finally { setPortalLoading(false); }
  };

  const handleOpenAddonDialog = async () => {
    setAddonPriceError(false);
    setAddonQuantity(seatUsage?.addonSeats ?? 0);
    setAddonDialogOpen(true);
    if (!addonPrice) {
      setAddonPriceLoading(true);
      try {
        const res = await fetch('/api/stripe/addon-price', { credentials: 'include' });
        if (!res.ok) {
          setAddonPriceError(true);
          return;
        }
        const data = await res.json();
        setAddonPrice(data);
      } catch {
        setAddonPriceError(true);
      } finally {
        setAddonPriceLoading(false);
      }
    }
  };

  const handleAddonConfirm = async () => {
    setAddonLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/add-seats', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: addonQuantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'ADDON_NOT_CONFIGURED') throw new Error(b.addonSeatsNotConfigured);
        throw new Error(data.message || data.error || b.addonSeatsError);
      }
      setAddonDialogOpen(false);
      setSuccessMsg(b.addonSeatsSuccess);
       trackEvent('addon_seats_updated', { quantity: addonQuantity });
      refreshSeatUsage();
    } catch (err: any) {
      setError(err.message || b.addonSeatsError);
    } finally {
      setAddonLoading(false);
    }
  };

  const formatPrice = (price: Price) => {
    const amount = (price.unit_amount / 100).toLocaleString('it-IT', { style: 'currency', currency: price.currency.toUpperCase() });
    const interval = price.recurring?.interval === 'year' ? b.perYear : b.perMonth;
    return `${amount}${interval}`;
  };

  const formatAddonUnitPrice = () => {
    if (!addonPrice || addonPrice.unitAmount == null) return '—';
    return (addonPrice.unitAmount / 100).toLocaleString('it-IT', {
      style: 'currency',
      currency: addonPrice.currency.toUpperCase(),
    });
  };

  const addonSubtotal = () => {
    if (!addonPrice || addonPrice.unitAmount == null) return '—';
    const total = (addonPrice.unitAmount * addonQuantity) / 100;
    return total.toLocaleString('it-IT', { style: 'currency', currency: addonPrice.currency.toUpperCase() });
  };

  const isSubscribed = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const showAddonWidget = !!(seatUsage?.hasActiveSubscription && !seatUsage?.unlimited);

  const effectivePlanSeats = seatUsage
    ? (seatUsage.planSeats ?? 0) + (seatUsage.addonSeats ?? 0)
    : 0;
  const seatPct = seatUsage && !seatUsage.unlimited && effectivePlanSeats > 0
    ? Math.min(100, (seatUsage.usedSeats / effectivePlanSeats) * 100) : 0;
  const seatColor: 'primary' | 'warning' | 'error' = seatPct >= 100 ? 'error' : seatPct >= 80 ? 'warning' : 'primary';

  if (stripeUnavailable) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom letterSpacing="-0.01em">{b.title}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>{b.subtitle}</Typography>
        <Alert severity="info" icon={<CreditCard />}>
          <Typography fontWeight={700}>{b.stripeUnavailableTitle}</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>{b.stripeUnavailableDescription}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} gutterBottom letterSpacing="-0.01em">{b.title}</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>{b.subtitle}</Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Current plan + Seat usage */}
      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>{b.currentPlan}</Typography>
              {loadingSubscription || !seatUsage ? (
                <CircularProgress size={20} sx={{ mt: 1 }} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                  <Typography variant="h5" fontWeight={800}>
                    {seatUsage.hasActiveSubscription ? seatUsage.planName : b.trial}
                  </Typography>
                  {seatUsage.hasActiveSubscription && (
                    <Chip
                      icon={subscription?.status === 'trialing' ? <AccessTime /> : <CheckCircle />}
                      label={subscription?.status === 'trialing' ? b.trialing : b.active}
                      color={subscription?.status === 'trialing' ? 'warning' : 'success'}
                      size="small"
                    />
                  )}
                </Box>
              )}
            </Box>
            {isSubscribed && (
              <Button variant="outlined" size="small" startIcon={portalLoading ? <CircularProgress size={14} /> : <OpenInNew />}
                onClick={handlePortal} disabled={portalLoading}>
                {b.manageSubscription}
              </Button>
            )}
          </Box>

          {/* Seat usage bar */}
          {seatUsage && (
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Group fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>{b.seatUsageTitle}</Typography>
                </Box>
                {seatUsage.unlimited ? (
                  <Chip icon={<AllInclusive sx={{ fontSize: 14 }} />} label={b.seatsUnlimited} size="small" color="success" variant="outlined" />
                ) : (
                  <Typography variant="body2" fontWeight={700} color={`${seatColor}.main`}>
                    {seatUsage.usedSeats} / {effectivePlanSeats}
                  </Typography>
                )}
              </Box>
              {!seatUsage.unlimited && effectivePlanSeats > 0 && (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={seatPct}
                    color={seatColor}
                    sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {seatUsage.usedSeats} {b.seatsUsed}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {seatUsage.available ?? 0} {b.seatsAvailable}
                    </Typography>
                  </Box>
                  {seatPct >= 100 && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: '10px' }}>{b.seatsFull}</Alert>
                  )}
                  {seatPct >= 80 && seatPct < 100 && (
                    <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>{b.seatsAlmostFull}</Alert>
                  )}
                </>
              )}
              {subscription?.current_period_end && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  {b.renewsOn}: <strong>{new Date(subscription.current_period_end * 1000).toLocaleDateString('it-IT')}</strong>
                </Typography>
              )}
            </Box>
          )}

          {/* Addon seats widget */}
          {showAddonWidget && (
            <Box sx={{
              mt: 2,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAdd fontSize="small" color="action" />
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>{b.addonSeatsTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {seatUsage && seatUsage.addonSeats > 0
                      ? b.addonSeatsActive(seatUsage.addonSeats)
                      : b.addonSeatsNone}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAdd fontSize="small" />}
                onClick={handleOpenAddonDialog}
              >
                {b.addonSeatsManage}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, mt: 4, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" fontWeight={800}>
          {isSubscribed ? b.upgradeNowCta : b.choosePlan}
        </Typography>
      </Box>

      {loadingProducts ? (
        <CircularProgress />
      ) : products.length === 0 ? (
        <Alert severity="warning">{b.noPlansAvailable}</Alert>
      ) : (
        <>
          {/* Hint when no seat metadata configured */}
          {isSubscribed && products.every((p) => !p.seats && !p.unlimited) && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>{b.noPlansHint}</Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
            {[...products]
              .sort((a, b) => {
                const aMin = Math.min(...a.prices.map((p) => p.unit_amount ?? Infinity));
                const bMin = Math.min(...b.prices.map((p) => p.unit_amount ?? Infinity));
                return aMin - bMin;
              })
              .flatMap((product) =>
              product.prices.map((price) => {
                const isCurrent = seatUsage?.currentPriceId === price.id;
                const isUpgrade = isSubscribed && seatUsage && !isCurrent &&
                  (product.unlimited || (product.seats !== null && (seatUsage.unlimited
                    ? false
                    : seatUsage.planSeats !== null && product.seats > seatUsage.planSeats)));
                const isDowngrade = isSubscribed && !isCurrent && !isUpgrade && seatUsage?.hasActiveSubscription;

                return (
                  <Card
                    key={price.id}
                    sx={{
                      minWidth: 280, flex: '1 1 280px', maxWidth: 380,
                      position: 'relative',
                      border: isCurrent ? '2px solid' : '1px solid',
                      borderColor: isCurrent ? 'primary.main' : 'divider',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': !isCurrent ? { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(37,99,235,0.12)' } : {},
                    }}
                  >
                    {isCurrent && (
                      <Box sx={{
                        position: 'absolute', top: -10, left: 16,
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff',
                        px: 1.5, py: 0.5, borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        ✓ {b.currentPlanBadge}
                      </Box>
                    )}
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" fontWeight={800} gutterBottom>{product.name}</Typography>

                      {/* Seats badge */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                        {product.unlimited ? (
                          <Chip icon={<AllInclusive sx={{ fontSize: 14 }} />} label={b.seatsUnlimited} size="small" color="secondary" />
                        ) : product.seats !== null ? (
                          <Chip icon={<Group sx={{ fontSize: 14 }} />} label={`${product.seats} ${b.seatsLabel}`} size="small" />
                        ) : null}
                      </Box>

                      <Typography variant="h4" fontWeight={800} sx={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} gutterBottom>
                        {formatPrice(price)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{product.description}</Typography>
                      <Divider sx={{ my: 2 }} />
                      <List dense disablePadding>
                        {[b.feature1, b.feature2, b.feature3, b.feature4].map((f) => (
                          <ListItem key={f} disablePadding sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 30 }}><CheckCircle fontSize="small" color="success" /></ListItemIcon>
                            <ListItemText primary={f} primaryTypographyProps={{ variant: 'body2' }} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                    <CardActions sx={{ px: 3, pb: 3 }}>
                      {isCurrent ? (
                        <Button fullWidth variant="outlined" disabled>{b.currentPlanBadge}</Button>
                      ) : isSubscribed ? (
                        <Button
                          fullWidth variant="contained" size="large"
                          startIcon={<TrendingUp />}
                          onClick={() => setUpgradeTarget({ product, price })}
                        >
                          {isUpgrade ? b.upgrade : b.downgrade}
                        </Button>
                      ) : (
                        <Button
                          fullWidth variant="contained" size="large"
                          startIcon={checkoutLoading === price.id ? <CircularProgress size={18} color="inherit" /> : <CreditCard />}
                          disabled={checkoutLoading !== null}
                          onClick={() => handleCheckout(price.id)}
                        >
                          {checkoutLoading === price.id ? b.redirecting : b.subscribe}
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                );
              })
            )}
          </Box>
        </>
      )}

      {/* Upgrade confirmation dialog */}
      <Dialog open={!!upgradeTarget} onClose={() => !upgradeLoading && setUpgradeTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>{b.upgradeDialogTitle}</DialogTitle>
        <DialogContent>
          {upgradeTarget && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {b.upgradeDialogIntro}:
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: '12px', border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>{upgradeTarget.product.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {upgradeTarget.product.unlimited
                    ? b.seatsUnlimited
                    : upgradeTarget.product.seats !== null ? `${upgradeTarget.product.seats} ${b.seatsLabel}` : ''}
                  {' · '}{formatPrice(upgradeTarget.price)}
                </Typography>
              </Box>
              <Alert severity="info" sx={{ borderRadius: '10px' }}>
                {b.upgradeDialogProration}
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUpgradeTarget(null)} disabled={upgradeLoading}>{t.users.cancel}</Button>
          <Button variant="contained" onClick={handleUpgradeConfirm} disabled={upgradeLoading}
            startIcon={upgradeLoading ? <CircularProgress size={16} color="inherit" /> : <TrendingUp />}>
            {upgradeLoading ? b.upgradeProcessing : b.upgradeConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Addon seats dialog */}
      <Dialog
        open={addonDialogOpen}
        onClose={() => !addonLoading && setAddonDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={800}>{b.addonSeatsDialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {b.addonSeatsDialogSubtitle}
          </Typography>
          {seatUsage && seatUsage.maxAddonSeats > 0 && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 2, fontWeight: 600 }}>
              {b.addonSeatsMaxNote(seatUsage.maxAddonSeats)}
            </Typography>
          )}

          {addonPriceLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} />
            </Box>
          ) : addonPriceError ? (
            <Alert severity="warning" sx={{ borderRadius: '10px' }}>
              {b.addonSeatsNotConfigured}
            </Alert>
          ) : (
            <>
              {/* Counter */}
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 3,
                p: 2, bgcolor: 'background.default', borderRadius: '12px', border: '1px solid', borderColor: 'divider',
              }}>
                <IconButton
                  onClick={() => setAddonQuantity((q) => Math.max(0, q - 1))}
                  disabled={addonQuantity === 0 || addonLoading}
                  color="primary"
                  size="large"
                >
                  <RemoveCircleOutline />
                </IconButton>
                <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                  <Typography variant="h3" fontWeight={800} lineHeight={1}>{addonQuantity}</Typography>
                  <Typography variant="caption" color="text.secondary">{b.addonSeatsCounter}</Typography>
                </Box>
                <IconButton
                  onClick={() => setAddonQuantity((q) => Math.min(seatUsage?.maxAddonSeats ?? 50, q + 1))}
                  disabled={addonQuantity >= (seatUsage?.maxAddonSeats ?? 50) || addonLoading}
                  color="primary"
                  size="large"
                >
                  <AddCircleOutline />
                </IconButton>
              </Box>

              {/* Price summary */}
              {addonPrice && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">{b.addonSeatsPricePerSeat}</Typography>
                    <Typography variant="body2" fontWeight={600}>{formatAddonUnitPrice()}{b.perMonth}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">{b.addonSeatsSubtotal}</Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{addonSubtotal()}{b.perMonth}</Typography>
                  </Box>
                </Box>
              )}

              <Alert severity="info" sx={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                {b.addonSeatsProrationNote}
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddonDialogOpen(false)} disabled={addonLoading}>
            {b.addonSeatsCancel}
          </Button>
          {!addonPriceError && !addonPriceLoading && (
            <Button
              variant="contained"
              onClick={handleAddonConfirm}
              disabled={addonLoading || addonPriceLoading || addonPriceError}
              startIcon={addonLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
            >
              {addonLoading ? b.addonSeatsConfirming : b.addonSeatsConfirm}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ borderRadius: '12px' }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
