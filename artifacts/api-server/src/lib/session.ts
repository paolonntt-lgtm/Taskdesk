import { Request } from "express";
import { randomBytes } from "crypto";
import { db, sessionsTable } from "@workspace/db";
import { eq, and, ne, lt } from "drizzle-orm";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function createSession(userId: number): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ sessionId, userId, expiresAt });
  return sessionId;
}

export async function getSession(sessionId: string): Promise<{ userId: number } | undefined> {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId));
  if (!session) return undefined;
  if (session.expiresAt < new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
    return undefined;
  }
  return { userId: session.userId };
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, sessionId));
}

export async function destroySessionsForUser(userId: number, excludeSessionId?: string): Promise<void> {
  if (excludeSessionId) {
    await db.delete(sessionsTable).where(
      and(eq(sessionsTable.userId, userId), ne(sessionsTable.sessionId, excludeSessionId))
    );
  } else {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
  }
}

export async function cleanExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

export function getSessionId(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies["session_id"];
}

export async function getCurrentUserId(req: Request): Promise<number | undefined> {
  const sessionId = getSessionId(req);
  if (!sessionId) return undefined;
  const session = await getSession(sessionId);
  return session?.userId;
}
