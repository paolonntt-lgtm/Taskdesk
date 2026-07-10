import { Router, type IRouter } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { runBackupForOrg } from "../lib/backup";
import { db, organizationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/backup/trigger", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId: number | undefined = currentUser.organizationId;
  if (!orgId) {
    res.status(400).json({ error: "No organization associated with this account" });
    return;
  }
  const result = await runBackupForOrg(orgId);
  if (!result.ok) {
    res.status(500).json({ error: result.error ?? "Backup failed" });
    return;
  }
  res.json({ ok: true, path: result.path, emailsSent: result.emailsSent });
});

export default router;

const BACKUP_HOUR_UTC = 2;

export function scheduleNightlyBackups(): void {
  function msUntilNextRun(): number {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), BACKUP_HOUR_UTC, 0, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilNextRun();
    logger.info({ nextRunInMs: delay, nextRunAt: new Date(Date.now() + delay).toISOString() }, "backup: next nightly run scheduled");
    setTimeout(async () => {
      await runAllOrgsBackup();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

async function runAllOrgsBackup(): Promise<void> {
  logger.info("backup: starting nightly backup for all organizations");
  let orgs: { id: number }[] = [];
  try {
    orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  } catch (err: any) {
    logger.error({ err: err?.message }, "backup: failed to list organizations");
    return;
  }
  for (const org of orgs) {
    const result = await runBackupForOrg(org.id);
    if (result.ok) {
      logger.info({ orgId: org.id, path: result.path, emailsSent: result.emailsSent }, "backup: org backup completed");
    } else {
      logger.warn({ orgId: org.id, error: result.error }, "backup: org backup failed");
    }
  }
}
