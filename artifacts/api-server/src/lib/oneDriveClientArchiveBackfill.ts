import { and, asc, count, eq, isNotNull, isNull, lt, lte } from "drizzle-orm";
import {
  db,
  oneDriveClientArchiveBackfillItemsTable,
  oneDriveClientArchiveTable,
  ticketAttachmentsTable,
  ticketAttachmentOneDriveCopiesTable,
  ticketsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { prepareOneDriveClientArchiveCopyName, syncOneDriveAttachment } from "./onedriveGraph";

const CHECK_INTERVAL_MS = 15_000;
const LEASE_MS = 15 * 60_000;
const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 4;
let cycleRunning = false;

export async function enqueueOneDriveClientArchiveBackfill(organizationId: number): Promise<number> {
  const attachments = await db.select({ attachmentId: ticketAttachmentsTable.id })
    .from(ticketAttachmentsTable)
    .innerJoin(ticketsTable, eq(ticketsTable.id, ticketAttachmentsTable.ticketId))
    .where(and(
      eq(ticketsTable.organizationId, organizationId),
      isNull(ticketsTable.deletedAt),
      isNotNull(ticketsTable.clientId),
    ));

  let queued = 0;
  for (let offset = 0; offset < attachments.length; offset += 500) {
    const batch = attachments.slice(offset, offset + 500);
    if (!batch.length) continue;
    const inserted = await db.insert(oneDriveClientArchiveBackfillItemsTable)
      .values(batch.map(({ attachmentId }) => ({ organizationId, attachmentId })))
      .onConflictDoNothing()
      .returning({ id: oneDriveClientArchiveBackfillItemsTable.id });
    queued += inserted.length;
  }
  return queued;
}

export async function getOneDriveClientArchiveBackfillStatus(organizationId: number) {
  const rows = await db.select({
    status: oneDriveClientArchiveBackfillItemsTable.status,
    count: count(),
  }).from(oneDriveClientArchiveBackfillItemsTable)
    .where(eq(oneDriveClientArchiveBackfillItemsTable.organizationId, organizationId))
    .groupBy(oneDriveClientArchiveBackfillItemsTable.status);
  const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  const pending = counts.queued ?? 0;
  const processing = counts.processing ?? 0;
  const completed = counts.complete ?? 0;
  const failed = counts.failed ?? 0;
  const total = pending + processing + completed + failed;
  return {
    total,
    pending,
    processing,
    completed,
    failed,
    status: processing > 0 ? "processing" : pending > 0 ? "pending" : failed > 0 ? "failed" : total > 0 ? "complete" : "idle",
  };
}

export async function retryFailedOneDriveClientArchiveBackfill(organizationId: number): Promise<number> {
  const rows = await db.update(oneDriveClientArchiveBackfillItemsTable)
    .set({
      status: "queued",
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(),
      lockedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(oneDriveClientArchiveBackfillItemsTable.organizationId, organizationId),
      eq(oneDriveClientArchiveBackfillItemsTable.status, "failed"),
    ))
    .returning({ id: oneDriveClientArchiveBackfillItemsTable.id });
  return rows.length;
}

async function claimNextItem() {
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(oneDriveClientArchiveBackfillItemsTable)
      .where(and(
        eq(oneDriveClientArchiveBackfillItemsTable.status, "queued"),
        lte(oneDriveClientArchiveBackfillItemsTable.nextAttemptAt, new Date()),
      ))
      .orderBy(asc(oneDriveClientArchiveBackfillItemsTable.createdAt))
      .for("update", { skipLocked: true })
      .limit(1);
    if (!item) return null;
    const [claimed] = await tx.update(oneDriveClientArchiveBackfillItemsTable)
      .set({
        status: "processing",
        attempts: item.attempts + 1,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id))
      .returning();
    return claimed ?? null;
  });
}

async function processItem(item: NonNullable<Awaited<ReturnType<typeof claimNextItem>>>) {
  try {
    const [archive] = await db.select().from(oneDriveClientArchiveTable)
      .where(eq(oneDriveClientArchiveTable.organizationId, item.organizationId)).limit(1);
    if (!archive) throw new Error("Client archive is not configured.");

    let copyName = item.copyName;
    if (!copyName) {
      copyName = await prepareOneDriveClientArchiveCopyName(item.attachmentId);
      if (!copyName) {
        await db.update(oneDriveClientArchiveBackfillItemsTable)
          .set({ status: "complete", completedAt: new Date(), lockedAt: null, lastError: null })
          .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id));
        return;
      }
      await db.update(oneDriveClientArchiveBackfillItemsTable)
        .set({ copyName, updatedAt: new Date() })
        .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id));
    }

    await syncOneDriveAttachment(item.attachmentId, false, true, copyName);
    const [attachment] = await db.select({
      syncError: ticketAttachmentsTable.oneDriveSyncError,
      ticketId: ticketAttachmentsTable.ticketId,
    }).from(ticketAttachmentsTable).where(eq(ticketAttachmentsTable.id, item.attachmentId)).limit(1);
    if (!attachment) return;
    if (attachment.syncError) throw new Error(attachment.syncError);

    const [currentCopy] = await db.select({ id: ticketAttachmentOneDriveCopiesTable.id })
      .from(ticketAttachmentOneDriveCopiesTable)
      .where(and(
        eq(ticketAttachmentOneDriveCopiesTable.attachmentId, item.attachmentId),
        eq(ticketAttachmentOneDriveCopiesTable.ownerUserId, archive.ownerUserId),
        eq(ticketAttachmentOneDriveCopiesTable.itemName, copyName),
        eq(ticketAttachmentOneDriveCopiesTable.isCurrent, true),
      )).limit(1);
    if (!currentCopy) {
      const [ticket] = await db.select({ clientId: ticketsTable.clientId, deletedAt: ticketsTable.deletedAt })
        .from(ticketsTable).where(eq(ticketsTable.id, attachment.ticketId)).limit(1);
      if (!ticket || ticket.deletedAt || ticket.clientId == null) {
        await db.update(oneDriveClientArchiveBackfillItemsTable)
          .set({ status: "complete", completedAt: new Date(), lockedAt: null, lastError: null })
          .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id));
        return;
      }
      throw new Error("OneDrive did not confirm a current copy for this client.");
    }
    await db.update(oneDriveClientArchiveBackfillItemsTable)
      .set({ status: "complete", completedAt: new Date(), lockedAt: null, lastError: null })
      .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OneDrive backfill failed.";
    const terminal = item.attempts >= MAX_ATTEMPTS;
    const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, item.attempts - 1));
    await db.update(oneDriveClientArchiveBackfillItemsTable)
      .set({
        status: terminal ? "failed" : "queued",
        lastError: message.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + delay),
        lockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(oneDriveClientArchiveBackfillItemsTable.id, item.id));
    logger.warn({ err: error, organizationId: item.organizationId, attachmentId: item.attachmentId, attempts: item.attempts }, "OneDrive client archive backfill item failed");
  }
}

export async function runOneDriveClientArchiveBackfillCycle(): Promise<void> {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const leaseCutoff = new Date(Date.now() - LEASE_MS);
    await db.update(oneDriveClientArchiveBackfillItemsTable)
      .set({ status: "queued", lockedAt: null, nextAttemptAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(oneDriveClientArchiveBackfillItemsTable.status, "processing"),
        lt(oneDriveClientArchiveBackfillItemsTable.lockedAt, leaseCutoff),
      ));
    for (let i = 0; i < BATCH_SIZE; i += 1) {
      const item = await claimNextItem();
      if (!item) break;
      await processItem(item);
    }
  } catch (error) {
    logger.error({ err: error }, "OneDrive client archive backfill cycle failed");
  } finally {
    cycleRunning = false;
  }
}

export function startOneDriveClientArchiveBackfillJob(): void {
  void runOneDriveClientArchiveBackfillCycle();
  const interval = setInterval(() => void runOneDriveClientArchiveBackfillCycle(), CHECK_INTERVAL_MS);
  interval.unref();
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "OneDrive client archive backfill job started");
}
