import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import app from "../app";
import { createSession } from "../lib/session";
import { runTicketRecurrenceJob } from "../lib/ticketRecurrenceJob";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let adminId: number;
let collaboratorId: number;
let adminSessionId: string;
let collaboratorSessionId: string;
let recurringTicketId: number;
let existingOccurrenceId: number;
const createdTicketIds: number[] = [];

async function request(path: string, sessionId: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: `session_id=${sessionId}`,
      ...init.headers,
    },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("stopping recurring tickets", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable)
      .values({ name: `Recurrence stop test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Recurrence Stop Admin",
      email: `recurrence-stop-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;

    const [collaborator] = await db.insert(usersTable).values({
      name: "Recurrence Stop Collaborator",
      email: `recurrence-stop-user-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;

    adminSessionId = await createSession(adminId);
    collaboratorSessionId = await createSession(collaboratorId);

    const nextAt = new Date(Date.now() - 60_000);
    const endDate = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const [source] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Recurring source ${runId}`,
      description: "Stop must preserve source and existing occurrences.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      recurrenceRule: { frequency: "daily", interval: 1, endDate },
      recurrenceNextAt: nextAt,
    }).returning({ id: ticketsTable.id });
    recurringTicketId = source.id;
    createdTicketIds.push(source.id);

    const [existingOccurrence] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Existing occurrence ${runId}`,
      description: "Must remain unchanged after stopping.",
      category: "Support",
      location: "",
      status: "in_progress",
      priority: "high",
      createdBy: adminId,
      recurrenceParentId: source.id,
    }).returning({ id: ticketsTable.id });
    existingOccurrenceId = existingOccurrence.id;
    createdTicketIds.push(existingOccurrence.id);

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
    if (recurringTicketId) {
      const occurrences = await db.select({ id: ticketsTable.id })
        .from(ticketsTable)
        .where(eq(ticketsTable.recurrenceParentId, recurringTicketId));
      createdTicketIds.push(...occurrences.map(({ id }) => id));
    }
    if (createdTicketIds.length) {
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, [...new Set(createdTicketIds)]));
    }
    const sessionIds = [adminSessionId, collaboratorSessionId].filter(Boolean);
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    const userIds = [adminId, collaboratorId].filter(Number.isInteger);
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationId) {
      await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    }
    await pool.end();
  });

  it("stops a concurrently running job before it can create anything after the response", async () => {
    const now = new Date();
    const calendarBefore = await request(
      `/api/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      adminSessionId,
    );
    expect(calendarBefore.status).toBe(200);
    expect(calendarBefore.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: recurringTicketId, ticketEvent: "recurrence" }),
    ]));

    const forbiddenStop = await request(
      `/api/tickets/${recurringTicketId}/recurrence`,
      collaboratorSessionId,
      { method: "DELETE" },
    );
    expect(forbiddenStop.status).toBe(403);

    const existingBeforeRace = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      description: ticketsTable.description,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
    }).from(ticketsTable).where(eq(ticketsTable.id, existingOccurrenceId));

    let jobFinished = false;
    let stopFinished = false;
    let jobPromise!: Promise<void>;
    let stopPromise!: Promise<{ status: number; body: any }>;
    let childIdsAtStopResponse: number[] = [];

    // Hold the source row while both operations start. This makes the job and
    // the admin's DELETE compete for the same row lock instead of relying on
    // the timing of two otherwise-fast requests.
    await db.transaction(async (tx) => {
      await tx.select({ id: ticketsTable.id })
        .from(ticketsTable)
        .where(eq(ticketsTable.id, recurringTicketId))
        .for("update");

      jobPromise = runTicketRecurrenceJob().finally(() => {
        jobFinished = true;
      });
      stopPromise = request(
        `/api/tickets/${recurringTicketId}/recurrence`,
        adminSessionId,
        { method: "DELETE" },
      ).then(async (response) => {
        const childrenAtResponse = await db.select({ id: ticketsTable.id })
          .from(ticketsTable)
          .where(eq(ticketsTable.recurrenceParentId, recurringTicketId));
        childIdsAtStopResponse = childrenAtResponse.map(({ id }) => id);
        stopFinished = true;
        return response;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(jobFinished).toBe(false);
    expect(stopFinished).toBe(false);

    const stopped = await stopPromise;
    expect(stopped.status).toBe(200);
    expect(stopped.body.recurrenceRule).toBeNull();
    expect(stopped.body.recurrenceNextAt).toBeNull();
    await jobPromise;

    const [sourceAfterStop] = await db.select({
      title: ticketsTable.title,
      status: ticketsTable.status,
      recurrenceRule: ticketsTable.recurrenceRule,
      recurrenceNextAt: ticketsTable.recurrenceNextAt,
    }).from(ticketsTable).where(eq(ticketsTable.id, recurringTicketId));
    expect(sourceAfterStop).toMatchObject({
      title: `Recurring source ${runId}`,
      status: "open",
      recurrenceRule: null,
      recurrenceNextAt: null,
    });

    const occurrences = await db.select({
      id: ticketsTable.id,
    }).from(ticketsTable).where(eq(ticketsTable.recurrenceParentId, recurringTicketId));
    expect(occurrences.map(({ id }) => id).sort()).toEqual([...childIdsAtStopResponse].sort());

    const existingAfterRace = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      description: ticketsTable.description,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
    }).from(ticketsTable).where(eq(ticketsTable.id, existingOccurrenceId));
    expect(existingAfterRace).toEqual(existingBeforeRace);

    const calendarAfter = await request(
      `/api/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      adminSessionId,
    );
    expect(calendarAfter.status).toBe(200);
    expect(calendarAfter.body.some(
      (item: { id: number; ticketEvent?: string }) =>
        item.id === recurringTicketId && item.ticketEvent === "recurrence",
    )).toBe(false);
  }, 20_000);

  it("does not create occurrences from a trashed source and preserves existing tickets", async () => {
    const dueAt = new Date(Date.now() - 60_000);
    const endDate = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const [source] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Trashed recurring source ${runId}`,
      description: "The trashed source and its existing occurrence must be preserved.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      recurrenceRule: { frequency: "daily", interval: 1, endDate },
      recurrenceNextAt: dueAt,
    }).returning({ id: ticketsTable.id });
    createdTicketIds.push(source.id);

    const [existingOccurrence] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Preserved occurrence ${runId}`,
      description: "Existing work must remain unchanged.",
      category: "Support",
      location: "",
      status: "in_progress",
      priority: "high",
      createdBy: adminId,
      recurrenceParentId: source.id,
    }).returning({ id: ticketsTable.id });
    createdTicketIds.push(existingOccurrence.id);

    const occurrenceBefore = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      description: ticketsTable.description,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      recurrenceParentId: ticketsTable.recurrenceParentId,
    }).from(ticketsTable).where(eq(ticketsTable.id, existingOccurrence.id));

    const trashed = await request(`/api/tickets/${source.id}`, adminSessionId, { method: "DELETE" });
    expect(trashed.status).toBe(200);
    expect(trashed.body.deletedAt).toBeTruthy();

    await runTicketRecurrenceJob();

    const [sourceAfterJob] = await db.select({
      deletedAt: ticketsTable.deletedAt,
      recurrenceRule: ticketsTable.recurrenceRule,
      recurrenceNextAt: ticketsTable.recurrenceNextAt,
    }).from(ticketsTable).where(eq(ticketsTable.id, source.id));
    expect(sourceAfterJob.deletedAt).toBeInstanceOf(Date);
    expect(sourceAfterJob.recurrenceRule).toEqual({ frequency: "daily", interval: 1, endDate });
    expect(sourceAfterJob.recurrenceNextAt?.getTime()).toBe(dueAt.getTime());

    const occurrences = await db.select({
      id: ticketsTable.id,
    }).from(ticketsTable).where(eq(ticketsTable.recurrenceParentId, source.id));
    expect(occurrences.map(({ id }) => id)).toEqual([existingOccurrence.id]);

    const occurrenceAfter = await db.select({
      id: ticketsTable.id,
      title: ticketsTable.title,
      description: ticketsTable.description,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      recurrenceParentId: ticketsTable.recurrenceParentId,
    }).from(ticketsTable).where(eq(ticketsTable.id, existingOccurrence.id));
    expect(occurrenceAfter).toEqual(occurrenceBefore);
  });
});
