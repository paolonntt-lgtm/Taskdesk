import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const connectionTable = { id: {}, userId: {}, organizationId: {} };
  const targetConnection: Record<string, unknown> = {};
  const collaboratorConnection: Record<string, unknown> = {};
  const select = vi.fn();
  const removeWhere = vi.fn();
  const remove = vi.fn(() => ({ where: removeWhere }));
  return {
    connectionTable,
    targetConnection,
    collaboratorConnection,
    select,
    removeWhere,
    remove,
    db: { select, delete: remove, transaction: vi.fn() },
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  oneDriveConnectionsTable: mocks.connectionTable,
  oneDriveClientArchiveTable: {},
  oneDriveClientFoldersTable: {},
  clientsTable: {},
  ticketAttachmentOneDriveCopiesTable: {},
  ticketAttachmentsTable: {},
  ticketsTable: {},
  usersTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  asc: (...columns: unknown[]) => columns,
  eq: (...values: unknown[]) => values,
  isNotNull: (value: unknown) => value,
  isNull: (value: unknown) => value,
  or: (...conditions: unknown[]) => conditions,
}));

import {
  disconnectOneDriveUser,
  encryptRefreshToken,
  OneDriveAccessRevocationError,
} from "./onedriveGraph";

describe("OneDrive disconnection after Microsoft revocation", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://www.taskdesk.it/api/onedrive/callback");
    Object.assign(mocks.targetConnection, {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "owner@example.test",
      encryptedRefreshToken: encryptRefreshToken("refresh-token", 7, 11),
      rootFolderId: "taskdesk-root",
    });
    Object.assign(mocks.collaboratorConnection, {
      id: 32,
      userId: 8,
      organizationId: 11,
      microsoftEmail: "collaborator@example.test",
      encryptedRefreshToken: encryptRefreshToken("collaborator-refresh-token", 8, 11),
      rootFolderId: "collaborator-root",
    });
    mocks.select.mockImplementation(() => {
      const result = mocks.select.mock.calls.length === 1
        ? [mocks.targetConnection]
        : [mocks.targetConnection, mocks.collaboratorConnection];
      const query: Record<string, unknown> = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(async () => result),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });
    let refreshedConnectionIndex = 0;
    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const connection = refreshedConnectionIndex++ === 0
        ? mocks.collaboratorConnection
        : mocks.targetConnection;
      const query: Record<string, unknown> = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        for: vi.fn(async () => [connection]),
      };
      return callback({ select: vi.fn(() => query) });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("retains the local connection when Microsoft cannot confirm permission revocation", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "Graph unavailable" } }), { status: 503 });
    }) as typeof fetch;

    await expect(disconnectOneDriveUser(7, 11))
      .rejects.toBeInstanceOf(OneDriveAccessRevocationError);

    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("requires reauthorization when Microsoft rejects the Graph access token", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { message: "Invalid authentication token" } }), { status: 401 });
    }) as typeof fetch;

    const error = await disconnectOneDriveUser(7, 11).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(OneDriveAccessRevocationError);
    expect(error).toMatchObject({ requiresReconnect: true });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes the local connection after Microsoft confirms revocation", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    }) as typeof fetch;

    await expect(disconnectOneDriveUser(7, 11)).resolves.toBeUndefined();

    expect(mocks.remove).toHaveBeenCalledWith(mocks.connectionTable);
    expect(mocks.removeWhere).toHaveBeenCalled();
  });

  it("keeps the local connection when revoking access for an account replacement", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 });
      }
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    }) as typeof fetch;

    await expect(disconnectOneDriveUser(7, 11, { keepConnectionRecord: true })).resolves.toBeUndefined();

    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("revokes only the disconnected collaborator's folders in their organization", async () => {
    Object.assign(mocks.targetConnection, {
      id: 31,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "owner@example.test",
      rootFolderId: "owner-root-org-11",
    });
    Object.assign(mocks.collaboratorConnection, {
      id: 32,
      userId: 8,
      organizationId: 11,
      microsoftEmail: "collaborator@example.test",
      encryptedRefreshToken: encryptRefreshToken("collaborator-refresh-token", 8, 11),
      rootFolderId: "collaborator-root-org-11",
    });

    const selectedRows = [
      [mocks.collaboratorConnection],
      [mocks.targetConnection, mocks.collaboratorConnection],
      [{ organizationId: 11, ownerUserId: 7 }],
      [mocks.targetConnection],
      [{ organizationId: 11, driveItemId: "client-folder-org-11" }],
    ];
    const whereConditions: unknown[] = [];
    let selectIndex = 0;
    mocks.select.mockImplementation(() => {
      const rows = selectedRows[selectIndex++] ?? [];
      const query: Record<string, any> = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => query),
        where: vi.fn((condition: unknown) => {
          whereConditions.push(condition);
          return query;
        }),
        limit: vi.fn(async () => rows),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return query;
    });

    let refreshIndex = 0;
    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const connection = refreshIndex++ === 0
        ? mocks.targetConnection
        : mocks.collaboratorConnection;
      const query: Record<string, any> = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        for: vi.fn(async () => [connection]),
      };
      return callback({ select: vi.fn(() => query) });
    });

    const removedPermissions = new Set<string>();
    const graphRequests: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      graphRequests.push(`${method} ${url}`);
      if (url.includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 });
      }
      const itemId = decodeURIComponent(url.match(/drive\/items\/([^/?]+)/)?.[1] ?? "");
      if (method === "DELETE") {
        const permissionId = decodeURIComponent(url.split("/permissions/")[1] ?? "");
        removedPermissions.add(permissionId);
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (itemId === "client-folder-org-11" && !url.includes("page=2")) {
        return new Response(JSON.stringify({
          value: [{ id: "unrelated-reader", roles: ["read"], invitation: { email: "someone-else@example.test" } }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/drive/items/client-folder-org-11/permissions?page=2",
        }), { status: 200 });
      }
      const permissionByItem: Record<string, { id: string; email: string }[]> = {
        ...(itemId === "client-folder-org-11" && url.includes("page=2")
          ? { "client-folder-org-11": [{ id: "client-collaborator", email: "collaborator@example.test" }] }
          : {}),
        "owner-root-org-11": [{ id: "owner-root-collaborator", email: "collaborator@example.test" }],
        "collaborator-root-org-11": [{ id: "collaborator-root-owner", email: "owner@example.test" }],
      };
      const permissions = (permissionByItem[itemId] ?? [])
        .filter(({ id }) => !removedPermissions.has(id))
        .map(({ id, email }) => ({
          id,
          roles: ["read"],
          invitation: { email },
        }));
      return new Response(JSON.stringify({ value: permissions }), { status: 200 });
    }) as typeof fetch;

    await expect(disconnectOneDriveUser(8, 11)).resolves.toBeUndefined();

    expect(removedPermissions).toEqual(new Set([
      "client-collaborator",
      "owner-root-collaborator",
      "collaborator-root-owner",
    ]));
    expect(graphRequests.join("\n")).not.toContain("other-org-root");
    expect(graphRequests.some((request) => request.includes("client-folder-org-11/permissions?page=2"))).toBe(true);
    expect(whereConditions.some((condition) => JSON.stringify(condition).includes("11"))).toBe(true);
    expect(mocks.removeWhere).toHaveBeenCalled();
  });
});
