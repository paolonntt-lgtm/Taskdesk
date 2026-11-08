import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, clientsTable, organizationsTable, pool, sessionsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let adminSessionId: string;
let collaboratorId: number;
let collaboratorSessionId: string;

async function request(path: string, init: RequestInit = {}, sessionId = adminSessionId) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("client import route", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Client import test ${runId}`,
      clientsEnabled: true,
      profession: "palestre",
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Client Import Test Admin",
      email: `client-import-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;
    adminSessionId = await createSession(adminId);

    const [collaborator] = await db.insert(usersTable).values({
      name: "Client Import Test Collaborator",
      email: `client-import-collaborator-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;
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
      await db.delete(clientsTable).where(eq(clientsTable.organizationId, organizationId));
    }
    if (adminSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    }
    if (collaboratorSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, collaboratorSessionId));
    }
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (collaboratorId) await db.delete(usersTable).where(eq(usersTable.id, collaboratorId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("persists gym member details without VAT and keeps VAT required for company imports", async () => {
    const gymImport = await request("/api/clients/import", {
      method: "POST",
      body: JSON.stringify({
        rows: [{
          firstName: "Ada",
          lastName: "Lombardi",
          taxCode: "LMBDAX00A01H501Z",
          dateOfBirth: "2000-02-01",
          address: "Via Roma 1",
          phone: "3331234567",
          email: `ada-${runId}@example.test`,
          membershipNumber: `GYM-${runId}`,
        }],
      }),
    });

    expect(gymImport.status).toBe(200);
    expect(gymImport.body).toMatchObject({ imported: 1, skipped: 0, duplicates: 0, errors: [] });

    const [member] = await db.select({
      name: clientsTable.name,
      firstName: clientsTable.firstName,
      lastName: clientsTable.lastName,
      taxCode: clientsTable.taxCode,
      dateOfBirth: clientsTable.dateOfBirth,
      address: clientsTable.address,
      phone: clientsTable.phone,
      email: clientsTable.email,
      membershipNumber: clientsTable.membershipNumber,
      vatNumber: clientsTable.vatNumber,
    }).from(clientsTable)
      .where(eq(clientsTable.organizationId, organizationId));
    expect(member).toEqual({
      name: "Ada Lombardi",
      firstName: "Ada",
      lastName: "Lombardi",
      taxCode: "LMBDAX00A01H501Z",
      dateOfBirth: "2000-02-01",
      address: "Via Roma 1",
      phone: "3331234567",
      email: `ada-${runId}@example.test`,
      membershipNumber: `GYM-${runId}`,
      vatNumber: null,
    });

    await db.update(organizationsTable)
      .set({ profession: "commercio" })
      .where(eq(organizationsTable.id, organizationId));

    const companyImport = await request("/api/clients/import", {
      method: "POST",
      body: JSON.stringify({
        rows: [
          { name: `Company without VAT ${runId}`, address: "Via Milano 2" },
          {
            name: `Studio Alfa ${runId}`,
            vatNumber: `IT-${runId}`,
            taxCode: "ALFABC80A01H501X",
            address: "Via Milano 3",
            contactPerson: "Bruno Alfa",
            email: `studio-${runId}@example.test`,
            phone: "0212345678",
            pec: `studio-${runId}@pec.example.test`,
          },
        ],
      }),
    });

    expect(companyImport.status).toBe(200);
    expect(companyImport.body).toMatchObject({
      imported: 1,
      skipped: 1,
      duplicates: 0,
      errors: [{ row: 1, name: `Company without VAT ${runId}`, reason: "Missing required VAT Number" }],
    });

    const [company] = await db.select({
      name: clientsTable.name,
      vatNumber: clientsTable.vatNumber,
      taxCode: clientsTable.taxCode,
      address: clientsTable.address,
      contactPerson: clientsTable.contactPerson,
      email: clientsTable.email,
      phone: clientsTable.phone,
      pec: clientsTable.pec,
    }).from(clientsTable)
      .where(and(
        eq(clientsTable.organizationId, organizationId),
        eq(clientsTable.name, `Studio Alfa ${runId}`),
      ));

    expect(company).toEqual({
      name: `Studio Alfa ${runId}`,
      vatNumber: `IT-${runId}`,
      taxCode: "ALFABC80A01H501X",
      address: "Via Milano 3",
      contactPerson: "Bruno Alfa",
      email: `studio-${runId}@example.test`,
      phone: "0212345678",
      pec: `studio-${runId}@pec.example.test`,
    });
  });

  it("denies bulk imports to collaborators without creating client records", async () => {
    const collaboratorEmail = `unauthorized-import-${runId}@example.test`;
    const response = await request("/api/clients/import", {
      method: "POST",
      body: JSON.stringify({
        rows: [{
          firstName: "Unauthorized",
          lastName: "Member",
          email: collaboratorEmail,
          membershipNumber: `UNAUTHORIZED-${runId}`,
        }],
      }),
    }, collaboratorSessionId);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: "Admin access required" });

    const createdClients = await db.select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.organizationId, organizationId),
        eq(clientsTable.email, collaboratorEmail),
      ));
    expect(createdClients).toHaveLength(0);
  });
});
