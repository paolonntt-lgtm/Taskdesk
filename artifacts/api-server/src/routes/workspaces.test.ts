import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  db,
  notificationsTable,
  organizationsTable,
  pool,
  sessionsTable,
  settingsTable,
  ticketStatusesTable,
  ticketsTable,
  usersTable,
  workspaceInviteTokensTable,
  workspaceMembershipsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";
import { sendEmailForOrg } from "../lib/email";

vi.mock("../lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/email")>();
  return {
    ...actual,
    sendEmailForOrg: vi.fn().mockResolvedValue({ ok: true }),
  };
});

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let billingOrganizationId: number;
let externalOrganizationId: number;
let externalOrganizationName: string;
let workspaceId: number;
let sharedTicketId: number | undefined;
let billingAdminId: number;
let externalUserId: number;
let unbilledUserId: number;
let outsiderId: number;
let billingAdminSessionId: string;
let externalUserSessionId: string;
let unbilledUserSessionId: string;
let outsiderSessionId: string;

async function request(
  path: string,
  sessionId: string,
  workspaceHeader?: number,
  init: RequestInit = {},
): Promise<{ status: number; body: any; cacheControl: string | null }> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (workspaceHeader != null) headers.set("X-Workspace-ID", String(workspaceHeader));
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
  return {
    status: response.status,
    body,
    cacheControl: response.headers.get("cache-control"),
  };
}

describe("shared workspaces", () => {
  beforeAll(async () => {
    await pool.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS external_sharing_enabled BOOLEAN NOT NULL DEFAULT false;
      CREATE TABLE IF NOT EXISTS workspace_invite_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        workspace_organization_id INTEGER NOT NULL
          REFERENCES organizations(id) ON DELETE CASCADE,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        invitee_role TEXT NOT NULL DEFAULT 'user',
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE workspace_invite_tokens
        ADD COLUMN IF NOT EXISTS invitee_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS invitee_role TEXT NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS workspace_invite_id INTEGER
          REFERENCES workspace_invite_tokens(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT;
    `);
    const [billingOrganization] = await db.insert(organizationsTable)
      .values({ name: `Workspace billing ${runId}` })
      .returning({ id: organizationsTable.id });
    billingOrganizationId = billingOrganization.id;
    const [externalOrganization] = await db.insert(organizationsTable)
      .values({ name: `Workspace external ${runId}` })
      .returning({ id: organizationsTable.id });
    externalOrganizationId = externalOrganization.id;
    externalOrganizationName = `Workspace external ${runId}`;

    const [billingAdmin] = await db.insert(usersTable).values({
      name: "Workspace Billing Admin",
      email: `workspace-admin-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "admin",
      organizationId: billingOrganizationId,
    }).returning({ id: usersTable.id });
    billingAdminId = billingAdmin.id;
    const [externalUser] = await db.insert(usersTable).values({
      name: "Workspace External User",
      email: `workspace-external-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId: externalOrganizationId,
    }).returning({ id: usersTable.id });
    externalUserId = externalUser.id;
    const [unbilledUser] = await db.insert(usersTable).values({
      name: "Workspace Unbilled User",
      email: `workspace-unbilled-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId: null,
    }).returning({ id: usersTable.id });
    unbilledUserId = unbilledUser.id;
    const [outsider] = await db.insert(usersTable).values({
      name: "Workspace Outsider",
      email: `workspace-outsider-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId: externalOrganizationId,
      preferredLanguage: "it",
    }).returning({ id: usersTable.id });
    outsiderId = outsider.id;

    billingAdminSessionId = await createSession(billingAdminId);
    externalUserSessionId = await createSession(externalUserId);
    unbilledUserSessionId = await createSession(unbilledUserId);
    outsiderSessionId = await createSession(outsiderId);

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

    const userWithoutLanguagePreference = await request("/api/auth/me", externalUserSessionId);
    expect(userWithoutLanguagePreference.status).toBe(200);
    expect(userWithoutLanguagePreference.body.preferredLanguage).toBeNull();

    const savedEnglishPreference = await request("/api/auth/profile", externalUserSessionId, undefined, {
      method: "PATCH",
      body: JSON.stringify({ preferredLanguage: "en" }),
    });
    expect(savedEnglishPreference.status).toBe(200);
    expect(savedEnglishPreference.body.user.preferredLanguage).toBe("en");
    const currentUser = await request("/api/auth/me", externalUserSessionId);
    expect(currentUser.body.preferredLanguage).toBe("en");
    const rejectedLanguage = await request("/api/auth/profile", externalUserSessionId, undefined, {
      method: "PATCH",
      body: JSON.stringify({ preferredLanguage: "fr" }),
    });
    expect(rejectedLanguage.status).toBe(400);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (workspaceId) {
      if (sharedTicketId) {
        await db.delete(ticketsTable).where(eq(ticketsTable.id, sharedTicketId));
      }
      await db.delete(workspaceMembershipsTable)
        .where(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId));
      await db.delete(workspaceInviteTokensTable)
        .where(eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId));
      await db.delete(settingsTable)
        .where(inArray(settingsTable.key, [`org_${workspaceId}_categories`, `org_${workspaceId}_locations`]));
      await db.delete(ticketStatusesTable).where(eq(ticketStatusesTable.organizationId, workspaceId));
    }
    await db.delete(notificationsTable)
      .where(inArray(notificationsTable.userId, [billingAdminId, externalUserId, unbilledUserId, outsiderId]));
    await db.delete(sessionsTable)
      .where(inArray(sessionsTable.sessionId, [billingAdminSessionId, externalUserSessionId, unbilledUserSessionId, outsiderSessionId]));
    await db.delete(usersTable)
      .where(inArray(usersTable.id, [billingAdminId, externalUserId, unbilledUserId, outsiderId]));
    if (workspaceId) await db.delete(organizationsTable).where(eq(organizationsTable.id, workspaceId));
    await db.delete(organizationsTable)
      .where(inArray(organizationsTable.id, [billingOrganizationId, externalOrganizationId]));
    await pool.end();
  });

  it("keeps billing seats on home organizations while isolating workspace access and roles", async () => {
    const homeSeatsBefore = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.organizationId, billingOrganizationId), eq(usersTable.isActive, true)));
    const createResponse = await request("/api/workspaces", billingAdminSessionId, undefined, {
      method: "POST",
      body: JSON.stringify({ name: `Shared workspace ${runId}` }),
    });
    expect(createResponse.status).toBe(201);
    workspaceId = createResponse.body.workspace.id;
    expect(createResponse.body.workspace).toMatchObject({
      isSharedWorkspace: true,
      externalSharingEnabled: false,
      billingOwnerOrganizationId: billingOrganizationId,
    });
    const initialAssignees = await request("/api/users", billingAdminSessionId, workspaceId);
    expect(initialAssignees.status).toBe(200);
    expect(initialAssignees.cacheControl).toBe("no-store");
    expect(initialAssignees.body.map((user: { id: number }) => user.id)).toEqual([billingAdminId]);

    const rejectLastAdminDemotion = await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "user" }) },
    );
    expect(rejectLastAdminDemotion.status).toBe(409);
    expect(rejectLastAdminDemotion.body.error).toContain("at least one administrator");
    const rejectLastAdminRemoval = await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "DELETE" },
    );
    expect(rejectLastAdminRemoval.status).toBe(409);
    expect(rejectLastAdminRemoval.body.error).toContain("at least one administrator");

    const invite = (email: string, role = "user") => request(
      `/api/workspaces/${workspaceId}/members`,
      billingAdminSessionId,
      workspaceId,
      { method: "POST", body: JSON.stringify({ email, role }) },
    );
    const inviteResponse = await invite(`workspace-external-${runId}@example.test`);
    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body).toMatchObject({ pendingAcceptance: true, emailSent: true });
    expect(inviteResponse.body.inviteUrl).toBeUndefined();
    const legacyInviteNotificationText =
      `Hai ricevuto un invito da Workspace Billing Admin a collaborare nello spazio condiviso Shared workspace ${runId}. Puoi accettare direttamente da questa notifica.`;
    const [legacyInviteNotification] = await db.insert(notificationsTable).values({
      userId: externalUserId,
      organizationId: externalOrganizationId,
      type: "system",
      notificationText: legacyInviteNotificationText,
      isRead: false,
    }).returning({ id: notificationsTable.id });
    expect(legacyInviteNotification).toBeDefined();
    await db.update(notificationsTable).set({ workspaceInviteId: null })
      .where(eq(notificationsTable.id, legacyInviteNotification.id));
    const initialInviteNotificationText =
      `You received an invitation from Workspace Billing Admin to collaborate in the shared workspace Shared workspace ${runId}. You can accept directly from this notification.`;
    let inviteNotificationText = initialInviteNotificationText;
    const inviteeNotifications = await request("/api/notifications", externalUserSessionId);
    expect(inviteeNotifications.status).toBe(200);
    expect(inviteeNotifications.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        organizationId: externalOrganizationId,
        notificationText: inviteNotificationText,
        isRead: false,
      }),
    ]));
    const legacyDirectInviteNotification = inviteeNotifications.body.find(
      (notification: { id: number }) => notification.id === legacyInviteNotification.id,
    );
    expect(legacyDirectInviteNotification?.workspaceInviteToken).toBeTruthy();
    const directInviteNotification = inviteeNotifications.body.find(
      (notification: { notificationText: string }) => notification.notificationText === initialInviteNotificationText,
    );
    expect(directInviteNotification?.workspaceInviteToken).toBeTruthy();
    const pendingInviteAssignees = await request("/api/users", billingAdminSessionId, workspaceId);
    expect(pendingInviteAssignees.cacheControl).toBe("no-store");
    expect(pendingInviteAssignees.body.map((user: { id: number }) => user.id)).toEqual([billingAdminId]);
    const sentEmail = vi.mocked(sendEmailForOrg).mock.calls.at(-1);
    expect(sentEmail).toBeDefined();
    const [sentOrganizationId, sentMail] = sentEmail!;
    expect(sentOrganizationId).toBe(billingOrganizationId);
    expect(sentMail.to).toBe(`workspace-external-${runId}@example.test`);
    expect(sentMail.subject).toContain(`Shared workspace ${runId}`);
    expect(sentMail.text).toContain("/app/workspace-invite/");
    expect(sentMail.text).toContain("Italy time");
    expect(sentMail.text).toContain("invited you to collaborate");
    expect(sentMail.html).toContain("Accept invitation");
    const directToken = sentMail.text?.match(/\/app\/workspace-invite\/([^\s]+)/)?.[1];
    expect(directToken).toBeTruthy();
    if (!directToken) throw new Error("Workspace invite email did not include a tokenized link");
    const notificationInviteToken = directInviteNotification?.workspaceInviteToken;
    expect(notificationInviteToken).toBe(directToken);
    if (!notificationInviteToken) throw new Error("Workspace invitation notification did not expose its pending invitation");
    const englishLegacyNotificationText =
      `You received an invitation from Workspace Billing Admin to collaborate in the shared workspace Shared workspace ${runId}. You can accept directly from this notification.`;
    const [englishLegacyNotification] = await db.insert(notificationsTable).values({
      userId: externalUserId,
      organizationId: externalOrganizationId,
      type: "system",
      notificationText: englishLegacyNotificationText,
    }).returning({ id: notificationsTable.id });
    const notificationsWithEnglishInvite = await request("/api/notifications", externalUserSessionId);
    expect(notificationsWithEnglishInvite.body.find(
      (notification: { id: number }) => notification.id === englishLegacyNotification.id,
    )?.workspaceInviteToken).toBe(directToken);
    await db.delete(notificationsTable).where(eq(notificationsTable.id, englishLegacyNotification.id));
    const [duplicatePendingInvite] = await db.insert(workspaceInviteTokensTable).values({
      token: `duplicate-${runId}`,
      workspaceOrganizationId: workspaceId,
      createdByUserId: billingAdminId,
      inviteeUserId: externalUserId,
      inviteeRole: "user",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning({ id: workspaceInviteTokensTable.id, token: workspaceInviteTokensTable.token });
    const notificationsWithDuplicateInvites = await request("/api/notifications", externalUserSessionId);
    expect(notificationsWithDuplicateInvites.body.find(
      (notification: { id: number }) => notification.id === directInviteNotification.id,
    )?.workspaceInviteToken).toBeTruthy();
    await db.delete(workspaceInviteTokensTable).where(eq(workspaceInviteTokensTable.id, duplicatePendingInvite.id));
    const pendingList = await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId);
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.invitations).toEqual([
      expect.objectContaining({
        name: "Workspace External User",
        email: `workspace-external-${runId}@example.test`,
        role: "user",
        expiresAt: expect.any(String),
      }),
    ]);
    const pendingInvitationId = pendingList.body.invitations[0].id;
    const resendInvitationPath = `/api/workspaces/${workspaceId}/invitations/${pendingInvitationId}/resend`;
    const switchToItalian = await request("/api/auth/profile", externalUserSessionId, undefined, {
      method: "PATCH",
      body: JSON.stringify({ preferredLanguage: "it" }),
    });
    expect(switchToItalian.status).toBe(200);
    inviteNotificationText =
      `Hai ricevuto un invito da Workspace Billing Admin a collaborare nello spazio condiviso Shared workspace ${runId}. Puoi accettare direttamente da questa notifica.`;
    const resendInvitation = await request(resendInvitationPath, billingAdminSessionId, workspaceId, { method: "POST" });
    expect(resendInvitation.status).toBe(200);
    expect(resendInvitation.body).toEqual({
      emailSent: true,
      email: `workspace-external-${runId}@example.test`,
    });
    const resentEmail = vi.mocked(sendEmailForOrg).mock.calls.at(-1);
    expect(resentEmail?.[1]?.to).toBe(`workspace-external-${runId}@example.test`);
    expect(resentEmail?.[1]?.text).toContain(`/app/workspace-invite/${directToken}`);
    expect(resentEmail?.[1]?.text).toContain("ora italiana");
    const refreshedInviteNotification = await request("/api/notifications", externalUserSessionId);
    expect(refreshedInviteNotification.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ notificationText: inviteNotificationText }),
    ]));

    vi.mocked(sendEmailForOrg).mockRejectedValueOnce(new Error("SMTP unavailable"));
    const failedResend = await request(resendInvitationPath, billingAdminSessionId, workspaceId, { method: "POST" });
    expect(failedResend.status).toBe(502);
    expect(failedResend.body.error).toContain("existing invitation remains valid");
    expect((await request(`/api/workspace-invites/${directToken}`, outsiderSessionId)).status).toBe(200);
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId)).body.invitations)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: pendingInvitationId })]));

    await db.insert(workspaceMembershipsTable).values({
      workspaceOrganizationId: workspaceId,
      userId: outsiderId,
      role: "user",
      sponsored: false,
    });
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, outsiderSessionId, workspaceId)).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/invitations/${pendingInvitationId}`,
      outsiderSessionId,
      workspaceId,
      { method: "DELETE" },
    )).status).toBe(403);
    expect((await request(resendInvitationPath, outsiderSessionId, workspaceId, { method: "POST" })).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      outsiderSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "user" }) },
    )).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      outsiderSessionId,
      workspaceId,
      { method: "DELETE" },
    )).status).toBe(403);
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, externalUserSessionId, workspaceId)).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/invitations/${pendingInvitationId}`,
      externalUserSessionId,
      workspaceId,
      { method: "DELETE" },
    )).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      externalUserSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "user" }) },
    )).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/members/${billingAdminId}`,
      externalUserSessionId,
      workspaceId,
      { method: "DELETE" },
    )).status).toBe(403);
    const removeTemporaryCollaborator = await request(
      `/api/workspaces/${workspaceId}/members/${outsiderId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "DELETE" },
    );
    expect(removeTemporaryCollaborator.status).toBe(200);
    expect((await request("/api/auth/me", externalUserSessionId, workspaceId)).status).toBe(403);
    expect((await invite(`workspace-external-${runId}@example.test`)).status).toBe(409);
    expect((await invite(`workspace-unbilled-${runId}@example.test`)).status).toBe(404);

    const rejectWrongInvitee = await request(`/api/workspace-invites/${notificationInviteToken}/accept`, outsiderSessionId, undefined, {
      method: "POST",
    });
    expect(rejectWrongInvitee.status).toBe(403);
    const adminPermissionEvent = request(
      "/api/auth/permission-events",
      billingAdminSessionId,
      workspaceId,
    );
    const acceptDirectInvite = await request(`/api/workspace-invites/${notificationInviteToken}/accept`, externalUserSessionId, undefined, {
      method: "POST",
    });
    expect(acceptDirectInvite.status).toBe(201);
    const notificationsAfterAccept = await request("/api/notifications", externalUserSessionId);
    expect(notificationsAfterAccept.body.find(
      (notification: { id: number }) => notification.id === directInviteNotification.id,
    )).toMatchObject({
      isRead: true,
      workspaceInviteToken: null,
      notificationText: `Hai accettato l'invito allo spazio condiviso Shared workspace ${runId}.`,
    });
    expect(notificationsAfterAccept.body.find(
      (notification: { id: number }) => notification.id === legacyInviteNotification.id,
    )).toMatchObject({
      isRead: true,
      workspaceInviteToken: null,
      notificationText: `Hai accettato l'invito allo spazio condiviso Shared workspace ${runId}.`,
    });
    const [sharedWorkspaceNotification] = await db.insert(notificationsTable).values({
      userId: externalUserId,
      organizationId: workspaceId,
      type: "ticket_commented",
      notificationText: `Shared workspace activity ${runId}`,
      isRead: false,
    }).returning({ id: notificationsTable.id });
    const [inaccessibleWorkspaceNotification] = await db.insert(notificationsTable).values({
      userId: externalUserId,
      organizationId: billingOrganizationId,
      type: "system",
      notificationText: `Unrelated workspace activity ${runId}`,
      isRead: false,
    }).returning({ id: notificationsTable.id });
    const aggregatedNotifications = await request("/api/notifications", externalUserSessionId);
    expect(aggregatedNotifications.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: sharedWorkspaceNotification.id,
        organizationId: workspaceId,
        workspaceName: `Shared workspace ${runId}`,
      }),
    ]));
    expect(aggregatedNotifications.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: inaccessibleWorkspaceNotification.id }),
    ]));
    expect((await request(
      `/api/notifications/${sharedWorkspaceNotification.id}/read`,
      externalUserSessionId,
      undefined,
      { method: "PATCH" },
    )).status).toBe(200);
    expect((await request(
      `/api/notifications/${inaccessibleWorkspaceNotification.id}/read`,
      externalUserSessionId,
      undefined,
      { method: "PATCH" },
    )).status).toBe(404);
    expect((await request(
      "/api/notifications/read-all",
      externalUserSessionId,
      undefined,
      { method: "PATCH" },
    )).status).toBe(200);
    const afterGlobalReadAll = await request("/api/notifications", externalUserSessionId);
    expect(afterGlobalReadAll.body.find(
      (notification: { id: number }) => notification.id === sharedWorkspaceNotification.id,
    )?.isRead).toBe(true);
    await expect(adminPermissionEvent).resolves.toMatchObject({
      status: 200,
      body: {
        type: "workspace_members_changed",
        workspaceId,
        change: "added",
      },
    });
    const acceptedInviteAssignees = await request("/api/users", billingAdminSessionId, workspaceId);
    expect(acceptedInviteAssignees.cacheControl).toBe("no-store");
    expect(acceptedInviteAssignees.body.map((user: { id: number }) => user.id)).toEqual([
      billingAdminId,
      externalUserId,
    ]);
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId)).body.invitations).toEqual([]);
    expect(acceptDirectInvite.body).toMatchObject({ joined: true, workspace: { id: workspaceId } });
    const rejectInviteResponse = await invite(`workspace-outsider-${runId}@example.test`);
    expect(rejectInviteResponse.status).toBe(201);
    const outsiderInviteNotifications = await request("/api/notifications", outsiderSessionId);
    const rejectNotification = outsiderInviteNotifications.body.find(
      (notification: { notificationText: string }) => notification.notificationText.startsWith("Hai ricevuto un invito da "),
    );
    expect(rejectNotification?.workspaceInviteToken).toBeTruthy();
    const rejectInvite = await request(
      `/api/workspace-invites/${rejectNotification.workspaceInviteToken}/reject`,
      outsiderSessionId,
      undefined,
      { method: "POST" },
    );
    expect(rejectInvite.status).toBe(200);
    const notificationsAfterReject = await request("/api/notifications", outsiderSessionId);
    expect(notificationsAfterReject.body.find(
      (notification: { id: number }) => notification.id === rejectNotification.id,
    )).toMatchObject({
      isRead: true,
      workspaceInviteToken: null,
    });
    const inviteAcceptanceText =
      `Workspace External User ha accettato l'invito allo spazio condiviso Shared workspace ${runId}.`;
    const acceptanceNotifications = () => db.select().from(notificationsTable).where(and(
      eq(notificationsTable.userId, billingAdminId),
      eq(notificationsTable.organizationId, workspaceId),
      eq(notificationsTable.notificationText, inviteAcceptanceText),
    ));
    expect(await acceptanceNotifications()).toHaveLength(1);
    const retryAcceptedInvite = await request(
      `/api/workspace-invites/${notificationInviteToken}/accept`,
      externalUserSessionId,
      undefined,
      { method: "POST" },
    );
    expect(retryAcceptedInvite.status).toBe(404);
    expect(await acceptanceNotifications()).toHaveLength(1);
    const externalContext = await request("/api/auth/me", externalUserSessionId, workspaceId);
    expect(externalContext.status).toBe(200);
    expect(externalContext.body).toMatchObject({
      id: externalUserId,
      organizationId: workspaceId,
      billingOrganizationId: externalOrganizationId,
      activeWorkspaceId: workspaceId,
      role: "user",
      isSharedWorkspace: true,
      externalSharingEnabled: true,
    });
    vi.mocked(sendEmailForOrg).mockResolvedValueOnce({ ok: false, error: "SMTP unavailable" });
    const failedDelivery = await invite(`workspace-outsider-${runId}@example.test`);
    expect(failedDelivery.status).toBe(502);
    expect(failedDelivery.body).not.toHaveProperty("inviteUrl");
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId)).body.invitations).toEqual([]);
    const rejectDisableWithMember = await request(`/api/workspaces/${workspaceId}/sharing`, billingAdminSessionId, workspaceId, {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    expect(rejectDisableWithMember.status).toBe(409);
    expect((await request("/api/auth/me", outsiderSessionId, workspaceId)).status).toBe(403);

    const sharedTicket = await request("/api/tickets", externalUserSessionId, workspaceId, {
      method: "POST",
      body: JSON.stringify({
        title: `Shared ticket ${runId}`,
        description: "Created inside the shared workspace.",
        category: "Support",
        priority: "medium",
      }),
    });
    expect(sharedTicket.status).toBe(201);
    sharedTicketId = sharedTicket.body.id;
    const ticketDetails = await request(`/api/tickets/${sharedTicketId}`, externalUserSessionId, workspaceId);
    expect(ticketDetails.status).toBe(200);
    expect(ticketDetails.body.creator.organizationName).toBe(externalOrganizationName);
    const activity = await request(`/api/tickets/${sharedTicketId}/activity`, externalUserSessionId, workspaceId);
    expect(activity.status).toBe(200);
    expect(activity.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        user: expect.objectContaining({ organizationName: externalOrganizationName }),
      }),
    ]));

    const roleChange = await request(
      `/api/workspaces/${workspaceId}/members/${externalUserId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "admin" }) },
    );
    expect(roleChange.status).toBe(200);
    expect((await request("/api/auth/me", externalUserSessionId, workspaceId)).body.role).toBe("admin");
    const demoteAnotherAdmin = await request(
      `/api/workspaces/${workspaceId}/members/${externalUserId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "user" }) },
    );
    expect(demoteAnotherAdmin.status).toBe(200);
    expect(demoteAnotherAdmin.body.membership).toMatchObject({ userId: externalUserId, role: "user" });
    const restoreAnotherAdmin = await request(
      `/api/workspaces/${workspaceId}/members/${externalUserId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "PATCH", body: JSON.stringify({ role: "admin" }) },
    );
    expect(restoreAnotherAdmin.status).toBe(200);

    const externalSeats = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.organizationId, externalOrganizationId), eq(usersTable.isActive, true)));
    expect(externalSeats.map(({ id }) => id)).toEqual(expect.arrayContaining([externalUserId, outsiderId]));
    const homeSeatsAfter = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.organizationId, billingOrganizationId), eq(usersTable.isActive, true)));
    expect(homeSeatsAfter.map(({ id }) => id)).toEqual(homeSeatsBefore.map(({ id }) => id));

    const remove = await request(
      `/api/workspaces/${workspaceId}/members/${externalUserId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(200);
    expect((await request("/api/auth/me", externalUserSessionId, workspaceId)).status).toBe(403);

    const expiredInvite = await invite(`workspace-external-${runId}@example.test`, "user");
    expect(expiredInvite.status).toBe(201);
    const expiredText = vi.mocked(sendEmailForOrg).mock.calls.at(-1)?.[1]?.text ?? "";
    const expiredToken = expiredText.match(/\/app\/workspace-invite\/([^\s]+)/)?.[1];
    if (!expiredToken) throw new Error("Workspace invite email did not include a tokenized link");
    await db.update(workspaceInviteTokensTable)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(workspaceInviteTokensTable.token, expiredToken));

    const pendingForRevocation = await invite(`workspace-outsider-${runId}@example.test`, "admin");
    expect(pendingForRevocation.status).toBe(201);
    const italianInviteEmail = vi.mocked(sendEmailForOrg).mock.calls.at(-1)?.[1];
    expect(italianInviteEmail?.text).toContain("ti ha invitato a collaborare");
    expect(italianInviteEmail?.text).toContain("ora italiana");
    const italianInviteNotification = await request("/api/notifications", outsiderSessionId);
    expect(italianInviteNotification.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        notificationText: expect.stringContaining("Hai ricevuto un invito"),
      }),
    ]));
    const pendingBeforeRevoke = await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId);
    expect(pendingBeforeRevoke.body.invitations).toHaveLength(1);
    expect(pendingBeforeRevoke.body.invitations[0].email).toBe(`workspace-outsider-${runId}@example.test`);
    const invitationId = pendingBeforeRevoke.body.invitations[0].id;
    const revokeInvitation = await request(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, billingAdminSessionId, workspaceId, {
      method: "DELETE",
    });
    expect(revokeInvitation.status).toBe(200);
    expect(revokeInvitation.body).toEqual({ success: true });
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId)).body.invitations).toEqual([]);
    const [workspaceAfterRevoke] = await db.select({ externalSharingEnabled: organizationsTable.externalSharingEnabled })
      .from(organizationsTable).where(eq(organizationsTable.id, workspaceId));
    expect(workspaceAfterRevoke.externalSharingEnabled).toBe(true);
    const revokedText = vi.mocked(sendEmailForOrg).mock.calls.at(-1)?.[1]?.text ?? "";
    const revokedToken = revokedText.match(/\/app\/workspace-invite\/([^\s]+)/)?.[1];
    expect(revokedToken).toBeTruthy();
    expect((await request(`/api/workspace-invites/${revokedToken}`, outsiderSessionId)).status).toBe(404);
    expect((await request(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, billingAdminSessionId, workspaceId, {
      method: "DELETE",
    })).status).toBe(404);

    const linkResponse = await request(`/api/workspaces/${workspaceId}/invite-link`, billingAdminSessionId, workspaceId, {
      method: "POST",
    });
    expect(linkResponse.status).toBe(201);
    expect(linkResponse.body.inviteUrl).toContain("/app/workspace-invite/");
    const token = linkResponse.body.inviteUrl.split("/").at(-1);
    const linkInfo = await request(`/api/workspace-invites/${token}`, outsiderSessionId);
    expect(linkInfo.status).toBe(200);
    expect(linkInfo.body).toMatchObject({ valid: true, workspaceId, workspaceName: expect.any(String) });

    const rejectUnbilledAccount = await request(`/api/workspace-invites/${token}/accept`, unbilledUserSessionId, undefined, {
      method: "POST",
    });
    expect(rejectUnbilledAccount.status).toBe(403);

    const acceptLink = await request(`/api/workspace-invites/${token}/accept`, outsiderSessionId, undefined, {
      method: "POST",
    });
    expect(acceptLink.status).toBe(201);
    expect(acceptLink.body).toMatchObject({ joined: true, workspace: { id: workspaceId } });
    expect((await request("/api/auth/me", outsiderSessionId, workspaceId)).body).toMatchObject({
      id: outsiderId,
      organizationId: workspaceId,
      billingOrganizationId: externalOrganizationId,
    });

    const revokeLink = await request(`/api/workspaces/${workspaceId}/invite-link`, billingAdminSessionId, workspaceId, {
      method: "DELETE",
    });
    expect(revokeLink.status).toBe(200);
    expect((await request(`/api/workspace-invites/${token}`, outsiderSessionId)).status).toBe(404);
    const removeOutsider = await request(
      `/api/workspaces/${workspaceId}/members/${outsiderId}`,
      billingAdminSessionId,
      workspaceId,
      { method: "DELETE" },
    );
    expect(removeOutsider.status).toBe(200);
    const disableSharing = await request(`/api/workspaces/${workspaceId}/sharing`, billingAdminSessionId, workspaceId, {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    expect(disableSharing.status).toBe(200);
    expect(disableSharing.body).toEqual({ externalSharingEnabled: false });
    expect((await request(`/api/workspace-invites/${directToken}`, externalUserSessionId)).status).toBe(404);
  }, 90_000);
});
