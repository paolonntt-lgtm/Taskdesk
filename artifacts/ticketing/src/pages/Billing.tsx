import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  CheckCircle,
  CreditCard,
  OpenInNew,
  Stars,
  AccessTime,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useListUsers } from '@workspace/api-client-react';

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: string };
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

export default function Billing() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const b = t.billing;

  const [products, setProducts] = useState<Product[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users = [] } = useListUsers();
  const activeUsers = users.filter((u: any) => u.isActive !== false).length;

  useEffect(() => {
    fetch('/api/stripe/products', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setProducts(data.data ?? []))
      .catch(() => setError(b.errorLoadProducts))
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    fetch('/api/stripe/subscription', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setSubscription(data.subscription))
      .catch(() => {})
      .finally(() => setLoadingSubscription(false));
  }, []);

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
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

  const handlePortal = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || b.errorPortal);
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || b.errorPortal);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatPrice = (price: Price) => {
    const amount = (price.unit_amount / 100).toLocaleString('it-IT', {
      style: 'currency',
      currency: price.currency.toUpperCase(),
    });
    const interval = price.recurring?.interval === 'year' ? b.perYear : b.perMonth;
    return `${amount}${interval}`;
  };

  const isSubscribed = subscription && subscription.status === 'active';
  const isTrialing = subscription && subscription.status === 'trialing';

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {b.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {b.subtitle}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Subscription Status */}
      <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {b.currentPlan}
        </Typography>

        {loadingSubscription ? (
          <CircularProgress size={24} />
        ) : isSubscribed || isTrialing ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Chip
              icon={isTrialing ? <AccessTime /> : <CheckCircle />}
              label={isTrialing ? b.trialing : b.active}
              color={isTrialing ? 'warning' : 'success'}
            />
            <Typography variant="body2" color="text.secondary">
              {b.activeUsers}: <strong>{activeUsers}</strong>
            </Typography>
            {subscription.current_period_end && (
              <Typography variant="body2" color="text.secondary">
                {b.renewsOn}: <strong>{new Date(subscription.current_period_end * 1000).toLocaleDateString('it-IT')}</strong>
              </Typography>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={portalLoading ? <CircularProgress size={14} /> : <OpenInNew />}
              onClick={handlePortal}
              disabled={portalLoading}
              sx={{ ml: 'auto' }}
            >
              {b.manageSubscription}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip icon={<Stars />} label={b.trial} color="info" variant="outlined" />
            <Typography variant="body2" color="text.secondary">
              {b.noSubscriptionNote}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Billing Info */}
      {(isSubscribed || isTrialing) && (
        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {b.billingInfo}
          </Typography>
          <Alert severity="info" icon={false}>
            <Typography variant="body2">
              {b.billingNote.replace('{n}', String(activeUsers))}
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* Plans */}
      {!isSubscribed && (
        <>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {b.choosePlan}
          </Typography>

          {loadingProducts ? (
            <CircularProgress />
          ) : products.length === 0 ? (
            <Alert severity="warning">{b.noPlansAvailable}</Alert>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {products.map((product) =>
                product.prices.map((price) => {
                  const isYearly = price.recurring?.interval === 'year';
                  return (
                    <Card
                      key={price.id}
                      elevation={2}
                      sx={{
                        minWidth: 280,
                        flex: '1 1 280px',
                        maxWidth: 380,
                        position: 'relative',
                        border: isYearly ? '2px solid' : '1px solid',
                        borderColor: isYearly ? 'primary.main' : 'divider',
                      }}
                    >
                      {isYearly && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                          }}
                        >
                          {b.bestValue}
                        </Box>
                      )}
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {product.name}
                        </Typography>
                        <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
                          {formatPrice(price)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {product.description}
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <List dense disablePadding>
                          {[
                            b.feature1,
                            b.feature2,
                            b.feature3,
                            b.feature4,
                          ].map((f) => (
                            <ListItem key={f} disablePadding sx={{ py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 30 }}>
                                <CheckCircle fontSize="small" color="success" />
                              </ListItemIcon>
                              <ListItemText
                                primary={f}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                      <CardActions sx={{ px: 3, pb: 3 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          startIcon={
                            checkoutLoading === price.id ? (
                              <CircularProgress size={18} color="inherit" />
                            ) : (
                              <CreditCard />
                            )
                          }
                          disabled={checkoutLoading !== null}
                          onClick={() => handleCheckout(price.id)}
                        >
                          {checkoutLoading === price.id ? b.redirecting : b.subscribe}
                        </Button>
                      </CardActions>
                    </Card>
                  );
                })
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
