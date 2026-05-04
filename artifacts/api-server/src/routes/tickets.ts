import { Router, type IRouter } from "express";
import { eq, and, ilike, or, gte, lte, sql, inArray } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketCommentsTable, ticketInternalNotesTable, ticketActivityLogsTable, ticketAttachmentsTable, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { CreateTicketBody, UpdateTicketBody } from "@workspace/api-zod";
import { createNotificationsForTicket, createNotificationForUser } from "../lib/notifications";

const router: IRouter = Router();

function buildTicketWithDetails(ticket: any, creator: any, assignee: any, commentCount: number, noteCount: number) {
  return {
    ...ticket,
    creator: { id: creator.id, name: creator.name, email: creator.email, role: creator.role, mainLocation: creator.mainLocation, avatarUrl: creator.avatarUrl ?? null, createdAt: creator.createdAt },
    assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role, mainLocation: assignee.mainLocation, avatarUrl: assignee.avatarUrl ?? null, createdAt: assignee.createdAt } : null,
    commentCount,
    noteCount,
  };
}

router.get("/tickets", requireAuth, async (req, res): Promise<void> => {
  const { status, priority, category, location, assignedTo, createdBy, search, dateFrom, dateTo, resource } = req.query as Record<string, string>;

  const conditions: any[] = [];

  if (status) conditions.push(eq(ticketsTable.status, status));
  if (priority) conditions.push(eq(ticketsTable.priority, priority));
  if (category) conditions.push(eq(ticketsTable.category, category));
  if (location) conditions.push(eq(ticketsTable.location, location));
  if (resource) conditions.push(ilike(ticketsTable.resource, `%${resource}%`));
  if (assignedTo) conditions.push(eq(ticketsTable.assignedTo, parseInt(assignedTo, 10)));
  if (createdBy) conditions.push(eq(ticketsTable.createdBy, parseInt(createdBy, 10)));
  if (dateFrom) conditions.push(gte(ticketsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(ticketsTable.createdAt, new Date(dateTo)));

  let tickets;
  if (search) {
    const searchPattern = `%${search}%`;
    const searchTicketIds = await db
      .selectDistinct({ id: ticketsTable.id })
      .from(ticketsTable)
      .leftJoin(ticketCommentsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
      .leftJoin(ticketInternalNotesTable, eq(ticketInternalNotesTable.ticketId, ticketsTable.id))
      .leftJoin(ticketActivityLogsTable, eq(ticketActivityLogsTable.ticketId, ticketsTable.id))
      .where(
        or(
          ilike(ticketsTable.title, searchPattern),
          ilike(ticketsTable.description, searchPattern),
          ilike(ticketsTable.category, searchPattern),
          ilike(ticketsTable.location, searchPattern),
          ilike(ticketsTable.resource, searchPattern),
          ilike(ticketCommentsTable.commentText, searchPattern),
          ilike(ticketInternalNotesTable.noteText, searchPattern),
          ilike(ticketActivityLogsTable.actionDescription, searchPattern)
        )
      );
    const ids = searchTicketIds.map((r) => r.id);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(ticketsTable.id, ids));
  }

  tickets = await db
    .select()
    .from(ticketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${ticketsTable.updatedAt} DESC`);

  const creatorIds = [...new Set(tickets.map((t) => t.createdBy))];
  const assigneeIds = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))] as number[];

  const allUserIds = [...new Set([...creatorIds, ...assigneeIds])];
  const users = allUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, allUserIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const commentCounts = await db
    .select({ ticketId: ticketCommentsTable.ticketId, count: sql<number>`count(*)` })
    .from(ticketCommentsTable)
    .groupBy(ticketCommentsTable.ticketId);
  const commentMap = new Map(commentCounts.map((c) => [c.ticketId, Number(c.count)]));

  const noteCounts = await db
    .select({ ticketId: ticketInternalNotesTable.ticketId, count: sql<number>`count(*)` })
    .from(ticketInternalNotesTable)
    .groupBy(ticketInternalNotesTable.ticketId);
  const noteMap = new Map(noteCounts.map((n) => [n.ticketId, Number(n.count)]));

  const result = tickets.map((t) => buildTicketWithDetails(
    t,
    userMap.get(t.createdBy)!,
    t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    commentMap.get(t.id) ?? 0,
    noteMap.get(t.id) ?? 0
  ));

  res.setHeader("Cache-Control", "private, max-age=30");
  res.json(result);
});

router.post("/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const { title, description, category, location, resource, priority, assignedTo, assignedToGroup } = parsed.data;

  const [ticket] = await db.insert(ticketsTable).values({
    title,
    description,
    category,
    location: location ?? "",
    resource: resource ?? null,
    priority,
    status: "open",
    createdBy: currentUser.id,
    assignedTo: assignedTo ?? null,
    assignedToGroup: assignedToGroup ?? null,
  }).returning();

  await db.insert(ticketActivityLogsTable).values({
    ticketId: ticket.id,
    userId: currentUser.id,
    actionType: "created",
    actionDescription: `Ticket creato da ${currentUser.name}`,
  });

  if (assignedTo) {
    await db.insert(ticketActivityLogsTable).values({
      ticketId: ticket.id,
      userId: currentUser.id,
      actionType: "assigned",
      actionDescription: `Ticket assegnato`,
    });
  }

  await createNotificationsForTicket(ticket.id, `${currentUser.name} ha aperto il ticket #${ticket.id}: "${title}"`, currentUser.id, "ticket_created");
  if (assignedTo && assignedTo !== currentUser.id) {
    await createNotificationForUser(assignedTo, ticket.id, `${currentUser.name} ti ha assegnato il ticket #${ticket.id}: "${title}"`, "ticket_assigned");
  }

  const creator = currentUser;
  let assigneeUser = null;
  if (ticket.assignedTo) {
    const [a] = await db.select().from(usersTable).where(eq(usersTable.id, ticket.assignedTo));
    assigneeUser = a ?? null;
  }

  res.status(201).json(buildTicketWithDetails(ticket, creator, assigneeUser, 0, 0));
});

router.get("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, ticket.createdBy));
  let assignee = null;
  if (ticket.assignedTo) {
    const [a] = await db.select().from(usersTable).where(eq(usersTable.id, ticket.assignedTo));
    assignee = a ?? null;
  }

  const [{ count: cc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id));
  const [{ count: nc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id));

  res.json(buildTicketWithDetails(ticket, creator, assignee, Number(cc), Number(nc)));
});

router.patch("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const updates = parsed.data;
  const activityLogs: { actionType: string; actionDescription: string }[] = [];

  if (updates.status && updates.status !== existing.status) {
    const statusLabels: Record<string, string> = {
      open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
    };
    activityLogs.push({
      actionType: "status_changed",
      actionDescription: `Stato cambiato da "${statusLabels[existing.status] ?? existing.status}" a "${statusLabels[updates.status] ?? updates.status}"`,
    });
    if (updates.status === "closed" || updates.status === "resolved") {
      (updates as any).closedAt = new Date();
    }
  }

  if (updates.priority && updates.priority !== existing.priority) {
    const priorityLabels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };
    activityLogs.push({
      actionType: "priority_changed",
      actionDescription: `Priorita cambiata da "${priorityLabels[existing.priority] ?? existing.priority}" a "${priorityLabels[updates.priority] ?? updates.priority}"`,
    });
  }

  if (updates.category && updates.category !== existing.category) {
    activityLogs.push({ actionType: "category_changed", actionDescription: `Categoria cambiata in "${updates.category}"` });
  }

  if (updates.location && updates.location !== existing.location) {
    activityLogs.push({ actionType: "location_changed", actionDescription: `Sede cambiata in "${updates.location}"` });
  }

  if ("assignedTo" in updates && updates.assignedTo !== existing.assignedTo) {
    if (updates.assignedTo) {
      const [assigneeUser] = await db.select().from(usersTable).where(eq(usersTable.id, updates.assignedTo));
      activityLogs.push({
        actionType: "assigned",
        actionDescription: `Ticket assegnato a ${assigneeUser?.name ?? "utente"}`,
      });
    } else {
      activityLogs.push({ actionType: "unassigned", actionDescription: "Assegnazione rimossa" });
    }
  }

  if ("assignedToGroup" in updates && updates.assignedToGroup !== existing.assignedToGroup) {
    if (updates.assignedToGroup) {
      activityLogs.push({
        actionType: "assigned",
        actionDescription: `Ticket assegnato al gruppo "${updates.assignedToGroup}"`,
      });
    } else {
      activityLogs.push({ actionType: "unassigned", actionDescription: "Assegnazione gruppo rimossa" });
    }
  }

  const [updated] = await db
    .update(ticketsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(ticketsTable.id, id))
    .returning();

  for (const log of activityLogs) {
    await db.insert(ticketActivityLogsTable).values({
      ticketId: id,
      userId: currentUser.id,
      actionType: log.actionType,
      actionDescription: log.actionDescription,
    });
  }

  if (activityLogs.some((l) => l.actionType === "status_changed")) {
    const statusLabels: Record<string, string> = { open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso" };
    const statusLabel = statusLabels[updates.status!] ?? updates.status!;
    await createNotificationsForTicket(id, `${currentUser.name} ha cambiato lo stato del ticket #${id} in "${statusLabel}": "${existing.title}"`, currentUser.id, "ticket_status_changed");
  }
  if (activityLogs.some((l) => l.actionType === "priority_changed")) {
    const priorityLabels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };
    const priorityLabel = priorityLabels[updates.priority!] ?? updates.priority!;
    await createNotificationsForTicket(id, `${currentUser.name} ha cambiato la priorità del ticket #${id} in "${priorityLabel}": "${existing.title}"`, currentUser.id, "ticket_priority_changed");
  }
  if (activityLogs.some((l) => l.actionType === "assigned") && updates.assignedTo && updates.assignedTo !== currentUser.id) {
    await createNotificationForUser(updates.assignedTo, id, `${currentUser.name} ti ha assegnato il ticket #${id}: "${existing.title}"`, "ticket_assigned");
  }

  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, updated.createdBy));
  let assignee = null;
  if (updated.assignedTo) {
    const [a] = await db.select().from(usersTable).where(eq(usersTable.id, updated.assignedTo));
    assignee = a ?? null;
  }

  const [{ count: cc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id));
  const [{ count: nc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id));

  res.json(buildTicketWithDetails(updated, creator, assignee, Number(cc), Number(nc)));
});

router.delete("/tickets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;

  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Ticket non trovato" });
    return;
  }

  await db.delete(notificationsTable).where(eq(notificationsTable.ticketId, id));
  await db.delete(ticketActivityLogsTable).where(eq(ticketActivityLogsTable.ticketId, id));
  await db.delete(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id));
  await db.delete(ticketAttachmentsTable).where(eq(ticketAttachmentsTable.ticketId, id));
  await db.delete(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id));
  await db.delete(ticketsTable).where(eq(ticketsTable.id, id));

  req.log.info({ ticketId: id }, "Ticket eliminato dall'admin");
  res.status(204).send();
});

export default router;
