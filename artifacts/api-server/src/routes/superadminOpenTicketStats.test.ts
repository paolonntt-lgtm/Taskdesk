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
let organizationIds: number[] = [];
let userIds: number[] = [];
let sessionId: string;
let ticketIds: number[] = [];

describe("superadmin open ticket statistics", () => {
  beforeAll(async () => {
    const organizations = await db.insert(organizationsTable).values([
      { name: `Superadmin open stats A ${runId}` },
      { name: `Superadmin open stats B ${runId}` },
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

    await db.insert(ticketStatusesTable).values([
      { organizationId: orgA, key: "open", label: "Open", isDefault: true, isClosed: false },
      { organizationId: orgA, key: "resolved", label: "Resolved", isClosed: false },
      { organizationId: orgA, key: "finished", label: "Finished", isClosed: true },
      { organizationId: orgB, key: "working", label: "Working", isDefault: true, isClosed: false },
      { organizationId: orgB, key: "done", label: "Done", isClosed: true },
    ]);

    const insertedTickets = await db.insert(ticketsTable).values([
      { organizationId: orgA, createdBy: orgAAdminId, title: "Open", status: "open", location: "Ufficio" },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Custom active", status: "resolved", location: "Ufficio" },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Custom closed", status: "finished", location: "Ufficio" },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Legacy closed", status: "closed", location: "Ufficio" },
      { organizationId: orgA, createdBy: orgAAdminId, title: "Deleted", status: "open", location: "Ufficio", deletedAt: new Date() },
      { organizationId: orgA, createdBy: systemUserId, title: "System internal", status: "open", location: "Ufficio" },
      { organizationId: orgA, createdBy: systemUserId, title: "System external", status: "open", location: " Esterno " },
      { organizationId: orgB, createdBy: orgBAdminId, title: "Organization B active", status: "working", location: "Ufficio" },
      { organizationId: orgB, createdBy: orgBAdminId, title: "Organization B closed", status: "done", location: "Ufficio" },
    ].map((ticket) => ({
      ...ticket,
      description: ticket.title,
      category: "Test",
    }))).returning({ id: ticketsTable.id });
    ticketIds = insertedTickets.map(({ id }) => id);

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
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (ticketIds.length) await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    if (organizationIds.length) {
      await db.delete(ticketStatusesTable).where(inArray(ticketStatusesTable.organizationId, organizationIds));
    }
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationIds.length) {
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
    await pool.end();
  });

  it("counts non-closed tickets across organizations using each organization's statuses", async () => {
    const response = await fetch(`${baseUrl}/api/superadmin`, {
      headers: { Cookie: `session_id=${sessionId}` },
    });
    const body = await response.json() as { organizations: Array<{ id: number; openTickets: number }> };
    const byId = new Map(body.organizations.map((organization) => [organization.id, organization]));

    expect(response.status).toBe(200);
    expect(byId.get(organizationIds[0])?.openTickets).toBe(3);
    expect(byId.get(organizationIds[1])?.openTickets).toBe(1);
  });
});
