import 
{
 Router, type IRouter 
}
 from "express"
;

import 
{
 eq, and, ilike, or, gte, lte, lt, sql, inArray, isNotNull, isNull, gt, asc, notInArray 
}
 from "drizzle-orm"
;

import {
  db, ticketsTable, usersTable, ticketTimeSessionsTable, ticketCommentsTable,
  ticketInternalNotesTable, ticketActivityLogsTable, ticketAttachmentsTable,
  ticketAttachmentOneDriveCopiesTable, oneDriveConnectionsTable, notificationsTable,
  settingsTable, inboundEmailChannelsTable, clientsTable, emailClientSenderRulesTable,
  emailClientDomainRulesTable, ticketStatusesTable, ticketChecklistsTable,
  ticketChecklistItemsTable, groupsTable, groupMembersTable, checklistTemplatesTable,
  checklistTemplateItemsTable, organizationsTable,
} from "@workspace/db";

import 
{
 requireAuth, requireAdmin 
}
 from "../middlewares/auth"
;

import 
{
 CreateTicketBody, UpdateTicketBody 
}
 from "@workspace/api-zod"
;

import 
{
 createNotificationsForSubscribers, createNotificationForUser, subscribeUserToTicket 
}
 from "../lib/notifications"
;

import 
{
 sendEmailForOrg, buildTicketClosureEmail 
}
 from "../lib/email"
;

import 
{
 appBaseUrl 
}
 from "../lib/appUrl"
;

import 
{
 hasGroupPermission, VIEW_WORKED_HOURS_PERMISSION, ASSIGN_TIME_TRACKED_TICKETS_PERMISSION 
}
 from "../lib/groupPermissions"
;

import 
{
 isValidWorkedMinutes, redactWorkedHours 
}
 from "../lib/workedTime"
;

import 
{
 permanentlyDeleteTicket 
}
 from "../lib/ticketTrash"
;

import 
{
 computeNextWeeklyRecurrence 
}
 from "../lib/weeklyRecurrence"
;

import 
{
 getClosedTicketStatusKeys 
}
 from "../lib/closedTicketStatuses"
;

import 
{
 isClientFeatureEnabled, redactClientData 
}
 from "../lib/clientFeature"
;

import 
{
 domainForSender, normalizeSenderEmail, resolveEmailClientAssociation 
}
 from "../lib/emailClientAssociation"
;

import 
{
 prefixTicketTitleWithClient 
}
 from "../lib/clientTicketTitle"
;

import { syncTicketOneDriveAttachments } from "../lib/onedriveGraph";


const router: IRouter = Router()
;


const TICKET_LIST_COLS = 
{

  id: ticketsTable.id,
  organizationId: ticketsTable.organizationId,
  ticketNumber: ticketsTable.ticketNumber,
  title: ticketsTable.title,
  category: ticketsTable.category,
  location: ticketsTable.location,
  resource: ticketsTable.resource,
  priority: ticketsTable.priority,
  status: ticketsTable.status,
  visibility: ticketsTable.visibility,
  createdBy: ticketsTable.createdBy,
  assignedTo: ticketsTable.assignedTo,
  assignedToGroup: ticketsTable.assignedToGroup,
  resolutionNote: ticketsTable.resolutionNote,
  workedMinutes: ticketsTable.workedMinutes,
  workedBillingStatus: ticketsTable.workedBillingStatus,
  timeTrackingEnabled: ticketsTable.timeTrackingEnabled,
  timeTrackingBillable: ticketsTable.timeTrackingBillable,
  timeTrackingCompensationOverride: ticketsTable.timeTrackingCompensationOverride,
  dueAt: ticketsTable.dueAt,
  createdAt: ticketsTable.createdAt,
  updatedAt: ticketsTable.updatedAt,
  closedAt: ticketsTable.closedAt,
  deletedAt: ticketsTable.deletedAt,
  scheduledAt: ticketsTable.scheduledAt,
  clientId: ticketsTable.clientId,
  inboundChannelId: ticketsTable.inboundChannelId,
  emailMessageId: ticketsTable.emailMessageId,
  emailConversationId: ticketsTable.emailConversationId,
  recurrenceRule: ticketsTable.recurrenceRule,
  recurrenceNextAt: ticketsTable.recurrenceNextAt,
  recurrenceParentId: ticketsTable.recurrenceParentId,
} as const;


const USER_LIST_COLS = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  mainLocation: usersTable.mainLocation,
  avatarUrl: usersTable.avatarUrl,
  createdAt: usersTable.createdAt,
} as const;


function daysInMonth(year: number, month: number): number 
{

  return new Date(year, month + 1, 0).getDate()
;

}


function isWaitingStatus(status: 
{
 key: string
;
 label: string
;
 isClosed?: boolean 
}
): boolean 
{

  return !status.isClosed && (status.key === "waiting" || /waiting|attesa/i.test(status.label))
;

}


function addMonthsOnDay(from: Date, months: number, dayOfMonth?: number | null): Date 
{

  const targetDay = Math.min(31, Math.max(1, Math.round(dayOfMonth ?? from.getDate())))
;

  const next = new Date(from)
;

  next.setDate(1)
;

  next.setMonth(next.getMonth() + months)
;

  next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())))
;

  return next
;

}


function addWeeksOnDay(from: Date, weeks: number, dayOfWeek?: number | null): Date 
{

  if (dayOfWeek == null) 
{

    const next = new Date(from)
;

    next.setDate(next.getDate() + 7 * weeks)
;

    return next
;

  
}


  const targetDay = Math.min(6, Math.max(0, Math.round(dayOfWeek)))
;

  const next = new Date(from)
;

  const daysUntilTarget = (targetDay - next.getDay() + 7) % 7 || 7
;

  next.setDate(next.getDate() + daysUntilTarget + 7 * (weeks - 1))
;

  return next
;

}


function computeNextRecurrence(
  from: Date,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
  interval: number = 1,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date 
{

  const n = Math.max(1, Math.round(interval))
;

  const next = new Date(from)
;

  switch (frequency) 
{

    case "daily": next.setDate(next.getDate() + n)
;
 break
;

    case "weekly": return computeNextWeeklyRecurrence(from, n, dayOfWeek)
;

    case "monthly": 
{

      const selectedDay = dayOfMonth ?? from.getDate()
;

      const candidate = new Date(from)
;

      candidate.setDate(Math.min(selectedDay, daysInMonth(candidate.getFullYear(), candidate.getMonth())))
;

      const months = n === 1 && candidate > from ? 0 : n
;

      return addMonthsOnDay(from, months, selectedDay)
;

    
}

    case "yearly": next.setFullYear(next.getFullYear() + n)
;
 break
;

  
}

  return next
;

}


function buildTicketWithDetails(
  ticket: any,
  creator: any,
  assignee: any,
  commentCount: number,
  noteCount: number,
  inboundChannelName?: string | null,
  client?: { id: number; name: string; alias?: string | null } | null,
) {
  return {
    ...ticket,
    creator: {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      role: creator.role,
      mainLocation: creator.mainLocation,
      avatarUrl: creator.avatarUrl ?? null,
      createdAt: creator.createdAt,
    },
    assignee: assignee
      ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
          role: assignee.role,
          mainLocation: assignee.mainLocation,
          avatarUrl: assignee.avatarUrl ?? null,
          createdAt: assignee.createdAt,
        }
      : null,
    commentCount,
    noteCount,
    inboundChannelName: inboundChannelName ?? null,
    client: client ?? null,
  };
}


router.get("/tickets", requireAuth, async (req, res): Promise<void> => 
{

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;


  const canViewWorkedHours = await hasGroupPermission(
    currentUser.id,
    orgId,
    VIEW_WORKED_HOURS_PERMISSION,
    currentUser.role === "admin",
    req,
  )
;


  const 
{
 status, priority, category, location, assignedTo, createdBy, search, dateFrom, dateTo, resource, limit, emailOrigin, clientId, scheduled, recurring, nonClosed 
}
 = req.query as Record<string, string>
;


  const conditions: any[] = []
;


  // Always filter by organization
  conditions.push(eq(ticketsTable.organizationId, orgId))
;

  // Deleted tickets are only available through the admin trash view.
  conditions.push(isNull(ticketsTable.deletedAt))
;

  // Admin-only tickets must never appear in non-admin list/search results.
  if (currentUser.role !== "admin") 
{

    conditions.push(eq(ticketsTable.visibility, "organization"))
;

  
}


  // Scheduled filter: when scheduled=true show only future-scheduled tickets,
  // otherwise hide them.
  if (scheduled === 'true') 
{

    conditions.push(isNotNull(ticketsTable.scheduledAt))
;

    conditions.push(gt(ticketsTable.scheduledAt, sql`now()`))
;

  
}
 else 
{

    conditions.push(or(isNull(ticketsTable.scheduledAt), lte(ticketsTable.scheduledAt, sql`now()`))!)
;

  
}

  // Recurring tickets are the source tickets with a recurrence rule.
  // Scheduled clones remain separate and keep the scheduled filter semantics.
  if (recurring === "true") 
{

    conditions.push(isNotNull(ticketsTable.recurrenceRule))
;

  
}


  if (nonClosed === "true") 
{

    const configuredStatuses = await db.select(
{

      key: ticketStatusesTable.key,
      isClosed: ticketStatusesTable.isClosed,
    
}
)
      .from(ticketStatusesTable)
      .where(eq(ticketStatusesTable.organizationId, orgId))
;

    const closedStatusKeys = getClosedTicketStatusKeys(configuredStatuses)
;

    conditions.push(closedStatusKeys.length > 0
      ? notInArray(ticketsTable.status, closedStatusKeys)
      : sql`true`)
;

  
}


  if (status) 
{

    const vals = status.split(',').map((v) => v.trim()).filter(Boolean)
;

    const hasDueSoon = vals.includes('due_soon')
;

    const realStatuses = vals.filter((v) => v !== 'due_soon')
;


    const dueSoonCond = hasDueSoon
      ? and(
          isNotNull(ticketsTable.dueAt),
          gte(ticketsTable.dueAt, sql`now()`),
          lte(ticketsTable.dueAt, sql`now() + interval '7 days'`),
          sql`${ticketsTable.status} not in ('resolved','closed')`
        )
      : undefined
;


    if (hasDueSoon && realStatuses.length === 0) 
{

      conditions.push(dueSoonCond!)
;

    
}
 else if (!hasDueSoon && realStatuses.length > 0) 
{

      if (realStatuses.length === 1) conditions.push(eq(ticketsTable.status, realStatuses[0]))
;

      else conditions.push(inArray(ticketsTable.status, realStatuses))
;

    
}
 else if (hasDueSoon && realStatuses.length > 0) 
{

      const realCond = realStatuses.length === 1
        ? eq(ticketsTable.status, realStatuses[0])
        : inArray(ticketsTable.status, realStatuses)
;

      conditions.push(or(realCond, dueSoonCond!)!)
;

    
}

  
}

  if (priority) 
{

    const vals = priority.split(',').map((v) => v.trim()).filter(Boolean)
;

    if (vals.length === 1) conditions.push(eq(ticketsTable.priority, vals[0]))
;

    else if (vals.length > 1) conditions.push(inArray(ticketsTable.priority, vals))
;

  
}

  if (category) 
{

    const vals = category.split(',').map((v) => v.trim()).filter(Boolean)
;

    if (vals.length === 1) conditions.push(eq(ticketsTable.category, vals[0]))
;

    else if (vals.length > 1) conditions.push(inArray(ticketsTable.category, vals))
;

  
}

  if (location) 
{

    const vals = location.split(',').map((v) => v.trim()).filter(Boolean)
;

    if (vals.length === 1) conditions.push(eq(ticketsTable.location, vals[0]))
;

    else if (vals.length > 1) conditions.push(inArray(ticketsTable.location, vals))
;

  
}

  if (resource) conditions.push(ilike(ticketsTable.resource, `%${resource}%`))
;

  if (assignedTo) conditions.push(eq(ticketsTable.assignedTo, parseInt(assignedTo, 10)))
;

  if (createdBy) conditions.push(eq(ticketsTable.createdBy, parseInt(createdBy, 10)))
;

  const 
{
 assignedToGroup: groupFilter 
}
 = req.query as Record<string, string>
;

  if (groupFilter) conditions.push(eq(ticketsTable.assignedToGroup, groupFilter))
;

  if (dateFrom) conditions.push(gte(ticketsTable.createdAt, new Date(dateFrom)))
;

  if (dateTo) conditions.push(lte(ticketsTable.createdAt, new Date(dateTo)))
;

  if (emailOrigin === 'true') conditions.push(isNotNull(ticketsTable.inboundChannelId))
;

  if (clientId) 
{

    if (!clientsEnabled) 
{

      res.status(403).json(
{
 error: "Client management is disabled for this organization" 
}
)
;

      return
;

    
}

    conditions.push(eq(ticketsTable.clientId, parseInt(clientId, 10)))
;

  
}

  const 
{
 overdue 
}
 = req.query as Record<string, string>
;

  if (overdue === 'true') 
{

    conditions.push(isNotNull(ticketsTable.dueAt))
;

    conditions.push(lt(ticketsTable.dueAt, sql`now()`))
;

    conditions.push(sql`${ticketsTable.status} not in ('resolved','closed')`)
;

  
}


  if (search) 
{

    const searchPattern = `%${search}%`
;

    const numericId = /^\d+$/.test(search) ? parseInt(search, 10) : null
;


    const searchBase = db
      .selectDistinct(
{
 id: ticketsTable.id 
}
)
      .from(ticketsTable)
      .leftJoin(ticketCommentsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
      .leftJoin(ticketActivityLogsTable, eq(ticketActivityLogsTable.ticketId, ticketsTable.id))
;


    const textWhere = or(
      ilike(ticketsTable.title, searchPattern),
      ilike(ticketsTable.description, searchPattern),
      ilike(ticketsTable.category, searchPattern),
      ilike(ticketsTable.location, searchPattern),
      ilike(ticketsTable.resource, searchPattern),
      ilike(ticketCommentsTable.commentText, searchPattern),
      ilike(ticketActivityLogsTable.actionDescription, searchPattern)
    )
;


    // When the query is a number, also match by exact ticket ID or ticketNumber
    const searchWhere = numericId != null
      ? or(eq(ticketsTable.id, numericId), eq(ticketsTable.ticketNumber, numericId), textWhere)
      : textWhere
;


    const orgWhere = orgId != null ? and(eq(ticketsTable.organizationId, orgId), searchWhere) : searchWhere
;

    const searchTicketIds = await searchBase.where(orgWhere)
;

    const ids = searchTicketIds.map((r) => r.id)
;

    if (ids.length === 0) 
{

      res.json([])
;

      return
;

    
}

    conditions.push(inArray(ticketsTable.id, ids))
;

  
}


  const pageLimit = limit ? parseInt(limit, 10) : undefined
;


  const tickets = await db
    .select(TICKET_LIST_COLS)
    .from(ticketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${ticketsTable.updatedAt} DESC`)
    .limit(pageLimit ?? 10000)
;


  const creatorIds = [...new Set(tickets.map((t) => t.createdBy))]
;

  const assigneeIds = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))] as number[]
;


  const allUserIds = [...new Set([...creatorIds, ...assigneeIds])]
;

  const users = allUserIds.length > 0
    ? await db.select(USER_LIST_COLS).from(usersTable).where(
        orgId != null
          ? and(inArray(usersTable.id, allUserIds), eq(usersTable.organizationId, orgId))
          : inArray(usersTable.id, allUserIds)
      )
    : []
;

  const userMap = new Map(users.map((u) => [u.id, u]))
;


  const commentCounts = await db
    .select(
{
 ticketId: ticketCommentsTable.ticketId, count: sql<number>`count(*)` 
}
)
    .from(ticketCommentsTable)
    .groupBy(ticketCommentsTable.ticketId)
;

  const commentMap = new Map(commentCounts.map((c) => [c.ticketId, Number(c.count)]))
;


  const noteCounts = await db
    .select(
{
 ticketId: ticketInternalNotesTable.ticketId, count: sql<number>`count(*)` 
}
)
    .from(ticketInternalNotesTable)
    .groupBy(ticketInternalNotesTable.ticketId)
;

  const noteMap = new Map(noteCounts.map((n) => [n.ticketId, Number(n.count)]))
;


  const solutionTickets = await db
    .selectDistinct(
{
 ticketId: ticketCommentsTable.ticketId 
}
)
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.isSolution, true))
;

  const solutionSet = new Set(solutionTickets.map((s) => s.ticketId))
;


  // Batch-fetch inbound channel labels for tickets that arrived via email
  const channelIds = [...new Set(tickets.map((t) => t.inboundChannelId).filter(Boolean))] as number[]
;

  const channels = channelIds.length > 0
    ? await db.select(
{
 id: inboundEmailChannelsTable.id, label: inboundEmailChannelsTable.label 
}
)
        .from(inboundEmailChannelsTable)
        .where(inArray(inboundEmailChannelsTable.id, channelIds))
    : []
;

  const channelMap = new Map(channels.map((c) => [c.id, c.label]))
;


  const clientIds = [...new Set(tickets.map((t) => t.clientId).filter(Boolean))] as number[]
;

  const clientRows = clientsEnabled && clientIds.length > 0
    ? await db.select(
{
 id: clientsTable.id, name: clientsTable.name, alias: clientsTable.alias 
}
)
        .from(clientsTable)
        .where(inArray(clientsTable.id, clientIds))
    : []
;

  const clientMap = new Map(clientRows.map((c) => [c.id, c]))
;


  // Batch-fetch checklist progress (total and checked items) per ticket
  const ticketIds = tickets.map((t) => t.id)
;

  const checklistStats = ticketIds.length > 0
    ? await db
        .select(
{

          ticketId: ticketChecklistsTable.ticketId,
          checklistCount: sql<number>`count(distinct ${ticketChecklistsTable.id})`,
          total: sql<number>`count(${ticketChecklistItemsTable.id})`,
          checked: sql<number>`count(${ticketChecklistItemsTable.id}) filter (where ${ticketChecklistItemsTable.checked} = true)`,
        
}
)
        .from(ticketChecklistsTable)
        .leftJoin(ticketChecklistItemsTable, eq(ticketChecklistItemsTable.checklistId, ticketChecklistsTable.id))
        .where(inArray(ticketChecklistsTable.ticketId, ticketIds))
        .groupBy(ticketChecklistsTable.ticketId)
    : []
;

  const checklistMap = new Map(checklistStats.map((s) => [s.ticketId, 
{
 checklistCount: Number(s.checklistCount), total: Number(s.total), checked: Number(s.checked) 
}
]))
;


  const result = tickets.map((t) => (
{

    ...redactClientData(buildTicketWithDetails(
      t,
      userMap.get(t.createdBy)!,
      t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
      commentMap.get(t.id) ?? 0,
      noteMap.get(t.id) ?? 0,
      t.inboundChannelId ? (channelMap.get(t.inboundChannelId) ?? null) : null,
      clientsEnabled && t.clientId ? (clientMap.get(t.clientId) ?? null) : null
    ), clientsEnabled),
    hasSolution: solutionSet.has(t.id),
    checklistCount: checklistMap.get(t.id)?.checklistCount ?? 0,
    checklistTotal: checklistMap.get(t.id)?.total ?? 0,
    checklistChecked: checklistMap.get(t.id)?.checked ?? 0,
    recurrence: t.recurrenceRule != null,
  
}
))
;


  res.setHeader("Cache-Control", "no-store")
;

  res.json(result.map((ticket) => 
{

    const responseTicket = redactClientData(redactWorkedHours(ticket, canViewWorkedHours), clientsEnabled)
;

    if (currentUser.role !== "admin") 
{

      delete (responseTicket as any).timeTrackingBillable
;

      delete (responseTicket as any).timeTrackingCompensationOverride
;

    
}

    return responseTicket
;

  
}
))
;

}
)
;


router.get("/tickets/trash", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;


  const tickets = await db
    .select(TICKET_LIST_COLS)
    .from(ticketsTable)
    .where(and(eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.deletedAt)))
    .orderBy(sql`${ticketsTable.deletedAt} DESC`)
;


  res.setHeader("Cache-Control", "no-store")
;

  res.json(tickets.map((ticket) => redactClientData(ticket, clientsEnabled)))
;

}
)
;


router.post("/tickets", requireAuth, async (req, res): Promise<void> => 
{

  const parsed = CreateTicketBody.safeParse(req.body)
;

  if (!parsed.success) 
{

    res.status(400).json(
{
 error: "Invalid request", message: parsed.error.message 
}
)
;

    return
;

  
}


  const currentUser = (req as any).currentUser
;

  if (currentUser.organizationId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}

  const clientsEnabled = await isClientFeatureEnabled(currentUser.organizationId)
;


  const 
{

    title,
    description,
    category,
    location,
    resource,
    priority,
    assignedTo,
    assignedToGroup,
    dueAt,
    clientId,
    visibility = "organization",
    recurrenceRule,
    timeTrackingEnabled = false,
    timeTrackingBillable = false,
    timeTrackingCompensationOverride = null,
  
}
 = parsed.data
;


  if (timeTrackingEnabled || timeTrackingBillable || timeTrackingCompensationOverride !== null) 
{

    if (currentUser.role !== "admin") 
{

      res.status(403).json(
{
 error: "Only admins can configure ticket time tracking" 
}
)
;

      return
;

    
}

    const [organization] = await db.select(
{
 enabled: organizationsTable.timeTrackingModuleEnabled 
}
)
      .from(organizationsTable)
      .where(eq(organizationsTable.id, currentUser.organizationId))
;

    if (!organization?.enabled) 
{

      res.status(403).json(
{
 error: "Time tracking is disabled for this organization" 
}
)
;

      return
;

    
}

    if (!timeTrackingEnabled && (timeTrackingBillable || timeTrackingCompensationOverride !== null)) 
{

      res.status(400).json(
{
 error: "Ticket classification requires time tracking to be enabled" 
}
)
;

      return
;

    
}

  
}


  if (timeTrackingEnabled && timeTrackingBillable && clientId == null) 
{

    res.status(400).json(
{
 error: "Client-billable tracked tickets require a client" 
}
)
;

    return
;

  
}

  if (timeTrackingEnabled && timeTrackingCompensationOverride === true && assignedTo == null) 
{

    res.status(400).json(
{
 error: "Collaborator-recognizable tracked tickets require an individual assignee" 
}
)
;

    return
;

  
}


  if (clientId != null) 
{

    const [organization] = await db
      .select(
{
 clientsEnabled: organizationsTable.clientsEnabled 
}
)
      .from(organizationsTable)
      .where(eq(organizationsTable.id, currentUser.organizationId))
      .limit(1)
;

    if (!organization?.clientsEnabled) 
{

      res.status(403).json(
{
 error: "Client management is disabled for this organization" 
}
)
;

      return
;

    
}

  
}


  if (visibility === "admins" && currentUser.role !== "admin") 
{

    res.status(403).json(
{
 error: "Only admins can create private tickets" 
}
)
;

    return
;

  
}


  if (recurrenceRule && currentUser.role !== "admin") 
{

    res.status(403).json(
{
 error: "Only admins can create recurring tickets" 
}
)
;

    return
;

  
}


  if (assignedTo) 
{

    if (currentUser.role !== "admin" && assignedTo !== currentUser.id) 
{

      res.status(403).json(
{
 error: "Only admins can assign tickets to other users" 
}
)
;

      return
;

    
}

    const orgId = currentUser.organizationId
;

    const [assigneeUser] = await db.select(
{
 id: usersTable.id 
}
).from(usersTable).where(
      and(eq(usersTable.id, assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    )
;

    if (!assigneeUser) 
{

      res.status(400).json(
{
 error: "Assignee not found in organization" 
}
)
;

      return
;

    
}

  
}


  if (assignedToGroup && currentUser.role !== "admin") 
{

    res.status(403).json(
{
 error: "Only admins can assign tickets to groups" 
}
)
;

    return
;

  
}


  if (clientId != null) 
{

    const orgId = currentUser.organizationId
;

    const [clientRow] = await db.select(
{
 id: clientsTable.id 
}
).from(clientsTable).where(
      and(eq(clientsTable.id, clientId), orgId != null ? eq(clientsTable.organizationId, orgId) : undefined)
    )
;

    if (!clientRow) 
{

      res.status(400).json(
{
 error: "Client not found in organization" 
}
)
;

      return
;

    
}

  
}


  // Compute per-org sequential ticket number
  const orgIdForNum = currentUser.organizationId
;

  const [
{
 maxNum 
}
] = await db
    .select(
{
 maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` 
}
)
    .from(ticketsTable)
    .where(orgIdForNum != null ? eq(ticketsTable.organizationId, orgIdForNum) : sql`organization_id IS NULL`)
;

  const nextTicketNumber = (Number(maxNum) || 0) + 1
;


  // Use the org's default status if configured, otherwise fall back to "open"
  let defaultStatusKey = "open";
  if (orgIdForNum != null) {
    const orgStatuses = await db
      .select({ key: ticketStatusesTable.key, label: ticketStatusesTable.label, isDefault: ticketStatusesTable.isDefault, isClosed: ticketStatusesTable.isClosed })
      .from(ticketStatusesTable)
      .where(eq(ticketStatusesTable.organizationId, orgIdForNum));
    const defaultStatus = orgStatuses.find((status) => status.isDefault);
    if (defaultStatus) defaultStatusKey = defaultStatus.key;
    if (timeTrackingEnabled) {
      const waitingStatus = orgStatuses.find(isWaitingStatus);
      if (!waitingStatus) {
        res.status(400).json({ error: "Tracked tickets require an 'In attesa' status in the organization status list" });
        return;
      }
      defaultStatusKey = waitingStatus.key;
    }
  }

  const recurrenceNextAt = recurrenceRule
    ? computeNextRecurrence(
        new Date(),
        recurrenceRule.frequency,
        recurrenceRule.interval ?? 1,
        recurrenceRule.dayOfMonth ?? null,
        recurrenceRule.dayOfWeek ?? null,
      )
    : null;

  const [ticket] = await db.insert(ticketsTable).values({
    title,
    description,
    category,
    location: location ?? "",
    resource: resource ?? null,
    priority,
    status: defaultStatusKey,
    visibility,
    timeTrackingEnabled,
    timeTrackingBillable: timeTrackingEnabled && timeTrackingBillable,
    timeTrackingCompensationOverride: timeTrackingEnabled ? timeTrackingCompensationOverride : null,
    createdBy: currentUser.id,
    organizationId: currentUser.organizationId,
    ticketNumber: nextTicketNumber,
    assignedTo: assignedTo ?? null,
    assignedToGroup: assignedToGroup ?? null,
    dueAt: dueAt ? new Date(dueAt) : null,
    clientId: clientId ?? null,
    recurrenceRule: recurrenceRule ?? null,
    recurrenceNextAt,
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

  if (recurrenceRule) {
    await db.insert(ticketActivityLogsTable).values({
      ticketId: ticket.id,
      userId: currentUser.id,
      actionType: "recurrence_set",
      actionDescription: `Ricorrenza impostata: ${recurrenceRule.frequency}`,
    });
  }

  if (category && orgIdForNum != null) {
    const categoryTemplates = await db
      .select()
      .from(checklistTemplatesTable)
      .where(and(
        eq(checklistTemplatesTable.orgId, orgIdForNum),
        eq(checklistTemplatesTable.category, category)
      ))
      .orderBy(asc(checklistTemplatesTable.position), asc(checklistTemplatesTable.id));

    if (categoryTemplates.length > 0) {
      const tplIds = categoryTemplates.map((t) => t.id);
      const allTplItems = await db
        .select()
        .from(checklistTemplateItemsTable)
        .where(inArray(checklistTemplateItemsTable.templateId, tplIds))
        .orderBy(asc(checklistTemplateItemsTable.position), asc(checklistTemplateItemsTable.id));

      const itemsByTpl = new Map<number, typeof allTplItems>();
      for (const item of allTplItems) {
        if (!itemsByTpl.has(item.templateId)) itemsByTpl.set(item.templateId, []);
        itemsByTpl.get(item.templateId)!.push(item);
      }

      for (let tplIdx = 0; tplIdx < categoryTemplates.length; tplIdx++) {
        const tpl = categoryTemplates[tplIdx];
        const [cl] = await db.insert(ticketChecklistsTable).values({
          ticketId: ticket.id,
          orgId: orgIdForNum,
          title: tpl.title,
          position: tplIdx,
          fromTemplateId: tpl.id,
          fromTemplateName: tpl.title,
        }).returning();

        const tplItems = itemsByTpl.get(tpl.id) ?? [];
        if (tplItems.length > 0) {
          await db.insert(ticketChecklistItemsTable).values(
            tplItems.map((item, i) => ({
              checklistId: cl.id,
              orgId: orgIdForNum,
              text: item.text,
              checked: false,
              position: i,
            }))
          );
        }

        await db.insert(ticketActivityLogsTable).values({
          ticketId: ticket.id,
          userId: currentUser.id,
          actionType: "checklist_applied_from_template",
          actionDescription: `Checklist applicata da template: "${tpl.title}"`,
        });
      }
    }
  }

  const displayNum = ticket.ticketNumber ?? ticket.id;
  if (assignedTo && assignedTo !== currentUser.id) {
    await createNotificationForUser(assignedTo, ticket.id, `${currentUser.name} ti ha assegnato il ticket #${displayNum}: "${title}"`, "ticket_assigned", currentUser.organizationId);
  }
  if (assignedTo && currentUser.organizationId != null) {
    await subscribeUserToTicket(assignedTo, ticket.id, currentUser.organizationId);
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

  let ticketClient = null;
  if (clientsEnabled && ticket.clientId) {
    const [c] = await db.select({ id: clientsTable.id, name: clientsTable.name, alias: clientsTable.alias })
      .from(clientsTable)
      .where(eq(clientsTable.id, ticket.clientId));
    ticketClient = c ?? null;
  }
  const canViewWorkedHours = await hasGroupPermission(
    currentUser.id,
    currentUser.organizationId,
    VIEW_WORKED_HOURS_PERMISSION,
    currentUser.role === "admin",
    req,
  );
  res.status(201).json(redactClientData(redactWorkedHours(
    buildTicketWithDetails(ticket, creator, assigneeUser, 0, 0, null, ticketClient),
    canViewWorkedHours,
  ), clientsEnabled));
});

router.get("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const clientsEnabled = await isClientFeatureEnabled(orgId);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const [ticket] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
      eq(ticketsTable.organizationId, orgId),
      isNull(ticketsTable.deletedAt)
    )
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (currentUser.role !== "admin" && ticket.visibility === "admins") {
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

  let ticketClient = null;
  if (clientsEnabled && ticket.clientId) {
    const [c] = await db.select({ id: clientsTable.id, name: clientsTable.name, alias: clientsTable.alias })
      .from(clientsTable)
      .where(eq(clientsTable.id, ticket.clientId));
    ticketClient = c ?? null;
  }
  let suggestedClient = null;
  let clientAssociationIssue: ReturnType<typeof resolveEmailClientAssociation>["clientAssociationIssue"];
  if (
    currentUser.role === "admin" &&
    clientsEnabled &&
    !ticket.clientId &&
    (ticket.inboundChannelId || ticket.emailMessageId || ticket.emailConversationId)
  ) {
    const senderEmail = normalizeSenderEmail(ticket.resource ?? "");
    if (senderEmail) {
      const domain = domainForSender(senderEmail);
      const [clients, senderRules, domainRules] = await Promise.all([
        db.select({
          id: clientsTable.id,
          name: clientsTable.name,
          alias: clientsTable.alias,
          email: clientsTable.email,
          pec: clientsTable.pec,
        }).from(clientsTable).where(eq(clientsTable.organizationId, orgId)),
        db.select({
          organizationId: emailClientSenderRulesTable.organizationId,
          senderEmail: emailClientSenderRulesTable.senderEmail,
          clientId: emailClientSenderRulesTable.clientId,
        }).from(emailClientSenderRulesTable).where(and(
          eq(emailClientSenderRulesTable.organizationId, orgId),
          eq(emailClientSenderRulesTable.senderEmail, senderEmail),
        )),
        domain ? db.select({
          organizationId: emailClientDomainRulesTable.organizationId,
          domain: emailClientDomainRulesTable.domain,
          clientId: emailClientDomainRulesTable.clientId,
        }).from(emailClientDomainRulesTable).where(and(
          eq(emailClientDomainRulesTable.organizationId, orgId),
          eq(emailClientDomainRulesTable.domain, domain),
        )) : Promise.resolve([]),
      ]);
      clientAssociationIssue = resolveEmailClientAssociation({
        organizationId: orgId,
        senderEmail,
        clients: clients.map((client) => ({ ...client, organizationId: orgId })),
        senderRules,
        domainRules,
      }).clientAssociationIssue;
    }
  }
  if (currentUser.role === "admin" && clientsEnabled && ticket.suggestedClientId) {
    const [candidate] = await db.select({
      id: clientsTable.id,
      name: clientsTable.name,
      alias: clientsTable.alias,
    }).from(clientsTable).where(and(
      eq(clientsTable.id, ticket.suggestedClientId),
      eq(clientsTable.organizationId, orgId),
    ));
    suggestedClient = candidate ?? null;
  }

  const canViewWorkedHours = await hasGroupPermission(
    currentUser.id,
    orgId,
    VIEW_WORKED_HOURS_PERMISSION,
    currentUser.role === "admin",
    req,
  );
  const detail = buildTicketWithDetails(
    ticket,
    creator,
    assignee,
    Number(cc),
    Number(nc),
    inboundChannelName,
    ticketClient,
  );
  if (currentUser.role === "admin" && clientsEnabled) {
    (detail as any).suggestedClient = suggestedClient;
    if (clientAssociationIssue) {
      (detail as any).clientAssociationIssue = clientAssociationIssue;
    }
  }
  const groupCanChangeStatus = await hasGroupPermission(
    currentUser.id,
    orgId,
    "change_status",
    currentUser.role === "admin",
  );
  detail.canChangeStatus = ticket.timeTrackingEnabled
    ? currentUser.role === "admin" || ticket.assignedTo === currentUser.id
    : currentUser.role === "admin" || groupCanChangeStatus || ticket.assignedTo === currentUser.id;
  const [trackingSettings] = await db.select({
    enabled: organizationsTable.timeTrackingModuleEnabled,
  }).from(organizationsTable).where(eq(organizationsTable.id, orgId));
  const isTimeTrackingParticipant = currentUser.role === "admin" || (await db
    .select({ id: ticketTimeSessionsTable.id })
    .from(ticketTimeSessionsTable)
    .where(and(
      eq(ticketTimeSessionsTable.ticketId, id),
      eq(ticketTimeSessionsTable.organizationId, orgId),
      eq(ticketTimeSessionsTable.userId, currentUser.id),
    ))
    .limit(1)).length > 0;
  detail.canViewTimeTrackingSummary =
    trackingSettings?.enabled === true && ticket.timeTrackingEnabled && isTimeTrackingParticipant;
  if (detail.canViewTimeTrackingSummary) {
    const sessionConditions = [
      eq(ticketTimeSessionsTable.ticketId, id),
      eq(ticketTimeSessionsTable.organizationId, orgId),
    ];
    if (currentUser.role !== "admin") sessionConditions.push(eq(ticketTimeSessionsTable.userId, currentUser.id));
    const sessions = await db.select({
      id: ticketTimeSessionsTable.id,
      userId: ticketTimeSessionsTable.userId,
      userName: usersTable.name,
      startedAt: ticketTimeSessionsTable.startedAt,
      endedAt: ticketTimeSessionsTable.endedAt,
      clientBillable: ticketTimeSessionsTable.clientBillable,
      collaboratorRecognizable: ticketTimeSessionsTable.collaboratorRecognizable,
    })
      .from(ticketTimeSessionsTable)
      .innerJoin(usersTable, eq(ticketTimeSessionsTable.userId, usersTable.id))
      .where(and(...sessionConditions))
      .orderBy(ticketTimeSessionsTable.startedAt);
    const now = Date.now();
    const timeSessions = sessions.map((session) => ({
      ...session,
      durationMinutes: Math.max(0, Math.floor(
        (new Date(session.endedAt ?? now).getTime() - new Date(session.startedAt).getTime()) / 60_000,
      )),
    }));
    const totalMinutes = timeSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    detail.timeSessions = currentUser.role === "admin"
      ? timeSessions
      : timeSessions.map(({ clientBillable: _clientBillable, collaboratorRecognizable: _collaboratorRecognizable, ...session }) => session);
    detail.timeTrackingSummary = {
      totalMinutes,
      activeForCurrentUser: sessions.some((session) => session.userId === currentUser.id && session.endedAt == null),
    };
    if (currentUser.role === "admin") {
      detail.timeTrackingSummary.clientBillableMinutes = timeSessions
        .filter((session) => session.clientBillable)
        .reduce((sum, session) => sum + session.durationMinutes, 0);
      detail.timeTrackingSummary.collaboratorRecognizableMinutes = timeSessions
        .filter((session) => session.collaboratorRecognizable)
        .reduce((sum, session) => sum + session.durationMinutes, 0);
    }
  }
  const responseDetail = redactClientData(redactWorkedHours(detail, canViewWorkedHours), clientsEnabled);
  if (currentUser.role !== "admin") {
    delete (responseDetail as any).suggestedClientId;
    delete (responseDetail as any).suggestedClient;
    delete (responseDetail as any).timeTrackingBillable;
    delete (responseDetail as any).timeTrackingCompensationOverride;
  }
  if (detail.timeTrackingEnabled && !detail.canViewTimeTrackingSummary) {
    delete (responseDetail as any).workedMinutes;
    delete (responseDetail as any).workedBillingStatus;
  }
  res.json(responseDetail);
});

router.post("/tickets/:id/client-suggestion/confirm", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }
  if (!(await isClientFeatureEnabled(orgId))) {
    res.status(403).json({ error: "Client management is disabled for this organization" });
    return;
  }

  const [ticket] = await db.select().from(ticketsTable).where(and(
    eq(ticketsTable.id, id),
    eq(ticketsTable.organizationId, orgId),
    isNull(ticketsTable.deletedAt),
  ));
  if (!ticket || !ticket.suggestedClientId || ticket.clientId || !ticket.resource) {
    res.status(404).json({ error: "Client suggestion not found" });
    return;
  }
  const [client] = await db.select({ id: clientsTable.id }).from(clientsTable).where(and(
    eq(clientsTable.id, ticket.suggestedClientId),
    eq(clientsTable.organizationId, orgId),
  ));
  const domain = domainForSender(ticket.resource);
  if (!client || !domain) {
    res.status(409).json({ error: "Client suggestion is no longer valid" });
    return;
  }

  const confirmed = await db.transaction(async (tx) => {
    const [currentTicket] = await tx.select().from(ticketsTable).where(and(
      eq(ticketsTable.id, id),
      eq(ticketsTable.organizationId, orgId),
      isNull(ticketsTable.deletedAt),
    )).for("update");
    if (
      !currentTicket ||
      currentTicket.suggestedClientId !== client.id ||
      currentTicket.clientId != null ||
      domainForSender(currentTicket.resource ?? "") !== domain
    ) return false;

    const [currentClient] = await tx.select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable).where(and(
        eq(clientsTable.id, client.id),
        eq(clientsTable.organizationId, orgId),
      ));
    if (!currentClient) return false;

    await tx.insert(emailClientDomainRulesTable).values({
      organizationId: orgId,
      domain,
      clientId: currentClient.id,
    }).onConflictDoNothing({
      target: [emailClientDomainRulesTable.organizationId, emailClientDomainRulesTable.domain],
    });
    const [domainRule] = await tx.select({ clientId: emailClientDomainRulesTable.clientId })
      .from(emailClientDomainRulesTable)
      .where(and(
        eq(emailClientDomainRulesTable.organizationId, orgId),
        eq(emailClientDomainRulesTable.domain, domain),
      ))
      .for("update");
    if (!domainRule || domainRule.clientId !== currentClient.id) return false;

    await tx.update(ticketsTable).set({
      clientId: currentClient.id,
      title: prefixTicketTitleWithClient(currentTicket.title, currentClient.name),
      suggestedClientId: null,
      updatedAt: new Date(),
    }).where(and(
      eq(ticketsTable.id, id),
      eq(ticketsTable.organizationId, orgId),
      eq(ticketsTable.suggestedClientId, currentClient.id),
    ));
    await tx.insert(ticketActivityLogsTable).values({
      ticketId: id,
      userId: currentUser.id,
      actionType: "client_associated",
      actionDescription: `Cliente "${currentClient.name}" associato e dominio email confermato: ${domain}`,
    });
    return true;
  });

  if (!confirmed) { res.status(409).json({ error: "Client suggestion is no longer valid" }); return; }
  res.json({ ok: true });
});

router.post("/tickets/:id/client-suggestion/dismiss", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }
  if (!(await isClientFeatureEnabled(orgId))) {
    res.status(403).json({ error: "Client management is disabled for this organization" });
    return;
  }
  const [dismissed] = await db.update(ticketsTable).set({
    suggestedClientId: null,
    updatedAt: new Date(),
  }).where(and(
    eq(ticketsTable.id, id),
    eq(ticketsTable.organizationId, orgId),
    isNull(ticketsTable.deletedAt),
    isNotNull(ticketsTable.suggestedClientId),
  )).returning({ id: ticketsTable.id });
  if (!dismissed) { res.status(404).json({ error: "Email ticket not found" }); return; }
  res.json({ ok: true });
});

// Admin-only visibility switch for tickets created through private email channels.
router.patch("/tickets/:id/visibility", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const clientsEnabled = await isClientFeatureEnabled(orgId);
  const visibility = req.body?.visibility;

  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  if (isNaN(id) || !["organization", "admins"].includes(visibility)) {
    res.status(400).json({ error: "Invalid ticket visibility" });
    return;
  }

  const [existing] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId))
  );
  if (!existing) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (existing.visibility === visibility) {
    res.json(redactClientData(existing, clientsEnabled));
    return;
  }

  const [updated] = await db.update(ticketsTable)
    .set({ visibility, updatedAt: new Date() })
    .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId)))
    .returning();

  await db.insert(ticketActivityLogsTable).values({
    ticketId: id,
    userId: currentUser.id,
    actionType: "visibility_changed",
    actionDescription: visibility === "organization"
      ? `${currentUser.name} ha reso il ticket visibile al team`
      : `${currentUser.name} ha reso il ticket visibile solo agli admin`,
  });

  res.json(redactClientData(updated, clientsEnabled));
});

router.patch("/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  const isAdmin = currentUser.role === "admin";

  if (orgId == null) { res.status(403).json({ error: "Account has no organization" }); return; }
  const clientsEnabled = await isClientFeatureEnabled(orgId);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  // Extract status before zod parse so custom org statuses aren't rejected by legacy enum
  const 
{
 status: rawStatus, ...bodyWithoutStatus 
}
 = req.body ?? 
{
}
;

  const parsed = UpdateTicketBody.safeParse(bodyWithoutStatus)
;

  if (!parsed.success) 
{

    res.status(400).json(
{
 error: "Invalid request", message: parsed.error.message 
}
)
;

    return
;

  
}

  if ("clientId" in parsed.data) 
{

    const [organization] = await db
      .select(
{
 clientsEnabled: organizationsTable.clientsEnabled 
}
)
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1)
;

    if (!organization?.clientsEnabled) 
{

      res.status(403).json(
{
 error: "Client management is disabled for this organization" 
}
)
;

      return
;

    
}

  
}

  if (rawStatus !== undefined) 
{

    (parsed.data as any).status = rawStatus
;

  
}

  if (parsed.data.workedMinutes !== undefined) 
{

    const [organization] = await db
      .select(
{
 workedTimeEnabled: organizationsTable.workedTimeEnabled 
}
)
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId))
      .limit(1)
;

    if (!organization?.workedTimeEnabled) 
{

      res.status(403).json(
{
 error: "Worked-time tracking is disabled for this organization" 
}
)
;

      return
;

    
}

  
}

  if (!isValidWorkedMinutes(parsed.data.workedMinutes)) 
{

    res.status(400).json(
{
 error: "Invalid request", message: "workedMinutes must be a non-negative integer" 
}
)
;

    return
;

  
}


  const [existing] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
       eq(ticketsTable.organizationId, orgId),
       isNull(ticketsTable.deletedAt)
    )
  )
;

  if (!existing) 
{

    res.status(404).json(
{
 error: "Ticket not found" 
}
)
;

    return
;

  
}


  if (!isAdmin && existing.visibility === "admins") 
{

    res.status(404).json(
{
 error: "Ticket not found" 
}
)
;

    return
;

  
}


  const [organizationTimeTracking] = await db.select(
{

    enabled: organizationsTable.timeTrackingModuleEnabled,
  
}
).from(organizationsTable).where(eq(organizationsTable.id, orgId))
;

  const timeTrackingModuleEnabled = organizationTimeTracking?.enabled === true
;

  const hasClassificationUpdate =
    parsed.data.timeTrackingBillable !== undefined ||
    parsed.data.timeTrackingCompensationOverride !== undefined
;

  if (hasClassificationUpdate) 
{

    if (!isAdmin) 
{

      res.status(403).json(
{
 error: "Only admins can configure ticket time classifications" 
}
)
;

      return
;

    
}

    if (!timeTrackingModuleEnabled) 
{

      res.status(403).json(
{
 error: "Time tracking is disabled for this organization" 
}
)
;

      return
;

    
}

  
}

  const effectiveClientBillable =
    parsed.data.timeTrackingBillable ?? existing.timeTrackingBillable
;

  const effectiveCompensationOverride =
    parsed.data.timeTrackingCompensationOverride !== undefined
      ? parsed.data.timeTrackingCompensationOverride
      : existing.timeTrackingCompensationOverride
;

  const shouldTrackStatus =
    timeTrackingModuleEnabled &&
    (existing.timeTrackingEnabled || effectiveClientBillable || effectiveCompensationOverride === true)
;

  const isTimeTrackedTicket = existing.timeTrackingEnabled
;

  const hasTrackedAssignmentPermission = await hasGroupPermission(
    currentUser.id,
    orgId,
    ASSIGN_TIME_TRACKED_TICKETS_PERMISSION,
    isAdmin,
    req,
  )
;


  // Check group permissions for non-admins (must happen before the 403 gate)
  const hasGroupStatusPermission = await hasGroupPermission(currentUser.id, currentUser.organizationId, "change_status", isAdmin, req)
;

  const canViewWorkedHours = await hasGroupPermission(
    currentUser.id,
    orgId,
    VIEW_WORKED_HOURS_PERMISSION,
    isAdmin,
    req,
  )
;


  // The ticket assignee can also change status / resolve, even without a group permission
  const isAssignee = existing.assignedTo === currentUser.id
;

  const isStatusAccessUpdate =
    (parsed.data.status !== undefined || parsed.data.priority !== undefined) &&
    Object.keys(parsed.data).every((key) =>
      key === "status" || key === "priority" || (key === "resolutionNote" && parsed.data.status !== undefined),
    )
;


  // A self-assign attempt: user wants to assign the ticket to themselves (or remove their own assignment).
  // This must bypass the creator-only gate so any authenticated user can self-assign an unassigned ticket.
  // A ticket assigned to a group is NOT eligible for self-assign (only admins can reassign from a group).
  const requestedAssignedTo = parsed.data.assignedTo
;

  const isSelfAssignAttempt =
    !isTimeTrackedTicket &&
    requestedAssignedTo !== undefined &&
    !existing.assignedToGroup &&
    (
      (requestedAssignedTo === currentUser.id && (existing.assignedTo === null || existing.assignedTo === currentUser.id)) ||
      (requestedAssignedTo === null && existing.assignedTo === currentUser.id)
    )
;


  // Do not silently ignore an unauthorized assignment change. In particular,
  // users with status permissions must not be able to unassign or transfer a
  // ticket assigned to a colleague.
  const hasAssignmentRequest =
    parsed.data.assignedTo !== undefined || parsed.data.assignedToGroup !== undefined
;

  if (
    isTimeTrackedTicket &&
    hasAssignmentRequest &&
    !isAdmin &&
    !hasTrackedAssignmentPermission
  ) 
{

    res.status(403).json(
{
 error: "Only admins or users with the tracked-ticket assignment permission can reassign this ticket" 
}
)
;

    return
;

  
}


  if (
    !isAdmin &&
    requestedAssignedTo !== undefined &&
    !isSelfAssignAttempt &&
    !(isTimeTrackedTicket && hasTrackedAssignmentPermission)
  ) 
{

    res.status(403).json(
{
 error: "Forbidden" 
}
)
;

    return
;

  
}


  if (
    isTimeTrackedTicket &&
    parsed.data.status !== undefined &&
    parsed.data.status !== existing.status &&
    !isAdmin &&
    !isAssignee
  ) 
{

    res.status(403).json(
{
 error: "Only admins or the current assignee can change the status of a time-tracked ticket" 
}
)
;

    return
;

  
}


  // Authorization: admins, group-permission users, the assigned person, the creator,
  // and anyone performing a valid self-assign can act on the ticket.
  if (!isAdmin && !hasGroupStatusPermission && !isAssignee && existing.createdBy !== currentUser.id && !isSelfAssignAttempt && !(isTimeTrackedTicket && hasTrackedAssignmentPermission && hasAssignmentRequest))
{

    res.status(403).json(
{
 error: "Forbidden" 
}
)
;

    return
;

  
}


  const updates: typeof parsed.data & 
{
 timeTrackingEnabled?: boolean 
}
 = isAdmin
    ? parsed.data
    : hasGroupStatusPermission
    ? 
{

        ...(parsed.data.title !== undefined && 
{
 title: parsed.data.title 
}
),
        ...(parsed.data.description !== undefined && 
{
 description: parsed.data.description 
}
),
        ...(parsed.data.category !== undefined && 
{
 category: parsed.data.category 
}
),
        ...(parsed.data.location !== undefined && 
{
 location: parsed.data.location 
}
),
        ...(parsed.data.resource !== undefined && 
{
 resource: parsed.data.resource 
}
),
        ...(parsed.data.status !== undefined && 
{
 status: parsed.data.status 
}
),
        ...(parsed.data.priority !== undefined && 
{
 priority: parsed.data.priority 
}
),
        ...(parsed.data.resolutionNote !== undefined && 
{
 resolutionNote: parsed.data.resolutionNote 
}
),
        ...(parsed.data.workedMinutes !== undefined && 
{
 workedMinutes: parsed.data.workedMinutes 
}
),
        // Assignees with group status permission can also manage due date
        ...(isAssignee && parsed.data.dueAt !== undefined && 
{
 dueAt: parsed.data.dueAt 
}
),
      
}

    : isAssignee
    ? 
{

        // Assignees can also change priority; other edits remain limited to their existing permissions.
        ...(parsed.data.status !== undefined && 
{
 status: parsed.data.status 
}
),
        ...(parsed.data.priority !== undefined && 
{
 priority: parsed.data.priority 
}
),
        ...(parsed.data.resolutionNote !== undefined && 
{
 resolutionNote: parsed.data.resolutionNote 
}
),
        ...(parsed.data.workedMinutes !== undefined && 
{
 workedMinutes: parsed.data.workedMinutes 
}
),
        ...(parsed.data.dueAt !== undefined && 
{
 dueAt: parsed.data.dueAt 
}
),
      
}

    : isStatusAccessUpdate
    ? 
{

        ...(parsed.data.status !== undefined && 
{
 status: parsed.data.status 
}
),
        ...(parsed.data.priority !== undefined && 
{
 priority: parsed.data.priority 
}
),
        ...(parsed.data.resolutionNote !== undefined && 
{
 resolutionNote: parsed.data.resolutionNote 
}
),
      
}

    : existing.createdBy === currentUser.id
    ? 
{

        // Ticket creator can edit content fields, as well as status and priority.
        ...(parsed.data.title !== undefined && 
{
 title: parsed.data.title 
}
),
        ...(parsed.data.description !== undefined && 
{
 description: parsed.data.description 
}
),
        ...(parsed.data.category !== undefined && 
{
 category: parsed.data.category 
}
),
        ...(parsed.data.location !== undefined && 
{
 location: parsed.data.location 
}
),
        ...(parsed.data.resource !== undefined && 
{
 resource: parsed.data.resource 
}
),
        ...(parsed.data.status !== undefined && 
{
 status: parsed.data.status 
}
),
        ...(parsed.data.priority !== undefined && 
{
 priority: parsed.data.priority 
}
),
      
}

    : 
{
}
;

    // ^ Self-assign-only path: no fields allowed except assignedTo (patched below)

  // Allow non-admin users to self-assign or remove their own assignment
  if (!isAdmin && parsed.data.assignedTo !== undefined) 
{

    const reqAssignedTo = parsed.data.assignedTo
;

    // Self-assign: ticket must not be assigned to a group, and either unassigned or already self-assigned
    const canSelfAssign =
      !existing.assignedToGroup &&
      reqAssignedTo === currentUser.id &&
      (existing.assignedTo === null || existing.assignedTo === currentUser.id)
;

    // Remove own assignment: only if currently the assignee
    const canRemoveSelf =
      reqAssignedTo === null && existing.assignedTo === currentUser.id
;

    if (canSelfAssign || canRemoveSelf || (isTimeTrackedTicket && hasTrackedAssignmentPermission)) 
{

      (updates as any).assignedTo = reqAssignedTo
;

    
}

  
}

  if (
    !isAdmin &&
    isTimeTrackedTicket &&
    hasTrackedAssignmentPermission &&
    parsed.data.assignedToGroup !== undefined
  ) 
{

    (updates as any).assignedToGroup = parsed.data.assignedToGroup
;

  
}


  const timeTrackedAssignmentChanged =
    isTimeTrackedTicket &&
    (
      ("assignedTo" in updates && updates.assignedTo !== existing.assignedTo) ||
      ("assignedToGroup" in updates && updates.assignedToGroup !== existing.assignedToGroup)
    )
;

  if (
    timeTrackedAssignmentChanged &&
    (existing.status === "in_progress" || updates.status === "in_progress")
  ) 
{

    const orgStatuses = await db
      .select(
{
 key: ticketStatusesTable.key, label: ticketStatusesTable.label, isClosed: ticketStatusesTable.isClosed 
}
)
      .from(ticketStatusesTable)
      .where(eq(ticketStatusesTable.organizationId, orgId))
;

    const waitingStatus = orgStatuses.find(isWaitingStatus)
;

    if (!waitingStatus) 
{

      res.status(400).json(
{
 error: "Tracked ticket reassignment requires an 'In attesa' status in the organization status list" 
}
)
;

      return
;

    
}

    (updates as any).status = waitingStatus.key
;

  
}


  const activityLogs: Array<{ actionType: string; actionDescription: string }> = [];

  let statusChangeLabel: string | undefined;

  let newIsClosed = false;


  if (updates.status && updates.status !== existing.status) 
{

    // Validate status against org's ticket_statuses table
    const fallbackLabels: Record<string, string> = {
      open: "Aperto", in_progress: "In lavorazione", waiting: "In attesa", resolved: "Risolto", closed: "Chiuso"
    };
    let oldLabel = fallbackLabels[existing.status] ?? existing.status;
    let newLabel = fallbackLabels[updates.status] ?? updates.status;
    newIsClosed = updates.status === "closed" || updates.status === "resolved";

    let orgStatuses: { key: string; label: string; isClosed: boolean }[] = [];
    if (orgId != null) {
      orgStatuses = await db
        .select({ key: ticketStatusesTable.key, label: ticketStatusesTable.label, isClosed: ticketStatusesTable.isClosed })
        .from(ticketStatusesTable)
        .where(eq(ticketStatusesTable.organizationId, orgId));
      const statusMap = new Map(orgStatuses.map((s) => [s.key, s]));

      // Validate that the new status exists in org's statuses (if org has custom statuses configured)
      if (statusMap.size > 0 && !statusMap.has(updates.status)) 
{

        res.status(400).json(
{
 error: "Invalid status", message: `Status "${updates.status}" is not valid for this organization` 
}
)
;

        return
;

      
}


      if (shouldTrackStatus) 
{

        const requestedRow = statusMap.get(updates.status)
;

        newIsClosed = requestedRow?.isClosed ?? newIsClosed
;

        const isWorkingStatus = updates.status === "in_progress"
;

        const isWaiting = requestedRow ? isWaitingStatus(requestedRow) : updates.status === "waiting"
;

        const existingStatusIsClosed =
          statusMap.get(existing.status)?.isClosed ??
          (existing.status === "closed" || existing.status === "resolved")
;

        const reopening = existingStatusIsClosed && !newIsClosed
;

        if (!newIsClosed && (reopening || (!isWorkingStatus && !isWaiting))) 
{

          const waitingStatus = orgStatuses.find(isWaitingStatus)
;

          if (waitingStatus) 
{

            (updates as any).status = waitingStatus.key
;

          
}
 else if (updates.status !== "waiting") 
{

            res.status(400).json(
{

              error: "Tracked tickets require an 'In attesa' status in the organization status list",
            
}
)
;

            return
;

          
}

        
}

      
}


      if (statusMap.has(existing.status)) oldLabel = statusMap.get(existing.status)!.label
;

      if (statusMap.has(updates.status as string)) 
{

        const newStatusRow = statusMap.get(updates.status as string)!
;

        newLabel = newStatusRow.label
;

        newIsClosed = newStatusRow.isClosed
;

      
}

    
}


    statusChangeLabel = newLabel
;

    activityLogs.push(
{

      actionType: "status_changed",
      actionDescription: `Stato cambiato da "${oldLabel}" a "${newLabel}"`,
    
}
)
;

    if (newIsClosed) 
{

      (updates as any).closedAt = new Date()
;

    
}
 else if (existing.closedAt) 
{

      (updates as any).closedAt = null
;

    
}

  
}


  if (updates.priority && updates.priority !== existing.priority) 
{

    const priorityLabels: Record<string, string> = 
{
 low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" 
}
;

    activityLogs.push(
{

      actionType: "priority_changed",
      actionDescription: `Priorita cambiata da "${priorityLabels[existing.priority] ?? existing.priority}" a "${priorityLabels[updates.priority] ?? updates.priority}"`,
    
}
)
;

  
}


  if (updates.category && updates.category !== existing.category) 
{

    activityLogs.push(
{
 actionType: "category_changed", actionDescription: `Categoria cambiata in "${updates.category}"` 
}
)
;

  
}


  if (updates.location && updates.location !== existing.location) 
{

    activityLogs.push(
{
 actionType: "location_changed", actionDescription: `Sede cambiata in "${updates.location}"` 
}
)
;

  
}


  if ("assignedTo" in updates && updates.assignedTo !== existing.assignedTo) 
{

    if (updates.assignedTo) 
{

      const [assigneeUser] = await db.select().from(usersTable).where(
        and(eq(usersTable.id, updates.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
      )
;

      if (!assigneeUser) 
{

        res.status(400).json(
{
 error: "Assignee not found in organization" 
}
)
;

        return
;

      
}

      const wasAssigned = existing.assignedTo != null || existing.assignedToGroup != null
;

      const [previousAssignee] = existing.assignedTo
        ? await db.select(
{
 name: usersTable.name 
}
).from(usersTable).where(eq(usersTable.id, existing.assignedTo))
        : []
;

      const previousLabel = previousAssignee?.name
        ?? (existing.assignedToGroup ? `gruppo "${existing.assignedToGroup}"` : null)
;

      activityLogs.push(
{

        actionType: wasAssigned ? "reassigned" : "assigned",
        actionDescription: wasAssigned
          ? `Ticket riassegnato da ${previousLabel} a ${assigneeUser.name}`
          : `Ticket assegnato a ${assigneeUser.name}`,
      
}
)
;

    
}
 else 
{

      activityLogs.push(
{
 actionType: "unassigned", actionDescription: "Assegnazione rimossa" 
}
)
;

    
}

  
}


  if (!("assignedTo" in updates) && "assignedToGroup" in updates && updates.assignedToGroup !== existing.assignedToGroup) 
{

    if (updates.assignedToGroup) 
{

      const previousLabel = existing.assignedTo
        ? (await db.select(
{
 name: usersTable.name 
}
).from(usersTable).where(eq(usersTable.id, existing.assignedTo)))[0]?.name
        : existing.assignedToGroup ? `gruppo "${existing.assignedToGroup}"` : null
;

      const wasAssigned = existing.assignedTo != null || existing.assignedToGroup != null
;

      activityLogs.push(
{

        actionType: wasAssigned ? "reassigned" : "assigned",
        actionDescription: wasAssigned
          ? `Ticket riassegnato da ${previousLabel ?? "assegnazione precedente"} al gruppo "${updates.assignedToGroup}"`
          : `Ticket assegnato al gruppo "${updates.assignedToGroup}"`,
      
}
)
;

    
}
 else 
{

      activityLogs.push(
{
 actionType: "unassigned", actionDescription: "Assegnazione gruppo rimossa" 
}
)
;

    
}

  
}


  if ("clientId" in updates && updates.clientId != null) 
{

    const [clientRow] = await db.select(
{
 id: clientsTable.id 
}
).from(clientsTable).where(
      and(eq(clientsTable.id, updates.clientId as number), orgId != null ? eq(clientsTable.organizationId, orgId) : undefined)
    )
;

    if (!clientRow) 
{

      res.status(400).json(
{
 error: "Client not found in organization" 
}
)
;

      return
;

    
}

  
}


  const effectiveClientId = updates.clientId !== undefined ? updates.clientId : existing.clientId
;

  if (effectiveClientBillable && effectiveClientId == null) 
{

    res.status(400).json(
{
 error: "Client-billable tracked tickets require a client" 
}
)
;

    return
;

  
}

  if (hasClassificationUpdate) 
{

    updates.timeTrackingEnabled =
      existing.timeTrackingEnabled || effectiveClientBillable || effectiveCompensationOverride === true
;

  
}

  const effectiveAssignedTo = updates.assignedTo !== undefined ? updates.assignedTo : existing.assignedTo
;

  if (effectiveCompensationOverride === true && effectiveAssignedTo == null) 
{

    res.status(400).json(
{
 error: "Collaborator-recognizable tracked tickets require an individual assignee" 
}
)
;

    return
;

  
}


  if (shouldTrackStatus && updates.status === "in_progress" && updates.status !== existing.status) 
{

    const assignedForSession = updates.assignedTo !== undefined ? updates.assignedTo : existing.assignedTo
;

    const sessionUserId =
      (isAdmin || hasGroupStatusPermission) &&
      assignedForSession != null &&
      assignedForSession !== currentUser.id
        ? assignedForSession
        : currentUser.id
;

    const [sessionUser] = await db.select(
{
 hourlyCompensated: usersTable.hourlyCompensated 
}
)
      .from(usersTable)
      .where(and(eq(usersTable.id, sessionUserId), eq(usersTable.organizationId, orgId)))
;

    const sessionRecognizable =
      effectiveCompensationOverride ?? sessionUser?.hourlyCompensated ?? false
;

    if (sessionRecognizable && assignedForSession == null) 
{

      res.status(400).json(
{
 error: "Collaborator-recognizable tracked tickets require an individual assignee" 
}
)
;

      return
;

    
}

  
}


  let updated: typeof existing
;

  // When an admin or group manager starts work on someone else's assigned ticket,
  // track the assigned collaborator, not the manager changing the status.
  const effectiveAssignee = updates.assignedTo !== undefined
    ? updates.assignedTo
    : existing.assignedTo;
  const timerUserId =
    (isAdmin || hasGroupStatusPermission) &&
    effectiveAssignee != null &&
    effectiveAssignee !== currentUser.id
      ? effectiveAssignee
      : currentUser.id;
  try {
    updated = await db.transaction(async (tx) => {
      let timerState = existing;
      if (shouldTrackStatus && (updates.status !== undefined || "assignedTo" in updates || hasClassificationUpdate)) {
        const [lockedTicket] = await tx.select().from(ticketsTable)
          .where(and(
            eq(ticketsTable.id, id),
            eq(ticketsTable.organizationId, orgId),
          ))
          .for("update");
        if (lockedTicket) timerState = lockedTicket;
      }

      const timerStatusChanged = updates.status !== undefined && updates.status !== timerState.status;
      const timerAssignmentChanged =
        updates.assignedTo !== undefined && updates.assignedTo !== timerState.assignedTo;
      const trackingJustEnabled = !timerState.timeTrackingEnabled && updates.timeTrackingEnabled === true;
      if (shouldTrackStatus && trackingJustEnabled && timerState.status === "in_progress") {
        const now = new Date();
        const assignedForSession = updates.assignedTo !== undefined
          ? updates.assignedTo
          : timerState.assignedTo;
        const sessionUserId =
          (isAdmin || hasGroupStatusPermission) &&
          assignedForSession != null &&
          assignedForSession !== currentUser.id
            ? assignedForSession
            : currentUser.id;
        const [worker] = await tx.select({ hourlyCompensated: usersTable.hourlyCompensated })
          .from(usersTable)
          .where(and(eq(usersTable.id, sessionUserId), eq(usersTable.organizationId, orgId)));
        await tx.insert(ticketTimeSessionsTable).values({
          organizationId: orgId,
          ticketId: id,
          userId: sessionUserId,
          startedAt: now,
          clientBillable: effectiveClientBillable,
          collaboratorRecognizable:
            effectiveCompensationOverride ?? worker?.hourlyCompensated ?? false,
        });
      } else if (shouldTrackStatus && timerStatusChanged) {
        const now = new Date();
        if (updates.status === "in_progress") {
          const assignedForSession = updates.assignedTo !== undefined
            ? updates.assignedTo
            : timerState.assignedTo;
          const sessionUserId =
            (isAdmin || hasGroupStatusPermission) &&
            assignedForSession != null &&
            assignedForSession !== currentUser.id
              ? assignedForSession
              : currentUser.id;
          const [worker] = await tx.select({ hourlyCompensated: usersTable.hourlyCompensated })
            .from(usersTable)
            .where(and(eq(usersTable.id, sessionUserId), eq(usersTable.organizationId, orgId)));
          await tx.insert(ticketTimeSessionsTable).values({
            organizationId: orgId,
            ticketId: id,
            userId: sessionUserId,
            startedAt: now,
            clientBillable: timerState.timeTrackingBillable,
            collaboratorRecognizable:
              timerState.timeTrackingCompensationOverride ?? worker?.hourlyCompensated ?? false,
          });
        } else {
          await tx.update(ticketTimeSessionsTable)
            .set({ endedAt: now })
            .where(and(
              eq(ticketTimeSessionsTable.organizationId, orgId),
              eq(ticketTimeSessionsTable.ticketId, id),
              isNull(ticketTimeSessionsTable.endedAt),
            ));
        }
      } else if (
        shouldTrackStatus &&
        timerState.status === "in_progress" &&
        timerAssignmentChanged
      ) {
        // End the previous collaborator's session and start a new one for the
        // assignee at the handoff time. Both writes stay atomic with reassignment.
        const now = new Date()
;

        await tx.update(ticketTimeSessionsTable)
          .set(
{
 endedAt: now 
}
)
          .where(and(
            eq(ticketTimeSessionsTable.organizationId, orgId),
            eq(ticketTimeSessionsTable.ticketId, id),
            isNull(ticketTimeSessionsTable.endedAt),
          ))
;

        if (updates.assignedTo != null) 
{

          const handoffUserId = updates.assignedTo
;

          const [worker] = await tx.select(
{
 hourlyCompensated: usersTable.hourlyCompensated 
}
)
            .from(usersTable)
            .where(and(eq(usersTable.id, handoffUserId), eq(usersTable.organizationId, orgId)))
;

          await tx.insert(ticketTimeSessionsTable).values(
{

            organizationId: orgId,
            ticketId: id,
            userId: handoffUserId,
            startedAt: now,
            clientBillable: timerState.timeTrackingBillable,
            collaboratorRecognizable:
              timerState.timeTrackingCompensationOverride ?? worker?.hourlyCompensated ?? false,
          
}
)
;

        
}

      
}

      const hasInboundEmailMetadata = existing.inboundChannelId != null ||
        existing.emailMessageId != null ||
        existing.emailConversationId != null
;

      let updatesToSave = updates
;

      if (clientsEnabled && hasInboundEmailMetadata && "clientId" in updates && updates.clientId != null) 
{

        const [newClient] = await tx.select(
{
 id: clientsTable.id, name: clientsTable.name 
}
).from(clientsTable).where(and(
          eq(clientsTable.id, updates.clientId as number),
          eq(clientsTable.organizationId, orgId),
        ))
;

        if (newClient) 
{

          const [previousClient] = existing.clientId != null && existing.clientId !== newClient.id
            ? await tx.select(
{
 name: clientsTable.name 
}
).from(clientsTable).where(and(
                eq(clientsTable.id, existing.clientId),
                eq(clientsTable.organizationId, orgId),
              ))
            : []
;

          updatesToSave = 
{

            ...updates,
            title: prefixTicketTitleWithClient(
              typeof updates.title === "string" ? updates.title : existing.title,
              newClient.name,
              previousClient?.name,
            ),
          
}
;

        
}

      
}

      const [saved] = await tx
        .update(ticketsTable)
        .set(
{

          ...updatesToSave,
          ...("clientId" in updates ? 
{
 suggestedClientId: null 
}
 : 
{
}
),
          updatedAt: new Date(),
        
}
)
        .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId)))
        .returning()
;

      if (
        saved &&
        updates.assignedTo != null &&
        updates.assignedTo !== existing.assignedTo
      ) {
        const attachmentsToArchive = await tx.select({
          id: ticketAttachmentsTable.id,
          fileName: ticketAttachmentsTable.fileName,
          oneDriveItemId: ticketAttachmentsTable.oneDriveItemId,
        }).from(ticketAttachmentsTable)
          .where(and(
            eq(ticketAttachmentsTable.ticketId, id),
            isNotNull(ticketAttachmentsTable.oneDriveItemId),
          ));

        for (const attachment of attachmentsToArchive) {
          if (!attachment.oneDriveItemId) continue;
          const [trackedCopy] = await tx.select({
            id: ticketAttachmentOneDriveCopiesTable.id,
          }).from(ticketAttachmentOneDriveCopiesTable)
            .where(and(
              eq(ticketAttachmentOneDriveCopiesTable.attachmentId, attachment.id),
              eq(ticketAttachmentOneDriveCopiesTable.itemId, attachment.oneDriveItemId),
              eq(ticketAttachmentOneDriveCopiesTable.isCurrent, true),
            ))
            .limit(1);

          if (trackedCopy) {
            await tx.update(ticketAttachmentOneDriveCopiesTable)
              .set({ isCurrent: false })
              .where(eq(ticketAttachmentOneDriveCopiesTable.id, trackedCopy.id));
            continue;
          }

          // Preserve copies created before account ownership was tracked. The
          // assignee is the owner for assigned tickets; unassigned inbound
          // tickets use the same connected-admin fallback as the sync job.
          let ownerUserId = existing.assignedTo ?? existing.createdBy;
          if (existing.assignedTo == null && existing.inboundChannelId != null) {
            const [inboundOwner] = await tx.select({ id: usersTable.id })
              .from(usersTable)
              .innerJoin(oneDriveConnectionsTable, eq(oneDriveConnectionsTable.userId, usersTable.id))
              .where(and(
                eq(usersTable.organizationId, orgId),
                eq(usersTable.role, "admin"),
                eq(oneDriveConnectionsTable.organizationId, orgId),
              ))
              .orderBy(asc(usersTable.createdAt))
              .limit(1);
            if (inboundOwner) ownerUserId = inboundOwner.id;
          }

          const [owner] = await tx.select({
            name: usersTable.name,
            microsoftEmail: oneDriveConnectionsTable.microsoftEmail,
            tenantId: oneDriveConnectionsTable.tenantId,
          }).from(usersTable)
            .innerJoin(oneDriveConnectionsTable, eq(oneDriveConnectionsTable.userId, usersTable.id))
            .where(and(
              eq(usersTable.id, ownerUserId),
              eq(usersTable.organizationId, orgId),
              eq(oneDriveConnectionsTable.organizationId, orgId),
            ))
            .limit(1);
          if (!owner) continue;

          await tx.insert(ticketAttachmentOneDriveCopiesTable).values({
            attachmentId: attachment.id,
            ownerUserId,
            ownerName: owner.name,
            ownerEmail: owner.microsoftEmail,
            ownerTenantId: owner.tenantId,
            itemId: attachment.oneDriveItemId,
            isCurrent: false,
          }).onConflictDoUpdate({
            target: [
              ticketAttachmentOneDriveCopiesTable.attachmentId,
              ticketAttachmentOneDriveCopiesTable.ownerTenantId,
              ticketAttachmentOneDriveCopiesTable.ownerEmail,
              ticketAttachmentOneDriveCopiesTable.itemId,
            ],
            set: { ownerUserId, ownerName: owner.name, isCurrent: false },
          });
        }

        // Reset the sync marker in the same transaction as reassignment so a
        // failed or interrupted OneDrive upload remains eligible for retry.
        await tx.update(ticketAttachmentsTable)
          .set({ oneDriveItemId: null, oneDriveSyncError: null })
          .where(eq(ticketAttachmentsTable.ticketId, id));
      }

      const [creator] = !hasInboundEmailMetadata && clientsEnabled && "clientId" in updates && updates.clientId != null
        ? await tx.select(
{
 isSystem: usersTable.isSystem 
}
)
            .from(usersTable)
            .where(and(eq(usersTable.id, existing.createdBy), eq(usersTable.organizationId, orgId)))
        : []
;

      if (
        clientsEnabled &&
        (hasInboundEmailMetadata || creator?.isSystem === true) &&
        "clientId" in updates &&
        updates.clientId != null
      ) 
{

        const senderEmail = normalizeSenderEmail(
          typeof updates.resource === "string" ? updates.resource : existing.resource ?? "",
        )
;

        if (senderEmail) 
{

          await tx.insert(emailClientSenderRulesTable).values(
{

            organizationId: orgId,
            senderEmail,
            clientId: updates.clientId,
          
}
).onConflictDoUpdate(
{

            target: [emailClientSenderRulesTable.organizationId, emailClientSenderRulesTable.senderEmail],
            set: 
{
 clientId: updates.clientId 
}
,
          
}
)
;

        
}

      
}

      return saved
;

    
}
)
;

  
}
 catch (error: any) 
{

    const dbError = error?.cause ?? error
;

    if (dbError?.code === "23505" && dbError?.constraint === "ticket_time_sessions_one_active_per_user") 
{

      const [active] = await db.select(
{

        ticketId: ticketTimeSessionsTable.ticketId,
        ticketNumber: ticketsTable.ticketNumber,
        title: ticketsTable.title,
      
}
)
        .from(ticketTimeSessionsTable)
        .innerJoin(ticketsTable, eq(ticketTimeSessionsTable.ticketId, ticketsTable.id))
        .where(and(
          eq(ticketTimeSessionsTable.userId, timerUserId),
          eq(ticketTimeSessionsTable.organizationId, orgId),
          isNull(ticketTimeSessionsTable.endedAt),
        ))
;

      res.status(409).json(
{

        error: "TIMER_ALREADY_ACTIVE",
        message: active
          ? `You already have an active timer on ticket #${active.ticketNumber ?? active.ticketId}: ${active.title}.`
          : "You already have an active timer on another ticket.",
        activeTicket: active ? 
{
 id: active.ticketId, ticketNumber: active.ticketNumber, title: active.title 
}
 : null,
      
}
)
;

      return
;

    
}

    throw error
;

  
}


  if (updated.assignedTo != null && updated.assignedTo !== existing.assignedTo) {
    void syncTicketOneDriveAttachments(id).catch((error) => {
      req.log.warn({ err: error, ticketId: id }, "Could not sync reassigned ticket attachments to OneDrive");
    });
  }

  for (const log of activityLogs) 
{

    await db.insert(ticketActivityLogsTable).values(
{

      ticketId: id,
      userId: currentUser.id,
      actionType: log.actionType,
      actionDescription: log.actionDescription,
    
}
)
;

  
}


  const displayNum = existing.ticketNumber ?? existing.id
;


  if (activityLogs.some((l) => l.actionType === "status_changed")) 
{

    const notifLabel = statusChangeLabel ?? updates.status!
;

    await createNotificationsForSubscribers(id, `${currentUser.name} ha cambiato lo stato del ticket #${displayNum} in "${notifLabel}": "${existing.title}"`, currentUser.id, "ticket_status_changed", orgId)
;


    // Check org preference before sending closure email
    let orgSendClosureEmail = false
;

    if (orgId != null) 
{

      const [orgPref] = await db.select(
{
 sendClosureEmail: organizationsTable.sendClosureEmail 
}
).from(organizationsTable).where(eq(organizationsTable.id, orgId))
;

      orgSendClosureEmail = orgPref?.sendClosureEmail ?? false
;

    
}


    if (orgSendClosureEmail && newIsClosed && existing.resource && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existing.resource)) 
{

      const customerEmail = existing.resource
;

      const ticketNum = existing.ticketNumber ?? existing.id
;

      void (async () => 
{

        try 
{

          let replyTo: string | undefined
;

          if (orgId != null) 
{

            const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.taskdesk.it"
;

            if (existing.inboundChannelId) 
{

              const [ch] = await db.select(
{
 token: inboundEmailChannelsTable.token 
}
)
                .from(inboundEmailChannelsTable)
                .where(and(
                  eq(inboundEmailChannelsTable.id, existing.inboundChannelId),
                  eq(inboundEmailChannelsTable.organizationId, orgId)
                ))
;

              if (ch?.token) replyTo = `tickets-${ch.token}@${inboundDomain}`
;

            
}

            if (!replyTo) 
{

              const [ch] = await db.select(
{
 token: inboundEmailChannelsTable.token 
}
)
                .from(inboundEmailChannelsTable)
                .where(and(
                  eq(inboundEmailChannelsTable.organizationId, orgId),
                  eq(inboundEmailChannelsTable.enabled, true)
                ))
                .limit(1)
;

              if (ch?.token) replyTo = `tickets-${ch.token}@${inboundDomain}`
;

            
}

          
}

          const baseUrl = appBaseUrl()
;

          const resolutionNote = updates.resolutionNote ?? existing.resolutionNote ?? undefined
;

          const 
{
 subject: closureSubject, html, text 
}
 = buildTicketClosureEmail(
{

            toName: customerEmail,
            ticketNumber: ticketNum,
            ticketTitle: existing.title,
            resolutionNote: resolutionNote || undefined,
            appBaseUrl: baseUrl,
          
}
)
;

          const result = await sendEmailForOrg(orgId, 
{
 to: customerEmail, subject: closureSubject, html, text, replyTo 
}
)
;

          if (!result.ok) 
{

            req.log.warn(
{
 ticketId: id, to: customerEmail, err: result.error 
}
, "Failed to send ticket closure email")
;

          
}
 else 
{

            req.log.info(
{
 ticketId: id, to: customerEmail 
}
, "Ticket closure email sent")
;

          
}

        
}
 catch (err: unknown) 
{

          const msg = err instanceof Error ? err.message : String(err)
;

          req.log.warn(
{
 ticketId: id, err: msg 
}
, "Error sending ticket closure email")
;

        
}

      
}
)()
;

    
}

  
}

  if (activityLogs.some((l) => l.actionType === "priority_changed")) 
{

    const priorityLabels: Record<string, string> = 
{
 low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" 
}
;

    const priorityLabel = priorityLabels[updates.priority!] ?? updates.priority!
;

    await createNotificationsForSubscribers(id, `${currentUser.name} ha cambiato la priorità del ticket #${displayNum} in "${priorityLabel}": "${existing.title}"`, currentUser.id, "ticket_priority_changed", orgId)
;

  
}

  if (activityLogs.some((l) => l.actionType === "assigned" || l.actionType === "reassigned") && updates.assignedTo && updates.assignedTo !== currentUser.id) 
{

    await createNotificationForUser(updates.assignedTo, id, `${currentUser.name} ti ha assegnato il ticket #${displayNum}: "${existing.title}"`, "ticket_assigned", orgId)
;

  
}

  if (activityLogs.some((l) => l.actionType === "assigned" || l.actionType === "reassigned") && updates.assignedTo && orgId != null) 
{

    await subscribeUserToTicket(updates.assignedTo, id, orgId)
;

  
}

  if (activityLogs.some((l) => l.actionType === "assigned" || l.actionType === "reassigned") && updates.assignedToGroup && updates.assignedToGroup !== existing.assignedToGroup) 
{

    const groupName = updates.assignedToGroup
;

    const [grp] = await db
      .select(
{
 id: groupsTable.id 
}
)
      .from(groupsTable)
      .where(and(eq(groupsTable.name, groupName), orgId != null ? eq(groupsTable.organizationId, orgId) : undefined))
;

    if (grp) 
{

      const members = await db
        .select(
{
 userId: groupMembersTable.userId 
}
)
        .from(groupMembersTable)
        .where(eq(groupMembersTable.groupId, grp.id))
;

      const memberIds = members.map((m) => m.userId).filter((uid) => uid !== currentUser.id)
;

      if (memberIds.length > 0) 
{

        const activeMembers = await db
          .select(
{
 id: usersTable.id 
}
)
          .from(usersTable)
          .where(and(inArray(usersTable.id, memberIds), eq(usersTable.isActive, true)))
;

        for (const member of activeMembers) 
{

          await createNotificationForUser(member.id, id, `${currentUser.name} ha assegnato il ticket #${displayNum} al tuo gruppo "${groupName}": "${existing.title}"`, "ticket_assigned", orgId)
;

          if (orgId != null) await subscribeUserToTicket(member.id, id, orgId)
;

        
}

      
}

    
}

  
}


  const [creator] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, updated.createdBy), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
  )
;

  let assignee = null
;

  if (updated.assignedTo) 
{

    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, updated.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    )
;

    assignee = a ?? null
;

  
}


  let updatedClient = null
;

  if (clientsEnabled && updated.clientId) 
{

    const [c] = await db.select(
{
 id: clientsTable.id, name: clientsTable.name, alias: clientsTable.alias 
}
)
      .from(clientsTable)
      .where(eq(clientsTable.id, updated.clientId))
;

    updatedClient = c ?? null
;

  
}


  const [
{
 count: cc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id))
;

  const [
{
 count: nc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id))
;


  const updateResponse = redactClientData(redactWorkedHours(
    buildTicketWithDetails(updated, creator, assignee, Number(cc), Number(nc), null, updatedClient),
    canViewWorkedHours,
  ), clientsEnabled)
;

  if (currentUser.role !== "admin") 
{

    delete (updateResponse as any).suggestedClientId
;

    delete (updateResponse as any).suggestedClient
;

  
}

  res.json(updateResponse)
;

}
)
;


router.post("/tickets/:id/clone", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
;

  const id = parseInt(raw, 10)
;

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}


  if (isNaN(id)) 
{

    res.status(400).json(
{
 error: "Invalid ticket ID" 
}
)
;

    return
;

  
}


  const 
{
 scheduledAt 
}
 = (req.body ?? 
{
}
) as 
{
 scheduledAt?: string | null 
}
;


  const [existing] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId))
  )
;

  if (!existing) 
{

    res.status(404).json(
{
 error: "Ticket not found" 
}
)
;

    return
;

  
}


  const [orgMax] = await db
    .select(
{
 maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` 
}
)
    .from(ticketsTable)
    .where(orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`)
;

  const nextTicketNumber = (Number(orgMax.maxNum) || 0) + 1
;


  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null
;


  const [newTicket] = await db.insert(ticketsTable).values(
{

    organizationId: existing.organizationId,
    ticketNumber: nextTicketNumber,
    title: existing.title,
    description: existing.description,
    category: existing.category,
    location: existing.location,
    resource: existing.resource,
    priority: existing.priority,
    status: "open",
    visibility: existing.visibility,
    createdBy: currentUser.id,
    assignedTo: existing.assignedTo,
    assignedToGroup: existing.assignedToGroup,
    clientId: clientsEnabled ? existing.clientId : null,
    scheduledAt: scheduledDate,
    createdAt: scheduledDate ?? new Date(),
  
}
).returning()
;


  await db.insert(ticketActivityLogsTable).values(
{

    ticketId: newTicket.id,
    userId: currentUser.id,
    actionType: "cloned_from",
    actionDescription: `Pratica clonata dalla pratica #${existing.ticketNumber ?? existing.id}`,
  
}
)
;


  const checklists = await db
    .select()
    .from(ticketChecklistsTable)
    .where(eq(ticketChecklistsTable.ticketId, existing.id))
;


  for (const cl of checklists) 
{

    const [newCl] = await db
      .insert(ticketChecklistsTable)
      .values(
{
 ticketId: newTicket.id, orgId: cl.orgId, title: cl.title, position: cl.position 
}
)
      .returning()
;


    const items = await db
      .select()
      .from(ticketChecklistItemsTable)
      .where(eq(ticketChecklistItemsTable.checklistId, cl.id))
;


    if (items.length > 0) 
{

      await db.insert(ticketChecklistItemsTable).values(
        items.map((item) => (
{

          checklistId: newCl.id,
          orgId: item.orgId,
          text: item.text,
          checked: false,
          position: item.position,
        
}
))
      )
;

    
}

  
}


  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id))
;

  let assigneeUser = null
;

  if (newTicket.assignedTo) 
{

    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, newTicket.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    )
;

    assigneeUser = a ?? null
;

  
}

  let ticketClient = null
;

  if (clientsEnabled && newTicket.clientId) 
{

    const [c] = await db.select(
{
 id: clientsTable.id, name: clientsTable.name, alias: clientsTable.alias 
}
)
      .from(clientsTable).where(eq(clientsTable.id, newTicket.clientId))
;

    ticketClient = c ?? null
;

  
}


  res.status(201).json(redactClientData(buildTicketWithDetails(newTicket, creator, assigneeUser, 0, 0, null, ticketClient), clientsEnabled))
;

}
)
;


router.patch("/tickets/:id/recurrence", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
;

  const id = parseInt(raw, 10)
;

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;


  if (isNaN(id)) 
{

    res.status(400).json(
{
 error: "Invalid ticket ID" 
}
)
;

    return
;

  
}


  const 
{
 frequency, interval: rawInterval, dayOfMonth: rawDayOfMonth, dayOfWeek: rawDayOfWeek, endDate 
}
 = (req.body ?? 
{
}
) as 
{

    frequency?: string
;

    interval?: number
;

    dayOfMonth?: number | null
;

    dayOfWeek?: number | null
;

    endDate?: string | null
;

  
}
;

  if (!frequency || !["daily", "weekly", "monthly", "yearly"].includes(frequency)) 
{

    res.status(400).json(
{
 error: "Invalid or missing frequency" 
}
)
;

    return
;

  
}

  const interval = Math.max(1, Math.round(Number(rawInterval) || 1))
;

  const dayOfMonth = rawDayOfMonth == null ? null : Math.round(Number(rawDayOfMonth))
;

  const dayOfWeek = rawDayOfWeek == null ? null : Math.round(Number(rawDayOfWeek))
;

  if (frequency === "monthly" && dayOfMonth != null && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) 
{

    res.status(400).json(
{
 error: "Invalid day of month" 
}
)
;

    return
;

  
}

  if (frequency === "weekly" && dayOfWeek != null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) 
{

    res.status(400).json(
{
 error: "Invalid day of week" 
}
)
;

    return
;

  
}


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}


  const [existing] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId))
  )
;

  if (!existing) 
{

    res.status(404).json(
{
 error: "Ticket not found" 
}
)
;

    return
;

  
}


  const rule = 
{

    frequency,
    interval,
    ...(frequency === "monthly" && dayOfMonth != null ? 
{
 dayOfMonth 
}
 : 
{
}
),
    ...(frequency === "weekly" && dayOfWeek != null ? 
{
 dayOfWeek 
}
 : 
{
}
),
    ...(endDate ? 
{
 endDate 
}
 : 
{
}
),
  
}
;

  const now = new Date()
;

  const nextAt = computeNextRecurrence(
    now,
    frequency as "daily" | "weekly" | "monthly" | "yearly",
    interval,
    dayOfMonth,
    dayOfWeek,
  )
;


  const [updated] = await db.update(ticketsTable)
    .set(
{
 recurrenceRule: rule, recurrenceNextAt: nextAt, updatedAt: new Date() 
}
)
    .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId)))
    .returning()
;


  await db.insert(ticketActivityLogsTable).values(
{

    ticketId: id,
    userId: currentUser.id,
    actionType: "recurrence_set",
    actionDescription: `Ricorrenza impostata: ${frequency}`,
  
}
)
;


  const [orgMax] = await db
    .select(
{
 maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` 
}
)
    .from(ticketsTable)
    .where(orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`)
;

  const nextTicketNumber = (Number(orgMax.maxNum) || 0) + 1
;


  const [firstChild] = await db.insert(ticketsTable).values(
{

    organizationId: existing.organizationId,
    ticketNumber: nextTicketNumber,
    title: existing.title,
    description: existing.description,
    category: existing.category,
    location: existing.location,
    resource: existing.resource,
    priority: existing.priority,
    status: "open",
    visibility: existing.visibility,
    createdBy: existing.createdBy,
    assignedTo: existing.assignedTo,
    assignedToGroup: existing.assignedToGroup,
    clientId: existing.clientId,
    timeTrackingEnabled: existing.timeTrackingEnabled,
    timeTrackingBillable: existing.timeTrackingBillable,
    timeTrackingCompensationOverride: existing.timeTrackingCompensationOverride,
    recurrenceParentId: existing.id,
  
}
).returning()
;


  await db.insert(ticketActivityLogsTable).values(
{

    ticketId: firstChild.id,
    userId: existing.createdBy,
    actionType: "recurrence_created",
    actionDescription: `Pratica creata da ricorrenza della pratica #${existing.ticketNumber ?? existing.id}`,
  
}
)
;


  const checklists = await db.select().from(ticketChecklistsTable).where(eq(ticketChecklistsTable.ticketId, existing.id))
;

  for (const cl of checklists) 
{

    const [newCl] = await db.insert(ticketChecklistsTable).values(
{

      ticketId: firstChild.id,
      orgId: cl.orgId,
      title: cl.title,
      position: cl.position,
    
}
).returning()
;

    const items = await db.select().from(ticketChecklistItemsTable).where(eq(ticketChecklistItemsTable.checklistId, cl.id))
;

    if (items.length > 0) 
{

      await db.insert(ticketChecklistItemsTable).values(
        items.map((item) => (
{

          checklistId: newCl.id,
          orgId: item.orgId,
          text: item.text,
          checked: false,
          position: item.position,
        
}
))
      )
;

    
}

  
}


  if (existing.assignedTo) 
{

    await createNotificationForUser(
      existing.assignedTo,
      firstChild.id,
      `Nuova pratica ricorrente #${firstChild.ticketNumber ?? firstChild.id}: "${firstChild.title}"`,
      "ticket_assigned",
      existing.organizationId
    )
;

  
}


  const [creator] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, updated.createdBy), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
  )
;

  let assignee = null
;

  if (updated.assignedTo) 
{

    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, updated.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    )
;

    assignee = a ?? null
;

  
}

  const [
{
 count: cc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id))
;

  const [
{
 count: nc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id))
;


  res.json(redactClientData(buildTicketWithDetails(updated, creator, assignee, Number(cc), Number(nc), null, null), clientsEnabled))
;

}
)
;


router.delete("/tickets/:id/recurrence", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
;

  const id = parseInt(raw, 10)
;

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;


  if (isNaN(id)) 
{

    res.status(400).json(
{
 error: "Invalid ticket ID" 
}
)
;

    return
;

  
}


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}


  const [existing] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId))
  )
;

  if (!existing) 
{

    res.status(404).json(
{
 error: "Ticket not found" 
}
)
;

    return
;

  
}


  const [updated] = await db.update(ticketsTable)
    .set(
{
 recurrenceRule: null, recurrenceNextAt: null, updatedAt: new Date() 
}
)
    .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId)))
    .returning()
;


  await db.insert(ticketActivityLogsTable).values(
{

    ticketId: id,
    userId: currentUser.id,
    actionType: "recurrence_removed",
    actionDescription: "Ricorrenza rimossa",
  
}
)
;


  const [creator] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, updated.createdBy), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
  )
;

  let assignee = null
;

  if (updated.assignedTo) 
{

    const [a] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, updated.assignedTo), orgId != null ? eq(usersTable.organizationId, orgId) : undefined)
    )
;

    assignee = a ?? null
;

  
}

  const [
{
 count: cc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id))
;

  const [
{
 count: nc 
}
] = await db.select(
{
 count: sql<number>`count(*)` 
}
).from(ticketInternalNotesTable).where(eq(ticketInternalNotesTable.ticketId, id))
;


  res.json(redactClientData(buildTicketWithDetails(updated, creator, assignee, Number(cc), Number(nc), null, null), clientsEnabled))
;

}
)
;


router.post("/tickets/:id/restore", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  const clientsEnabled = await isClientFeatureEnabled(orgId)
;

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10)
;


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}

  if (isNaN(id)) 
{
 res.status(400).json(
{
 error: "Invalid ticket ID" 
}
)
;
 return
;
 
}


  const [existing] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.deletedAt))
  )
;

  if (!existing) 
{
 res.status(404).json(
{
 error: "Ticket not found in trash" 
}
)
;
 return
;
 
}


  const [restored] = await db.update(ticketsTable)
    .set(
{
 deletedAt: null, updatedAt: new Date() 
}
)
    .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId)))
    .returning()
;


  await db.insert(ticketActivityLogsTable).values(
{

    ticketId: id,
    userId: currentUser.id,
    actionType: "ticket_restored",
    actionDescription: `${currentUser.name} ha ripristinato il ticket dal cestino`,
  
}
)
;


  res.json(redactClientData(restored, clientsEnabled))
;

}
)
;


router.delete("/tickets/:id/permanent", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10)
;


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}

  if (isNaN(id)) 
{
 res.status(400).json(
{
 error: "Invalid ticket ID" 
}
)
;
 return
;
 
}


  const [existing] = await db.select(
{
 id: ticketsTable.id 
}
).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId), isNotNull(ticketsTable.deletedAt))
  )
;

  if (!existing) 
{
 res.status(404).json(
{
 error: "Ticket not found in trash" 
}
)
;
 return
;
 
}


  await permanentlyDeleteTicket(id)
;

  res.status(204).send()
;

}
)
;


router.delete("/tickets/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => 
{

  const currentUser = (req as any).currentUser
;

  const orgId = currentUser.organizationId
;


  if (orgId == null) 
{
 res.status(403).json(
{
 error: "Account has no organization" 
}
)
;
 return
;
 
}


  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10)
;

  const [existing] = await db.select().from(ticketsTable).where(
    and(
      eq(ticketsTable.id, id),
       eq(ticketsTable.organizationId, orgId),
       isNull(ticketsTable.deletedAt)
    )
  )
;

  if (!existing) 
{

    res.status(404).json(
{
 error: "Ticket non trovato" 
}
)
;

    return
;

  
}


   await db.delete(notificationsTable).where(eq(notificationsTable.ticketId, id))
;

   const [deleted] = await db.update(ticketsTable)
     .set(
{
 deletedAt: new Date(), updatedAt: new Date() 
}
)
     .where(and(eq(ticketsTable.id, id), eq(ticketsTable.organizationId, orgId), isNull(ticketsTable.deletedAt)))
     .returning(
{
 id: ticketsTable.id, deletedAt: ticketsTable.deletedAt 
}
)
;


   if (!deleted) 
{

     res.status(404).json(
{
 error: "Ticket non trovato" 
}
)
;

     return
;

   
}


   await db.insert(ticketActivityLogsTable).values(
{

     ticketId: id,
     userId: currentUser.id,
     actionType: "ticket_deleted",
     actionDescription: `${currentUser.name} ha spostato il ticket nel cestino`,
   
}
)
;


   req.log.info(
{
 ticketId: id 
}
, "Ticket spostato nel cestino")
;

   res.status(200).json(deleted)
;

}
)
;


export default router
;
