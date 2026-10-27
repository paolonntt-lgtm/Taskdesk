import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  notificationsTable,
  organizationsTable,
  pool,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { createSession } from "../lib/session";

const runId = crypto.randomUUID();
let server: Server;
let baseUrl: string;
let organizationId: number;
let userIds: number[] = [];
let sessionIds: string[] = [];
let notificationId: number;

async function request(path: string, sessionId: string, method = "GET") {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Cookie: `session_id=${sessionId}` },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("mark notification unread", () => {
  beforeAll(async () => {
    const [organization] = await db.insert(organizationsTable).values({
      name: `Notification unread ${runId}`,
    }).returning({ id: organizationsTable.id });
    organizationId = organization.id;

    const users = await db.insert(usersTable).values([
      {
        name: "Notification owner",
        email: `notification-owner-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      },
      {
        name: "Other notification user",
        email: `notification-other-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "user",
        organizationId,
      },
    ]).returning({ id: usersTable.id });
    userIds = users.map(({ id }) => id);
    sessionIds = await Promise.all(userIds.map((userId) => createSession(userId)));

    const [notification] = await db.insert(notificationsTable).values({
      userId: userIds[0],
      type: "system",
      notificationText: `Read notification ${runId}`,
      isRead: true,
    }).returning({ id: notificationsTable.id });
    notificationId = notification.id;

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
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    if (notificationId) await db.delete(notificationsTable).where(eq(notificationsTable.id, notificationId));
    if (sessionIds.length) await db.delete(sessionsTable).where(inArray(sessionsTable.sessionId, sessionIds));
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    if (organizationId) await db.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
    await pool.end();
  });

  it("restores unread state for its owner and rejects other users", async () => {
    const restoreResponse = await request(
      `/api/notifications/${notificationId}/unread`,
      sessionIds[0],
      "PATCH",
    );
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.isRead).toBe(false);

    const listResponse = await request("/api/notifications", sessionIds[0]);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: notificationId, isRead: false })]),
    );

    const otherUserResponse = await request(
      `/api/notifications/${notificationId}/unread`,
      sessionIds[1],
      "PATCH",
    );
    expect(otherUserResponse.status).toBe(404);
  });
});
