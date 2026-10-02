import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  organizationsTable,
  ticketCommentsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { executeBotTicketTool } from "./botTicketTools";

const runId = randomUUID();
const marker = `bot-lookup-${runId}`;
let organizationId: number;
let otherOrganizationId: number;
let adminId: number;
let userId: number;
let authorId: number;
const ticketIds: number[] = [];
const userIds: number[] = [];
const organizationIds: number[] = [];

describe("Nonno ticket lookup tools", () => {
  beforeAll(async () => {
    const [organization] = await db
      .insert(organizationsTable)
      .values({ name: `Bot tool test ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;
    organizationIds.push(organizationId);

    const [otherOrganization] = await db
      .insert(organizationsTable)
      .values({ name: `Other bot tool test ${runId}` })
      .returning({ id: organizationsTable.id });
    otherOrganizationId = otherOrganization.id;
    organizationIds.push(otherOrganizationId);

    const users = await db
      .insert(usersTable)
      .values([
        {
          name: "Bot Tool Admin",
          email: `bot-tool-admin-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "admin",
          organizationId,
        },
        {
          name: "Bot Tool User",
          email: `bot-tool-user-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
          organizationId,
        },
        {
          name: "Bot Tool Author",
          email: `bot-tool-author-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
          organizationId,
        },
      ])
      .returning({ id: usersTable.id, role: usersTable.role });
    userIds.push(...users.map((user) => user.id));
    adminId = users.find((user) => user.role === "admin")!.id;
    userId = users.find((user) => user.role === "user")!.id;
    authorId = users.find((user) => user.id !== userId && user.id !== adminId)!.id;

    const tickets = await db
      .insert(ticketsTable)
      .values([
        {
          organizationId,
          title: `Visible ${marker}`,
          description: `Visible ticket about ${marker}`,
          category: "Support",
          location: "Rome",
          createdBy: userId,
          visibility: "organization",
        },
        {
          organizationId,
          title: `Private ${marker}`,
          description: `Private ticket about ${marker}`,
          category: "Support",
          location: "Rome",
          createdBy: adminId,
          visibility: "admins",
        },
        {
          organizationId,
          title: `Deleted ${marker}`,
          description: `Deleted ticket about ${marker}`,
          category: "Support",
          location: "Rome",
          createdBy: userId,
          visibility: "organization",
          deletedAt: new Date(),
        },
        {
          organizationId: otherOrganizationId,
          title: `Other organization ${marker}`,
          description: `Foreign ticket about ${marker}`,
          category: "Support",
          location: "Rome",
          createdBy: adminId,
          visibility: "organization",
        },
      ])
      .returning({ id: ticketsTable.id, title: ticketsTable.title });
    ticketIds.push(...tickets.map((ticket) => ticket.id));

    await db.insert(ticketCommentsTable).values(
      tickets.map((ticket) => ({
        ticketId: ticket.id,
        authorId,
        commentText: `Comment marker ${marker} on ${ticket.title}`,
      })),
    );
  });

  afterAll(async () => {
    if (ticketIds.length > 0) {
      await db.delete(ticketCommentsTable).where(inArray(ticketCommentsTable.ticketId, ticketIds));
      await db.delete(ticketsTable).where(inArray(ticketsTable.id, ticketIds));
    }
    if (userIds.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
    if (organizationIds.length > 0) {
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
  });

  it("scopes ticket and comment searches to visible, non-deleted records", async () => {
    const visibleTicketId = ticketIds[0];
    const privateTicketId = ticketIds[1];

    const userTickets = await executeBotTicketTool(
      "search_tickets",
      { query: marker },
      organizationId,
      false,
    ) as { totalMatches: number; tickets: { ticketId: number }[] };
    expect(userTickets.totalMatches).toBe(1);
    expect(userTickets.tickets.map((ticket) => ticket.ticketId)).toEqual([visibleTicketId]);

    const adminTickets = await executeBotTicketTool(
      "search_tickets",
      { query: marker },
      organizationId,
      true,
    ) as { totalMatches: number; tickets: { ticketId: number }[] };
    expect(adminTickets.totalMatches).toBe(2);
    expect(adminTickets.tickets.map((ticket) => ticket.ticketId)).toContain(privateTicketId);

    const userComments = await executeBotTicketTool(
      "search_comments",
      { query: marker },
      organizationId,
      false,
    ) as { totalMatches: number; comments: { ticketId: number }[] };
    expect(userComments.totalMatches).toBe(1);
    expect(userComments.comments.map((comment) => comment.ticketId)).toEqual([visibleTicketId]);

    const adminComments = await executeBotTicketTool(
      "search_comments",
      { query: marker },
      organizationId,
      true,
    ) as { totalMatches: number; comments: { ticketId: number }[] };
    expect(adminComments.totalMatches).toBe(2);
    expect(adminComments.comments.map((comment) => comment.ticketId)).toContain(privateTicketId);

    const privateTicketForUser = await executeBotTicketTool(
      "get_ticket",
      { ticketId: privateTicketId },
      organizationId,
      false,
    ) as { found: boolean };
    expect(privateTicketForUser.found).toBe(false);

    const privateTicketForAdmin = await executeBotTicketTool(
      "get_ticket",
      { ticketId: privateTicketId },
      organizationId,
      true,
    ) as { found: boolean };
    expect(privateTicketForAdmin.found).toBe(true);

    const userTicketCount = await executeBotTicketTool(
      "count_tickets",
      { query: marker },
      organizationId,
      false,
    ) as { count: number };
    expect(userTicketCount.count).toBe(1);

    const userCommentCount = await executeBotTicketTool(
      "count_comments",
      { query: marker },
      organizationId,
      false,
    ) as { count: number };
    expect(userCommentCount.count).toBe(1);

    const adminCommentCount = await executeBotTicketTool(
      "count_comments",
      { query: marker },
      organizationId,
      true,
    ) as { count: number };
    expect(adminCommentCount.count).toBe(2);
  }, 60_000);
});