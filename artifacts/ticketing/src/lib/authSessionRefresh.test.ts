import { describe, expect, it, vi } from "vitest";
import {
  createAuthRefreshHandler,
  startAuthRefreshPolling,
} from "@workspace/api-client-react";

type TestUser = {
  id: number;
  role: string;
  groupPermissions: string[];
};

const jsonResponse = (status: number, value?: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => value,
});

describe("web session permission refresh", () => {
  it("polls on schedule and refreshes when the page returns to the foreground", async () => {
    let foreground = false;
    let intervalCallback = () => {};
    let foregroundCallback = () => {};
    const refresh = vi.fn();
    const unsubscribe = vi.fn();
    const stop = startAuthRefreshPolling(refresh, {
      intervalMs: 30_000,
      isForeground: () => foreground,
      subscribeToForeground: (callback) => {
        foregroundCallback = callback;
        return unsubscribe;
      },
      setInterval: (callback) => { intervalCallback = callback; return 9; },
      clearInterval: vi.fn(),
    });

    intervalCallback();
    expect(refresh).not.toHaveBeenCalled();
    foreground = true;
    foregroundCallback();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    await Promise.resolve();
    intervalCallback();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("updates effective permissions and resets active data when permissions change", async () => {
    let user: TestUser | null = { id: 10, role: "user", groupPermissions: ["add_notes"] };
    const setUser = vi.fn((next: TestUser) => { user = next; });
    const resetQueries = vi.fn();
    const refresh = createAuthRefreshHandler<TestUser>({
      request: async () => jsonResponse(200, {
        id: 10, role: "user", groupPermissions: ["create_appointments"],
      }),
      getCurrentUser: () => user,
      setCurrentUser: setUser,
      onUnauthorized: vi.fn(),
      onPermissionsChanged: resetQueries,
    });

    await refresh();
    expect(user?.groupPermissions).toEqual(["create_appointments"]);
    expect(setUser).toHaveBeenCalledOnce();
    expect(resetQueries).toHaveBeenCalledOnce();
  });

  it("resets user-scoped data when the active organization changes", async () => {
    let user: TestUser & { organizationId: number } = {
      id: 10, role: "user", organizationId: 2, groupPermissions: ["add_notes"],
    };
    const resetQueries = vi.fn();
    const refresh = createAuthRefreshHandler<typeof user>({
      request: async () => jsonResponse(200, {
        id: 10, role: "user", organizationId: 3, groupPermissions: ["add_notes"],
      }),
      getCurrentUser: () => user,
      setCurrentUser: (next) => { user = next; },
      onUnauthorized: vi.fn(),
      onPermissionsChanged: resetQueries,
    });

    await refresh();
    expect(user.organizationId).toBe(3);
    expect(resetQueries).toHaveBeenCalledOnce();
  });

  it("preserves the current session on transient failures and clears it on 401", async () => {
    let user: TestUser | null = { id: 10, role: "user", groupPermissions: ["add_notes"] };
    const setUser = vi.fn((next: TestUser) => { user = next; });
    const onUnauthorized = vi.fn(() => { user = null; });
    const onPermissionsChanged = vi.fn();
    const request = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse(401));
    const refresh = createAuthRefreshHandler<TestUser>({
      request,
      getCurrentUser: () => user,
      setCurrentUser: setUser,
      onUnauthorized,
      onPermissionsChanged,
    });

    await refresh();
    expect(user).not.toBeNull();
    expect(setUser).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
    await refresh();
    expect(user).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(onPermissionsChanged).not.toHaveBeenCalled();
  });
});
