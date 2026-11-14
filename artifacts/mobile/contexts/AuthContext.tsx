import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAuthRefreshHandler,
  forgotPassword,
  startAuthRefreshPolling,
} from "@workspace/api-client-react";
import { apiFetch, apiPost, setActiveWorkspaceContext } from "@/utils/api";

type WorkspaceRole = "admin" | "user";

interface Workspace {
  id: number;
  name: string;
  role: WorkspaceRole;
  isSharedWorkspace?: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: WorkspaceRole;
  organizationId?: number | null;
  organizationName?: string | null;
  activeWorkspaceId?: number | null;
  billingOrganizationId?: number | null;
  workspaces?: Workspace[];
  isSharedWorkspace?: boolean;
  isSuperAdmin?: boolean;
  trialEndsAt?: string | null;
  stripeSubscriptionId?: string | null;
  trialStatus?: { isInTrial: boolean; isExpired: boolean; daysLeft: number } | null;
  clientsEnabled?: boolean;
  workedTimeEnabled?: boolean;
  mainLocation?: string | null;
  avatarUrl?: string | null;
  groupPermissions?: string[];
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  activeWorkspaceRole: WorkspaceRole | null;
  isLoading: boolean;
  workspaceAccessRevoked: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  switchWorkspace: (workspaceId: number) => Promise<void>;
  dismissWorkspaceAccessRevoked: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const workspaceStorageKey = (userId: number) => `taskdesk-active-workspace:${userId}`;

function userWorkspaceId(user: User): number | null {
  return user.activeWorkspaceId ?? user.organizationId ?? null;
}

function userBillingOrganizationId(user: User): number | null {
  return user.billingOrganizationId ?? user.organizationId ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceAccessRevoked, setWorkspaceAccessRevoked] = useState(false);
  const userRef = useRef<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setActiveWorkspaceContext(null, null);
      try {
        const response = await apiFetch("/auth/me", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }

        const homeUser = await response.json() as User;
        const homeWorkspaceId = userBillingOrganizationId(homeUser);
        let activeUser = homeUser;
        let accessRevoked = false;
        setActiveWorkspaceContext(userWorkspaceId(homeUser), homeWorkspaceId);

        let savedWorkspaceId: number | null = null;
        try {
          const saved = Number(await AsyncStorage.getItem(workspaceStorageKey(homeUser.id)));
          if (Number.isInteger(saved) && saved > 0) savedWorkspaceId = saved;
        } catch {
          // Continue in the home organization if local persistence is unavailable.
        }

        const savedWorkspaceIsAvailable = savedWorkspaceId != null &&
          savedWorkspaceId !== homeWorkspaceId &&
          homeUser.workspaces?.some((workspace) => workspace.id === savedWorkspaceId);
        if (savedWorkspaceId != null && savedWorkspaceId !== homeWorkspaceId && !savedWorkspaceIsAvailable) {
          accessRevoked = true;
        }
        if (savedWorkspaceIsAvailable && savedWorkspaceId != null) {
          setActiveWorkspaceContext(savedWorkspaceId, homeWorkspaceId);
          try {
            const contextualResponse = await apiFetch("/auth/me", { cache: "no-store" });
            if (contextualResponse.ok) {
              activeUser = await contextualResponse.json() as User;
              setActiveWorkspaceContext(userWorkspaceId(activeUser), homeWorkspaceId);
            } else {
              setActiveWorkspaceContext(homeWorkspaceId, homeWorkspaceId);
              if (contextualResponse.status === 403) {
                accessRevoked = true;
                await AsyncStorage.removeItem(workspaceStorageKey(homeUser.id)).catch(() => {});
              }
            }
          } catch {
            setActiveWorkspaceContext(homeWorkspaceId, homeWorkspaceId);
          }
        } else if (savedWorkspaceId != null && savedWorkspaceId !== homeWorkspaceId) {
          await AsyncStorage.removeItem(workspaceStorageKey(homeUser.id)).catch(() => {});
        }

        if (!cancelled) {
          userRef.current = activeUser;
          setUser(activeUser);
          if (accessRevoked) setWorkspaceAccessRevoked(true);
        }
      } catch {
        setActiveWorkspaceContext(null, null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isLoading || !user?.id) return;
    let accessRevokedDuringRefresh = false;
    const refreshAuth = createAuthRefreshHandler<User>({
      request: async () => {
        accessRevokedDuringRefresh = false;
        const response = await apiFetch("/auth/me", { cache: "no-store" });
        const currentUser = userRef.current;
        if (response.status !== 403 || !currentUser ||
            userWorkspaceId(currentUser) === userBillingOrganizationId(currentUser)) {
          return response;
        }
        const homeWorkspaceId = userBillingOrganizationId(currentUser);
        setActiveWorkspaceContext(homeWorkspaceId, homeWorkspaceId);
        await AsyncStorage.removeItem(workspaceStorageKey(currentUser.id)).catch(() => {});
        queryClient.clear();
        try {
          const homeResponse = await apiFetch("/auth/me", { cache: "no-store" });
          if (!homeResponse.ok) {
            accessRevokedDuringRefresh = false;
            userRef.current = null;
            setUser(null);
            queryClient.clear();
          }
          if (homeResponse.ok) accessRevokedDuringRefresh = true;
          return homeResponse;
        } catch (error) {
          accessRevokedDuringRefresh = false;
          userRef.current = null;
          setUser(null);
          queryClient.clear();
          throw error;
        }
      },
      getCurrentUser: () => userRef.current,
      setCurrentUser: (freshUser) => {
        setActiveWorkspaceContext(userWorkspaceId(freshUser), userBillingOrganizationId(freshUser));
        userRef.current = freshUser;
        setUser(freshUser);
        if (accessRevokedDuringRefresh) {
          accessRevokedDuringRefresh = false;
          setWorkspaceAccessRevoked(true);
        }
      },
      onUnauthorized: () => {
        accessRevokedDuringRefresh = false;
        setActiveWorkspaceContext(null, null);
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
        if (response.status === 401 || response.status === 403) {
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

  const login = async (email: string, password: string, rememberMe: boolean) => {
    setWorkspaceAccessRevoked(false);
    await apiPost<{ user: User }>("/auth/login", { email, password, rememberMe });
    setActiveWorkspaceContext(null, null);
    queryClient.clear();
    const response = await apiFetch("/auth/me", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load account");
    const homeUser = await response.json() as User;
    let nextUser = homeUser;
    let accessRevoked = false;
    const homeWorkspaceId = userBillingOrganizationId(homeUser);
    setActiveWorkspaceContext(userWorkspaceId(homeUser), homeWorkspaceId);
    const savedValue = await AsyncStorage.getItem(workspaceStorageKey(homeUser.id)).catch(() => null);
    const savedWorkspaceId = Number(savedValue);
    const savedWorkspaceIsAvailable = Number.isInteger(savedWorkspaceId) && savedWorkspaceId > 0 &&
      savedWorkspaceId !== homeWorkspaceId &&
      homeUser.workspaces?.some((workspace) => workspace.id === savedWorkspaceId);
    if (Number.isInteger(savedWorkspaceId) && savedWorkspaceId > 0 &&
        savedWorkspaceId !== homeWorkspaceId && !savedWorkspaceIsAvailable) {
      accessRevoked = true;
      await AsyncStorage.removeItem(workspaceStorageKey(homeUser.id)).catch(() => {});
    }
    if (savedWorkspaceIsAvailable) {
      setActiveWorkspaceContext(savedWorkspaceId, homeWorkspaceId);
      const contextualResponse = await apiFetch("/auth/me", { cache: "no-store" }).catch(() => null);
      if (contextualResponse?.ok) {
        nextUser = await contextualResponse.json() as User;
        setActiveWorkspaceContext(userWorkspaceId(nextUser), homeWorkspaceId);
      } else {
        setActiveWorkspaceContext(homeWorkspaceId, homeWorkspaceId);
        if (contextualResponse?.status === 403) {
          accessRevoked = true;
          await AsyncStorage.removeItem(workspaceStorageKey(homeUser.id)).catch(() => {});
        }
      }
    }
    userRef.current = nextUser;
    setUser(nextUser);
    if (accessRevoked) setWorkspaceAccessRevoked(true);
  };

  const requestPasswordReset = async (email: string) => {
    await forgotPassword({ email });
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiPost<{ user: User }>("/auth/register", { name, email, password });
    const homeId = data.user.organizationId ?? null;
    setActiveWorkspaceContext(homeId, homeId);
    const response = await apiFetch("/auth/me", { cache: "no-store" }).catch(() => null);
    const nextUser = response?.ok ? await response.json() as User : data.user;
    setActiveWorkspaceContext(userWorkspaceId(nextUser), userBillingOrganizationId(nextUser));
    userRef.current = nextUser;
    setUser(nextUser);
  };

  const logout = async () => {
    setWorkspaceAccessRevoked(false);
    await apiFetch("/auth/logout", { method: "POST" });
    setActiveWorkspaceContext(null, null);
    setUser(null);
    userRef.current = null;
    queryClient.clear();
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      userRef.current = next;
      setActiveWorkspaceContext(userWorkspaceId(next), userBillingOrganizationId(next));
      return next;
    });
  };

  const switchWorkspace = async (workspaceId: number) => {
    const currentUser = userRef.current;
    if (!currentUser) throw new Error("Workspace access denied");
    const homeWorkspaceId = userBillingOrganizationId(currentUser);
    const isAvailable = workspaceId === homeWorkspaceId ||
      currentUser.workspaces?.some((workspace) => workspace.id === workspaceId);
    if (!Number.isInteger(workspaceId) || !isAvailable) throw new Error("Workspace access denied");

    setActiveWorkspaceContext(workspaceId, homeWorkspaceId);
    queryClient.clear();
    try {
      const response = await apiFetch("/auth/me", { cache: "no-store" });
      if (!response.ok) throw new Error("Workspace access denied");
      const freshUser = await response.json() as User;
      if (userWorkspaceId(freshUser) !== workspaceId) throw new Error("Workspace access denied");
      await AsyncStorage.setItem(workspaceStorageKey(currentUser.id), String(workspaceId)).catch(() => {});
      setActiveWorkspaceContext(workspaceId, homeWorkspaceId);
      userRef.current = freshUser;
      setUser(freshUser);
    } catch (error) {
      setActiveWorkspaceContext(homeWorkspaceId, homeWorkspaceId);
      queryClient.clear();
      await AsyncStorage.removeItem(workspaceStorageKey(currentUser.id)).catch(() => {});
      const homeResponse = await apiFetch("/auth/me", { cache: "no-store" }).catch(() => null);
      if (homeResponse?.ok) {
        const homeUser = await homeResponse.json() as User;
        setActiveWorkspaceContext(userWorkspaceId(homeUser), homeWorkspaceId);
        userRef.current = homeUser;
        setUser(homeUser);
      } else {
        userRef.current = null;
        setUser(null);
      }
      throw error;
    }
  };

  const dismissWorkspaceAccessRevoked = () => setWorkspaceAccessRevoked(false);
  const activeWorkspaceRole = user
    ? user.workspaces?.find((workspace) => workspace.id === userWorkspaceId(user))?.role ?? user.role
    : null;

  return (
      <AuthContext.Provider value={{
        user,
        activeWorkspaceRole,
        isLoading,
        workspaceAccessRevoked,
        login,
        requestPasswordReset,
        register,
        logout,
        updateUser,
        switchWorkspace,
        dismissWorkspaceAccessRevoked,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
