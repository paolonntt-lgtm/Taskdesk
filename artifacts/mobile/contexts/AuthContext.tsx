import React, { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

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
