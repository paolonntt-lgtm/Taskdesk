import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db, organizationsTable, settingsTable, usersTable, workspaceMembershipsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { isWorkspaceMember } from "../lib/workspaceContext";
import { notifyPermissionChanged } from "../lib/permissionEvents";
import { createNotificationForUser } from "../lib/notifications";
import { STANDARD_CATEGORIES, DEFAULT_LOCATIONS } from "./settings";

const router: IRouter = Router();

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
    isActive: usersTable.isActive,
    organizationId: usersTable.organizationId,
  }).from(usersTable).where(eq(usersTable.email, email));
  if (!target || !target.organizationId || !target.isActive) {
    res.status(404).json({ error: "This email must belong to an active account with a billing organization before it can be invited" });
    return;
  }
  const [existing] = await db.select({ id: workspaceMembershipsTable.id }).from(workspaceMembershipsTable)
    .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, target.id)));
  if (existing) {
    res.status(409).json({ error: "This account already belongs to the workspace" });
    return;
  }
  const [membership] = await db.insert(workspaceMembershipsTable).values({
    workspaceOrganizationId: workspaceId,
    userId: target.id,
    role,
    sponsored: false,
  }).returning();
  notifyPermissionChanged(target.id);
  await createNotificationForUser(
    target.id,
    null,
    `${user.name} added you to the shared workspace ${user.organizationName}.`,
    "system",
    workspaceId,
  );
  res.status(201).json({ membership: { userId: membership.userId, role: membership.role } });
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
  res.json({ success: true });
});

export default router;
