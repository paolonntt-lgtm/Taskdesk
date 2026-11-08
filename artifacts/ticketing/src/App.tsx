import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, CircularProgress, Box } from "@mui/material";
import { createAppTheme } from "./theme";
import { AuthContext, useAuth } from "./contexts/AuthContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { getLanguagePreferenceSyncAction } from "./contexts/languagePreferenceSync";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GymAccessPage from "./pages/GymAccess";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import NewTicket from "./pages/NewTicket";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import AnnouncementsSettings from "./components/AnnouncementsSettings";
import InviteRegister from "./pages/InviteRegister";
import WorkspaceInvite from "./pages/WorkspaceInvite";
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
import { createAuthRefreshHandler, startAuthRefreshPolling } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { trackEvent } from "./lib/analytics";
import { hasConfirmedTrialRegistration, parseProfessionalTrialAttribution } from "./lib/professionalTrialAttribution";
import TimeTrackingReportPage from "./pages/TimeTrackingReport";
import PersonalTimeTrackingReportPage from "./pages/PersonalTimeTrackingReport";
import DrivePage from "./pages/Drive";
import OneDrivePage from "./pages/OneDrive";
import TaskTrackHelp from "./pages/TaskTrackHelp";
import AppHelp from "./pages/AppHelp";
import TrialExpiredNotice from "./pages/TrialExpiredNotice";
import { canAccessPersonalTimeReport } from "./lib/personalTimeReportAccess";
import { hashWorkspaceQueryKey } from "./lib/workspaceQueryScope";

let activeWorkspaceHeader: number | null = null;
let activeWorkspaceCacheId: number | null = null;
if (typeof window !== "undefined" && !(window as any).__taskdeskWorkspaceFetchPatched) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    if (!url.startsWith("/api/") || !activeWorkspaceHeader) return nativeFetch(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("X-Workspace-ID", String(activeWorkspaceHeader));
    return nativeFetch(input, { ...init, headers });
  };
  (window as any).__taskdeskWorkspaceFetchPatched = true;
}
const workspaceStorageKey = (userId: number) => `taskdesk-active-workspace:${userId}`;

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

function GymAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canAccess = user?.role === "admin" && user.profession === "palestre";
  useEffect(() => {
    if (user && !canAccess) setLocation("/");
  }, [user, canAccess, setLocation]);
  if (!canAccess) return null;
  return <Component />;
}

function CollaboratorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user && !canAccessPersonalTimeReport(user.role)) setLocation("/");
  }, [user, setLocation]);
  if (!user || !canAccessPersonalTimeReport(user.role)) return null;
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

function AuthenticatedApp({
  user,
  onTourDone,
  showNewTicketGuide,
  onNewTicketGuideDone,
}: {
  user: User;
  onTourDone: () => void;
  showNewTicketGuide: boolean;
  onNewTicketGuideDone: () => void;
}) {
  const [, setLocation] = useLocation();
  const isSuperAdmin = !!(user as any).isSuperAdmin;
  const isTrialExpired = !isSuperAdmin && (user as any).trialStatus?.isExpired === true;
  const expiryType = (user as any).trialStatus?.expirationType;

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
  if (isTrialExpired) return <TrialExpiredNotice subscriptionExpired={expiryType === 'subscription'} />;

  return (
    <>
      <StickyNotesLayer />
      {showTour && <MiniTour onDone={onTourDone} />}
      {!showTour && showNewTicketGuide && (
        <MiniTour firstTicketGuide onDone={onNewTicketGuideDone} />
      )}
      <Layout
        highlightNewTicket={showNewTicketGuide && !showTour}
        onNewTicketGuideDone={onNewTicketGuideDone}
      >
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/tickets/new" component={NewTicket} />
          <Route path="/tickets/trash">{() => <AdminRoute component={TicketTrash} />}</Route>
          <Route path="/tickets/:id" component={TicketDetail} />
          <Route path="/tickets" component={TicketList} />
          <Route path="/reports" component={Reports} />
          <Route path="/help" component={AppHelp} />
          <Route path="/tasktrack-help">{() => <AdminRoute component={TaskTrackHelp} />}</Route>
          <Route path="/time-report">{() => <AdminRoute component={TimeTrackingReportPage} />}</Route>
          <Route path="/my-time-report">{() => <CollaboratorRoute component={PersonalTimeTrackingReportPage} />}</Route>
          <Route path="/daily-reports/:id" component={DailyReportDetailPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/gym-access">{() => <GymAdminRoute component={GymAccessPage} />}</Route>
          <Route path="/drive" component={DrivePage} />
          <Route path="/onedrive" component={OneDrivePage} />
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
      queryKeyHashFn: (queryKey) => hashWorkspaceQueryKey(queryKey, activeWorkspaceCacheId),
    },
  },
});

function AppShell() {
  const [user, setUser] = useState<User | null>(null);
  const [showNewTicketGuide, setShowNewTicketGuide] = useState(false);
  const userRef = useRef<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { lang, setLang } = useLanguage();
  const languageSyncUserId = useRef<number | null>(null);
  const languageSaveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => { userRef.current = user; }, [user]);

  const saveLanguagePreference = (language: "it" | "en") => {
    const save = languageSaveQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLanguage: language }),
      });
      if (!response.ok) throw new Error("Could not save language preference");
    });
    languageSaveQueue.current = save;
    void save.catch(() => undefined);
  };

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
    activeWorkspaceHeader = null;
    activeWorkspaceCacheId = null;
    let cancelled = false;
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error("Not authenticated");
        const homeUser = await response.json();
        if (cancelled) return;
        let activeUser = homeUser;
        activeWorkspaceCacheId = homeUser.activeWorkspaceId ?? homeUser.organizationId ?? null;
        const saved = Number(localStorage.getItem(workspaceStorageKey(homeUser.id)));
        if (Number.isInteger(saved) && saved > 0 && saved !== homeUser.organizationId) {
          activeWorkspaceHeader = saved;
          activeWorkspaceCacheId = saved;
          const contextualResponse = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
          if (contextualResponse.ok) activeUser = await contextualResponse.json();
          else {
            activeWorkspaceHeader = null;
            activeWorkspaceCacheId = homeUser.organizationId ?? null;
            localStorage.removeItem(workspaceStorageKey(homeUser.id));
          }
        }
        if (!cancelled) {
          activeWorkspaceCacheId = activeUser.activeWorkspaceId ?? activeUser.organizationId ?? null;
          setUser(activeUser);
        }
      } catch {
        if (!cancelled) {
          activeWorkspaceCacheId = null;
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadUser();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const action = getLanguagePreferenceSyncAction({
      userId: user?.id,
      preferredLanguage: (user as any)?.preferredLanguage,
      currentLanguage: lang,
      syncedUserId: languageSyncUserId.current,
    });
    languageSyncUserId.current = action.syncedUserId;

    if (action.type === "apply") {
      setLang(action.language);
    } else if (action.type === "save") {
      saveLanguagePreference(action.language);
    }
  }, [user?.id, (user as any)?.preferredLanguage, lang, setLang]);

  useEffect(() => {
    if (isLoading || !user?.id || (user as any).trialStatus?.isExpired) return;
    const refreshAuth = createAuthRefreshHandler<User>({
      request: async () => {
        let response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (response.status === 403 && activeWorkspaceHeader !== null) {
          activeWorkspaceHeader = null;
          activeWorkspaceCacheId = (user as any).billingOrganizationId ?? user.organizationId;
          try { localStorage.removeItem(workspaceStorageKey(user.id)); } catch {}
          qc.clear();
          response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        }
        return response;
      },
      getCurrentUser: () => userRef.current,
      setCurrentUser: (freshUser) => {
        const previous = userRef.current;
        activeWorkspaceCacheId = (freshUser as any).activeWorkspaceId ?? freshUser.organizationId ?? null;
        userRef.current = freshUser;
        setUser(freshUser);
        if ((freshUser as any).activeWorkspaceId !== (previous as any)?.activeWorkspaceId) {
          qc.clear();
          setLocation("/");
        }
      },
      onUnauthorized: () => {
        activeWorkspaceCacheId = null;
        userRef.current = null;
        setUser(null);
        qc.clear();
        setLocation("/login");
      },
      onPermissionsChanged: () => { void qc.resetQueries(); },
    });
    const stopPolling = startAuthRefreshPolling(refreshAuth, {
      intervalMs: 30_000,
      isForeground: () => document.visibilityState !== "hidden",
      subscribeToForeground: (callback) => {
        const listener = () => {
          if (document.visibilityState === "visible") callback();
        };
        document.addEventListener("visibilitychange", listener);
        return () => document.removeEventListener("visibilitychange", listener);
      },
      setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
      clearInterval: (handle) => window.clearInterval(handle as number),
    });

    let stopped = false;
    let permissionEventsController: AbortController | null = null;
    let permissionEventsRetry: number | undefined;
    const isPermissionEventsForeground = () => document.visibilityState !== "hidden";
    const listenForPermissionChanges = async () => {
      if (
        stopped ||
        permissionEventsController ||
        !isPermissionEventsForeground() ||
        userRef.current?.id !== user.id
      ) return;

      const controller = new AbortController();
      permissionEventsController = controller;
      let retryDelay = 0;
      try {
        const response = await fetch("/api/auth/permission-events", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          await refreshAuth();
        } else if (response.status !== 204 && response.ok) {
          const event = await response.json().catch(() => null);
          if (event?.type === "permissions_changed") {
            await refreshAuth();
          } else if (event?.type === "workspace_members_changed") {
            window.dispatchEvent(new CustomEvent("workspace-members-changed", { detail: event }));
          }
        } else if (!response.ok) {
          retryDelay = 5_000;
        }
      } catch {
        if (!controller.signal.aborted) retryDelay = 5_000;
      } finally {
        if (permissionEventsController === controller) permissionEventsController = null;
        if (
          !stopped &&
          isPermissionEventsForeground() &&
          userRef.current?.id === user.id
        ) {
          permissionEventsRetry = window.setTimeout(
            () => void listenForPermissionChanges(),
            retryDelay,
          );
        }
      }
    };

    void listenForPermissionChanges();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void listenForPermissionChanges();
      } else {
        permissionEventsController?.abort();
        if (permissionEventsRetry !== undefined) window.clearTimeout(permissionEventsRetry);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      stopPolling();
      permissionEventsController?.abort();
      if (permissionEventsRetry !== undefined) window.clearTimeout(permissionEventsRetry);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isLoading, user?.id, (user as any)?.trialStatus?.isExpired, qc, setLocation]);

  useEffect(() => {
    if (isLoading || !user?.id) return;
    const key = workspaceStorageKey(user.id);
    const onWorkspaceStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      const workspaceId = Number(event.newValue);
      if (!Number.isInteger(workspaceId) || workspaceId < 1) return;
      activeWorkspaceHeader = workspaceId === (user as any).billingOrganizationId ? null : workspaceId;
      activeWorkspaceCacheId = workspaceId;
      qc.clear();
      void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Workspace access changed");
          const freshUser = await response.json();
          activeWorkspaceCacheId = (freshUser as any).activeWorkspaceId ?? freshUser.organizationId ?? null;
          userRef.current = freshUser;
          setUser(freshUser);
          setLocation("/");
        })
        .catch(() => {
          activeWorkspaceHeader = null;
          activeWorkspaceCacheId = (user as any).billingOrganizationId ?? user.organizationId;
          try { localStorage.removeItem(key); } catch {}
          void fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) return;
              const homeUser = await response.json();
              activeWorkspaceCacheId = (homeUser as any).activeWorkspaceId ?? homeUser.organizationId ?? null;
              userRef.current = homeUser;
              setUser(homeUser);
              setLocation("/");
            });
        });
    };
    window.addEventListener("storage", onWorkspaceStorage);
    return () => window.removeEventListener("storage", onWorkspaceStorage);
  }, [isLoading, user?.id, qc, setLocation]);

  useEffect(() => {
    if (isLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_trial_signup") !== "1") return;

    const attribution = parseProfessionalTrialAttribution(window.location.search);
    if (user && attribution && hasConfirmedTrialRegistration(201, user)) {
      try {
        sessionStorage.setItem("td_onboarding_profession", attribution.profession);
      } catch {}
    }
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
    activeWorkspaceHeader = null;
    let loggedInUser = body.user;
    activeWorkspaceCacheId = (body.user as any).activeWorkspaceId ?? body.user.organizationId ?? null;
    try {
      const savedWorkspace = Number(localStorage.getItem(workspaceStorageKey(body.user.id)));
      if (Number.isInteger(savedWorkspace) && savedWorkspace > 0 && savedWorkspace !== body.user.organizationId) {
        activeWorkspaceHeader = savedWorkspace;
        activeWorkspaceCacheId = savedWorkspace;
        const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (response.ok) loggedInUser = await response.json();
        else {
          activeWorkspaceHeader = null;
          activeWorkspaceCacheId = body.user.organizationId ?? null;
        }
      }
    } catch {
      activeWorkspaceHeader = null;
      activeWorkspaceCacheId = body.user.organizationId ?? null;
    }
    activeWorkspaceCacheId = (loggedInUser as any).activeWorkspaceId ?? loggedInUser.organizationId ?? null;
    setUser(loggedInUser);
    trackEvent("login_succeeded", { method: "password" });
    setLocation("/");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearBotSession();
    try { sessionStorage.removeItem('td_bot_open'); } catch { /* ignore */ }
    setUser(null);
    activeWorkspaceHeader = null;
    activeWorkspaceCacheId = null;
    qc.clear();
    setLocation("/login");
  };

  const updateUser = (updated: User) => setUser((prev) => {
    if (!prev) return updated;
    const next = { ...prev, ...updated };
    activeWorkspaceCacheId = (next as any).activeWorkspaceId ?? next.organizationId ?? null;
    return next;
  });
  const switchWorkspace = async (workspaceId: number) => {
    if (!user) return;
    const previousWorkspaceId = (user as any).activeWorkspaceId ?? user.organizationId;
    activeWorkspaceHeader = workspaceId === (user as any).billingOrganizationId ? null : workspaceId;
    activeWorkspaceCacheId = workspaceId;
    try { localStorage.setItem(workspaceStorageKey(user.id), String(workspaceId)); } catch {}
    qc.clear();
    setLocation("/");
    const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) {
      activeWorkspaceHeader = null;
      activeWorkspaceCacheId = (user as any).billingOrganizationId ?? user.organizationId;
      try { localStorage.removeItem(workspaceStorageKey(user.id)); } catch {}
      qc.clear();
      const homeResponse = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (homeResponse.ok) {
        const homeUser = await homeResponse.json();
        activeWorkspaceCacheId = (homeUser as any).activeWorkspaceId ?? homeUser.organizationId ?? null;
        userRef.current = homeUser;
        setUser(homeUser);
        setLocation("/");
      }
      throw new Error("Non hai accesso a questo spazio.");
    }
    const freshUser = await response.json();
    activeWorkspaceCacheId = (freshUser as any).activeWorkspaceId ?? freshUser.organizationId ?? null;
    userRef.current = freshUser;
    setUser(freshUser);
  };

  return (
    <ColorModeContext.Provider value={colorModeCtx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthContext.Provider value={{ user, isLoading, login, logout, error, updateUser, switchWorkspace }}>
          <>
            <Switch>
              <Route path="/invite/:token">
                {(params) => <InviteRegister token={params.token!} />}
              </Route>
              <Route path="/workspace-invite/:token">
                {(params) => <WorkspaceInvite token={params.token!} />}
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
                  <Onboarding onComplete={(businessType, profession, guideToFirstTicket) => {
                    setUser({ ...user, onboardingDone: true, businessType, profession } as any);
                    setShowNewTicketGuide(guideToFirstTicket);
                    setLocation("/");
                  }} />
                ) : (
                  <AuthenticatedApp
                    user={user}
                    onTourDone={() => setUser({ ...user, tourDone: true } as any)}
                    showNewTicketGuide={showNewTicketGuide}
                    onNewTicketGuideDone={() => setShowNewTicketGuide(false)}
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
