import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiPost } from "@/utils/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  organizationId?: number | null;
  isSuperAdmin?: boolean;
  trialEndsAt?: string | null;
  stripeSubscriptionId?: string | null;
  trialStatus?: { isInTrial: boolean; isExpired: boolean; daysLeft: number } | null;
  clientsEnabled?: boolean;
  workedTimeEnabled?: boolean;
  mainLocation?: string | null;
  groupPermissions?: string[];
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    apiFetch("/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading || !user?.id) return;
    let stopped = false;
    let inFlight = false;
    const refreshAuth = async () => {
      const appState = AppState.currentState;
      if (stopped || inFlight || appState === "background" || appState === "inactive") return;
      inFlight = true;
      try {
        const response = await apiFetch("/auth/me", { cache: "no-store" });
        if (response.status === 401) {
          if (!stopped) {
            userRef.current = null;
            setUser(null);
            queryClient.clear();
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
          void queryClient.resetQueries();
        }
      } catch {
        // Keep the existing user through transient network failures.
      } finally {
        inFlight = false;
      }
    };
    const interval = setInterval(refreshAuth, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshAuth();
    });
    return () => {
      stopped = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [isLoading, user?.id, queryClient]);

  const login = async (email: string, password: string) => {
    const data = await apiPost<{ user: User }>("/auth/login", { email, password });
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiPost<{ user: User }>("/auth/register", { name, email, password });
    setUser(data.user);
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
