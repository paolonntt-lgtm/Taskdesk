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
    exchangeMicrosoftCode: vi.fn(),
    getMicrosoftUser: vi.fn(),
    createDefaultFolders: vi.fn(),
    inviteCollaboratorsToTaskdeskFolders: vi.fn(),
    syncPendingOneDriveAttachments: vi.fn(),
    disconnectOneDriveUser: vi.fn(),
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
  inviteCollaboratorsToTaskdeskFolders: mocks.inviteCollaboratorsToTaskdeskFolders,
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

const CALLBACK_URI = "https://taskdesk.it/api/onedrive/callback";

describe("Microsoft OneDrive OAuth callback", () => {
  let server: Server;
  let baseUrl: string;
  const originalClientId = process.env.VITE_MICROSOFT_CLIENT_ID;

  beforeAll(async () => {
    const { default: router } = await import("./onedriveOAuth");
    const app = express();
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
    mocks.inviteCollaboratorsToTaskdeskFolders.mockResolvedValue(0);
    mocks.syncPendingOneDriveAttachments.mockResolvedValue(undefined);
    mocks.db.select.mockImplementation((selection?: unknown) => {
      let table: unknown;
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.from = vi.fn((value: unknown) => {
        table = value;
        return query;
      });
      query.where = vi.fn(async () =>
        table === mocks.usersTable
          ? [{ id: 7, name: "Test Person", role: "admin", organizationId: 11 }]
          : [],
      );
      query.limit = vi.fn(async () => []);
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

  it("explains that reauthorization is needed when token renewal blocks safe disconnection", async () => {
    mocks.disconnectOneDriveUser.mockRejectedValue(new OneDriveAccessRevocationError(true));

    const response = await fetch(`${baseUrl}/api/onedrive/connection`, { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "ONEDRIVE_RECONNECT_REQUIRED" });
    expect(mocks.disconnectOneDriveUser).toHaveBeenCalledWith(7, 11);
  });
});
