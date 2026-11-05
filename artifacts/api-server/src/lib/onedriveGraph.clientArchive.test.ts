import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const oneDriveConnectionsTable = { id: {}, userId: {}, organizationId: {}, microsoftEmail: {} };
  const oneDriveClientArchiveTable = { organizationId: {}, ownerUserId: {} };
  const oneDriveClientFoldersTable = { organizationId: {}, clientId: {} };
  const clientsTable = { id: {}, name: {}, organizationId: {} };
  const ticketAttachmentsTable = { id: {}, ticketId: {}, fileName: {} };
  const ticketsTable = { id: {}, organizationId: {}, clientId: {} };
  const usersTable = { id: {}, name: {}, isActive: {}, role: {} };
  const ticketAttachmentOneDriveCopiesTable = { attachmentId: {} };
  const owner: Record<string, any> = {};
  const archive: Record<string, any> = {};
  const clientFolder: Record<string, any> = {};
  const attachment: Record<string, any> = {};
  const ticket: Record<string, any> = {};
  const folderRecords: Record<string, any>[] = [];
  const graphCalls: Array<{ url: string; method: string; body?: any }> = [];
  const updates: any[] = [];
  const inserts: any[] = [];
  const openAiCreate = vi.fn();
  return {
    oneDriveConnectionsTable,
    oneDriveClientArchiveTable,
    oneDriveClientFoldersTable,
    clientsTable,
    ticketAttachmentsTable,
    ticketsTable,
    usersTable,
    ticketAttachmentOneDriveCopiesTable,
    owner,
    archive,
    clientFolder,
    attachment,
    ticket,
    folderRecords,
    graphCalls,
    updates,
    inserts,
    openAiCreate,
  };
});

vi.mock("@workspace/db", () => {
  const resolveRows = (table: unknown, selection: any) => {
    if (table === mocks.oneDriveClientArchiveTable) return [mocks.archive];
    if (table === mocks.oneDriveConnectionsTable) {
      if (selection?.connection) return [{ connection: mocks.owner }];
      if (selection?.microsoftEmail) return [{
        microsoftEmail: "collaborator@example.test",
        userId: 8,
      }];
      return [mocks.owner];
    }
    if (table === mocks.clientsTable) return [{ id: 4, name: "Studio Test" }];
    if (table === mocks.oneDriveClientFoldersTable) return mocks.folderRecords;
    if (table === mocks.ticketAttachmentsTable) return [mocks.attachment];
    if (table === mocks.ticketsTable) return [mocks.ticket];
    if (table === mocks.usersTable) return [{ name: "Owner" }];
    return [];
  };

  const makeQuery = (selection: any, table?: unknown, rows?: any[]) => {
    const query: any = {
      from: (nextTable: unknown) => makeQuery(selection, nextTable),
      innerJoin: () => query,
      where: () => query,
      limit: async () => rows ?? resolveRows(table, selection),
      orderBy: () => query,
      for: async () => rows ?? resolveRows(table, selection),
      then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows ?? resolveRows(table, selection)).then(resolve, reject),
    };
    return query;
  };
  const update = vi.fn((table: unknown) => ({
    set: (value: unknown) => {
      mocks.updates.push({ table, value });
      return { where: vi.fn(async () => undefined) };
    },
  }));
  const insert = vi.fn((table: unknown) => ({
    values: (value: unknown) => {
      mocks.inserts.push({ table, value });
      return {
        onConflictDoUpdate: () => ({
          returning: async () => {
            if (table === mocks.oneDriveClientFoldersTable) {
              Object.assign(mocks.clientFolder, value);
              if (!mocks.folderRecords.length) mocks.folderRecords.push(mocks.clientFolder);
              return [mocks.clientFolder];
            }
            return [];
          },
        }),
        onConflictDoNothing: () => ({ returning: async () => [] }),
      };
    },
  }));
  const db = {
    select: vi.fn((selection?: any) => makeQuery(selection)),
    update,
    insert,
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: (selection?: any) => makeQuery(selection),
        update,
        insert,
      };
      return callback(tx);
    }),
  };
  return {
    db,
    oneDriveConnectionsTable: mocks.oneDriveConnectionsTable,
    oneDriveClientArchiveTable: mocks.oneDriveClientArchiveTable,
    oneDriveClientFoldersTable: mocks.oneDriveClientFoldersTable,
    clientsTable: mocks.clientsTable,
    ticketAttachmentsTable: mocks.ticketAttachmentsTable,
    ticketsTable: mocks.ticketsTable,
    usersTable: mocks.usersTable,
    ticketAttachmentOneDriveCopiesTable: mocks.ticketAttachmentOneDriveCopiesTable,
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  asc: (...columns: unknown[]) => columns,
  eq: (...values: unknown[]) => values,
  isNotNull: (value: unknown) => value,
  isNull: (value: unknown) => value,
  or: (...conditions: unknown[]) => conditions,
}));

vi.mock("./objectStorage", () => ({
  ObjectStorageService: class {
    getObjectEntityFile = vi.fn(async () => ({
      download: async () => [Buffer.from("A sufficiently long document text for naming.")],
    }));
  },
}));

vi.mock("openai", () => ({
  default: class {
    responses = { create: mocks.openAiCreate };
  },
}));

import {
  encryptRefreshToken,
  syncOneDriveAttachment,
  syncOneDriveClientFolders,
} from "./onedriveGraph";

describe("OneDrive client archive Graph workflows", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folderRecords.splice(0);
    mocks.graphCalls.splice(0);
    mocks.updates.splice(0);
    mocks.inserts.splice(0);
    vi.stubEnv("SESSION_SECRET", "test-session-secret");
    vi.stubEnv("VITE_MICROSOFT_CLIENT_ID", "test-microsoft-client");
    vi.stubEnv("MICROSOFT_ONEDRIVE_REDIRECT_URI", "https://www.taskdesk.it/api/onedrive/callback");
    Object.assign(mocks.owner, {
      id: 21,
      userId: 7,
      organizationId: 11,
      microsoftEmail: "owner@example.test",
      tenantId: "tenant-11",
      encryptedRefreshToken: encryptRefreshToken("owner-refresh", 7, 11),
      rootFolderId: "owner-root",
      operatorFolderId: "owner-operator",
    });
    Object.assign(mocks.archive, {
      organizationId: 11,
      ownerUserId: 7,
      clientsFolderId: "clients-root-11",
    });
    Object.assign(mocks.attachment, {
      id: 9,
      ticketId: 71,
      fileName: "original report.pdf",
      mimeType: "text/plain",
      objectPath: "private/original",
      oneDriveItemId: null,
    });
    Object.assign(mocks.ticket, {
      id: 71,
      organizationId: 11,
      clientId: 4,
      assignedTo: null,
      createdBy: 7,
      deletedAt: null,
    });
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      mocks.graphCalls.push({ url, method, body });
      if (url.includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith("/children?$select=id,name,folder,webUrl&$top=200")) {
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }
      if (method === "POST" && url.endsWith("/children")) {
        return new Response(JSON.stringify({
          id: "client-folder-4",
          name: body.name,
          webUrl: "https://onedrive.example.test/client-folder-4",
        }), { status: 200 });
      }
      if (url.includes("/items/client-folder-4?$select=webUrl")) {
        return new Response(JSON.stringify({ webUrl: "https://onedrive.example.test/client-folder-4" }), { status: 200 });
      }
      if (url.endsWith("/invite")) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (method === "PUT" && url.includes(":/content?")) {
        return new Response(JSON.stringify({ id: "copy-9" }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("creates a client folder once, reuses it, and invites connected collaborators as readers", async () => {
    const first = await syncOneDriveClientFolders(11);
    const second = await syncOneDriveClientFolders(11);

    expect(first).toEqual([expect.objectContaining({ clientId: 4, folderName: "Studio-Test-4" })]);
    expect(second).toEqual(first);
    expect(mocks.graphCalls.filter(({ method, url }) => method === "POST" && url.endsWith("/children"))).toHaveLength(1);
    const invite = mocks.graphCalls.find(({ url }) => url.endsWith("/invite"));
    expect(invite).toMatchObject({
      method: "POST",
      body: {
        recipients: [{ email: "collaborator@example.test" }],
        requireSignIn: true,
        sendInvitation: true,
        roles: ["read"],
      },
    });
  });

  it("uses an AI name only for the OneDrive copy and falls back when analysis fails", async () => {
    mocks.openAiCreate.mockResolvedValue({ output_text: "March report" });
    await syncOneDriveAttachment(9);
    const firstUpload = mocks.graphCalls.find(({ method, url }) => method === "PUT" && url.includes(":/content?"));

    expect(firstUpload?.url).toContain("ticket-71-attachment-9-March%20report.pdf");
    expect(mocks.attachment.fileName).toBe("original report.pdf");
    expect(mocks.updates.some(({ value }) => value && "fileName" in value)).toBe(false);

    mocks.folderRecords.splice(0);
    mocks.graphCalls.splice(0);
    mocks.openAiCreate.mockRejectedValueOnce(new Error("AI naming unavailable"));
    await syncOneDriveAttachment(9, false, true);
    const fallbackUpload = mocks.graphCalls.find(({ method, url }) => method === "PUT" && url.includes(":/content?"));

    expect(fallbackUpload?.url).toContain("ticket-71-attachment-9-original%20report.pdf");
    expect(mocks.attachment.fileName).toBe("original report.pdf");
  });

  it("records a Graph upload failure without changing the TaskDesk attachment", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("/oauth2/v2.0/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 3600 }), { status: 200 });
      }
      if (String(input).includes(":/content?")) {
        return new Response(JSON.stringify({ error: { message: "Graph upload unavailable" } }), { status: 503 });
      }
      if (init?.method === "POST" && String(input).endsWith("/children")) {
        return new Response(JSON.stringify({
          id: "client-folder-4",
          name: "Studio-Test-4",
          webUrl: "https://onedrive.example.test/client-folder-4",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    }) as typeof fetch;

    await syncOneDriveAttachment(9);

    expect(mocks.updates.some(({ value }) =>
      value?.oneDriveSyncError === "Graph upload unavailable",
    )).toBe(true);
    expect(mocks.attachment.fileName).toBe("original report.pdf");
  });
});
