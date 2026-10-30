import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientsTable,
  db,
  emailClientDomainRulesTable,
  emailClientSenderRulesTable,
  organizationsTable,
  pool,
  sessionsTable,
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
let otherOrganizationId: number;
let clientId: number;
let otherClientId: number;
let adminId: number;
let collaboratorId: number;
let adminSessionId: string;
let collaboratorSessionId: string;
let senderRuleId: number;
let domainRuleId: number;
let otherOrganizationRuleId: number;

describe("historical email rule review", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Legacy email rule test ${runId}`,
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;
    const [otherOrganization] = await db.insert(organizationsTable).values({
      name: `Other legacy email rule test ${runId}`,
      clientsEnabled: true,
    }).returning({ id: organizationsTable.id });
    otherOrganizationId = otherOrganization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Legacy Email Rules Admin",
      email: `legacy-rules-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;
    const [collaborator] = await db.insert(usersTable).values({
      name: "Legacy Email Rules Collaborator",
      email: `legacy-rules-user-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    const [client] = await db.insert(clientsTable).values({
      organizationId,
      name: "Historical Rule Client",
    }).returning({ id: clientsTable.id });
    clientId = client.id;
    const [otherClient] = await db.insert(clientsTable).values({
      organizationId: otherOrganizationId,
      name: "Other Organization Client",
    }).returning({ id: clientsTable.id });
    otherClientId = otherClient.id;

    const [senderRule] = await db.insert(emailClientSenderRulesTable).values({
      organizationId,
      clientId,
      senderEmail: `legacy-${runId}@example.test`,
    }).returning({ id: emailClientSenderRulesTable.id });
    senderRuleId = senderRule.id;
    const [domainRule] = await db.insert(emailClientDomainRulesTable).values({
      organizationId,
      clientId,
      domain: `legacy-${runId}.example.test`,
    }).returning({ id: emailClientDomainRulesTable.id });
    domainRuleId = domainRule.id;
    const [otherRule] = await db.insert(emailClientDomainRulesTable).values({
      organizationId: otherOrganizationId,
      clientId: otherClientId,
      domain: `private-${runId}.example.test`,
    }).returning({ id: emailClientDomainRulesTable.id });
    otherOrganizationRuleId = otherRule.id;

    adminSessionId = await createSession(adminId);
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
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    if (organizationId) {
      await db.delete(emailClientSenderRulesTable)
        .where(eq(emailClientSenderRulesTable.organizationId, organizationId));
      await db.delete(emailClientDomainRulesTable)
        .where(eq(emailClientDomainRulesTable.organizationId, organizationId));
    }
    if (otherOrganizationId) {
      await db.delete(emailClientDomainRulesTable)
        .where(eq(emailClientDomainRulesTable.organizationId, otherOrganizationId));
    }
    if (adminSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    if (collaboratorSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, collaboratorSessionId));
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (collaboratorId) await db.delete(usersTable).where(eq(usersTable.id, collaboratorId));
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    if (otherClientId) await db.delete(clientsTable).where(eq(clientsTable.id, otherClientId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    if (otherOrganizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, otherOrganizationId));
    await pool.end();
  });

  it("shows only this organization's historical rules to admins", async () => {
    const [adminResponse, collaboratorResponse] = await Promise.all([
      fetch(`${baseUrl}/api/clients/legacy-email-rules`, {
        headers: { Cookie: `session_id=${adminSessionId}` },
      }),
      fetch(`${baseUrl}/api/clients/legacy-email-rules`, {
        headers: { Cookie: `session_id=${collaboratorSessionId}` },
      }),
    ]);
    expect(adminResponse.status).toBe(200);
    const rules = await adminResponse.json();
    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: senderRuleId,
        ruleType: "sender",
        value: `legacy-${runId}@example.test`,
        clientId,
        clientName: "Historical Rule Client",
      }),
      expect.objectContaining({
        id: domainRuleId,
        ruleType: "domain",
        value: `legacy-${runId}.example.test`,
      }),
    ]));
    expect(JSON.stringify(rules)).not.toContain(`private-${runId}.example.test`);
    expect(collaboratorResponse.status).toBe(403);
  });

  it("records an explicit keep decision without activating the sender rule", async () => {
    const response = await fetch(
      `${baseUrl}/api/clients/legacy-email-rules/sender/${senderRuleId}/review`,
      {
        method: "PATCH",
        headers: { Cookie: `session_id=${adminSessionId}` },
      },
    );
    expect(response.status).toBe(200);
    const [rule] = await db.select({
      reviewedAt: emailClientSenderRulesTable.reviewedAt,
    }).from(emailClientSenderRulesTable).where(eq(emailClientSenderRulesTable.id, senderRuleId));
    expect(rule?.reviewedAt).toBeInstanceOf(Date);
    expect(resolveEmailClientAssociation({
      organizationId,
      senderEmail: `legacy-${runId}@example.test`,
      clients: [{ id: clientId, organizationId, name: "Historical Rule Client" }],
      senderRules: [{ organizationId, senderEmail: `legacy-${runId}@example.test`, clientId }],
      domainRules: [{ organizationId, domain: `example.test`, clientId }],
    } as any)).toEqual({ clientId: null, suggestedClientId: null });
  });

  it("prevents cross-organization review and removes only a rule after an admin request", async () => {
    const forbiddenTarget = await fetch(
      `${baseUrl}/api/clients/legacy-email-rules/domain/${otherOrganizationRuleId}/review`,
      {
        method: "PATCH",
        headers: { Cookie: `session_id=${adminSessionId}` },
      },
    );
    expect(forbiddenTarget.status).toBe(404);

    const removeResponse = await fetch(
      `${baseUrl}/api/clients/legacy-email-rules/domain/${domainRuleId}`,
      {
        method: "DELETE",
        headers: { Cookie: `session_id=${adminSessionId}` },
      },
    );
    expect(removeResponse.status).toBe(204);
    const [deletedRule] = await db.select({ id: emailClientDomainRulesTable.id })
      .from(emailClientDomainRulesTable)
      .where(eq(emailClientDomainRulesTable.id, domainRuleId));
    expect(deletedRule).toBeUndefined();

    const [otherRule] = await db.select({ id: emailClientDomainRulesTable.id })
      .from(emailClientDomainRulesTable)
      .where(eq(emailClientDomainRulesTable.id, otherOrganizationRuleId));
    expect(otherRule?.id).toBe(otherOrganizationRuleId);
  });
});
