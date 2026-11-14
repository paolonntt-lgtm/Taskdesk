// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  activeWorkspaceId: null as number | null,
  stored: new Map<string, string>(),
  revokeContextRequest: false,
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    currentState: "background",
    addEventListener: () => ({ remove: vi.fn() }),
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.stored.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { mocks.stored.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { mocks.stored.delete(key); }),
  },
}));
vi.mock("@/utils/api", () => ({
  apiFetch: mocks.apiFetch,
  apiPost: mocks.apiPost,
  setActiveWorkspaceContext: (workspaceId: number | null) => { mocks.activeWorkspaceId = workspaceId; },
}));
vi.mock("@workspace/api-client-react", () => ({
  createAuthRefreshHandler: () => async () => {},
  startAuthRefreshPolling: () => () => {},
  forgotPassword: vi.fn(),
}));

const homeUser = {
  id: 5,
  name: "Ada Lovelace",
  email: "ada@example.test",
  role: "admin",
  organizationId: 7,
  organizationName: "Home office",
  activeWorkspaceId: 7,
  billingOrganizationId: 7,
  workspaces: [
    { id: 7, name: "Home office", role: "admin" },
    { id: 22, name: "Shared studio", role: "user" },
  ],
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function apiResponse(status: number, payload: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

function currentWorkspaceUser() {
  return mocks.activeWorkspaceId === 22
    ? { ...homeUser, role: "user", organizationId: 22, activeWorkspaceId: 22, organizationName: "Shared studio" }
    : homeUser;
}

function Consumer() {
  const { user, switchWorkspace } = useAuth();
  const [switchError, setSwitchError] = useState("");
  return (
    <div>
      <span data-testid="active-workspace">{user?.organizationName} · {user?.role}</span>
      <button
        data-testid="switch-to-shared"
        onClick={() => void switchWorkspace(22).catch((error: Error) => setSwitchError(error.message))}
      >
        Switch
      </button>
      <span data-testid="switch-error">{switchError}</span>
    </div>
  );
}

describe("mobile workspace authentication context", () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const renderProvider = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider><Consumer /></AuthProvider>
        </QueryClientProvider>,
      );
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.activeWorkspaceId = null;
    mocks.stored.clear();
    mocks.revokeContextRequest = false;
    mocks.apiFetch.mockReset().mockImplementation(async (path: string) => {
      if (path !== "/auth/me") return apiResponse(204, null);
      if (mocks.activeWorkspaceId === 22 && mocks.revokeContextRequest) return apiResponse(403, {});
      return apiResponse(200, currentWorkspaceUser());
    });
    mocks.apiPost.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it("restores a saved workspace only after the server validates it", async () => {
    mocks.stored.set("taskdesk-active-workspace:5", "22");
    await renderProvider();

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Shared studio · user");
    });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.activeWorkspaceId).toBe(22);
  });

  it("returns to the home organization and removes a revoked saved workspace", async () => {
    mocks.stored.set("taskdesk-active-workspace:5", "22");
    mocks.revokeContextRequest = true;
    await renderProvider();

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Home office · admin");
    });
    expect(mocks.stored.has("taskdesk-active-workspace:5")).toBe(false);
    expect(mocks.activeWorkspaceId).toBe(7);
  });

  it("switches profile, role, and cached data together", async () => {
    queryClient.setQueryData(["tickets"], ["home ticket"]);
    await renderProvider();
    await vi.waitFor(() => expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toContain("Home office"));

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Shared studio · user");
    });

    expect(mocks.activeWorkspaceId).toBe(22);
    expect(mocks.stored.get("taskdesk-active-workspace:5")).toBe("22");
    expect(queryClient.getQueryData(["tickets"])).toBeUndefined();
  });

  it("returns to the billing organization when access is revoked after a selection", async () => {
    await renderProvider();
    await vi.waitFor(() => expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toContain("Home office"));
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Shared studio · user");
    });

    mocks.revokeContextRequest = true;
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Home office · admin");
    });
    expect(mocks.stored.has("taskdesk-active-workspace:5")).toBe(false);
  });
});
