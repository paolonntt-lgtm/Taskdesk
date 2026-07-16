import { Router, type IRouter } from "express";
import { db, usersTable, organizationsTable, ticketsTable, bugReportsTable } from "@workspace/db";
import { eq, desc, and, sql, asc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";
import { z } from "zod/v4";
import { getPlatformSmtpConfig } from "../lib/email";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/superadmin", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const [rows, ticketCounts] = await Promise.all([
    db
      .select({
        orgId: organizationsTable.id,
        orgName: organizationsTable.name,
        orgCreatedAt: organizationsTable.createdAt,
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
        userIsActive: usersTable.isActive,
        userCreatedAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(organizationsTable)
      .leftJoin(
        usersTable,
        and(
          eq(usersTable.organizationId, organizationsTable.id),
          eq(usersTable.isActive, true),
        )
      )
      .orderBy(desc(organizationsTable.createdAt), desc(usersTable.createdAt)),

    db
      .select({
        organizationId: ticketsTable.organizationId,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(ticketsTable)
      .groupBy(ticketsTable.organizationId),
  ]);

  const totalByOrg = new Map<number, number>();
  for (const row of ticketCounts) {
    if (row.organizationId != null) totalByOrg.set(row.organizationId, row.totalCount);
  }

  const orgMap = new Map<number, {
    id: number;
    name: string;
    createdAt: string | null;
    totalTickets: number;
    users: Array<{
      id: number;
      name: string;
      email: string;
      role: string;
      createdAt: string | null;
      lastLoginAt: string | null;
      avatarUrl: string | null;
    }>;
  }>();

  for (const row of rows) {
    if (!orgMap.has(row.orgId)) {
      orgMap.set(row.orgId, {
        id: row.orgId,
        name: row.orgName,
        createdAt: row.orgCreatedAt?.toISOString() ?? null,
        totalTickets: totalByOrg.get(row.orgId) ?? 0,
        users: [],
      });
    }
    if (row.userId && row.userIsActive) {
      orgMap.get(row.orgId)!.users.push({
        id: row.userId,
        name: row.userName!,
        email: row.userEmail!,
        role: row.userRole!,
        createdAt: row.userCreatedAt?.toISOString() ?? null,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        avatarUrl: row.avatarUrl ?? null,
      });
    }
  }

  res.json({ organizations: Array.from(orgMap.values()) });
});

router.get("/superadmin/bug-reports", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  const [reports, countResult, pendingCount] = await Promise.all([
    db
      .select({
        id: bugReportsTable.id,
        userId: bugReportsTable.userId,
        organizationId: bugReportsTable.organizationId,
        organizationName: organizationsTable.name,
        userName: bugReportsTable.userName,
        userEmail: bugReportsTable.userEmail,
        description: bugReportsTable.description,
        currentPage: bugReportsTable.currentPage,
        status: bugReportsTable.status,
        replyText: bugReportsTable.replyText,
        repliedAt: bugReportsTable.repliedAt,
        processedAt: bugReportsTable.processedAt,
        isRead: bugReportsTable.isRead,
        createdAt: bugReportsTable.createdAt,
      })
      .from(bugReportsTable)
      .leftJoin(organizationsTable, eq(bugReportsTable.organizationId, organizationsTable.id))
      .orderBy(asc(bugReportsTable.isRead), desc(bugReportsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bugReportsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bugReportsTable)
      .where(eq(bugReportsTable.isRead, false)),
  ]);

  res.json({
    reports: reports.map((r) => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
      repliedAt: r.repliedAt?.toISOString() ?? null,
      processedAt: r.processedAt?.toISOString() ?? null,
    })),
    total: countResult[0]?.count ?? 0,
    page,
    pendingCount: pendingCount[0]?.count ?? 0,
  });
});

const patchBugReportSchema = z.object({
  status: z.enum(["pending", "replied", "processed"]).optional(),
  isRead: z.boolean().optional(),
});

router.patch("/superadmin/bug-reports/:id", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = patchBugReportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "processed") updates.processedAt = new Date();
  }
  if (parsed.data.isRead !== undefined) updates.isRead = parsed.data.isRead;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  const [updated] = await db
    .update(bugReportsTable)
    .set(updates as any)
    .where(eq(bugReportsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    ...updated,
    createdAt: updated.createdAt?.toISOString() ?? null,
    repliedAt: updated.repliedAt?.toISOString() ?? null,
    processedAt: updated.processedAt?.toISOString() ?? null,
  });
});

const replySchema = z.object({
  replyText: z.string().min(1).max(4000),
});

router.post("/superadmin/bug-reports/:id/reply", requireAuth, requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [report] = await db.select().from(bugReportsTable).where(eq(bugReportsTable.id, id));
  if (!report) { res.status(404).json({ error: "Not found" }); return; }

  const { replyText } = parsed.data;

  const config = getPlatformSmtpConfig();
  if (!config) {
    logger.warn("bug-report reply: nessun SMTP configurato");
    res.status(503).json({ error: "Email non configurata. Contatta l'amministratore di sistema." });
    return;
  }

  const replyHtml = replyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Risposta al bug report</p>
      </div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">Ciao <strong>${report.userName}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px">Grazie per aver segnalato il problema. Ecco la risposta del nostro team:</p>
      <div style="background:#f9fafb;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;font-size:15px;line-height:1.7;color:#1f2937">
        ${replyHtml}
      </div>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">Email inviata dal team TaskDesk in risposta alla tua segnalazione.</p>
    </div>
  `;
  const text = `Ciao ${report.userName},\n\nGrazie per la segnalazione. Ecco la risposta del nostro team:\n\n${replyText}\n\n— Il team TaskDesk`;

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({
      from: config.from || config.user,
      to: report.userEmail,
      subject: `Re: Bug Report — TaskDesk`,
      html,
      text,
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "bug-report reply: invio email fallito");
    res.status(502).json({ error: "Invio email fallito. Riprova più tardi." });
    return;
  }

  const [updated] = await db
    .update(bugReportsTable)
    .set({ replyText, repliedAt: new Date(), status: "replied", isRead: true })
    .where(eq(bugReportsTable.id, id))
    .returning();

  res.json({
    ...updated,
    createdAt: updated.createdAt?.toISOString() ?? null,
    repliedAt: updated.repliedAt?.toISOString() ?? null,
    processedAt: updated.processedAt?.toISOString() ?? null,
  });
});

export default router;
