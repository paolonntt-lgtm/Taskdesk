import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { createAuthRefreshHandler, startAuthRefreshPolling } from "@workspace/api-client-react";
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
    const refreshAuth = createAuthRefreshHandler<User>({
      request: () => apiFetch("/auth/me", { cache: "no-store" }),
      getCurrentUser: () => userRef.current,
      setCurrentUser: (freshUser) => {
        userRef.current = freshUser;
        setUser(freshUser);
      },
      onUnauthorized: () => {
        userRef.current = null;
        setUser(null);
        queryClient.clear();
      },
      onPermissionsChanged: () => { void queryClient.resetQueries(); },
    });
    const stopPolling = startAuthRefreshPolling(refreshAuth, {
      intervalMs: 30_000,
      isForeground: () => AppState.currentState !== "background" && AppState.currentState !== "inactive",
      subscribeToForeground: (callback) => {
        const subscription = AppState.addEventListener("change", (state) => {
          if (state === "active") callback();
        });
        return () => subscription.remove();
      },
      setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
      clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
    });

    let stopped = false;
    let permissionEventsController: AbortController | null = null;
    let permissionEventsRetry: ReturnType<typeof setTimeout> | undefined;
    const listenForPermissionChanges = async () => {
      if (
        stopped ||
        permissionEventsController ||
        AppState.currentState !== "active" ||
        userRef.current?.id !== user.id
      ) return;

      const controller = new AbortController();
      permissionEventsController = controller;
      let retryDelay = 0;
      try {
        const response = await apiFetch("/auth/permission-events", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          await refreshAuth();
        } else if (response.status !== 204 && response.ok) {
          const event = await response.json().catch(() => null);
          if (event?.type === "permissions_changed") await refreshAuth();
        } else if (!response.ok) {
          retryDelay = 5_000;
        }
      } catch {
        if (!controller.signal.aborted) retryDelay = 5_000;
      } finally {
        if (permissionEventsController === controller) permissionEventsController = null;
        if (
          !stopped &&
          AppState.currentState === "active" &&
          userRef.current?.id === user.id
        ) {
          permissionEventsRetry = setTimeout(
            () => void listenForPermissionChanges(),
            retryDelay,
          );
        }
      }
    };

    void listenForPermissionChanges();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void listenForPermissionChanges();
      } else {
        permissionEventsController?.abort();
      }
    });
    return () => {
      stopped = true;
      stopPolling();
      permissionEventsController?.abort();
      if (permissionEventsRetry !== undefined) clearTimeout(permissionEventsRetry);
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
