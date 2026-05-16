import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { logger } from "./logger";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

function createTransportFromConfig(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
}

export async function getOrgSmtpConfig(orgId: number): Promise<SmtpConfig | null> {
  const key = `org_${orgId}_smtp_config`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return null;
  try { return JSON.parse(row.value as string) as SmtpConfig; } catch { return null; }
}

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface SendEmailResult {
  ok: boolean;
  error?: string;
  /** The Message-ID of the sent email (from nodemailer), usable for reply threading */
  messageId?: string;
}

/**
 * Send an email using the SMTP config configured by the organisation.
 * Returns { ok: false } (without throwing) if no config is set — callers
 * should log / surface this to the user as a configuration reminder.
 */
export async function sendEmailForOrg(
  orgId: number | null | undefined,
  args: SendEmailArgs
): Promise<SendEmailResult> {
  if (!orgId) {
    logger.warn({ to: args.to }, "sendEmailForOrg: nessun orgId — email non inviata");
    return { ok: false, error: "Nessuna organizzazione associata" };
  }
  const config = await getOrgSmtpConfig(orgId);
  if (!config) {
    logger.warn({ orgId, to: args.to }, "sendEmailForOrg: SMTP uscente non configurato");
    return { ok: false, error: "Configura l'email uscente SMTP nelle Impostazioni → Email" };
  }
  try {
    const transporter = createTransportFromConfig(config);
    const info = await transporter.sendMail({
      from: config.from || config.user,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    });
    return { ok: true, messageId: info.messageId ?? undefined };
  } catch (err: any) {
    logger.warn({ orgId, to: args.to, err: err?.message }, "sendEmailForOrg failed");
    return { ok: false, error: err?.message ?? "send failed" };
  }
}

/** @deprecated Use sendEmailForOrg — kept only for the SMTP test route */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, error: "Credenziali SMTP di sistema mancanti" };
  }
  try {
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    const from = process.env.SMTP_FROM || user;
    const info = await transporter.sendMail({ from, to: args.to, subject: args.subject, html: args.html, text: args.text, ...(args.replyTo ? { replyTo: args.replyTo } : {}) });
    return { ok: true, messageId: info.messageId ?? undefined };
  } catch (err: any) {
    logger.warn({ to: args.to, err: err?.message }, "sendEmail (legacy) failed");
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

export function buildPasswordResetEmail(args: {
  recipientName: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "TaskDesk — Reimposta la tua password";
  const text = `Ciao ${args.recipientName},\n\nHai richiesto il reset della password. Clicca sul link seguente per impostarne una nuova (valido per 1 ora):\n\n${args.resetUrl}\n\nSe non hai fatto questa richiesta, ignora questa email.\n\n— TaskDesk`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Reimposta la password</h2>
      <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Ciao <strong>${escapeHtml(args.recipientName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px;color:#6b7280">Abbiamo ricevuto una richiesta di reset della password per il tuo account. Clicca sul pulsante qui sotto per impostarne una nuova. Il link è valido per <strong>1 ora</strong>.</p>
      <a href="${args.resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px">Reimposta password →</a>
      <p style="margin-top:24px;font-size:13px;color:#6b7280">Se il pulsante non funziona, copia e incolla questo link nel browser:<br/><a href="${args.resetUrl}" style="color:#2563eb;word-break:break-all">${args.resetUrl}</a></p>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">Se non hai richiesto il reset della password, ignora questa email. La tua password non verrà modificata.</p>
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

export function buildInboundConfirmationEmail(args: {
  fromName: string;
  ticketNumber: number;
  ticketTitle: string;
  appBaseUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ Richiesta di assistenza ricevuta! [#${args.ticketNumber}]`;
  const text = [
    `Ciao ${args.fromName},`,
    "",
    `La tua richiesta di assistenza è stata ricevuta e registrata con il numero #${args.ticketNumber}.`,
    "",
    `Oggetto: ${args.ticketTitle}`,
    "",
    "Un nostro operatore la prenderà in carico al più presto e ti risponderà a questo indirizzo email.",
    "",
    "Grazie per averci contattato.",
    "",
    "— Il team di supporto",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="${args.appBaseUrl}/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Richiesta ricevuta</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#15803d">Ticket #${args.ticketNumber}</p>
      </div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">Ciao <strong>${escapeHtml(args.fromName)}</strong>,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#374151">
        La tua richiesta di assistenza è stata ricevuta e registrata correttamente.
        Un nostro operatore la prenderà in carico al più presto e ti risponderà a questo indirizzo email.
      </p>
      <table style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;border-collapse:collapse">
        <tr>
          <td style="padding:6px 12px;font-size:13px;color:#6b7280;white-space:nowrap;width:100px">Numero ticket</td>
          <td style="padding:6px 12px;font-size:13px;font-weight:600;color:#111827">#${args.ticketNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-size:13px;color:#6b7280">Oggetto</td>
          <td style="padding:6px 12px;font-size:13px;color:#111827">${escapeHtml(args.ticketTitle)}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;font-size:13px;color:#6b7280">Stato</td>
          <td style="padding:6px 12px;font-size:13px;color:#2563eb;font-weight:600">Aperto</td>
        </tr>
      </table>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
        Questo messaggio è stato inviato automaticamente. Per aggiornare la tua richiesta, rispondi a questa email oppure contatta direttamente il supporto.
      </p>
    </div>
  `;
  return { subject, html, text };
}

export function buildTicketReplyEmail(args: {
  toName: string;
  ticketNumber: number;
  ticketTitle: string;
  replyText: string;
  operatorName: string;
  appBaseUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Re: [#${args.ticketNumber}] ${args.ticketTitle}`;
  const text = [
    `Ciao ${args.toName},`,
    "",
    `Ti scriviamo riguardo alla tua richiesta di assistenza #${args.ticketNumber} — "${args.ticketTitle}".`,
    "",
    "Risposta dell'operatore:",
    "",
    args.replyText,
    "",
    `— ${args.operatorName}`,
    "  Il team di supporto",
    "",
    "Per rispondere o aggiungere ulteriori dettagli, rispondi a questa email.",
  ].join("\n");

  const replyHtml = args.replyText
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="${args.appBaseUrl}/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px 24px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:13px;color:#1d4ed8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Risposta al ticket</p>
        <p style="margin:0;font-size:28px;font-weight:700;color:#1e40af">#${args.ticketNumber}</p>
      </div>
      <p style="font-size:15px;line-height:1.6;margin:0 0 6px">Ciao <strong>${escapeHtml(args.toName)}</strong>,</p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 20px">
        Di seguito la risposta dell'operatore alla tua richiesta <strong>"${escapeHtml(args.ticketTitle)}"</strong>.
      </p>
      <div style="background:#f9fafb;border-left:4px solid #0f62fe;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;font-size:15px;line-height:1.7;color:#1f2937">
        ${replyHtml}
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px">— <strong>${escapeHtml(args.operatorName)}</strong>, Il team di supporto</p>
      <p style="margin-top:32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
        Per rispondere o aggiungere dettagli, rispondi a questa email. Fa' riferimento al ticket <strong>#${args.ticketNumber}</strong>.
      </p>
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
