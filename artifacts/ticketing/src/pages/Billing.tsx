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
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';

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
  planName: string;
  currentPriceId: string | null;
  subscriptionId: string | null;
  hasActiveSubscription: boolean;
  unlimited: boolean;
  available: number | null;
  limitReached: boolean;
  status: string | null;
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [upgradeTarget, setUpgradeTarget] = useState<{ product: Product; price: Price } | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const refreshData = useCallback(() => {
    fetch('/api/stripe/subscription', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSubscription(data.subscription))
      .catch(() => {})
      .finally(() => setLoadingSubscription(false));

    fetch('/api/stripe/seat-usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSeatUsage(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/stripe/products', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setProducts(data.data ?? []))
      .catch(() => setError(b.errorLoadProducts))
      .finally(() => setLoadingProducts(false));

    // After a successful Stripe Checkout redirect, sync the subscription ID
    // to the DB so trial-enforcement checks in requireAuth can see it.
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      fetch('/api/stripe/sync-subscription', { method: 'POST', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then(() => {
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
      if (data.url) window.location.href = data.url;
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
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || b.errorPortal);
    } finally { setPortalLoading(false); }
  };

  const formatPrice = (price: Price) => {
    const amount = (price.unit_amount / 100).toLocaleString('it-IT', { style: 'currency', currency: price.currency.toUpperCase() });
    const interval = price.recurring?.interval === 'year' ? b.perYear : b.perMonth;
    return `${amount}${interval}`;
  };

  const isSubscribed = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const seatPct = seatUsage && !seatUsage.unlimited && seatUsage.planSeats
    ? Math.min(100, (seatUsage.usedSeats / seatUsage.planSeats) * 100) : 0;
  const seatColor: 'primary' | 'warning' | 'error' = seatPct >= 100 ? 'error' : seatPct >= 80 ? 'warning' : 'primary';

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
                    {seatUsage.usedSeats} / {seatUsage.planSeats}
                  </Typography>
                )}
              </Box>
              {!seatUsage.unlimited && seatUsage.planSeats && (
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
