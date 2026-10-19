import { Request, Response, NextFunction } from "express";
import { getCurrentUserId, destroySession, getSessionId } from "../lib/session";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrganizationTrialStatus } from "../lib/organizationTrialStatus";
import { canUseBillingDuringExpiredTrial } from "../lib/trialAccess";
import { logger } from "../lib/logger";

const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;
const lastSeenWriteAt = new Map<number, number>();

function refreshLastSeen(userId: number): void {
  const now = Date.now();
  const previousWriteAt = lastSeenWriteAt.get(userId) ?? 0;
  if (now - previousWriteAt < LAST_SEEN_WRITE_INTERVAL_MS) return;

  lastSeenWriteAt.set(userId, now);
  if (lastSeenWriteAt.size > 2_000) {
    for (const [id, writeAt] of lastSeenWriteAt) {
      if (now - writeAt > LAST_SEEN_WRITE_INTERVAL_MS) lastSeenWriteAt.delete(id);
    }
  }

  void db.update(usersTable)
    .set({ lastSeenAt: new Date(now) })
    .where(eq(usersTable.id, userId))
    .catch((err: unknown) => {
      if (lastSeenWriteAt.get(userId) === now) lastSeenWriteAt.delete(userId);
      logger.error({ err, userId }, "Failed to refresh lastSeenAt");
    });
}

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

  if (!user.isSuperAdmin) {
    const trialStatus = await getOrganizationTrialStatus(user);
    const billingPath = canUseBillingDuringExpiredTrial(req.originalUrl, user.role);
    if (trialStatus?.isExpired && !billingPath) {
      res.status(402).json({
        error: "TRIAL_EXPIRED",
        message: "Il periodo di prova dell'organizzazione è scaduto. Contatta l'amministratore per attivare un abbonamento.",
      });
      return;
    }
  }

  refreshLastSeen(userId);
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
