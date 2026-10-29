import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const connectionsTable = { id: {}, userId: {}, organizationId: {} };
  const usersTable = { id: {}, isActive: {} };
  const connection: Record<string, unknown> = {};
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const select = vi.fn();
  const update = vi.fn(() => ({ set: updateSet }));
  const transaction = vi.fn();
  return {
    connectionsTable,
    usersTable,
    connection,
    updateWhere,
    updateSet,
    select,
    update,
    transaction,
    db: { select, update, transaction },
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  oneDriveConnectionsTable: mocks.connectionsTable,
  usersTable: mocks.usersTable,
  ticketAttachmentOneDriveCopiesTable: {},
  ticketAttachmentsTable: {},
  ticketsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...values: unknown[]) => values,
  asc: (...columns: unknown[]) => columns,
  isNotNull: (value: unknown) => value,
  isNull: (value: unknown) => value,
  or: (...conditions: unknown[]) => conditions,
}));

import {
  backfillOneDriveOrganizationShareUrls,
  encryptRefreshToken,
} from "./onedriveGraph";

describe("OneDrive organization folder URL recovery", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://www.taskdesk.it/api/onedrive/callback");
    Object.assign(mocks.connection, {
      id: 41,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "owner@example.test",
      encryptedRefreshToken: encryptRefreshToken("refresh-token", 7, 11),
      rootFolderId: "taskdesk-root",
      organizationShareUrl: null,
    });

    mocks.select.mockImplementation(() => {
      const query: Record<string, unknown> = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => query),
        where: vi.fn(async () => [{ connection: mocks.connection }]),
      };
      return query;
    });

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const query: Record<string, unknown> = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        for: vi.fn(async () => [mocks.connection]),
      };
      return callback({ select: vi.fn(() => query) });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("rebuilds and stores missing folder URLs from existing OneDrive connections", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ webUrl: "https://onedrive.example.test/taskdesk" }), { status: 200 });
    }) as typeof fetch;

    await expect(backfillOneDriveOrganizationShareUrls(11)).resolves.toBe(1);

    expect(mocks.updateSet).toHaveBeenCalledWith({
      organizationShareUrl: "https://onedrive.example.test/taskdesk",
    });
    expect(mocks.updateWhere).toHaveBeenCalled();
  });

});
