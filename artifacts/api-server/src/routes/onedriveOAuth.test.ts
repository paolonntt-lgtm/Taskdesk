import express from "express";
import { OneDriveAccessRevocationError, OneDriveBrowseError } from "../lib/onedriveGraph";
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
  const oneDriveClientArchiveTable = { organizationId: {}, ownerUserId: {} };
  return {
    usersTable,
    oneDriveConnectionsTable,
    oneDriveClientArchiveTable,
    db: { select: vi.fn(), insert: vi.fn() },
    previousConnection: null as null | Record<string, unknown>,
    insertedValues: null as null | Record<string, unknown>,
    exchangeMicrosoftCode: vi.fn(),
    refreshConnection: vi.fn(),
    getMicrosoftUser: vi.fn(),
    createDefaultFolders: vi.fn(),
    listSharedOneDriveFolderItems: vi.fn(),
    listOneDriveItemsSharedWithMe: vi.fn(),
    revokeOrganizationRootInvitations: vi.fn(),
    syncPendingOneDriveAttachments: vi.fn(),
    shareOneDriveClientFoldersWithUser: vi.fn(),
    disconnectOneDriveUser: vi.fn(),
    getSession: vi.fn(),
    failReplacementInsert: false,
    connectionInsertValues: [] as Record<string, unknown>[],
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  usersTable: mocks.usersTable,
  oneDriveConnectionsTable: mocks.oneDriveConnectionsTable,
  oneDriveClientArchiveTable: mocks.oneDriveClientArchiveTable,
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
  refreshConnection: mocks.refreshConnection,
  getMicrosoftUser: mocks.getMicrosoftUser,
  listSharedOneDriveFolderItems: mocks.listSharedOneDriveFolderItems,
  listOneDriveItemsSharedWithMe: mocks.listOneDriveItemsSharedWithMe,
  revokeOrganizationRootInvitations: mocks.revokeOrganizationRootInvitations,
  invalidateOneDriveAccessToken: vi.fn(),
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
  shareOneDriveClientFoldersWithUser: mocks.shareOneDriveClientFoldersWithUser,
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
    mocks.insertedValues = null;
    mocks.failReplacementInsert = false;
    mocks.connectionInsertValues = [];
    mocks.getSession.mockImplementation(async (sessionId: string) =>
      sessionId === "test-session"
        ? { userId: 7, expiresAt: new Date(Date.now() + 60_000) }
        : undefined);
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", CALLBACK_URI);
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    mocks.exchangeMicrosoftCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tenantId: "tenant-1",
      email: "person@example.test",
    });
    mocks.refreshConnection.mockResolvedValue("access-token");
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
    mocks.listSharedOneDriveFolderItems.mockResolvedValue({ folderName: "Test folder", items: [] });
    mocks.listOneDriveItemsSharedWithMe.mockResolvedValue([]);
    mocks.revokeOrganizationRootInvitations.mockResolvedValue(undefined);
    mocks.syncPendingOneDriveAttachments.mockResolvedValue(undefined);
    mocks.shareOneDriveClientFoldersWithUser.mockResolvedValue(undefined);
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
          : table === mocks.oneDriveConnectionsTable && mocks.previousConnection
            ? [mocks.previousConnection]
            : []),
        { limit: query.limit },
      ));
      return query;
    });
    mocks.db.insert.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.values = vi.fn((values: Record<string, unknown>) => {
        mocks.insertedValues = values;
        mocks.connectionInsertValues.push(values);
        query.onConflictDoUpdate = vi.fn(async () => {
          if (mocks.failReplacementInsert && values.microsoftEmail === "new@example.test") {
            throw new Error("Could not save the replacement OneDrive connection.");
          }
          if (values.microsoftEmail === "old@example.test") {
            mocks.previousConnection = values;
          }
        });
        return query;
      });
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

  it("completes OAuth on a separate API instance using the encrypted state", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;
    const stateCookie = connectResponse.headers.get("set-cookie")?.match(/taskdesk_onedrive_state=([^;]+)/)?.[1];
    expect(stateCookie).toBe(state);

    vi.resetModules();
    const { default: separateRouter } = await import("./onedriveOAuth");
    const separateApp = express();
    separateApp.use("/api", separateRouter);
    const separateServer = createServer(separateApp);
    await new Promise<void>((resolve, reject) => {
      separateServer.once("error", reject);
      separateServer.listen(0, "127.0.0.1", resolve);
    });
    const separateUrl = `http://127.0.0.1:${(separateServer.address() as AddressInfo).port}`;
    try {
      const callbackResponse = await fetch(
        `${separateUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
        { headers: { Cookie: `taskdesk_onedrive_state=${stateCookie}` } },
      );

      expect(callbackResponse.status).toBe(200);
      expect(await callbackResponse.text()).toContain("onedrive=connected");
      expect(mocks.exchangeMicrosoftCode).toHaveBeenCalledWith(
        "authorization-code",
        CALLBACK_URI,
        expect.any(String),
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        separateServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects tampered state and state not bound to the browser cookie", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;
    const tamperedState = `${state.startsWith("A") ? "B" : "A"}${state.slice(1)}`;

    const tamperedResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state: tamperedState })}`,
      { headers: { Cookie: `taskdesk_onedrive_state=${tamperedState}` } },
    );
    expect(await tamperedResponse.text()).toContain("onedrive=invalid_state");

    const unboundResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
    );
    expect(await unboundResponse.text()).toContain("onedrive=invalid_state");
    expect(mocks.exchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it("completes OAuth and restores the session when the session cookie is omitted", async () => {
    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
      { headers: { Cookie: `taskdesk_onedrive_state=${state}` } },
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
      { headers: { Cookie: `taskdesk_onedrive_state=${state}` } },
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

  it("checks stored authorization before reporting OneDrive as connected", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      encryptedRefreshToken: "encrypted-token",
    };

    const response = await fetch(`${baseUrl}/api/onedrive/connection`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      reconnectRequired: false,
    });
    expect(mocks.refreshConnection).toHaveBeenCalledWith(mocks.previousConnection);
  });

  it("keeps the saved connection visible but marks Microsoft reauthorization as required", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );

    const response = await fetch(`${baseUrl}/api/onedrive/connection`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      reconnectRequired: true,
    });
  });

  it("reauthorizes the same Microsoft account and restores a usable saved connection", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      rootFolderId: "existing-root",
      operatorFolderId: "existing-operator-folder",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
    };
    mocks.refreshConnection.mockRejectedValueOnce(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );

    const reconnectRequiredResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(reconnectRequiredResponse.status).toBe(200);
    expect(await reconnectRequiredResponse.json()).toMatchObject({
      connected: true,
      microsoftEmail: "person@example.test",
      reconnectRequired: true,
    });

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect?forceReauth=true`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    expect(authorizationUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizationUrl.searchParams.get("login_hint")).toBe("person@example.test");

    const state = authorizationUrl.searchParams.get("state")!;
    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "authorization-code", state })}`,
      { headers: { Cookie: `session_id=test-session; taskdesk_onedrive_state=${state}` } },
    );

    expect(callbackResponse.status).toBe(200);
    expect(await callbackResponse.text()).toContain("onedrive=connected");
    expect(mocks.createDefaultFolders).not.toHaveBeenCalled();
    expect(mocks.disconnectOneDriveUser).not.toHaveBeenCalled();
    expect(mocks.insertedValues).toMatchObject({
      userId: 7,
      organizationId: 11,
      microsoftEmail: "person@example.test",
      rootFolderId: "existing-root",
      operatorFolderId: "existing-operator-folder",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
    });

    const usableConnectionResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(usableConnectionResponse.status).toBe(200);
    expect(await usableConnectionResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      reconnectRequired: false,
    });
    expect(mocks.refreshConnection).toHaveBeenLastCalledWith(mocks.previousConnection);
  });

  it("keeps reconnect required when Microsoft rejects the reauthorization code", async () => {
    const savedConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      rootFolderId: "existing-root",
      operatorFolderId: "existing-operator-folder",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.previousConnection = savedConnection;
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );
    mocks.exchangeMicrosoftCode.mockRejectedValue(new Error("Microsoft rejected the authorization code."));

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect?forceReauth=true`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    const state = authorizationUrl.searchParams.get("state")!;

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ code: "rejected-code", state })}`,
      { headers: { Cookie: `session_id=test-session; taskdesk_onedrive_state=${state}` } },
    );

    expect(callbackResponse.status).toBe(200);
    expect(await callbackResponse.text()).toContain("onedrive=connect_error");
    expect(mocks.exchangeMicrosoftCode).toHaveBeenCalledWith(
      "rejected-code",
      CALLBACK_URI,
      expect.any(String),
    );
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.previousConnection).toBe(savedConnection);

    const statusResponse = await fetch(`${baseUrl}/api/onedrive/connection`);

    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      reconnectRequired: true,
    });
    expect(mocks.refreshConnection).toHaveBeenCalledWith(savedConnection);
  });

  it("keeps the saved connection and reconnect guidance when Microsoft consent is cancelled", async () => {
    const savedConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      rootFolderId: "existing-root",
      operatorFolderId: "existing-operator-folder",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.previousConnection = savedConnection;
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );

    const initialStatusResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(initialStatusResponse.status).toBe(200);
    expect(await initialStatusResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      reconnectRequired: true,
    });

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect?forceReauth=true`, {
      headers: { Cookie: "session_id=test-session" },
    });
    const html = await connectResponse.text();
    const locationMatch = html.match(/location\.replace\((.*)\)<\/script>/);
    const authorizationUrl = new URL(JSON.parse(locationMatch![1]) as string);
    expect(authorizationUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizationUrl.searchParams.get("login_hint")).toBe("person@example.test");
    const state = authorizationUrl.searchParams.get("state")!;

    const callbackResponse = await fetch(
      `${baseUrl}/api/onedrive/callback?${new URLSearchParams({ error: "access_denied", state })}`,
      { headers: { Cookie: `session_id=test-session; taskdesk_onedrive_state=${state}` } },
    );

    expect(callbackResponse.status).toBe(200);
    expect(await callbackResponse.text()).toContain("onedrive=cancelled");
    expect(mocks.exchangeMicrosoftCode).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.disconnectOneDriveUser).not.toHaveBeenCalled();
    expect(mocks.previousConnection).toBe(savedConnection);

    const statusResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      reconnectRequired: true,
    });
    expect(mocks.refreshConnection).toHaveBeenCalledWith(savedConnection);
  });

  it("keeps the saved connection and reconnect requirement when Microsoft profile verification fails", async () => {
    const savedConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      rootFolderId: "existing-root",
      operatorFolderId: "existing-operator-folder",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.previousConnection = savedConnection;
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );
    mocks.getMicrosoftUser.mockRejectedValue(new Error("Microsoft profile lookup failed."));

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect?forceReauth=true`, {
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

    expect(callbackResponse.status).toBe(200);
    expect(await callbackResponse.text()).toContain("onedrive=connect_error");
    expect(mocks.getMicrosoftUser).toHaveBeenCalledWith("access-token");
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.connectionInsertValues).toHaveLength(0);
    expect(mocks.disconnectOneDriveUser).not.toHaveBeenCalled();
    expect(mocks.previousConnection).toBe(savedConnection);

    const statusResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/existing-folder",
      reconnectRequired: true,
    });
    expect(mocks.refreshConnection).toHaveBeenLastCalledWith(savedConnection);
  });

  it("returns reconnect guidance instead of a server error for expired organization-share grants", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.revokeOrganizationRootInvitations.mockRejectedValue(new OneDriveAccessRevocationError(true));
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );

    const response = await fetch(`${baseUrl}/api/onedrive/organization-shares`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ONEDRIVE_RECONNECT_REQUIRED" });
    expect(mocks.db.select).not.toHaveBeenCalled();

    const connectionResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(connectionResponse.status).toBe(200);
    expect(await connectionResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      reconnectRequired: true,
    });
    expect(mocks.disconnectOneDriveUser).not.toHaveBeenCalled();
  });

  it("explains that reauthorization is needed when token renewal blocks safe disconnection", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      encryptedRefreshToken: "encrypted-token",
    };
    mocks.disconnectOneDriveUser.mockRejectedValue(new OneDriveAccessRevocationError(true));
    mocks.refreshConnection.mockRejectedValue(
      new OneDriveBrowseError("Reconnect your OneDrive account to continue.", 401),
    );

    const response = await fetch(`${baseUrl}/api/onedrive/connection`, { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ONEDRIVE_RECONNECT_REQUIRED" });
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);

    const connectionResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(connectionResponse.status).toBe(200);
    expect(await connectionResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "person@example.test",
      organizationShareUrl: "https://onedrive.example.test/folder",
      reconnectRequired: true,
    });
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
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11, { keepConnectionRecord: true });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("keeps the previous connection and folder access when saving a replacement fails", async () => {
    mocks.previousConnection = {
      id: 31,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "old@example.test",
      encryptedRefreshToken: "old-encrypted-refresh-token",
      rootFolderId: "old-root",
      operatorFolderId: "old-operator",
      organizationShareUrl: "https://onedrive.example.test/old-folder",
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
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
    mocks.disconnectOneDriveUser.mockResolvedValue(undefined);
    mocks.failReplacementInsert = true;

    const connectResponse = await fetch(`${baseUrl}/api/onedrive/connect`, {
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

    expect(callbackResponse.status).toBe(200);
    expect(await callbackResponse.text()).toContain("onedrive=connect_error");
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11, { keepConnectionRecord: true });
    expect(mocks.connectionInsertValues).toHaveLength(1);
    expect(mocks.connectionInsertValues[0]).toMatchObject({ microsoftEmail: "new@example.test" });
    expect(mocks.previousConnection).toMatchObject({
      microsoftEmail: "old@example.test",
      rootFolderId: "old-root",
      operatorFolderId: "old-operator",
      organizationShareUrl: "https://onedrive.example.test/old-folder",
    });

    const connectionResponse = await fetch(`${baseUrl}/api/onedrive/connection`);
    expect(await connectionResponse.json()).toEqual({
      connected: true,
      microsoftEmail: "old@example.test",
      organizationShareUrl: "https://onedrive.example.test/old-folder",
      reconnectRequired: false,
    });

    const foldersResponse = await fetch(`${baseUrl}/api/onedrive/folders/7/items`);
    expect(foldersResponse.status).toBe(200);
    expect(await foldersResponse.json()).toEqual({ folderName: "Test folder", items: [] });
    expect(mocks.listSharedOneDriveFolderItems).toHaveBeenCalledWith(7, 11, 7, undefined);
  });
});
