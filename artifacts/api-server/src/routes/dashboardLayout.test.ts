import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, organizationsTable, sessionsTable, settingsTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let newOrganizationId: number;
let existingOrganizationId: number;
let newAdminId: number;
let existingAdminId: number;
let newAdminSessionId: string;
let existingAdminSessionId: string;

async function request(path: string, sessionId: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Cookie: `session_id=${sessionId}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("collaborator dashboard onboarding scope", () => {
  beforeAll(async () => {
    const [newOrganization] = await db.insert(organizationsTable).values({
      name: `New dashboard org ${runId}`,
      onboardingDone: false,
      profession: "commercialisti",
      businessType: "professional_studio",
    }).returning({ id: organizationsTable.id });
    newOrganizationId = newOrganization.id;

    const [existingOrganization] = await db.insert(organizationsTable).values({
      name: `Existing dashboard org ${runId}`,
      onboardingDone: true,
      profession: "notai",
      businessType: "professional_studio",
    }).returning({ id: organizationsTable.id });
    existingOrganizationId = existingOrganization.id;
    await db.insert(settingsTable).values([
      {
        key: `org_${newOrganizationId}_categories`,
        value: JSON.stringify(["Accounting", "Tax Returns", "Payroll", "Corporate", "Client Documents", "Other"]),
      },
      { key: `org_${existingOrganizationId}_categories`, value: JSON.stringify(["Categorie personali"]) },
    ]);

    const [newAdmin] = await db.insert(usersTable).values({
      name: "New Dashboard Admin",
      email: `new-dashboard-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId: newOrganizationId,
    }).returning({ id: usersTable.id });
    newAdminId = newAdmin.id;

    const [existingAdmin] = await db.insert(usersTable).values({
      name: "Existing Dashboard Admin",
      email: `existing-dashboard-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId: existingOrganizationId,
    }).returning({ id: usersTable.id });
    existingAdminId = existingAdmin.id;

    newAdminSessionId = await createSession(newAdminId);
    existingAdminSessionId = await createSession(existingAdminId);
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
        server.close((error) => error ? reject(error) : resolve());
      });
    }

    const organizationIds = [newOrganizationId, existingOrganizationId].filter(Number.isInteger);
    const sessionIds = [newAdminSessionId, existingAdminSessionId].filter(Boolean);
    const userIds = [newAdminId, existingAdminId].filter(Number.isInteger);
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationIds.length) {
      await db.delete(settingsTable).where(
        inArray(settingsTable.key, organizationIds.flatMap((id) => [
          `org_${id}_categories`,
          `org_${id}_auto_collaborator_dashboard_widgets`,
        ])),
      );
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
  });

  it("enables automatic collaborator widgets only when onboarding is first completed", async () => {
    const firstCompletion = await request("/api/onboarding/complete", newAdminSessionId, {
      method: "POST",
      body: JSON.stringify({ businessType: "professional_studio", profession: "avvocati" }),
    });
    expect(firstCompletion.status).toBe(200);
    expect(await firstCompletion.json()).toMatchObject({
      profession: "avvocati",
      businessType: "professional_studio",
      categories: ["Civil Law", "Criminal Law", "Corporate Law", "Family Law", "Contracts", "Other"],
    });
    const [updatedNewOrganization] = await db.select({
      profession: organizationsTable.profession,
      businessType: organizationsTable.businessType,
    }).from(organizationsTable).where(eq(organizationsTable.id, newOrganizationId));
    expect(updatedNewOrganization).toEqual({ profession: "avvocati", businessType: "professional_studio" });

    const firstDashboard = await request("/api/dashboard-layout", newAdminSessionId);
    expect(await firstDashboard.json()).toMatchObject({
      layout: null,
      visibleIds: null,
      autoCollaboratorWidgets: true,
    });

    const repeatCompletion = await request("/api/onboarding/complete", existingAdminSessionId, {
      method: "POST",
      body: JSON.stringify({ businessType: "it_support", profession: "it_support" }),
    });
    expect(repeatCompletion.status).toBe(200);
    expect(await repeatCompletion.json()).toMatchObject({ categories: ["Categorie personali"] });
    const [preservedCategories] = await db.select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, `org_${existingOrganizationId}_categories`));
    expect(JSON.parse(preservedCategories.value)).toEqual(["Categorie personali"]);

    const existingDashboard = await request("/api/dashboard-layout", existingAdminSessionId);
    expect(await existingDashboard.json()).toMatchObject({
      autoCollaboratorWidgets: false,
    });

    const saveLayout = await request("/api/dashboard-layout", newAdminSessionId, {
      method: "PUT",
      body: JSON.stringify({ layout: [], visibleIds: [] }),
    });
    expect(saveLayout.status).toBe(200);

    const savedDashboard = await request("/api/dashboard-layout", newAdminSessionId);
    expect(await savedDashboard.json()).toMatchObject({
      layout: [],
      visibleIds: [],
      autoCollaboratorWidgets: true,
    });
  }, 30_000);
});
