import { Router, type IRouter } from "express";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, oneDriveClientArchiveTable, oneDriveConnectionsTable, usersTable, ticketAttachmentsTable, ticketsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import {
  OneDriveBrowseError,
  selectOneDriveClientArchive,
  syncOneDriveClientFolders,
  syncOneDriveAttachment,
} from "../lib/onedriveGraph";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/onedrive/client-archive", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser as { id: number; role: string; organizationId: number | null };
  if (!user.organizationId) {
    res.json({ configured: false, clients: [] });
    return;
  }
  const [archive] = await db.select({
    ownerUserId: oneDriveClientArchiveTable.ownerUserId,
  }).from(oneDriveClientArchiveTable)
    .where(eq(oneDriveClientArchiveTable.organizationId, user.organizationId)).limit(1);
  if (!archive) {
    res.json({ configured: false, clients: [] });
    return;
  }
  const [owner] = await db.select({
    email: oneDriveConnectionsTable.microsoftEmail,
    name: usersTable.name,
  }).from(oneDriveConnectionsTable)
    .innerJoin(usersTable, eq(usersTable.id, oneDriveConnectionsTable.userId))
    .where(and(
      eq(oneDriveConnectionsTable.userId, archive.ownerUserId),
      eq(oneDriveConnectionsTable.organizationId, user.organizationId),
    )).limit(1);
  const clients = await syncOneDriveClientFolders(user.organizationId);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    configured: true,
    ownerUserId: archive.ownerUserId,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.name ?? null,
    isOwner: archive.ownerUserId === user.id,
    isAdmin: user.role === "admin",
    clients,
  });
});

router.post("/onedrive/client-archive/select", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const user = (req as any).currentUser as { id: number; organizationId: number | null };
  if (!user.organizationId) {
    res.status(403).json({ error: "An organization account is required." });
    return;
  }
  try {
    const clients = await selectOneDriveClientArchive(user.organizationId, user.id);
    // Backfill previously uploaded attachments without holding up archive setup.
    const existing = await db.select({ attachmentId: ticketAttachmentsTable.id })
      .from(ticketAttachmentsTable)
      .innerJoin(ticketsTable, eq(ticketsTable.id, ticketAttachmentsTable.ticketId))
      .where(and(
        eq(ticketsTable.organizationId, user.organizationId),
        isNotNull(ticketsTable.clientId),
        isNull(ticketsTable.deletedAt),
      ));
    void (async () => {
      for (const item of existing) await syncOneDriveAttachment(item.attachmentId, false, true);
    })().catch((error) => logger.warn({ err: error, organizationId: user.organizationId }, "Client archive backfill failed"));
    res.json({ configured: true, clients });
  } catch (error) {
    if (error instanceof OneDriveBrowseError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.warn({ err: error, organizationId: user.organizationId }, "Could not configure client OneDrive archive");
    res.status(502).json({ error: "Could not configure the client OneDrive archive." });
  }
});

export default router;
