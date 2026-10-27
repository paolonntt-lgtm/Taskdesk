import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    row: Record<string, unknown> | null;
    transactionTail: Promise<void>;
  } = {
    row: null,
    transactionTail: Promise.resolve(),
  };
  const oneDriveConnectionsTable = { id: {}, userId: {}, organizationId: {} };

  const transaction = async (callback: (tx: any) => Promise<unknown>) => {
    const previous = state.transactionTail;
    let release!: () => void;
    state.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;

    const tx = {
      select: () => {
        const query: any = {
          from: () => query,
          where: () => query,
          for: async () => state.row ? [{ ...state.row }] : [],
        };
        return query;
      },
      update: () => ({
        set: (changes: Record<string, unknown>) => ({
          where: async () => {
            if (state.row) state.row = { ...state.row, ...changes };
          },
        }),
      }),
    };

    try {
      return await callback(tx);
    } finally {
      release();
    }
  };

  return {
    state,
    oneDriveConnectionsTable,
    db: { transaction: vi.fn(transaction) },
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  oneDriveConnectionsTable: mocks.oneDriveConnectionsTable,
  ticketAttachmentOneDriveCopiesTable: {},
  ticketAttachmentsTable: {},
  ticketsTable: {},
  usersTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  mocks.state.row = null;
  mocks.state.transactionTail = Promise.resolve();
  vi.clearAllMocks();
});

describe("OneDrive refresh coordination", () => {
  it("serializes refreshes from separate API instances and rereads the rotated token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://www.taskdesk.it/api/onedrive/callback");

    vi.resetModules();
    const firstInstance = await import("./onedriveGraph");
    const firstRefreshToken = firstInstance.encryptRefreshToken("refresh-0", 7, 11);
    const connection = {
      id: 41,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      encryptedRefreshToken: firstRefreshToken,
      rootFolderId: "root",
      operatorFolderId: "operator",
      organizationShareUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.state.row = { ...connection };

    vi.resetModules();
    const secondInstance = await import("./onedriveGraph");
    const usedRefreshTokens: string[] = [];
    globalThis.fetch = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      const submitted = new URLSearchParams(init?.body as URLSearchParams).get("refresh_token")!;
      usedRefreshTokens.push(submitted);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const sequence = usedRefreshTokens.length - 1;
      return new Response(JSON.stringify({
        access_token: `access-${sequence}`,
        refresh_token: `refresh-${sequence + 1}`,
        expires_in: 3600,
      }), { status: 200 });
    });

    const [firstAccessToken, secondAccessToken] = await Promise.all([
      firstInstance.refreshConnection(connection),
      secondInstance.refreshConnection(connection),
    ]);

    expect(usedRefreshTokens).toEqual(["refresh-0", "refresh-1"]);
    expect(firstAccessToken).toBe("access-0");
    expect(secondAccessToken).toBe("access-1");
    expect(mocks.db.transaction).toHaveBeenCalledTimes(2);
  });

  it("keeps reconnect guidance when Microsoft rejects the refresh token", async () => {
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://www.taskdesk.it/api/onedrive/callback");

    vi.resetModules();
    const graph = await import("./onedriveGraph");
    const encryptedRefreshToken = graph.encryptRefreshToken("expired-refresh", 7, 11);
    const connection = {
      id: 52,
      userId: 7,
      organizationId: 11,
      tenantId: "tenant-1",
      microsoftEmail: "person@example.test",
      encryptedRefreshToken,
      rootFolderId: "root",
      operatorFolderId: "operator",
      organizationShareUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.state.row = { ...connection };
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: "invalid_grant",
      error_description: "The refresh token is no longer valid.",
    }), { status: 400 }));

    await expect(graph.refreshConnection(connection)).rejects.toMatchObject({
      name: "OneDriveBrowseError",
      message: "Reconnect your OneDrive account to continue.",
      statusCode: 401,
    });
  });
});
