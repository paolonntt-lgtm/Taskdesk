import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, organizationsTable, pool, sessionsTable, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let collaboratorId: number;
let adminSessionId: string;
let collaboratorSessionId: string;

async function request(path: string, sessionId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("organization profession settings", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Profession settings ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Profession Settings Admin",
      email: `profession-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;

    const [collaborator] = await db.insert(usersTable).values({
      name: "Profession Settings Collaborator",
      email: `profession-user-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    [adminSessionId, collaboratorSessionId] = await Promise.all([
      createSession(adminId),
      createSession(collaboratorId),
    ]);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose an address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    const sessionIds = [adminSessionId, collaboratorSessionId].filter(Boolean);
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    const userIds = [adminId, collaboratorId].filter(Number.isInteger);
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationId) await db.delete(organizationsTable).where(inArray(organizationsTable.id, [organizationId]));
    await pool.end();
  });

  it("lets admins update a valid profession and rejects invalid or non-admin changes", async () => {
    const initial = await request("/api/settings/organization", adminSessionId);
    expect(initial.status).toBe(200);
    expect(initial.body.profession).toBeNull();

    const updated = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Profession settings ${runId}`,
        profession: "consulenti-del-lavoro",
      }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.profession).toBe("consulenti-del-lavoro");

    const reread = await request("/api/settings/organization", adminSessionId);
    expect(reread.body.profession).toBe("consulenti-del-lavoro");

    const invalid = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Profession settings ${runId}`, profession: "doctor" }),
    });
    expect(invalid.status).toBe(400);

    const cleared = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Profession settings ${runId}`, profession: null }),
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.profession).toBeNull();

    const forbidden = await request("/api/settings/organization", collaboratorSessionId, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Profession settings ${runId}`,
        profession: "commercialisti",
      }),
    });
    expect(forbidden.status).toBe(403);
  });
});
