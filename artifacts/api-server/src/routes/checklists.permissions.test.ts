import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  organizationsTable,
  pool,
  sessionsTable,
  ticketChecklistsTable,
  ticketChecklistItemsTable,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let userId: number;
let userSessionId: string;
let ticketId: number;
let checklistId: number;
let itemId: number;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${userSessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

describe("checklist item permissions", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Checklist permission test ${runId}`,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const [user] = await db.insert(usersTable).values({
      name: "Checklist Permission Test User",
      email: `checklist-permission-${runId}@example.test`,
      passwordHash: "not-used-in-test",
      role: "user",
      organizationId,
    }).returning({ id: usersTable.id });
    userId = user.id;
    userSessionId = await createSession(userId);

    const [ticket] = await db.insert(ticketsTable).values({
      title: `Checklist permission ticket ${runId}`,
      description: "Test ticket",
      category: "Support",
      location: "Office",
      createdBy: userId,
      organizationId,
    }).returning({ id: ticketsTable.id });
    ticketId = ticket.id;

    const [checklist] = await db.insert(ticketChecklistsTable).values({
      ticketId,
      orgId: organizationId,
      title: "Test checklist",
    }).returning({ id: ticketChecklistsTable.id });
    checklistId = checklist.id;

    const [item] = await db.insert(ticketChecklistItemsTable).values({
      checklistId,
      orgId: organizationId,
      text: "Original item",
    }).returning({ id: ticketChecklistItemsTable.id });
    itemId = item.id;

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose an address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (ticketId) await db.delete(ticketsTable).where(eq(ticketsTable.id, ticketId));
    if (userSessionId) await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, userSessionId));
    if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("lets non-admins edit and delete checklist items, but not reorder or delete the checklist", async () => {
    const editItem = await request(
      `/api/tickets/${ticketId}/checklists/${checklistId}/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify({ text: "Updated item" }) },
    );
    expect(editItem.status).toBe(200);
    expect(editItem.body.text).toBe("Updated item");

    const reorderItem = await request(
      `/api/tickets/${ticketId}/checklists/${checklistId}/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify({ position: 5 }) },
    );
    expect(reorderItem.status).toBe(403);

    const deleteChecklist = await request(
      `/api/tickets/${ticketId}/checklists/${checklistId}`,
      { method: "DELETE" },
    );
    expect(deleteChecklist.status).toBe(403);

    const deleteItem = await request(
      `/api/tickets/${ticketId}/checklists/${checklistId}/items/${itemId}`,
      { method: "DELETE" },
    );
    expect(deleteItem.status).toBe(200);
    expect(deleteItem.body).toEqual({ success: true });
  });
});
