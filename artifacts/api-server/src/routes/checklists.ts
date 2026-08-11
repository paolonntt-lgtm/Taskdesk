import { Router, type IRouter } from "express";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db, ticketsTable, ticketChecklistsTable, ticketChecklistItemsTable, ticketActivityLogsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

async function getTicketForUser(ticketId: number, orgId: number | null) {
  const [ticket] = await db
    .select({ id: ticketsTable.id, organizationId: ticketsTable.organizationId })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.id, ticketId),
        orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
      )
    );
  return ticket ?? null;
}

async function getChecklistForTicket(checklistId: number, ticketId: number) {
  const [checklist] = await db
    .select()
    .from(ticketChecklistsTable)
    .where(and(eq(ticketChecklistsTable.id, checklistId), eq(ticketChecklistsTable.ticketId, ticketId)));
  return checklist ?? null;
}

async function buildChecklistWithItems(checklistId: number) {
  const [checklist] = await db
    .select()
    .from(ticketChecklistsTable)
    .where(eq(ticketChecklistsTable.id, checklistId));
  if (!checklist) return null;
  const rawItems = await db
    .select({
      id: ticketChecklistItemsTable.id,
      checklistId: ticketChecklistItemsTable.checklistId,
      orgId: ticketChecklistItemsTable.orgId,
      text: ticketChecklistItemsTable.text,
      checked: ticketChecklistItemsTable.checked,
      position: ticketChecklistItemsTable.position,
      checkedAt: ticketChecklistItemsTable.checkedAt,
      checkedByName: usersTable.name,
      createdAt: ticketChecklistItemsTable.createdAt,
      updatedAt: ticketChecklistItemsTable.updatedAt,
    })
    .from(ticketChecklistItemsTable)
    .leftJoin(usersTable, eq(ticketChecklistItemsTable.checkedById, usersTable.id))
    .where(eq(ticketChecklistItemsTable.checklistId, checklistId))
    .orderBy(asc(ticketChecklistItemsTable.position), asc(ticketChecklistItemsTable.id));
  return { ...checklist, items: rawItems };
}

function parseParam(p: string | string[]): number {
  return parseInt(Array.isArray(p) ? p[0] : p, 10);
}

router.get("/tickets/:ticketId/checklists", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklists = await db
    .select()
    .from(ticketChecklistsTable)
    .where(eq(ticketChecklistsTable.ticketId, ticketId))
    .orderBy(asc(ticketChecklistsTable.position), asc(ticketChecklistsTable.id));

  if (checklists.length === 0) {
    res.json([]);
    return;
  }

  const checklistIds = checklists.map((cl) => cl.id);
  const items = await db
    .select({
      id: ticketChecklistItemsTable.id,
      checklistId: ticketChecklistItemsTable.checklistId,
      orgId: ticketChecklistItemsTable.orgId,
      text: ticketChecklistItemsTable.text,
      checked: ticketChecklistItemsTable.checked,
      position: ticketChecklistItemsTable.position,
      checkedAt: ticketChecklistItemsTable.checkedAt,
      checkedByName: usersTable.name,
      createdAt: ticketChecklistItemsTable.createdAt,
      updatedAt: ticketChecklistItemsTable.updatedAt,
    })
    .from(ticketChecklistItemsTable)
    .leftJoin(usersTable, eq(ticketChecklistItemsTable.checkedById, usersTable.id))
    .where(inArray(ticketChecklistItemsTable.checklistId, checklistIds))
    .orderBy(asc(ticketChecklistItemsTable.position), asc(ticketChecklistItemsTable.id));

  const itemsByChecklist = new Map<number, typeof items>();
  for (const item of items) {
    if (!itemsByChecklist.has(item.checklistId)) itemsByChecklist.set(item.checklistId, []);
    itemsByChecklist.get(item.checklistId)!.push(item);
  }

  const result = checklists.map((cl) => ({ ...cl, items: itemsByChecklist.get(cl.id) ?? [] }));
  res.json(result);
});

router.post("/tickets/:ticketId/checklists", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const parsed = z.object({ title: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", message: parsed.error.message }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const existing = await db
    .select({ position: ticketChecklistsTable.position })
    .from(ticketChecklistsTable)
    .where(eq(ticketChecklistsTable.ticketId, ticketId))
    .orderBy(asc(ticketChecklistsTable.position));

  const nextPos = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [checklist] = await db.insert(ticketChecklistsTable).values({
    ticketId,
    orgId: orgId ?? null,
    title: parsed.data.title,
    position: nextPos,
  }).returning();

  res.status(201).json({ ...checklist, items: [] });
});

router.patch("/tickets/:ticketId/checklists/:checklistId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const checklistId = parseParam(req.params.checklistId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(checklistId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklist = await getChecklistForTicket(checklistId, ticketId);
  if (!checklist) { res.status(404).json({ error: "Checklist not found" }); return; }

  const parsed = z.object({ title: z.string().min(1).optional(), position: z.number().int().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  if (!parsed.data.title && parsed.data.position === undefined) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  const updates: { title?: string; position?: number } = {};
  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;

  await db.update(ticketChecklistsTable).set(updates).where(eq(ticketChecklistsTable.id, checklistId));

  const result = await buildChecklistWithItems(checklistId);
  res.json(result);
});

router.delete("/tickets/:ticketId/checklists/:checklistId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const checklistId = parseParam(req.params.checklistId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(checklistId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklist = await getChecklistForTicket(checklistId, ticketId);
  if (!checklist) { res.status(404).json({ error: "Checklist not found" }); return; }

  await db.delete(ticketChecklistsTable).where(eq(ticketChecklistsTable.id, checklistId));

  res.json({ success: true });
});

router.post("/tickets/:ticketId/checklists/:checklistId/items", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const checklistId = parseParam(req.params.checklistId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(checklistId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklist = await getChecklistForTicket(checklistId, ticketId);
  if (!checklist) { res.status(404).json({ error: "Checklist not found" }); return; }

  const existingItems = await db
    .select({ position: ticketChecklistItemsTable.position })
    .from(ticketChecklistItemsTable)
    .where(eq(ticketChecklistItemsTable.checklistId, checklistId))
    .orderBy(asc(ticketChecklistItemsTable.position));

  const nextPos = existingItems.length > 0 ? existingItems[existingItems.length - 1].position + 1 : 0;

  const [item] = await db.insert(ticketChecklistItemsTable).values({
    checklistId,
    orgId: orgId ?? null,
    text: parsed.data.text,
    checked: false,
    position: nextPos,
  }).returning();

  res.status(201).json(item);
});

router.patch("/tickets/:ticketId/checklists/:checklistId/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const checklistId = parseParam(req.params.checklistId);
  const itemId = parseParam(req.params.itemId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(checklistId) || isNaN(itemId)) {
    res.status(400).json({ error: "Invalid ID" }); return;
  }

  const parsed = z.object({
    text: z.string().min(1).optional(),
    checked: z.boolean().optional(),
    position: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklist = await getChecklistForTicket(checklistId, ticketId);
  if (!checklist) { res.status(404).json({ error: "Checklist not found" }); return; }

  const [existingItem] = await db
    .select()
    .from(ticketChecklistItemsTable)
    .where(and(eq(ticketChecklistItemsTable.id, itemId), eq(ticketChecklistItemsTable.checklistId, checklistId)));
  if (!existingItem) { res.status(404).json({ error: "Item not found" }); return; }

  const isAdmin = currentUser.role === "admin";
  const updates: { text?: string; checked?: boolean; position?: number; checkedById?: number | null; checkedAt?: Date | null } = {};
  if (parsed.data.checked !== undefined) {
    updates.checked = parsed.data.checked;
    if (parsed.data.checked !== existingItem.checked) {
      if (parsed.data.checked) {
        updates.checkedById = currentUser.id;
        updates.checkedAt = new Date();
      } else {
        updates.checkedById = null;
        updates.checkedAt = null;
      }
    }
  }
  if (isAdmin) {
    if (parsed.data.text !== undefined) updates.text = parsed.data.text;
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;
  }

  await db
    .update(ticketChecklistItemsTable)
    .set(updates)
    .where(eq(ticketChecklistItemsTable.id, itemId));

  const [updatedItem] = await db
    .select({
      id: ticketChecklistItemsTable.id,
      checklistId: ticketChecklistItemsTable.checklistId,
      orgId: ticketChecklistItemsTable.orgId,
      text: ticketChecklistItemsTable.text,
      checked: ticketChecklistItemsTable.checked,
      position: ticketChecklistItemsTable.position,
      checkedAt: ticketChecklistItemsTable.checkedAt,
      checkedByName: usersTable.name,
      createdAt: ticketChecklistItemsTable.createdAt,
      updatedAt: ticketChecklistItemsTable.updatedAt,
    })
    .from(ticketChecklistItemsTable)
    .leftJoin(usersTable, eq(ticketChecklistItemsTable.checkedById, usersTable.id))
    .where(eq(ticketChecklistItemsTable.id, itemId));

  if (parsed.data.checked !== undefined && parsed.data.checked !== existingItem.checked) {
    const actionDescription = parsed.data.checked
      ? `Elemento checklist completato: "${existingItem.text}"`
      : `Elemento checklist riaperto: "${existingItem.text}"`;
    await db.insert(ticketActivityLogsTable).values({
      ticketId,
      userId: currentUser.id,
      actionType: "checklist_item_updated",
      actionDescription,
    });
  }

  res.json(updatedItem);
});

router.delete("/tickets/:ticketId/checklists/:checklistId/items/:itemId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const checklistId = parseParam(req.params.checklistId);
  const itemId = parseParam(req.params.itemId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(checklistId) || isNaN(itemId)) {
    res.status(400).json({ error: "Invalid ID" }); return;
  }

  const ticket = await getTicketForUser(ticketId, orgId);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const checklist = await getChecklistForTicket(checklistId, ticketId);
  if (!checklist) { res.status(404).json({ error: "Checklist not found" }); return; }

  const [item] = await db
    .select({ id: ticketChecklistItemsTable.id })
    .from(ticketChecklistItemsTable)
    .where(and(eq(ticketChecklistItemsTable.id, itemId), eq(ticketChecklistItemsTable.checklistId, checklistId)));
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  await db.delete(ticketChecklistItemsTable).where(eq(ticketChecklistItemsTable.id, itemId));

  res.json({ success: true });
});

export default router;
