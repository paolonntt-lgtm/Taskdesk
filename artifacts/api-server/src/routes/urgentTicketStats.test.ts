import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketStatusesTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let userId: number;
let adminSessionId: string;
let userSessionId: string;
let ticketIds: number[] = [];

async function request(path: string, sessionId: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: `session_id=${sessionId}` },
  });
  return { status: response.status, body: await response.json() as any };
}

describe("urgent ticket dashboard statistic", () => {
  beforeAll(async () => {
    const [organization] = await db
      .insert(organizationsTable)
      .values({ name: `Urgent ticket stats test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db
      .insert(usersTable)
      .values({
        name: "Urgent Stats Admin",
        email: `urgent-stats-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [user] = await db
      .insert(usersTable)
      .values({
        name: "Urgent Stats User",
        email: `urgent-stats-user-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    userId = user.id;

    await db.insert(ticketStatusesTable).values([
      { organizationId, key: "open", label: "Open", isDefault: true, isClosed: false },
      { organizationId, key: "working", label: "Working", isClosed: false },
      // A legacy-looking key can be active when the organization config says so.
      { organizationId, key: "resolved", label: "Resolved", isClosed: false },
      { organizationId, key: "done", label: "Done", isClosed: true },
    ]);

    adminSessionId = await createSession(adminId);
    userSessionId = await createSession(userId);

    const ticketRows = [
      { title: "Urgent open", status: "open", priority: "urgent", visibility: "organization", deletedAt: null },
      { title: "Urgent working", status: "working", priority: "urgent", visibility: "organization", deletedAt: null },
      { title: "Urgent active legacy key", status: "resolved", priority: "urgent", visibility: "organization", deletedAt: null },
      { title: "Urgent configured closed", status: "done", priority: "urgent", visibility: "organization", deletedAt: null },
      { title: "Urgent fallback closed", status: "closed", priority: "urgent", visibility: "organization", deletedAt: null },
      { title: "Urgent private", status: "open", priority: "urgent", visibility: "admins", deletedAt: null },
      { title: "Urgent deleted", status: "open", priority: "urgent", visibility: "organization", deletedAt: new Date() },
      { title: "Not urgent", status: "working", priority: "high", visibility: "organization", deletedAt: null },
    ];
    const insertedTickets = await db.insert(ticketsTable).values(ticketRows.map((ticket) => ({
      ...ticket,
      description: ticket.title,
      category: "Test",
      location: "Test location",
      createdBy: adminId,
      organizationId,
    }))).returning({ id: ticketsTable.id });
    ticketIds = insertedTickets.map((ticket) => ticket.id);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose an address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (ticketIds.length > 0) {
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    }
    if (organizationId) {
      await db.delete(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, organizationId));
    }
    if (adminSessionId && userSessionId) {
      await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, [adminSessionId, userSessionId]));
    }
    if (adminId && userId) {
      await db.delete(usersTable).where(inArray(usersTable.id, [adminId, userId]));
    }
    if (organizationId) {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    }
    await pool.end();
  });

  it("matches the urgent count to the visible urgent tickets in all active states", async () => {
    const filteredListPath = "/api/tickets?priority=urgent&nonClosed=true";
    const [adminStats, adminTickets, userStats, userTickets] = await Promise.all([
      request("/api/stats/dashboard", adminSessionId),
      request(filteredListPath, adminSessionId),
      request("/api/stats/dashboard", userSessionId),
      request(filteredListPath, userSessionId),
    ]);

    expect(adminStats.status).toBe(200);
    expect(adminTickets.status).toBe(200);
    expect(userStats.status).toBe(200);
    expect(userTickets.status).toBe(200);
    expect(adminStats.body.urgentTickets).toBe(4);
    expect(userStats.body.urgentTickets).toBe(3);
    expect(adminTickets.body).toHaveLength(adminStats.body.urgentTickets);
    expect(userTickets.body).toHaveLength(userStats.body.urgentTickets);
    expect(adminTickets.body.map((ticket: { title: string }) => ticket.title)).toContain("Urgent private");
    expect(userTickets.body.map((ticket: { title: string }) => ticket.title)).not.toContain("Urgent private");
    for (const tickets of [adminTickets.body, userTickets.body]) {
      expect(tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Urgent configured closed");
      expect(tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Urgent fallback closed");
      expect(tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Urgent deleted");
    }
  });

  it("returns an empty urgent list when every configured status is closed", async () => {
    await db.update(ticketStatusesTable)
      .set({ isClosed: true })
      .where(eq(ticketStatusesTable.organizationId, organizationId));

    const [stats, tickets] = await Promise.all([
      request("/api/stats/dashboard", userSessionId),
      request("/api/tickets?priority=urgent&nonClosed=true", userSessionId),
    ]);

    expect(stats.body.urgentTickets).toBe(0);
    expect(tickets.body).toEqual([]);
  });
});
