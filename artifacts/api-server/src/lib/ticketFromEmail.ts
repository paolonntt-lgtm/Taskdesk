import { eq, sql, and } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketActivityLogsTable } from "@workspace/db";
import { sendEmail, buildInboundConfirmationEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { createNotificationsForTicket } from "./notifications";
import { logger } from "./logger";

export interface EmailTicketInput {
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  orgId?: number | null;
}

export interface EmailTicketResult {
  ticketId: number;
  ticketNumber: number;
}

export async function createTicketFromEmail(input: EmailTicketInput): Promise<EmailTicketResult> {
  const { fromEmail, fromName, subject, bodyText, orgId: targetOrgId } = input;

  let systemUser: { id: number; organizationId: number | null; name: string } | null = null;

  if (targetOrgId) {
    const [u] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, targetOrgId), eq(usersTable.role, "admin"), eq(usersTable.isActive, true)))
      .limit(1);
    systemUser = u ?? null;
  }

  if (!systemUser) {
    const [u] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
      .from(usersTable)
      .where(and(eq(usersTable.role, "admin"), eq(usersTable.isActive, true)))
      .limit(1);
    systemUser = u ?? null;
  }

  if (!systemUser) throw new Error("No admin user found to create inbound ticket");

  const orgId = systemUser.organizationId;

  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
    .from(ticketsTable)
    .where(orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`);
  const nextTicketNumber = (Number(maxNum) || 0) + 1;

  const title = subject.length > 120 ? subject.slice(0, 117) + "…" : subject;
  const description = [
    `📧 Richiesta ricevuta via email da: ${fromName} <${fromEmail}>`,
    "",
    bodyText || "(nessun testo nel corpo dell'email)",
  ].join("\n");

  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      title,
      description,
      category: "Email Fornitore",
      location: "Esterno",
      resource: fromEmail,
      priority: "medium",
      status: "open",
      createdBy: systemUser.id,
      organizationId: orgId,
      ticketNumber: nextTicketNumber,
    })
    .returning();

  await db.insert(ticketActivityLogsTable).values({
    ticketId: ticket.id,
    userId: systemUser.id,
    actionType: "created",
    actionDescription: `Ticket creato automaticamente da email di ${fromName} <${fromEmail}>`,
  });

  await createNotificationsForTicket(
    ticket.id,
    `Nuova richiesta via email da ${fromName}: "${title}" (ticket #${nextTicketNumber})`,
    systemUser.id,
    "ticket_created",
    orgId
  );

  try {
    const baseUrl = appBaseUrl();
    const { subject: confSubject, html, text } = buildInboundConfirmationEmail({
      fromName,
      ticketNumber: nextTicketNumber,
      ticketTitle: title,
      appBaseUrl: baseUrl,
    });
    const emailResult = await sendEmail({ to: fromEmail, subject: confSubject, html, text });
    if (!emailResult.ok) {
      logger.warn({ to: fromEmail, err: emailResult.error }, "Failed to send inbound confirmation email");
    }
  } catch (err) {
    logger.warn({ err }, "Error sending inbound confirmation email");
  }

  logger.info({ ticketId: ticket.id, ticketNumber: nextTicketNumber, from: fromEmail }, "Inbound email ticket created");
  return { ticketId: ticket.id, ticketNumber: nextTicketNumber };
}
