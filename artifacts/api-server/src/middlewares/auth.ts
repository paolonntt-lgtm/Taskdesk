import { Request, Response, NextFunction } from "express";
import { getCurrentUserId, destroySession, getSessionId } from "../lib/session";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (!user.isActive) {
    const sessionId = getSessionId(req);
    if (sessionId) await destroySession(sessionId);
    res.status(401).json({ error: "Account disabled" });
    return;
  }
  (req as any).currentUser = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).currentUser;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // Non-superadmin admins must belong to an organization; an org-less admin
  // account has no tenant scope and must not be treated as tenant-admin.
  if (!user.isSuperAdmin && user.organizationId == null) {
    res.status(403).json({ error: "Admin account has no organization" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).currentUser;
  if (!user || !user.isSuperAdmin) {
    res.status(403).json({ error: "Superadmin access required" });
    return;
  }
  next();
}
