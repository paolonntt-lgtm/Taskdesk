import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientsTable,
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let collaboratorId: number;
let ticketId: number;
let adminSessionId: string;
let collaboratorSessionId: string;

async function getTicket(sessionId: string) {
  const response = await fetch(`${baseUrl}/api/tickets/${ticketId}`, {
    headers: { Cookie: `session_id=${sessionId}` },
  });
  return { status: response.status, body: await response.json() };
}

describe("admin-only inbound email client association warnings", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Email association issue test ${runId}`,
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Email Association Issue Admin",
      email: `email-association-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;

    const [collaborator] = await db.insert(usersTable).values({
      name: "Email Association Issue Collaborator",
      email: `email-association-collaborator-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    const senderEmail = `shared-${runId}@northwind.example`;
    await db.insert(clientsTable).values([
      { organizationId, name: "Private Client One", email: senderEmail },
      { organizationId, name: "Private Client Two", pec: senderEmail },
    ]);

    const [ticket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Inbound email ${runId}`,
      description: "Created by the inbound association warning test.",
      category: "Support",
      location: "",
      resource: senderEmail,
      visibility: "organization",
      createdBy: adminId,
      emailMessageId: `<${runId}@example.test>`,
    }).returning({ id: ticketsTable.id });
    ticketId = ticket.id;

    adminSessionId = await createSession(adminId);
    collaboratorSessionId = await createSession(collaboratorId);

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
    if (ticketId) await db.delete(ticketsTable).where(eq(ticketsTable.id, ticketId));
    if (organizationId) await db.delete(clientsTable).where(eq(clientsTable.organizationId, organizationId));
    if (adminSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    if (collaboratorSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, collaboratorSessionId));
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (collaboratorId) await db.delete(usersTable).where(eq(usersTable.id, collaboratorId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("explains the conflict to admins without exposing it to collaborators", async () => {
    const [adminResponse, collaboratorResponse] = await Promise.all([
      getTicket(adminSessionId),
      getTicket(collaboratorSessionId),
    ]);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.clientAssociationIssue).toBe("conflicting_exact_matches");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("clientAssociationIssue");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("Private Client One");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("Private Client Two");
  });
});
