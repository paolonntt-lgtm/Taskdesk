import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientsTable,
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketStatusesTable,
  ticketsTable,
  ticketTimeSessionsTable,
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
let clientId: number;
let adminId: number;
let collaboratorId: number;
let raceCollaboratorId: number;
let adminSessionId: string;
let collaboratorSessionId: string;
let raceSessionId: string;
let trackedTicketIds: number[] = [];
let raceTicketIds: number[] = [];
let manualTicketId: number;
let privateTicketId: number;

async function request(path: string, sessionId: string, init: RequestInit = {}): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function changeStatus(ticketId: number, status: string, sessionId = collaboratorSessionId): Promise<HttpResult> {
  return request(`/api/tickets/${ticketId}`, sessionId, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

describe("ticket time tracking", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Timer test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable)
      .values({
        name: "Timer Test Admin",
        email: `timer-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [collaborator] = await db.insert(usersTable)
      .values({
        name: "Timer Test Collaborator",
        email: `timer-collaborator-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
        hourlyCompensated: true,
      })
      .returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    const [raceCollaborator] = await db.insert(usersTable)
      .values({
        name: "Timer Race Collaborator",
        email: `timer-race-collaborator-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    raceCollaboratorId = raceCollaborator.id;

    const [client] = await db.insert(clientsTable)
      .values({
        organizationId,
        name: "Timer Test Customer",
        slug: `timer-test-${runId}`,
      })
      .returning({ id: clientsTable.id });
    clientId = client.id;

    await db.insert(ticketStatusesTable).values([
      { organizationId, key: "in_progress", label: "In lavorazione", sortOrder: 0 },
      { organizationId, key: "waiting", label: "In attesa", sortOrder: 1 },
      { organizationId, key: "closed", label: "Chiuso", sortOrder: 2, isClosed: true },
    ]);

    const combinations = [
      { billable: true, override: false, title: "Billable only" },
      { billable: false, override: true, title: "Recognizable only" },
      { billable: true, override: true, title: "Both classifications" },
      { billable: false, override: false, title: "Neither classification" },
    ];
    const trackedTickets = await db.insert(ticketsTable).values(combinations.map((item) => ({
      organizationId,
      clientId,
      title: `${item.title} ${runId}`,
      description: "Timer behavior test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: collaboratorId,
      timeTrackingEnabled: true,
      timeTrackingBillable: item.billable,
      timeTrackingCompensationOverride: item.override,
    }))).returning({ id: ticketsTable.id });
    trackedTicketIds = trackedTickets.map((ticket) => ticket.id);

    const raceTickets = await db.insert(ticketsTable).values(["Concurrent timer A", "Concurrent timer B"].map((title) => ({
      organizationId,
      clientId,
      title: `${title} ${runId}`,
      description: "Concurrent timer race test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: raceCollaboratorId,
      timeTrackingEnabled: true,
    }))).returning({ id: ticketsTable.id });
    raceTicketIds = raceTickets.map((ticket) => ticket.id);

    const [manualTicket] = await db.insert(ticketsTable).values({
      organizationId,
      clientId,
      title: `Historical manual hours ${runId}`,
      description: "Manual time remains independent of timers",
      category: "Support",
      location: "Remote",
      status: "closed",
      visibility: "organization",
      createdBy: adminId,
      workedMinutes: 45,
      workedBillingStatus: "billed",
      closedAt: new Date(Date.now() - 60 * 60_000),
    }).returning({ id: ticketsTable.id });
    manualTicketId = manualTicket.id;

    const [privateTicket] = await db.insert(ticketsTable).values({
      organizationId,
      clientId,
      title: `Private tracked ticket ${runId}`,
      description: "Private ticket timer visibility test",
      category: "Support",
      location: "Remote",
      status: "closed",
      visibility: "admins",
      createdBy: adminId,
      assignedTo: collaboratorId,
      timeTrackingEnabled: true,
    }).returning({ id: ticketsTable.id });
    privateTicketId = privateTicket.id;
    await db.insert(ticketTimeSessionsTable).values({
      organizationId,
      ticketId: privateTicketId,
      userId: collaboratorId,
      startedAt: new Date(Date.now() - 60 * 60_000),
      endedAt: new Date(),
      clientBillable: false,
      collaboratorRecognizable: false,
    });

    adminSessionId = await createSession(adminId);
    collaboratorSessionId = await createSession(collaboratorId);
    raceSessionId = await createSession(raceCollaboratorId);
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
    const ticketIds = [...trackedTicketIds, ...raceTicketIds, manualTicketId, privateTicketId].filter(Number.isInteger);
    if (ticketIds.length) await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    const sessionIds = [adminSessionId, collaboratorSessionId, raceSessionId].filter(Boolean);
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    const userIds = [adminId, collaboratorId, raceCollaboratorId].filter(Number.isInteger);
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationId) {
      await db.delete(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, organizationId));
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    }
    await pool.end();
  });

  it("gates timers, atomically serializes sessions, keeps classifications independent, and preserves report history", async () => {
    const defaultSettings = await request("/api/settings/organization", adminSessionId);
    expect(defaultSettings.status).toBe(200);
    expect(defaultSettings.body.timeTrackingModuleEnabled).toBe(false);

    const disabledReport = await request("/api/time-tracking/report", adminSessionId);
    expect(disabledReport.status).toBe(403);
    const disabledClassification = await request(`/api/tickets/${trackedTicketIds[0]}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ timeTrackingBillable: false }),
    });
    expect(disabledClassification.status).toBe(403);
    const disabledCompensationProfile = await request(`/api/users/${collaboratorId}`, adminSessionId);
    expect(disabledCompensationProfile.status).toBe(200);
    expect(disabledCompensationProfile.body).not.toHaveProperty("hourlyCompensated");
    const disabledCompensationUpdate = await request(`/api/users/${collaboratorId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ hourlyCompensated: false }),
    });
    expect(disabledCompensationUpdate.status).toBe(403);

    const enabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: true }),
    });
    expect(enabled.status).toBe(200);
    expect(enabled.body.timeTrackingModuleEnabled).toBe(true);
    const enabledCompensationUpdate = await request(`/api/users/${collaboratorId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ hourlyCompensated: true }),
    });
    expect(enabledCompensationUpdate.status).toBe(200);
    expect(enabledCompensationUpdate.body.hourlyCompensated).toBe(true);

    const concurrentResults = await Promise.all(
      raceTicketIds.map((ticketId) => changeStatus(ticketId, "in_progress", raceSessionId)),
    );
    expect(concurrentResults.map((result) => result.status).sort()).toEqual([200, 409]);
    const winnerIndex = concurrentResults.findIndex((result) => result.status === 200);
    const loserIndex = concurrentResults.findIndex((result) => result.status === 409);
    const winnerTicketId = raceTicketIds[winnerIndex];
    expect(concurrentResults[loserIndex]?.body.error).toBe("TIMER_ALREADY_ACTIVE");
    expect(concurrentResults[loserIndex]?.body.activeTicket.id).toBe(winnerTicketId);
    const raceTicketStates = await db.select({ id: ticketsTable.id, status: ticketsTable.status })
      .from(ticketsTable).where(inArray(ticketsTable.id, raceTicketIds));
    expect(raceTicketStates.find((ticket) => ticket.id === winnerTicketId)?.status).toBe("in_progress");
    expect(raceTicketStates.find((ticket) => ticket.id === raceTicketIds[loserIndex])?.status).toBe("waiting");
    const raceSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.userId, raceCollaboratorId));
    const activeRaceSessions = raceSessions.filter((session) => session.endedAt === null);
    expect(activeRaceSessions).toHaveLength(1);
    expect(activeRaceSessions[0]?.ticketId).toBe(winnerTicketId);
    expect((await changeStatus(winnerTicketId, "waiting", raceSessionId)).status).toBe(200);

    const [billableOnlyId, recognizableOnlyId, bothId, neitherId] = trackedTicketIds;
    const startFirst = await changeStatus(billableOnlyId, "in_progress");
    expect(startFirst.status).toBe(200);
    let sessions = await db.select().from(ticketTimeSessionsTable).where(eq(ticketTimeSessionsTable.ticketId, billableOnlyId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ clientBillable: true, collaboratorRecognizable: false, endedAt: null });

    const secondWhileBusy = await changeStatus(recognizableOnlyId, "in_progress");
    expect(secondWhileBusy.status).toBe(409);
    expect(secondWhileBusy.body.error).toBe("TIMER_ALREADY_ACTIVE");
    expect(secondWhileBusy.body.activeTicket.id).toBe(billableOnlyId);
    const unchangedSecond = await db.select({ status: ticketsTable.status }).from(ticketsTable)
      .where(eq(ticketsTable.id, recognizableOnlyId));
    expect(unchangedSecond[0]?.status).toBe("waiting");

    expect((await changeStatus(billableOnlyId, "waiting")).status).toBe(200);
    expect((await changeStatus(recognizableOnlyId, "in_progress")).status).toBe(200);
    sessions = await db.select().from(ticketTimeSessionsTable).where(eq(ticketTimeSessionsTable.ticketId, recognizableOnlyId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ clientBillable: false, collaboratorRecognizable: true, endedAt: null });
    expect((await changeStatus(recognizableOnlyId, "waiting")).status).toBe(200);

    for (const ticketId of [bothId, neitherId]) {
      expect((await changeStatus(ticketId, "in_progress")).status).toBe(200);
      expect((await changeStatus(ticketId, "waiting")).status).toBe(200);
    }
    expect((await changeStatus(neitherId, "closed")).status).toBe(200);
    const reopened = await changeStatus(neitherId, "in_progress");
    expect(reopened.status).toBe(200);
    expect(reopened.body.status).toBe("waiting");
    sessions = await db.select().from(ticketTimeSessionsTable).where(eq(ticketTimeSessionsTable.ticketId, neitherId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.endedAt).not.toBeNull();

    for (const ticketId of trackedTicketIds) {
      await db.update(ticketTimeSessionsTable)
        .set({ startedAt: new Date(Date.now() - 120 * 60_000) })
        .where(eq(ticketTimeSessionsTable.ticketId, ticketId));
    }
    await db.update(ticketsTable).set({ workedBillingStatus: "billed" })
      .where(eq(ticketsTable.id, bothId));

    const dateFrom = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    const dateTo = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const filteredReport = await request(
      `/api/time-tracking/report?dateFrom=${dateFrom}&dateTo=${dateTo}&clientId=${clientId}&collaboratorId=${collaboratorId}`,
      adminSessionId,
    );
    expect(filteredReport.status).toBe(200);
    expect(filteredReport.body.customerRows).toHaveLength(3);
    expect(filteredReport.body.customerRows.map((row: any) => row.kind).sort()).toEqual(["manual", "session", "session"]);
    expect(filteredReport.body.collaboratorRows.map((row: any) => row.ticketId).sort()).toEqual([recognizableOnlyId, bothId].sort());
    expect(filteredReport.body.totals).toMatchObject({
      clientBillableMinutes: 283,
      clientUnbilledMinutes: 119,
      clientBilledMinutes: 164,
      collaboratorRecognizableMinutes: 238,
    });

    const userReport = await request("/api/time-tracking/report", collaboratorSessionId);
    expect(userReport.status).toBe(403);
    const hiddenPrivateTicket = await request(`/api/tickets/${privateTicketId}`, collaboratorSessionId);
    expect(hiddenPrivateTicket.status).toBe(404);
    const visiblePrivateTicket = await request(`/api/tickets/${privateTicketId}`, adminSessionId);
    expect(visiblePrivateTicket.status).toBe(200);
    expect(visiblePrivateTicket.body.timeSessions).toHaveLength(1);

    const backup = await buildBackupPayload(organizationId);
    expect(backup?.summary.timeSessions).toBe(6);
    expect(backup?.data.users.find((user) => user.id === collaboratorId)?.hourlyCompensated).toBe(true);
    expect(backup?.data.tickets.find((ticket) => ticket.id === bothId)?.timeTrackingBillable).toBe(true);
    expect(backup?.data.timeSessions).toContainEqual(expect.objectContaining({
      ticketId: recognizableOnlyId,
      clientBillable: false,
      collaboratorRecognizable: true,
    }));

    expect((await changeStatus(neitherId, "in_progress")).status).toBe(200);
    const disabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: false }),
    });
    expect(disabled.status).toBe(200);
    expect((await db.select({ hourlyCompensated: usersTable.hourlyCompensated }).from(usersTable)
      .where(eq(usersTable.id, collaboratorId)))[0]?.hourlyCompensated).toBe(true);
    const disabledAgainProfile = await request(`/api/users/${collaboratorId}`, adminSessionId);
    expect(disabledAgainProfile.body).not.toHaveProperty("hourlyCompensated");
    expect((await request("/api/time-tracking/report", adminSessionId)).status).toBe(403);
    const preservedSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.organizationId, organizationId));
    expect(preservedSessions).toHaveLength(7);
    expect(preservedSessions.every((session) => session.endedAt !== null)).toBe(true);
    const disabledTicket = await db.select({ status: ticketsTable.status }).from(ticketsTable)
      .where(eq(ticketsTable.id, neitherId));
    expect(disabledTicket[0]?.status).toBe("waiting");
    const manualHistory = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(manualHistory.body.tickets.find((ticket: any) => ticket.id === manualTicketId)?.workedMinutes).toBe(45);
  }, 60_000);
});
