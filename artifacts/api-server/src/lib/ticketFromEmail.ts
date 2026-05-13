import { eq, sql, and } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketActivityLogsTable, ticketCommentsTable } from "@workspace/db";
import { sendEmail, buildInboundConfirmationEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { createNotificationsForTicket } from "./notifications";
import { logger } from "./logger";

const TICKET_NUMBER_RE = /\[#(\d+)\]/;

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

/**
 * Entry point for all pollers.
 * If the email subject contains [#N] and the ticket's resource matches the
 * sender, the body is threaded as a comment. Otherwise a new ticket is created.
 */
export async function processInboundEmail(input: EmailTicketInput): Promise<void> {
  const { fromEmail, fromName, subject, bodyText, orgId: targetOrgId } = input;

  const match = TICKET_NUMBER_RE.exec(subject);
  if (match) {
    const ticketNumber = parseInt(match[1], 10);

    // Find a system/admin user for this org (needed as comment author)
    let systemUser: { id: number; organizationId: number | null } | null = null;
    if (targetOrgId) {
      const [u] = await db
        .select({ id: usersTable.id, organizationId: usersTable.organizationId })
        .from(usersTable)
        .where(and(eq(usersTable.organizationId, targetOrgId), eq(usersTable.role, "admin"), eq(usersTable.isActive, true)))
        .limit(1);
      systemUser = u ?? null;
    }
    if (!systemUser) {
      const [u] = await db
        .select({ id: usersTable.id, organizationId: usersTable.organizationId })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), eq(usersTable.isActive, true)))
        .limit(1);
      systemUser = u ?? null;
    }

    if (systemUser) {
      const orgId = systemUser.organizationId;
      const [ticket] = await db
        .select()
        .from(ticketsTable)
        .where(
          and(
            eq(ticketsTable.ticketNumber, ticketNumber),
            orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`
          )
        )
        .limit(1);

      // Only thread if the sender matches the original customer email
      if (ticket && ticket.resource && ticket.resource.toLowerCase() === fromEmail.toLowerCase()) {
        if (ticket.status === "closed") {
          // Re-open closed ticket when customer replies
          await db.update(ticketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(ticketsTable.id, ticket.id));
          await db.insert(ticketActivityLogsTable).values({
            ticketId: ticket.id,
            userId: systemUser.id,
            actionType: "status_changed",
            actionDescription: `Ticket riaperto automaticamente per risposta del cliente`,
          });
        }

        const commentText = [
          `📧 **Risposta del cliente** — da: ${fromName} <${fromEmail}>`,
          "",
          bodyText || "(nessun testo)",
        ].join("\n");

        const [comment] = await db
          .insert(ticketCommentsTable)
          .values({ ticketId: ticket.id, authorId: systemUser.id, commentText })
          .returning();

        await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, ticket.id));

        await db.insert(ticketActivityLogsTable).values({
          ticketId: ticket.id,
          userId: systemUser.id,
          actionType: "comment_added",
          actionDescription: `Risposta del cliente ricevuta via email da ${fromName} <${fromEmail}>`,
        });

        await createNotificationsForTicket(
          ticket.id,
          `${fromName} ha risposto via email al ticket #${ticketNumber}: "${ticket.title}"`,
          systemUser.id,
          "ticket_commented",
          orgId
        );

        logger.info({ ticketId: ticket.id, ticketNumber, commentId: comment.id, from: fromEmail }, "Customer email reply threaded into existing ticket");
        return;
      }
    }
  }

  // No matching ticket found — create a new one as usual
  await createTicketFromEmail(input);
}
