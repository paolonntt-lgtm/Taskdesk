import { and, eq } from "drizzle-orm";
import { db, organizationsTable, usersTable, workspaceMembershipsTable } from "@workspace/db";

export interface WorkspaceOption {
  id: number;
  name: string;
  role: string;
  isSharedWorkspace: boolean;
  externalSharingEnabled: boolean;
  billingOwnerOrganizationId: number | null;
}

export async function getUserWorkspaces(userId: number, billingOrganizationId: number | null, homeRole: string): Promise<WorkspaceOption[]> {
  const workspaces: WorkspaceOption[] = [];
  if (billingOrganizationId != null) {
    const [home] = await db.select({
      id: organizationsTable.id,
      name: organizationsTable.name,
      isSharedWorkspace: organizationsTable.isSharedWorkspace,
      externalSharingEnabled: organizationsTable.externalSharingEnabled,
      billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
    }).from(organizationsTable).where(eq(organizationsTable.id, billingOrganizationId));
    if (home) workspaces.push({ ...home, role: homeRole });
  }
  const memberships = await db.select({
    id: organizationsTable.id,
    name: organizationsTable.name,
    role: workspaceMembershipsTable.role,
    isSharedWorkspace: organizationsTable.isSharedWorkspace,
    externalSharingEnabled: organizationsTable.externalSharingEnabled,
    billingOwnerOrganizationId: organizationsTable.billingOwnerOrganizationId,
  }).from(workspaceMembershipsTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, workspaceMembershipsTable.workspaceOrganizationId))
    .where(eq(workspaceMembershipsTable.userId, userId));
  const seen = new Set(workspaces.map((workspace) => workspace.id));
  for (const membership of memberships) {
    if (!seen.has(membership.id)) workspaces.push(membership);
  }
  return workspaces;
}

export async function resolveWorkspaceUser(user: typeof usersTable.$inferSelect, requestedId?: number) {
  if (user.isSuperAdmin && user.organizationId == null && requestedId == null) {
    return { ...user, billingOrganizationId: null, activeWorkspaceId: null, workspaceMemberIds: [], workspaces: [] };
  }
  const workspaceId = requestedId ?? user.organizationId ?? undefined;
  const options = await getUserWorkspaces(user.id, user.organizationId, user.role);
  const workspace = options.find((option) => option.id === workspaceId);
  if (!workspace) return null;

  const memberRows = workspace.id === user.organizationId
    ? await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.organizationId, workspace.id))
    : await db.select({ id: workspaceMembershipsTable.userId, role: workspaceMembershipsTable.role }).from(workspaceMembershipsTable)
        .where(eq(workspaceMembershipsTable.workspaceOrganizationId, workspace.id));

  const context = {
    ...user,
    billingOrganizationId: user.organizationId,
    organizationId: workspace.id,
    organizationName: workspace.name,
    billingOrganizationName: options.find((option) => option.id === user.organizationId)?.name ?? null,
    role: workspace.role,
    activeWorkspaceId: workspace.id,
    isSharedWorkspace: workspace.isSharedWorkspace,
    externalSharingEnabled: workspace.externalSharingEnabled,
    billingOwnerOrganizationId: workspace.billingOwnerOrganizationId,
    workspaceMemberIds: memberRows.map((member) => member.id),
    workspaceAdminMemberIds: memberRows.filter((member) => member.role === "admin").map((member) => member.id),
    workspaces: options,
  };
  return context;
}

export async function isWorkspaceMember(workspaceId: number, userId: number): Promise<boolean> {
  const [workspace] = await db.select({ isSharedWorkspace: organizationsTable.isSharedWorkspace })
    .from(organizationsTable).where(eq(organizationsTable.id, workspaceId));
  if (!workspace) return false;
  if (!workspace.isSharedWorkspace) {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, workspaceId)));
    return !!user;
  }
  const [membership] = await db.select({ id: workspaceMembershipsTable.id })
    .from(workspaceMembershipsTable)
    .where(and(eq(workspaceMembershipsTable.workspaceOrganizationId, workspaceId), eq(workspaceMembershipsTable.userId, userId)));
  return !!membership;
}
