const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
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
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
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
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
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
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
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
