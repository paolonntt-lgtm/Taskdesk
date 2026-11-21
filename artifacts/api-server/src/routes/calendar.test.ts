import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appointmentsTable,
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
let adminSessionId: string;
let collaboratorSessionId: string;
let recurrenceStart: Date;
let recurrenceEnd: Date;
let deletedDueTicketId: number;
let deletedScheduledTicketId: number;
let deletedRecurringTicketId: number;
let activeOccurrenceId: number;
let appointmentId: number | undefined;
const ticketIds: number[] = [];
const privateTicketIds: number[] = [];

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

describe("calendar scheduled tickets", () => {
  beforeAll(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dueAt = new Date(year, month, 10, 12);
    const scheduledAt = new Date(year, month, 15, 12);
    const nextMonthScheduledAt = new Date(year, month + 1, 5, 12);

    const [organization] = await db.insert(organizationsTable).values({
      name: `Calendar scheduled test ${runId}`,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db.insert(usersTable).values({
      name: "Calendar Test Admin",
      email: `calendar-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId,
    }).returning({ id: usersTable.id });
    adminId = admin.id;
    adminSessionId = await createSession(adminId);

    const [collaborator] = await db.insert(usersTable).values({
      name: "Calendar Test Collaborator",
      email: `calendar-collaborator-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    collaboratorId = collaborator.id;
    collaboratorSessionId = await createSession(collaboratorId);

    for (const [title, due, scheduled] of [
      [`Due ${runId}`, dueAt, null],
      [`Scheduled ${runId}`, null, scheduledAt],
      [`Cross-month ${runId}`, dueAt, nextMonthScheduledAt],
      [`Outside month ${runId}`, null, nextMonthScheduledAt],
    ] as const) {
      const [ticket] = await db.insert(ticketsTable).values({
        organizationId,
        title,
        description: "Calendar route test fixture.",
        category: "Support",
        location: "",
        status: "open",
        priority: "medium",
        createdBy: adminId,
        dueAt: due,
        scheduledAt: scheduled,
      }).returning({ id: ticketsTable.id });
      ticketIds.push(ticket.id);
    }

    recurrenceStart = new Date(year, month, 20, 12);
    recurrenceEnd = new Date(recurrenceStart);
    recurrenceEnd.setDate(recurrenceEnd.getDate() + 2);
    const [recurringTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Recurring template ${runId}`,
      description: "Calendar recurrence preview fixture.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      recurrenceRule: { frequency: "daily", interval: 1, endDate: dateKey(recurrenceEnd) },
      recurrenceNextAt: recurrenceStart,
    }).returning({ id: ticketsTable.id });
    ticketIds.push(recurringTicket.id);

    const [privateDueTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Private due ${runId}`,
      description: "Admin-only due event fixture.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      visibility: "admins",
      createdBy: adminId,
      assignedTo: collaboratorId,
      dueAt,
    }).returning({ id: ticketsTable.id });
    privateTicketIds.push(privateDueTicket.id);
    ticketIds.push(privateDueTicket.id);

    const [privateScheduledTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Private scheduled ${runId}`,
      description: "Admin-only scheduled event fixture.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      visibility: "admins",
      createdBy: adminId,
      assignedTo: collaboratorId,
      scheduledAt,
    }).returning({ id: ticketsTable.id });
    privateTicketIds.push(privateScheduledTicket.id);
    ticketIds.push(privateScheduledTicket.id);

    const [privateRecurringTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Private recurring ${runId}`,
      description: "Admin-only recurrence preview fixture.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      visibility: "admins",
      createdBy: adminId,
      assignedTo: collaboratorId,
      recurrenceRule: { frequency: "daily", interval: 1, endDate: dateKey(recurrenceEnd) },
      recurrenceNextAt: recurrenceStart,
    }).returning({ id: ticketsTable.id });
    privateTicketIds.push(privateRecurringTicket.id);
    ticketIds.push(privateRecurringTicket.id);

    const [deletedDueTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Deleted due ${runId}`,
      description: "A deleted due ticket should not appear on the calendar.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      dueAt,
      deletedAt: new Date(),
    }).returning({ id: ticketsTable.id });
    deletedDueTicketId = deletedDueTicket.id;
    ticketIds.push(deletedDueTicket.id);

    const [deletedScheduledTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Deleted scheduled ${runId}`,
      description: "A deleted scheduled ticket should not appear on the calendar.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      scheduledAt,
      deletedAt: new Date(),
    }).returning({ id: ticketsTable.id });
    deletedScheduledTicketId = deletedScheduledTicket.id;
    ticketIds.push(deletedScheduledTicket.id);

    const [deletedRecurringTicket] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Deleted recurring template ${runId}`,
      description: "A deleted recurring template should not create calendar previews.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      recurrenceRule: { frequency: "daily", interval: 1, endDate: dateKey(recurrenceEnd) },
      recurrenceNextAt: recurrenceStart,
      deletedAt: new Date(),
    }).returning({ id: ticketsTable.id });
    deletedRecurringTicketId = deletedRecurringTicket.id;
    ticketIds.push(deletedRecurringTicket.id);

    const [activeOccurrence] = await db.insert(ticketsTable).values({
      organizationId,
      title: `Created occurrence ${runId}`,
      description: "An existing active occurrence remains visible when its parent is deleted.",
      category: "Support",
      location: "",
      status: "open",
      priority: "medium",
      createdBy: adminId,
      dueAt: recurrenceStart,
      recurrenceParentId: deletedRecurringTicket.id,
    }).returning({ id: ticketsTable.id });
    activeOccurrenceId = activeOccurrence.id;
    ticketIds.push(activeOccurrence.id);

    const appointmentStartsAt = new Date(year, month, 25, 14);
    const [appointment] = await db.insert(appointmentsTable).values({
      organizationId,
      title: `Calendar appointment ${runId}`,
      startsAt: appointmentStartsAt,
      endsAt: new Date(appointmentStartsAt.getTime() + 60 * 60 * 1000),
      createdBy: adminId,
    }).returning({ id: appointmentsTable.id });
    appointmentId = appointment.id;

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
    for (const id of [...ticketIds].reverse()) {
      await db.delete(ticketsTable).where(eq(ticketsTable.id, id));
    }
    if (appointmentId) {
      await db.delete(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
    }
    if (adminSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, adminSessionId));
    }
    if (collaboratorSessionId) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, collaboratorSessionId));
    }
    if (collaboratorId) await db.delete(usersTable).where(eq(usersTable.id, collaboratorId));
    if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("returns scheduled tickets as separate calendar items without leaking other-month dates", async () => {
    const now = new Date();
    const response = await fetch(
      `${baseUrl}/api/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      { headers: { Cookie: `session_id=${adminSessionId}` } },
    );
    expect(response.status).toBe(200);

    const items = await response.json() as Array<{
      id: number;
      type: string;
      ticketEvent?: string;
      date: string;
      status?: string | null;
    }>;
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ticketIds[0], type: "ticket", ticketEvent: "due", date: dateKey(new Date(now.getFullYear(), now.getMonth(), 10, 12)) }),
      expect.objectContaining({ id: ticketIds[1], type: "ticket", ticketEvent: "scheduled", date: dateKey(new Date(now.getFullYear(), now.getMonth(), 15, 12)) }),
      expect.objectContaining({ id: ticketIds[2], type: "ticket", ticketEvent: "due" }),
    ]));
    expect(items.filter((item) => item.id === ticketIds[2])).toHaveLength(1);
    expect(items.some((item) => item.id === ticketIds[3])).toBe(false);
    expect(items.some((item) => item.id === deletedDueTicketId)).toBe(false);
    expect(items.some((item) => item.id === deletedScheduledTicketId)).toBe(false);
    expect(items.some((item) => item.id === deletedRecurringTicketId)).toBe(false);
    expect(items).toContainEqual(expect.objectContaining({
      id: activeOccurrenceId,
      type: "ticket",
      ticketEvent: "due",
      date: dateKey(recurrenceStart),
    }));
    expect(items).toContainEqual(expect.objectContaining({
      id: appointmentId,
      type: "appointment",
      date: dateKey(new Date(now.getFullYear(), now.getMonth(), 25, 14)),
    }));
    const recurrenceItems = items.filter((item) => item.id === ticketIds[4]);
    expect(recurrenceItems.map((item) => item.date)).toEqual([
      dateKey(recurrenceStart),
      dateKey(new Date(recurrenceStart.getFullYear(), recurrenceStart.getMonth(), recurrenceStart.getDate() + 1, 12)),
      dateKey(recurrenceEnd),
    ]);
    expect(recurrenceItems.every((item) => item.ticketEvent === "recurrence" && item.status === null)).toBe(true);
  });

  it("returns a restored ticket to the calendar with its original due date", async () => {
    const now = new Date();
    const calendarUrl = `${baseUrl}/api/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
    const headers = { Cookie: `session_id=${adminSessionId}` };

    const beforeRestore = await fetch(calendarUrl, { headers });
    expect(beforeRestore.status).toBe(200);
    const itemsBeforeRestore = await beforeRestore.json() as Array<{ id: number }>;
    expect(itemsBeforeRestore.some((item) => item.id === deletedDueTicketId)).toBe(false);

    const restoreResponse = await fetch(
      `${baseUrl}/api/tickets/${deletedDueTicketId}/restore`,
      { method: "POST", headers },
    );
    expect(restoreResponse.status).toBe(200);

    const afterRestore = await fetch(calendarUrl, { headers });
    expect(afterRestore.status).toBe(200);
    const itemsAfterRestore = await afterRestore.json() as Array<{
      id: number;
      type: string;
      ticketEvent?: string;
      date: string;
    }>;
    expect(itemsAfterRestore).toContainEqual(expect.objectContaining({
      id: deletedDueTicketId,
      type: "ticket",
      ticketEvent: "due",
      date: dateKey(new Date(now.getFullYear(), now.getMonth(), 10, 12)),
    }));
  });

  it("hides private ticket events and recurrence previews from collaborators but keeps them for admins", async () => {
    const now = new Date();
    const path = `/api/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
    const [adminResponse, collaboratorResponse] = await Promise.all([
      fetch(`${baseUrl}${path}`, { headers: { Cookie: `session_id=${adminSessionId}` } }),
      fetch(`${baseUrl}${path}`, { headers: { Cookie: `session_id=${collaboratorSessionId}` } }),
    ]);

    expect(adminResponse.status).toBe(200);
    expect(collaboratorResponse.status).toBe(200);
    const adminItems = await adminResponse.json() as Array<{ id: number; ticketEvent?: string }>;
    const collaboratorItems = await collaboratorResponse.json() as Array<{ id: number }>;

    expect(adminItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: privateTicketIds[0], ticketEvent: "due" }),
      expect.objectContaining({ id: privateTicketIds[1], ticketEvent: "scheduled" }),
      expect.objectContaining({ id: privateTicketIds[2], ticketEvent: "recurrence" }),
    ]));
    expect(collaboratorItems.some((item) => privateTicketIds.includes(item.id))).toBe(false);
  });
});
