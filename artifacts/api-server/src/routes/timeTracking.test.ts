import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientsTable,
  db,
  groupMembersTable,
  groupsTable,
  organizationsTable,
  pool,
  sessionsTable,
  ticketStatusesTable,
  ticketTimeSessionEditsTable,
  ticketsTable,
  ticketTimeSessionsTable,
  usersTable,
  notificationsTable,
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
let groupStatusManagerId: number;
let statusGroupId: number;
let adminSessionId: string;
let collaboratorSessionId: string;
let raceSessionId: string;
let groupStatusManagerSessionId: string;
let trackedTicketIds: number[] = [];
let raceTicketIds: number[] = [];
let parallelTicketIds: number[] = [];
let groupManagerParallelTicketIds: number[] = [];
let manualTicketId: number;
let privateTicketId: number;
let handoffTicketId: number;
let backupHandoffTicketId: number;
let unassignedRecognizableTicketId: number;
let createdUntrackedTicketId: number;

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

    const [groupStatusManager] = await db.insert(usersTable)
      .values({
        name: "Timer Group Status Manager",
        email: `timer-group-manager-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    groupStatusManagerId = groupStatusManager.id;

    const [statusGroup] = await db.insert(groupsTable)
      .values({
        name: `Timer status managers ${runId}`,
        organizationId,
        permissions: JSON.stringify(["change_status"]),
      })
      .returning({ id: groupsTable.id });
    statusGroupId = statusGroup.id;
    await db.insert(groupMembersTable).values({ groupId: statusGroupId, userId: groupStatusManagerId });

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

    const [handoffTicket] = await db.insert(ticketsTable).values({
      organizationId,
      clientId,
      title: `Active timer handoff ${runId}`,
      description: "Timer ownership handoff test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: collaboratorId,
      timeTrackingEnabled: true,
      timeTrackingCompensationOverride: true,
    }).returning({ id: ticketsTable.id });
    handoffTicketId = handoffTicket.id;

    const [backupHandoffTicket] = await db.insert(ticketsTable).values({
      organizationId,
      clientId,
      title: `Backup handoff history ${runId}`,
      description: "Backup and restore timer handoff history test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: collaboratorId,
      timeTrackingEnabled: true,
      timeTrackingBillable: true,
    }).returning({ id: ticketsTable.id });
    backupHandoffTicketId = backupHandoffTicket.id;

    const [unassignedRecognizableTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Unassigned recognizable hours ${runId}`,
      description: "Recognizable tracked hours require an individual assignee",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      timeTrackingEnabled: true,
      timeTrackingCompensationOverride: null,
    }).returning({ id: ticketsTable.id });
    unassignedRecognizableTicketId = unassignedRecognizableTicket.id;

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

    const parallelTickets = await db.insert(ticketsTable).values([
      { title: "Admin-started parallel timer A", assignedTo: collaboratorId },
      { title: "Admin-started parallel timer B", assignedTo: raceCollaboratorId },
    ].map((ticket) => ({
      organizationId,
      clientId,
      title: `${ticket.title} ${runId}`,
      description: "Admin-started parallel timer test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: ticket.assignedTo,
      timeTrackingEnabled: true,
    }))).returning({ id: ticketsTable.id });
    parallelTicketIds = parallelTickets.map((ticket) => ticket.id);

    const groupManagerParallelTickets = await db.insert(ticketsTable).values([
      { title: "Group-manager-started parallel timer A", assignedTo: collaboratorId },
      { title: "Group-manager-started parallel timer B", assignedTo: raceCollaboratorId },
    ].map((ticket) => ({
      organizationId,
      clientId,
      title: `${ticket.title} ${runId}`,
      description: "Group-manager-started parallel timer test",
      category: "Support",
      location: "Remote",
      status: "waiting",
      visibility: "organization",
      createdBy: adminId,
      assignedTo: ticket.assignedTo,
      timeTrackingEnabled: true,
    }))).returning({ id: ticketsTable.id });
    groupManagerParallelTicketIds = groupManagerParallelTickets.map((ticket) => ticket.id);

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
    groupStatusManagerSessionId = await createSession(groupStatusManagerId);
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
    const ticketIds = [
      ...trackedTicketIds,
      ...raceTicketIds,
      ...parallelTicketIds,
      ...groupManagerParallelTicketIds,
      manualTicketId,
      privateTicketId,
      handoffTicketId,
      backupHandoffTicketId,
      unassignedRecognizableTicketId,
      createdUntrackedTicketId,
    ].filter(Number.isInteger);
    if (ticketIds.length) await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    if (statusGroupId) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, statusGroupId));
      await db.delete(groupsTable).where(eq(groupsTable.id, statusGroupId));
    }
    const sessionIds = [adminSessionId, collaboratorSessionId, raceSessionId, groupStatusManagerSessionId].filter(Boolean);
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    const userIds = [adminId, collaboratorId, raceCollaboratorId, groupStatusManagerId].filter(Number.isInteger);
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
    const disabledPersonalReport = await request("/api/time-tracking/my-report", collaboratorSessionId);
    expect(disabledPersonalReport.status).toBe(403);
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
    const billableWithoutClient = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Billable without client ${runId}`,
        description: "Must be rejected",
        category: "Support",
        priority: "medium",
        timeTrackingEnabled: true,
        timeTrackingBillable: true,
      }),
    });
    expect(billableWithoutClient.status).toBe(400);
    expect(billableWithoutClient.body.error).toBe("Client-billable tracked tickets require a client");

    const recognizableWithoutAssignee = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Recognizable without assignee ${runId}`,
        description: "Must be rejected",
        category: "Support",
        priority: "medium",
        timeTrackingEnabled: true,
        timeTrackingCompensationOverride: true,
      }),
    });
    expect(recognizableWithoutAssignee.status).toBe(400);
    expect(recognizableWithoutAssignee.body.error).toBe("Collaborator-recognizable tracked tickets require an individual assignee");

    const untrackedCreated = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Initially untracked ${runId}`,
        description: "Can be activated later from ticket detail",
        category: "Support",
        priority: "medium",
        assignedTo: collaboratorId,
      }),
    });
    expect(untrackedCreated.status).toBe(201);
    createdUntrackedTicketId = untrackedCreated.body.id;
    const moveUntrackedToProgress = await request(`/api/tickets/${createdUntrackedTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    });
    expect(moveUntrackedToProgress.status).toBe(200);
    const activateTracking = await request(`/api/tickets/${createdUntrackedTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ timeTrackingBillable: false, timeTrackingCompensationOverride: true }),
    });
    expect(activateTracking.status).toBe(200);
    expect(activateTracking.body).toMatchObject({
      timeTrackingEnabled: true,
      timeTrackingBillable: false,
      timeTrackingCompensationOverride: true,
    });
    const activatedDetail = await request(`/api/tickets/${createdUntrackedTicketId}`, adminSessionId);
    expect(activatedDetail.body.timeSessions).toHaveLength(1);
    expect(activatedDetail.body.timeSessions[0]).toMatchObject({
      userId: collaboratorId,
      clientBillable: false,
      collaboratorRecognizable: true,
      endedAt: null,
    });
    expect((await changeStatus(createdUntrackedTicketId, "waiting", adminSessionId)).status).toBe(200);
    const turnOffFutureRecognition = await request(`/api/tickets/${createdUntrackedTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ timeTrackingCompensationOverride: false }),
    });
    expect(turnOffFutureRecognition.status).toBe(200);
    const afterClassificationChange = await request(`/api/tickets/${createdUntrackedTicketId}`, adminSessionId);
    expect(afterClassificationChange.body.timeTrackingCompensationOverride).toBe(false);
    expect(afterClassificationChange.body.timeSessions[0].collaboratorRecognizable).toBe(true);

    await db.update(usersTable).set({ hourlyCompensated: true }).where(eq(usersTable.id, adminId));
    const recognizableWithoutAssigneeStart = await changeStatus(unassignedRecognizableTicketId, "in_progress", adminSessionId);
    await db.update(usersTable).set({ hourlyCompensated: false }).where(eq(usersTable.id, adminId));
    expect(recognizableWithoutAssigneeStart.status).toBe(400);
    expect(recognizableWithoutAssigneeStart.body.error).toBe("Collaborator-recognizable tracked tickets require an individual assignee");
    expect((await db.select({ status: ticketsTable.status }).from(ticketsTable)
      .where(eq(ticketsTable.id, unassignedRecognizableTicketId)))[0]?.status).toBe("waiting");

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
    const markBilled = await request("/api/time-tracking/client-billing-status", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ ticketId: bothId, status: "billed" }),
    });
    expect(markBilled.status).toBe(204);

    const dateFrom = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    const dateTo = new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const filteredReport = await request(
      `/api/time-tracking/report?dateFrom=${dateFrom}&dateTo=${dateTo}&clientId=${clientId}&collaboratorId=${collaboratorId}`,
      adminSessionId,
    );
    expect(filteredReport.status).toBe(200);
    expect(filteredReport.body.customerRows).toHaveLength(3);
    expect(filteredReport.body.customerRows.map((row: any) => row.kind).sort()).toEqual(["manual", "session", "session"]);
    expect(filteredReport.body.customerRows.find((row: any) => row.ticketId === bothId)?.billingStatus).toBe("billed");
    expect(filteredReport.body.collaboratorRows.map((row: any) => row.ticketId).sort()).toEqual([recognizableOnlyId, bothId].sort());
    expect(filteredReport.body.totals).toMatchObject({
      clientBillableMinutes: 283,
      clientUnbilledMinutes: 119,
      clientBilledMinutes: 164,
      collaboratorRecognizableMinutes: 238,
    });

    const userReport = await request("/api/time-tracking/report", collaboratorSessionId);
    expect(userReport.status).toBe(403);
    const personalReport = await request(
      `/api/time-tracking/my-report?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      collaboratorSessionId,
    );
    expect(personalReport.status).toBe(200);
    expect(personalReport.body.rows.map((row: any) => row.ticketId).sort()).toEqual([recognizableOnlyId, bothId, createdUntrackedTicketId].sort());
    expect(personalReport.body.totals).toEqual({ totalMinutes: 238, ticketCount: 3 });
    expect(personalReport.body.rows.every((row: any) => !("collaboratorId" in row) && !("billingStatus" in row))).toBe(true);
    const noHoursPersonalReport = await request("/api/time-tracking/my-report", raceSessionId);
    expect(noHoursPersonalReport.status).toBe(404);
    expect((await request("/api/time-tracking/my-report", adminSessionId)).status).toBe(403);
    const hiddenPrivateTicket = await request(`/api/tickets/${privateTicketId}`, collaboratorSessionId);
    expect(hiddenPrivateTicket.status).toBe(404);
    const visiblePrivateTicket = await request(`/api/tickets/${privateTicketId}`, adminSessionId);
    expect(visiblePrivateTicket.status).toBe(200);
    expect(visiblePrivateTicket.body.timeSessions).toHaveLength(1);

    const backup = await buildBackupPayload(organizationId);
    expect(backup?.summary.timeSessions).toBe(7);
    expect(backup?.data.users.find((user) => user.id === collaboratorId)?.hourlyCompensated).toBe(true);
    expect(backup?.data.tickets.find((ticket) => ticket.id === bothId)?.timeTrackingBillable).toBe(true);
    expect(backup?.data.timeSessions).toContainEqual(expect.objectContaining({
      ticketId: recognizableOnlyId,
      clientBillable: false,
      collaboratorRecognizable: true,
    }));

    await db.insert(ticketTimeSessionsTable).values({
      organizationId,
      ticketId: raceTicketIds[0]!,
      userId: raceCollaboratorId,
      startedAt: new Date(Date.now() - 30 * 60_000),
      endedAt: new Date(Date.now() - 10 * 60_000),
      clientBillable: false,
      collaboratorRecognizable: true,
    });
    const otherCollaboratorReport = await request("/api/time-tracking/my-report", raceSessionId);
    expect(otherCollaboratorReport.status).toBe(200);
    expect(otherCollaboratorReport.body.rows.map((row: any) => row.ticketId)).toEqual([raceTicketIds[0]]);
    const stillPrivatePersonalReport = await request("/api/time-tracking/my-report", collaboratorSessionId);
    expect(stillPrivatePersonalReport.body.rows.map((row: any) => row.ticketId)).not.toContain(raceTicketIds[0]);

    const parallelStarts = await Promise.all(
      parallelTicketIds.map((ticketId) => changeStatus(ticketId, "in_progress", adminSessionId)),
    );
    expect(parallelStarts.map((result) => result.status)).toEqual([200, 200]);
    const parallelStates = await db.select({ id: ticketsTable.id, status: ticketsTable.status })
      .from(ticketsTable).where(inArray(ticketsTable.id, parallelTicketIds));
    expect(parallelStates).toHaveLength(2);
    expect(parallelStates.every((ticket) => ticket.status === "in_progress")).toBe(true);
    const parallelSessions = await db.select({
      ticketId: ticketTimeSessionsTable.ticketId,
      userId: ticketTimeSessionsTable.userId,
      endedAt: ticketTimeSessionsTable.endedAt,
    }).from(ticketTimeSessionsTable).where(inArray(ticketTimeSessionsTable.ticketId, parallelTicketIds));
    expect(parallelSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ ticketId: parallelTicketIds[0], userId: collaboratorId, endedAt: null }),
      expect.objectContaining({ ticketId: parallelTicketIds[1], userId: raceCollaboratorId, endedAt: null }),
    ]));
    const parallelStops = await Promise.all(
      parallelTicketIds.map((ticketId) => changeStatus(ticketId, "waiting", adminSessionId)),
    );
    expect(parallelStops.map((result) => result.status)).toEqual([200, 200]);

    const groupManagerParallelStarts = await Promise.all(
      groupManagerParallelTicketIds.map((ticketId) =>
        changeStatus(ticketId, "in_progress", groupStatusManagerSessionId),
      ),
    );
    expect(groupManagerParallelStarts.map((result) => result.status)).toEqual([403, 403]);
    const groupManagerParallelStates = await db.select({
      id: ticketsTable.id,
      status: ticketsTable.status,
    }).from(ticketsTable).where(inArray(ticketsTable.id, groupManagerParallelTicketIds));
    expect(groupManagerParallelStates).toHaveLength(2);
    expect(groupManagerParallelStates.every((ticket) => ticket.status === "waiting")).toBe(true);
    const groupManagerParallelSessions = await db.select({
      ticketId: ticketTimeSessionsTable.ticketId,
      userId: ticketTimeSessionsTable.userId,
      endedAt: ticketTimeSessionsTable.endedAt,
    }).from(ticketTimeSessionsTable).where(inArray(
      ticketTimeSessionsTable.ticketId,
      groupManagerParallelTicketIds,
    ));
    expect(groupManagerParallelSessions).toEqual([]);
    const groupManagerParallelStops = await Promise.all(
      groupManagerParallelTicketIds.map((ticketId) =>
        changeStatus(ticketId, "waiting", groupStatusManagerSessionId),
      ),
    );
    expect(groupManagerParallelStops.map((result) => result.status)).toEqual([200, 200]);

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
    expect(preservedSessions).toHaveLength(11);
    expect(preservedSessions.every((session) => session.endedAt !== null)).toBe(true);
    const disabledTicket = await db.select({ status: ticketsTable.status }).from(ticketsTable)
      .where(eq(ticketsTable.id, neitherId));
    expect(disabledTicket[0]?.status).toBe("waiting");
    const manualHistory = await request(`/api/clients/${clientId}`, adminSessionId);
    expect(manualHistory.body.tickets.find((ticket: any) => ticket.id === manualTicketId)?.workedMinutes).toBe(45);
  }, 120_000);

  it("pauses an active tracked ticket on reassignment and preserves each collaborator's session", async () => {
    await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: true }),
    });

    expect((await changeStatus(handoffTicketId, "in_progress", adminSessionId)).status).toBe(200);
    const originalSession = (await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId)))
      .find((session) => session.endedAt === null);
    expect(originalSession?.userId).toBe(collaboratorId);

    const reassignment = await request(`/api/tickets/${handoffTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: raceCollaboratorId }),
    });
    expect(reassignment.status).toBe(200);
    expect(reassignment.body).toMatchObject({ assignedTo: raceCollaboratorId, status: "waiting" });
    const pausedSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(pausedSessions).toHaveLength(1);
    expect(pausedSessions[0]).toMatchObject({ userId: collaboratorId });
    expect(pausedSessions[0]?.endedAt).toBeInstanceOf(Date);

    expect((await changeStatus(handoffTicketId, "in_progress", raceSessionId)).status).toBe(200);
    const resumedSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(resumedSessions).toHaveLength(2);
    expect(resumedSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: collaboratorId, endedAt: expect.any(Date) }),
      expect.objectContaining({ userId: raceCollaboratorId, endedAt: null }),
    ]));
    expect((await changeStatus(handoffTicketId, "waiting", groupStatusManagerSessionId)).status).toBe(403);
    expect((await changeStatus(handoffTicketId, "waiting", adminSessionId)).status).toBe(200);
    await db.update(ticketsTable).set({ workedMinutes: 30 }).where(eq(ticketsTable.id, handoffTicketId));

    const nonParticipantDetail = await request(`/api/tickets/${handoffTicketId}`, groupStatusManagerSessionId);
    expect(nonParticipantDetail.body.canViewTimeTrackingSummary).toBe(false);
    expect(nonParticipantDetail.body).not.toHaveProperty("timeSessions");
    expect(nonParticipantDetail.body).not.toHaveProperty("timeTrackingBillable");
    expect(nonParticipantDetail.body).not.toHaveProperty("timeTrackingCompensationOverride");
    expect(nonParticipantDetail.body).not.toHaveProperty("workedMinutes");
    const participantDetail = await request(`/api/tickets/${handoffTicketId}`, collaboratorSessionId);
    expect(participantDetail.body.canViewTimeTrackingSummary).toBe(true);
    expect(participantDetail.body.timeSessions.every((session: any) => session.userId === collaboratorId)).toBe(true);
    expect(participantDetail.body.timeSessions[0]).not.toHaveProperty("clientBillable");
    expect(participantDetail.body.timeSessions[0]).not.toHaveProperty("collaboratorRecognizable");
    expect(participantDetail.body.timeTrackingSummary).not.toHaveProperty("clientBillableMinutes");
    expect(participantDetail.body.timeTrackingSummary).not.toHaveProperty("collaboratorRecognizableMinutes");
    expect(participantDetail.body).not.toHaveProperty("timeTrackingBillable");
    expect(participantDetail.body).not.toHaveProperty("timeTrackingCompensationOverride");
    expect(participantDetail.body.workedMinutes).toBeNull();
    const adminDetail = await request(`/api/tickets/${handoffTicketId}`, adminSessionId);
    expect(adminDetail.body.canViewTimeTrackingSummary).toBe(true);
    expect(adminDetail.body.timeSessions).toHaveLength(2);
    expect(adminDetail.body.timeSessions[0]).toHaveProperty("clientBillable");
    expect(adminDetail.body.timeSessions[0]).toHaveProperty("collaboratorRecognizable");
    expect(adminDetail.body.timeTrackingSummary).toHaveProperty("clientBillableMinutes");
    expect(adminDetail.body.workedMinutes).toBe(30);
    const collaboratorTicketList = await request("/api/tickets", collaboratorSessionId);
    const listedTrackedTicket = collaboratorTicketList.body.find((item: any) => item.id === handoffTicketId);
    expect(listedTrackedTicket).not.toHaveProperty("timeTrackingBillable");
    expect(listedTrackedTicket).not.toHaveProperty("timeTrackingCompensationOverride");

    expect((await changeStatus(handoffTicketId, "closed", adminSessionId)).status).toBe(200);
    const beforeEdit = resumedSessions.find((session) => session.userId === collaboratorId)!;
    const initialPreferences = await request("/api/notification-preferences", collaboratorSessionId);
    expect(initialPreferences.status).toBe(200);
    expect(initialPreferences.body.preferences).toContainEqual(expect.objectContaining({
      type: "time_session_corrected",
      inApp: true,
      browser: true,
      sound: true,
      email: false,
    }));
    const saveCorrectionPreference = await request("/api/notification-preferences", collaboratorSessionId, {
      method: "PUT",
      body: JSON.stringify({
        preferences: [{
          type: "time_session_corrected",
          inApp: true,
          browser: false,
          sound: false,
          email: false,
        }],
      }),
    });
    expect(saveCorrectionPreference.status).toBe(200);
    const savedPreferences = await request("/api/notification-preferences", collaboratorSessionId);
    expect(savedPreferences.body.preferences).toContainEqual(expect.objectContaining({
      type: "time_session_corrected",
      inApp: true,
      browser: false,
      sound: false,
      email: false,
    }));
    expect(savedPreferences.body.preferences).toContainEqual(expect.objectContaining({
      type: "system",
      inApp: true,
      browser: true,
      sound: true,
      email: false,
    }));
    const sessionEdit = await request(`/api/tickets/${handoffTicketId}/time-sessions/${beforeEdit.id}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({
        durationMinutes: 42,
        clientBillable: false,
        collaboratorRecognizable: false,
      }),
    });
    expect(sessionEdit.status).toBe(204);
    const savedEdit = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.id, beforeEdit.id));
    expect(Math.floor((savedEdit[0]!.endedAt!.getTime() - savedEdit[0]!.startedAt.getTime()) / 60_000)).toBe(42);
    expect(savedEdit[0]).toMatchObject({ clientBillable: false, collaboratorRecognizable: false });
    const auditRows = await db.select().from(ticketTimeSessionEditsTable)
      .where(eq(ticketTimeSessionEditsTable.sessionId, beforeEdit.id));
    expect(auditRows).toHaveLength(1);
    const editHistory = await request(`/api/tickets/${handoffTicketId}/time-session-edits`, adminSessionId);
    expect(editHistory.status).toBe(200);
    expect(editHistory.body).toHaveLength(1);
    expect(editHistory.body[0]).toMatchObject({
      sessionId: beforeEdit.id,
      collaboratorName: "Timer Test Collaborator",
      editedByName: "Timer Test Admin",
      previousDurationMinutes: auditRows[0]!.previousDurationMinutes,
      updatedDurationMinutes: 42,
      previousClientBillable: auditRows[0]!.previousClientBillable,
      updatedClientBillable: false,
      previousCollaboratorRecognizable: auditRows[0]!.previousCollaboratorRecognizable,
      updatedCollaboratorRecognizable: false,
    });
    expect(Number.isNaN(Date.parse(editHistory.body[0].editedAt))).toBe(false);
    const forbiddenHistory = await request(`/api/tickets/${handoffTicketId}/time-session-edits`, collaboratorSessionId);
    expect(forbiddenHistory.status).toBe(403);
    const editNotifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, collaboratorId));
    expect(editNotifications.some((notification) =>
      notification.ticketId === handoffTicketId
      && notification.type === "time_session_corrected"
      && notification.notificationText.includes("aggiornato le tue ore")
    )).toBe(true);
    const forbiddenEdit = await request(`/api/tickets/${handoffTicketId}/time-sessions/${beforeEdit.id}`, collaboratorSessionId, {
      method: "PATCH",
      body: JSON.stringify({ durationMinutes: 60, clientBillable: true, collaboratorRecognizable: true }),
    });
    expect(forbiddenEdit.status).toBe(403);
  }, 60_000);

  it.skip("legacy active-timer handoff behavior", async () => {
    const enabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: true }),
    });
    expect(enabled.status).toBe(200);

    const busyTicketId = raceTicketIds[0];
    expect((await changeStatus(busyTicketId, "in_progress", adminSessionId)).status).toBe(200);
    expect((await changeStatus(handoffTicketId, "in_progress", adminSessionId)).status).toBe(200);

    const colleagueSessionBefore = (await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId)))
      .find((session) => session.endedAt === null);
    expect(colleagueSessionBefore).toMatchObject({ userId: collaboratorId, endedAt: null });
    const coworkerUnassignAttempt = await request(`/api/tickets/${handoffTicketId}`, groupStatusManagerSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: null }),
    });
    expect(coworkerUnassignAttempt.status).toBe(403);
    const coworkerTransferAttempt = await request(`/api/tickets/${handoffTicketId}`, groupStatusManagerSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: raceCollaboratorId }),
    });
    expect(coworkerTransferAttempt.status).toBe(403);
    await db.update(groupsTable)
      .set({ permissions: JSON.stringify(["change_status", "assign_time_tracked_tickets"]) })
      .where(eq(groupsTable.id, statusGroupId));
    const assignmentPermissionTransfer = await request(`/api/tickets/${trackedTicketIds[0]}`, groupStatusManagerSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: raceCollaboratorId }),
    });
    expect(assignmentPermissionTransfer.status).toBe(200);
    expect(assignmentPermissionTransfer.body.assignedTo).toBe(raceCollaboratorId);
    expect((await changeStatus(trackedTicketIds[0], "in_progress", groupStatusManagerSessionId)).status).toBe(403);
    await db.update(groupsTable)
      .set({ permissions: JSON.stringify(["change_status"]) })
      .where(eq(groupsTable.id, statusGroupId));
    let ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    expect(ticketState[0]).toMatchObject({ assignedTo: collaboratorId, status: "in_progress" });
    let sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: colleagueSessionBefore!.id,
      userId: collaboratorId,
      startedAt: colleagueSessionBefore!.startedAt,
      endedAt: null,
    });
    expect(sessions).toHaveLength(1);
    const coworkerTimerStartedAt = colleagueSessionBefore!.startedAt;

    const handedOff = await request(`/api/tickets/${handoffTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: raceCollaboratorId }),
    });
    expect(handedOff.status).toBe(200);
    expect(handedOff.body.assignedTo).toBe(raceCollaboratorId);

    ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    expect(ticketState[0]).toMatchObject({ assignedTo: raceCollaboratorId, status: "waiting" });
    sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      userId: collaboratorId,
      startedAt: coworkerTimerStartedAt,
    });
    expect(sessions[0]?.endedAt).toBeInstanceOf(Date);

    expect((await changeStatus(busyTicketId, "waiting", adminSessionId)).status).toBe(200);
    expect((await changeStatus(handoffTicketId, "in_progress", raceSessionId)).status).toBe(200);
    ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    expect(ticketState[0]).toMatchObject({ assignedTo: raceCollaboratorId, status: "in_progress" });
    sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(sessions).toHaveLength(2);
    expect(sessions.find((session) => session.userId === collaboratorId)?.endedAt).not.toBeNull();
    expect(sessions.find((session) => session.userId === raceCollaboratorId)?.endedAt).toBeNull();

    const activeRaceSessions = await db.select({
      ticketId: ticketTimeSessionsTable.ticketId,
      endedAt: ticketTimeSessionsTable.endedAt,
    }).from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.userId, raceCollaboratorId));
    expect(activeRaceSessions.filter((session) => session.endedAt === null)).toEqual([
      expect.objectContaining({ ticketId: handoffTicketId, endedAt: null }),
    ]);

    const simultaneousHandoffs = await Promise.all([collaboratorId, groupStatusManagerId].map((assignedTo) =>
      request(`/api/tickets/${handoffTicketId}`, adminSessionId, {
        method: "PATCH",
        body: JSON.stringify({ assignedTo }),
      }),
    ));
    expect(simultaneousHandoffs.map((result) => result.status)).toEqual([200, 200]);
    ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    const activeHandoffSessions = sessions.filter((session) => session.endedAt === null);
    expect(ticketState[0]?.status).toBe("in_progress");
    expect(activeHandoffSessions).toHaveLength(1);
    expect(activeHandoffSessions[0]?.userId).toBe(ticketState[0]?.assignedTo);

    const activeSession = activeHandoffSessions[0]!;
    const reportableSessionStart = new Date(Date.now() - 30 * 60_000);
    await db.update(ticketTimeSessionsTable)
      .set({ startedAt: reportableSessionStart })
      .where(eq(ticketTimeSessionsTable.id, activeSession.id));
    sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    const sessionsBeforeUnassign = sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    }));
    const unassigned = await request(`/api/tickets/${handoffTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: null }),
    });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.assignedTo).toBeNull();
    ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    expect(ticketState[0]).toMatchObject({ assignedTo: null, status: "in_progress" });
    sessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(sessions).toHaveLength(sessionsBeforeUnassign.length);
    for (const previous of sessionsBeforeUnassign) {
      const preserved = sessions.find((session) => session.id === previous.id);
      expect(preserved).toMatchObject({
        userId: previous.userId,
        startedAt: previous.startedAt,
      });
      if (previous.endedAt !== null) {
        expect(preserved?.endedAt).toEqual(previous.endedAt);
      } else {
        expect(preserved?.endedAt).toBeInstanceOf(Date);
        expect(preserved!.endedAt!.getTime()).toBeGreaterThanOrEqual(preserved!.startedAt.getTime());
      }
    }
    expect(sessions.every((session) => session.endedAt !== null)).toBe(true);
    const removedAssigneeSessions = await db.select({
      ticketId: ticketTimeSessionsTable.ticketId,
      endedAt: ticketTimeSessionsTable.endedAt,
    }).from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.userId, activeHandoffSessions[0]!.userId));
    expect(removedAssigneeSessions.filter((session) => session.endedAt === null)).toEqual([]);

    const report = await request("/api/time-tracking/report", adminSessionId);
    expect(report.status).toBe(200);
    const reportRows = report.body.collaboratorRows.filter((row: any) => row.ticketId === handoffTicketId);
    const collaboratorNames = new Map([
      [collaboratorId, "Timer Test Collaborator"],
      [raceCollaboratorId, "Timer Race Collaborator"],
      [groupStatusManagerId, "Timer Group Status Manager"],
    ]);
    const expectedRows = new Map<number, number>();
    for (const session of sessions) {
      const duration = Math.max(0, Math.floor(
        (session.endedAt!.getTime() - session.startedAt.getTime()) / 60_000,
      ));
      expectedRows.set(session.userId, (expectedRows.get(session.userId) ?? 0) + duration);
    }
    expect(reportRows).toHaveLength(expectedRows.size);
    expect(new Set(reportRows.map((row: any) => row.collaboratorId)).size).toBe(reportRows.length);
    for (const [userId, durationMinutes] of expectedRows) {
      expect(reportRows).toContainEqual(expect.objectContaining({
        ticketId: handoffTicketId,
        collaboratorId: userId,
        collaboratorName: collaboratorNames.get(userId),
        durationMinutes,
      }));
    }
    const removedAssigneeReportRow = reportRows.find(
      (row: any) => row.collaboratorId === activeSession.userId,
    );
    expect(removedAssigneeReportRow).toEqual(expect.objectContaining({
      collaboratorId: activeSession.userId,
      durationMinutes: expect.any(Number),
    }));
    expect(removedAssigneeReportRow.durationMinutes).toBeGreaterThanOrEqual(30);

    expect((await changeStatus(handoffTicketId, "waiting", adminSessionId)).status).toBe(200);
    const reassignedToCollaborator = await request(`/api/tickets/${handoffTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: collaboratorId }),
    });
    expect(reassignedToCollaborator.status).toBe(200);
    expect((await changeStatus(handoffTicketId, "in_progress", collaboratorSessionId)).status).toBe(200);
    const selfUnassignSession = (await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId)))
      .find((session) => session.endedAt === null);
    expect(selfUnassignSession).toMatchObject({ userId: collaboratorId, endedAt: null });

    const selfUnassigned = await request(`/api/tickets/${handoffTicketId}`, collaboratorSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: null }),
    });
    expect(selfUnassigned.status).toBe(200);
    expect(selfUnassigned.body.assignedTo).toBeNull();
    ticketState = await db.select({
      assignedTo: ticketsTable.assignedTo,
      status: ticketsTable.status,
    }).from(ticketsTable).where(eq(ticketsTable.id, handoffTicketId));
    expect(ticketState[0]).toMatchObject({ assignedTo: null, status: "in_progress" });
    const sessionsAfterSelfUnassign = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, handoffTicketId));
    expect(sessionsAfterSelfUnassign).toHaveLength(sessions.length + 1);
    const closedSelfUnassignSession = sessionsAfterSelfUnassign.find(
      (session) => session.id === selfUnassignSession?.id,
    );
    expect(closedSelfUnassignSession).toMatchObject({
      userId: collaboratorId,
      startedAt: selfUnassignSession?.startedAt,
    });
    expect(closedSelfUnassignSession?.endedAt).toBeInstanceOf(Date);
    expect(closedSelfUnassignSession!.endedAt!.getTime())
      .toBeGreaterThanOrEqual(closedSelfUnassignSession!.startedAt.getTime());
    const activeCollaboratorSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.userId, collaboratorId));
    expect(activeCollaboratorSessions.filter((session) => session.endedAt === null)).toEqual([]);
    expect((await changeStatus(handoffTicketId, "waiting", adminSessionId)).status).toBe(200);

    const disabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: false }),
    });
    expect(disabled.status).toBe(200);
  }, 60_000);

  it("backs up and restores both collaborators' complete handoff sessions", async () => {
    const enabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: true }),
    });
    expect(enabled.status).toBe(200);

    expect((await changeStatus(backupHandoffTicketId, "in_progress", adminSessionId)).status).toBe(200);
    const handoff = await request(`/api/tickets/${backupHandoffTicketId}`, adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: raceCollaboratorId }),
    });
    expect(handoff.status).toBe(200);
    expect((await changeStatus(backupHandoffTicketId, "in_progress", raceSessionId)).status).toBe(200);
    expect((await changeStatus(backupHandoffTicketId, "waiting", adminSessionId)).status).toBe(200);

    const originalSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, backupHandoffTicketId));
    expect(originalSessions).toHaveLength(2);
    expect(originalSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: collaboratorId,
        endedAt: expect.any(Date),
        clientBillable: true,
        collaboratorRecognizable: true,
      }),
      expect.objectContaining({
        userId: raceCollaboratorId,
        endedAt: expect.any(Date),
        clientBillable: true,
        collaboratorRecognizable: false,
      }),
    ]));

    const backup = await buildBackupPayload(organizationId);
    expect(backup).not.toBeNull();
    if (!backup) throw new Error("Expected a backup payload for the test organization");
    const backupTicket = backup.data.tickets.find((ticket) => ticket.id === backupHandoffTicketId);
    const backupSessions = backup.data.timeSessions.filter((session) => session.ticketId === backupHandoffTicketId);
    expect(backupSessions).toHaveLength(2);
    expect(backupSessions.map((session) => ({
      userId: session.userId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      clientBillable: session.clientBillable,
      collaboratorRecognizable: session.collaboratorRecognizable,
    }))).toEqual(originalSessions.map((session) => ({
      userId: session.userId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      clientBillable: session.clientBillable,
      collaboratorRecognizable: session.collaboratorRecognizable,
    })));
    expect(backupTicket).toBeDefined();

    const restoredTicketNumber = 1_000_000_000 + backupHandoffTicketId;
    const restore = await request("/api/backup/restore", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        exportedAt: backup.exportedAt,
        data: {
          users: backup.data.users.filter((user) =>
            user.id === collaboratorId || user.id === raceCollaboratorId),
          clients: backup.data.clients.filter((client) => client.id === clientId),
          tickets: [{ ...backupTicket!, ticketNumber: restoredTicketNumber }],
          timeSessions: backupSessions,
        },
      }),
    });
    expect(restore.status).toBe(200);
    expect(restore.body).toMatchObject({ ticketsRestored: 1, timeSessionsRestored: 2 });

    const [restoredTicket] = await db.select({ id: ticketsTable.id }).from(ticketsTable)
      .where(eq(ticketsTable.ticketNumber, restoredTicketNumber));
    expect(restoredTicket).toBeDefined();
    trackedTicketIds.push(restoredTicket.id);
    const restoredSessions = await db.select().from(ticketTimeSessionsTable)
      .where(eq(ticketTimeSessionsTable.ticketId, restoredTicket.id));
    expect(restoredSessions).toHaveLength(2);
    expect(restoredSessions.map((session) => ({
      userId: session.userId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      clientBillable: session.clientBillable,
      collaboratorRecognizable: session.collaboratorRecognizable,
    }))).toEqual(backupSessions.map((session) => ({
      userId: session.userId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      clientBillable: session.clientBillable,
      collaboratorRecognizable: session.collaboratorRecognizable,
    })));

    const disabled = await request("/api/settings/organization", adminSessionId, {
      method: "PATCH",
      body: JSON.stringify({ name: `Timer test ${runId}`, timeTrackingModuleEnabled: false }),
    });
    expect(disabled.status).toBe(200);
  }, 60_000);
});
