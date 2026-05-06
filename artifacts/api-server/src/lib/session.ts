import { Request } from "express";
import { randomBytes } from "crypto";

export interface SessionData {
  userId?: number;
}

const sessions = new Map<string, SessionData>();

export function createSession(userId: number): string {
  const sessionId = randomBytes(32).toString("hex");
  sessions.set(sessionId, { userId });
  return sessionId;
}

export function getSession(sessionId: string): SessionData | undefined {
  return sessions.get(sessionId);
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function destroySessionsForUser(userId: number, excludeSessionId?: string): void {
  for (const [id, data] of sessions) {
    if (data.userId === userId && id !== excludeSessionId) {
      sessions.delete(id);
    }
  }
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

export function getCurrentUserId(req: Request): number | undefined {
  const sessionId = getSessionId(req);
  if (!sessionId) return undefined;
  const session = getSession(sessionId);
  return session?.userId;
}
