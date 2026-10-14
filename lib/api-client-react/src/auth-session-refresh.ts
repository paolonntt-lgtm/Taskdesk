export interface AuthRefreshUser {
  id: number;
  role: string;
  organizationId?: number | null;
  groupPermissions?: string[] | null;
  effectivePermissions?: string[] | null;
}

export interface AuthRefreshResponse {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}

export function createAuthRefreshHandler<T extends AuthRefreshUser>(options: {
  request: () => Promise<AuthRefreshResponse>;
  getCurrentUser: () => T | null;
  setCurrentUser: (user: T) => void;
  onUnauthorized: () => void;
  onPermissionsChanged: () => void;
}) {
  let inFlight = false;
  return async (): Promise<void> => {
    if (inFlight) return;
    inFlight = true;
    try {
      const response = await options.request();
      if (response.status === 401) {
        options.onUnauthorized();
        return;
      }
      if (!response.ok) return;
      const fresh = await response.json() as T | null;
      const current = options.getCurrentUser();
      if (!fresh || typeof fresh.id !== "number" || fresh.id !== current?.id) return;

      const signature = (user: T | null) => JSON.stringify({
        role: user?.role,
        organizationId: user?.organizationId,
        permissions: user?.effectivePermissions ?? user?.groupPermissions ?? [],
      });
      const permissionsChanged = signature(current) !== signature(fresh);
      if (JSON.stringify(current) !== JSON.stringify(fresh)) {
        options.setCurrentUser(fresh);
      }
      if (permissionsChanged) options.onPermissionsChanged();
    } catch {
      // A temporary network failure must not end a valid local session.
    } finally {
      inFlight = false;
    }
  };
}

export function startAuthRefreshPolling(
  refresh: () => void | Promise<void>,
  runtime: {
    intervalMs: number;
    isForeground: () => boolean;
    subscribeToForeground: (callback: () => void) => () => void;
    setInterval: (callback: () => void, intervalMs: number) => unknown;
    clearInterval: (handle: unknown) => void;
  },
): () => void {
  let stopped = false;
  let inFlight = false;
  const run = async () => {
    if (stopped || inFlight || !runtime.isForeground()) return;
    inFlight = true;
    try {
      await refresh();
    } finally {
      inFlight = false;
    }
  };
  const timer = runtime.setInterval(() => { void run(); }, runtime.intervalMs);
  const unsubscribe = runtime.subscribeToForeground(() => { void run(); });
  return () => {
    stopped = true;
    runtime.clearInterval(timer);
    unsubscribe();
  };
}
