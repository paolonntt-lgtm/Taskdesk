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
  ticketSubscriptionsTable,
  ticketStatusesTable,
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
let mentionUserId: number;
let otherAdminId: number;
let notesGroupId: number;
let adminSessionId: string;
let userSessionId: string;
let mentionUserSessionId: string;
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

    const [mentionUser] = await db
      .insert(usersTable)
      .values({
        name: "Visibility Mention User",
        email: `visibility-mention-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      })
      .returning({ id: usersTable.id });
    mentionUserId = mentionUser.id;

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
    await db.insert(groupMembersTable).values([
      { groupId: notesGroupId, userId: adminId },
      { groupId: notesGroupId, userId: mentionUserId },
    ]);

    adminSessionId = await createSession(adminId);
    userSessionId = await createSession(userId);
    mentionUserSessionId = await createSession(mentionUserId);
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
    await db
      .delete(ticketStatusesTable)
      .where(inArray(ticketStatusesTable.organizationId, [organizationId, otherOrganizationId]));
    if (notesGroupId) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, notesGroupId));
      await db.delete(groupsTable).where(eq(groupsTable.id, notesGroupId));
    }
    if (privateAttachmentUploaded) {
      await objectStorageService.deleteObjectEntityByPath(privateAttachmentObjectPath);
    }
    await db
      .delete(sessionsTable)
      .where(inArray(sessionsTable.sessionId, [adminSessionId, userSessionId, mentionUserSessionId, otherAdminSessionId]));
    await db
      .delete(notificationsTable)
      .where(inArray(notificationsTable.userId, [adminId, userId, mentionUserId, otherAdminId]));
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, userId, mentionUserId, otherAdminId]));
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
    await objectStorageService.uploadBuffer(
      `${runId}/private.txt`,
      Buffer.from("Private attachment"),
      "text/plain",
    );
    privateAttachmentUploaded = true;
    await db.insert(ticketAttachmentsTable).values({
      ticketId: privateTicketId,
      uploadedBy: adminId,
      objectPath: privateAttachmentObjectPath,
      fileName: "private.txt",
      fileSize: Buffer.byteLength("Private attachment"),
      mimeType: "text/plain",
    });

    const [privateNotification] = await db.insert(notificationsTable).values({
      userId,
      ticketId: privateTicketId,
      type: "ticket_commented",
      notificationText: privateTitle,
    }).returning({ id: notificationsTable.id });
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
    const privateUpdateResponse = await request(`/api/tickets/${privateTicketId}`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress", priority: "urgent" }),
    });
    expect(privateUpdateResponse.status).toBe(404);

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
      expect.arrayContaining([expect.objectContaining({ notificationText: privateTitle })]),
    );

    const [visibleNotification] = await db.insert(notificationsTable).values({
      userId,
      type: "system",
      notificationText: `Visible notification ${runId}`,
    }).returning({ id: notificationsTable.id });
    const singleReadResponse = await request(
      `/api/notifications/${visibleNotification.id}/read`,
      userSessionId,
      { method: "PATCH" },
    );
    expect(singleReadResponse.status).toBe(200);

    const [adminPrivateNotification] = await db.insert(notificationsTable).values({
      userId: adminId,
      ticketId: privateTicketId,
      type: "ticket_commented",
      notificationText: privateTitle,
    }).returning({ id: notificationsTable.id });
    const [adminOwnedNotification] = await db.insert(notificationsTable).values({
      userId: adminId,
      type: "system",
      notificationText: `Admin-owned notification ${runId}`,
    }).returning({ id: notificationsTable.id });
    const privateReadResponse = await request(
      `/api/notifications/${privateNotification.id}/read`,
      userSessionId,
      { method: "PATCH" },
    );
    expect(privateReadResponse.status).toBe(404);
    const markAllResponse = await request("/api/notifications/read-all", userSessionId, { method: "PATCH" });
    expect(markAllResponse.status).toBe(200);

    const adminNotificationsResponse = await request("/api/notifications", adminSessionId);
    expect(adminNotificationsResponse.status).toBe(200);
    expect(adminNotificationsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: adminPrivateNotification.id, notificationText: privateTitle }),
      ]),
    );
    const [privateNotificationAfterMarkAll] = await db
      .select({ isRead: notificationsTable.isRead })
      .from(notificationsTable)
      .where(eq(notificationsTable.id, privateNotification.id));
    expect(privateNotificationAfterMarkAll?.isRead).toBe(false);

    const ownershipResponse = await request(
      `/api/notifications/${adminOwnedNotification.id}/read`,
      userSessionId,
      { method: "PATCH" },
    );
    expect(ownershipResponse.status).toBe(404);

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
    expect(reportsResponse.body.dashboard.totalTickets).toBe(2);
  }, 60_000);

  it("lets a non-assignee without status group permission change status and priority only", async () => {
    const createResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Status and priority access ${runId}`,
        description: "Only status and priority should be editable by any visible user.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(createResponse.status).toBe(201);
    const ticketId = createResponse.body.id as number;
    createdTicketIds.push(ticketId);

    // The ordinary test user is not the creator or assignee and only has add_notes
    // permission through their group, not change_status.
    const statusAndPriorityResponse = await request(`/api/tickets/${ticketId}`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress", priority: "urgent" }),
    });
    expect(statusAndPriorityResponse.status).toBe(200);
    expect(statusAndPriorityResponse.body).toEqual(
      expect.objectContaining({ status: "in_progress", priority: "urgent" }),
    );

    const [storedTicket] = await db
      .select({ title: ticketsTable.title, status: ticketsTable.status, priority: ticketsTable.priority })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId));
    expect(storedTicket).toEqual({
      title: `Status and priority access ${runId}`,
      status: "in_progress",
      priority: "urgent",
    });

    const activity = await db
      .select({ actionType: ticketActivityLogsTable.actionType })
      .from(ticketActivityLogsTable)
      .where(eq(ticketActivityLogsTable.ticketId, ticketId));
    expect(activity.map((entry) => entry.actionType)).toEqual(
      expect.arrayContaining(["status_changed", "priority_changed"]),
    );

    const configuredStatuses = await db
      .select({ key: ticketStatusesTable.key, isClosed: ticketStatusesTable.isClosed })
      .from(ticketStatusesTable)
      .where(eq(ticketStatusesTable.organizationId, organizationId));
    const closeStatus = configuredStatuses.find((status) => status.isClosed)?.key ?? "resolved";
    const resolutionResponse = await request(`/api/tickets/${ticketId}`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: closeStatus, resolutionNote: "Risolto dal collaboratore" }),
    });
    expect(resolutionResponse.status).toBe(200);
    expect(resolutionResponse.body).toEqual(
      expect.objectContaining({ status: closeStatus, resolutionNote: "Risolto dal collaboratore" }),
    );

    const unauthorizedMixedUpdate = await request(`/api/tickets/${ticketId}`, userSessionId, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress", title: "Unauthorized title change" }),
    });
    expect(unauthorizedMixedUpdate.status).toBe(403);

    const [unchangedTicket] = await db
      .select({ title: ticketsTable.title, status: ticketsTable.status, priority: ticketsTable.priority })
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId));
    expect(unchangedTicket).toEqual({
      title: `Status and priority access ${runId}`,
      status: closeStatus,
      priority: "urgent",
    });
  }, 60_000);

  it("returns only current recent activity with a safe missing-author fallback", async () => {
    async function createTicket(title: string): Promise<number> {
      const response = await request("/api/tickets", adminSessionId, {
        method: "POST",
        body: JSON.stringify({
          title: `${title} ${runId}`,
          description: "Recent activity contract test.",
          category: "Support",
          priority: "medium",
        }),
      });
      expect(response.status).toBe(201);
      const ticketId = response.body.id as number;
      createdTicketIds.push(ticketId);
      await db.delete(ticketActivityLogsTable).where(eq(ticketActivityLogsTable.ticketId, ticketId));
      return ticketId;
    }

    const noLogTicketId = await createTicket("Recent activity without log");
    const staleLogTicketId = await createTicket("Recent activity with stale log");
    const unavailableAuthorTicketId = await createTicket("Recent activity with unavailable author");
    const staleUpdatedAt = new Date(Date.now() - 10_000);
    const staleCreatedAt = new Date(Date.now() - 60_000);
    const currentAt = new Date();

    await db.update(ticketsTable)
      .set({ updatedAt: staleUpdatedAt })
      .where(eq(ticketsTable.id, staleLogTicketId));
    await db.insert(ticketActivityLogsTable).values({
      ticketId: staleLogTicketId,
      userId: adminId,
      actionType: "status_changed",
      actionDescription: "Old status update",
      createdAt: staleCreatedAt,
    });

    await db.update(ticketsTable)
      .set({ updatedAt: currentAt })
      .where(eq(ticketsTable.id, unavailableAuthorTicketId));
    await db.insert(ticketActivityLogsTable).values({
      ticketId: unavailableAuthorTicketId,
      userId: otherAdminId,
      actionType: "status_changed",
      actionDescription: "Current status update with an author outside this organization",
      createdAt: currentAt,
    });

    const response = await request("/api/stats/recent-tickets", userSessionId);
    expect(response.status).toBe(200);
    const recentById = new Map(response.body.map((ticket: any) => [ticket.id, ticket]));
    expect(recentById.get(noLogTicketId)).toEqual(
      expect.objectContaining({ latestActivity: null }),
    );
    expect(recentById.get(staleLogTicketId)).toEqual(
      expect.objectContaining({ latestActivity: null }),
    );
    expect(recentById.get(unavailableAuthorTicketId)).toEqual(
      expect.objectContaining({
        latestActivity: expect.objectContaining({
          actionType: "status_changed",
          actorName: null,
        }),
      }),
    );
  }, 60_000);

  it("filters recurring source tickets separately from future scheduled clones", async () => {
    const recurringResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Recurring source ${runId}`,
        description: "This source ticket has a recurrence rule.",
        category: "Support",
        priority: "medium",
        recurrenceRule: { frequency: "weekly", interval: 1 },
      }),
    });
    expect(recurringResponse.status).toBe(201);
    const recurringTicketId = recurringResponse.body.id as number;
    createdTicketIds.push(recurringTicketId);

    const regularResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Regular ticket ${runId}`,
        description: "This ticket is not recurring.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(regularResponse.status).toBe(201);
    const regularTicketId = regularResponse.body.id as number;
    createdTicketIds.push(regularTicketId);

    const scheduledCloneResponse = await request(
      `/api/tickets/${recurringTicketId}/clone`,
      adminSessionId,
      {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        }),
      },
    );
    expect(scheduledCloneResponse.status).toBe(201);
    const scheduledCloneId = scheduledCloneResponse.body.id as number;
    createdTicketIds.push(scheduledCloneId);

    const recurringList = await request("/api/tickets?recurring=true", adminSessionId);
    expect(recurringList.status).toBe(200);
    const recurringIds = new Set(recurringList.body.map((ticket: { id: number }) => ticket.id));
    expect(recurringIds.has(recurringTicketId)).toBe(true);
    expect(recurringIds.has(regularTicketId)).toBe(false);
    expect(recurringIds.has(scheduledCloneId)).toBe(false);
    expect(
      recurringList.body.find((ticket: { id: number }) => ticket.id === recurringTicketId)?.recurrence,
    ).toBe(true);

    const defaultList = await request("/api/tickets", adminSessionId);
    expect(defaultList.status).toBe(200);
    const defaultIds = new Set(defaultList.body.map((ticket: { id: number }) => ticket.id));
    expect(defaultIds.has(recurringTicketId)).toBe(true);
    expect(defaultIds.has(regularTicketId)).toBe(true);
    expect(defaultIds.has(scheduledCloneId)).toBe(false);

    const scheduledList = await request("/api/tickets?scheduled=true", adminSessionId);
    expect(scheduledList.status).toBe(200);
    const scheduledIds = new Set(scheduledList.body.map((ticket: { id: number }) => ticket.id));
    expect(scheduledIds.has(scheduledCloneId)).toBe(true);
    expect(scheduledIds.has(recurringTicketId)).toBe(false);
    expect(scheduledIds.has(regularTicketId)).toBe(false);
  }, 60_000);

  it("notifies ticket openers and users tagged in comments", async () => {
    const ownerTicketResponse = await request("/api/tickets", userSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Comment notification owner ${runId}`,
        description: "The ticket opener should receive comment notifications.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(ownerTicketResponse.status).toBe(201);
    const ownerTicketId = ownerTicketResponse.body.id as number;
    createdTicketIds.push(ownerTicketId);

    const beforeCommentSubscriptions = await db
      .select()
      .from(ticketSubscriptionsTable)
      .where(eq(ticketSubscriptionsTable.ticketId, ownerTicketId));
    expect(beforeCommentSubscriptions.some((subscription) => subscription.userId === userId)).toBe(false);

    const ownerCommentResponse = await request(`/api/tickets/${ownerTicketId}/comments`, adminSessionId, {
      method: "POST",
      body: JSON.stringify({ commentText: `Owner notification ${runId}` }),
    });
    expect(ownerCommentResponse.status).toBe(201);

    const ownerNotifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.ticketId, ownerTicketId));
    expect(ownerNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId,
          type: "ticket_commented",
          notificationText: expect.stringContaining("ha commentato"),
        }),
      ]),
    );

    const ownerNotificationList = await request("/api/notifications", userSessionId);
    expect(ownerNotificationList.status).toBe(200);
    expect(ownerNotificationList.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ ticketId: ownerTicketId, type: "ticket_commented" })]),
    );

    const mentionTicketResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Comment notification mention ${runId}`,
        description: "A tagged user should receive a targeted notification.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(mentionTicketResponse.status).toBe(201);
    const mentionTicketId = mentionTicketResponse.body.id as number;
    createdTicketIds.push(mentionTicketId);

    const mentionCommentResponse = await request(`/api/tickets/${mentionTicketId}/comments`, userSessionId, {
      method: "POST",
      body: JSON.stringify({ commentText: `@[Visibility Mention User] ${runId}` }),
    });
    expect(mentionCommentResponse.status).toBe(201);

    const mentionNotifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.ticketId, mentionTicketId));
    expect(mentionNotifications.filter((notification) =>
      notification.userId === mentionUserId &&
      notification.type === "ticket_commented" &&
      notification.notificationText.includes("ha menzionato")
    )).toHaveLength(1);

    const groupTicketResponse = await request("/api/tickets", adminSessionId, {
      method: "POST",
      body: JSON.stringify({
        title: `Comment notification group ${runId}`,
        description: "Members of a tagged group should receive notifications.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(groupTicketResponse.status).toBe(201);
    const groupTicketId = groupTicketResponse.body.id as number;
    createdTicketIds.push(groupTicketId);

    const groupCommentResponse = await request(`/api/tickets/${groupTicketId}/comments`, userSessionId, {
      method: "POST",
      body: JSON.stringify({ commentText: `@[Visibility test notes ${runId}] ${runId}` }),
    });
    expect(groupCommentResponse.status).toBe(201);

    const groupNotifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.ticketId, groupTicketId));
    for (const recipientId of [adminId, mentionUserId]) {
      expect(groupNotifications.filter((notification) =>
        notification.userId === recipientId &&
        notification.type === "ticket_commented" &&
        notification.notificationText.includes("menzionato il gruppo")
      )).toHaveLength(1);
    }
  }, 60_000);
});
