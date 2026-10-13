import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  clientsTable,
  clientNotesTable,
  groupsTable,
  groupMembersTable,
  organizationsTable,
  pool,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

type HttpResult = { status: number; body: any };

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let clientId: number;
let noteId: number;
let groupId: number;
let adminId: number;
let authorId: number;
let editorId: number;
let unauthorizedId: number;
let adminSessionId: string;
let authorSessionId: string;
let editorSessionId: string;
let unauthorizedSessionId: string;

async function request(path: string, sessionId: string, init: RequestInit = {}): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session_id=${sessionId}`);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function expectMonth(monthOverride: string): Promise<void> {
  const [note] = await db
    .select({ monthOverride: clientNotesTable.monthOverride })
    .from(clientNotesTable)
    .where(eq(clientNotesTable.id, noteId))
    .limit(1);

  expect(note?.monthOverride).toBe(monthOverride);
}

describe("client note month permissions", () => {
  beforeAll(async () => {
    const [organization] = await db
      .insert(organizationsTable)
      .values({ name: `Client note month permissions ${runId}` })
      .returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const users = await db
      .insert(usersTable)
      .values([
        {
          name: "Client Note Month Admin",
          email: `client-note-month-admin-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "admin",
          organizationId,
        },
        {
          name: "Client Note Month Author",
          email: `client-note-month-author-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
          organizationId,
        },
        {
          name: "Client Note Month Editor",
          email: `client-note-month-editor-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
          organizationId,
        },
        {
          name: "Client Note Month Unauthorized",
          email: `client-note-month-unauthorized-${runId}@example.test`,
          passwordHash: "not-used-in-test",
          role: "user",
          organizationId,
        },
      ])
      .returning({ id: usersTable.id });

    [adminId, authorId, editorId, unauthorizedId] = users.map((user) => user.id);

    const [group] = await db
      .insert(groupsTable)
      .values({
        name: `Client Note Month Editors ${runId}`,
        organizationId,
        permissions: JSON.stringify(["edit_client_notes"]),
      })
      .returning({ id: groupsTable.id });
    groupId = group.id;
    await db.insert(groupMembersTable).values({ groupId, userId: editorId });

    const [client] = await db
      .insert(clientsTable)
      .values({
        organizationId,
        name: "Client Note Month Test",
        email: `client-note-month-client-${runId}@example.test`,
        slug: `client-note-month-${runId}`,
      })
      .returning({ id: clientsTable.id });
    clientId = client.id;

    const [note] = await db
      .insert(clientNotesTable)
      .values({
        clientId,
        organizationId,
        authorId,
        body: "Permission regression note",
        monthOverride: "2026-01",
      })
      .returning({ id: clientNotesTable.id });
    noteId = note.id;

    [adminSessionId, authorSessionId, editorSessionId, unauthorizedSessionId] = await Promise.all([
      createSession(adminId),
      createSession(authorId),
      createSession(editorId),
      createSession(unauthorizedId),
    ]);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not expose an address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (noteId) await db.delete(clientNotesTable).where(eq(clientNotesTable.id, noteId));
    if (groupId) {
      await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
      await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    }
    if (clientId) await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
    if (adminSessionId && authorSessionId && editorSessionId && unauthorizedSessionId) {
      await db.delete(sessionsTable).where(
        eq(sessionsTable.sessionId, adminSessionId),
      );
      await db.delete(sessionsTable).where(
        eq(sessionsTable.sessionId, authorSessionId),
      );
      await db.delete(sessionsTable).where(
        eq(sessionsTable.sessionId, editorSessionId),
      );
      await db.delete(sessionsTable).where(
        eq(sessionsTable.sessionId, unauthorizedSessionId),
      );
    }
    if (adminId && authorId && editorId && unauthorizedId) {
      await db.delete(usersTable).where(eq(usersTable.id, adminId));
      await db.delete(usersTable).where(eq(usersTable.id, authorId));
      await db.delete(usersTable).where(eq(usersTable.id, editorId));
      await db.delete(usersTable).where(eq(usersTable.id, unauthorizedId));
    }
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("allows the author, admins, and users with edit_client_notes to move a note, but rejects others without changing its month", async () => {
    const path = `/api/clients/${clientId}/notes/${noteId}`;
    const allowedChanges = [
      { sessionId: authorSessionId, monthOverride: "2026-02" },
      { sessionId: adminSessionId, monthOverride: "2026-03" },
      { sessionId: editorSessionId, monthOverride: "2026-04" },
    ];

    for (const { sessionId, monthOverride } of allowedChanges) {
      const response = await request(path, sessionId, {
        method: "PATCH",
        body: JSON.stringify({ monthOverride }),
      });

      expect(response.status).toBe(200);
      expect(response.body.monthOverride).toBe(monthOverride);
      await expectMonth(monthOverride);
    }

    const deniedMonth = "2026-05";
    const deniedResponse = await request(path, unauthorizedSessionId, {
      method: "PATCH",
      body: JSON.stringify({ monthOverride: deniedMonth }),
    });

    expect(deniedResponse.status).toBe(403);
    await expectMonth("2026-04");
  });
});
