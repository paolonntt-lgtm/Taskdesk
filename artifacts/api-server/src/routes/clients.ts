import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, clientsTable, ticketsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ClientBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const search = req.query.search as string | undefined;

  const conditions = [orgId != null ? eq(clientsTable.organizationId, orgId) : undefined].filter(Boolean) as any[];

  if (search && search.trim()) {
    conditions.push(
      or(
        ilike(clientsTable.name, `%${search.trim()}%`),
        ilike(clientsTable.email, `%${search.trim()}%`),
      )
    );
  }

  const clients = await db
    .select()
    .from(clientsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(clientsTable.name);

  res.json(clients);
});

router.post("/clients", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = ClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [client] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, organizationId: currentUser.organizationId })
    .returning();

  res.status(201).json(client);
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)));

  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const tickets = await db
    .select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title,
      status: ticketsTable.status,
      priority: ticketsTable.priority,
      category: ticketsTable.category,
      createdAt: ticketsTable.createdAt,
      assignedToName: usersTable.name,
    })
    .from(ticketsTable)
    .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
    .where(and(
      eq(ticketsTable.clientId, id),
      eq(ticketsTable.organizationId, currentUser.organizationId),
    ))
    .orderBy(ticketsTable.createdAt);

  res.json({ ...client, tickets });
});

router.patch("/clients/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ClientBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [client] = await db
    .update(clientsTable)
    .set(parsed.data)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

router.delete("/clients/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(ticketsTable)
    .set({ clientId: null })
    .where(and(eq(ticketsTable.clientId, id), eq(ticketsTable.organizationId, currentUser.organizationId)));

  const [deleted] = await db
    .delete(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

export default router;
