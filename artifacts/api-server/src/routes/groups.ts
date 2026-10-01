import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ALLOWED_PERMISSIONS = ['change_status', 'add_notes', 'edit_fixed_notes', 'edit_client_notes', 'delete_client_notes', 'manage_client_sections', 'edit_client_section_content', 'create_appointments', 'view_worked_hours'] as const;
type GroupPermission = typeof ALLOWED_PERMISSIONS[number];

function parsePermissions(raw: string | null | undefined): GroupPermission[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is GroupPermission => ALLOWED_PERMISSIONS.includes(p as GroupPermission));
  } catch {
    return [];
  }
}

const GroupInput = z.object({
  name: z.string().min(1).max(100),
});

const GroupPermissionsInput = z.object({
  permissions: z.array(z.enum(ALLOWED_PERMISSIONS)),
});

const GroupMemberInput = z.object({
  userId: z.number().int().positive(),
});

const userFields = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  organizationId: usersTable.organizationId,
  mainLocation: usersTable.mainLocation,
  group: usersTable.group,
  groups: usersTable.groups,
  avatarUrl: usersTable.avatarUrl,
  isActive: usersTable.isActive,
  isAvailable: usersTable.isAvailable,
  createdAt: usersTable.createdAt,
};

async function getGroupWithMembers(groupId: number, orgId: number) {
  const [group] = await db
    .select()
    .from(groupsTable)
    .where(
      and(
        eq(groupsTable.id, groupId),
        eq(groupsTable.organizationId, orgId),
      )
    );

  if (!group) return null;

  // Filter joined users by org to prevent cross-org data leakage
  const memberRows = await db
    .select(userFields)
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(usersTable.organizationId, orgId),
      )
    );

  return {
    ...group,
    permissions: parsePermissions(group.permissions),
    memberCount: memberRows.length,
    members: memberRows,
  };
}

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (orgId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const groups = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.organizationId, orgId))
    .orderBy(groupsTable.name);

  if (groups.length === 0) {
    res.json([]);
    return;
  }

  const groupIds = groups.map((g) => g.id);
  // Filter joined users by org to prevent cross-org data leakage
  const allMembers = await db
    .select({ groupId: groupMembersTable.groupId, ...userFields })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(
      and(
        inArray(groupMembersTable.groupId, groupIds),
        eq(usersTable.organizationId, orgId),
      )
    );

  const membersByGroup = new Map<number, typeof allMembers>();
  for (const m of allMembers) {
    const list = membersByGroup.get(m.groupId) ?? [];
    list.push(m);
    membersByGroup.set(m.groupId, list);
  }

  const result = groups.map((g) => {
    const members = membersByGroup.get(g.id) ?? [];
    return { ...g, permissions: parsePermissions(g.permissions), memberCount: members.length, members };
  });

  res.json(result);
});

router.post("/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = GroupInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [group] = await db
    .insert(groupsTable)
    .values({ name: parsed.data.name.trim(), organizationId: currentUser.organizationId })
    .returning();

  res.status(201).json({ ...group, permissions: parsePermissions(group.permissions), memberCount: 0, members: [] });
});

router.put("/groups/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const currentUser = (req as any).currentUser;
  const parsed = GroupInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [updated] = await db
    .update(groupsTable)
    .set({ name: parsed.data.name.trim() })
    .where(
      and(
        eq(groupsTable.id, id),
        eq(groupsTable.organizationId, currentUser.organizationId),
      )
    )
    .returning();

  if (!updated) { res.status(404).json({ error: "Group not found" }); return; }

  const withMembers = await getGroupWithMembers(id, currentUser.organizationId);
  res.json(withMembers);
});

router.patch("/groups/:id/permissions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const currentUser = (req as any).currentUser;
  const parsed = GroupPermissionsInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [updated] = await db
    .update(groupsTable)
    .set({ permissions: JSON.stringify(parsed.data.permissions) })
    .where(
      and(
        eq(groupsTable.id, id),
        eq(groupsTable.organizationId, currentUser.organizationId),
      )
    )
    .returning();

  if (!updated) { res.status(404).json({ error: "Group not found" }); return; }

  res.json({ ...updated, permissions: parsePermissions(updated.permissions) });
});

router.delete("/groups/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const currentUser = (req as any).currentUser;

  const [deleted] = await db
    .delete(groupsTable)
    .where(
      and(
        eq(groupsTable.id, id),
        eq(groupsTable.organizationId, currentUser.organizationId),
      )
    )
    .returning();

  if (!deleted) { res.status(404).json({ error: "Group not found" }); return; }

  res.json({ success: true });
});

router.post("/groups/:id/members", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const parsed = GroupMemberInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  // Verify group belongs to the admin's org
  const [group] = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(
      and(
        eq(groupsTable.id, id),
        eq(groupsTable.organizationId, orgId),
      )
    );
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  // Verify the target user belongs to the same org (prevents cross-org membership)
  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, parsed.data.userId),
        eq(usersTable.organizationId, orgId),
      )
    );
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  await db
    .insert(groupMembersTable)
    .values({ groupId: id, userId: parsed.data.userId })
    .onConflictDoNothing();

  res.json({ success: true });
});

router.delete("/groups/:id/members", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid group ID" }); return; }

  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const parsed = GroupMemberInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  // Verify group belongs to the admin's org
  const [group] = await db
    .select({ id: groupsTable.id })
    .from(groupsTable)
    .where(
      and(
        eq(groupsTable.id, id),
        eq(groupsTable.organizationId, orgId),
      )
    );
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }

  // Verify the target user belongs to the same org (prevents cross-org manipulation)
  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, parsed.data.userId),
        eq(usersTable.organizationId, orgId),
      )
    );
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, id),
        eq(groupMembersTable.userId, parsed.data.userId),
      )
    );

  res.json({ success: true });
});

export default router;
