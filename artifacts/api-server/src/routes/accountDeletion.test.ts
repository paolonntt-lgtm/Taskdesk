import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, organizationsTable, sessionsTable, usersTable } from "@workspace/db";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let personalUserId: number;
let lastAdminId: number;
let organizationId: number;
let personalSessionId: string;
let lastAdminSessionId: string;
const originalPersonalEmail = `account-delete-${runId}@example.test`;

async function request(path: string, sessionId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  return { status: response.status, text: await response.text() };
}

describe("self-service account deletion", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Account deletion ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [personalUser] = await db.insert(usersTable).values({
      name: "Account Owner",
      email: originalPersonalEmail,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    personalUserId = personalUser.id;

    const [lastAdmin] = await db.insert(usersTable).values({
      name: "Only Admin",
      email: `account-delete-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    lastAdminId = lastAdmin.id;

    [personalSessionId, lastAdminSessionId] = await Promise.all([
      createSession(personalUserId),
      createSession(lastAdminId),
    ]);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, [personalSessionId, lastAdminSessionId].filter(Boolean)));
    await db.delete(usersTable).where(inArray(usersTable.id, [personalUserId, lastAdminId].filter(Number.isInteger)));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
  });

  it("anonymizes the caller and revokes the session", async () => {
    const response = await request("/api/users/me", personalSessionId, { method: "DELETE" });
    expect(response.status).toBe(204);

    const [user] = await db.select({
      name: usersTable.name,
      email: usersTable.email,
      isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.id, personalUserId));
    expect(user?.name).toBe("Utente eliminato");
    expect(user?.email).not.toBe(originalPersonalEmail);
    expect(user?.isActive).toBe(false);

    const [session] = await db.select({ sessionId: sessionsTable.sessionId })
      .from(sessionsTable)
      .where(and(eq(sessionsTable.sessionId, personalSessionId), eq(sessionsTable.userId, personalUserId)));
    expect(session).toBeUndefined();
  });

  it("keeps the only administrator from orphaning an organization", async () => {
    const response = await request("/api/users/me", lastAdminSessionId, { method: "DELETE" });
    expect(response.status).toBe(409);
    expect(JSON.parse(response.text).error).toBe("last_admin");

    const [admin] = await db.select({ isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.id, lastAdminId));
    expect(admin?.isActive).toBe(true);
  });
});
