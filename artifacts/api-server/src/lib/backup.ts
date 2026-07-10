import {
  db,
  organizationsTable,
  usersTable,
  ticketsTable,
  ticketCommentsTable,
  ticketInternalNotesTable,
  ticketActivityLogsTable,
  ticketAttachmentsTable,
  clientsTable,
  clientNotesTable,
  groupsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { sendEmailForOrg } from "./email";
import { logger } from "./logger";

const storage = new ObjectStorageService();

export async function runBackupForOrg(orgId: number): Promise<{ ok: boolean; path?: string; emailsSent?: number; error?: string }> {
  try {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
    if (!org) return { ok: false, error: "Organization not found" };

    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.organizationId, orgId));

    const tickets = await db.select().from(ticketsTable).where(eq(ticketsTable.organizationId, orgId));
    const ticketIds = tickets.map((t) => t.id);

    const clients = await db.select().from(clientsTable).where(eq(clientsTable.organizationId, orgId));
    const clientIds = clients.map((c) => c.id);

    const [comments, internalNotes, activityLogs, attachments, clientNotes, groups] = await Promise.all([
      ticketIds.length > 0
        ? db.select().from(ticketCommentsTable).where(inArray(ticketCommentsTable.ticketId, ticketIds))
        : [],
      ticketIds.length > 0
        ? db.select().from(ticketInternalNotesTable).where(inArray(ticketInternalNotesTable.ticketId, ticketIds))
        : [],
      ticketIds.length > 0
        ? db.select().from(ticketActivityLogsTable).where(inArray(ticketActivityLogsTable.ticketId, ticketIds))
        : [],
      ticketIds.length > 0
        ? db.select().from(ticketAttachmentsTable).where(inArray(ticketAttachmentsTable.ticketId, ticketIds))
        : [],
      clientIds.length > 0
        ? db.select().from(clientNotesTable).where(inArray(clientNotesTable.clientId, clientIds))
        : [],
      db.select().from(groupsTable).where(eq(groupsTable.organizationId, orgId)),
    ]);

    const now = new Date();
    const dateLabel = now.toISOString().slice(0, 10);

    const payload = {
      exportedAt: now.toISOString(),
      organization: { id: org.id, name: org.name },
      summary: {
        users: users.length,
        tickets: tickets.length,
        comments: comments.length,
        internalNotes: internalNotes.length,
        activityLogs: activityLogs.length,
        attachments: attachments.length,
        clients: clients.length,
        clientNotes: clientNotes.length,
        groups: groups.length,
      },
      data: {
        users,
        tickets,
        comments,
        internalNotes,
        activityLogs,
        attachments,
        clients,
        clientNotes,
        groups,
      },
    };

    const jsonBuffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
    const filename = `taskdesk-backup-${dateLabel}.json`;
    const subPath = `backups/${orgId}/${filename}`;

    let storagePath: string | undefined;
    try {
      storagePath = await storage.uploadBuffer(subPath, jsonBuffer, "application/json");
      logger.info({ orgId, path: storagePath }, "backup: saved to object storage");
    } catch (err: any) {
      logger.warn({ orgId, err: err?.message }, "backup: object storage upload failed — continuing to email");
    }

    const admins = users.filter((u) => u.role === "admin" && u.isActive);
    let emailsSent = 0;
    for (const admin of admins) {
      const result = await sendEmailForOrg(orgId, {
        to: admin.email,
        subject: `TaskDesk — Backup dati ${dateLabel}`,
        html: buildBackupEmailHtml({ orgName: org.name, date: dateLabel, summary: payload.summary }),
        text: buildBackupEmailText({ orgName: org.name, date: dateLabel, summary: payload.summary }),
        attachments: [{ filename, content: jsonBuffer, contentType: "application/json" }],
      });
      if (result.ok) emailsSent++;
      else logger.warn({ orgId, to: admin.email, err: result.error }, "backup: email send failed");
    }

    return { ok: true, path: storagePath, emailsSent };
  } catch (err: any) {
    logger.error({ orgId, err: err?.message }, "backup: unexpected error");
    return { ok: false, error: err?.message ?? "unknown error" };
  }
}

function buildBackupEmailText(args: { orgName: string; date: string; summary: Record<string, number> }): string {
  const rows = Object.entries(args.summary).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return [
    `Backup giornaliero TaskDesk — ${args.date}`,
    `Organizzazione: ${args.orgName}`,
    "",
    "Riepilogo dati esportati:",
    rows,
    "",
    "Il file JSON completo è allegato a questa email.",
    "",
    "— TaskDesk",
  ].join("\n");
}

function buildBackupEmailHtml(args: { orgName: string; date: string; summary: Record<string, number> }): string {
  const labelMap: Record<string, string> = {
    users: "Utenti",
    tickets: "Ticket",
    comments: "Commenti",
    internalNotes: "Note interne",
    activityLogs: "Log attività",
    attachments: "Allegati (metadati)",
    clients: "Clienti",
    clientNotes: "Note cliente",
    groups: "Gruppi",
  };
  const rows = Object.entries(args.summary)
    .map(([k, v]) => `<tr><td style="padding:7px 12px;color:#6b7280;font-size:13px">${labelMap[k] ?? k}</td><td style="padding:7px 12px;font-size:13px;font-weight:600;color:#111827">${v}</td></tr>`)
    .join("");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="margin-bottom:24px">
        <img src="https://www.taskdesk.it/taskdesk-logo.png" alt="TaskDesk" width="130" height="auto" style="display:block;height:auto" />
      </div>
      <h2 style="font-size:18px;font-weight:700;margin:0 0 4px">Backup giornaliero</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 20px">${args.orgName} — ${args.date}</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;margin-bottom:20px">
        ${rows}
      </table>
      <p style="font-size:14px;color:#374151;margin:0 0 8px">Il file JSON completo con tutti i dati è allegato a questa email.</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">Backup automatico TaskDesk — archivia questa email in un posto sicuro.</p>
    </div>
  `;
}
