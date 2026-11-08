import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientsTable,
  db,
  gymAccessEventsTable,
  organizationsTable,
  pool,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let otherOrganizationId: number;
let adminId: number;
let clientId: number;
let otherClientId: number;
let sessionId: string;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("gym access route", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Gym access test ${runId}`,
      profession: "palestre",
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [otherOrganization] = await db.insert(organizationsTable).values({
      name: `Other gym access test ${runId}`,
      profession: "palestre",
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    otherOrganizationId = otherOrganization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Gym Access Test Admin",
      email: `gym-access-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;

    const [client] = await db.insert(clientsTable).values({
      organizationId,
      name: "Registered Gym Member",
      slug: `registered-gym-member-${runId}`,
      membershipNumber: `MEMBER-${runId}`,
    }).returning({ id: clientsTable.id });
    clientId = client.id;

    const [otherClient] = await db.insert(clientsTable).values({
      organizationId: otherOrganizationId,
      name: "Member From Another Gym",
      slug: `other-gym-member-${runId}`,
      membershipNumber: `OTHER-${runId}`,
    }).returning({ id: clientsTable.id });
    otherClientId = otherClient.id;

    sessionId = await createSession(adminId);
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
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
    }
    if (organizationId) {
      await db.delete(gymAccessEventsTable).where(eq(gymAccessEventsTable.organizationId, organizationId));
    }
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    if (otherClientId) await db.delete(clientsTable).where(eq(clientsTable.id, otherClientId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    if (otherOrganizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, otherOrganizationId));
    await pool.end();
  });

  it("records an entry from a registered client in the current organization", async () => {
    const occurredAt = "2026-11-08T12:00:00.000Z";
    const response = await request("/api/gym-access", {
      method: "POST",
      body: JSON.stringify({ clientId, occurredAt }),
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      personName: "Registered Gym Member",
      occurredAt,
    });

    const [event] = await db.select({ personName: gymAccessEventsTable.personName })
      .from(gymAccessEventsTable)
      .where(and(
        eq(gymAccessEventsTable.organizationId, organizationId),
        eq(gymAccessEventsTable.personName, "Registered Gym Member"),
      ));
    expect(event?.personName).toBe("Registered Gym Member");
  });

  it("rejects a client from another organization without recording an entry", async () => {
    const before = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.organizationId, organizationId));
    const response = await request("/api/gym-access", {
      method: "POST",
      body: JSON.stringify({ clientId: otherClientId }),
    });
    const after = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.organizationId, organizationId));

    expect(response.status).toBe(404);
    expect(after.map((event) => event.id)).toEqual(before.map((event) => event.id));
  });
});
