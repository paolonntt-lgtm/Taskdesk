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
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Ciao <strong>${escapeHtml(args.recipientName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(args.text)}</p>
      <a href="${ticketLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Apri in TaskDesk →</a>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">Ricevi questa email perché hai abilitato le notifiche email. Puoi modificare le preferenze nelle impostazioni del tuo account.</p>
    </div>
  `;
  return { subject, html, text };
}

export function buildRegistrationNotificationEmail(args: {
  userName: string;
  userEmail: string;
  organizationName: string;
  registeredAt: string;
  appBaseUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `TaskDesk — Nuova registrazione: ${args.organizationName}`;
  const text = `Nuova registrazione su TaskDesk!\n\nAzienda: ${args.organizationName}\nNome: ${args.userName}\nEmail: ${args.userEmail}\nData: ${args.registeredAt}\n\nGestisci gli iscritti: ${args.appBaseUrl}/app/subscribers\n\n— TaskDesk`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 16px">🎉 Nuova registrazione</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280;width:120px">Azienda</td>
          <td style="padding:10px 0;font-weight:600">${escapeHtml(args.organizationName)}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280">Nome</td>
          <td style="padding:10px 0">${escapeHtml(args.userName)}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 0;color:#6b7280">Email</td>
          <td style="padding:10px 0">${escapeHtml(args.userEmail)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280">Data</td>
          <td style="padding:10px 0">${escapeHtml(args.registeredAt)}</td>
        </tr>
      </table>
      <a href="${args.appBaseUrl}/app/subscribers" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Vedi tutti gli iscritti →</a>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af">Email automatica inviata ai superadmin di TaskDesk.</p>
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
