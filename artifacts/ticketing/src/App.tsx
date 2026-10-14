import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, CircularProgress, Box } from "@mui/material";
import { createAppTheme } from "./theme";
import { AuthContext, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import NewTicket from "./pages/NewTicket";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import AnnouncementsSettings from "./components/AnnouncementsSettings";
import InviteRegister from "./pages/InviteRegister";
import UserProfile from "./pages/UserProfile";
import SuperAdmin from "./pages/SuperAdmin";
import ResetPassword from "./pages/ResetPassword";
import Layout from "./components/Layout";
import { clearBotSession } from "./components/BotDialog";
import Onboarding from "./pages/Onboarding";
import StickyNotesLayer from "./components/StickyNotesLayer";
import MiniTour from "./components/MiniTour";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import CalendarPage from "./pages/Calendar";
import NotificationsPage from "./pages/Notifications";
import DailyReportDetailPage from "./pages/DailyReportDetail";
import TicketTrash from "./pages/TicketTrash";
import CookieConsentBanner from "./components/CookieConsentBanner";
import type { User } from "@workspace/api-client-react";
import { trackEvent } from "./lib/analytics";
import { hasConfirmedTrialRegistration, parseProfessionalTrialAttribution } from "./lib/professionalTrialAttribution";

export const ColorModeContext = createContext<{ toggleColorMode: () => void; mode: 'light' | 'dark' }>({
  toggleColorMode: () => {},
  mode: 'light',
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/");
  }, [user, setLocation]);
  if (!user || user.role !== "admin") return null;
  return <Component />;
}

function SuperAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user && !(user as any).isSuperAdmin) setLocation("/");
  }, [user, setLocation]);
  if (!user || !(user as any).isSuperAdmin) return null;
  return <Component />;
}

function AuthenticatedApp({ user, onTourDone }: { user: User; onTourDone: () => void }) {
  const [, setLocation] = useLocation();
  const trialEndsAt: string | null = (user as any).trialEndsAt ?? null;
  const hasSubscription = !!(user as any).stripeSubscriptionId;
  const isSuperAdmin = !!(user as any).isSuperAdmin;
  const isTrialExpired =
    !isSuperAdmin &&
    trialEndsAt != null &&
    new Date(trialEndsAt) < new Date() &&
    !hasSubscription;

  const showTour = !!(user as any).registeredViaInvite && !(user as any).tourDone;

  if (isTrialExpired && user.role === 'admin') {
    return (
      <Layout>
        <Switch>
          <Route path="/billing" component={Billing} />
          <Route>{() => { setLocation('/billing'); return null; }}</Route>
        </Switch>
      </Layout>
    );
  }

  return (
    <>
      <StickyNotesLayer />
      {showTour && <MiniTour onDone={onTourDone} />}
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/tickets/new" component={NewTicket} />
          <Route path="/tickets/trash">{() => <AdminRoute component={TicketTrash} />}</Route>
          <Route path="/tickets/:id" component={TicketDetail} />
          <Route path="/tickets" component={TicketList} />
          <Route path="/reports" component={Reports} />
          <Route path="/daily-reports/:id" component={DailyReportDetailPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/users/:id" component={UserProfile} />
          <Route path="/users">{() => <AdminRoute component={Users} />}</Route>
          {(user as any)?.clientsEnabled !== false ? (
            <>
              <Route path="/clients/:id" component={ClientDetail} />
              <Route path="/clients" component={Clients} />
            </>
          ) : (
            <>
              <Route path="/clients/:id">{() => { setLocation('/tickets'); return null; }}</Route>
              <Route path="/clients">{() => { setLocation('/tickets'); return null; }}</Route>
            </>
          )}
          <Route path="/billing">{() => <AdminRoute component={Billing} />}</Route>
          <Route path="/announcements">{() => <AdminRoute component={AnnouncementsSettings} />}</Route>
          <Route path="/settings" component={Settings} />
          <Route path="/superadmin">{() => <SuperAdminRoute component={SuperAdmin} />}</Route>
        </Switch>
      </Layout>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  useEffect(() => { userRef.current = user; }, [user]);

  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('theme_mode') as 'light' | 'dark') ?? 'light';
    } catch {
      return 'light';
    }
  });

  const colorModeCtx = useMemo(() => ({
    mode,
    toggleColorMode: () => {
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('theme_mode', next); } catch {}
        return next;
      });
    },
  }), [mode]);

  const businessType = (user as any)?.businessType ?? null;

  const theme = useMemo(
    () => createAppTheme(mode, businessType),
    [mode, businessType],
  );

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setUser(data ?? null); setIsLoading(false); })
      .catch(() => { setUser(null); setIsLoading(false); });
  }, []);

  useEffect(() => {
    if (isLoading || !user?.id) return;
    let stopped = false;
    let inFlight = false;
    const refreshAuth = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (response.status === 401) {
          if (!stopped) {
            userRef.current = null;
            setUser(null);
            qc.clear();
            setLocation("/login");
          }
          return;
        }
        if (!response.ok) return;
        const freshUser = await response.json() as User;
        if (stopped || freshUser.id !== userRef.current?.id) return;
        const before = userRef.current;
        const beforePermissions = JSON.stringify({
          role: before?.role,
          permissions: (before as any)?.effectivePermissions ?? before?.groupPermissions ?? [],
        });
        const afterPermissions = JSON.stringify({
          role: freshUser.role,
          permissions: (freshUser as any).effectivePermissions ?? freshUser.groupPermissions ?? [],
        });
        const userChanged = JSON.stringify(before) !== JSON.stringify(freshUser);
        userRef.current = freshUser;
        if (userChanged) setUser(freshUser);
        if (beforePermissions !== afterPermissions) {
          void qc.resetQueries();
        }
      } catch {
        // Keep the existing signed-in state through transient network failures.
      } finally {
        inFlight = false;
      }
    };
    const interval = window.setInterval(refreshAuth, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshAuth();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isLoading, user?.id, qc, setLocation]);

  useEffect(() => {
    if (isLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_trial_signup") !== "1") return;

    const attribution = parseProfessionalTrialAttribution(window.location.search);
    params.delete("oauth_trial_signup");
    params.delete("trial_profession");
    params.delete("trial_language");
    const remainingSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${window.location.hash}`,
    );

    if (user && attribution && hasConfirmedTrialRegistration(201, user)) {
      trackEvent("professional_trial_started", {
        profession: attribution.profession,
        language: attribution.language,
      });
    }
  }, [isLoading, user]);

  const login = async (data: { email: string; password: string }) => {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      trackEvent("login_failed", { method: "password" });
      const err = await res.json().catch(() => ({ message: "Login fallito" }));
      const msg = err.message || "Login fallito";
      setError(msg);
      throw new Error(msg);
    }
    const body = await res.json();
    qc.clear();
    setUser(body.user);
    trackEvent("login_succeeded", { method: "password" });
    setLocation("/");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearBotSession();
    try { sessionStorage.removeItem('td_bot_open'); } catch { /* ignore */ }
    setUser(null);
    qc.clear();
    setLocation("/login");
  };

  const updateUser = (updated: User) => setUser((prev) => prev ? { ...prev, ...updated } : updated);

  return (
    <ColorModeContext.Provider value={colorModeCtx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthContext.Provider value={{ user, isLoading, login, logout, error, updateUser }}>
          <>
            <Switch>
              <Route path="/invite/:token">
                {(params) => <InviteRegister token={params.token!} />}
              </Route>
              <Route path="/reset-password" component={ResetPassword} />
              <Route>
                {isLoading ? (
                  <Box sx={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress />
                  </Box>
                ) : !user ? (
                  <Login />
                ) : user.role === 'admin' && !(user as any).onboardingDone ? (
                  <Onboarding onComplete={(businessType) => {
                    setUser({ ...user, onboardingDone: true, businessType } as any);
                  }} />
                ) : (
                  <AuthenticatedApp
                    user={user}
                    onTourDone={() => setUser({ ...user, tourDone: true } as any)}
                  />
                )}
              </Route>
            </Switch>
            <CookieConsentBanner />
          </>
        </AuthContext.Provider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

function AppContent() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  return (
    <WouterRouter base={base}>
      <AppShell />
    </WouterRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
