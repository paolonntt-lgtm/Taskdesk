import { Router, type IRouter } from "express";
import { eq, and, ilike, or, asc, desc, ne, gte, lt } from "drizzle-orm";
import { db, clientsTable, ticketsTable, usersTable, clientNotesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { hasGroupPermission } from "../lib/groupPermissions";
import { z } from "zod";

const router: IRouter = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "client";
}

async function generateUniqueSlug(name: string, orgId: number, excludeId?: number): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let counter = 2;
  while (true) {
    const conditions: any[] = [
      eq(clientsTable.organizationId, orgId),
      eq(clientsTable.slug, slug),
    ];
    if (excludeId !== undefined) conditions.push(ne(clientsTable.id, excludeId));
    const [existing] = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(and(...conditions))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
}

const ClientBody = z.object({
  name: z.string().min(1),
  alias: z.string().optional().nullable(),
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
  notes: z.string().optional().nullable(),
});

const ClientsQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["name", "createdAt"]).optional().default("name"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

const ClientNoteBody = z.object({
  body: z.string(),
  monthOverride: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  checklist: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        checked: z.boolean(),
        checkedByName: z.string().nullable().optional(),
        checkedAt: z.string().nullable().optional(),
      })
    )
    .optional()
    .nullable(),
});

router.get("/client-notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const limit = limitRaw != null && !isNaN(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : undefined;
  const offset = offsetRaw != null && !isNaN(offsetRaw) && offsetRaw >= 0 ? offsetRaw : undefined;

  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  const authorIdRaw = req.query.authorId ? parseInt(req.query.authorId as string, 10) : undefined;
  const authorId = authorIdRaw != null && !isNaN(authorIdRaw) ? authorIdRaw : undefined;
  const dateFrom = typeof req.query.dateFrom === 'string' && req.query.dateFrom ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === 'string' && req.query.dateTo ? req.query.dateTo : undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(clientNotesTable.organizationId, orgId) as ReturnType<typeof eq>];
  if (search) conditions.push(ilike(clientNotesTable.body, `%${search}%`) as ReturnType<typeof eq>);
  if (authorId != null) conditions.push(eq(clientNotesTable.authorId, authorId));
  if (dateFrom) conditions.push(gte(clientNotesTable.createdAt, new Date(dateFrom)) as ReturnType<typeof eq>);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(clientNotesTable.createdAt, end) as ReturnType<typeof eq>);
  }

  const baseQuery = db
    .select({
      id: clientNotesTable.id,
      clientId: clientNotesTable.clientId,
      clientName: clientsTable.name,
      clientSlug: clientsTable.slug,
      organizationId: clientNotesTable.organizationId,
      authorId: clientNotesTable.authorId,
      authorName: usersTable.name,
      body: clientNotesTable.body,
      checklist: clientNotesTable.checklist,
      monthOverride: clientNotesTable.monthOverride,
      createdAt: clientNotesTable.createdAt,
      updatedAt: clientNotesTable.updatedAt,
    })
    .from(clientNotesTable)
    .innerJoin(clientsTable, eq(clientNotesTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientNotesTable.authorId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(clientNotesTable.createdAt));

  const notes = await (limit != null
    ? offset != null ? baseQuery.limit(limit).offset(offset) : baseQuery.limit(limit)
    : offset != null ? baseQuery.offset(offset) : baseQuery);

  res.json(notes);
});

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (orgId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const parsed = ClientsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { search, sort, order } = parsed.data;

  const conditions: any[] = [eq(clientsTable.organizationId, orgId)];

  if (search && search.trim()) {
    conditions.push(
      or(
        ilike(clientsTable.name, `%${search.trim()}%`),
        ilike(clientsTable.email, `%${search.trim()}%`),
        ilike(clientsTable.vatNumber, `%${search.trim()}%`),
        ilike(clientsTable.taxCode, `%${search.trim()}%`),
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

  const slug = await generateUniqueSlug(parsed.data.name, currentUser.organizationId);

  const [client] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, organizationId: currentUser.organizationId, slug })
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

    const slug = await generateUniqueSlug(name, currentUser.organizationId);

    await db.insert(clientsTable).values({
      organizationId: currentUser.organizationId,
      name,
      slug,
      vatNumber,
      taxCode: row.taxCode?.trim() || null,
      address: row.address?.trim() || null,
      pec: row.pec?.trim() || null,
      contactPerson: row.contactPerson?.trim() || null,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      notes: row.notes?.trim() || null,
    });

    existingVats.add(vatNumber.toLowerCase());
    imported++;
  }

  res.json({ imported, skipped, duplicates, errors });
});

router.get("/clients/resolve/:slug", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.organizationId, currentUser.organizationId),
        eq(clientsTable.slug, slug),
      )
    )
    .limit(1);

  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
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

  if (!client.slug) {
    const slug = await generateUniqueSlug(client.name, currentUser.organizationId, client.id);
    await db
      .update(clientsTable)
      .set({ slug })
      .where(eq(clientsTable.id, client.id));
    client.slug = slug;
  }

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

router.patch("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const isAdmin = currentUser.role === "admin";
  const orgId: number | null = currentUser.organizationId ?? null;

  const parsed = ClientBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const keys = Object.keys(parsed.data);
  const isNotesOnlyUpdate = keys.length === 1 && keys[0] === "notes";

  if (!isAdmin) {
    if (isNotesOnlyUpdate) {
      const canEditFixed = await hasGroupPermission(currentUser.id, orgId, "edit_fixed_notes", false);
      if (!canEditFixed) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else {
      res.status(403).json({ error: "Admin required" });
      return;
    }
  }

  const [client] = await db
    .update(clientsTable)
    .set(parsed.data)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

const LayoutBody = z.object({
  layout: z.array(z.object({
    id: z.string(),
    instanceId: z.string(),
    type: z.string().optional(),
    visible: z.boolean(),
    customName: z.string().max(100).optional().nullable(),
    content: z.string().max(10000).optional().nullable(),
  })),
  order: z.array(z.string().max(200)).max(50).optional(),
});

const BUILTIN_IDS = new Set(["company-info", "fixed-notes", "client-notes", "linked-tickets"]);

router.patch("/clients/:id/layout", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const isAdmin = currentUser.role === "admin";
  const orgId: number | null = currentUser.organizationId ?? null;
  const canManage = isAdmin || await hasGroupPermission(currentUser.id, orgId, "manage_client_sections", false);
  const canEditContent = isAdmin || await hasGroupPermission(currentUser.id, orgId, "edit_client_section_content", false);
  if (!canManage && !canEditContent) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = LayoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const customOnly = parsed.data.layout
    .filter(b => !BUILTIN_IDS.has(b.instanceId))
    .map(b => ({
      id: b.id,
      instanceId: b.instanceId,
      ...(b.type ? { type: b.type } : {}),
      visible: b.visible,
      ...(b.customName?.trim() ? { customName: b.customName.trim().slice(0, 100) } : {}),
      ...(b.content?.trim() ? { content: b.content.trim().slice(0, 10000) } : {}),
    }));

  const [client] = await db
    .update(clientsTable)
    .set({ layout: { blocks: customOnly, order: parsed.data.order ?? [] } })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

router.get("/clients/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .limit(1);
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const notes = await db
    .select({
      id: clientNotesTable.id,
      clientId: clientNotesTable.clientId,
      organizationId: clientNotesTable.organizationId,
      authorId: clientNotesTable.authorId,
      authorName: usersTable.name,
      body: clientNotesTable.body,
      checklist: clientNotesTable.checklist,
      monthOverride: clientNotesTable.monthOverride,
      createdAt: clientNotesTable.createdAt,
      updatedAt: clientNotesTable.updatedAt,
    })
    .from(clientNotesTable)
    .leftJoin(usersTable, eq(clientNotesTable.authorId, usersTable.id))
    .where(
      and(
        eq(clientNotesTable.clientId, id),
        eq(clientNotesTable.organizationId, currentUser.organizationId),
      )
    )
    .orderBy(desc(clientNotesTable.createdAt));

  res.json(notes);
});

router.post("/clients/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [clientRow] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .limit(1);
  if (!clientRow) { res.status(404).json({ error: "Not found" }); return; }

  const parsed = ClientNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [note] = await db
    .insert(clientNotesTable)
    .values({
      clientId: id,
      organizationId: currentUser.organizationId,
      authorId: currentUser.id,
      body: parsed.data.body,
      checklist: parsed.data.checklist ?? null,
      monthOverride: parsed.data.monthOverride ?? null,
    })
    .returning();

  const [author] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, note.authorId))
    .limit(1);

  res.status(201).json({ ...note, authorName: author?.name ?? null });
});

router.patch("/clients/:id/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawNote = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;
  const id = parseInt(rawId, 10);
  const noteId = parseInt(rawNote, 10);
  if (isNaN(id) || isNaN(noteId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ClientNoteBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const updateData: Record<string, any> = {};
  // Admins or users with edit_client_notes permission can edit any note; others can only edit their own
  if (parsed.data.body !== undefined) {
    const isAdmin = currentUser.role === 'admin';
    if (!isAdmin) {
      const canEditOthers = await hasGroupPermission(currentUser.id, currentUser.organizationId ?? null, "edit_client_notes", false);
      if (!canEditOthers) {
        const [storedForAuth] = await db
          .select({ authorId: clientNotesTable.authorId })
          .from(clientNotesTable)
          .where(
            and(
              eq(clientNotesTable.id, noteId),
              eq(clientNotesTable.clientId, id),
              eq(clientNotesTable.organizationId, currentUser.organizationId),
            )
          )
          .limit(1);
        if (!storedForAuth) { res.status(404).json({ error: "Not found" }); return; }
        if (storedForAuth.authorId !== currentUser.id) {
          res.status(403).json({ error: "Forbidden: you can only edit your own notes" });
          return;
        }
      }
    }
    updateData.body = parsed.data.body;
  }
  if (parsed.data.checklist !== undefined) {
    if (currentUser.role !== 'admin') {
      // Non-admins may only toggle the `checked` field on existing items.
      // Fetch the stored checklist and validate structure is unchanged.
      const [stored] = await db
        .select({ checklist: clientNotesTable.checklist, organizationId: clientNotesTable.organizationId })
        .from(clientNotesTable)
        .where(
          and(
            eq(clientNotesTable.id, noteId),
            eq(clientNotesTable.clientId, id),
            eq(clientNotesTable.organizationId, currentUser.organizationId),
          )
        )
        .limit(1);

      if (!stored) { res.status(404).json({ error: "Not found" }); return; }

      const storedList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (stored.checklist as any) ?? [];
      const incomingList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (parsed.data.checklist as any) ?? [];

      // Validate: same number of items, same IDs, same text — only `checked` may differ
      const structurallyValid =
        incomingList.length === storedList.length &&
        incomingList.every((incoming, idx) => {
          const existing = storedList[idx];
          return existing && incoming.id === existing.id && incoming.text === existing.text;
        });

      if (!structurallyValid) {
        res.status(403).json({ error: "Forbidden: non-admins may only toggle checklist item state" });
        return;
      }

      // Server-side: set/clear checkedByName and checkedAt based on toggle direction
      const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, currentUser.id)).limit(1);
      const userName = userRow?.name ?? null;
      const enriched = incomingList.map((incoming, idx) => {
        const existing = storedList[idx];
        if (incoming.checked && !existing.checked) {
          return { ...incoming, checkedByName: userName, checkedAt: new Date().toISOString() };
        } else if (!incoming.checked && existing.checked) {
          return { ...incoming, checkedByName: null, checkedAt: null };
        }
        return { ...incoming, checkedByName: existing.checkedByName ?? null, checkedAt: existing.checkedAt ?? null };
      });
      updateData.checklist = enriched;
    } else {
      // Admin path: also enforce server-side checkedByName/checkedAt
      const [storedNote] = await db
        .select({ checklist: clientNotesTable.checklist })
        .from(clientNotesTable)
        .where(
          and(
            eq(clientNotesTable.id, noteId),
            eq(clientNotesTable.clientId, id),
            eq(clientNotesTable.organizationId, currentUser.organizationId),
          )
        )
        .limit(1);
      const storedList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (storedNote?.checklist as any) ?? [];
      const incomingList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (parsed.data.checklist as any) ?? [];
      const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, currentUser.id)).limit(1);
      const userName = userRow?.name ?? null;
      const storedMap = new Map(storedList.map(s => [s.id, s]));
      const enriched = incomingList.map((incoming) => {
        const existing = storedMap.get(incoming.id);
        if (incoming.checked && (!existing || !existing.checked)) {
          return { ...incoming, checkedByName: userName, checkedAt: new Date().toISOString() };
        } else if (!incoming.checked && existing?.checked) {
          return { ...incoming, checkedByName: null, checkedAt: null };
        }
        return { ...incoming, checkedByName: existing?.checkedByName ?? null, checkedAt: existing?.checkedAt ?? null };
      });
      updateData.checklist = enriched;
    }
  }

  const [note] = await db
    .update(clientNotesTable)
    .set(updateData)
    .where(
      and(
        eq(clientNotesTable.id, noteId),
        eq(clientNotesTable.clientId, id),
        eq(clientNotesTable.organizationId, currentUser.organizationId),
      )
    )
    .returning();

  if (!note) { res.status(404).json({ error: "Not found" }); return; }

  const [author] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, note.authorId))
    .limit(1);

  res.json({ ...note, authorName: author?.name ?? null });
});

router.delete("/clients/:id/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawNote = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;
  const id = parseInt(rawId, 10);
  const noteId = parseInt(rawNote, 10);
  if (isNaN(id) || isNaN(noteId)) { res.status(400).json({ error: "Invalid id" }); return; }

  if (currentUser.role !== 'admin') {
    const [toDelete] = await db
      .select({ authorId: clientNotesTable.authorId })
      .from(clientNotesTable)
      .where(
        and(
          eq(clientNotesTable.id, noteId),
          eq(clientNotesTable.clientId, id),
          eq(clientNotesTable.organizationId, currentUser.organizationId),
        )
      )
      .limit(1);
    if (!toDelete) { res.status(404).json({ error: "Not found" }); return; }
    if (toDelete.authorId !== currentUser.id) {
      const canDeleteOthers = await hasGroupPermission(currentUser.id, currentUser.organizationId ?? null, "delete_client_notes", false);
      if (!canDeleteOthers) {
        res.status(403).json({ error: "Forbidden: you can only delete your own notes" });
        return;
      }
    }
  }

  const [deleted] = await db
    .delete(clientNotesTable)
    .where(
      and(
        eq(clientNotesTable.id, noteId),
        eq(clientNotesTable.clientId, id),
        eq(clientNotesTable.organizationId, currentUser.organizationId),
      )
    )
    .returning();

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
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
