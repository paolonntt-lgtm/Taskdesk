import { Router, type IRouter } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { runBackupForOrg, buildBackupPayload } from "../lib/backup";
import { db, organizationsTable, ticketsTable, ticketCommentsTable, ticketInternalNotesTable, clientsTable, clientNotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/backup/export — scarica il backup completo come file JSON
router.get("/backup/export", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId: number | undefined = currentUser.organizationId;
  if (!orgId) { res.status(403).json({ error: "No organization" }); return; }

  const payload = await buildBackupPayload(orgId);
  if (!payload) { res.status(500).json({ error: "Export non riuscito" }); return; }

  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = (payload.organization.name ?? "org").replace(/[^a-z0-9]/gi, "_");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="taskdesk-backup-${safeName}-${dateStr}.json"`);
  res.json(payload);
});

// POST /api/backup/trigger — retrocompatibilità (avvia backup cloud + email)
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

// POST /api/backup/restore — importa un file di backup precedentemente esportato
router.post("/backup/restore", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId: number | undefined = currentUser.organizationId;
  if (!orgId) { res.status(403).json({ error: "No organization" }); return; }

  const backup = req.body;
  const data = backup?.data ?? backup; // supporta sia il formato { data: {...} } che il flat

  if (!backup?.exportedAt || !Array.isArray(data?.tickets)) {
    res.status(400).json({ error: "Formato file non valido. Usa un file esportato da TaskDesk." });
    return;
  }

  let ticketsRestored = 0;
  let clientsRestored = 0;
  let commentsRestored = 0;
  let notesRestored = 0;
  let clientNotesRestored = 0;

  try {
    // ── 1. Clienti (match per nome) ──
    const existingClients = await db.select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable).where(eq(clientsTable.organizationId, orgId));
    const existingClientNames = new Map(existingClients.map(c => [c.name.toLowerCase(), c.id]));
    const clientIdMap = new Map<number, number>(); // oldId → newId
    const restoredClientOldIds = new Set<number>();

    for (const c of (data.clients ?? [])) {
      if (!c?.name) continue;
      const key = String(c.name).toLowerCase();
      if (existingClientNames.has(key)) {
        clientIdMap.set(c.id, existingClientNames.get(key)!);
      } else {
        const [ins] = await db.insert(clientsTable).values({
          organizationId: orgId,
          name: c.name,
          alias: c.alias ?? null,
          slug: c.slug ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          vatNumber: c.vatNumber ?? null,
          taxCode: c.taxCode ?? null,
          address: c.address ?? null,
          pec: c.pec ?? null,
          contactPerson: c.contactPerson ?? null,
          notes: c.notes ?? null,
        }).returning({ id: clientsTable.id });
        clientIdMap.set(c.id, ins.id);
        restoredClientOldIds.add(c.id);
        clientsRestored++;
      }
    }

    // ── 2. Ticket (match per ticketNumber) ──
    const existingTickets = await db.select({ id: ticketsTable.id, ticketNumber: ticketsTable.ticketNumber })
      .from(ticketsTable).where(eq(ticketsTable.organizationId, orgId));
    const existingByNum = new Map(existingTickets.map(t => [t.ticketNumber, t.id]));
    const ticketIdMap = new Map<number, number>(); // oldId → newId
    const restoredTicketOldIds = new Set<number>();

    for (const t of data.tickets) {
      if (existingByNum.has(t.ticketNumber)) {
        ticketIdMap.set(t.id, existingByNum.get(t.ticketNumber)!);
        continue;
      }
      const [ins] = await db.insert(ticketsTable).values({
        organizationId: orgId,
        ticketNumber: t.ticketNumber ?? null,
        title: t.title ?? "(senza titolo)",
        description: t.description ?? "",
        category: t.category ?? "Generale",
        location: t.location ?? "",
        resource: t.resource ?? null,
        priority: t.priority ?? "medium",
        status: t.status ?? "open",
        createdBy: currentUser.id,
        assignedTo: null,
        resolutionNote: t.resolutionNote ?? null,
        dueAt: t.dueAt ? new Date(t.dueAt) : null,
        closedAt: t.closedAt ? new Date(t.closedAt) : null,
        clientId: t.clientId != null ? (clientIdMap.get(t.clientId) ?? null) : null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      }).returning({ id: ticketsTable.id });
      ticketIdMap.set(t.id, ins.id);
      restoredTicketOldIds.add(t.id);
      ticketsRestored++;
    }

    // ── 3. Commenti dei ticket ripristinati ──
    for (const c of (data.comments ?? [])) {
      if (!restoredTicketOldIds.has(c.ticketId)) continue;
      const newTicketId = ticketIdMap.get(c.ticketId);
      if (!newTicketId) continue;
      await db.insert(ticketCommentsTable).values({
        ticketId: newTicketId,
        authorId: currentUser.id,
        commentText: c.commentText ?? "",
        isSolution: c.isSolution ?? false,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      });
      commentsRestored++;
    }

    // ── 4. Note interne dei ticket ripristinati ──
    for (const n of (data.internalNotes ?? data.notes ?? [])) {
      if (!restoredTicketOldIds.has(n.ticketId)) continue;
      const newTicketId = ticketIdMap.get(n.ticketId);
      if (!newTicketId) continue;
      await db.insert(ticketInternalNotesTable).values({
        ticketId: newTicketId,
        authorId: currentUser.id,
        noteText: n.noteText ?? "",
        createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
      });
      notesRestored++;
    }

    // ── 5. Note clienti ripristinati ──
    for (const cn of (data.clientNotes ?? [])) {
      if (!restoredClientOldIds.has(cn.clientId)) continue;
      const newClientId = clientIdMap.get(cn.clientId);
      if (!newClientId) continue;
      await db.insert(clientNotesTable).values({
        clientId: newClientId,
        organizationId: orgId,
        authorId: currentUser.id,
        body: cn.body ?? "",
        checklist: cn.checklist ?? null,
        monthOverride: cn.monthOverride ?? null,
        createdAt: cn.createdAt ? new Date(cn.createdAt) : new Date(),
      });
      clientNotesRestored++;
    }

    res.json({ ok: true, ticketsRestored, clientsRestored, commentsRestored, notesRestored, clientNotesRestored });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "Backup restore failed");
    res.status(500).json({ error: "Ripristino non riuscito. Riprova." });
  }
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
