import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, appointmentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { hasGroupPermission } from "../lib/groupPermissions";
import { z } from "zod";

const router: IRouter = Router();

const AppointmentBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string().nullable().optional(),
  assignedTo: z.number().int().nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
});

async function withUsers(appt: typeof appointmentsTable.$inferSelect) {
  const ids = [...new Set([appt.createdBy, ...(appt.assignedTo ? [appt.assignedTo] : [])])];
  const users = ids.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(inArray(usersTable.id, ids))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return {
    ...appt,
    creator: userMap.get(appt.createdBy) ?? null,
    assignee: appt.assignedTo ? (userMap.get(appt.assignedTo) ?? null) : null,
  };
}

router.get("/appointments", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const { year, month } = req.query as Record<string, string>;

  const conditions: any[] = orgId != null ? [eq(appointmentsTable.organizationId, orgId)] : [];

  if (year && month) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    conditions.push(gte(appointmentsTable.startsAt, start));
    conditions.push(lte(appointmentsTable.startsAt, end));
  }

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(appointmentsTable.startsAt);

  const results = await Promise.all(appts.map(withUsers));
  res.json(results);
});

router.post("/appointments", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (orgId == null) {
    res.status(403).json({ error: "No organization" });
    return;
  }

  const isAdmin = currentUser.role === "admin";
  if (!isAdmin) {
    const canCreate = await hasGroupPermission(currentUser.id, orgId, "create_appointments", false, req);
    if (!canCreate) {
      res.status(403).json({ error: "Forbidden: missing create_appointments permission" });
      return;
    }
  }

  const parsed = AppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { title, description, startsAt, endsAt, assignedTo, reminderMinutes } = parsed.data;

  if (assignedTo != null) {
    const [assigneeUser] = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, assignedTo), eq(usersTable.organizationId, orgId)));
    if (!assigneeUser) {
      res.status(400).json({ error: "Assignee not found in organization" });
      return;
    }
  }

  const [appt] = await db.insert(appointmentsTable).values({
    organizationId: orgId,
    title,
    description: description ?? null,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
    createdBy: currentUser.id,
    assignedTo: assignedTo ?? null,
    reminderMinutes: reminderMinutes ?? 60,
  }).returning();

  res.status(201).json(await withUsers(appt));
});

router.get("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable).where(
    and(
      eq(appointmentsTable.id, id),
      orgId != null ? eq(appointmentsTable.organizationId, orgId) : undefined
    )
  );

  if (!appt) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(await withUsers(appt));
});

router.put("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const isAdmin = currentUser.role === "admin";
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db.select().from(appointmentsTable).where(
    and(
      eq(appointmentsTable.id, id),
      orgId != null ? eq(appointmentsTable.organizationId, orgId) : undefined
    )
  );

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!isAdmin && existing.createdBy !== currentUser.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = AppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { title, description, startsAt, endsAt, assignedTo, reminderMinutes } = parsed.data;

  if (assignedTo != null && orgId != null) {
    const [assigneeUser] = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, assignedTo), eq(usersTable.organizationId, orgId)));
    if (!assigneeUser) {
      res.status(400).json({ error: "Assignee not found in organization" });
      return;
    }
  }

  const newStartsAt = new Date(startsAt);
  const startChanged = newStartsAt.getTime() !== existing.startsAt.getTime();
  const reminderChanged = reminderMinutes !== undefined && reminderMinutes !== existing.reminderMinutes;
  const resetReminder = startChanged || reminderChanged;

  const [updated] = await db
    .update(appointmentsTable)
    .set({
      title,
      description: description ?? null,
      startsAt: newStartsAt,
      endsAt: endsAt ? new Date(endsAt) : null,
      assignedTo: assignedTo ?? null,
      ...(reminderMinutes !== undefined ? { reminderMinutes } : {}),
      ...(resetReminder ? { reminderSentAt: null } : {}),
    })
    .where(eq(appointmentsTable.id, id))
    .returning();

  res.json(await withUsers(updated));
});

router.delete("/appointments/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const isAdmin = currentUser.role === "admin";
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db.select().from(appointmentsTable).where(
    and(
      eq(appointmentsTable.id, id),
      orgId != null ? eq(appointmentsTable.organizationId, orgId) : undefined
    )
  );

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!isAdmin && existing.createdBy !== currentUser.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, id));
  res.status(204).end();
});

export default router;
