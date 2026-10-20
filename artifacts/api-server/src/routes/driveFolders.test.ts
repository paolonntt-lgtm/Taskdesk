import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const ticketsTable = {
    id: { name: "ticket.id" },
    organizationId: { name: "ticket.organizationId" },
    visibility: { name: "ticket.visibility" },
    deletedAt: { name: "ticket.deletedAt" },
  };
  const ticketDriveFoldersTable = {
    id: { name: "driveFolder.id" },
    ticketId: { name: "driveFolder.ticketId" },
    organizationId: { name: "driveFolder.organizationId" },
    driveFolderId: { name: "driveFolder.driveFolderId" },
    folderName: { name: "driveFolder.folderName" },
    addedBy: { name: "driveFolder.addedBy" },
    createdAt: { name: "driveFolder.createdAt" },
  };
  return {
    ticketsTable,
    ticketDriveFoldersTable,
    usersTable: { id: { name: "user.id" }, isActive: { name: "user.isActive" } },
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    },
    ticket: null as null | { id: number; organizationId: number; visibility: string },
    references: [] as Array<{
      id: number;
      ticketId: number;
      organizationId: number;
      driveFolderId: string;
      folderName: string;
      addedBy: number;
      createdAt: Date;
    }>,
    currentUser: { id: 1, organizationId: 11, role: "admin" },
    nextReferenceId: 1,
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  ticketsTable: mocks.ticketsTable,
  ticketDriveFoldersTable: mocks.ticketDriveFoldersTable,
  usersTable: mocks.usersTable,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((value: unknown) => ["isNull", value]),
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    mocks.currentUser = {
      id: Number(req.headers["x-test-user"] ?? 1),
      organizationId: Number(req.headers["x-test-org"] ?? 11),
      role: String(req.headers["x-test-role"] ?? "admin"),
    };
    req.currentUser = mocks.currentUser;
    next();
  },
}));

vi.mock("../lib/session", () => ({
  getSessionId: (req: any) => req.headers.cookie?.match(/(?:^|;\s*)session_id=([^;]+)/)?.[1],
  getCurrentUserId: (req: any) =>
    req.headers.cookie?.match(/(?:^|;\s*)session_id=([^;]+)/)?.[1] ? 1 : undefined,
}));

const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const originalFetch = globalThis.fetch;
const driveFiles: Record<string, {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  sharedWithMe?: boolean;
}> = {
  "root-folder": {
    id: "root-folder",
    name: "Project files",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["my-root"],
  },
  "child-folder": {
    id: "child-folder",
    name: "Specifications",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["root-folder"],
  },
  "other-folder": {
    id: "other-folder",
    name: "Unlinked",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["my-root"],
  },
  "second-root": {
    id: "second-root",
    name: "Additional files",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["my-root"],
  },
  "shared-folder": {
    id: "shared-folder",
    name: "Shared project",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["owner-root"],
    sharedWithMe: true,
  },
  "my-root": {
    id: "my-root",
    name: "My Drive",
    mimeType: "application/vnd.google-apps.folder",
    parents: [],
  },
  "document-1": {
    id: "document-1",
    name: "requirements.pdf",
    mimeType: "application/pdf",
    parents: ["child-folder"],
    webViewLink: "https://drive.google.com/file/d/document-1/view",
  },
};
const driveApiRequests: string[] = [];

describe("ticket Google Drive folders", () => {
  let server: Server;
  let baseUrl: string;
  let originalFetchForRequests: typeof fetch;
  let denyDriveAccess = false;
  let expireDriveAccess = false;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = "drive-test-client";
    process.env.GOOGLE_CLIENT_SECRET = "drive-test-secret";
    const { default: driveRouter } = await import("./driveFolders");
    const app = express();
    app.use(express.json());
    app.use("/api", driveRouter);
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server has no address");
    baseUrl = `http://127.0.0.1:${address.port}`;
    originalFetchForRequests = globalThis.fetch;
  });

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "drive-test-client";
    process.env.GOOGLE_CLIENT_SECRET = "drive-test-secret";
    mocks.ticket = { id: 10, organizationId: 11, visibility: "organization" };
    mocks.references = [];
    mocks.nextReferenceId = 1;
    denyDriveAccess = false;
    expireDriveAccess = false;
    driveApiRequests.length = 0;

    mocks.db.select.mockImplementation(() => {
      let table: unknown;
      let filters: unknown[] = [];
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      const rows = () => {
        const conditions = Array.isArray(filters[0]) ? filters : [filters];
        const equals = conditions.filter((filter): filter is [{ name?: string }, unknown] =>
          Array.isArray(filter) && typeof filter[0] === "object" && filter[0] !== null,
        );
        const matches = (row: Record<string, unknown>) => equals.every(([column, value]) =>
          row[column.name?.split(".").pop() ?? ""] === value,
        );
        if (table === mocks.ticketsTable) {
          return mocks.ticket?.organizationId === mocks.currentUser.organizationId && matches(mocks.ticket)
            ? [mocks.ticket]
            : [];
        }
        if (table === mocks.ticketDriveFoldersTable) {
          return mocks.references.filter((folder) =>
            folder.organizationId === mocks.currentUser.organizationId &&
            folder.ticketId === mocks.ticket?.id &&
            matches(folder as unknown as Record<string, unknown>),
          );
        }
        if (table === mocks.usersTable) {
          const user = { id: 1, isActive: true };
          return matches(user) ? [user] : [];
        }
        return [];
      };
      query.from = vi.fn((selectedTable: unknown) => {
        table = selectedTable;
        return query;
      });
      query.where = vi.fn((condition: unknown) => {
        filters = Array.isArray(condition) ? condition : [condition];
        return query;
      });
      query.orderBy = vi.fn(() => query);
      query.then = vi.fn((resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows()).then(resolve, reject));
      return query;
    });
    mocks.db.insert.mockImplementation(() => {
      let values: Record<string, any>;
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.values = vi.fn((value: Record<string, any>) => {
        values = value;
        return query;
      });
      query.returning = vi.fn(async () => {
        const reference = {
          id: mocks.nextReferenceId++,
          ...values,
          createdAt: new Date(),
        };
        mocks.references.push(reference as typeof mocks.references[number]);
        return [reference];
      });
      return query;
    });
    mocks.db.delete.mockImplementation(() => {
      const query: Record<string, ReturnType<typeof vi.fn>> = {};
      query.where = vi.fn(() => query);
      query.returning = vi.fn(async () => mocks.references.splice(0, 1).map(({ id }) => ({ id })));
      return query;
    });

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(baseUrl)) return originalFetchForRequests(input, init);
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({
          access_token: "temporary-drive-token",
          expires_in: 3600,
        }), { status: 200 });
      }
      driveApiRequests.push(url);
      if (denyDriveAccess) {
        return new Response(JSON.stringify({ error: { message: "Permission denied" } }), { status: 403 });
      }
      if (expireDriveAccess) {
        return new Response(JSON.stringify({ error: { message: "Invalid credentials" } }), { status: 401 });
      }
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.startsWith("/drive/v3/files/")) {
        const id = decodeURIComponent(parsedUrl.pathname.split("/").pop() ?? "");
        const file = driveFiles[id];
        return file
          ? new Response(JSON.stringify(file), { status: 200 })
          : new Response(JSON.stringify({ error: { message: "Not found" } }), { status: 404 });
      }
      if (parsedUrl.pathname === "/drive/v3/files") {
        const query = parsedUrl.searchParams.get("q") ?? "";
        const parentId = query.match(/'([^']+)' in parents/)?.[1];
        const foldersOnly = query.includes("mimeType =");
        const files = Object.values(driveFiles).filter((file) =>
          (file.parents?.includes(parentId ?? "") || (parentId === "root" && query.includes("sharedWithMe = true") && file.sharedWithMe)) &&
          (!foldersOnly || file.mimeType === "application/vnd.google-apps.folder"),
        );
        return new Response(JSON.stringify({ files }), { status: 200 });
      }
      throw new Error(`Unexpected external fetch ${url}`);
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  async function request(
    path: string,
    sessionId = "drive-test-session",
    organizationId = 11,
    role = "admin",
    init: RequestInit = {},
  ): Promise<{ status: number; body: any }> {
    const headers = new Headers(init.headers);
    headers.set("Cookie", `session_id=${sessionId}`);
    headers.set("x-test-org", String(organizationId));
    headers.set("x-test-role", role);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const bodyText = await response.text();
    let body: any = null;
    try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
    return { status: response.status, body };
  }

  async function authorize(sessionId = "drive-test-session"): Promise<void> {
    const start = await request("/api/drive/oauth/start?ticketId=10", sessionId);
    expect(start.status).toBe(200);
    const encodedUrl = start.body.match(/window\.location\.replace\(("(?:\\.|[^"])*")\)/)?.[1];
    expect(encodedUrl).toBeTruthy();
    const authUrl = new URL(JSON.parse(encodedUrl!) as string);
    const state = authUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(new URL(authUrl.searchParams.get("redirect_uri")!).pathname).toBe("/api/auth/google/callback");
    const callback = await request(
      `/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state!)}`,
      sessionId,
    );
    expect(callback.status).toBe(200);
    expect(callback.body).toContain('"status":"ok"');
    const replayed = await request(
      `/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state!)}`,
      sessionId,
    );
    expect(replayed.body).toContain('"status":"invalid_state"');
  }

  it("limits navigation to the linked folder, stores references only, and removes only the reference", async () => {
    await authorize();
    const picker = await request("/api/drive/picker");
    expect(picker.status).toBe(200);
    expect(picker.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ driveFolderId: "shared-folder" }),
    ]));
    const linked = await request("/api/tickets/10/drive-folders", "drive-test-session", 11, "admin", {
      method: "POST",
      body: JSON.stringify({ folderId: "root-folder" }),
    });
    expect(linked.status).toBe(201);
    expect(linked.body).toMatchObject({ driveFolderId: "root-folder", folderName: "Project files" });
    const secondLinked = await request("/api/tickets/10/drive-folders", "drive-test-session", 11, "admin", {
      method: "POST",
      body: JSON.stringify({ folderId: "second-root" }),
    });
    expect(secondLinked.status).toBe(201);
    expect((await request("/api/tickets/10/drive-folders")).body).toHaveLength(2);
    const duplicate = await request("/api/tickets/10/drive-folders", "drive-test-session", 11, "admin", {
      method: "POST",
      body: JSON.stringify({ folderId: "root-folder" }),
    });
    expect(duplicate.status).toBe(200);

    const rootContents = await request("/api/tickets/10/drive-folders/1/items?folderId=root-folder");
    expect(rootContents.status).toBe(200);
    expect(rootContents.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ driveItemId: "child-folder", isFolder: true }),
    ]));
    const childContents = await request("/api/tickets/10/drive-folders/1/items?folderId=child-folder");
    expect(childContents.body.items).toEqual([
      expect.objectContaining({
        driveItemId: "document-1",
        webViewLink: "https://drive.google.com/file/d/document-1/view",
      }),
    ]);

    const outside = await request("/api/tickets/10/drive-folders/1/items?folderId=other-folder");
    expect(outside.status).toBe(403);
    expect(outside.body.error).toBe("DRIVE_FOLDER_OUTSIDE_LINK");

    const nonFolder = await request("/api/tickets/10/drive-folders", "drive-test-session", 11, "admin", {
      method: "POST",
      body: JSON.stringify({ folderId: "document-1" }),
    });
    expect(nonFolder.status).toBe(400);

    const deleted = await request("/api/tickets/10/drive-folders/1", "drive-test-session", 11, "admin", {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect((await request("/api/tickets/10/drive-folders")).body).toHaveLength(1);
    expect(driveFiles["root-folder"]).toBeDefined();
    expect(driveFiles["document-1"]).toBeDefined();
    expect(driveApiRequests.every((url) =>
      url.startsWith("https://www.googleapis.com/drive/v3/files") &&
      !url.includes("alt=media") &&
      !url.includes("/export"),
    )).toBe(true);
  });

  it("enforces organization and private-ticket visibility and reports revoked Drive access", async () => {
    const otherOrganization = await request("/api/tickets/10/drive-folders", "another-session", 22, "admin");
    expect(otherOrganization.status).toBe(404);
    const otherOrganizationItems = await request(
      "/api/tickets/10/drive-folders/1/items?folderId=root-folder",
      "another-session",
      22,
      "admin",
    );
    expect(otherOrganizationItems.status).toBe(404);

    mocks.ticket = { id: 10, organizationId: 11, visibility: "admins" };
    const privateTicket = await request("/api/tickets/10/drive-folders", "collaborator", 11, "user");
    expect(privateTicket.status).toBe(404);
    const privateTicketItems = await request(
      "/api/tickets/10/drive-folders/1/items?folderId=root-folder",
      "collaborator",
      11,
      "user",
    );
    expect(privateTicketItems.status).toBe(404);

    mocks.ticket = { id: 10, organizationId: 11, visibility: "organization" };
    mocks.references = [{
      id: 1,
      ticketId: 10,
      organizationId: 11,
      driveFolderId: "root-folder",
      folderName: "Project files",
      addedBy: 1,
      createdAt: new Date(),
    }];
    await authorize();
    denyDriveAccess = true;
    const denied = await request("/api/tickets/10/drive-folders/1/items?folderId=root-folder");
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("DRIVE_ACCESS_DENIED");

    denyDriveAccess = false;
    expireDriveAccess = true;
    const expired = await request("/api/tickets/10/drive-folders/1/items?folderId=root-folder");
    expect(expired.status).toBe(401);
    expect(expired.body.error).toBe("DRIVE_TOKEN_EXPIRED");

    expireDriveAccess = false;
    await authorize();
    const revoked = await request("/api/tickets/10/drive-folders/1/items?folderId=missing-folder");
    expect(revoked.status).toBe(403);
    expect(revoked.body.error).toBe("DRIVE_ACCESS_REVOKED");
  });

  it("reports cancelled consent and missing OAuth configuration without breaking existing references", async () => {
    mocks.references = [{
      id: 1,
      ticketId: 10,
      organizationId: 11,
      driveFolderId: "root-folder",
      folderName: "Project files",
      addedBy: 1,
      createdAt: new Date(),
    }];
    const sessionId = "cancelled-drive-session";
    const start = await request("/api/drive/oauth/start?ticketId=10", sessionId);
    const encodedUrl = start.body.match(/window\.location\.replace\(("(?:\\.|[^"])*")\)/)?.[1];
    const authUrl = new URL(JSON.parse(encodedUrl!) as string);
    const state = authUrl.searchParams.get("state")!;
    const cancelled = await request(
      `/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`,
      sessionId,
    );
    expect(cancelled.body).toContain('"status":"cancelled"');

    process.env.GOOGLE_CLIENT_ID = "";
    const unconfigured = await request("/api/drive/oauth/start?ticketId=10", "unconfigured-session");
    expect(unconfigured.status).toBe(503);
    expect(unconfigured.body).toContain('"status":"not_configured"');
    expect(mocks.references).toHaveLength(1);
  });

  it("binds the short-lived authorization to the initiating signed-in session", async () => {
    const initiatingSession = "initiating-session";
    const start = await request("/api/drive/oauth/start?ticketId=10", initiatingSession);
    const encodedUrl = start.body.match(/window\.location\.replace\(("(?:\\.|[^"])*")\)/)?.[1];
    const authUrl = new URL(JSON.parse(encodedUrl!) as string);
    const state = authUrl.searchParams.get("state")!;

    const callback = await request(
      `/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`,
      "different-session",
    );
    expect(callback.body).toContain('"status":"invalid_state"');
    const picker = await request("/api/drive/picker", initiatingSession);
    expect(picker.status).toBe(401);
    expect(picker.body.error).toBe("DRIVE_AUTH_REQUIRED");
  });
});
