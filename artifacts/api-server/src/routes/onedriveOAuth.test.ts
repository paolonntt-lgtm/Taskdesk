import express from "express";
import { OneDriveAccessRevocationError } from "../lib/onedriveGraph";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const usersTable = { id: {}, name: {}, role: {}, organizationId: {} };
  const oneDriveConnectionsTable = {
    id: {},
    userId: {},
    organizationId: {},
    tenantId: {},
  };
  return {
    usersTable,
    oneDriveConnectionsTable,
    db: { select: vi.fn(), insert: vi.fn() },
    previousConnection: null as null | Record<string, unknown>,
    exchangeMicrosoftCode: vi.fn(),
    getMicrosoftUser: vi.fn(),
    createDefaultFolders: vi.fn(),
    listOneDriveItemsSharedWithMe: vi.fn(),
    revokeOrganizationRootInvitations: vi.fn(),
    syncPendingOneDriveAttachments: vi.fn(),
    disconnectOneDriveUser: vi.fn(),
    getSession: vi.fn(),
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  usersTable: mocks.usersTable,
  oneDriveConnectionsTable: mocks.oneDriveConnectionsTable,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((...values: unknown[]) => values),
}));

vi.mock("../lib/session", () => ({
  getSessionId: (req: { headers: { cookie?: string } }) =>
    req.headers.cookie?.match(/(?:^|;\s*)session_id=([^;]+)/)?.[1],
  getCurrentUserId: (req: { headers: { cookie?: string } }) =>
    req.headers.cookie?.includes("session_id=test-session") ? 7 : undefined,
  getSession: mocks.getSession,
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: { currentUser?: unknown }, _res: unknown, next: () => void) => {
    req.currentUser = { id: 7, organizationId: 11, role: "admin" };
    next();
  },
}));

vi.mock("../lib/onedriveGraph", () => ({
  createDefaultFolders: mocks.createDefaultFolders,
  canConnectMicrosoftTenant: () => true,
  encryptRefreshToken: () => "encrypted-refresh-token",
  exchangeMicrosoftCode: mocks.exchangeMicrosoftCode,
  getMicrosoftUser: mocks.getMicrosoftUser,
  listOneDriveItemsSharedWithMe: mocks.listOneDriveItemsSharedWithMe,
  revokeOrganizationRootInvitations: mocks.revokeOrganizationRootInvitations,
  invalidateOneDriveAccessToken: vi.fn(),
  listSharedOneDriveFolderItems: vi.fn(),
  OneDriveBrowseError: class extends Error {
    constructor(message: string, readonly statusCode: number) {
      super(message);
    }
  },
  OneDriveGraphError: class extends Error {
    constructor(message: string, readonly statusCode: number) {
      super(message);
    }
  },
  OneDriveAccessRevocationError: class extends Error {
    constructor(readonly requiresReconnect = false) {
      super("Microsoft access to shared Taskdesk folders could not be fully revoked.");
    }
  },
  previewSharedOneDriveItem: vi.fn(),
  acquireOneDriveDownloadSlot: vi.fn(),
  downloadSharedOneDriveItem: vi.fn(),
  disconnectOneDriveUser: mocks.disconnectOneDriveUser,
  syncPendingOneDriveAttachments: mocks.syncPendingOneDriveAttachments,
  uploadSharedOneDriveFile: vi.fn(),
}));

const CALLBACK_URI = "https://www.taskdesk.it/api/onedrive/callback";

describe("Microsoft OneDrive OAuth callback", () => {
  let server: Server;
  let baseUrl: string;
  const originalClientId = process.env.VITE_MICROSOFT_CLIENT_ID;

  beforeAll(async () => {
    const { default: router } = await import("./onedriveOAuth");
    const app = express();
    app.use((req, _res, next) => {
      Object.assign(req, { log: { warn: vi.fn(), error: vi.fn() } });
      next();
    });
    app.use("/api", router);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.previousConnection = null;
    mocks.getSession.mockImplementation(async (sessionId: string) =>
      sessionId === "test-session"
        ? { userId: 7, expiresAt: new Date(Date.now() + 60_000) }
        : undefined);
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", CALLBACK_URI);
    mocks.exchangeMicrosoftCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tenantId: "tenant-1",
      email: "person@example.test",
    });
    mocks.getMicrosoftUser.mockResolvedValue({
      displayName: "Test Person",
      mail: "person@example.test",
      userPrincipalName: "person@example.test",
    });
    mocks.createDefaultFolders.mockResolvedValue({
      rootFolderId: "root-folder",
      operatorFolderId: "operator-folder",
      shareUrl: "https://onedrive.example.test/folder",
    });
    mocks.listOneDriveItemsSharedWithMe.mockResolvedValue([]);
    mocks.revokeOrganizationRootInvitations.mockResolvedValue(undefined);
    mocks.syncPendingOneDriveAttachments.mockResolvedValue(undefined);
    mocks.db.select.mockImplementation((selection?: unknown) => {
      let table: unknown;
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn((value: unknown) => {
        table = value;
        return query;
      });
      query.limit = vi.fn(async () => {
        if (table === mocks.usersTable) {
          return [{ id: 7, name: "Test Person", role: "admin", organizationId: 11 }];
        }
        return table === mocks.oneDriveConnectionsTable && mocks.previousConnection
          ? [mocks.previousConnection]
          : [];
      });
      query.where = vi.fn(() => Object.assign(
        Promise.resolve(table === mocks.usersTable
          ? [{ id: 7, name: "Test Person", role: "admin", organizationId: 11 }]
          : []),
        { limit: query.limit },
      ));
      return query;
    });
    mocks.db.insert.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.values = vi.fn(() => query);
      query.onConflictDoUpdate = vi.fn(async () => undefined);
      return query;
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    vi.unstubAllEnvs();
    if (originalClientId === undefined) delete process.env.VITE_MICROSOFT_CLIENT_ID;
    else process.env.VITE_MICROSOFT_CLIENT_ID = originalClientId;
  });

  it("uses the configured URI for authorization and code redemption despite request-host aliases", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: {
        Cookie: "session_id=test-session",
        Origin: "https://unregistered-preview.example",
      },
    });
    expect(connectResponse.status).toBe(200);
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    expect(locationMatch).toBeTruthy();
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(CALLBACK_URI);

    const state = authorizationUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    const stateCookie = connectResponse.headers.get("set-cookie")?.match(/taskdesk_onedrive_state=([^;]+)/)?.[1];
    expect(stateCookie).toBe(state);

    vi.stubEnv(
      "MICROSOFT_ONEDRIVE_REDIRECT_URI",
      "https://registered-preview.example/api/onedrive/callback",
    );
    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state: state! })}`,
      { headers: { Cookie: `session_id=test-session; taskdesk_onedrive_state=${state}` } },
    );
    expect(callbackResponse.status).toBe(200);
    expect(mocks.exchangeMicrosoftCode).toHaveBeenCalledWith(
      "authorization-code",
      CALLBACK_URI,
      expect.any(String),
    );
  });

  it("completes OAuth and restores the session when the callback omits its cookies", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
    );

    expect(callbackResponse.status).toBe(200);
    expect(mocks.exchangeMicrosoftCode).toHaveBeenCalledWith(
      "authorization-code",
      CALLBACK_URI,
      expect.any(String),
    );
    expect(callbackResponse.headers.get("set-cookie")).toContain("session_id=test-session");
  });

  it("rejects a callback when its original TaskDesk session has expired", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;
    mocks.getSession.mockResolvedValueOnce(undefined);

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
    );
    const htmlResult = await callbackResponse.text();

    expect(callbackResponse.status).toBe(200);
    expect(htmlResult).toContain("onedrive=invalid_session");
    expect(mocks.exchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it("returns a clear configuration error instead of starting OAuth without a callback", async () => {
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "");
    const response = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("MICROSOFT_ONEDRIVE_REDIRECT_URI"),
    });
    expect(mocks.exchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it("blocks browsing another organization member's OneDrive root", async () => {
    const response = await fetch(`${baseUrl}/api/onedrive/folders/8/items`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "You can browse only your own OneDrive here.",
    });
  });

  it("explains that reauthorization is needed when token renewal blocks safe disconnection", async () => {
    mocks.disconnectOneDriveUser.mockRejectedValue(new OneDriveAccessRevocationError(true));

    const response = await fetch(`${baseUrl}/api/onedrive/connection`, { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ONEDRIVE_RECONNECT_REQUIRED" });
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);
  });

  it("keeps the local connection and gives retry guidance when Microsoft revocation fails", async () => {
    mocks.disconnectOneDriveUser.mockRejectedValue(new OneDriveAccessRevocationError());

    const response = await fetch(`${baseUrl}/api/onedrive/connection`, { method: "DELETE" });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "ONEDRIVE_REVOCATION_FAILED" });
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);
  });

  it("reports successful disconnection only after revocation completes", async () => {
    mocks.disconnectOneDriveUser.mockResolvedValue(undefined);

    const response = await fetch(`${baseUrl}/api/onedrive/connection`, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false });
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);
  });

  it("preserves the old account and tells the user how to retry a failed account replacement", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "old@example.test",
      rootFolderId: "old-root",
    };
    mocks.getMicrosoftUser.mockResolvedValue({
      displayName: "New Person",
      mail: "new@example.test",
      userPrincipalName: "new@example.test",
    });
    mocks.createDefaultFolders.mockResolvedValue({
      rootFolderId: "new-root",
      operatorFolderId: "new-operator",
      shareUrl: "https://onedrive.example.test/new-folder",
    });
    mocks.disconnectOneDriveUser.mockRejectedValue(new OneDriveAccessRevocationError());

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect?returnTo=%2Fapp%2Fsettings`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
      { headers: { Cookie: `session_id=test-session; taskdesk_onedrive_state=${state}` } },
    );

    const callbackHtml = await callbackResponse.text();
    expect(callbackHtml).toContain("onedrive=revocation_failed");
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
});
