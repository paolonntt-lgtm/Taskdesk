import { Router, type IRouter } from "express";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db, checklistTemplatesTable, checklistTemplateItemsTable, ticketChecklistsTable, ticketChecklistItemsTable, ticketActivityLogsTable, ticketsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

function parseParam(p: string | string[]): number {
  return parseInt(Array.isArray(p) ? p[0] : p, 10);
}

async function buildTemplateWithItems(templateId: number) {
  const [template] = await db
    .select()
    .from(checklistTemplatesTable)
    .where(eq(checklistTemplatesTable.id, templateId));
  if (!template) return null;
  const items = await db
    .select()
    .from(checklistTemplateItemsTable)
    .where(eq(checklistTemplateItemsTable.templateId, templateId))
    .orderBy(asc(checklistTemplateItemsTable.position), asc(checklistTemplateItemsTable.id));
  return { ...template, items };
}

router.get("/checklist-templates", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "No organization" }); return; }

  const templates = await db
    .select()
    .from(checklistTemplatesTable)
    .where(eq(checklistTemplatesTable.orgId, orgId))
    .orderBy(asc(checklistTemplatesTable.position), asc(checklistTemplatesTable.id));

  if (templates.length === 0) { res.json([]); return; }

  const templateIds = templates.map((t) => t.id);
  const items = await db
    .select()
    .from(checklistTemplateItemsTable)
    .where(inArray(checklistTemplateItemsTable.templateId, templateIds))
    .orderBy(asc(checklistTemplateItemsTable.position), asc(checklistTemplateItemsTable.id));

  const itemsByTemplate = new Map<number, typeof items>();
  for (const item of items) {
    if (!itemsByTemplate.has(item.templateId)) itemsByTemplate.set(item.templateId, []);
    itemsByTemplate.get(item.templateId)!.push(item);
  }

  res.json(templates.map((t) => ({ ...t, items: itemsByTemplate.get(t.id) ?? [] })));
});

router.post("/checklist-templates", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "No organization" }); return; }

  const parsed = z.object({
    title: z.string().min(1),
    category: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const existing = await db
    .select({ position: checklistTemplatesTable.position })
    .from(checklistTemplatesTable)
    .where(eq(checklistTemplatesTable.orgId, orgId))
    .orderBy(asc(checklistTemplatesTable.position));
  const nextPos = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [template] = await db.insert(checklistTemplatesTable).values({
    orgId,
    title: parsed.data.title,
    category: parsed.data.category ?? null,
    position: nextPos,
  }).returning();

  res.status(201).json({ ...template, items: [] });
});

router.patch("/checklist-templates/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseParam(req.params.id);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [template] = await db.select().from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, id), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const parsed = z.object({
    title: z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    position: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: { title?: string; category?: string | null; position?: number } = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;

  await db.update(checklistTemplatesTable).set(updates).where(eq(checklistTemplatesTable.id, id));

  const result = await buildTemplateWithItems(id);
  res.json(result);
});

router.delete("/checklist-templates/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseParam(req.params.id);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [template] = await db.select({ id: checklistTemplatesTable.id }).from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, id), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  await db.delete(checklistTemplatesTable).where(eq(checklistTemplatesTable.id, id));
  res.json({ success: true });
});

router.post("/checklist-templates/:id/items", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseParam(req.params.id);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [template] = await db.select().from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, id), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const existing = await db
    .select({ position: checklistTemplateItemsTable.position })
    .from(checklistTemplateItemsTable)
    .where(eq(checklistTemplateItemsTable.templateId, id))
    .orderBy(asc(checklistTemplateItemsTable.position));
  const nextPos = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [item] = await db.insert(checklistTemplateItemsTable).values({
    templateId: id,
    orgId: orgId!,
    text: parsed.data.text,
    position: nextPos,
  }).returning();

  res.status(201).json(item);
});

router.patch("/checklist-templates/:id/items/:itemId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseParam(req.params.id);
  const itemId = parseParam(req.params.itemId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (isNaN(id) || isNaN(itemId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [template] = await db.select({ id: checklistTemplatesTable.id }).from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, id), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [item] = await db.select().from(checklistTemplateItemsTable).where(
    and(eq(checklistTemplateItemsTable.id, itemId), eq(checklistTemplateItemsTable.templateId, id))
  );
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  const parsed = z.object({
    text: z.string().min(1).optional(),
    position: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: { text?: string; position?: number } = {};
  if (parsed.data.text !== undefined) updates.text = parsed.data.text;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;

  await db.update(checklistTemplateItemsTable).set(updates).where(eq(checklistTemplateItemsTable.id, itemId));

  const [updated] = await db.select().from(checklistTemplateItemsTable).where(eq(checklistTemplateItemsTable.id, itemId));
  res.json(updated);
});

router.delete("/checklist-templates/:id/items/:itemId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseParam(req.params.id);
  const itemId = parseParam(req.params.itemId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (isNaN(id) || isNaN(itemId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [template] = await db.select({ id: checklistTemplatesTable.id }).from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, id), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [item] = await db.select({ id: checklistTemplateItemsTable.id }).from(checklistTemplateItemsTable).where(
    and(eq(checklistTemplateItemsTable.id, itemId), eq(checklistTemplateItemsTable.templateId, id))
  );
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  await db.delete(checklistTemplateItemsTable).where(eq(checklistTemplateItemsTable.id, itemId));
  res.json({ success: true });
});

router.post("/tickets/:ticketId/checklists/from-template/:templateId", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseParam(req.params.ticketId);
  const templateId = parseParam(req.params.templateId);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(ticketId) || isNaN(templateId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [ticket] = await db.select({ id: ticketsTable.id, organizationId: ticketsTable.organizationId })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.id, ticketId),
      orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
    ));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [template] = await db.select().from(checklistTemplatesTable).where(
    and(eq(checklistTemplatesTable.id, templateId), orgId != null ? eq(checklistTemplatesTable.orgId, orgId) : undefined)
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const templateItems = await db
    .select()
    .from(checklistTemplateItemsTable)
    .where(eq(checklistTemplateItemsTable.templateId, templateId))
    .orderBy(asc(checklistTemplateItemsTable.position), asc(checklistTemplateItemsTable.id));

  const existingChecklists = await db
    .select({ position: ticketChecklistsTable.position })
    .from(ticketChecklistsTable)
    .where(eq(ticketChecklistsTable.ticketId, ticketId))
    .orderBy(asc(ticketChecklistsTable.position));
  const nextPos = existingChecklists.length > 0 ? existingChecklists[existingChecklists.length - 1].position + 1 : 0;

  const [checklist] = await db.insert(ticketChecklistsTable).values({
    ticketId,
    orgId: orgId ?? null,
    title: template.title,
    position: nextPos,
    fromTemplateId: template.id,
    fromTemplateName: template.title,
  }).returning();

  if (templateItems.length > 0) {
    await db.insert(ticketChecklistItemsTable).values(
      templateItems.map((item, i) => ({
        checklistId: checklist.id,
        orgId: orgId ?? null,
        text: item.text,
        checked: false,
        position: i,
      }))
    );
  }

  await db.insert(ticketActivityLogsTable).values({
    ticketId,
    userId: currentUser.id,
    actionType: "checklist_applied_from_template",
    actionDescription: `Checklist applicata da template: "${template.title}"`,
  });

  const items = templateItems.length > 0
    ? await db.select().from(ticketChecklistItemsTable).where(eq(ticketChecklistItemsTable.checklistId, checklist.id)).orderBy(asc(ticketChecklistItemsTable.position))
    : [];

  res.status(201).json({ ...checklist, items });
});

export default router;
