// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAccessRevokedAlert } from "@/components/WorkspaceAccessRevokedAlert";
import { AuthProvider, useAuth } from "./AuthContext";
import { LanguageProvider, useLanguage } from "./LanguageContext";

const mocks = vi.hoisted(() => ({
  activeWorkspaceId: null as number | null,
  stored: new Map<string, string>(),
  revokeContextRequest: false,
  failNextHomeRequest: false,
  refreshAuth: null as null | (() => Promise<void>),
  alert: vi.fn(),
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert },
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
  createAuthRefreshHandler: (options: {
    request: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
    setCurrentUser: (user: never) => void;
  }) => async () => {
    const response = await options.request();
    if (response.ok) options.setCurrentUser(await response.json() as never);
  },
  startAuthRefreshPolling: (refresh: () => Promise<void>) => {
    mocks.refreshAuth = refresh;
    return () => {};
  },
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
  const { user, workspaceAccessRevoked, switchWorkspace, login } = useAuth();
  const { lang, setLang } = useLanguage();
  const [switchError, setSwitchError] = useState("");
  return (
    <div>
      <span data-testid="active-workspace">{user?.organizationName} · {user?.role}</span>
      <span data-testid="authenticated-user">{user ? String(user.id) : "signed-out"}</span>
      <span data-testid="workspace-access-revoked">{String(workspaceAccessRevoked)}</span>
      <span data-testid="language">{lang}</span>
      <button data-testid="set-english" onClick={() => setLang("en")}>English</button>
      <button data-testid="set-italian" onClick={() => setLang("it")}>Italiano</button>
      <button
        data-testid="switch-to-shared"
        onClick={() => void switchWorkspace(22).catch((error: Error) => setSwitchError(error.message))}
      >
        Switch
      </button>
      <button
        data-testid="sign-in-again"
        onClick={() => void login("ada@example.test", "password", true).catch(() => {})}
      >
        Sign in again
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
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <WorkspaceAccessRevokedAlert />
              <Consumer />
            </AuthProvider>
          </QueryClientProvider>
        </LanguageProvider>,
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
    mocks.failNextHomeRequest = false;
    mocks.refreshAuth = null;
    mocks.alert.mockReset();
    mocks.apiFetch.mockReset().mockImplementation(async (path: string) => {
      if (path !== "/auth/me") return apiResponse(204, null);
      if (mocks.activeWorkspaceId === 22 && mocks.revokeContextRequest) return apiResponse(403, {});
      if (mocks.activeWorkspaceId !== 22 && mocks.failNextHomeRequest) {
        mocks.failNextHomeRequest = false;
        return apiResponse(503, {});
      }
      return apiResponse(200, currentWorkspaceUser());
    });
    mocks.apiPost.mockReset().mockResolvedValue({ user: homeUser });
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
    expect(host.querySelector('[data-testid="workspace-access-revoked"]')?.textContent).toBe("false");
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith(
      "Spazio non disponibile",
      "Lo spazio selezionato non è più disponibile. Sei stato riportato all’organizzazione principale.",
      [{ text: "Annulla" }],
    );
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

  it("does not show a revocation notice after a voluntary switch fails", async () => {
    await renderProvider();
    await vi.waitFor(() => expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toContain("Home office"));
    mocks.revokeContextRequest = true;
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Home office · admin");
    });
    expect(mocks.stored.has("taskdesk-active-workspace:5")).toBe(false);
    expect(host.querySelector('[data-testid="workspace-access-revoked"]')?.textContent).toBe("false");
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it("clears shared data and signs out if home reload fails after access is denied", async () => {
    await renderProvider();
    await vi.waitFor(() => expect(host.querySelector('[data-testid="authenticated-user"]')?.textContent).toBe("5"));
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Shared studio · user");
    });
    expect(mocks.stored.get("taskdesk-active-workspace:5")).toBe("22");

    queryClient.setQueryData(["tickets"], ["shared workspace ticket"]);
    expect(queryClient.getQueryData(["tickets"])).toEqual(["shared workspace ticket"]);
    mocks.revokeContextRequest = true;
    mocks.failNextHomeRequest = true;
    await act(async () => {
      await mocks.refreshAuth?.();
    });

    expect(mocks.activeWorkspaceId).toBe(7);
    expect(mocks.stored.has("taskdesk-active-workspace:5")).toBe(false);
    expect(host.querySelector('[data-testid="authenticated-user"]')?.textContent).toBe("signed-out");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(host.querySelector('[data-testid="workspace-access-revoked"]')?.textContent).toBe("false");
    expect(mocks.alert).not.toHaveBeenCalled();

    mocks.revokeContextRequest = false;
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="sign-in-again"]')?.click();
    });

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="authenticated-user"]')?.textContent).toBe("5");
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Home office · admin");
    });
    expect(mocks.stored.has("taskdesk-active-workspace:5")).toBe(false);
    expect(mocks.activeWorkspaceId).toBe(7);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it.each([
    {
      lang: "it" as const,
      title: "Spazio non disponibile",
      message: "Lo spazio selezionato non è più disponibile. Sei stato riportato all’organizzazione principale.",
      buttonTestId: undefined,
    },
    {
      lang: "en" as const,
      title: "Workspace unavailable",
      message: "The selected workspace is no longer available. You have been returned to your main organization.",
      buttonTestId: "set-english",
    },
  ])("shows the $lang warning once after automatic workspace fallback", async ({ lang, title, message, buttonTestId }) => {
    await renderProvider();
    await vi.waitFor(() => expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toContain("Home office"));
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="switch-to-shared"]')?.click();
    });
    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Shared studio · user");
    });

    if (buttonTestId) {
      await act(async () => {
        host.querySelector<HTMLButtonElement>(`[data-testid="${buttonTestId}"]`)?.click();
      });
    }
    await vi.waitFor(() => expect(host.querySelector('[data-testid="language"]')?.textContent).toBe(lang));
    expect(mocks.alert).not.toHaveBeenCalled();

    mocks.revokeContextRequest = true;
    await act(async () => {
      await mocks.refreshAuth?.();
    });

    expect(host.querySelector('[data-testid="active-workspace"]')?.textContent).toBe("Home office · admin");
    expect(host.querySelector('[data-testid="workspace-access-revoked"]')?.textContent).toBe("false");
    expect(mocks.alert).toHaveBeenCalledTimes(1);
    expect(mocks.alert).toHaveBeenCalledWith(title, message, [{ text: lang === "it" ? "Annulla" : "Cancel" }]);

    await act(async () => {
      host.querySelector<HTMLButtonElement>(`[data-testid="${lang === "it" ? "set-english" : "set-italian"}"]`)?.click();
    });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
  });
});
