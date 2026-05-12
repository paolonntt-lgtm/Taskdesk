import { Router, type IRouter } from "express";
import { eq, or, notLike, and } from "drizzle-orm";
import {
  db,
  usersTable,
  ticketsTable,
  notificationsTable,
  inviteTokensTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { hashPassword } from "./auth";
import { destroySessionsForUser } from "../lib/session";
import { getSeatUsage, buildSeatLimitError } from "../seatService";
import { stripeStorage } from "../stripeStorage";

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
  createdAt: usersTable.createdAt,
};

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const users = await db
    .select(userFields)
    .from(usersTable)
    .where(and(
      notLike(usersTable.email, "deleted-%@deleted.local"),
      orgId != null ? eq(usersTable.organizationId, orgId) : undefined,
    ))
    .orderBy(usersTable.name);
  res.setHeader("Cache-Control", "private, max-age=60");
  res.json(users);
});

router.post("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const { name, email, password, role, mainLocation, group, groups } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing) {
    res.status(409).json({ error: "Email already in use", message: "L'email è già in uso da un altro utente." });
    return;
  }

  const currentUser = (req as any).currentUser;
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
    isActive: true,
  }).returning(userFields);

  res.status(201).json(user);
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const currentUser = (req as any).currentUser;
  const [user] = await db.select(userFields).from(usersTable).where(
    and(
      eq(usersTable.id, id),
      currentUser.organizationId != null
        ? eq(usersTable.organizationId, currentUser.organizationId)
        : undefined
    )
  );
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
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

  const { password: _ignoredPassword, groups: groupsArray, ...rest } = parsed.data;
  const updates: Record<string, unknown> = {
    ...rest,
    ...(groupsArray !== undefined && { groups: groupsArray ? JSON.stringify(groupsArray) : null }),
  };

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const currentUser = (req as any).currentUser;

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
      currentUser.organizationId != null
        ? eq(usersTable.organizationId, currentUser.organizationId)
        : undefined
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

  res.json(updated);
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
      currentUser.organizationId != null
        ? eq(usersTable.organizationId, currentUser.organizationId)
        : undefined
    ));

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await destroySessionsForUser(id);

  await db.transaction(async (tx) => {
    await tx.update(ticketsTable).set({ assignedTo: null }).where(eq(ticketsTable.assignedTo, id));
    await tx.execute(`UPDATE users SET invited_by_id = NULL WHERE invited_by_id = ${id}` as any);

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
