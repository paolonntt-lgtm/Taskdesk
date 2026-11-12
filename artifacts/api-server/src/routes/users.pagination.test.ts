import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  organizationsTable,
  pool,
  sessionsTable,
  usersTable,
  workspaceMembershipsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let sharedWorkspaceId: number;
let adminId: number;
let sessionId: string;
let expectedUserIds: number[];
let sharedWorkspaceUserIds: number[];

async function request(path: string, workspaceId?: number) {
  const headers = new Headers({ Cookie: `session_id=${sessionId}` });
  if (workspaceId != null) headers.set("X-Workspace-ID", String(workspaceId));
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });
  return {
    status: response.status,
    body: await response.json() as any,
  };
}

describe("team directory pagination", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Team pagination ${runId}`,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const createdUsers = await db.insert(usersTable).values([
      {
        name: "Z Team Admin",
        email: `team-pagination-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      },
      {
        name: "Alpha",
        email: `team-pagination-alpha-one-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        organizationId,
      },
      {
        name: "Alpha",
        email: `team-pagination-alpha-two-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        organizationId,
      },
      {
        name: "Beta",
        email: `team-pagination-beta-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        isActive: false,
        organizationId,
      },
    ]).returning({ id: usersTable.id, name: usersTable.name, isActive: usersTable.isActive });

    adminId = createdUsers[0].id;
    expectedUserIds = [...createdUsers]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
      .map((user) => user.id);
    sessionId = await createSession(adminId);

    const [sharedWorkspace] = await db.insert(organizationsTable).values({
      name: `Shared team pagination ${runId}`,
      isSharedWorkspace: true,
    }).returning({ id: organizationsTable.id });
    sharedWorkspaceId = sharedWorkspace.id;
    await db.insert(workspaceMembershipsTable).values([
      { workspaceOrganizationId: sharedWorkspaceId, userId: adminId, role: "admin" },
      { workspaceOrganizationId: sharedWorkspaceId, userId: createdUsers[1].id, role: "user" },
    ]);
    sharedWorkspaceUserIds = [createdUsers[1].id, adminId];

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose its address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
    }
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    if (sharedWorkspaceId) {
      await db.delete(workspaceMembershipsTable)
        .where(eq(workspaceMembershipsTable.workspaceOrganizationId, sharedWorkspaceId));
      await db.delete(organizationsTable).where(eq(organizationsTable.id, sharedWorkspaceId));
    }
    if (organizationId) await db.delete(usersTable).where(eq(usersTable.organizationId, organizationId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("returns stable cursor pages with organization-wide counts", async () => {
    const firstPage = await request("/api/users?limit=2");
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.users.map((user: { id: number }) => user.id))
      .toEqual(expectedUserIds.slice(0, 2));
    expect(firstPage.body.totalCount).toBe(4);
    expect(firstPage.body.activeCount).toBe(3);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const nextPage = await request(`/api/users?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`);
    expect(nextPage.status).toBe(200);
    expect(nextPage.body.users.map((user: { id: number }) => user.id))
      .toEqual(expectedUserIds.slice(2));
    expect(nextPage.body.totalCount).toBe(4);
    expect(nextPage.body.activeCount).toBe(3);
    expect(nextPage.body.nextCursor).toBeNull();
  });

  it("keeps the existing array response for unpaginated callers", async () => {
    const response = await request("/api/users");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.map((user: { id: number }) => user.id)).toEqual(expectedUserIds);
  });

  it("limits shared-workspace pages and counts to workspace members", async () => {
    const firstPage = await request("/api/users?limit=1", sharedWorkspaceId);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.users.map((user: { id: number }) => user.id))
      .toEqual([sharedWorkspaceUserIds[0]]);
    expect(firstPage.body.totalCount).toBe(2);
    expect(firstPage.body.activeCount).toBe(2);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const nextPage = await request(
      `/api/users?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
      sharedWorkspaceId,
    );
    expect(nextPage.body.users.map((user: { id: number }) => user.id))
      .toEqual([sharedWorkspaceUserIds[1]]);
    expect(nextPage.body.nextCursor).toBeNull();
  });
});
