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

describe("external tickets count in statistics but stay out of charts", () => {
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
        status: "resolved",
        createdBy: systemUserId,
        assignedTo: adminId,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        closedAt: new Date(),
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
      byAssignee,
      recentTickets,
      reportsAll,
      leaderboard,
      resolutionByAssignee,
      resolutionByCategory,
      resolutionByPriority,
    ] = await Promise.all([
      request("/api/stats/dashboard", adminSessionId),
      request("/api/stats/trend?days=30", adminSessionId),
      request("/api/stats/by-status", adminSessionId),
      request("/api/stats/by-category", adminSessionId),
      request("/api/stats/by-location", adminSessionId),
      request("/api/stats/by-priority", adminSessionId),
      request("/api/stats/by-assignee", adminSessionId),
      request("/api/stats/recent-tickets", adminSessionId),
      request("/api/stats/reports-all", adminSessionId),
      request("/api/stats/leaderboard", adminSessionId),
      request("/api/stats/resolution-by-assignee", adminSessionId),
      request("/api/stats/resolution-by-category", adminSessionId),
      request("/api/stats/resolution-by-priority", adminSessionId),
    ]);

    for (const result of [
      dashboard, trend, byStatus, byCategory, byLocation, byPriority, byAssignee,
      recentTickets, reportsAll, leaderboard, resolutionByAssignee, resolutionByCategory, resolutionByPriority,
    ]) {
      expect(result.status).toBe(200);
    }

    expect(dashboard.body.totalTickets).toBe(2);
    expect(dashboard.body.openTickets).toBe(1);
    expect(dashboard.body.resolvedTickets).toBe(1);
    expect(dashboard.body.waitingTickets).toBe(0);
    expect(dashboard.body.urgentTickets).toBe(0);
    expect(dashboard.body.last7Days).toBe(2);
    expect(dashboard.body.last30Days).toBe(2);
    expect(dashboard.body.createdToday).toBe(2);
    expect(dashboard.body.avgResolutionHours).toBeCloseTo(2, 1);

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
    expect(byAssignee.body).toEqual([]);
    expect(recentTickets.body).toHaveLength(2);
    expect(recentTickets.body.some((ticket: { location: string }) => ticket.location.trim().toLowerCase() === "esterno")).toBe(true);

    expect(reportsAll.body.dashboard.totalTickets).toBe(2);
    expect(reportsAll.body.byCategory).toEqual([
      { name: "Regression ordinary category", count: 1 },
    ]);
    expect(reportsAll.body.leaderboard.openers).toEqual([
      { id: adminId, name: "Stats Source Exclusions Admin", count: 1 },
    ]);
    expect(leaderboard.body.openers).toEqual([
      { id: adminId, name: "Stats Source Exclusions Admin", count: 1 },
    ]);

    expect(resolutionByAssignee.body.overall.count).toBe(1);
    expect(resolutionByAssignee.body.byAssignee).toEqual([]);
    expect(resolutionByAssignee.body.buckets.reduce(
      (sum: number, bucket: { count: number }) => sum + bucket.count,
      0,
    )).toBe(0);
    expect(resolutionByCategory.body).toEqual([]);
    expect(resolutionByPriority.body).toEqual([]);

    const stillStoredTickets = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
    }).from(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    expect(stillStoredTickets).toHaveLength(3);
  });
});
