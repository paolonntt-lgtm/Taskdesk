import { Router, type IRouter } from "express";
import { eq, and, asc, inArray, sql } from "drizzle-orm";
import { db, ticketStatusesTable, ticketsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getDefaultStatuses } from "@workspace/db";

const router: IRouter = Router();

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[àáâãä]/g, "a")
    .replace(/[èéêëẽ]/g, "e")
    .replace(/[ìíîïĩ]/g, "i")
    .replace(/[òóôõöõ]/g, "o")
    .replace(/[ùúûüũ]/g, "u")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

router.get("/settings/ticket-statuses", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) {
    res.json([]);
    return;
  }

  const statuses = await db
    .select()
    .from(ticketStatusesTable)
    .where(eq(ticketStatusesTable.organizationId, orgId))
    .orderBy(asc(ticketStatusesTable.sortOrder));

  res.json(statuses);
});

router.post("/settings/ticket-statuses/reorder", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (!orgId) {
    res.status(400).json({ error: "Organization required" });
    return;
  }

  const { order } = req.body ?? {};
  if (!Array.isArray(order) || order.some((o) => typeof o?.id !== "number" || typeof o?.sortOrder !== "number")) {
    res.status(400).json({ error: "order must be an array of {id, sortOrder} objects" });
    return;
  }

  const ids = order.map((o: { id: number; sortOrder: number }) => o.id);

  const existing = await db
    .select({ id: ticketStatusesTable.id })
    .from(ticketStatusesTable)
    .where(and(eq(ticketStatusesTable.organizationId, orgId), inArray(ticketStatusesTable.id, ids)));

  const validIds = new Set(existing.map((s) => s.id));

  await db.transaction(async (tx) => {
    for (const item of order as { id: number; sortOrder: number }[]) {
      if (validIds.has(item.id)) {
        await tx
          .update(ticketStatusesTable)
          .set({ sortOrder: item.sortOrder })
          .where(and(eq(ticketStatusesTable.id, item.id), eq(ticketStatusesTable.organizationId, orgId)));
      }
    }
  });

  const updated = await db
    .select()
    .from(ticketStatusesTable)
    .where(eq(ticketStatusesTable.organizationId, orgId))
    .orderBy(asc(ticketStatusesTable.sortOrder));

  res.json(updated);
});

router.post("/settings/ticket-statuses", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) {
    res.status(400).json({ error: "Organization required" });
    return;
  }

  const { label, color, isDefault, isClosed } = req.body ?? {};
  if (!label || typeof label !== "string" || !label.trim()) {
    res.status(400).json({ error: "Label is required" });
    return;
  }

  const existing = await db
    .select()
    .from(ticketStatusesTable)
    .where(eq(ticketStatusesTable.organizationId, orgId))
    .orderBy(asc(ticketStatusesTable.sortOrder));

  let key = slugify(label.trim());
  const usedKeys = new Set(existing.map((s) => s.key));
  if (usedKeys.has(key)) {
    let i = 2;
    while (usedKeys.has(`${key}_${i}`)) i++;
    key = `${key}_${i}`;
  }

  const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0;

  if (isDefault === true) {
    await db
      .update(ticketStatusesTable)
      .set({ isDefault: false })
      .where(eq(ticketStatusesTable.organizationId, orgId));
  }

  const [created] = await db.insert(ticketStatusesTable).values({
    organizationId: orgId,
    key,
    label: label.trim(),
    color: color ?? null,
    sortOrder: nextOrder,
    isDefault: isDefault === true,
    isClosed: isClosed === true,
  }).returning();

  res.status(201).json(created);
});

router.put("/settings/ticket-statuses/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const statusId = parseInt(String(req.params.id), 10);

  if (!orgId || isNaN(statusId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [existing] = await db
    .select()
    .from(ticketStatusesTable)
    .where(and(eq(ticketStatusesTable.id, statusId), eq(ticketStatusesTable.organizationId, orgId)));

  if (!existing) {
    res.status(404).json({ error: "Status not found" });
    return;
  }

  const { label, color, isDefault, isClosed, sortOrder } = req.body ?? {};

  const updates: Record<string, unknown> = {};
  if (label !== undefined && typeof label === "string" && label.trim()) {
    updates.label = label.trim();
  }
  if (color !== undefined) updates.color = color ?? null;
  if (sortOrder !== undefined && typeof sortOrder === "number") updates.sortOrder = sortOrder;
  if (isClosed !== undefined) updates.isClosed = isClosed === true;

  if (isDefault === true && !existing.isDefault) {
    await db
      .update(ticketStatusesTable)
      .set({ isDefault: false })
      .where(eq(ticketStatusesTable.organizationId, orgId));
    updates.isDefault = true;
  } else if (isDefault === false) {
    updates.isDefault = false;
  }

  const [updated] = await db
    .update(ticketStatusesTable)
    .set(updates as any)
    .where(and(eq(ticketStatusesTable.id, statusId), eq(ticketStatusesTable.organizationId, orgId)))
    .returning();

  res.json(updated);
});

router.delete("/settings/ticket-statuses/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const statusId = parseInt(String(req.params.id), 10);

  if (!orgId || isNaN(statusId)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [existing] = await db
    .select()
    .from(ticketStatusesTable)
    .where(and(eq(ticketStatusesTable.id, statusId), eq(ticketStatusesTable.organizationId, orgId)));

  if (!existing) {
    res.status(404).json({ error: "Status not found" });
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.status, existing.key), eq(ticketsTable.organizationId, orgId)));

  const ticketCount = Number(count);
  if (ticketCount > 0) {
    res.status(409).json({ error: `Cannot delete: ${ticketCount} ticket(s) currently use this status`, ticketCount, count: ticketCount });
    return;
  }

  await db
    .delete(ticketStatusesTable)
    .where(and(eq(ticketStatusesTable.id, statusId), eq(ticketStatusesTable.organizationId, orgId)));

  res.json({ success: true });
});

export { getDefaultStatuses };
export default router;
