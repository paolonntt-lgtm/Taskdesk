import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  groupMembersTable,
  groupsTable,
  notificationsTable,
  organizationsTable,
  pool,
  sessionsTable,
  ticketActivityLogsTable,
  ticketAttachmentsTable,
  ticketChecklistsTable,
  ticketChecklistItemsTable,
  ticketCommentsTable,
  ticketInternalNotesTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";
import { ObjectStorageService } from "../lib/objectStorage";

type HttpResult = {
  status: number;
  body: any;
};

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let otherOrganizationId: number;
let adminId: number;
let userId: number;
let otherAdminId: number;
let notesGroupId: number;
let adminSessionId: string;
let userSessionId: string;
let otherAdminSessionId: string;
const privateAttachmentObjectPath = `/objects/${runId}/private.txt`;
const objectStorageService = new ObjectStorageService();
let privateAttachmentUploaded = false;
const createdTicketIds: number[] = [];

async function request(
  path: string,
  sessionId: string,
  init: RequestInit = {},
): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

describe("manual ticket visibility", () => {
  beforeAll(async () => {
    const [organization] = await db
      .insert(organizationsTable)
      .values({ name: `Ticket visibility test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [admin] = await db
      .insert(usersTable)
      .values({
        name: "Visibility Test Admin",
        email: `visibility-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    adminId = admin.id;

    const [user] = await db
      .insert(usersTable)
      .values({
        name: "Visibility Test User",
        email: `visibility-user-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    userId = user.id;

    const [otherOrganization] = await db
      .insert(organizationsTable)
      .values({ name: `Other ticket visibility test ${runId}` })
      .returning({ id: organizationsTable.id });
    otherOrganizationId = otherOrganization.id;

    const [otherAdmin] = await db
      .insert(usersTable)
      .values({
        name: "Other Visibility Test Admin",
        email: `other-visibility-admin-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId: otherOrganizationId,
      })
      .returning({ id: usersTable.id });
    otherAdminId = otherAdmin.id;

    // Give the test user note access so a 404 proves ticket visibility rather
    // than the separate permission check in the notes router.
    const [notesGroup] = await db
      .insert(groupsTable)
      .values({
        name: `Visibility test notes ${runId}`,
        organizationId,
        permissions: JSON.stringify(["add_notes"]),
      })
      .returning({ id: groupsTable.id });
    notesGroupId = notesGroup.id;
    await db.insert(groupMembersTable).values({ groupId: notesGroupId, userId });

    adminSessionId = await createSession(adminId);
    userSessionId = await createSession(userId);
    otherAdminSessionId = await createSession(otherAdminId);

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

    if (createdTicketIds.length > 0) {
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, createdTicketIds));
    }
    if (notesGroupId) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, notesGroupId));
      await db.delete(groupsTable).where(eq(groupsTable.id, notesGroupId));
    }
    if (privateAttachmentUploaded) {
      await objectStorageService.deleteObjectEntityByPath(privateAttachmentObjectPath);
    }
    await db
      .delete(sessionsTable)
      .where(inArray(sessionsTable.sessionId, [adminSessionId, userSessionId, otherAdminSessionId]));
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, userId, otherAdminId]));
    await db
      .delete(organizationsTable)
      .where(inArray(organizationsTable.id, [organizationId, otherOrganizationId]));
    await pool.end();
  });

  it("persists private visibility and hides the ticket plus derived data from the team", async () => {
    const privateTitle = `Private manual ticket ${runId}`;
    const privateResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: privateTitle,
        description: "Only administrators should see this ticket.",
        category: "Support",
        priority: "high",
        visibility: "admins",
      }),
    });
    expect(privateResponse.status).toBe(201);
    expect(privateResponse.body.visibility).toBe("admins");

    const privateTicketId = privateResponse.body.id as number;
    createdTicketIds.push(privateTicketId);

    const [storedPrivateTicket] = await db
      .select({ visibility: ticketsTable.visibility })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, privateTicketId));
    expect(storedPrivateTicket?.visibility).toBe("admins");

    const [comment] = await db
      .insert(ticketCommentsTable)
      .values({
        ticketId: privateTicketId,
        authorId: adminId,
        commentText: "Private comment",
      })
      .returning({ id: ticketCommentsTable.id });
    await db.insert(ticketInternalNotesTable).values({
      ticketId: privateTicketId,
      authorId: adminId,
      noteText: "Private note",
    });
    await db.insert(ticketActivityLogsTable).values({
      ticketId: privateTicketId,
      userId: adminId,
      actionType: "test_private",
      actionDescription: "Private activity",
    });
    const [checklist] = await db
      .insert(ticketChecklistsTable)
      .values({ ticketId: privateTicketId, orgId: organizationId, title: "Private checklist" })
      .returning({ id: ticketChecklistsTable.id });
    await db.insert(ticketChecklistItemsTable).values({
      checklistId: checklist.id,
      orgId: organizationId,
      text: "Private checklist item",
    });
    await objectStorageService.uploadBuffer(
      `${runId}/private.txt`,
      Buffer.from("Private attachment"),
      "text/plain",
    );
    privateAttachmentUploaded = true;
    await db.insert(ticketAttachmentsTable).values({
      ticketId: privateTicketId,
      commentId: comment.id,
      uploadedBy: adminId,
      objectPath: privateAttachmentObjectPath,
      fileName: "private.txt",
      fileSize: Buffer.byteLength("Private attachment"),
      mimeType: "text/plain",
    });
    await db.insert(notificationsTable).values({
      userId,
      ticketId: privateTicketId,
      type: "ticket_commented",
      notificationText: privateTitle,
    });

    const listResponse = await request("/api/tickets", userSessionId);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: privateTicketId })]),
    );

    for (const path of [
      `/api/tickets/${privateTicketId}`,
      `/api/tickets/${privateTicketId}/comments`,
      `/api/tickets/${privateTicketId}/notes`,
      `/api/tickets/${privateTicketId}/activity`,
      `/api/tickets/${privateTicketId}/attachments`,
      `/api/tickets/${privateTicketId}/checklists`,
    ]) {
      const response = await request(path, userSessionId);
      expect(response.status, path).toBe(404);
    }

    const directDownloadPath = `/api/storage/objects/${runId}/private.txt`;
    const userDownloadResponse = await request(directDownloadPath, userSessionId);
    expect(userDownloadResponse.status).toBe(403);
    const otherOrganizationDownloadResponse = await request(directDownloadPath, otherAdminSessionId);
    expect(otherOrganizationDownloadResponse.status).toBe(403);

    const searchResponse = await request(`/api/search?q=${encodeURIComponent(privateTitle)}`, userSessionId);
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.tickets).toEqual([]);

    const notificationsResponse = await request("/api/notifications", userSessionId);
    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ ticketId: privateTicketId })]),
    );

    const adminResponse = await request(`/api/tickets/${privateTicketId}`, adminSessionId);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.visibility).toBe("admins");

    const adminDownloadResponse = await request(directDownloadPath, adminSessionId);
    expect(adminDownloadResponse.status).toBe(200);
    expect(adminDownloadResponse.body).toBe("Private attachment");

    const publicResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Organization manual ticket ${runId}`,
        description: "The default visibility is shared with the organization.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(publicResponse.status).toBe(201);
    const publicTicketId = publicResponse.body.id as number;
    createdTicketIds.push(publicTicketId);

    const [storedPublicTicket] = await db
      .select({ visibility: ticketsTable.visibility })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, publicTicketId));
    expect(storedPublicTicket?.visibility).toBe("organization");

    const publicDetailResponse = await request(`/api/tickets/${publicTicketId}`, userSessionId);
    expect(publicDetailResponse.status).toBe(200);
    expect(publicDetailResponse.body.id).toBe(publicTicketId);
    expect(publicDetailResponse.body.visibility).toBe("organization");

    const selfAssignedResponse = await request("/api/tickets", userSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Self-assigned manual ticket ${runId}`,
        description: "A collaborator can assign a new ticket to themselves.",
        category: "Support",
        priority: "medium",
        assignedTo: userId,
      }),
    });
    expect(selfAssignedResponse.status).toBe(201);
    expect(selfAssignedResponse.body.assignedTo).toBe(userId);
    createdTicketIds.push(selfAssignedResponse.body.id as number);

    const otherAssignedResponse = await request("/api/tickets", userSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Unauthorized assignment ticket ${runId}`,
        description: "A collaborator cannot assign a new ticket to someone else.",
        category: "Support",
        priority: "medium",
        assignedTo: adminId,
      }),
    });
    expect(otherAssignedResponse.status).toBe(403);

    const dashboardResponse = await request("/api/stats/dashboard", userSessionId);
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.totalTickets).toBe(2);

    const recentTicketsResponse = await request("/api/stats/recent-tickets", userSessionId);
    expect(recentTicketsResponse.status).toBe(200);
    expect(recentTicketsResponse.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: privateTicketId })]),
    );

    const reportsResponse = await request("/api/stats/reports-all", userSessionId);
    expect(reportsResponse.status).toBe(200);
    expect(reportsResponse.body.dashboard.totalTickets).toBe(1);
  }, 60_000);
});