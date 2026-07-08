import { Router, type IRouter } from "express";
import { eq, and, ilike, or, inArray, asc, desc } from "drizzle-orm";
import { db, clientsTable, ticketsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ClientBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pec: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const ImportRow = z.object({
  name: z.string(),
  vatNumber: z.string().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pec: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

const ClientsQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["name", "createdAt"]).optional().default("name"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const parsed = ClientsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { search, sort, order } = parsed.data;

  const conditions = [orgId != null ? eq(clientsTable.organizationId, orgId) : undefined].filter(Boolean) as any[];

  if (search && search.trim()) {
    conditions.push(
      or(
        ilike(clientsTable.name, `%${search.trim()}%`),
        ilike(clientsTable.email, `%${search.trim()}%`),
      )
    );
  }

  const sortCol = sort === "createdAt" ? clientsTable.createdAt : clientsTable.name;
  const orderFn = order === "desc" ? desc : asc;

  const clients = await db
    .select()
    .from(clientsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderFn(sortCol));

  res.json(clients);
});

router.post("/clients", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = ClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const vatNumber = parsed.data.vatNumber?.trim() || null;
  if (vatNumber) {
    const [existing] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.organizationId, currentUser.organizationId),
          ilike(clientsTable.vatNumber, vatNumber),
        )
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Duplicate VAT number" });
      return;
    }
  }

  const [client] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, organizationId: currentUser.organizationId })
    .returning();

  res.status(201).json(client);
});

router.post("/clients/import", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  const bodySchema = z.object({ rows: z.array(z.unknown()) });
  const bodyParsed = bodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { rows } = bodyParsed.data;
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  const errors: { row: number; name?: string | null; reason: string }[] = [];

  const existingClients = await db
    .select({ vatNumber: clientsTable.vatNumber })
    .from(clientsTable)
    .where(eq(clientsTable.organizationId, currentUser.organizationId));
  const existingVats = new Set(
    existingClients.map((c) => c.vatNumber?.trim().toLowerCase()).filter(Boolean)
  );

  for (let i = 0; i < rows.length; i++) {
    const rowParsed = ImportRow.safeParse(rows[i]);
    if (!rowParsed.success) {
      skipped++;
      errors.push({ row: i + 1, reason: "Invalid row format" });
      continue;
    }

    const row = rowParsed.data;
    const name = row.name?.trim();
    const vatNumber = row.vatNumber?.trim() || null;

    if (!name) {
      skipped++;
      errors.push({ row: i + 1, name: null, reason: "Missing required Name" });
      continue;
    }

    if (!vatNumber) {
      skipped++;
      errors.push({ row: i + 1, name, reason: "Missing required VAT Number" });
      continue;
    }

    if (existingVats.has(vatNumber.toLowerCase())) {
      duplicates++;
      skipped++;
      errors.push({ row: i + 1, name, reason: "Duplicate VAT Number" });
      continue;
    }

    await db.insert(clientsTable).values({
      organizationId: currentUser.organizationId,
      name,
      vatNumber,
      taxCode: row.taxCode?.trim() || null,
      address: row.address?.trim() || null,
      pec: row.pec?.trim() || null,
      contactPerson: row.contactPerson?.trim() || null,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
    });

    existingVats.add(vatNumber.toLowerCase());
    imported++;
  }

  res.json({ imported, skipped, duplicates, errors });
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
