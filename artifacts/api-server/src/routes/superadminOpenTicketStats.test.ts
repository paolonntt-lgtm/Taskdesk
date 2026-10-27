import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationIds: number[] = [];
let userIds: number[] = [];
let sessionId: string;
let ticketIds: number[] = [];
let baselineTicketCreationStats = { today: 0, yesterday: 0, last7Days: 0, last30Days: 0 };

describe("superadmin ticket creation statistics", () => {
  beforeAll(async () => {
    const organizations = await db.insert(organizationsTable).values([
      { name: `Superadmin open stats A ${runId}` },
      { name: `Superadmin open stats B ${runId}`, hiddenFromSuperadmin: true },
    ]).returning({ id: organizationsTable.id });
    organizationIds = organizations.map(({ id }) => id);
    const [orgA, orgB] = organizationIds;

    const users = await db.insert(usersTable).values([
      {
        name: "Superadmin Open Stats",
        email: `superadmin-open-stats-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        isSuperAdmin: true,
      },
      {
        name: "Organization A Admin",
        email: `superadmin-open-stats-a-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId: orgA,
      },
      {
        name: "Organization A System",
        email: `superadmin-open-stats-system-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId: orgA,
        isSystem: true,
      },
      {
        name: "Organization B Admin",
        email: `superadmin-open-stats-b-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId: orgB,
      },
    ]).returning({ id: usersTable.id });
    userIds = users.map(({ id }) => id);
    const [superadminId, orgAAdminId, systemUserId, orgBAdminId] = userIds;
    sessionId = await createSession(superadminId);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose an address");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const baselineResponse = await fetch(`${baseUrl}/api/superadmin`, {
      headers: { Cookie: `session_id=${sessionId}` },
    });
    const baselineBody = await baselineResponse.json() as {
      ticketCreationStats: typeof baselineTicketCreationStats;
    };
    baselineTicketCreationStats = baselineBody.ticketCreationStats;

    const now = Date.now();
    const romeDateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(now));
    const romePart = (type: string) => Number(romeDateParts.find((part) => part.type === type)?.value);
    const yesterdayAtNoonUtc = new Date(Date.UTC(
      romePart("year"),
      romePart("month") - 1,
      romePart("day") - 1,
      12,
    ));
    const insertedTickets = await db.insert(ticketsTable).values([
      { organizationId: orgA, createdBy: orgAAdminId, title: "Created today", location: "Ufficio", createdAt: new Date(now) },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Created yesterday", status: "closed", location: "Ufficio", createdAt: yesterdayAtNoonUtc },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Created this week", location: "Ufficio", createdAt: new Date(now - 3 * 24 * 60 * 60_000) },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Created this month", location: "Ufficio", createdAt: new Date(now - 15 * 24 * 60 * 60_000) },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Created earlier", location: "Ufficio", createdAt: new Date(now - 45 * 24 * 60 * 60_000) },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Deleted today", location: "Ufficio", createdAt: new Date(now), deletedAt: new Date() },
      { organizationId: orgA, createdBy: systemUserId, title: "System internal", location: "Ufficio", createdAt: new Date(now) },
      { organizationId: orgA, createdBy: systemUserId, title: "System external", location: " Esterno ", createdAt: new Date(now) },
      { organizationId: orgB, createdBy: orgBAdminId, title: "Organization B today", location: "Ufficio", createdAt: new Date(now) },
      { organizationId: orgB, createdBy: orgBAdminId, title: "Organization B this month", location: "Ufficio", createdAt: new Date(now - 10 * 24 * 60 * 60_000) },
    ].map((ticket) => ({
      ...ticket,
      description: ticket.title,
      category: "Test",
    }))).returning({ id: ticketsTable.id });
    ticketIds = insertedTickets.map(({ id }) => id);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (ticketIds.length) await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationIds.length) {
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
    await pool.end();
  });

  it("counts ticket creation periods and excludes hidden organizations from the default list", async () => {
    const response = await fetch(`${baseUrl}/api/superadmin`, {
      headers: { Cookie: `session_id=${sessionId}` },
    });
    const body = await response.json() as {
      organizations: Array<{ id: number }>;
      ticketCreationStats: typeof baselineTicketCreationStats;
    };

    expect(response.status).toBe(200);
    expect(body.organizations.map((organization) => organization.id)).not.toContain(organizationIds[1]);
    expect(body.ticketCreationStats.today).toBeGreaterThanOrEqual(baselineTicketCreationStats.today + 3);
    expect(body.ticketCreationStats.yesterday).toBeGreaterThanOrEqual(baselineTicketCreationStats.yesterday + 1);
    expect(body.ticketCreationStats.last7Days).toBeGreaterThanOrEqual(baselineTicketCreationStats.last7Days + 5);
    expect(body.ticketCreationStats.last30Days).toBeGreaterThanOrEqual(baselineTicketCreationStats.last30Days + 7);

    const allOrganizationsResponse = await fetch(`${baseUrl}/api/superadmin?includeHidden=true`, {
      headers: { Cookie: `session_id=${sessionId}` },
    });
    const allOrganizationsBody = await allOrganizationsResponse.json() as {
      organizations: Array<{
        id: number;
        ticketCreationStats: { today: number; yesterday: number; last7Days: number; last30Days: number };
      }>;
    };
    const byId = new Map(allOrganizationsBody.organizations.map((organization) => [organization.id, organization]));

    expect(byId.get(organizationIds[0])?.ticketCreationStats).toEqual({
      today: 2,
      yesterday: 1,
      last7Days: 4,
      last30Days: 5,
    });
    expect(byId.get(organizationIds[1])?.ticketCreationStats).toEqual({
      today: 1,
      yesterday: 0,
      last7Days: 1,
      last30Days: 2,
    });
  });
});
