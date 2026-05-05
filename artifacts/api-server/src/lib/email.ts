import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Credenziali SMTP mancanti (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = createTransport();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { ok: true };
  } catch (err: any) {
    logger.warn({ to: args.to, err: err?.message }, "email send failed");
    return { ok: false, error: err?.message ?? "send failed" };
  }
}

export function buildNotificationEmail(args: {
  recipientName: string;
  text: string;
  ticketId: number | null;
  appBaseUrl: string;
}): { subject: string; html: string; text: string } {
  const ticketLink = args.ticketId
    ? `${args.appBaseUrl}/app/tickets/${args.ticketId}`
    : `${args.appBaseUrl}/app/`;
  const subject = `TaskDesk — ${args.text.slice(0, 90)}`;
  const text = `Ciao ${args.recipientName},\n\n${args.text}\n\nApri TaskDesk: ${ticketLink}\n\n— TaskDesk`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <div style="width:36px;height:36px;border-radius:8px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px">T</div>
        <strong style="font-size:18px">TaskDesk</strong>
      </div>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Ciao <strong>${escapeHtml(args.recipientName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(args.text)}</p>
      <a href="${ticketLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Apri in TaskDesk →</a>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">Ricevi questa email perché hai abilitato le notifiche email. Puoi modificare le preferenze nelle impostazioni del tuo account.</p>
    </div>
  `;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
