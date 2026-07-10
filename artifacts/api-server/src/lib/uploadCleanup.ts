/**
 * Orphaned-upload cleanup job.
 *
 * When the API issues a presigned PUT URL, the client uploads the file
 * directly to GCS.  If the client never calls the attachment-save endpoint
 * (deliberately or due to an error), the uploaded object remains in storage
 * indefinitely as a billable orphan.
 *
 * This job runs periodically, lists objects in the `uploads/` subdirectory
 * of PRIVATE_OBJECT_DIR that are older than ORPHAN_AGE_MS, and deletes any
 * that are not linked to a ticket attachment record in the database.
 *
 * ORPHAN_AGE_MS is intentionally longer than the presigned-URL TTL (15 min)
 * to avoid racing with legitimate slow uploads or attachment-save requests.
 */

import { eq } from "drizzle-orm";
import { db, ticketAttachmentsTable } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

/** Objects older than this are eligible for orphan deletion (TTL + 5 min grace). */
const ORPHAN_AGE_MS = 20 * 60 * 1000;

/** How often the cleanup sweep runs. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const service = new ObjectStorageService();

async function cleanupOrphanedUploads(): Promise<void> {
  let candidates: string[];

  try {
    candidates = await service.listUploadCandidatesOlderThan(ORPHAN_AGE_MS);
  } catch (err) {
    // Object storage may not be configured in all environments.
    logger.warn({ err }, "Orphaned-upload cleanup: failed to list candidates — skipping sweep");
    return;
  }

  for (const normalizedPath of candidates) {
    try {
      const [linked] = await db
        .select({ id: ticketAttachmentsTable.id })
        .from(ticketAttachmentsTable)
        .where(eq(ticketAttachmentsTable.objectPath, normalizedPath))
        .limit(1);

      if (!linked) {
        await service.deleteObjectEntityByPath(normalizedPath);
        logger.info({ normalizedPath }, "Orphaned-upload cleanup: deleted unlinked object");
      }
    } catch (err) {
      logger.warn({ normalizedPath, err }, "Orphaned-upload cleanup: failed to process candidate");
    }
  }
}

/**
 * Start the periodic orphaned-upload cleanup job.
 * The interval is unreffed so it does not prevent the process from exiting
 * cleanly during graceful shutdown.
 */
export function startUploadCleanupJob(): void {
  const interval = setInterval(() => {
    void cleanupOrphanedUploads();
  }, CLEANUP_INTERVAL_MS);
  interval.unref();
}
