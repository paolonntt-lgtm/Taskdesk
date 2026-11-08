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
let collaboratorId: number;
let clientId: number;
let updatedClientId: number;
let otherClientId: number;
let sessionId: string;
let collaboratorSessionId: string;
let createdEventId: number;
let otherEventId: number;

async function request(path: string, init: RequestInit = {}, requestSessionId = sessionId) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${requestSessionId}`);
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

    const [collaborator] = await db.insert(usersTable).values({
      name: "Gym Access Test Collaborator",
      email: `gym-access-collaborator-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    const [client] = await db.insert(clientsTable).values({
      organizationId,
      name: "Registered Gym Member",
      slug: `registered-gym-member-${runId}`,
      membershipNumber: `MEMBER-${runId}`,
    }).returning({ id: clientsTable.id });
    clientId = client.id;

    const [updatedClient] = await db.insert(clientsTable).values({
      organizationId,
      name: "Updated Gym Member",
      slug: `updated-gym-member-${runId}`,
      membershipNumber: `UPDATED-${runId}`,
    }).returning({ id: clientsTable.id });
    updatedClientId = updatedClient.id;

    const [otherClient] = await db.insert(clientsTable).values({
      organizationId: otherOrganizationId,
      name: "Member From Another Gym",
      slug: `other-gym-member-${runId}`,
      membershipNumber: `OTHER-${runId}`,
    }).returning({ id: clientsTable.id });
    otherClientId = otherClient.id;

    sessionId = await createSession(adminId);
    collaboratorSessionId = await createSession(collaboratorId);
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
    if (otherOrganizationId) {
      await db.delete(gymAccessEventsTable).where(eq(gymAccessEventsTable.organizationId, otherOrganizationId));
    }
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    if (collaboratorSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, collaboratorSessionId));
    }
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (collaboratorId) await db.delete(usersTable).where(eq(usersTable.id, collaboratorId));
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    if (updatedClientId) await db.delete(clientsTable).where(eq(clientsTable.id, updatedClientId));
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
      clientId,
      personName: "Registered Gym Member",
      occurredAt,
    });
    createdEventId = response.body.id;

    const [event] = await db.select({ personName: gymAccessEventsTable.personName })
      .from(gymAccessEventsTable)
      .where(and(
        eq(gymAccessEventsTable.organizationId, organizationId),
        eq(gymAccessEventsTable.personName, "Registered Gym Member"),
      ));
    expect(event?.personName).toBe("Registered Gym Member");

    const historyParams = new URLSearchParams({
      clientId: String(clientId),
      from: "2026-11-08T00:00:00.000Z",
      to: "2026-11-09T00:00:00.000Z",
    });
    const history = await request(`/api/gym-access?${historyParams}`);
    expect(history.status).toBe(200);
    expect(history.body).toContainEqual(expect.objectContaining({
      clientId,
      personName: "Registered Gym Member",
    }));

    await db.insert(gymAccessEventsTable).values({
      organizationId,
      personName: "Legacy Name-Only Entry",
      occurredAt: new Date(occurredAt),
      createdBy: adminId,
    });
    const allEntries = await request(`/api/gym-access?${new URLSearchParams({
      from: "2026-11-08T00:00:00.000Z",
      to: "2026-11-09T00:00:00.000Z",
    })}`);
    expect(allEntries.status).toBe(200);
    expect(allEntries.body).toContainEqual(expect.objectContaining({
      clientId: null,
      personName: "Legacy Name-Only Entry",
    }));
  });

  it("rejects a client from another organization without recording an entry", async () => {
    const before = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.organizationId, organizationId));
    const response = await request("/api/gym-access", {
      method: "POST",
      body: JSON.stringify({ clientId: otherClientId }),
    });
    const historyParams = new URLSearchParams({
      clientId: String(otherClientId),
      from: "2026-11-08T00:00:00.000Z",
      to: "2026-11-09T00:00:00.000Z",
    });
    const foreignHistory = await request(`/api/gym-access?${historyParams}`);
    const after = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.organizationId, organizationId));

    expect(response.status).toBe(404);
    expect(foreignHistory.status).toBe(404);
    expect(after.map((event) => event.id)).toEqual(before.map((event) => event.id));
  });

  it("returns older entries only for the selected client", async () => {
    const olderOccurredAt = new Date("2025-01-15T12:00:00.000Z");
    await db.insert(gymAccessEventsTable).values([
      {
        organizationId,
        clientId,
        personName: "Registered Gym Member",
        occurredAt: olderOccurredAt,
        createdBy: adminId,
      },
      {
        organizationId,
        clientId: updatedClientId,
        personName: "Updated Gym Member",
        occurredAt: olderOccurredAt,
        createdBy: adminId,
      },
    ]);

    const historyParams = new URLSearchParams({
      clientId: String(clientId),
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-02-01T00:00:00.000Z",
    });
    const history = await request(`/api/gym-access?${historyParams}`);

    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({
      clientId,
      personName: "Registered Gym Member",
      occurredAt: olderOccurredAt.toISOString(),
    });
  });

  it("lets an admin update the member and time of an entry in their organization", async () => {
    const occurredAt = "2026-11-08T14:30:00.000Z";
    const response = await request(`/api/gym-access/${createdEventId}`, {
      method: "PATCH",
      body: JSON.stringify({ clientId: updatedClientId, occurredAt }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: createdEventId,
      personName: "Updated Gym Member",
      occurredAt,
    });
  });

  it("does not let collaborators update or delete gym access entries", async () => {
    const update = await request(`/api/gym-access/${createdEventId}`, {
      method: "PATCH",
      body: JSON.stringify({ clientId, occurredAt: "2026-11-08T15:00:00.000Z" }),
    }, collaboratorSessionId);
    const deletion = await request(`/api/gym-access/${createdEventId}`, {
      method: "DELETE",
    }, collaboratorSessionId);

    expect(update.status).toBe(403);
    expect(deletion.status).toBe(403);
    const [event] = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.id, createdEventId));
    expect(event).toBeDefined();
  });

  it("keeps update and delete operations within the current organization", async () => {
    const [otherEvent] = await db.insert(gymAccessEventsTable).values({
      organizationId: otherOrganizationId,
      personName: "Member From Another Gym",
      occurredAt: new Date("2026-11-08T12:00:00.000Z"),
      createdBy: adminId,
    }).returning({ id: gymAccessEventsTable.id });
    otherEventId = otherEvent.id;

    const update = await request(`/api/gym-access/${otherEventId}`, {
      method: "PATCH",
      body: JSON.stringify({ clientId, occurredAt: "2026-11-08T15:00:00.000Z" }),
    });
    const deletion = await request(`/api/gym-access/${otherEventId}`, {
      method: "DELETE",
    });

    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    const [event] = await db.select({ personName: gymAccessEventsTable.personName })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.id, otherEventId));
    expect(event?.personName).toBe("Member From Another Gym");
  });

  it("lets an admin remove an entry", async () => {
    const response = await request(`/api/gym-access/${createdEventId}`, { method: "DELETE" });

    expect(response.status).toBe(204);
    const [event] = await db.select({ id: gymAccessEventsTable.id })
      .from(gymAccessEventsTable)
      .where(eq(gymAccessEventsTable.id, createdEventId));
    expect(event).toBeUndefined();
  });
});
