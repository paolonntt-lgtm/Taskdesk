import { Router, type IRouter } from "express";
import { eq, or, notLike, and, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  ticketsTable,
  notificationsTable,
  inviteTokensTable,
  groupMembersTable,
  groupsTable,
  organizationsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { hashPassword } from "./auth";
import { destroySessionsForUser } from "../lib/session";
import { getSeatUsage, buildSeatLimitError } from "../seatService";
import { stripeStorage } from "../stripeStorage";
import {
  GROUP_PERMISSION_KEYS,
  parsePermissionOverrides,
  resolvePermissionSummary,
} from "../lib/groupPermissions";

const router: IRouter = Router();

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
  hourlyCompensated: usersTable.hourlyCompensated,
  createdAt: usersTable.createdAt,
  permissionOverrides: usersTable.permissionOverrides,
};

async function isTimeTrackingModuleEnabled(organizationId: number | null): Promise<boolean> {
  if (organizationId == null) return false;
  const [organization] = await db
    .select({ enabled: organizationsTable.timeTrackingModuleEnabled })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId));
  return organization?.enabled === true;
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const exposeHourlyCompensation =
    currentUser.role === "admin" && await isTimeTrackingModuleEnabled(orgId);

  if (orgId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const users = await db
    .select(userFields)
    .from(usersTable)
    .where(and(
      notLike(usersTable.email, "deleted-%@deleted.local"),
      eq(usersTable.isSystem, false),
      eq(usersTable.organizationId, orgId),
    ))
    .orderBy(usersTable.name);

  const memberships = users.length > 0
    ? await db
        .select({
          userId: groupMembersTable.userId,
          groupId: groupsTable.id,
          groupName: groupsTable.name,
          groupPermissions: groupsTable.permissions,
        })
        .from(groupMembersTable)
        .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
        .where(
          and(
            inArray(groupMembersTable.userId, users.map((u) => u.id)),
            eq(groupsTable.organizationId, orgId),
          )
        )
    : [];

  const byUser = new Map<number, { id: number; name: string; permissions: string[] }[]>();
  for (const m of memberships) {
    const list = byUser.get(m.userId) ?? [];
    list.push({ id: m.groupId, name: m.groupName, permissions: (m.groupPermissions as string[] | null) ?? [] });
    byUser.set(m.userId, list);
  }

  res.setHeader("Cache-Control", "private, max-age=60");
  res.json(users.map((u) => {
    const groupMemberships = byUser.get(u.id) ?? [];
    const inherited = [...new Set(groupMemberships.flatMap((group) => group.permissions))];
    const permissionOverrides = parsePermissionOverrides(u.permissionOverrides);
    const summary = resolvePermissionSummary(u.role, inherited, permissionOverrides);
    return {
      ...u,
      ...(!exposeHourlyCompensation && { hourlyCompensated: undefined }),
      groupMemberships,
      ...summary,
      permissionOverrides,
    };
  }));
});

router.post("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const { name, email, password, role, mainLocation, group, groups, hourlyCompensated } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing) {
    res.status(409).json({ error: "Email already in use", message: "L'email è già in uso da un altro utente." });
    return;
  }

  const currentUser = (req as any).currentUser;
  const trackingEnabled = await isTimeTrackingModuleEnabled(currentUser.organizationId);
  if (hourlyCompensated !== undefined && !trackingEnabled) {
    res.status(403).json({ error: "Time tracking module is disabled" });
    return;
  }
  const usage = await getSeatUsage(currentUser.organizationId ?? null);
  if (usage.limitReached) {
    res.status(402).json(buildSeatLimitError(usage));
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    organizationId: currentUser.organizationId,
    mainLocation: mainLocation ?? null,
    group: group ?? null,
    groups: groups ? JSON.stringify(groups) : null,
    ...(hourlyCompensated !== undefined && { hourlyCompensated }),
    isActive: true,
  }).returning(userFields);

  res.status(201).json(trackingEnabled ? user : { ...user, hourlyCompensated: undefined });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const currentUser = (req as any).currentUser;
  const exposeHourlyCompensation =
    currentUser.role === "admin" && await isTimeTrackingModuleEnabled(currentUser.organizationId);

  if (currentUser.organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const [user] = await db.select(userFields).from(usersTable).where(
    and(
      eq(usersTable.id, id),
      eq(usersTable.organizationId, currentUser.organizationId),
    )
  );
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const memberships = await db
    .select({ permissions: groupsTable.permissions })
    .from(groupMembersTable)
    .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
    .where(and(
      eq(groupMembersTable.userId, user.id),
      eq(groupsTable.organizationId, currentUser.organizationId),
    ));
  const inherited = [...new Set(memberships.flatMap((membership) => {
    try {
      const parsed: unknown = JSON.parse(membership.permissions ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((permission): permission is string => typeof permission === "string") : [];
    } catch {
      return [];
    }
  }))];
  const permissionOverrides = parsePermissionOverrides(user.permissionOverrides);
  res.json({
    ...user,
    ...(!exposeHourlyCompensation && { hourlyCompensated: undefined }),
    ...resolvePermissionSummary(user.role, inherited, permissionOverrides),
    permissionOverrides,
  });
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const currentUser = (req as any).currentUser;

  if (currentUser.organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const trackingEnabled = await isTimeTrackingModuleEnabled(currentUser.organizationId);
  if (parsed.data.hourlyCompensated !== undefined && !trackingEnabled) {
    res.status(403).json({ error: "Time tracking module is disabled" });
    return;
  }

  const isAdmin = currentUser.role === "admin";
  const isSelf = currentUser.id === id;

  // Non-admins can only update their own isAvailable field
  if (!isAdmin) {
    if (!isSelf) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const allowedKeys = new Set(["isAvailable"]);
    const hasDisallowed = Object.keys(parsed.data).some((k) => !allowedKeys.has(k));
    if (hasDisallowed) {
      res.status(403).json({ error: "Forbidden: only isAvailable can be updated by non-admin users" });
      return;
    }
  }
  if (parsed.data.permissionOverrides !== undefined) {
    const invalidKeys = Object.keys(parsed.data.permissionOverrides).filter(
      (key) => !GROUP_PERMISSION_KEYS.includes(key as typeof GROUP_PERMISSION_KEYS[number]),
    );
    if (invalidKeys.length > 0) {
      res.status(400).json({ error: "Invalid permission override key", keys: invalidKeys });
      return;
    }
  }

  const { password: _ignoredPassword, groups: groupsArray, permissionOverrides, ...rest } = parsed.data;
  const updates: Record<string, unknown> = {
    ...rest,
    ...(groupsArray !== undefined && { groups: groupsArray ? JSON.stringify(groupsArray) : null }),
    ...(permissionOverrides !== undefined && { permissionOverrides: JSON.stringify(permissionOverrides) }),
  };

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (updates.isActive === true) {
    const [target] = await db.select({ isActive: usersTable.isActive }).from(usersTable).where(eq(usersTable.id, id));
    if (target && target.isActive === false) {
      const usage = await getSeatUsage(currentUser.organizationId ?? null);
      if (usage.limitReached) {
        res.status(402).json(buildSeatLimitError(usage));
        return;
      }
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(and(
      eq(usersTable.id, id),
      eq(usersTable.organizationId, currentUser.organizationId),
    ))
    .returning(userFields);

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (updates.isActive === false) {
    await destroySessionsForUser(id);
  }

  if (updates.role === 'user') {
    await stripeStorage.updateUserStripeInfo(id, { stripeCustomerId: null, stripeSubscriptionId: null });
  }

  res.json(isAdmin && trackingEnabled ? updated : { ...updated, hourlyCompensated: undefined });
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const currentUser = (req as any).currentUser;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (id === currentUser?.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, isActive: usersTable.isActive, organizationId: usersTable.organizationId })
    .from(usersTable)
    .where(and(
      eq(usersTable.id, id),
      eq(usersTable.organizationId, currentUser.organizationId),
    ));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await destroySessionsForUser(id);

  await db.transaction(async (tx) => {
    await tx.update(ticketsTable).set({ assignedTo: null }).where(eq(ticketsTable.assignedTo, id));

    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, id));
    await tx.delete(inviteTokensTable).where(
      or(eq(inviteTokensTable.adminId, id), eq(inviteTokensTable.usedById, id))!
    );

    await tx.update(usersTable).set({
      name: "Utente eliminato",
      email: `deleted-${id}-${Date.now()}@deleted.local`,
      passwordHash: randomBytes(32).toString("hex"),
      mainLocation: null,
      group: null,
      avatarUrl: null,
      phone: null,
      isActive: false,
    } as any).where(eq(usersTable.id, id));
  });

  res.json({ success: true, message: "Utente eliminato" });
});

export default router;
