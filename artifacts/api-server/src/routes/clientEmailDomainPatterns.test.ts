import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientsTable, db, organizationsTable, pool, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let adminSessionId: string;
let wildcardClientId: number;

describe("client profile email domain patterns", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Email domain pattern test ${runId}`,
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Email Domain Pattern Test Admin",
      email: `email-domain-pattern-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;
    adminSessionId = await createSession(adminId);

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
    if (organizationId) await db.delete(clientsTable).where(eq(clientsTable.organizationId, organizationId));
    if (adminSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("saves a domain wildcard and blocks another client's exact address in that domain", async () => {
    const wildcardResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Iannetti ${runId}`,
        email: "  *@IANNETTISRL.IT  ",
      }),
    });
    expect(wildcardResponse.status).toBe(201);
    const wildcardClient = await wildcardResponse.json() as { id: number; email: string };
    wildcardClientId = wildcardClient.id;
    expect(wildcardClient.email).toBe("*@iannettisrl.it");

    const exactAddressResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        Cookie: `session_id=${adminSessionId}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Conflicting client ${runId}`,
        email: "paolo@iannettisrl.it",
      }),
    });
    expect(exactAddressResponse.status).toBe(409);
  });
});
