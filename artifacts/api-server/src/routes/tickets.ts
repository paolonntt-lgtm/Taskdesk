import { Router, type IRouter } from "express";
import { eq, and, ilike, or, gte, lte, sql, inArray, isNotNull } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketCommentsTable, ticketInternalNotesTable, ticketActivityLogsTable, ticketAttachmentsTable, notificationsTable, settingsTable, inboundEmailChannelsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { CreateTicketBody, UpdateTicketBody } from "@workspace/api-zod";
import { createNotificationsForTicket, createNotificationForUser } from "../lib/notifications";
import { sendEmailForOrg, buildTicketClosureEmail } from "../lib/email";
import { appBaseUrl } from "../lib/appUrl";

const router: IRouter = Router();

function buildTicketWithDetails(ticket: any, creator: any, assignee: any, commentCount: number, noteCount: number, inboundChannelName?: string | null) {
  return {
    ...ticket,
    creator: { id: creator.id, name: creator.name, email: creator.email, role: creator.role, mainLocation: creator.mainLocation, avatarUrl: creator.avatarUrl ?? null, createdAt: creator.createdAt },
    assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role, mainLocation: assignee.mainLocation, avatarUrl: assignee.avatarUrl ?? null, createdAt: assignee.createdAt } : null,
    commentCount,
    noteCount,
    inboundChannelName: inboundChannelName ?? null,
  };
}

router.get("/tickets", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const { status, priority, category, location, assignedTo, createdBy, search, dateFrom, dateTo, resource, limit, emailOrigin } = req.query as Record<string, string>;

  const conditions: any[] = [];

  // Always filter by organization
  if (orgId != null) conditions.push(eq(ticketsTable.organizationId, orgId));

  if (status) conditions.push(eq(ticketsTable.status, status));
  if (priority) conditions.push(eq(ticketsTable.priority, priority));
  if (category) conditions.push(eq(ticketsTable.category, category));
  if (location) conditions.push(eq(ticketsTable.location, location));
  if (resource) conditions.push(ilike(ticketsTable.resource, `%${resource}%`));
  if (assignedTo) conditions.push(eq(ticketsTable.assignedTo, parseInt(assignedTo, 10)));
  if (createdBy) conditions.push(eq(ticketsTable.createdBy, parseInt(createdBy, 10)));
  if (dateFrom) conditions.push(gte(ticketsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(ticketsTable.createdAt, new Date(dateTo)));
  if (emailOrigin === 'true') conditions.push(isNotNull(ticketsTable.inboundChannelId));

  if (search) {
    const searchPattern = `%${search}%`;
    const numericId = /^\d+$/.test(search) ? parseInt(search, 10) : null;

    const searchBase = db
      .selectDistinct({ id: ticketsTable.id })
      .from(ticketsTable)
      .leftJoin(ticketCommentsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
      .leftJoin(ticketActivityLogsTable, eq(ticketActivityLogsTable.ticketId, ticketsTable.id));

    const textWhere = or(
      ilike(ticketsTable.title, searchPattern),
      ilike(ticketsTable.description, searchPattern),
      ilike(ticketsTable.category, searchPattern),
      ilike(ticketsTable.location, searchPattern),
      ilike(ticketsTable.resource, searchPattern),
      ilike(ticketCommentsTable.commentText, searchPattern),
      ilike(ticketActivityLogsTable.actionDescription, searchPattern)
    );

    // When the query is a number, also match by exact ticket ID or ticketNumber
    const searchWhere = numericId != null
      ? or(eq(ticketsTable.id, numericId), eq(ticketsTable.ticketNumber, numericId), textWhere)
      : textWhere;

    const orgWhere = orgId != null ? and(eq(ticketsTable.organizationId, orgId), searchWhere) : searchWhere;
    const searchTicketIds = await searchBase.where(orgWhere);
    const ids = searchTicketIds.map((r) => r.id);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(ticketsTable.id, ids));
  }

  const pageLimit = limit ? parseInt(limit, 10) : undefined;

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${ticketsTable.updatedAt} DESC`)
    .limit(pageLimit ?? 10000);

  const creatorIds = [...new Set(tickets.map((t) => t.createdBy))];
  const assigneeIds = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))] as number[];

  const allUserIds = [...new Set([...creatorIds, ...assigneeIds])];
  const users = allUserIds.length > 0
    ? await db.select().from(usersTable).where(
        orgId != null
          ? and(inArray(usersTable.id, allUserIds), eq(usersTable.organizationId, orgId))
          : inArray(usersTable.id, allUserIds)
      )
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

  const solutionTickets = await db
    .selectDistinct({ ticketId: ticketCommentsTable.ticketId })
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.isSolution, true));
  const solutionSet = new Set(solutionTickets.map((s) => s.ticketId));

  // Batch-fetch inbound channel labels for tickets that arrived via email
  const channelIds = [...new Set(tickets.map((t) => t.inboundChannelId).filter(Boolean))] as number[];
  const channels = channelIds.length > 0
    ? await db.select({ id: inboundEmailChannelsTable.id, label: inboundEmailChannelsTable.label })
        .from(inboundEmailChannelsTable)
        .where(inArray(inboundEmailChannelsTable.id, channelIds))
    : [];
  const channelMap = new Map(channels.map((c) => [c.id, c.label]));

  const result = tickets.map((t) => ({
    ...buildTicketWithDetails(
      t,
      userMap.get(t.createdBy)!,
      t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
      commentMap.get(t.id) ?? 0,
      noteMap.get(t.id) ?? 0,
      t.inboundChannelId ? (channelMap.get(t.inboundChannelId) ?? null) : null
    ),
    hasSolution: solutionSet.has(t.id),
  }));

  res.setHeader("Cache-Control", "no-store");
  res.json(result);
});

router.post("/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const { title, description, category, location, resource, priority, assignedTo, assignedToGroup, dueAt, clientId } = parsed.data;

  if (assignedTo) {
    if (currentUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can assign tickets" });
      return;
    }
    const orgId = currentUser.organizationId;
    const [assigneeUser] = await db.select({ id: usersTable.id }).from(usersTable).where(
      and(eq(usersTable.id, assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    );
    if (!assigneeUser) {
      res.status(400).json({ error: "Assignee not found in organization" });
      return;
    }
  }

  // Compute per-org sequential ticket number
  const orgIdForNum = currentUser.organizationId;
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
    .from(ticketsTable)
    .where(orgIdForNum != null ? eq(ticketsTable.organizationId, orgIdForNum) : sql`organization_id IS NULL`);
  const nextTicketNumber = (Number(maxNum) || 0) + 1;

  const [ticket] = await db.insert(ticketsTable).values({
    title,
    description,
    category,
    location: location ?? "",
    resource: resource ?? null,
    priority,
    status: "open",
    createdBy: currentUser.id,
    organizationId: currentUser.organizationId,
    ticketNumber: nextTicketNumber,
    assignedTo: assignedTo ?? null,
    assignedToGroup: assignedToGroup ?? null,
    dueAt: dueAt ? new Date(dueAt) : null,
    clientId: clientId ?? null,
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

  const displayNum = ticket.ticketNumber ?? ticket.id;
  await createNotificationsForTicket(ticket.id, `${currentUser.name} ha aperto il ticket #${displayNum}: "${title}"`, currentUser.id, "ticket_created", currentUser.organizationId);
  if (assignedTo && assignedTo !== currentUser.id) {
    await createNotificationForUser(assignedTo, ticket.id, `${currentUser.name} ti ha assegnato il ticket #${displayNum}: "${title}"`, "ticket_assigned", currentUser.organizationId);
  }

  const creator = currentUser;
  let assigneeUser = null;
  if (ticket.assignedTo) {
    const orgId = currentUser.organizationId;
    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, ticket.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    );
    assigneeUser = a ?? null;
  }

  res.status(201).json(buildTicketWithDetails(ticket, creator, assigneeUser, 0, 0));
});

router.get("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const [ticket] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
      orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
    )
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const [creator] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, ticket.createdBy), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
  );
  let assignee = null;
  if (ticket.assignedTo) {
    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, ticket.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    );
    assignee = a ?? null;
  }

  const [{ count: cc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id));
  const [{ count: nc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id));

  let inboundChannelName: string | null = null;
  if (ticket.inboundChannelId) {
    const [ch] = await db.select({ label: inboundEmailChannelsTable.label })
      .from(inboundEmailChannelsTable)
      .where(eq(inboundEmailChannelsTable.id, ticket.inboundChannelId));
    inboundChannelName = ch?.label ?? null;
  }

  res.json(buildTicketWithDetails(ticket, creator, assignee, Number(cc), Number(nc), inboundChannelName));
});

router.patch("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const isAdmin = currentUser.role === "admin";

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
      orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
    )
  );
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  // Authorization: admins can update all fields; authors can update content fields only
  if (!isAdmin && existing.createdBy !== currentUser.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Check group permissions for non-admins
  const userGroups: string[] = (() => {
    try { return currentUser.groups ? JSON.parse(currentUser.groups) : []; } catch { return []; }
  })();

  let canChangeStatus = isAdmin;
  if (!isAdmin && userGroups.length > 0 && currentUser.organizationId != null) {
    const gpKey = `org_${currentUser.organizationId}_group_permissions`;
    const [gpRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, gpKey));
    if (gpRow) {
      try {
        const perms: Record<string, string[]> = JSON.parse(gpRow.value);
        canChangeStatus = userGroups.some((g) => (perms[g] ?? []).includes("change_status"));
      } catch { /* noop */ }
    }
  }

  const updates: typeof parsed.data = isAdmin
    ? parsed.data
    : canChangeStatus
    ? {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.category !== undefined && { category: parsed.data.category }),
        ...(parsed.data.location !== undefined && { location: parsed.data.location }),
        ...(parsed.data.resource !== undefined && { resource: parsed.data.resource }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
      }
    : {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.category !== undefined && { category: parsed.data.category }),
        ...(parsed.data.location !== undefined && { location: parsed.data.location }),
        ...(parsed.data.resource !== undefined && { resource: parsed.data.resource }),
      };
  const activityLogs: { actionType: string; actionDescription: string }[] = [];

  if (updates.status && updates.status !== existing.status) {
    const statusLabels: Record<string, string> = {
      open: "Aperto", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
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
      const [assigneeUser] = await db.select().from(usersTable).where(
        and(eq(usersTable.id, updates.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
      );
      if (!assigneeUser) {
        res.status(400).json({ error: "Assignee not found in organization" });
        return;
      }
      activityLogs.push({
        actionType: "assigned",
        actionDescription: `Ticket assegnato a ${assigneeUser.name}`,
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
    const statusLabels: Record<string, string> = { open: "Aperto", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso" };
    const statusLabel = statusLabels[updates.status!] ?? updates.status!;
    await createNotificationsForTicket(id, `${currentUser.name} ha cambiato lo stato del ticket #${id} in "${statusLabel}": "${existing.title}"`, currentUser.id, "ticket_status_changed", orgId);

    if (updates.status === "closed" && existing.resource && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existing.resource)) {
      const customerEmail = existing.resource;
      const ticketNum = existing.ticketNumber ?? existing.id;
      void (async () => {
        try {
          let replyTo: string | undefined;
          if (orgId != null) {
            const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.taskdesk.it";
            if (existing.inboundChannelId) {
              const [ch] = await db.select({ token: inboundEmailChannelsTable.token })
                .from(inboundEmailChannelsTable)
                .where(and(
                  eq(inboundEmailChannelsTable.id, existing.inboundChannelId),
                  eq(inboundEmailChannelsTable.organizationId, orgId)
                ));
              if (ch?.token) replyTo = `tickets-${ch.token}@${inboundDomain}`;
            }
            if (!replyTo) {
              const [ch] = await db.select({ token: inboundEmailChannelsTable.token })
                .from(inboundEmailChannelsTable)
                .where(and(
                  eq(inboundEmailChannelsTable.organizationId, orgId),
                  eq(inboundEmailChannelsTable.enabled, true)
                ))
                .limit(1);
              if (ch?.token) replyTo = `tickets-${ch.token}@${inboundDomain}`;
            }
          }
          const baseUrl = appBaseUrl();
          const resolutionNote = updates.resolutionNote ?? existing.resolutionNote ?? undefined;
          const { subject: closureSubject, html, text } = buildTicketClosureEmail({
            toName: customerEmail,
            ticketNumber: ticketNum,
            ticketTitle: existing.title,
            resolutionNote: resolutionNote || undefined,
            appBaseUrl: baseUrl,
          });
          const result = await sendEmailForOrg(orgId, { to: customerEmail, subject: closureSubject, html, text, replyTo });
          if (!result.ok) {
            req.log.warn({ ticketId: id, to: customerEmail, err: result.error }, "Failed to send ticket closure email");
          } else {
            req.log.info({ ticketId: id, to: customerEmail }, "Ticket closure email sent");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          req.log.warn({ ticketId: id, err: msg }, "Error sending ticket closure email");
        }
      })();
    }
  }
  if (activityLogs.some((l) => l.actionType === "priority_changed")) {
    const priorityLabels: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" };
    const priorityLabel = priorityLabels[updates.priority!] ?? updates.priority!;
    await createNotificationsForTicket(id, `${currentUser.name} ha cambiato la priorità del ticket #${id} in "${priorityLabel}": "${existing.title}"`, currentUser.id, "ticket_priority_changed", orgId);
  }
  if (activityLogs.some((l) => l.actionType === "assigned") && updates.assignedTo && updates.assignedTo !== currentUser.id) {
    await createNotificationForUser(updates.assignedTo, id, `${currentUser.name} ti ha assegnato il ticket #${id}: "${existing.title}"`, "ticket_assigned", orgId);
  }

  const [creator] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, updated.createdBy), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
  );
  let assignee = null;
  if (updated.assignedTo) {
    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, updated.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    );
    assignee = a ?? null;
  }

  const [{ count: cc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id));
  const [{ count: nc }] = await db.select({ count: sql<number>`count(*)` }).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id));

  res.json(buildTicketWithDetails(updated, creator, assignee, Number(cc), Number(nc)));
});

router.delete("/tickets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [existing] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
      orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined
    )
  );
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
