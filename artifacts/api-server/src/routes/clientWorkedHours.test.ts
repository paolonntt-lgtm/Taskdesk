import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  clientsTable,
  organizationsTable,
  pool,
  sessionsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { buildBackupPayload } from "../lib/backup";
import { createSession } from "../lib/session";

type HttpResult = { status: number; body: any };

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let clientId: number;
let adminId: number;
let userId: number;
let adminSessionId: string;
let userSessionId: string;
let publicTicketId: number;
let privateTicketId: number;
const createdClientIds: number[] = [];

async function request(path: string, sessionId: string, init: RequestInit = {}): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("client worked-hours report", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Worked hours test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable)
      .values({
        name: "Worked Hours Admin",
        email: `worked-hours-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [user] = await db.insert(usersTable)
      .values({
        name: "Worked Hours User",
        email: `worked-hours-user-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    userId = user.id;

    const [client] = await db.insert(clientsTable)
      .values({ organizationId, name: "Worked Hours Client", slug: `worked-hours-${runId}` })
      .returning({ id: clientsTable.id });
    clientId = client.id;

    const [publicTicket] = await db.insert(ticketsTable)
      .values({
        organizationId,
        clientId,
        title: "Public extra work",
        description: "Visible to the team",
        category: "Support",
        location: "Remote",
        status: "closed",
        visibility: "organization",
        createdBy: adminId,
        workedMinutes: 90,
        closedAt: new Date("2026-08-15T10:00:00.000Z"),
      })
      .returning({ id: ticketsTable.id });
    publicTicketId = publicTicket.id;

    const [privateTicket] = await db.insert(ticketsTable)
      .values({
        organizationId,
        clientId,
        title: "Private extra work",
        description: "Admin only",
        category: "Support",
        location: "Remote",
        status: "closed",
        visibility: "admins",
        createdBy: adminId,
        workedMinutes: 45,
        closedAt: new Date("2026-08-20T10:00:00.000Z"),
      })
      .returning({ id: ticketsTable.id });
    privateTicketId = privateTicket.id;

    adminSessionId = await createSession(adminId);
    userSessionId = await createSession(userId);
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
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    await db.delete(ticketsTable).where(inArray(ticketsTable.id, [publicTicketId, privateTicketId]));
    if (createdClientIds.length > 0) {
      await db.delete(clientsTable).where(inArray(clientsTable.id, createdClientIds));
    }
    await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, [adminSessionId, userSessionId]));
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, userId]));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("filters private worked time, defaults to unbilled, and persists admin changes in backups", async () => {
    const userResponse = await request(`/api/clients/${clientId}`, userSessionId);
    expect(userResponse.status).toBe(200);
    expect(userResponse.body.tickets.map((ticket: any) => ticket.id)).toEqual([publicTicketId]);
    expect(userResponse.body.tickets[0].workedBillingStatus).toBe("unbilled");

    const adminResponse = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.tickets.map((ticket: any) => ticket.id)).toEqual([publicTicketId, privateTicketId]);
    expect(adminResponse.body.tickets.every((ticket: any) => ticket.workedBillingStatus === "unbilled")).toBe(true);

    const forbiddenResponse = await request(`/api/clients/${clientId}/tickets/${publicTicketId}/billing-status`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "billed" }),
    });
    expect(forbiddenResponse.status).toBe(403);

    const updateResponse = await request(`/api/clients/${clientId}/tickets/${publicTicketId}/billing-status`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "billed" }),
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.workedBillingStatus).toBe("billed");

    const refreshedResponse = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(refreshedResponse.body.tickets.find((ticket: any) => ticket.id === publicTicketId).workedBillingStatus).toBe("billed");

    const backup = await buildBackupPayload(organizationId);
    const backupTicket = backup?.data.tickets.find((ticket: any) => ticket.id === publicTicketId);
    expect(backupTicket?.workedBillingStatus).toBe("billed");
  });

  it("allows a standard organization member to create a client", async () => {
    const response = await request("/api/clients", userSessionId, {
      method: "POST",
      body: JSON.stringify({
        name: "Client created by team member",
        email: "created-by-team@example.test",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Client created by team member");
    expect(response.body.organizationId).toBe(organizationId);
    createdClientIds.push(response.body.id);
  });
});