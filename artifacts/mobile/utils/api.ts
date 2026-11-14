import { Platform } from "react-native";
import { hashKey } from "@tanstack/react-query";

const BASE_URL = Platform.OS !== "web" && process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

let activeWorkspaceHeaderId: number | null = null;
let activeWorkspaceCacheId: number | null = null;

export function setActiveWorkspaceContext(workspaceId: number | null, billingOrganizationId: number | null) {
  activeWorkspaceCacheId = workspaceId;
  activeWorkspaceHeaderId = workspaceId != null && workspaceId !== billingOrganizationId ? workspaceId : null;
}

export function getActiveWorkspaceCacheId() {
  return activeWorkspaceCacheId;
}

export function hashWorkspaceQueryKey(queryKey: readonly unknown[], workspaceId: number | null) {
  const alreadyScoped = queryKey.length >= 2 &&
    queryKey[queryKey.length - 2] === "workspace" &&
    queryKey[queryKey.length - 1] === workspaceId;
  return hashKey(alreadyScoped ? queryKey : [...queryKey, "workspace", workspaceId]);
}

export function installWorkspaceFetchInterceptor() {
  const global = globalThis as typeof globalThis & { __taskdeskWorkspaceFetchPatched?: boolean };
  if (global.__taskdeskWorkspaceFetchPatched) return () => {};
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const workspaceFetch: typeof fetch = (input, init) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const isApiRequest = url.startsWith("/api/") ||
      (!!BASE_URL && url.startsWith(`${BASE_URL}/api/`));
    if (!isApiRequest || activeWorkspaceHeaderId == null) return nativeFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("X-Workspace-ID", String(activeWorkspaceHeaderId));
    return nativeFetch(input, { ...init, headers });
  };
  globalThis.fetch = workspaceFetch;
  global.__taskdeskWorkspaceFetchPatched = true;
  return () => {
    if (globalThis.fetch === workspaceFetch) {
      globalThis.fetch = nativeFetch;
      global.__taskdeskWorkspaceFetchPatched = false;
    }
  };
}

export function getUserAvatarQueryKey(teamScopeId: number | null, userId: number) {
  return ["/api/users", teamScopeId, userId, "avatar"] as const;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}/api${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return res;
}

function createApiError(res: Response, details: any): Error {
  const error = new Error(details.message || details.error || `HTTP ${res.status}`);
  Object.assign(error, { status: res.status, data: details });
  return error;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createApiError(res, err);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createApiError(res, err);
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createApiError(res, err);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createApiError(res, err);
  }
  return res.json();
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw createApiError(res, err);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const PRIORITY_COLORS: Record<string, string> = {
  low: "#24a148",
  medium: "#f1c21b",
  high: "#ff832b",
  urgent: "#da1e28",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Aperto",
  in_progress: "In lavorazione",
  waiting: "In attesa",
  resolved: "Risolto",
  closed: "Chiuso",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const CATEGORIES = [
  "Hardware",
  "Software",
  "Rete",
  "Stampante",
  "Email",
  "Telefonia",
  "Accesso",
  "Altro",
];

export const PRIORITIES = ["low", "medium", "high", "urgent"];
export const LOCATIONS = ["Sede A", "Sede B", "Sede C", "Remoto"];
