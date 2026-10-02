import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  db,
  ticketCommentsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import type OpenAI from "openai";

type ToolArgs = Record<string, unknown>;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 25;

const SEARCH_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "what", "when", "where",
  "which", "who", "about", "tell", "show", "find", "list", "ticket", "tickets",
  "comment", "comments", "commento", "commenti", "pratica", "pratiche",
  "quale", "quali", "quando", "dove", "cosa", "come", "mostra", "cerca",
  "elenca", "tutti", "tutte", "della", "delle", "degli", "dello", "alla",
  "alle", "con", "per", "del", "dei", "dal", "nel", "sul", "sono", "stato",
  "stata", "stati", "state", "aperto", "aperta", "aperti", "aperte",
  "chiuso", "chiusa", "chiusi", "chiuse", "risolto", "risolta",
]);

function readString(args: ToolArgs, key: string, maxLength = 180): string | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Invalid ${key}`);
  return value.trim().slice(0, maxLength) || undefined;
}

function readInteger(args: ToolArgs, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${key}`);
  return parsed;
}

function readDate(args: ToolArgs, key: string): Date | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Invalid ${key}`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${key}`);
  return parsed;
}

function readLimit(args: ToolArgs): number {
  const value = args.limit;
  if (value === undefined || value === null) return DEFAULT_LIMIT;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("Invalid limit");
  return Math.min(parsed, MAX_LIMIT);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function searchPatterns(query: string | undefined): string[] {
  if (!query) return [];
  const normalized = query.trim();
  const words = normalized
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !SEARCH_STOP_WORDS.has(word))
    .slice(0, 6);
  const unique = [...new Set([normalized, ...words])].slice(0, 7);
  return unique.map((term) => `%${escapeLike(term)}%`);
}

function addCommonTicketFilters(
  conditions: SQL[],
  args: ToolArgs,
  organizationId: number,
  isAdmin: boolean,
): void {
  conditions.push(
    eq(ticketsTable.organizationId, organizationId),
    isNull(ticketsTable.deletedAt),
  );
  if (!isAdmin) conditions.push(eq(ticketsTable.visibility, "organization"));

  const status = readString(args, "status", 80);
  const priority = readString(args, "priority", 40);
  const category = readString(args, "category", 120);
  const location = readString(args, "location", 120);
  const assignedTo = readString(args, "assignee", 120);
  const ticketNumber = readInteger(args, "ticketNumber");
  const createdAfter = readDate(args, "createdAfter");
  const createdBefore = readDate(args, "createdBefore");

  if (status) conditions.push(ilike(ticketsTable.status, status));
  if (priority) conditions.push(ilike(ticketsTable.priority, priority));
  if (category) conditions.push(ilike(ticketsTable.category, category));
  if (location) conditions.push(ilike(ticketsTable.location, location));
  if (assignedTo) conditions.push(ilike(usersTable.name, `%${escapeLike(assignedTo)}%`));
  if (ticketNumber) conditions.push(eq(ticketsTable.ticketNumber, ticketNumber));
  if (createdAfter) conditions.push(gte(ticketsTable.createdAt, createdAfter));
  if (createdBefore) conditions.push(lte(ticketsTable.createdAt, createdBefore));
}

function addTicketTextSearch(conditions: SQL[], query: string | undefined): void {
  const patterns = searchPatterns(query);
  if (patterns.length === 0) return;

  const matches = patterns.flatMap((pattern) => [
    ilike(ticketsTable.title, pattern),
    ilike(ticketsTable.description, pattern),
    ilike(ticketsTable.resolutionNote, pattern),
    sql`EXISTS (
      SELECT 1
      FROM ticket_comments tc
      WHERE tc.ticket_id = ${ticketsTable.id}
        AND tc.comment_text ILIKE ${pattern}
    )`,
  ]);
  conditions.push(or(...matches)!);
}

function addCommentFilters(
  conditions: SQL[],
  args: ToolArgs,
  organizationId: number,
  isAdmin: boolean,
): void {
  conditions.push(
    eq(ticketsTable.organizationId, organizationId),
    isNull(ticketsTable.deletedAt),
  );
  if (!isAdmin) conditions.push(eq(ticketsTable.visibility, "organization"));

  const ticketId = readInteger(args, "ticketId");
  const ticketNumber = readInteger(args, "ticketNumber");
  const author = readString(args, "author", 120);
  const after = readDate(args, "createdAfter");
  const before = readDate(args, "createdBefore");
  const isSolution = args.isSolution;

  if (ticketId) conditions.push(eq(ticketsTable.id, ticketId));
  if (ticketNumber) conditions.push(eq(ticketsTable.ticketNumber, ticketNumber));
  if (author) conditions.push(ilike(usersTable.name, `%${escapeLike(author)}%`));
  if (after) conditions.push(gte(ticketCommentsTable.createdAt, after));
  if (before) conditions.push(lte(ticketCommentsTable.createdAt, before));
  if (typeof isSolution === "boolean") {
    conditions.push(eq(ticketCommentsTable.isSolution, isSolution));
  } else if (isSolution !== undefined && isSolution !== null) {
    throw new Error("Invalid isSolution");
  }
}

function addCommentTextSearch(conditions: SQL[], query: string | undefined): void {
  const patterns = searchPatterns(query);
  if (patterns.length === 0) return;
  conditions.push(or(...patterns.map((pattern) => ilike(ticketCommentsTable.commentText, pattern)))!);
}

function ticketToolsVisibilityDescription(): string {
  return "The server automatically limits results to the signed-in user's organization, hides deleted tickets, and hides admin-only tickets from non-admins. Never request or infer hidden records.";
}

export const botTicketTools = [
  {
    type: "function",
    function: {
      name: "search_tickets",
      description: `Search visible tickets by text, status, assignee, dates, location, category, priority, or ticket number. Text search checks titles, descriptions, resolution notes, and comments. ${ticketToolsVisibilityDescription()}`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "A short phrase or a few distinctive words. Omit to list tickets matching other filters." },
          ticketNumber: { type: "integer", description: "The public ticket number, not the internal database ID." },
          status: { type: "string" },
          priority: { type: "string" },
          category: { type: "string" },
          location: { type: "string" },
          assignee: { type: "string", description: "Part or all of the assigned user's name." },
          createdAfter: { type: "string", description: "Inclusive ISO-8601 creation date/time." },
          createdBefore: { type: "string", description: "Inclusive ISO-8601 creation date/time." },
          limit: { type: "integer", description: "Maximum results (1–25)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticket",
      description: `Read one visible ticket and its latest comments, with authors and dates. Pass either the public ticket number or the internal ticket ID. ${ticketToolsVisibilityDescription()}`,
      parameters: {
        type: "object",
        properties: {
          ticketId: { type: "integer", description: "Internal database ID; use this as the URL path ID." },
          ticketNumber: { type: "integer", description: "Public ticket number shown to users." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_comments",
      description: `Search visible ticket comments by text, ticket, author, date range, or solution marker. Results include the parent ticket and comment author. ${ticketToolsVisibilityDescription()}`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "A short phrase or a few distinctive words in the comment." },
          ticketId: { type: "integer", description: "Internal ID of the parent ticket." },
          ticketNumber: { type: "integer", description: "Public number of the parent ticket." },
          author: { type: "string", description: "Part or all of the comment author's name." },
          createdAfter: { type: "string", description: "Inclusive ISO-8601 comment date/time." },
          createdBefore: { type: "string", description: "Inclusive ISO-8601 comment date/time." },
          isSolution: { type: "boolean", description: "Filter to comments marked as a solution." },
          limit: { type: "integer", description: "Maximum results (1–25)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_tickets",
      description: `Count all visible tickets matching the supplied filters. Useful for exact totals; does not cap the count at a search result limit. ${ticketToolsVisibilityDescription()}`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional phrase or distinctive words in ticket text or comments." },
          ticketNumber: { type: "integer" },
          status: { type: "string" },
          priority: { type: "string" },
          category: { type: "string" },
          location: { type: "string" },
          assignee: { type: "string" },
          createdAfter: { type: "string", description: "Inclusive ISO-8601 creation date/time." },
          createdBefore: { type: "string", description: "Inclusive ISO-8601 creation date/time." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_comments",
      description: `Count visible ticket comments matching the supplied filters. Useful for exact totals by ticket, author, date range, or solution marker. ${ticketToolsVisibilityDescription()}`,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional phrase or distinctive words in comment text." },
          ticketId: { type: "integer", description: "Internal ID of the parent ticket." },
          ticketNumber: { type: "integer", description: "Public number of the parent ticket." },
          author: { type: "string" },
          createdAfter: { type: "string", description: "Inclusive ISO-8601 comment date/time." },
          createdBefore: { type: "string", description: "Inclusive ISO-8601 comment date/time." },
          isSolution: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
] satisfies OpenAI.Chat.Completions.ChatCompletionTool[];

export async function executeBotTicketTool(
  name: string,
  rawArgs: unknown,
  organizationId: number | null,
  isAdmin: boolean,
): Promise<unknown> {
  if (organizationId == null) return { error: "No organization is associated with this account." };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return { error: "Invalid search parameters." };
  }
  const args = rawArgs as ToolArgs;

  switch (name) {
    case "search_tickets": {
      const conditions: SQL[] = [];
      addCommonTicketFilters(conditions, args, organizationId, isAdmin);
      addTicketTextSearch(conditions, readString(args, "query"));
      const limit = readLimit(args);
      const where = and(...conditions);
      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
        .where(where);
      const rows = await db
        .select({
          ticketId: ticketsTable.id,
          ticketNumber: ticketsTable.ticketNumber,
          title: ticketsTable.title,
          description: ticketsTable.description,
          status: ticketsTable.status,
          priority: ticketsTable.priority,
          category: ticketsTable.category,
          location: ticketsTable.location,
          resolutionNote: ticketsTable.resolutionNote,
          createdAt: ticketsTable.createdAt,
          updatedAt: ticketsTable.updatedAt,
          closedAt: ticketsTable.closedAt,
          assignee: usersTable.name,
          commentCount: sql<number>`(
            SELECT count(*)::int FROM ticket_comments tc
            WHERE tc.ticket_id = ${ticketsTable.id}
          )`,
        })
        .from(ticketsTable)
        .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
        .where(where)
        .orderBy(desc(ticketsTable.updatedAt))
        .limit(limit);
      return {
        totalMatches: Number(countRow?.total ?? 0),
        returned: rows.length,
        truncated: Number(countRow?.total ?? 0) > rows.length,
        tickets: rows.map((ticket) => ({
          ...ticket,
          description: ticket.description.slice(0, 900),
          resolutionNote: ticket.resolutionNote?.slice(0, 600) ?? null,
        })),
      };
    }

    case "get_ticket": {
      const ticketId = readInteger(args, "ticketId");
      const ticketNumber = readInteger(args, "ticketNumber");
      if (!ticketId && !ticketNumber) return { error: "Provide a ticket ID or public ticket number." };

      const conditions: SQL[] = [
        eq(ticketsTable.organizationId, organizationId),
        isNull(ticketsTable.deletedAt),
      ];
      if (!isAdmin) conditions.push(eq(ticketsTable.visibility, "organization"));
      conditions.push(ticketId
        ? eq(ticketsTable.id, ticketId)
        : eq(ticketsTable.ticketNumber, ticketNumber!));

      const [ticket] = await db
        .select({
          ticketId: ticketsTable.id,
          ticketNumber: ticketsTable.ticketNumber,
          title: ticketsTable.title,
          description: ticketsTable.description,
          status: ticketsTable.status,
          priority: ticketsTable.priority,
          category: ticketsTable.category,
          location: ticketsTable.location,
          resolutionNote: ticketsTable.resolutionNote,
          createdAt: ticketsTable.createdAt,
          updatedAt: ticketsTable.updatedAt,
          closedAt: ticketsTable.closedAt,
          creatorId: ticketsTable.createdBy,
          assignee: usersTable.name,
        })
        .from(ticketsTable)
        .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
        .where(and(...conditions))
        .limit(1);
      if (!ticket) return { found: false, message: "No accessible ticket matched that identifier." };

      const [creator] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, ticket.creatorId))
        .limit(1);
      const [commentCount] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ticketCommentsTable)
        .where(eq(ticketCommentsTable.ticketId, ticket.ticketId));
      const comments = await db
        .select({
          commentId: ticketCommentsTable.id,
          author: usersTable.name,
          commentText: ticketCommentsTable.commentText,
          isSolution: ticketCommentsTable.isSolution,
          replyToCommentId: ticketCommentsTable.replyToCommentId,
          createdAt: ticketCommentsTable.createdAt,
        })
        .from(ticketCommentsTable)
        .leftJoin(usersTable, eq(ticketCommentsTable.authorId, usersTable.id))
        .where(eq(ticketCommentsTable.ticketId, ticket.ticketId))
        .orderBy(asc(ticketCommentsTable.createdAt))
        .limit(MAX_LIMIT);
      const { creatorId, ...ticketDetails } = ticket;
      return {
        found: true,
        ticket: {
          ...ticketDetails,
          creator: creator?.name ?? null,
          description: ticket.description.slice(0, 1600),
          resolutionNote: ticket.resolutionNote?.slice(0, 1000) ?? null,
        },
        totalComments: Number(commentCount?.total ?? 0),
        returnedComments: comments.length,
        commentsTruncated: Number(commentCount?.total ?? 0) > comments.length,
        comments: comments.map((comment) => ({
          ...comment,
          commentText: comment.commentText.slice(0, 900),
        })),
      };
    }

    case "search_comments": {
      const conditions: SQL[] = [];
      addCommentFilters(conditions, args, organizationId, isAdmin);
      addCommentTextSearch(conditions, readString(args, "query"));
      const limit = readLimit(args);
      const where = and(...conditions);
      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ticketCommentsTable)
        .innerJoin(ticketsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
        .leftJoin(usersTable, eq(ticketCommentsTable.authorId, usersTable.id))
        .where(where);
      const rows = await db
        .select({
          commentId: ticketCommentsTable.id,
          ticketId: ticketsTable.id,
          ticketNumber: ticketsTable.ticketNumber,
          ticketTitle: ticketsTable.title,
          author: usersTable.name,
          commentText: ticketCommentsTable.commentText,
          isSolution: ticketCommentsTable.isSolution,
          replyToCommentId: ticketCommentsTable.replyToCommentId,
          createdAt: ticketCommentsTable.createdAt,
        })
        .from(ticketCommentsTable)
        .innerJoin(ticketsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
        .leftJoin(usersTable, eq(ticketCommentsTable.authorId, usersTable.id))
        .where(where)
        .orderBy(desc(ticketCommentsTable.createdAt))
        .limit(limit);
      return {
        totalMatches: Number(countRow?.total ?? 0),
        returned: rows.length,
        truncated: Number(countRow?.total ?? 0) > rows.length,
        comments: rows.map((comment) => ({
          ...comment,
          commentText: comment.commentText.slice(0, 900),
        })),
      };
    }

    case "count_tickets": {
      const conditions: SQL[] = [];
      addCommonTicketFilters(conditions, args, organizationId, isAdmin);
      addTicketTextSearch(conditions, readString(args, "query"));
      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .leftJoin(usersTable, eq(ticketsTable.assignedTo, usersTable.id))
        .where(and(...conditions));
      return { count: Number(countRow?.total ?? 0) };
    }

    case "count_comments": {
      const conditions: SQL[] = [];
      addCommentFilters(conditions, args, organizationId, isAdmin);
      addCommentTextSearch(conditions, readString(args, "query"));
      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ticketCommentsTable)
        .innerJoin(ticketsTable, eq(ticketCommentsTable.ticketId, ticketsTable.id))
        .leftJoin(usersTable, eq(ticketCommentsTable.authorId, usersTable.id))
        .where(and(...conditions));
      return { count: Number(countRow?.total ?? 0) };
    }

    default:
      return { error: "Unknown read-only ticket tool." };
  }
}