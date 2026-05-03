import React, { useEffect, useState, useMemo } from "react";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, CircularProgress, Box } from "@mui/material";
import { lightTheme, darkTheme } from "./theme";
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
import InviteRegister from "./pages/InviteRegister";
import Layout from "./components/Layout";
import type { User } from "@workspace/api-client-react";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/");
  }, [user, setLocation]);
  if (!user || user.role !== "admin") return null;
  return <Component />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function AppShell({ toggleTheme, mode }: { toggleTheme: () => void; mode: "light" | "dark" }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setUser(data ?? null); setIsLoading(false); })
      .catch(() => { setUser(null); setIsLoading(false); });
  }, []);

  const login = async (data: { email: string; password: string }) => {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Login fallito" }));
      const msg = err.message || "Login fallito";
      setError(msg);
      throw new Error(msg);
    }
    const body = await res.json();
    setUser(body.user);
    setLocation("/");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    qc.clear();
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, error }}>
      <Switch>
        <Route path="/invite/:token">
          {(params) => <InviteRegister token={params.token!} />}
        </Route>
        <Route>
          {isLoading ? (
            <Box sx={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : !user ? (
            <Login />
          ) : (
            <Layout toggleTheme={toggleTheme} mode={mode}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/tickets/new" component={NewTicket} />
                <Route path="/tickets/:id" component={TicketDetail} />
                <Route path="/tickets" component={TicketList} />
                <Route path="/reports" component={Reports} />
                <Route path="/users">{() => <AdminRoute component={Users} />}</Route>
                <Route path="/billing">{() => <AdminRoute component={Billing} />}</Route>
                <Route path="/settings" component={Settings} />
              </Switch>
            </Layout>
          )}
        </Route>
      </Switch>
    </AuthContext.Provider>
  );
}

function AppContent() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const theme = useMemo(() => (mode === "light" ? lightTheme : darkTheme), [mode]);

  const toggleTheme = () => setMode((prev) => (prev === "light" ? "dark" : "light"));

  useEffect(() => {
    const saved = localStorage.getItem("themeMode");
    if (saved === "dark" || saved === "light") setMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("themeMode", mode);
  }, [mode]);

  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WouterRouter base={base}>
        <AppShell toggleTheme={toggleTheme} mode={mode} />
      </WouterRouter>
    </ThemeProvider>
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
