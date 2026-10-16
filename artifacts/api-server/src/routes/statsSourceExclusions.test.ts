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

type HttpResult = { status: number; body: any };

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let systemUserId: number;
let adminSessionId: string;
const createdTicketIds: number[] = [];

async function request(path: string, sessionId: string): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: `session_id=${sessionId}` },
  });
  return { status: response.status, body: await response.json() as any };
}

describe("statistics exclude system-created and external tickets", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Stats source exclusions ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable)
      .values({
        name: "Stats Source Exclusions Admin",
        email: `stats-source-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [systemUser] = await db.insert(usersTable)
      .values({
        name: "Stats Source Exclusions System",
        email: `stats-source-system-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
        isSystem: true,
      })
      .returning({ id: usersTable.id });
    systemUserId = systemUser.id;

    await db.insert(ticketStatusesTable).values([
      { organizationId, key: "open", label: "Aperto", isDefault: true, isClosed: false },
      { organizationId, key: "waiting", label: "In attesa", isClosed: false },
    ]);

    adminSessionId = await createSession(adminId);

    const tickets = await db.insert(ticketsTable).values([
      {
        organizationId,
        title: `Ordinary ${runId}`,
        description: "Ordinary ticket created by an administrator",
        category: "Regression ordinary category",
        location: "Regression office",
        priority: "high",
        status: "open",
        createdBy: adminId,
      },
      {
        organizationId,
        title: `Email ${runId}`,
        description: "Ticket created by the organization's system user",
        category: "Regression email category",
        location: "Email intake location",
        priority: "urgent",
        status: "waiting",
        createdBy: systemUserId,
      },
      {
        organizationId,
        title: `External ${runId}`,
        description: "Ticket whose location is Esterno",
        category: "Regression external category",
        location: " Esterno ",
        priority: "low",
        status: "waiting",
        createdBy: adminId,
      },
    ]).returning({ id: ticketsTable.id });
    createdTicketIds.push(...tickets.map(({ id }) => id));

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
    if (createdTicketIds.length > 0) {
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    }
    if (organizationId) {
      await db.delete(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, organizationId));
    }
    if (adminSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    }
    if (adminId && systemUserId) {
      await db.delete(usersTable).where(inArray(usersTable.id, [adminId, systemUserId]));
    }
    if (organizationId) {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    }
    await pool.end();
  });

  it("keeps ordinary tickets in dashboard, trend, and status/category/location/priority counts", async () => {
    const [
      dashboard,
      trend,
      byStatus,
      byCategory,
      byLocation,
      byPriority,
    ] = await Promise.all([
      request("/api/stats/dashboard", adminSessionId),
      request("/api/stats/trend?days=30", adminSessionId),
      request("/api/stats/by-status", adminSessionId),
      request("/api/stats/by-category", adminSessionId),
      request("/api/stats/by-location", adminSessionId),
      request("/api/stats/by-priority", adminSessionId),
    ]);

    for (const result of [dashboard, trend, byStatus, byCategory, byLocation, byPriority]) {
      expect(result.status).toBe(200);
    }

    expect(dashboard.body.totalTickets).toBe(1);
    expect(dashboard.body.openTickets).toBe(1);
    expect(dashboard.body.waitingTickets).toBe(0);
    expect(dashboard.body.urgentTickets).toBe(0);
    expect(dashboard.body.last7Days).toBe(1);
    expect(dashboard.body.last30Days).toBe(1);
    expect(dashboard.body.createdToday).toBe(1);

    expect(trend.body.reduce((sum: number, day: { count: number }) => sum + day.count, 0)).toBe(1);
    expect(byStatus.body).toEqual([
      { name: "Aperto", count: 1, color: null, key: "open" },
    ]);
    expect(byCategory.body).toEqual([
      { name: "Regression ordinary category", count: 1 },
    ]);
    expect(byLocation.body).toEqual([
      { name: "Regression office", count: 1 },
    ]);
    expect(byPriority.body).toEqual([
      { name: "Alta", count: 1 },
    ]);

    const stillStoredTickets = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
    }).from(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    expect(stillStoredTickets).toHaveLength(3);
  });
});
