import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  clientsTable,
  clientNotesTable,
  groupsTable,
  groupMembersTable,
  organizationsTable,
  pool,
  sessionsTable,
  ticketStatusesTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { buildBackupPayload } from "../lib/backup";
import { createSession } from "../lib/session";

type HttpResult = { status: number; body: any };

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let foreignOrganizationId: number;
let clientId: number;
let foreignClientId: number;
let groupId: number;
let adminId: number;
let userId: number;
let adminSessionId: string;
let userSessionId: string;
let publicTicketId: number;
let privateTicketId: number;
const createdClientIds: number[] = [];
const createdClientNoteIds: number[] = [];
const createdTicketIds: number[] = [];
const createdUserIds: number[] = [];

async function request(path: string, sessionId: string, init: RequestInit = {}): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("client worked-hours report", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Worked hours test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable)
      .values({
        name: "Worked Hours Admin",
        email: `worked-hours-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [user] = await db.insert(usersTable)
      .values({
        name: "Worked Hours User",
        email: `worked-hours-user-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    userId = user.id;

    const [group] = await db.insert(groupsTable)
      .values({ name: `Worked Hours Viewers ${runId}`, organizationId, permissions: "[]" })
      .returning({ id: groupsTable.id });
    groupId = group.id;
    await db.insert(groupMembersTable).values({ groupId, userId });

    const [client] = await db.insert(clientsTable)
      .values({
        organizationId,
        name: "Worked Hours Client",
        alias: `Shared Search Alias ${runId}`,
        email: `worked-hours-client-${runId}@example.test`,
        phone: `+1555${runId.replaceAll("-", "").slice(0, 7)}`,
        slug: `worked-hours-${runId}`,
      })
      .returning({ id: clientsTable.id });
    clientId = client.id;

    const [foreignOrganization] = await db.insert(organizationsTable)
      .values({ name: `Other organization ${runId}` })
      .returning({ id: organizationsTable.id });
    foreignOrganizationId = foreignOrganization.id;
    const [foreignClient] = await db.insert(clientsTable)
      .values({
        organizationId: foreignOrganizationId,
        name: "Foreign Organization Client",
        alias: `Shared Search Alias ${runId}`,
        slug: `foreign-client-${runId}`,
      })
      .returning({ id: clientsTable.id });
    foreignClientId = foreignClient.id;

    const [publicTicket] = await db.insert(ticketsTable)
      .values({
        organizationId,
        clientId,
        title: "Public extra work",
        description: "Visible to the team",
        category: "Support",
        location: "Remote",
        status: "closed",
        visibility: "organization",
        createdBy: adminId,
        workedMinutes: 90,
        closedAt: new Date("2026-08-15T10:00:00.000Z"),
      })
      .returning({ id: ticketsTable.id });
    publicTicketId = publicTicket.id;

    const [privateTicket] = await db.insert(ticketsTable)
      .values({
        organizationId,
        clientId,
        title: "Private extra work",
        description: "Admin only",
        category: "Support",
        location: "Remote",
        status: "closed",
        visibility: "admins",
        createdBy: adminId,
        workedMinutes: 45,
        closedAt: new Date("2026-08-20T10:00:00.000Z"),
      })
      .returning({ id: ticketsTable.id });
    privateTicketId = privateTicket.id;

    adminSessionId = await createSession(adminId);
    userSessionId = await createSession(userId);
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
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    await db.delete(ticketsTable).where(inArray(ticketsTable.id, [publicTicketId, privateTicketId]));
    if (createdTicketIds.length > 0) {
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    }
    if (createdClientNoteIds.length > 0) {
      await db.delete(clientNotesTable).where(inArray(clientNotesTable.id, createdClientNoteIds));
    }
    await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
    await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    if (createdClientIds.length > 0) {
      await db.delete(clientsTable).where(inArray(clientsTable.id, createdClientIds));
    }
    await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    await db.delete(clientsTable).where(eq(clientsTable.id, foreignClientId));
    await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, [adminSessionId, userSessionId]));
    if (createdUserIds.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, createdUserIds));
    }
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, userId]));
    await db.delete(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, organizationId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, foreignOrganizationId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("filters private worked time, allows admins to correct it, and persists the result in backups", async () => {
    const deniedFilter = await request("/api/clients?hasUnbilledWorkedTime=true", userSessionId);
    expect(deniedFilter.status).toBe(403);

    const hiddenClient = await request(`/api/clients/${clientId}`, userSessionId);
    expect(hiddenClient.status).toBe(200);
    expect(hiddenClient.body.tickets[0].workedMinutes).toBeNull();
    expect(hiddenClient.body.tickets[0].workedBillingStatus).toBeNull();

    const hiddenTicket = await request(`/api/tickets/${publicTicketId}`, userSessionId);
    expect(hiddenTicket.status).toBe(200);
    expect(hiddenTicket.body.workedMinutes).toBeNull();
    expect(hiddenTicket.body.workedBillingStatus).toBeNull();
    const hiddenRecentTickets = await request("/api/stats/recent-tickets", userSessionId);
    const hiddenRecentTicket = hiddenRecentTickets.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(hiddenRecentTicket.workedMinutes).toBeNull();
    expect(hiddenRecentTicket.workedBillingStatus).toBeNull();

    const grantPermission = await request(`/api/groups/${groupId}/permissions`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ permissions: ["view_worked_hours"] }),
    });
    expect(grantPermission.status).toBe(200);

    const userResponse = await request(`/api/clients/${clientId}`, userSessionId);
    expect(userResponse.status).toBe(200);
    expect(userResponse.body.tickets.map((ticket: any) => ticket.id)).toEqual([publicTicketId]);
    expect(userResponse.body.tickets[0].workedBillingStatus).toBe("unbilled");
    expect(userResponse.body.tickets[0].workedMinutes).toBe(90);

    const visibleTicket = await request(`/api/tickets/${publicTicketId}`, userSessionId);
    expect(visibleTicket.body.workedMinutes).toBe(90);
    expect(visibleTicket.body.workedBillingStatus).toBe("unbilled");
    const visibleRecentTickets = await request("/api/stats/recent-tickets", userSessionId);
    const visibleRecentTicket = visibleRecentTickets.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(visibleRecentTicket.workedMinutes).toBe(90);
    expect(visibleRecentTicket.workedBillingStatus).toBe("unbilled");

    const visibleTicketList = await request("/api/tickets", userSessionId);
    expect(visibleTicketList.status).toBe(200);
    const listedPublicTicket = visibleTicketList.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(listedPublicTicket.workedMinutes).toBe(90);
    expect(listedPublicTicket.workedBillingStatus).toBe("unbilled");

    const initialUnbilledClients = await request("/api/clients?hasUnbilledWorkedTime=true", userSessionId);
    expect(initialUnbilledClients.status).toBe(200);
    expect(initialUnbilledClients.body.map((client: any) => client.id)).toContain(clientId);

    const adminResponse = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.tickets.map((ticket: any) => ticket.id)).toEqual([publicTicketId, privateTicketId]);
    expect(adminResponse.body.tickets.every((ticket: any) => ticket.workedBillingStatus === "unbilled")).toBe(true);

    const forbiddenResponse = await request(`/api/clients/${clientId}/tickets/${publicTicketId}/billing-status`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "billed" }),
    });
    expect(forbiddenResponse.status).toBe(403);

    const updateResponse = await request("/api/time-tracking/client-billing-status", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ ticketId: publicTicketId, status: "billed" }),
    });
    expect(updateResponse.status).toBe(204);

    const userUnbilledClients = await request("/api/clients?hasUnbilledWorkedTime=true", userSessionId);
    expect(userUnbilledClients.status).toBe(200);
    expect(userUnbilledClients.body.map((client: any) => client.id)).not.toContain(clientId);

    const adminUnbilledClients = await request("/api/clients?hasUnbilledWorkedTime=true", adminSessionId);
    expect(adminUnbilledClients.status).toBe(200);
    expect(adminUnbilledClients.body.map((client: any) => client.id)).toContain(clientId);

    const refreshedResponse = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(refreshedResponse.body.tickets.find((ticket: any) => ticket.id === publicTicketId).workedBillingStatus).toBe("billed");

    const userAfterBilling = await request(`/api/clients/${clientId}`, userSessionId);
    expect(userAfterBilling.body.tickets[0].workedBillingStatus).toBe("billed");
    const userAfterBillingFilter = await request("/api/clients?hasUnbilledWorkedTime=true", userSessionId);
    expect(userAfterBillingFilter.status).toBe(200);
    expect(userAfterBillingFilter.body.map((client: any) => client.id)).not.toContain(clientId);

    const forbiddenWorkedTimeUpdate = await request(
      `/api/clients/${clientId}/tickets/${publicTicketId}/worked-hours`,
      userSessionId,
      { method: "PATCH", body: JSON.stringify({ workedMinutes: 120 }) },
    );
    expect(forbiddenWorkedTimeUpdate.status).toBe(403);

    const correctedWorkedTime = await request(
      `/api/clients/${clientId}/tickets/${publicTicketId}/worked-hours`,
      adminSessionId,
      { method: "PATCH", body: JSON.stringify({ workedMinutes: 120 }) },
    );
    expect(correctedWorkedTime.status).toBe(200);
    expect(correctedWorkedTime.body).toMatchObject({
      id: publicTicketId,
      workedMinutes: 120,
      workedBillingStatus: "unbilled",
    });

    const invalidWorkedTime = await request(
      `/api/clients/${clientId}/tickets/${publicTicketId}/worked-hours`,
      adminSessionId,
      { method: "PATCH", body: JSON.stringify({ workedMinutes: -1 }) },
    );
    expect(invalidWorkedTime.status).toBe(400);

    const removedWorkedTime = await request(
      `/api/clients/${clientId}/tickets/${publicTicketId}/worked-hours`,
      adminSessionId,
      { method: "PATCH", body: JSON.stringify({ workedMinutes: null }) },
    );
    expect(removedWorkedTime.status).toBe(200);
    expect(removedWorkedTime.body).toMatchObject({
      id: publicTicketId,
      workedMinutes: null,
      workedBillingStatus: "unbilled",
    });

    const afterWorkedTimeRemoval = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(afterWorkedTimeRemoval.body.tickets.find((ticket: any) => ticket.id === publicTicketId).workedMinutes).toBeNull();

    const revokePermission = await request(`/api/groups/${groupId}/permissions`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ permissions: [] }),
    });
    expect(revokePermission.status).toBe(200);
    const userAfterRevocation = await request(`/api/clients/${clientId}`, userSessionId);
    expect(userAfterRevocation.body.tickets[0].workedMinutes).toBeNull();
    expect(userAfterRevocation.body.tickets[0].workedBillingStatus).toBeNull();
    const revokedFilter = await request("/api/clients?hasUnbilledWorkedTime=true", userSessionId);
    expect(revokedFilter.status).toBe(403);

    const backup = await buildBackupPayload(organizationId);
    const backupTicket = backup?.data.tickets.find((ticket: any) => ticket.id === publicTicketId);
    expect(backupTicket?.workedBillingStatus).toBe("unbilled");
    expect(backupTicket?.workedMinutes).toBeNull();
  }, 30_000);

  it("allows a standard organization member to create a client", async () => {
    const response = await request("/api/clients", userSessionId, {
      method: "POST",
      body: JSON.stringify({
        name: "Client created by team member",
        email: "created-by-team@example.test",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Client created by team member");
    expect(response.body.organizationId).toBe(organizationId);
    createdClientIds.push(response.body.id);
  });

  it("does not return clients from another organization", async () => {
    const clientList = await request("/api/clients", userSessionId);
    expect(clientList.status).toBe(200);
    expect(clientList.body.map((client: any) => client.id)).toContain(clientId);
    expect(clientList.body.map((client: any) => client.id)).not.toContain(foreignClientId);

    const aliasSearch = await request(
      `/api/clients?search=${encodeURIComponent(`Shared Search Alias ${runId}`)}&limit=4`,
      userSessionId,
    );
    expect(aliasSearch.status).toBe(200);
    expect(aliasSearch.body.map((client: any) => client.id)).toContain(clientId);
    expect(aliasSearch.body.map((client: any) => client.id)).not.toContain(foreignClientId);

    const nameSearch = await request(
      `/api/clients?search=${encodeURIComponent("Worked Hours Client")}`,
      userSessionId,
    );
    expect(nameSearch.body.map((client: any) => client.id)).toContain(clientId);

    const emailSearch = await request(
      `/api/clients?search=${encodeURIComponent(`worked-hours-client-${runId}@example.test`)}`,
      userSessionId,
    );
    expect(emailSearch.body.map((client: any) => client.id)).toContain(clientId);

    const phone = `+1555${runId.replaceAll("-", "").slice(0, 7)}`;
    const phoneSearch = await request(`/api/clients?search=${encodeURIComponent(phone)}`, userSessionId);
    expect(phoneSearch.body.map((client: any) => client.id)).toContain(clientId);

    const [secondMatchingClient] = await db.insert(clientsTable).values({
      organizationId,
      name: `ZZZ Shared Alias Client ${runId}`,
      alias: `Shared Search Alias ${runId}`,
      slug: `shared-search-${runId}`,
    }).returning({ id: clientsTable.id });
    createdClientIds.push(secondMatchingClient.id);
    const limitedSearch = await request(
      `/api/clients?search=${encodeURIComponent(`Shared Search Alias ${runId}`)}&limit=1`,
      userSessionId,
    );
    expect(limitedSearch.status).toBe(200);
    expect(limitedSearch.body).toHaveLength(1);

    const unauthenticatedSearch = await fetch(
      `${baseUrl}/api/clients?search=${encodeURIComponent(`Shared Search Alias ${runId}`)}`,
    );
    expect(unauthenticatedSearch.status).toBe(401);

    const foreignClientDetail = await request(`/api/clients/${foreignClientId}`, userSessionId);
    expect(foreignClientDetail.status).toBe(404);
  });

  it("treats SQL LIKE pattern characters as literal client-search text", async () => {
    const [
      percentMatch,
      percentWildcardDecoy,
      underscoreMatch,
      underscoreWildcardDecoy,
      backslashMatch,
      backslashEscapeDecoy,
    ] =
      await db.insert(clientsTable).values([
        {
          organizationId,
          name: `PercentLiteral 100% literal ${runId}`,
          slug: `percent-literal-${runId}`,
        },
        {
          organizationId,
          name: `PercentLiteral 100x literal ${runId}`,
          slug: `percent-decoy-${runId}`,
        },
        {
          organizationId,
          name: `UnderscoreLiteral value_token ${runId}`,
          slug: `underscore-literal-${runId}`,
        },
        {
          organizationId,
          name: `UnderscoreLiteral valueXtoken ${runId}`,
          slug: `underscore-decoy-${runId}`,
        },
        {
          organizationId,
          name: `BackslashLiteral path\\segment ${runId}`,
          slug: `backslash-literal-${runId}`,
        },
        {
          organizationId,
          name: `BackslashLiteral pathsegment ${runId}`,
          slug: `backslash-decoy-${runId}`,
        },
      ]).returning({ id: clientsTable.id });
    createdClientIds.push(
      percentMatch.id,
      percentWildcardDecoy.id,
      underscoreMatch.id,
      underscoreWildcardDecoy.id,
      backslashMatch.id,
      backslashEscapeDecoy.id,
    );

    const percentSearch = await request(
      `/api/clients?search=${encodeURIComponent(`100% literal ${runId}`)}`,
      userSessionId,
    );
    expect(percentSearch.status).toBe(200);
    expect(percentSearch.body.map((client: any) => client.id)).toContain(percentMatch.id);
    expect(percentSearch.body.map((client: any) => client.id)).not.toContain(percentWildcardDecoy.id);

    const underscoreSearch = await request(
      `/api/clients?search=${encodeURIComponent(`value_token ${runId}`)}`,
      userSessionId,
    );
    expect(underscoreSearch.status).toBe(200);
    expect(underscoreSearch.body.map((client: any) => client.id)).toContain(underscoreMatch.id);
    expect(underscoreSearch.body.map((client: any) => client.id)).not.toContain(underscoreWildcardDecoy.id);

    const backslashSearch = await request(
      `/api/clients?search=${encodeURIComponent(`path\\segment ${runId}`)}`,
      userSessionId,
    );
    expect(backslashSearch.status).toBe(200);
    expect(backslashSearch.body.map((client: any) => client.id)).toContain(backslashMatch.id);
    expect(backslashSearch.body.map((client: any) => client.id)).not.toContain(backslashEscapeDecoy.id);
  });

  it("treats SQL LIKE pattern characters as literal client-note search text within the authorized organization", async () => {
    const noteRows = await db.insert(clientNotesTable).values([
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `percent note 100% token ${runId}`,
      },
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `percent note 100x token ${runId}`,
      },
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `underscore note value_token ${runId}`,
      },
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `underscore note valueXtoken ${runId}`,
      },
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `backslash note path\\segment ${runId}`,
      },
      {
        clientId,
        organizationId,
        authorId: userId,
        body: `backslash note pathsegment ${runId}`,
      },
      {
        clientId: foreignClientId,
        organizationId: foreignOrganizationId,
        authorId: userId,
        body: `percent note 100% token ${runId}`,
      },
    ]).returning({ id: clientNotesTable.id, clientId: clientNotesTable.clientId });
    createdClientNoteIds.push(...noteRows.map(({ id }) => id));

    const cases = [
      { query: `100% token ${runId}`, matchIndex: 0, decoyIndex: 1 },
      { query: `value_token ${runId}`, matchIndex: 2, decoyIndex: 3 },
      { query: `path\\segment ${runId}`, matchIndex: 4, decoyIndex: 5 },
    ];
    for (const { query, matchIndex, decoyIndex } of cases) {
      const response = await request(`/api/client-notes?search=${encodeURIComponent(query)}`, userSessionId);
      const resultIds = response.body.map((note: any) => note.id);
      expect(response.status).toBe(200);
      expect(resultIds).toContain(noteRows[matchIndex]!.id);
      expect(resultIds).not.toContain(noteRows[decoyIndex]!.id);
      expect(resultIds).not.toContain(noteRows[6]!.id);
      expect(response.body.every((note: any) => note.organizationId === organizationId)).toBe(true);
      expect(response.body.every((note: any) => note.clientId === clientId)).toBe(true);
    }
  });

  it("treats SQL LIKE pattern characters as literal text in global search without changing scope or limits", async () => {
    const originalOrganization = await db
      .select({ clientsEnabled: organizationsTable.clientsEnabled })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .limit(1);
    await db
      .update(organizationsTable)
      .set({ clientsEnabled: true })
      .where(eq(organizationsTable.id, organizationId));

    const cases = [
      { label: "Percent", needle: `100%search-${runId}`, decoy: `100xsearch-${runId}` },
      { label: "Underscore", needle: `value_token-${runId}`, decoy: `valueXtoken-${runId}` },
      { label: "Backslash", needle: `path\\segment-${runId}`, decoy: `pathsegment-${runId}` },
    ];

    try {
      for (const { label, needle, decoy } of cases) {
        const matchingClientNames = [1, 2].map((number) => `Global ${label} ${needle} match ${number}`);
        const decoyClientName = `Global ${label} ${decoy} decoy`;
        const [matchingClients, decoyClient, foreignClient] = await Promise.all([
          db.insert(clientsTable).values(matchingClientNames.map((name, number) => ({
            organizationId,
            name,
            slug: `global-${label.toLowerCase()}-${number}-${runId}`,
          }))).returning({ id: clientsTable.id }),
          db.insert(clientsTable).values({
            organizationId,
            name: decoyClientName,
            slug: `global-${label.toLowerCase()}-decoy-${runId}`,
          }).returning({ id: clientsTable.id }),
          db.insert(clientsTable).values({
            organizationId: foreignOrganizationId,
            name: `Global ${label} ${needle} foreign`,
            slug: `global-${label.toLowerCase()}-foreign-${runId}`,
          }).returning({ id: clientsTable.id }),
        ]);
        createdClientIds.push(...matchingClients.map((client) => client.id), decoyClient[0].id, foreignClient[0].id);

        const matchingTickets = await db.insert(ticketsTable).values([
          1,
          2,
        ].map((number) => ({
          organizationId,
          clientId,
          title: `Global ${label} ${needle} match ${number}`,
          description: "Global-search literal matching test",
          category: "Support",
          location: "Remote",
          status: "open",
          visibility: "organization",
          createdBy: adminId,
        }))).returning({ id: ticketsTable.id });
        const [decoyTicket] = await db.insert(ticketsTable).values({
          organizationId,
          clientId,
          title: `Global ${label} ${decoy} decoy`,
          description: "Global-search literal matching test",
          category: "Support",
          location: "Remote",
          status: "open",
          visibility: "organization",
          createdBy: adminId,
        }).returning({ id: ticketsTable.id });
        const [foreignTicket] = await db.insert(ticketsTable).values({
          organizationId: foreignOrganizationId,
          title: `Global ${label} ${needle} foreign`,
          description: "Global-search literal matching test",
          category: "Support",
          location: "Remote",
          status: "open",
          visibility: "organization",
          createdBy: adminId,
        }).returning({ id: ticketsTable.id });
        createdTicketIds.push(...matchingTickets.map((ticket) => ticket.id), decoyTicket.id, foreignTicket.id);

        const matchingUsers = await db.insert(usersTable).values([
          {
            organizationId,
            name: `Global ${label} ${needle} match by name`,
            email: `global-${label.toLowerCase()}-name-${runId}@example.test`,
            passwordHash: "not-used-in-test",
            role: "user",
          },
          {
            organizationId,
            name: `Global ${label} email-only match`,
            email: `global.${needle}.email-${runId}@example.test`,
            passwordHash: "not-used-in-test",
            role: "user",
          },
        ]).returning({ id: usersTable.id });
        const [decoyUser] = await db.insert(usersTable).values({
          organizationId,
          name: `Global ${label} ${decoy} decoy`,
          email: `global-${label.toLowerCase()}-decoy-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
        }).returning({ id: usersTable.id });
        const [foreignUser] = await db.insert(usersTable).values({
          organizationId: foreignOrganizationId,
          name: `Global ${label} ${needle} foreign`,
          email: `global-${label.toLowerCase()}-foreign-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
        }).returning({ id: usersTable.id });
        createdUserIds.push(...matchingUsers.map((user) => user.id), decoyUser.id, foreignUser.id);

        const response = await request(
          `/api/search?q=${encodeURIComponent(needle)}&limit=2`,
          adminSessionId,
        );
        expect(response.status).toBe(200);

        for (const [resultKey, matchIds, decoyId, foreignId] of [
          ["tickets", matchingTickets.map((ticket) => ticket.id), decoyTicket.id, foreignTicket.id],
          ["clients", matchingClients.map((client) => client.id), decoyClient[0].id, foreignClient[0].id],
          ["users", matchingUsers.map((user) => user.id), decoyUser.id, foreignUser.id],
        ] as const) {
          const results = response.body[resultKey];
          const resultIds = results.map((result: any) => result.id);
          expect(results).toHaveLength(2);
          expect(resultIds.every((id: number) => matchIds.includes(id))).toBe(true);
          expect(resultIds).not.toContain(decoyId);
          expect(resultIds).not.toContain(foreignId);
        }
      }
    } finally {
      await db
        .update(organizationsTable)
        .set({ clientsEnabled: originalOrganization[0]?.clientsEnabled ?? false })
        .where(eq(organizationsTable.id, organizationId));
    }
  });

  it("hides client references from ticket, search, and summary APIs while disabled, then restores them when re-enabled", async () => {
    const disabledSettings = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Feature controls ${runId}`,
        clientsEnabled: false,
        workedTimeEnabled: false,
      }),
    });
    expect(disabledSettings.status).toBe(200);
    expect(disabledSettings.body).toMatchObject({ clientsEnabled: false, workedTimeEnabled: false });

    const clientList = await request("/api/clients", adminSessionId);
    expect(clientList.status).toBe(403);
    const clientSearch = await request(
      `/api/clients?search=${encodeURIComponent(`Shared Search Alias ${runId}`)}`,
      adminSessionId,
    );
    expect(clientSearch.status).toBe(403);
    const clientDetail = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(clientDetail.status).toBe(403);
    const clientNotes = await request("/api/client-notes", adminSessionId);
    expect(clientNotes.status).toBe(403);

    const disabledTicketList = await request("/api/tickets", adminSessionId);
    const disabledListedTicket = disabledTicketList.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(disabledListedTicket).toBeDefined();
    expect(disabledListedTicket).not.toHaveProperty("clientId");
    expect(disabledListedTicket).not.toHaveProperty("client");

    const disabledTicketDetail = await request(`/api/tickets/${publicTicketId}`, adminSessionId);
    expect(disabledTicketDetail.status).toBe(200);
    expect(disabledTicketDetail.body).not.toHaveProperty("clientId");
    expect(disabledTicketDetail.body).not.toHaveProperty("client");

    const disabledSearch = await request(
      `/api/search?q=${encodeURIComponent("Worked Hours Client")}`,
      adminSessionId,
    );
    expect(disabledSearch.status).toBe(200);
    expect(disabledSearch.body.clients).toEqual([]);
    const disabledClientFilter = await request(`/api/tickets?clientId=${clientId}`, adminSessionId);
    expect(disabledClientFilter.status).toBe(403);

    await db.update(ticketsTable)
      .set({ status: "open", dueAt: new Date(Date.now() - 60_000), assignedTo: adminId })
      .where(inArray(ticketsTable.id, [publicTicketId]));
    await db.update(ticketsTable)
      .set({ status: "open", dueAt: new Date(Date.now() + 60 * 60_000), assignedTo: adminId })
      .where(inArray(ticketsTable.id, [privateTicketId]));

    const ticketSummaryRoutes = [
      "/api/stats/recent-tickets",
      "/api/stats/my-tickets",
      "/api/stats/overdue-tickets",
      "/api/stats/assigned-to-me",
      "/api/stats/due-soon",
    ];
    for (const route of ticketSummaryRoutes) {
      const response = await request(route, adminSessionId);
      expect(response.status, route).toBe(200);
      const ticket = response.body.find((item: any) => item.id === publicTicketId);
      expect(ticket, route).toBeDefined();
      expect(ticket, route).not.toHaveProperty("clientId");
    }

    const disabledTicketUpdate = await request(`/api/tickets/${publicTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated while clients are disabled" }),
    });
    expect(disabledTicketUpdate.status).toBe(200);
    expect(disabledTicketUpdate.body).not.toHaveProperty("clientId");
    expect(disabledTicketUpdate.body).not.toHaveProperty("client");

    const disabledClone = await request(`/api/tickets/${publicTicketId}/clone`, adminSessionId, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(disabledClone.status).toBe(201);
    expect(disabledClone.body).not.toHaveProperty("clientId");
    expect(disabledClone.body).not.toHaveProperty("client");
    createdTicketIds.push(disabledClone.body.id);
    const disabledCloneInDb = await db
      .select({ clientId: ticketsTable.clientId })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, disabledClone.body.id))
      .limit(1);
    expect(disabledCloneInDb[0]?.clientId).toBeNull();

    await db.update(ticketsTable)
      .set({ deletedAt: new Date() })
      .where(eq(ticketsTable.id, publicTicketId));
    const disabledTrash = await request("/api/tickets/trash", adminSessionId);
    const disabledTrashedTicket = disabledTrash.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(disabledTrashedTicket).toBeDefined();
    expect(disabledTrashedTicket).not.toHaveProperty("clientId");
    await db.update(ticketsTable)
      .set({ deletedAt: null })
      .where(eq(ticketsTable.id, publicTicketId));

    const createClient = await request("/api/clients", adminSessionId, {
      method: "POST",
      body: JSON.stringify({ name: "Should not be created" }),
    });
    expect(createClient.status).toBe(403);
    const updateClient = await request(`/api/clients/${clientId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: "Should not be updated" }),
    });
    expect(updateClient.status).toBe(403);

    const blockedTicketCreate = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: "Client link should be blocked",
        description: "Clients are disabled",
        category: "Support",
        priority: "medium",
        clientId,
      }),
    });
    expect(blockedTicketCreate.status).toBe(403);

    const nullClientTicketCreate = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: "Ticket with null client",
        description: "A null client does not link a client.",
        category: "Support",
        priority: "medium",
        clientId: null,
      }),
    });
    expect(nullClientTicketCreate.status).toBe(201);
    expect(nullClientTicketCreate.body).not.toHaveProperty("clientId");
    createdTicketIds.push(nullClientTicketCreate.body.id);

    const unlinkedTicketCreate = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: "Ticket without client",
        description: "Ticket creation remains available",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(unlinkedTicketCreate.status).toBe(201);
    expect(unlinkedTicketCreate.body).not.toHaveProperty("clientId");
    const unlinkedTicketId = unlinkedTicketCreate.body.id as number;
    createdTicketIds.push(unlinkedTicketId);

    const blockedTicketLink = await request(`/api/tickets/${unlinkedTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ clientId }),
    });
    expect(blockedTicketLink.status).toBe(403);

    const blockedTicketUnlink = await request(`/api/tickets/${publicTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ clientId: null }),
    });
    expect(blockedTicketUnlink.status).toBe(403);

    const blockedWorkedTime = await request(`/api/tickets/${publicTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ workedMinutes: 120 }),
    });
    expect(blockedWorkedTime.status).toBe(403);
    const unchangedTicket = await db
      .select({ workedMinutes: ticketsTable.workedMinutes })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, publicTicketId))
      .limit(1);
    expect(unchangedTicket[0]?.workedMinutes).toBeNull();

    const enabledSettings = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({
        name: `Feature controls ${runId}`,
        clientsEnabled: true,
        workedTimeEnabled: true,
      }),
    });
    expect(enabledSettings.status).toBe(200);

    const enabledClone = await request(`/api/tickets/${publicTicketId}/clone`, adminSessionId, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(enabledClone.status).toBe(201);
    expect(enabledClone.body).toMatchObject({
      clientId,
      client: { id: clientId, name: "Worked Hours Client" },
    });
    createdTicketIds.push(enabledClone.body.id);
    const enabledCloneInDb = await db
      .select({ clientId: ticketsTable.clientId })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, enabledClone.body.id))
      .limit(1);
    expect(enabledCloneInDb[0]?.clientId).toBe(clientId);

    expect((await request("/api/clients", adminSessionId)).status).toBe(200);
    expect((await request(`/api/clients/${clientId}`, adminSessionId)).status).toBe(200);
    const enabledTicketList = await request("/api/tickets", adminSessionId);
    const enabledListedTicket = enabledTicketList.body.find((ticket: any) => ticket.id === publicTicketId);
    expect(enabledListedTicket).toMatchObject({
      clientId,
      client: { id: clientId, name: "Worked Hours Client" },
    });
    const enabledTicketDetail = await request(`/api/tickets/${publicTicketId}`, adminSessionId);
    expect(enabledTicketDetail.body).toMatchObject({
      clientId,
      client: { id: clientId, name: "Worked Hours Client" },
    });
    const enabledSearch = await request(
      `/api/search?q=${encodeURIComponent("Worked Hours Client")}`,
      adminSessionId,
    );
    expect(enabledSearch.body.clients).toContainEqual(expect.objectContaining({
      id: clientId,
      name: "Worked Hours Client",
      email: `worked-hours-client-${runId}@example.test`,
    }));
    for (const route of ticketSummaryRoutes) {
      const response = await request(route, adminSessionId);
      expect(response.status, route).toBe(200);
      const ticket = response.body.find((item: any) => item.id === publicTicketId);
      expect(ticket, route).toBeDefined();
      expect(ticket, route).toHaveProperty("clientId", clientId);
    }
    const enabledTicketCreate = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: "Ticket linked to client",
        description: "Client management is enabled",
        category: "Support",
        priority: "medium",
        clientId,
      }),
    });
    expect(enabledTicketCreate.status).toBe(201);
    expect(enabledTicketCreate.body.clientId).toBe(clientId);
    createdTicketIds.push(enabledTicketCreate.body.id);

    const enabledTicketLink = await request(`/api/tickets/${unlinkedTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ clientId }),
    });
    expect(enabledTicketLink.status).toBe(200);
    expect(enabledTicketLink.body.clientId).toBe(clientId);

    const enabledTicketUnlink = await request(`/api/tickets/${enabledTicketCreate.body.id}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ clientId: null }),
    });
    expect(enabledTicketUnlink.status).toBe(200);
    expect(enabledTicketUnlink.body.clientId).toBeNull();

    const allowedWorkedTime = await request(`/api/tickets/${publicTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ workedMinutes: 120 }),
    });
    expect(allowedWorkedTime.status).toBe(200);
    expect(allowedWorkedTime.body.workedMinutes).toBe(120);
  }, 120_000);

  it("soft-deletes an organization user without referencing a missing legacy column", async () => {
    const response = await request(`/api/users/${userId}`, adminSessionId, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, message: "Utente eliminato" });

    const [deletedUser] = await db
      .select({ name: usersTable.name, email: usersTable.email, isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    expect(deletedUser).toMatchObject({ name: "Utente eliminato", isActive: false });
    expect(deletedUser.email).toMatch(/^deleted-\d+-\d+@deleted\.local$/);

    const remainingSessions = await db
      .select({ sessionId: sessionsTable.sessionId })
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, userId));
    expect(remainingSessions).toHaveLength(0);
  });
});
