import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  notificationsTable,
  organizationsTable,
  pool,
  sessionsTable,
  settingsTable,
  ticketsTable,
  usersTable,
  workspaceInviteTokensTable,
  workspaceMembershipsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

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
): Promise<{ status: number; body: any }> {
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
  return { status: response.status, body };
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

    const invite = (email: string, role = "user") => request(
      `/api/workspaces/${workspaceId}/members`,
      billingAdminSessionId,
      workspaceId,
      { method: "POST", body: JSON.stringify({ email, role }) },
    );
    const inviteResponse = await invite(`workspace-external-${runId}@example.test`);
    expect(inviteResponse.status).toBe(201);
    expect(inviteResponse.body).toMatchObject({ pendingAcceptance: true });
    expect(inviteResponse.body.inviteUrl).toContain("/app/workspace-invite/");
    const directToken = inviteResponse.body.inviteUrl.split("/").at(-1);
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
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, externalUserSessionId, workspaceId)).status).toBe(403);
    expect((await request(
      `/api/workspaces/${workspaceId}/invitations/${pendingInvitationId}`,
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

    const rejectWrongInvitee = await request(`/api/workspace-invites/${directToken}/accept`, outsiderSessionId, undefined, {
      method: "POST",
    });
    expect(rejectWrongInvitee.status).toBe(403);
    const acceptDirectInvite = await request(`/api/workspace-invites/${directToken}/accept`, externalUserSessionId, undefined, {
      method: "POST",
    });
    expect(acceptDirectInvite.status).toBe(201);
    expect((await request(`/api/workspaces/${workspaceId}/invitations`, billingAdminSessionId, workspaceId)).body.invitations).toEqual([]);
    expect(acceptDirectInvite.body).toMatchObject({ joined: true, workspace: { id: workspaceId } });
    const externalContext = await request("/api/auth/me", externalUserSessionId, workspaceId);
    expect(externalContext.status).toBe(200);
    expect(externalContext.body).toMatchObject({
      id: externalUserId,
      organizationId: workspaceId,
      billingOrganizationId: externalOrganizationId,
      activeWorkspaceId: workspaceId,
      role: "user",
      isSharedWorkspace: true,
    });
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
    const expiredToken = expiredInvite.body.inviteUrl.split("/").at(-1);
    await db.update(workspaceInviteTokensTable)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(workspaceInviteTokensTable.token, expiredToken));

    const pendingForRevocation = await invite(`workspace-outsider-${runId}@example.test`, "admin");
    expect(pendingForRevocation.status).toBe(201);
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
    expect((await request(`/api/workspace-invites/${pendingForRevocation.body.inviteUrl.split("/").at(-1)}`, outsiderSessionId)).status).toBe(404);
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
  }, 60_000);
});
