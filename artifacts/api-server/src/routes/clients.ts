import { Router, type IRouter, type RequestHandler } from "express";
import { eq, and, ilike, or, asc, desc, ne, gte, lt, isNotNull, isNull, inArray } from "drizzle-orm";
import { db, clientsTable, ticketsTable, usersTable, clientNotesTable, ticketActivityLogsTable, organizationsTable, emailClientSenderRulesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { hasGroupPermission, VIEW_WORKED_HOURS_PERMISSION } from "../lib/groupPermissions";
import { redactWorkedHours } from "../lib/workedTime";
import { UpdateClientTicketWorkedHoursBody } from "@workspace/api-zod";
import { z } from "zod";
import { normalizeSenderEmail } from "../lib/emailClientAssociation";

const router: IRouter = Router();

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

const requireClientsEnabled: RequestHandler = async (req, res, next): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser?.organizationId;
  if (organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }

  const [organization] = await db
    .select({ clientsEnabled: organizationsTable.clientsEnabled })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId))
    .limit(1);

  if (!organization?.clientsEnabled) {
    res.status(403).json({ error: "Client management is disabled for this organization" });
    return;
  }

  next();
};

const requireClientFeature: RequestHandler = (req, res, next) =>
  requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    void Promise.resolve(requireClientsEnabled(req, res, next)).catch(next);
  });

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

function splitEmailAddresses(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[;,\s]+/).map(normalizeSenderEmail).filter(Boolean))];
}

function normalizeClientEmailField(value: string | null | undefined): string | null {
  const addresses = splitEmailAddresses(value);
  return addresses.length ? addresses.join("; ") : null;
}

function removeClientEmailAddress(value: string | null | undefined, address: string): string | null {
  if (!value) return null;
  const remaining = value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item && normalizeSenderEmail(item) !== address);
  return remaining.length ? remaining.join("; ") : null;
}

async function findClientEmailConflicts(
  organizationId: number,
  addresses: string[],
  excludeClientId?: number,
) {
  if (addresses.length === 0) return [];
  const [clients, senderRules] = await Promise.all([
    db.select({
      id: clientsTable.id,
      name: clientsTable.name,
      email: clientsTable.email,
      pec: clientsTable.pec,
    }).from(clientsTable).where(eq(clientsTable.organizationId, organizationId)),
    db.select({
      clientId: emailClientSenderRulesTable.clientId,
      senderEmail: emailClientSenderRulesTable.senderEmail,
    }).from(emailClientSenderRulesTable).where(eq(emailClientSenderRulesTable.organizationId, organizationId)),
  ]);
  const conflicts = new Map<string, { address: string; clientId: number; clientName: string; sources: Set<string> }>();
  const addConflict = (address: string, clientId: number, clientName: string, source: string) => {
    if (clientId === excludeClientId) return;
    const key = `${address}:${clientId}`;
    const conflict = conflicts.get(key) ?? { address, clientId, clientName, sources: new Set<string>() };
    conflict.sources.add(source);
    conflicts.set(key, conflict);
  };

  for (const client of clients) {
    if (client.id === excludeClientId) continue;
    for (const address of splitEmailAddresses(client.email)) {
      if (addresses.includes(address)) addConflict(address, client.id, client.name, "profile");
    }
    for (const address of splitEmailAddresses(client.pec)) {
      if (addresses.includes(address)) addConflict(address, client.id, client.name, "profile");
    }
  }
  for (const rule of senderRules) {
    const address = normalizeSenderEmail(rule.senderEmail);
    const client = clients.find((row) => row.id === rule.clientId);
    if (address && addresses.includes(address) && client) {
      addConflict(address, client.id, client.name, "sender_rule");
    }
  }
  return [...conflicts.values()].map((conflict) => ({
    ...conflict,
    sources: [...conflict.sources],
  }));
}

const ClientEmailField = z.string().nullable().optional().superRefine((value, ctx) => {
  if (!value?.trim()) return;
  const pieces = value.split(/[;,\s]+/).filter(Boolean);
  if (pieces.some((address) => !normalizeSenderEmail(address))) {
    ctx.addIssue({ code: "custom", message: "Email addresses must be valid and separated by semicolons" });
  }
});

const ClientBody = z.object({
  name: z.string().min(1),
  alias: z.string().optional().nullable(),
  email: ClientEmailField,
  phone: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  taxCode: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pec: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notes2: z.string().optional().nullable(),
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
  limit: z.coerce.number().int().positive().max(100).optional(),
  hasUnbilledWorkedTime: z.enum(["true", "false"]).optional(),
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

router.get("/client-notes", requireClientFeature, async (req, res): Promise<void> => {
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
  if (search) {
    const searchPattern = `%${escapeLikePattern(search)}%`;
    conditions.push(ilike(clientNotesTable.body, searchPattern) as ReturnType<typeof eq>);
  }
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

router.get("/clients", requireClientFeature, async (req, res): Promise<void> => {
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
  const { search, limit, sort, order, hasUnbilledWorkedTime } = parsed.data;

  if (hasUnbilledWorkedTime === "true") {
    const canViewWorkedHours = await hasGroupPermission(
      currentUser.id,
      orgId,
      VIEW_WORKED_HOURS_PERMISSION,
      currentUser.role === "admin",
      req,
    );
    if (!canViewWorkedHours) {
      res.status(403).json({ error: "Permission to view worked hours is required" });
      return;
    }
  }

  const conditions: any[] = [eq(clientsTable.organizationId, orgId)];

  if (search && search.trim()) {
    const searchPattern = `%${escapeLikePattern(search.trim())}%`;
    conditions.push(
      or(
        ilike(clientsTable.name, searchPattern),
        ilike(clientsTable.alias, searchPattern),
        ilike(clientsTable.email, searchPattern),
        ilike(clientsTable.phone, searchPattern),
        ilike(clientsTable.address, searchPattern),
        ilike(clientsTable.vatNumber, searchPattern),
        ilike(clientsTable.taxCode, searchPattern),
      )
    );
  }

  if (hasUnbilledWorkedTime === "true") {
    const workedTicketConditions = [
      eq(ticketsTable.organizationId, orgId),
      isNotNull(ticketsTable.clientId),
      isNotNull(ticketsTable.workedMinutes),
      isNotNull(ticketsTable.closedAt),
      isNull(ticketsTable.deletedAt),
      eq(ticketsTable.workedBillingStatus, "unbilled"),
    ];
    if (currentUser.role !== "admin") {
      workedTicketConditions.push(eq(ticketsTable.visibility, "organization"));
    }
    conditions.push(
      inArray(
        clientsTable.id,
        db
          .select({ clientId: ticketsTable.clientId })
          .from(ticketsTable)
          .where(and(...workedTicketConditions))
      )
    );
  }

  const sortCol = sort === "createdAt" ? clientsTable.createdAt : clientsTable.name;
  const orderFn = order === "desc" ? desc : asc;

  const clientsQuery = db
    .select()
    .from(clientsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderFn(sortCol));
  const clients = limit == null
    ? await clientsQuery
    : await clientsQuery.limit(limit);

  res.json(clients);
});

router.get("/clients/email-address-associations", requireClientFeature, async (req, res): Promise<void> => {
  const orgId = (req as any).currentUser.organizationId as number;
  const [clients, senderRules] = await Promise.all([
    db.select({
      id: clientsTable.id,
      name: clientsTable.name,
      email: clientsTable.email,
      pec: clientsTable.pec,
    }).from(clientsTable).where(eq(clientsTable.organizationId, orgId)),
    db.select({
      clientId: emailClientSenderRulesTable.clientId,
      senderEmail: emailClientSenderRulesTable.senderEmail,
    }).from(emailClientSenderRulesTable).where(eq(emailClientSenderRulesTable.organizationId, orgId)),
  ]);
  const associations = new Map<string, { address: string; clientId: number; clientName: string; sources: Set<string> }>();
  const add = (address: string, clientId: number, clientName: string, source: string) => {
    const key = `${address}:${clientId}`;
    const entry = associations.get(key) ?? { address, clientId, clientName, sources: new Set<string>() };
    entry.sources.add(source);
    associations.set(key, entry);
  };
  for (const client of clients) {
    for (const address of splitEmailAddresses(client.email)) add(address, client.id, client.name, "profile");
    for (const address of splitEmailAddresses(client.pec)) add(address, client.id, client.name, "profile");
  }
  for (const rule of senderRules) {
    const client = clients.find((row) => row.id === rule.clientId);
    const address = normalizeSenderEmail(rule.senderEmail);
    if (client && address) add(address, client.id, client.name, "sender_rule");
  }
  res.json([...associations.values()].map((entry) => ({
    ...entry,
    sources: [...entry.sources],
  })));
});

const ResolveClientEmailAssociationBody = z.object({
  address: z.string().email().transform(normalizeSenderEmail),
  keepClientId: z.number().int().positive(),
  removeClientId: z.number().int().positive(),
}).refine((body) => body.keepClientId !== body.removeClientId, {
  message: "The client to keep and the client to remove must be different",
});

router.patch(
  "/clients/email-address-associations/resolve",
  requireClientFeature,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ResolveClientEmailAssociationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
      return;
    }

    const { address, keepClientId, removeClientId } = parsed.data;
    const organizationId = (req as any).currentUser.organizationId as number;
    const result = await db.transaction(async (tx) => {
      const clients = await tx
        .select({
          id: clientsTable.id,
          email: clientsTable.email,
          pec: clientsTable.pec,
        })
        .from(clientsTable)
        .where(and(
          eq(clientsTable.organizationId, organizationId),
          inArray(clientsTable.id, [keepClientId, removeClientId]),
        ));
      const keepClient = clients.find((client) => client.id === keepClientId);
      const removeClient = clients.find((client) => client.id === removeClientId);
      if (!keepClient || !removeClient) return "not_found" as const;

      const senderRules = await tx
        .select({
          id: emailClientSenderRulesTable.id,
          clientId: emailClientSenderRulesTable.clientId,
          senderEmail: emailClientSenderRulesTable.senderEmail,
        })
        .from(emailClientSenderRulesTable)
        .where(and(
          eq(emailClientSenderRulesTable.organizationId, organizationId),
          inArray(emailClientSenderRulesTable.clientId, [keepClientId, removeClientId]),
        ));
      const hasAssociation = (client: typeof keepClient | typeof removeClient) =>
        splitEmailAddresses(client.email).includes(address)
        || splitEmailAddresses(client.pec).includes(address)
        || senderRules.some((rule) =>
          rule.clientId === client.id && normalizeSenderEmail(rule.senderEmail) === address,
        );

      if (!hasAssociation(keepClient) || !hasAssociation(removeClient)) {
        return "association_changed" as const;
      }

      const profileUpdates: { email?: string | null; pec?: string | null } = {};
      if (splitEmailAddresses(removeClient.email).includes(address)) {
        profileUpdates.email = removeClientEmailAddress(removeClient.email, address);
      }
      if (splitEmailAddresses(removeClient.pec).includes(address)) {
        profileUpdates.pec = removeClientEmailAddress(removeClient.pec, address);
      }
      if (Object.keys(profileUpdates).length > 0) {
        await tx.update(clientsTable).set(profileUpdates).where(and(
          eq(clientsTable.id, removeClientId),
          eq(clientsTable.organizationId, organizationId),
        ));
      }

      const rulesToDelete = senderRules
        .filter((rule) => rule.clientId === removeClientId && normalizeSenderEmail(rule.senderEmail) === address)
        .map((rule) => rule.id);
      if (rulesToDelete.length > 0) {
        await tx.delete(emailClientSenderRulesTable).where(inArray(emailClientSenderRulesTable.id, rulesToDelete));
      }

      return "resolved" as const;
    });

    if (result === "not_found") {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (result === "association_changed") {
      res.status(409).json({ error: "Email association changed; refresh and try again" });
      return;
    }

    res.json({ success: true });
  },
);

// Any authenticated organization member can create a client from the client page.
// Bulk import and destructive/structural operations remain admin-only.
router.post("/clients", requireClientFeature, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = ClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const normalizedEmail = normalizeClientEmailField(parsed.data.email);
  const conflicts = await findClientEmailConflicts(
    currentUser.organizationId,
    [...new Set([
      ...splitEmailAddresses(normalizedEmail),
      ...splitEmailAddresses(parsed.data.pec),
    ])],
  );
  if (conflicts.length > 0) {
    res.status(409).json({ error: "Email address already associated with another client", conflicts });
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
    .values({ ...parsed.data, email: normalizedEmail, organizationId: currentUser.organizationId, slug })
    .returning();

  res.status(201).json(client);
});

router.post("/clients/import", requireClientFeature, requireAdmin, async (req, res): Promise<void> => {
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

router.get("/clients/resolve/:slug", requireClientFeature, async (req, res): Promise<void> => {
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

router.get("/clients/:id", requireClientFeature, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)));

  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const canViewWorkedHours = await hasGroupPermission(
    currentUser.id,
    currentUser.organizationId,
    VIEW_WORKED_HOURS_PERMISSION,
    currentUser.role === "admin",
    req,
  );

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
      closedAt: ticketsTable.closedAt,
      workedMinutes: ticketsTable.workedMinutes,
      workedBillingStatus: ticketsTable.workedBillingStatus,
      visibility: ticketsTable.visibility,
      assignedToName: usersTable.name,
    })
    .from(ticketsTable)
    .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
    .where(and(
      eq(ticketsTable.clientId, id),
      eq(ticketsTable.organizationId, currentUser.organizationId),
      ...(currentUser.role === "admin" ? [] : [eq(ticketsTable.visibility, "organization")]),
    ))
    .orderBy(ticketsTable.createdAt);

  res.json({ ...client, tickets: tickets.map((ticket) => redactWorkedHours(ticket, canViewWorkedHours)) });
});

const WorkedBillingStatus = z.enum(["unbilled", "billed"]);

router.patch("/clients/:id/tickets/:ticketId/billing-status", requireClientFeature, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const clientId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const ticketId = parseInt(Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId, 10);
  if (isNaN(clientId) || isNaN(ticketId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = WorkedBillingStatus.safeParse(req.body?.status);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: "status must be billed or unbilled" });
    return;
  }

  const [updated] = await db
    .update(ticketsTable)
    .set({ workedBillingStatus: parsed.data })
    .where(and(
      eq(ticketsTable.id, ticketId),
      eq(ticketsTable.clientId, clientId),
      eq(ticketsTable.organizationId, currentUser.organizationId),
      isNotNull(ticketsTable.workedMinutes),
    ))
    .returning({
      id: ticketsTable.id,
      workedBillingStatus: ticketsTable.workedBillingStatus,
    });

  if (!updated) {
    res.status(404).json({ error: "Ticket with worked time not found" });
    return;
  }
  res.json(updated);
});

router.patch("/clients/:id/tickets/:ticketId/worked-hours", requireClientFeature, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const clientId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const ticketId = parseInt(Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId, 10);
  if (currentUser.organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }
  if (isNaN(clientId) || isNaN(ticketId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateClientTicketWorkedHoursBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: ticketsTable.id,
        workedMinutes: ticketsTable.workedMinutes,
        workedBillingStatus: ticketsTable.workedBillingStatus,
      })
      .from(ticketsTable)
      .where(and(
        eq(ticketsTable.id, ticketId),
        eq(ticketsTable.clientId, clientId),
        eq(ticketsTable.organizationId, currentUser.organizationId),
        isNull(ticketsTable.deletedAt),
      ))
      .for("update");

    if (!existing || existing.workedMinutes == null) return null;
    if (existing.workedMinutes === parsed.data.workedMinutes) {
      return {
        ...existing,
        workedBillingStatus: existing.workedBillingStatus ?? "unbilled",
      };
    }

    const [updated] = await tx
      .update(ticketsTable)
      .set({
        workedMinutes: parsed.data.workedMinutes,
        workedBillingStatus: "unbilled",
        updatedAt: new Date(),
      })
      .where(and(
        eq(ticketsTable.id, ticketId),
        eq(ticketsTable.clientId, clientId),
        eq(ticketsTable.organizationId, currentUser.organizationId),
        isNull(ticketsTable.deletedAt),
      ))
      .returning({
        id: ticketsTable.id,
        workedMinutes: ticketsTable.workedMinutes,
        workedBillingStatus: ticketsTable.workedBillingStatus,
      });

    if (!updated) return null;

    const actionDescription = parsed.data.workedMinutes == null
      ? `${currentUser.name} ha rimosso le ore lavorate registrate (${existing.workedMinutes} minuti); stato fatturazione impostato su "Da fatturare"`
      : `${currentUser.name} ha corretto le ore lavorate da ${existing.workedMinutes} a ${parsed.data.workedMinutes} minuti; stato fatturazione impostato su "Da fatturare"`;
    await tx.insert(ticketActivityLogsTable).values({
      ticketId,
      userId: currentUser.id,
      actionType: "worked_hours_changed",
      actionDescription,
    });

    return updated;
  });

  if (!result) {
    res.status(404).json({ error: "Ticket with worked time not found" });
    return;
  }
  res.json(result);
});

router.patch("/clients/:id", requireClientFeature, async (req, res): Promise<void> => {
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
  const isNotesOnlyUpdate = keys.length === 1 && (keys[0] === "notes" || keys[0] === "notes2");

  if (!isAdmin) {
    if (isNotesOnlyUpdate) {
      const canEditFixed = await hasGroupPermission(currentUser.id, orgId, "edit_fixed_notes", false, req);
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
    .select({ id: clientsTable.id, email: clientsTable.email, pec: clientsTable.pec })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)));

  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const updates = { ...parsed.data };
  if (Object.prototype.hasOwnProperty.call(parsed.data, "email")) {
    const normalizedEmail = normalizeClientEmailField(parsed.data.email);
    const previousAddresses = new Set(splitEmailAddresses(client.email));
    const newAddresses = splitEmailAddresses(normalizedEmail).filter((address) => !previousAddresses.has(address));
    const conflicts = await findClientEmailConflicts(currentUser.organizationId, newAddresses, id);
    if (conflicts.length > 0) {
      res.status(409).json({ error: "Email address already associated with another client", conflicts });
      return;
    }
    updates.email = normalizedEmail;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "pec")) {
    const previousAddresses = new Set(splitEmailAddresses(client.pec));
    const newAddresses = splitEmailAddresses(parsed.data.pec).filter((address) => !previousAddresses.has(address));
    const conflicts = await findClientEmailConflicts(currentUser.organizationId, newAddresses, id);
    if (conflicts.length > 0) {
      res.status(409).json({ error: "Email address already associated with another client", conflicts });
      return;
    }
  }

  const [updatedClient] = await db
    .update(clientsTable)
    .set(updates)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!updatedClient) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updatedClient);
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

const BUILTIN_IDS = new Set(["company-info", "fixed-notes", "fixed-notes-2", "client-notes", "linked-tickets"]);

router.patch("/clients/:id/layout", requireClientFeature, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const isAdmin = currentUser.role === "admin";
  const orgId: number | null = currentUser.organizationId ?? null;
  const canManage = isAdmin || await hasGroupPermission(currentUser.id, orgId, "manage_client_sections", false, req);
  const canEditContent = isAdmin || await hasGroupPermission(currentUser.id, orgId, "edit_client_section_content", false, req);
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

  const allBlocks = parsed.data.layout.map(b => ({
    id: b.id,
    instanceId: b.instanceId,
    ...(b.type ? { type: b.type } : {}),
    visible: b.visible,
    ...(b.customName?.trim() ? { customName: b.customName.trim().slice(0, 100) } : {}),
    ...(b.content?.trim() ? { content: b.content.trim().slice(0, 10000) } : {}),
  }));

  const [client] = await db
    .update(clientsTable)
    .set({ layout: { blocks: allBlocks, order: parsed.data.order ?? [] } })
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

router.get("/clients/:id/notes", requireClientFeature, async (req, res): Promise<void> => {
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

router.post("/clients/:id/notes", requireClientFeature, async (req, res): Promise<void> => {
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

router.patch("/clients/:id/notes/:noteId", requireClientFeature, async (req, res): Promise<void> => {
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
  if (parsed.data.body !== undefined || parsed.data.monthOverride !== undefined) {
    const isAdmin = currentUser.role === 'admin';
    if (!isAdmin) {
      const canEditOthers = await hasGroupPermission(currentUser.id, currentUser.organizationId ?? null, "edit_client_notes", false, req);
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
    if (parsed.data.body !== undefined) updateData.body = parsed.data.body;
    if (parsed.data.monthOverride !== undefined) {
      updateData.monthOverride = parsed.data.monthOverride;
    }
  }
  if (parsed.data.checklist !== undefined) {
    if (currentUser.role !== 'admin') {
      // Non-admins may only toggle the `checked` field on existing items.
      // Authors and users with edit permission can also change checklist text/structure.
      const [stored] = await db
        .select({
          authorId: clientNotesTable.authorId,
          checklist: clientNotesTable.checklist,
          organizationId: clientNotesTable.organizationId,
        })
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

      const canEditChecklistContent =
        stored.authorId === currentUser.id ||
        await hasGroupPermission(currentUser.id, currentUser.organizationId ?? null, "edit_client_notes", false, req);

      if (!canEditChecklistContent) {
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
          res.status(403).json({ error: "Forbidden: checklist content can only be changed by its author or an editor" });
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
        // Editors may change structure, but completion metadata remains server-owned.
        const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, currentUser.id)).limit(1);
        const userName = userRow?.name ?? null;
        const storedList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (stored.checklist as any) ?? [];
        const incomingList: Array<{ id: string; text: string; checked: boolean; checkedByName?: string | null; checkedAt?: string | null }> = (parsed.data.checklist as any) ?? [];
        const storedMap = new Map(storedList.map((item) => [item.id, item]));
        updateData.checklist = incomingList.map((incoming) => {
          const existing = storedMap.get(incoming.id);
          if (incoming.checked && (!existing || !existing.checked)) {
            return { ...incoming, checkedByName: userName, checkedAt: new Date().toISOString() };
          }
          if (!incoming.checked && existing?.checked) {
            return { ...incoming, checkedByName: null, checkedAt: null };
          }
          return {
            ...incoming,
            checkedByName: existing?.checkedByName ?? null,
            checkedAt: existing?.checkedAt ?? null,
          };
        });
      }
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

router.delete("/clients/:id/notes/:noteId", requireClientFeature, async (req, res): Promise<void> => {
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
      const canDeleteOthers = await hasGroupPermission(currentUser.id, currentUser.organizationId ?? null, "delete_client_notes", false, req);
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

router.delete("/clients/:id", requireClientFeature, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(ticketsTable)
    .set({ clientId: null, suggestedClientId: null })
    .where(and(eq(ticketsTable.clientId, id), eq(ticketsTable.organizationId, currentUser.organizationId)));

  const [deleted] = await db
    .delete(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.organizationId, currentUser.organizationId)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

export default router;
