import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketActivityLogsTable, ticketCommentsTable } from "@workspace/db";
import { sendEmail, buildInboundConfirmationEmail } from "../lib/email";
import { appBaseUrl } from "../lib/appUrl";
import { createNotificationsForTicket } from "../lib/notifications";

const router: IRouter = Router();

function extractText(body: any): string {
  // Maileroo sends text and/or html; prefer plain text
  return (
    body?.text ||
    body?.body_text ||
    body?.plain ||
    body?.body ||
    ""
  ).trim();
}

function extractField(body: any, ...keys: string[]): string {
  for (const k of keys) {
    if (body?.[k] && typeof body[k] === "string") return body[k].trim();
  }
  return "";
}

router.post("/inbound-email", async (req, res): Promise<void> => {
  // --- Token validation ---
  const expectedToken = process.env.INBOUND_EMAIL_TOKEN;
  const receivedToken = (req.query.token as string) || req.headers["x-webhook-token"];

  if (!expectedToken) {
    req.log.warn("INBOUND_EMAIL_TOKEN not configured — rejecting request");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  if (receivedToken !== expectedToken) {
    req.log.warn({ received: receivedToken }, "Invalid inbound email token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // --- Parse payload (Maileroo sends JSON) ---
  const body = req.body;

  const fromEmail = extractField(body, "from_email", "from", "sender_email");
  const fromName = extractField(body, "from_name", "sender_name", "name") || fromEmail;
  const subject = extractField(body, "subject") || "Richiesta di assistenza";
  const bodyText = extractText(body);

  if (!fromEmail) {
    req.log.warn({ body }, "Inbound email missing sender address");
    res.status(400).json({ error: "Missing sender email" });
    return;
  }

  // --- Resolve target organization ---
  const orgIdEnv = process.env.INBOUND_EMAIL_ORG_ID
    ? parseInt(process.env.INBOUND_EMAIL_ORG_ID, 10)
    : null;

  // Find an admin user to act as ticket creator
  let systemUser: { id: number; organizationId: number | null; name: string } | null = null;

  if (orgIdEnv) {
    const [u] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.organizationId, orgIdEnv),
          eq(usersTable.role, "admin"),
          eq(usersTable.isActive, true)
        )
      )
      .limit(1);
    systemUser = u ?? null;
  }

  if (!systemUser) {
    // Fall back to any active admin in the system
    const [u] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
      .from(usersTable)
      .where(and(eq(usersTable.role, "admin"), eq(usersTable.isActive, true)))
      .limit(1);
    systemUser = u ?? null;
  }

  if (!systemUser) {
    req.log.error("No admin user found to create inbound ticket");
    res.status(500).json({ error: "No admin user available" });
    return;
  }

  const orgId = systemUser.organizationId;

  // --- Compute sequential ticket number ---
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
    .from(ticketsTable)
    .where(orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`);
  const nextTicketNumber = (Number(maxNum) || 0) + 1;

  // --- Build ticket title and description ---
  const title = subject.length > 120 ? subject.slice(0, 117) + "…" : subject;
  const description = [
    `📧 Richiesta ricevuta via email da: ${fromName} <${fromEmail}>`,
    "",
    bodyText || "(nessun testo nel corpo dell'email)",
  ].join("\n");

  // --- Create ticket ---
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

  // --- Activity log ---
  await db.insert(ticketActivityLogsTable).values({
    ticketId: ticket.id,
    userId: systemUser.id,
    actionType: "created",
    actionDescription: `Ticket creato automaticamente da email di ${fromName} <${fromEmail}>`,
  });

  // --- Add original email as first comment ---
  if (bodyText) {
    await db.insert(ticketCommentsTable).values({
      ticketId: ticket.id,
      authorId: systemUser.id,
      commentText: `**Messaggio originale da ${fromName} <${fromEmail}>:**\n\n${bodyText}`,
    });
  }

  // --- In-app notifications ---
  await createNotificationsForTicket(
    ticket.id,
    `Nuova richiesta via email da ${fromName}: "${title}" (ticket #${nextTicketNumber})`,
    systemUser.id,
    "ticket_created",
    orgId
  );

  // --- Confirmation email to sender ---
  const baseUrl = appBaseUrl();
  const { subject: confSubject, html, text } = buildInboundConfirmationEmail({
    fromName,
    ticketNumber: nextTicketNumber,
    ticketTitle: title,
    appBaseUrl: baseUrl,
  });

  const emailResult = await sendEmail({ to: fromEmail, subject: confSubject, html, text });
  if (!emailResult.ok) {
    req.log.warn({ to: fromEmail, err: emailResult.error }, "Failed to send inbound confirmation email");
  }

  req.log.info({ ticketId: ticket.id, ticketNumber: nextTicketNumber, from: fromEmail }, "Inbound email ticket created");
  res.status(200).json({ ok: true, ticketId: ticket.id, ticketNumber: nextTicketNumber });
});

export default router;
