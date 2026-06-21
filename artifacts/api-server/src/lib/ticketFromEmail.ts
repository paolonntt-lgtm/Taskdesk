import { eq, sql, and, or, inArray } from "drizzle-orm";
import { db, ticketsTable, usersTable, ticketActivityLogsTable, ticketCommentsTable, inboundEmailChannelsTable, ticketAttachmentsTable } from "@workspace/db";
import { sendEmail, buildInboundConfirmationEmail } from "./email";
import { appBaseUrl } from "./appUrl";
import { createNotificationsForTicket, createNotificationForUser } from "./notifications";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import { randomUUID } from "crypto";

export interface InboundAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
  oversized: boolean;
}

const objectStorage = new ObjectStorageService();

/**
 * Saves inbound email attachments to object storage and inserts rows into
 * ticket_attachments. Oversized files are skipped but a warning line is
 * returned so the caller can append it to the ticket/comment body.
 * Individual errors do not abort the process — they are logged and skipped.
 *
 * @returns Array of warning lines (one per oversized/failed attachment) to
 *          append to the ticket description or comment text.
 */
async function saveInboundAttachments(
  ticketId: number,
  commentId: number | null,
  orgId: number | null,
  systemUserId: number,
  attachments: InboundAttachment[],
): Promise<string[]> {
  const warnings: string[] = [];

  for (const att of attachments) {
    if (att.oversized) {
      warnings.push(`⚠️ Allegato '${att.filename}' non salvato: dimensione superiore al limite di 10 MB`);
      continue;
    }

    try {
      const orgSegment = orgId != null ? String(orgId) : "0";
      const safeFilename = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
      const subPath = `inbound/${orgSegment}/${ticketId}/${randomUUID()}-${safeFilename}`;

      const objectPath = await objectStorage.uploadBuffer(subPath, att.data, att.mimeType);

      await db.insert(ticketAttachmentsTable).values({
        ticketId,
        commentId,
        uploadedBy: systemUserId,
        objectPath,
        fileName: att.filename,
        fileSize: att.data.length,
        mimeType: att.mimeType,
      });
    } catch (err) {
      logger.warn({ err, filename: att.filename, ticketId }, "Failed to save inbound attachment");
    }
  }

  return warnings;
}

function buildChannelAddress(ch: { token: string; slug: string | null }): string {
  return ch.slug ?? `tickets-${ch.token}`;
}

async function getInboundRouting(orgId: number | null | undefined, inboundChannelId?: number | null): Promise<{ defaultCategory?: string; defaultGroup?: string; channelLocalPart?: string }> {
  if (!orgId || !inboundChannelId) return {};

  try {
    const [ch] = await db.select().from(inboundEmailChannelsTable)
      .where(and(eq(inboundEmailChannelsTable.id, inboundChannelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
    if (ch) {
      return {
        defaultCategory: ch.defaultCategory ?? undefined,
        defaultGroup: ch.defaultGroup ?? undefined,
        channelLocalPart: buildChannelAddress(ch),
      };
    }
  } catch { /* ignore */ }
  return {};
}

const TICKET_NUMBER_RE = /\[#(\d+)\]/;

/**
 * Strips quoted reply content from an email body, keeping only the new text
 * written by the sender. Handles Gmail (IT/EN), Outlook, Yahoo, and RFC ">".
 */
function stripEmailQuotes(body: string): string {
  const quoteHeaderPatterns = [
    // Standard email reply separators
    /\r?\n-- \r?\n/,
    /\r?\n--\r?\n/,
    // Gmail IT/EN
    /\r?\nIl giorno .{5,200}ha scritto:\s*\r?\n/,
    /\r?\nOn .{5,200}wrote:\s*\r?\n/,
    // Outlook IT/EN
    /\r?\nDa: .{1,200}\r?\n.*(?:Inviato|Oggetto|A:)/,
    /\r?\nFrom: .{1,200}\r?\n.*(?:Sent|Subject|To:)/,
    // Generic separators
    /\r?\n-{3,}\s*(?:Original Message|Messaggio originale)\s*-{3,}/i,
    /\r?\n_{5,}\r?\n/,
    // MIME boundary markers (from raw MIME parsing in Cloudflare Worker)
    /\r?\n--[A-Za-z0-9_\-+/=]{10,}/,
    // Long dash/underscore separator lines
    /\r?\n[=\-_]{20,}\r?\n/,
  ];

  let text = body;
  let cutAt = text.length;
  for (const pattern of quoteHeaderPatterns) {
    const m = pattern.exec(text);
    if (m && m.index < cutAt) cutAt = m.index;
  }
  text = text.slice(0, cutAt).trim();

  text = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();

  return text || body.trim();
}

/**
 * Normalises an email subject for fallback matching:
 * strips Re:, Fwd:, Fw:, AW:, etc. prefixes (case-insensitive), trims whitespace.
 */
function normaliseSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw|aw|sv|vs|r|rif|ant)[\s:]+/gi, "")
    .trim()
    .toLowerCase();
}

/**
 * Parses a References header string (space/newline separated message-ids) into
 * an array of individual message-id strings.
 */
function parseReferences(references: string): string[] {
  return references
    .split(/[\s,]+/)
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * Finds the system user for an org, or creates one if it doesn't exist yet.
 * The system user is the internal "robot" that owns tickets created via inbound email.
 */
async function getOrCreateSystemUser(
  orgId: number | null,
): Promise<{ id: number; organizationId: number | null; name: string }> {
  if (orgId != null) {
    const [existing] = await db
      .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.isSystem, true)))
      .limit(1);
    if (existing) return existing;
  }

  const [anySystem] = await db
    .select({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.isSystem, true))
    .limit(1);
  if (anySystem) return anySystem;

  const [created] = await db
    .insert(usersTable)
    .values({
      name: "Sistema",
      email: `_sistema_${orgId ?? 0}@taskdesk.internal`,
      passwordHash: "!",
      role: "admin",
      organizationId: orgId,
      isActive: true,
      isSystem: true,
    })
    .returning({ id: usersTable.id, organizationId: usersTable.organizationId, name: usersTable.name });

  logger.info({ orgId, systemUserId: created.id }, "Created system user for inbound email");
  return created;
}

export interface EmailTicketInput {
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  /** Attachments extracted from the inbound email MIME payload */
  attachments?: InboundAttachment[];
  orgId?: number | null;
  /** Message-ID header of the incoming email (RFC 2822) */
  messageId?: string;
  /** In-Reply-To header of the incoming email */
  inReplyTo?: string;
  /** References header of the incoming email (space-separated message-ids) */
  references?: string;
  /** Provider-specific thread/conversation identifier (e.g. Microsoft Graph conversationId) */
  conversationId?: string;
  /** Channel ID this email arrived on (IMAP/SMTP, for per-channel routing) */
  channelId?: number | null;
  /** Inbound forwarding channel ID (inbound_email_channels table) */
  inboundChannelId?: number | null;
  /** True when the email arrived wrapped in a PEC (Posta Elettronica Certificata) envelope */
  isPec?: boolean;
}

export interface EmailTicketResult {
  ticketId: number;
  ticketNumber: number;
}

export async function createTicketFromEmail(input: EmailTicketInput): Promise<EmailTicketResult> {
  const { fromEmail, fromName, subject, bodyText, attachments, orgId: targetOrgId, messageId, conversationId, channelId, inboundChannelId, isPec } = input;

  const systemUser = await getOrCreateSystemUser(targetOrgId ?? null);
  if (!systemUser) throw new Error("No system user found or created for inbound ticket");

  const orgId = systemUser.organizationId;

  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(ticket_number), 0)` })
    .from(ticketsTable)
    .where(orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`);
  const nextTicketNumber = (Number(maxNum) || 0) + 1;

  const title = subject.length > 120 ? subject.slice(0, 117) + "…" : subject;
  const senderLabel = fromName && fromName !== fromEmail
    ? `${fromName} <${fromEmail}>`
    : fromEmail;
  const channelIcon = isPec ? "🔏" : "📧";
  const channelLabel = isPec ? "Ricevuto via PEC da" : "Ricevuto via email da";
  const description = [
    `${channelIcon} ${channelLabel}: ${senderLabel}`,
    "",
    bodyText || "(nessun testo)",
  ].join("\n");

  const routing = await getInboundRouting(orgId, inboundChannelId);

  // Auto-assign to the least-loaded available operator in the default group
  let autoAssignedUserId: number | null = null;
  if (routing.defaultGroup && orgId) {
    try {
      const groupMembers = await db
        .select({ id: usersTable.id, groups: usersTable.groups })
        .from(usersTable)
        .where(and(
          eq(usersTable.organizationId, orgId),
          eq(usersTable.isActive, true),
          eq(usersTable.isAvailable, true),
        ));

      const eligible = groupMembers.filter((u) => {
        if (!u.groups) return false;
        try {
          const arr: string[] = JSON.parse(u.groups);
          return arr.includes(routing.defaultGroup!);
        } catch { return false; }
      });

      if (eligible.length > 0) {
        const eligibleIds = eligible.map((u) => u.id);
        const openCounts = await db
          .select({ assignedTo: ticketsTable.assignedTo, count: sql<number>`COUNT(*)::int` })
          .from(ticketsTable)
          .where(and(
            eq(ticketsTable.organizationId, orgId),
            inArray(ticketsTable.assignedTo, eligibleIds),
            or(eq(ticketsTable.status, "open"), eq(ticketsTable.status, "waiting")),
          ))
          .groupBy(ticketsTable.assignedTo);

        const countMap = new Map<number, number>();
        for (const row of openCounts) {
          if (row.assignedTo != null) countMap.set(row.assignedTo, row.count);
        }

        let minLoad = Infinity;
        let minUserId: number | null = null;
        for (const u of eligible) {
          const load = countMap.get(u.id) ?? 0;
          if (load < minLoad) {
            minLoad = load;
            minUserId = u.id;
          }
        }
        autoAssignedUserId = minUserId;
      }
    } catch (err) {
      logger.warn({ err }, "Auto-assignment query failed, skipping");
    }
  }

  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      title,
      description,
      category: routing.defaultCategory ?? "",
      location: "Esterno",
      resource: fromEmail,
      priority: "medium",
      status: "open",
      createdBy: systemUser.id,
      organizationId: orgId,
      ticketNumber: nextTicketNumber,
      assignedToGroup: routing.defaultGroup ?? null,
      assignedTo: autoAssignedUserId ?? null,
      emailMessageId: messageId ?? null,
      emailConversationId: conversationId ?? null,
      inboundChannelId: inboundChannelId ?? null,
    })
    .returning();

  // Save inbound attachments (fire-and-forget errors; oversized ones return warning lines)
  if (attachments && attachments.length > 0) {
    try {
      const warnings = await saveInboundAttachments(ticket.id, null, orgId, systemUser.id, attachments);
      if (warnings.length > 0) {
        const updatedDescription = [description, "", ...warnings].join("\n");
        await db.update(ticketsTable)
          .set({ description: updatedDescription })
          .where(eq(ticketsTable.id, ticket.id));
      }
    } catch (err) {
      logger.warn({ err, ticketId: ticket.id }, "Error saving inbound attachments for new ticket");
    }
  }

  const activityDescParts = [`Ticket creato automaticamente da email di ${fromName} <${fromEmail}>`];
  if (autoAssignedUserId) {
    const [assignedUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, autoAssignedUserId));
    activityDescParts.push(`Assegnato automaticamente a ${assignedUser?.name ?? `utente #${autoAssignedUserId}`} (operatore meno carico disponibile)`);
  }

  await db.insert(ticketActivityLogsTable).values({
    ticketId: ticket.id,
    userId: systemUser.id,
    actionType: "created",
    actionDescription: activityDescParts.join(". "),
  });

  await createNotificationsForTicket(
    ticket.id,
    `Nuova richiesta via email da ${fromName}: "${title}" (ticket #${nextTicketNumber})`,
    systemUser.id,
    "ticket_created",
    orgId
  );

  if (autoAssignedUserId) {
    await createNotificationForUser(
      autoAssignedUserId,
      ticket.id,
      `Ti è stato assegnato automaticamente il ticket #${nextTicketNumber}: "${title}"`,
      "ticket_assigned",
      orgId
    );
  }

  try {
    const baseUrl = appBaseUrl();
    const { subject: confSubject, html, text } = buildInboundConfirmationEmail({
      fromName,
      ticketNumber: nextTicketNumber,
      ticketTitle: title,
      appBaseUrl: baseUrl,
    });
    const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.taskdesk.it";
    const replyTo = routing.channelLocalPart ? `${routing.channelLocalPart}@${inboundDomain}` : undefined;
    const emailResult = await sendEmail({ to: fromEmail, subject: confSubject, html, text, replyTo });
    if (!emailResult.ok) {
      logger.warn({ to: fromEmail, err: emailResult.error }, "Failed to send inbound confirmation email");
    } else if (emailResult.messageId) {
      await db.update(ticketsTable)
        .set({ emailMessageId: emailResult.messageId })
        .where(eq(ticketsTable.id, ticket.id));
    }
  } catch (err) {
    logger.warn({ err }, "Error sending inbound confirmation email");
  }

  logger.info({ ticketId: ticket.id, ticketNumber: nextTicketNumber, from: fromEmail }, "Inbound email ticket created");
  return { ticketId: ticket.id, ticketNumber: nextTicketNumber };
}

/**
 * Threads an email reply as a comment on an existing ticket.
 * Re-opens the ticket if it was closed. Logs activity and sends notifications.
 */
async function threadReplyAsComment(
  ticket: typeof ticketsTable.$inferSelect,
  systemUserId: number,
  systemUserOrgId: number | null,
  fromEmail: string,
  fromName: string,
  bodyText: string,
  matchReason: string,
  attachments?: InboundAttachment[],
): Promise<void> {
  if (ticket.status === "closed") {
    await db.update(ticketsTable).set({ status: "open", updatedAt: new Date() }).where(eq(ticketsTable.id, ticket.id));
    await db.insert(ticketActivityLogsTable).values({
      ticketId: ticket.id,
      userId: systemUserId,
      actionType: "status_changed",
      actionDescription: `Ticket riaperto automaticamente per risposta del cliente`,
    });
  }

  const cleanBody = stripEmailQuotes(bodyText || "").trim() || "(nessun testo)";
  const commentText = [
    `📧 **Risposta del cliente** — da: ${fromName} <${fromEmail}>`,
    "",
    cleanBody,
  ].join("\n");

  const [comment] = await db
    .insert(ticketCommentsTable)
    .values({ ticketId: ticket.id, authorId: systemUserId, commentText })
    .returning();

  // Save inbound attachments linked to this comment
  if (attachments && attachments.length > 0) {
    try {
      const warnings = await saveInboundAttachments(ticket.id, comment.id, systemUserOrgId, systemUserId, attachments);
      if (warnings.length > 0) {
        const updatedCommentText = [commentText, "", ...warnings].join("\n");
        await db.update(ticketCommentsTable)
          .set({ commentText: updatedCommentText })
          .where(eq(ticketCommentsTable.id, comment.id));
      }
    } catch (err) {
      logger.warn({ err, ticketId: ticket.id, commentId: comment.id }, "Error saving inbound attachments for comment");
    }
  }

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, ticket.id));

  await db.insert(ticketActivityLogsTable).values({
    ticketId: ticket.id,
    userId: systemUserId,
    actionType: "comment_added",
    actionDescription: `Risposta del cliente ricevuta via email da ${fromName} <${fromEmail}>`,
  });

  await createNotificationsForTicket(
    ticket.id,
    `${fromName} ha risposto via email al ticket #${ticket.ticketNumber}: "${ticket.title}"`,
    systemUserId,
    "ticket_commented",
    systemUserOrgId
  );

  logger.info(
    { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, commentId: comment.id, from: fromEmail, matchReason },
    "Customer email reply threaded into existing ticket"
  );
}

/**
 * Entry point for all pollers.
 * Threading priority:
 * 1. Subject contains [#N] and sender matches resource
 * 2. In-Reply-To / References header matches a known ticket's email_message_id
 * 3. Same sender + same normalised subject (open/recently-closed tickets only)
 * Otherwise, creates a new ticket.
 */
export async function processInboundEmail(input: EmailTicketInput): Promise<void> {
  const { fromEmail, fromName, subject, bodyText, attachments, orgId: targetOrgId, inReplyTo, references, conversationId } = input;

  const systemUser = await getOrCreateSystemUser(targetOrgId ?? null);

  if (systemUser) {
    const orgId = systemUser.organizationId;

    // --- 1. [#N] subject match ---
    const match = TICKET_NUMBER_RE.exec(subject);
    if (match) {
      const ticketNumber = parseInt(match[1], 10);
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

      if (ticket && ticket.resource && ticket.resource.toLowerCase() === fromEmail.toLowerCase()) {
        await threadReplyAsComment(ticket, systemUser.id, orgId, fromEmail, fromName, bodyText, "[#N] subject match", attachments);
        return;
      }
    }

    // --- 2. In-Reply-To / References header match ---
    const referencedIds: string[] = [];
    if (inReplyTo) referencedIds.push(inReplyTo.trim());
    if (references) {
      for (const ref of parseReferences(references)) {
        if (!referencedIds.includes(ref)) referencedIds.push(ref);
      }
    }

    if (referencedIds.length > 0) {
      for (const msgId of referencedIds) {
        if (!msgId) continue;
        const [ticket] = await db
          .select()
          .from(ticketsTable)
          .where(
            and(
              eq(ticketsTable.emailMessageId, msgId),
              orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`
            )
          )
          .limit(1);

        if (ticket && ticket.resource && ticket.resource.toLowerCase() === fromEmail.toLowerCase()) {
          await threadReplyAsComment(ticket, systemUser.id, orgId, fromEmail, fromName, bodyText, "In-Reply-To/References header match", attachments);
          return;
        }
      }
    }

    // --- 2b. Conversation-ID match ---
    if (conversationId) {
      const [ticket] = await db
        .select()
        .from(ticketsTable)
        .where(
          and(
            eq(ticketsTable.emailConversationId, conversationId),
            orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`
          )
        )
        .limit(1);

      if (ticket && ticket.resource && ticket.resource.toLowerCase() === fromEmail.toLowerCase()) {
        await threadReplyAsComment(ticket, systemUser.id, orgId, fromEmail, fromName, bodyText, "conversationId match", attachments);
        return;
      }
    }

    // --- 3. Subject fallback ---
    // Only apply if the incoming subject has a reply prefix (Re:, Rif:, R:, Ant:, …).
    // A fresh email that happens to share the same base subject always creates a new ticket.
    const hasReplyPrefix = /^(re|fwd|fw|aw|sv|vs|r|rif|ant)[\s:]+/i.test(subject.trim());
    const normSubject = hasReplyPrefix ? normaliseSubject(subject) : "";
    if (normSubject) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fromEmailLower = fromEmail.toLowerCase();
      const candidates = await db
        .select()
        .from(ticketsTable)
        .where(
          and(
            sql`lower(${ticketsTable.resource}) = ${fromEmailLower}`,
            orgId != null ? eq(ticketsTable.organizationId, orgId) : sql`organization_id IS NULL`,
            or(
              sql`${ticketsTable.status} != 'closed'`,
              sql`${ticketsTable.closedAt} > ${thirtyDaysAgo.toISOString()}`
            )
          )
        );

      for (const candidate of candidates) {
        if (normaliseSubject(candidate.title) === normSubject) {
          await threadReplyAsComment(candidate, systemUser.id, orgId, fromEmail, fromName, bodyText, "subject fallback match", attachments);
          return;
        }
      }
    }
  }

  await createTicketFromEmail(input);
}
