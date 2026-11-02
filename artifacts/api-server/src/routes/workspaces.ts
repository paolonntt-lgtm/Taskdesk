import { Router, type IRouter } from "express";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  db, organizationsTable, settingsTable, usersTable, workspaceInviteTokensTable, workspaceMembershipsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { isWorkspaceMember } from "../lib/workspaceContext";
import { notifyPermissionChanged, notifyWorkspaceMembersChanged } from "../lib/permissionEvents";
import { createNotificationForUser } from "../lib/notifications";
import { STANDARD_CATEGORIES, DEFAULT_LOCATIONS } from "./settings";
import { randomBytes } from "crypto";
import { appBaseUrl } from "../lib/appUrl";
import { requireSameOrigin } from "../lib/originCheck";
import { buildWorkspaceInviteEmail, sendEmailForOrg } from "../lib/email";

const router: IRouter = Router();

async function notifyWorkspaceAdminsOfMemberChange(
  workspaceId: number,
  change: "added" | "removed" | "role_changed",
): Promise<void> {
  const admins = await db.select({ userId: workspaceMembershipsTable.userId })
    .from(workspaceMembershipsTable)
    .where(and(
      eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId),
      eq(workspaceMembershipsTable.role, "admin"),
    ));
  for (const admin of admins) {
    notifyWorkspaceMembersChanged(admin.userId, workspaceId, change);
  }
}

router.get("/workspaces", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  res.setHeader("Cache-Control", "no-store");
  res.json({ workspaces: user.workspaces ?? [] });
});

router.post("/workspaces", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (user.organizationId !== user.billingOrganizationId || user.isSharedWorkspace) {
    res.status(403).json({ error: "Only a billing-organization admin can create a shared workspace" });
    return;
  }
  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: "Workspace name must contain 2 to 120 characters" });
    return;
  }
  const workspace = await db.transaction(async (tx) => {
    const [created] = await tx.insert(organizationsTable).values({
      name,
      onboardingDone: true,
      isSharedWorkspace: true,
      externalSharingEnabled: false,
      billingOwnerOrganizationId: user.billingOrganizationId,
      clientsEnabled: false,
    }).returning();
    await tx.insert(workspaceMembershipsTable).values({
      workspaceOrganizationId: created.id,
      userId: user.id,
      role: "admin",
    });
    await tx.insert(settingsTable).values([
      { key: `org_${created.id}_categories`, value: JSON.stringify(STANDARD_CATEGORIES) },
      { key: `org_${created.id}_locations`, value: JSON.stringify(DEFAULT_LOCATIONS) },
    ]).onConflictDoNothing();
    return created;
  });
  res.status(201).json({
    workspace: { id: workspace.id, name: workspace.name, role: "admin", isSharedWorkspace: true,
      externalSharingEnabled: workspace.externalSharingEnabled,
      billingOwnerOrganizationId: workspace.billingOwnerOrganizationId },
  });
});

router.get("/workspaces/:id/members", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || user.organizationId !== workspaceId ||
      !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Workspace access denied" });
    return;
  }
  const members = await db.select({
    userId: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: workspaceMembershipsTable.role,
    billingOrganizationId: usersTable.organizationId,
    billingOrganizationName: organizationsTable.name,
    sponsored: workspaceMembershipsTable.sponsored,
    createdAt: workspaceMembershipsTable.createdAt,
  }).from(workspaceMembershipsTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceMembershipsTable.userId))
    .leftJoin(organizationsTable, eq(organizationsTable.id, usersTable.organizationId))
    .where(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId))
    .orderBy(usersTable.name);
  res.json({ members });
});

router.get("/workspaces/:id/invitations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || user.organizationId !== workspaceId || !user.isSharedWorkspace ||
      !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }
  const invitations = await db.select({
    id: workspaceInviteTokensTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: workspaceInviteTokensTable.inviteeRole,
    expiresAt: workspaceInviteTokensTable.expiresAt,
  }).from(workspaceInviteTokensTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceInviteTokensTable.inviteeUserId))
    .where(and(
      eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
      isNull(workspaceInviteTokensTable.revokedAt),
      isNull(workspaceInviteTokensTable.acceptedAt),
      sql`${workspaceInviteTokensTable.inviteeUserId} IS NOT NULL`,
      sql`${workspaceInviteTokensTable.expiresAt} > NOW()`,
    ))
    .orderBy(workspaceInviteTokensTable.expiresAt);
  res.setHeader("Cache-Control", "no-store");
  res.json({ invitations });
});

router.post("/workspaces/:id/members", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
  const role = req.body?.role === "admin" ? "admin" : "user";
  if (!Number.isInteger(workspaceId) || user.organizationId !== workspaceId || !user.isSharedWorkspace) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  const [target] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    isActive: usersTable.isActive,
    organizationId: usersTable.organizationId,
  }).from(usersTable).where(eq(usersTable.email, email));
  if (!target || !target.organizationId || !target.isActive) {
    res.status(404).json({ error: "This email must belong to an active account with a billing organization before it can be invited" });
    return;
  }
  const [workspace] = await db.select({
    name: organizationsTable.name,
    billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
    externalSharingEnabled: organizationsTable.externalSharingEnabled,
  }).from(organizationsTable).where(eq(organizationsTable.id, workspaceId));
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  const isExternal = target.organizationId !== workspace.billingOwnerOrganizationId;
  const [existing] = await db.select({ id: workspaceMembershipsTable.id }).from(workspaceMembershipsTable)
    .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, target.id)));
  if (existing) {
    res.status(409).json({ error: "This account already belongs to the workspace" });
    return;
  }
  if (isExternal) {
    const [pendingInvite] = await db.select({ id: workspaceInviteTokensTable.id })
      .from(workspaceInviteTokensTable)
      .where(and(
        eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
        eq(workspaceInviteTokensTable.inviteeUserId, target.id),
        isNull(workspaceInviteTokensTable.revokedAt),
        isNull(workspaceInviteTokensTable.acceptedAt),
        sql`${workspaceInviteTokensTable.expiresAt} > NOW()`,
      ));
    if (pendingInvite) {
      res.status(409).json({ error: "This account already has a pending workspace invitation" });
      return;
    }
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [invite] = await db.transaction(async (tx) => {
      await tx.update(organizationsTable).set({ externalSharingEnabled: true })
        .where(eq(organizationsTable.id, workspaceId));
      return tx.insert(workspaceInviteTokensTable).values({
        token,
        workspaceOrganizationId: workspaceId,
        createdByUserId: user.id,
        inviteeUserId: target.id,
        inviteeRole: role,
        expiresAt,
      }).returning({ token: workspaceInviteTokensTable.token });
    });
    const inviteUrl = `${appBaseUrl()}/app/workspace-invite/${invite.token}`;
    const email = buildWorkspaceInviteEmail({
      inviterName: user.name ?? "Admin",
      workspaceName: workspace.name,
      inviteUrl,
      expiresAt,
    });
    let emailSent = false;
    try {
      const result = await sendEmailForOrg(workspace.billingOwnerOrganizationId, {
        to: target.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      emailSent = result.ok;
    } catch (error) {
      req.log.warn({ workspaceId, inviteeUserId: target.id, err: error }, "Workspace invitation email could not be sent");
    }
    if (!emailSent) {
      await db.update(workspaceInviteTokensTable).set({ revokedAt: new Date() })
        .where(and(
          eq(workspaceInviteTokensTable.token, invite.token),
          isNull(workspaceInviteTokensTable.acceptedAt),
        ));
      res.status(502).json({ error: "The invitation email could not be sent. No active invitation was created." });
      return;
    }
    try {
      await createNotificationForUser(
        target.id,
        null,
        `Hai ricevuto un invito da ${user.name ?? "un amministratore"} a collaborare nello spazio condiviso ${workspace.name}. Apri l'email per accettare l'invito.`,
        "system",
        target.organizationId,
      );
    } catch (error) {
      req.log.warn({ workspaceId, inviteeUserId: target.id, err: error }, "Workspace invite notification could not be created");
    }
    res.status(201).json({
      expiresAt,
      pendingAcceptance: true,
      emailSent: true,
    });
    return;
  }
  const [membership] = await db.insert(workspaceMembershipsTable).values({
    workspaceOrganizationId: workspaceId,
    userId: target.id,
    role,
    sponsored: false,
  }).returning();
  notifyPermissionChanged(target.id);
  await notifyWorkspaceAdminsOfMemberChange(workspaceId, "added");
  await createNotificationForUser(
    target.id,
    null,
    `${user.name} added you to the shared workspace ${user.organizationName}.`,
    "system",
    workspaceId,
  );
  res.status(201).json({ membership: { userId: membership.userId, role: membership.role } });
});

router.post("/workspaces/:id/invite-link", requireAuth, requireAdmin, requireSameOrigin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || user.organizationId !== workspaceId || !user.isSharedWorkspace ||
      !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.update(organizationsTable).set({ externalSharingEnabled: true })
      .where(eq(organizationsTable.id, workspaceId));
    await tx.update(workspaceInviteTokensTable).set({ revokedAt: new Date() })
      .where(and(
        eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
        isNull(workspaceInviteTokensTable.inviteeUserId),
        isNull(workspaceInviteTokensTable.revokedAt),
      ));
    await tx.insert(workspaceInviteTokensTable).values({
      token,
      workspaceOrganizationId: workspaceId,
      createdByUserId: user.id,
      expiresAt,
    });
  });

  res.status(201).json({
    inviteUrl: `${appBaseUrl()}/app/workspace-invite/${token}`,
    expiresAt,
  });
});

router.patch("/workspaces/:id/sharing", requireAuth, requireAdmin, requireSameOrigin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  const enabled = req.body?.enabled;
  if (!Number.isInteger(workspaceId) || typeof enabled !== "boolean") {
    res.status(400).json({ error: "A valid workspace and sharing setting are required" });
    return;
  }
  if (user.organizationId !== workspaceId || !user.isSharedWorkspace ||
      !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Workspace administrator access required" });
    return;
  }
  const [workspace] = await db.select({
    id: organizationsTable.id,
    billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
  }).from(organizationsTable).where(eq(organizationsTable.id, workspaceId));
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM organizations WHERE id = ${workspaceId} FOR UPDATE`);
    if (!enabled) {
      const externalMembers = await tx.select({ userId: workspaceMembershipsTable.userId })
        .from(workspaceMembershipsTable)
        .innerJoin(usersTable, eq(usersTable.id, workspaceMembershipsTable.userId))
        .where(and(
          eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId),
          sql`${usersTable.organizationId} IS DISTINCT FROM ${workspace.billingOwnerOrganizationId}`,
        ));
      if (externalMembers.length) return false;
      await tx.update(workspaceInviteTokensTable).set({ revokedAt: new Date() })
        .where(and(
          eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
          isNull(workspaceInviteTokensTable.revokedAt),
        ));
    }
    await tx.update(organizationsTable).set({ externalSharingEnabled: enabled })
      .where(eq(organizationsTable.id, workspaceId));
    return true;
  });
  if (!updated) {
    res.status(409).json({ error: "Remove all members from other organizations before disabling sharing" });
    return;
  }
  res.json({ externalSharingEnabled: enabled });
});

router.delete("/workspaces/:id/invite-link", requireAuth, requireAdmin, requireSameOrigin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || user.organizationId !== workspaceId || !user.isSharedWorkspace ||
      !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }

  await db.update(workspaceInviteTokensTable).set({ revokedAt: new Date() })
    .where(and(
      eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
      isNull(workspaceInviteTokensTable.inviteeUserId),
      isNull(workspaceInviteTokensTable.revokedAt),
    ));
  res.json({ success: true });
});

router.delete("/workspaces/:id/invitations/:invitationId", requireAuth, requireAdmin, requireSameOrigin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const invitationId = Number(req.params.invitationId);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || !Number.isInteger(invitationId) || user.organizationId !== workspaceId ||
      !user.isSharedWorkspace || !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }
  const [revoked] = await db.update(workspaceInviteTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(workspaceInviteTokensTable.id, invitationId),
      eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
      isNotNull(workspaceInviteTokensTable.inviteeUserId),
      isNull(workspaceInviteTokensTable.revokedAt),
      isNull(workspaceInviteTokensTable.acceptedAt),
      sql`${workspaceInviteTokensTable.expiresAt} > NOW()`,
    ))
    .returning({ id: workspaceInviteTokensTable.id });
  if (!revoked) {
    res.status(404).json({ error: "Pending workspace invitation not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/workspaces/:id/invitations/:invitationId/resend", requireAuth, requireAdmin, requireSameOrigin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const invitationId = Number(req.params.invitationId);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || !Number.isInteger(invitationId) || user.organizationId !== workspaceId ||
      !user.isSharedWorkspace || !(await isWorkspaceMember(workspaceId, user.id))) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }

  const [workspace] = await db.select({
    name: organizationsTable.name,
    billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
    externalSharingEnabled: organizationsTable.externalSharingEnabled,
  }).from(organizationsTable).where(eq(organizationsTable.id, workspaceId));
  if (!workspace?.externalSharingEnabled) {
    res.status(404).json({ error: "Active pending workspace invitation not found" });
    return;
  }

  const [invitation] = await db.select({
    token: workspaceInviteTokensTable.token,
    inviteeUserId: workspaceInviteTokensTable.inviteeUserId,
    expiresAt: workspaceInviteTokensTable.expiresAt,
    email: usersTable.email,
    isActive: usersTable.isActive,
  }).from(workspaceInviteTokensTable)
    .innerJoin(usersTable, eq(usersTable.id, workspaceInviteTokensTable.inviteeUserId))
    .where(and(
      eq(workspaceInviteTokensTable.id, invitationId),
      eq(workspaceInviteTokensTable.workspaceOrganizationId, workspaceId),
      isNotNull(workspaceInviteTokensTable.inviteeUserId),
      isNull(workspaceInviteTokensTable.revokedAt),
      isNull(workspaceInviteTokensTable.acceptedAt),
      sql`${workspaceInviteTokensTable.expiresAt} > NOW()`,
    ));
  if (!invitation || !invitation.isActive || !invitation.email) {
    res.status(404).json({ error: "Active pending workspace invitation not found" });
    return;
  }

  const email = buildWorkspaceInviteEmail({
    inviterName: user.name ?? "Admin",
    workspaceName: workspace.name,
    inviteUrl: `${appBaseUrl()}/app/workspace-invite/${invitation.token}`,
    expiresAt: invitation.expiresAt,
  });
  try {
    const result = await sendEmailForOrg(workspace.billingOwnerOrganizationId, {
      to: invitation.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (!result.ok) {
      res.status(502).json({ error: "The invitation email could not be sent. The existing invitation remains valid." });
      return;
    }
  } catch (error) {
    req.log.warn({ workspaceId, invitationId, inviteeUserId: invitation.inviteeUserId, err: error }, "Workspace invitation email could not be resent");
    res.status(502).json({ error: "The invitation email could not be sent. The existing invitation remains valid." });
    return;
  }

  res.json({ emailSent: true, email: invitation.email });
});

router.get("/workspace-invites/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const [invite] = await db.select({
    workspaceId: workspaceInviteTokensTable.workspaceOrganizationId,
    createdByUserId: workspaceInviteTokensTable.createdByUserId,
    inviteeUserId: workspaceInviteTokensTable.inviteeUserId,
    acceptedAt: workspaceInviteTokensTable.acceptedAt,
    expiresAt: workspaceInviteTokensTable.expiresAt,
    revokedAt: workspaceInviteTokensTable.revokedAt,
  }).from(workspaceInviteTokensTable)
    .where(eq(workspaceInviteTokensTable.token, token));
  if (!invite || invite.revokedAt || (invite.inviteeUserId != null && invite.acceptedAt)) {
    res.status(404).json({ valid: false, message: "Link non valido" });
    return;
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    res.status(410).json({ valid: false, message: "Link scaduto" });
    return;
  }
  const [workspace] = await db.select({
    name: organizationsTable.name,
    isSharedWorkspace: organizationsTable.isSharedWorkspace,
    externalSharingEnabled: organizationsTable.externalSharingEnabled,
  })
    .from(organizationsTable).where(eq(organizationsTable.id, invite.workspaceId));
  if (!workspace?.isSharedWorkspace || !workspace.externalSharingEnabled) {
    res.status(404).json({ valid: false, message: "Spazio non disponibile" });
    return;
  }
  const [creator] = await db.select({ name: usersTable.name }).from(usersTable)
    .where(eq(usersTable.id, invite.createdByUserId));
  res.json({
    valid: true,
    workspaceId: invite.workspaceId,
    workspaceName: workspace.name,
    targeted: invite.inviteeUserId != null,
    inviterName: creator?.name ?? "Admin",
    expiresAt: invite.expiresAt,
  });
});

router.post("/workspace-invites/:token/accept", requireAuth, requireSameOrigin, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const token = String(req.params.token);
  const [invite] = await db.select({
    workspaceId: workspaceInviteTokensTable.workspaceOrganizationId,
    createdByUserId: workspaceInviteTokensTable.createdByUserId,
    inviteeUserId: workspaceInviteTokensTable.inviteeUserId,
    inviteeRole: workspaceInviteTokensTable.inviteeRole,
    acceptedAt: workspaceInviteTokensTable.acceptedAt,
    expiresAt: workspaceInviteTokensTable.expiresAt,
    revokedAt: workspaceInviteTokensTable.revokedAt,
  }).from(workspaceInviteTokensTable)
    .where(eq(workspaceInviteTokensTable.token, token));
  if (!invite || invite.revokedAt || (invite.inviteeUserId != null && invite.acceptedAt)) {
    res.status(404).json({ error: "Link non valido" });
    return;
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    res.status(410).json({ error: "Link scaduto" });
    return;
  }
  const [workspace] = await db.select({
    id: organizationsTable.id,
    name: organizationsTable.name,
    isSharedWorkspace: organizationsTable.isSharedWorkspace,
    externalSharingEnabled: organizationsTable.externalSharingEnabled,
    billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
  }).from(organizationsTable).where(eq(organizationsTable.id, invite.workspaceId));
  if (!workspace?.isSharedWorkspace || !workspace.externalSharingEnabled) {
    res.status(404).json({ error: "Spazio non disponibile" });
    return;
  }
  const [account] = await db.select({
    isActive: usersTable.isActive,
    organizationId: usersTable.organizationId,
    name: usersTable.name,
    email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, user.id));
  if (!account?.isActive || account.organizationId == null) {
    res.status(403).json({ error: "È necessario un account attivo con un'organizzazione di fatturazione" });
    return;
  }
  if (invite.inviteeUserId != null && invite.inviteeUserId !== user.id) {
    res.status(403).json({ error: "This invitation was issued to a different account" });
    return;
  }
  if (account.organizationId !== workspace.billingOwnerOrganizationId && !workspace.externalSharingEnabled) {
    res.status(403).json({ error: "External sharing is disabled for this workspace" });
    return;
  }
  const acceptance = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM organizations WHERE id = ${workspace.id} FOR UPDATE`);
    const [freshWorkspace] = await tx.select({
      externalSharingEnabled: organizationsTable.externalSharingEnabled,
    }).from(organizationsTable).where(eq(organizationsTable.id, workspace.id));
    if (!freshWorkspace?.externalSharingEnabled) {
      return { sharingDisabled: true, membership: undefined };
    }
    const [created] = await tx.insert(workspaceMembershipsTable).values({
      workspaceOrganizationId: workspace.id,
      userId: user.id,
      role: invite.inviteeUserId != null ? invite.inviteeRole : "user",
      sponsored: false,
    }).onConflictDoNothing().returning({ userId: workspaceMembershipsTable.userId });
    if (invite.inviteeUserId != null) {
      await tx.update(workspaceInviteTokensTable).set({ acceptedAt: new Date() })
        .where(and(
          eq(workspaceInviteTokensTable.token, token),
          isNull(workspaceInviteTokensTable.acceptedAt),
        ));
    }
    return { sharingDisabled: false, membership: created };
  });
  if (acceptance.sharingDisabled) {
    res.status(403).json({ error: "External sharing is disabled for this workspace" });
    return;
  }
  const membership = acceptance.membership;
  if (!membership && invite.inviteeUserId != null) {
    res.status(409).json({ error: "This invitation has already been used" });
    return;
  }
  if (membership) {
    notifyPermissionChanged(user.id);
    await notifyWorkspaceAdminsOfMemberChange(workspace.id, "added");
    await createNotificationForUser(
      invite.createdByUserId,
      null,
      `${account.name ?? account.email ?? "Un utente"} ha accettato l'invito allo spazio condiviso ${workspace.name}.`,
      "system",
      workspace.id,
    );
  }
  res.status(membership ? 201 : 200).json({
    joined: !!membership,
    alreadyMember: !membership,
    workspace: { id: workspace.id, name: workspace.name },
  });
});

router.patch("/workspaces/:id/members/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const user = (req as any).currentUser;
  const role = req.body?.role;
  if (!Number.isInteger(workspaceId) || !Number.isInteger(userId) || user.organizationId !== workspaceId || !user.isSharedWorkspace) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }
  if (role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Role must be admin or user" });
    return;
  }
  if (role === "user") {
    const admins = await db.select({ id: workspaceMembershipsTable.userId }).from(workspaceMembershipsTable)
      .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.role, "admin")));
    const [target] = await db.select({ role: workspaceMembershipsTable.role }).from(workspaceMembershipsTable)
      .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, userId)));
    if (target?.role === "admin" && admins.length <= 1) {
      res.status(409).json({ error: "A workspace must keep at least one administrator" });
      return;
    }
  }
  const [updated] = await db.update(workspaceMembershipsTable).set({ role })
    .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, userId)))
    .returning({ userId: workspaceMembershipsTable.userId, role: workspaceMembershipsTable.role });
  if (!updated) {
    res.status(404).json({ error: "Workspace member not found" });
    return;
  }
  notifyPermissionChanged(userId);
  await notifyWorkspaceAdminsOfMemberChange(workspaceId, "role_changed");
  res.json({ membership: updated });
});

router.delete("/workspaces/:id/members/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const user = (req as any).currentUser;
  if (!Number.isInteger(workspaceId) || !Number.isInteger(userId) || user.organizationId !== workspaceId || !user.isSharedWorkspace) {
    res.status(403).json({ error: "Shared-workspace administrator access required" });
    return;
  }
  const [target] = await db.select({ role: workspaceMembershipsTable.role }).from(workspaceMembershipsTable)
    .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, userId)));
  if (!target) {
    res.status(404).json({ error: "Workspace member not found" });
    return;
  }
  if (target.role === "admin") {
    const admins = await db.select({ id: workspaceMembershipsTable.userId }).from(workspaceMembershipsTable)
      .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.role, "admin")));
    if (admins.length <= 1) {
      res.status(409).json({ error: "A workspace must keep at least one administrator" });
      return;
    }
  }
  await db.delete(workspaceMembershipsTable).where(and(
    eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId),
    eq(workspaceMembershipsTable.userId, userId),
  ));
  notifyPermissionChanged(userId);
  await notifyWorkspaceAdminsOfMemberChange(workspaceId, "removed");
  res.json({ success: true });
});

export default router;
