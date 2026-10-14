import { describe, expect, it, vi } from "vitest";
import {
  createAuthRefreshHandler,
  startAuthRefreshPolling,
} from "@workspace/api-client-react";

describe("mobile session permission refresh scheduling", () => {
  it("pauses while inactive and refreshes immediately when the app becomes active", async () => {
    let appState: "active" | "background" | "inactive" = "background";
    let intervalCallback = () => {};
    let appStateCallback = (_state: string) => {};
    const refresh = vi.fn();
    const removeListener = vi.fn();
    const clearTimer = vi.fn();
    const stop = startAuthRefreshPolling(refresh, {
      intervalMs: 30_000,
      isForeground: () => appState !== "background" && appState !== "inactive",
      subscribeToForeground: (callback) => {
        appStateCallback = (state) => {
          if (state === "active") callback();
        };
        return removeListener;
      },
      setInterval: (callback) => { intervalCallback = callback; return 12; },
      clearInterval: clearTimer,
    });

    intervalCallback();
    expect(refresh).not.toHaveBeenCalled();
    appState = "active";
    appStateCallback("active");
    expect(refresh).toHaveBeenCalledOnce();
    await Promise.resolve();
    intervalCallback();
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    expect(clearTimer).toHaveBeenCalledWith(12);
    expect(removeListener).toHaveBeenCalledOnce();
  });

  it("updates mobile auth permissions and resets cached app data after refresh", async () => {
    let user = { id: 8, role: "user", groupPermissions: ["add_notes"] };
    const resetQueries = vi.fn();
    const refresh = createAuthRefreshHandler({
      request: async () => ({
        status: 200,
        ok: true,
        json: async () => ({ id: 8, role: "user", groupPermissions: ["create_appointments"] }),
      }),
      getCurrentUser: () => user,
      setCurrentUser: (freshUser) => { user = freshUser; },
      onUnauthorized: vi.fn(),
      onPermissionsChanged: resetQueries,
    });

    await refresh();
    expect(user.groupPermissions).toEqual(["create_appointments"]);
    expect(resetQueries).toHaveBeenCalledOnce();
  });

  it("keeps a mobile session through network errors and clears it after a 401", async () => {
    let user: { id: number; role: string; groupPermissions: string[] } | null = {
      id: 8, role: "user", groupPermissions: ["add_notes"],
    };
    const onUnauthorized = vi.fn(() => { user = null; });
    const refresh = createAuthRefreshHandler({
      request: vi.fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ status: 401, ok: false, json: async () => null }),
      getCurrentUser: () => user,
      setCurrentUser: (freshUser) => { user = freshUser; },
      onUnauthorized,
      onPermissionsChanged: vi.fn(),
    });

    await refresh();
    expect(user).not.toBeNull();
    expect(onUnauthorized).not.toHaveBeenCalled();
    await refresh();
    expect(user).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
