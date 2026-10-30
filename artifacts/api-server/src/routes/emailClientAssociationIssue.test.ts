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
import { resolveEmailClientAssociation } from "../lib/emailClientAssociation";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let collaboratorId: number;
let ticketId: number;
let adminSessionId: string;
let collaboratorSessionId: string;
let senderEmail: string;
let keepClientId: number;
let removeClientId: number;

async function getTicket(sessionId: string) {
  const response = await fetch(`${baseUrl}/api/tickets/${ticketId}`, {
    headers: { Cookie: `session_id=${sessionId}` },
  });
  return { status: response.status, body: await response.json() as any };
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

    senderEmail = `shared-${runId}@northwind.example`;
    const clients = await db.insert(clientsTable).values([
      { organizationId, name: "Private Client One", email: senderEmail },
      { organizationId, name: "Private Client Two", pec: senderEmail },
    ]).returning({ id: clientsTable.id });
    keepClientId = clients[0].id;
    removeClientId = clients[1].id;

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
      emailClientAssociationReason: "conflict",
      emailClientAssociationSource: "external_sender",
      emailClientAssociationForwarded: true,
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
    expect(adminResponse.body.emailClientAssociationReason).toBe("conflict");
    expect(adminResponse.body.emailClientAssociationSource).toBe("external_sender");
    expect(adminResponse.body.emailClientAssociationForwarded).toBe(true);
    expect(collaboratorResponse.body.clientAssociationIssue).toBe("conflicting_exact_matches");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("emailClientAssociationReason");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("emailClientAssociationSource");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("emailClientAssociationForwarded");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("Private Client One");
    expect(JSON.stringify(collaboratorResponse.body)).not.toContain("Private Client Two");
  });

  it("allows shared email and PEC addresses through create, update, and import", async () => {
    const sharedAddress = `shared-profile-${runId}@northwind.example`;
    const firstResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Shared Email Client One", email: sharedAddress }),
    });
    expect(firstResponse.status).toBe(201);
    const firstClient = await firstResponse.json() as any;

    const secondResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Shared Email Client Two", pec: sharedAddress }),
    });
    expect(secondResponse.status).toBe(201);
    const secondClient = await secondResponse.json() as any;

    const updateResponse = await fetch(`${baseUrl}/api/clients/${secondClient.id}`, {
      method: "PATCH",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: sharedAddress, pec: sharedAddress }),
    });
    expect(updateResponse.status).toBe(200);

    const importResponse = await fetch(`${baseUrl}/api/clients/import`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: [{
          name: "Shared Email Client Imported",
          vatNumber: `VAT-${runId}`,
          email: sharedAddress,
          pec: sharedAddress,
        }],
      }),
    });
    expect(importResponse.status).toBe(200);
    expect(await importResponse.json()).toEqual({
      imported: 1,
      skipped: 0,
      duplicates: 0,
      errors: [],
    });

    const associationsResponse = await fetch(`${baseUrl}/api/clients/email-address-associations`, {
      headers: { Cookie: `session_id=${adminSessionId}` },
    });
    expect(associationsResponse.status).toBe(200);
    const associations = await associationsResponse.json() as any[];
    const matchingClientIds = new Set(
      associations
        .filter((association) => association.address === sharedAddress)
        .map((association) => association.clientId),
    );
    expect(matchingClientIds.has(firstClient.id)).toBe(true);
    expect(matchingClientIds.has(secondClient.id)).toBe(true);
    expect(matchingClientIds.size).toBe(3);
  });

  it("lets a collaborator assign the ambiguous ticket without changing sender routing data", async () => {
    const before = await db.select({
      resource: ticketsTable.resource,
      emailMessageId: ticketsTable.emailMessageId,
      emailConversationId: ticketsTable.emailConversationId,
    }).from(ticketsTable).where(eq(ticketsTable.id, ticketId));

    const response = await fetch(`${baseUrl}/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        Cookie: `session_id=${collaboratorSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId: keepClientId }),
    });
    expect(response.status).toBe(200);

    const [ticket] = await db.select({
      clientId: ticketsTable.clientId,
      resource: ticketsTable.resource,
      emailMessageId: ticketsTable.emailMessageId,
      emailConversationId: ticketsTable.emailConversationId,
    }).from(ticketsTable).where(eq(ticketsTable.id, ticketId));
    expect(ticket).toEqual({
      clientId: keepClientId,
      ...before[0],
    });

    const stillAmbiguous = resolveEmailClientAssociation({
      organizationId,
      senderEmail,
      clients: [
        { id: keepClientId, organizationId, name: "Private Client One", email: senderEmail },
        { id: removeClientId, organizationId, name: "Private Client Two", pec: senderEmail },
      ],
    });
    expect(stillAmbiguous.clientAssociationIssue).toBe("conflicting_exact_matches");
  });

  it("lets admins remove only the incorrect client association without changing ticket sender history", async () => {
    const collaboratorResponse = await fetch(`${baseUrl}/api/clients/email-address-associations/resolve`, {
      method: "PATCH",
      headers: {
        Cookie: `session_id=${collaboratorSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: senderEmail, keepClientId, removeClientId }),
    });
    expect(collaboratorResponse.status).toBe(403);

    const response = await fetch(`${baseUrl}/api/clients/email-address-associations/resolve`, {
      method: "PATCH",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: senderEmail, keepClientId, removeClientId }),
    });
    expect(response.status).toBe(200);

    const clients = await db.select({
      id: clientsTable.id,
      email: clientsTable.email,
      pec: clientsTable.pec,
    }).from(clientsTable).where(eq(clientsTable.organizationId, organizationId));
    expect(clients.find((client) => client.id === keepClientId)?.email).toBe(senderEmail);
    expect(clients.find((client) => client.id === removeClientId)?.pec).toBeNull();

    const [ticket] = await db.select({ resource: ticketsTable.resource })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId));
    expect(ticket.resource).toBe(senderEmail);
  });
});
