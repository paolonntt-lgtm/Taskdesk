import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/auth";
import { getPlatformSmtpConfig } from "../lib/email";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { db, bugReportsTable } from "@workspace/db";

const router: IRouter = Router();

const bugReportSchema = z.object({
  description: z.string().min(1).max(4000),
  currentPage: z.string().max(500).optional().default(""),
});

router.post("/bug-report", requireAuth, async (req, res) => {
  const parsed = bugReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { description, currentPage } = parsed.data;
  const user = (req as any).currentUser as { name: string; email: string; id: number; organizationId: number | null };

  const config = getPlatformSmtpConfig();

  const destination = "paolonntt@gmail.com";
  const escapedDesc = description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const subject = `🐛 Bug Report da ${user.name} — TaskDesk`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">🐛 Bug Report</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280;width:120px;vertical-align:top">Segnalato da</td>
          <td style="padding:10px 0;font-weight:600">${escapeHtml(user.name)}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280;vertical-align:top">Email</td>
          <td style="padding:10px 0"><a href="mailto:${escapeHtml(user.email)}" style="color:#2563eb">${escapeHtml(user.email)}</a></td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280;vertical-align:top">Pagina</td>
          <td style="padding:10px 0;font-family:monospace;font-size:13px;color:#374151">${escapeHtml(currentPage || "—")}</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px">Descrizione</p>
      <div style="background:#f9fafb;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px 20px;font-size:15px;line-height:1.7;color:#1f2937">
        ${escapedDesc}
      </div>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">Email automatica inviata da TaskDesk Bug Reporter.</p>
    </div>
  `;
  const text = `Bug Report da ${user.name} (${user.email})\nPagina: ${currentPage || "—"}\n\n${description}`;

  try {
    await db.insert(bugReportsTable).values({
      userId: user.id,
      organizationId: user.organizationId ?? null,
      userName: user.name,
      userEmail: user.email,
      description,
      currentPage: currentPage || "",
      status: "pending",
      isRead: false,
    });
  } catch (dbErr: any) {
    logger.error({ err: dbErr?.message }, "bug-report: salvataggio DB fallito");
    res.status(500).json({ error: "Errore nel salvataggio. Riprova." });
    return;
  }

  if (config) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.password },
      });
      await transporter.sendMail({
        from: config.from || config.user,
        to: destination,
        replyTo: user.email,
        subject,
        html,
        text,
      });
    } catch (err: any) {
      logger.warn({ err: err?.message }, "bug-report: invio email fallito (salvato nel DB)");
    }
  } else {
    logger.warn("bug-report: nessun SMTP configurato, email non inviata (salvato nel DB)");
  }

  res.json({ ok: true });
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default router;
